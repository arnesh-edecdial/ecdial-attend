import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  STATUSES,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  TAKING_TO,
  TAKING_TO_KEYS,
  takingToLabel,
  ITEM_TYPE_LABELS,
  DEFAULT_SITES,
  DEFAULT_PROBLEMS,
  UNKNOWN_PROBLEM,
  PRIVILEGED_ROLES,
  MAX_IMAGE_BYTES,
  LIMITS,
  ServiceStatus,
} from '../utils/serviceIntakeConfig';

/**
 * NOTE: nothing in this file touches Product.availableStock.
 * Service items only *reference* a Product for its model name.
 */

const SERVICE_INTAKE_DIR = path.resolve(__dirname, '../../assets/service-intake');

type Tx = Prisma.TransactionClient;
type Who = { id: string; name: string; role: string };

const who = (req: AuthenticatedRequest): Who | null => {
  const u: any = req.user;
  if (!u?.id) return null;
  return { id: u.id, name: u.name || 'ECDIAL Staff', role: String(u.role ?? '') };
};
const isPrivileged = (w: Who) => PRIVILEGED_ROLES.includes(w.role);

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const isStatus = (v: unknown): v is ServiceStatus => typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
const label = (s: string | null | undefined) => (s ? STATUS_LABELS[s as ServiceStatus] ?? s : 'None');
const ageDays = (receivedAt: Date, closedAt?: Date | null) =>
  Math.max(0, Math.floor(((closedAt ? closedAt.getTime() : Date.now()) - receivedAt.getTime()) / 86_400_000));

async function logEvent(
  tx: Tx,
  w: Who,
  e: { intakeId: string; itemId?: string | null; eventType: string; title: string; description?: string | null; oldValue?: string | null; newValue?: string | null },
) {
  await tx.serviceIntakeEvent.create({
    data: {
      intakeId: e.intakeId,
      itemId: e.itemId ?? null,
      eventType: e.eventType,
      title: e.title,
      description: e.description ?? null,
      oldValue: e.oldValue ?? null,
      newValue: e.newValue ?? null,
      performedById: w.id,
      performedByName: w.name,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Options (site / problem tags)                                       */
/* ------------------------------------------------------------------ */

type Kind = 'SITE' | 'PROBLEM';
const DEFAULTS: Record<Kind, string[]> = { SITE: DEFAULT_SITES, PROBLEM: DEFAULT_PROBLEMS };

function optionList(kind: Kind): string[] {
  return [...DEFAULTS[kind]];
}

/** Canonicalise against the configured defaults without requiring a Prisma option table. */
function canonicalize(kind: Kind, values: string[]): string[] {
  const known = optionList(kind);
  const byLower = new Map(known.map((k) => [k.toLowerCase(), k]));
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim().slice(0, kind === 'SITE' ? LIMITS.site : LIMITS.label);
    if (!v) continue;
    const canon = byLower.get(v.toLowerCase()) ?? v;
    if (!out.some((x) => x.toLowerCase() === canon.toLowerCase())) out.push(canon);
  }
  return out;
}

function cleanProblems(input: unknown): string[] {
  const arr = Array.isArray(input)
    ? input.filter((x): x is string => typeof x === 'string')
    : typeof input === 'string'
      ? input.split(',')
      : [];
  const trimmed = Array.from(new Set(arr.map((p) => p.trim()).filter(Boolean))).slice(0, LIMITS.maxProblems);
  if (trimmed.length === 0) return [UNKNOWN_PROBLEM];
  const withoutUnknown = trimmed.filter((p) => p.toLowerCase() !== UNKNOWN_PROBLEM.toLowerCase());
  return withoutUnknown.length > 0 ? withoutUnknown : [UNKNOWN_PROBLEM];
}

/**
 * ServiceIntake.problems is a Prisma String[] column.
 * Keep these helpers tolerant of old string/JSON-string rows so the API
 * remains safe if legacy data is encountered, but always write a real
 * string array to Prisma.
 */
function encodeProblems(problems: string[]): string[] {
  return problems;
}

function decodeProblems(value: string[] | string | null | undefined): string[] {
  if (!value) return [UNKNOWN_PROBLEM];
  if (Array.isArray(value)) return cleanProblems(value);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return cleanProblems(parsed);
  } catch {
    // Legacy rows may contain comma-separated text.
  }
  return cleanProblems(value);
}

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */

const terminalFields = (status: ServiceStatus, w: Who) =>
  TERMINAL_STATUSES.includes(status)
    ? { closedAt: new Date(), closedById: w.id }
    : { closedAt: null, closedById: null };

/**
 * The current Prisma schema stores status on ServiceIntake, not on
 * ServiceIntakeItem. Keep the item API compatible by exposing the intake
 * status to the client, while persisting the real stage on the intake.
 */
function withItemStatus<T extends { items?: any[] }>(value: T): T {
  const status = (value as any).status;
  if (!Array.isArray(value.items)) return value;
  return {
    ...value,
    items: value.items.map((item: any) => ({ ...item, status })),
  };
}

async function requireFreshStagePhoto(
  tx: Tx,
  intakeId: string,
  itemId?: string,
): Promise<void> {
  const latestStageEvent = await tx.serviceIntakeEvent.findFirst({
    where: {
      intakeId,
      eventType: 'STATUS_CHANGED',
      ...(itemId ? { itemId } : { itemId: null }),
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  const intake = await tx.serviceIntake.findUnique({
    where: { id: intakeId },
    select: { receivedAt: true },
  });
  if (!intake) throw new HttpError(404, 'Service intake not found.');

  const since = latestStageEvent?.createdAt ?? intake.receivedAt;
  const photo = await tx.serviceIntakeImage.findFirst({
    where: {
      intakeId,
      ...(itemId ? { itemId } : { itemId: null }),
      createdAt: { gt: since },
    },
    select: { id: true },
  });

  if (!photo) {
    throw new HttpError(
      400,
      itemId
        ? 'Upload a new photo for this unit before changing its service stage.'
        : 'Upload a new photo before changing the service stage.',
    );
  }
}

/* ------------------------------------------------------------------ */
/* Intake number                                                       */
/* ------------------------------------------------------------------ */

async function nextIntakeNumber(tx: Tx): Promise<string> {
  const last = await tx.serviceIntake.findFirst({ orderBy: { intakeNumber: 'desc' }, select: { intakeNumber: true } });
  const n = last ? parseInt(last.intakeNumber.replace(/\D/g, ''), 10) || 0 : 0;
  return `SI-${String(n + 1).padStart(6, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Unit input                                                          */
/* ------------------------------------------------------------------ */

type UnitInput = { itemType?: string; productId?: string | null; serialNumber?: string; notes?: string };

async function buildItemData(tx: Tx, u: UnitInput) {
  const itemType = u.itemType && ITEM_TYPE_LABELS[u.itemType] ? u.itemType : null;
  if (!itemType) throw new HttpError(400, 'Unit type must be Indoor Unit or Outdoor Unit.');
  let productId: string | null = null;
  let productModel: string | null = null;
  if (u.productId) {
    const p = await tx.product.findUnique({ where: { id: u.productId }, select: { id: true, name: true, model: true } });
    if (!p) throw new HttpError(400, 'Selected model was not found.');
    productId = p.id;
    productModel = p.model || p.name;
  }
  return {
    itemType,
    itemTypeLabel: ITEM_TYPE_LABELS[itemType],
    productId,
    productModel,
    serialNumber: str(u.serialNumber, LIMITS.serial),
    notes: str(u.notes, LIMITS.notes),
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function fail(res: Response, err: any, fallback: string, tag: string) {
  if (err instanceof HttpError) return void res.status(err.status).json({ success: false, message: err.message });
  console.error(`[${tag}]`, err);
  res.status(500).json({ success: false, message: fallback });
}

/* ------------------------------------------------------------------ */
/* Controller                                                          */
/* ------------------------------------------------------------------ */

export const serviceIntakeController = {
  /** GET /options — tag lists + static config used by the mobile UI. */
  getOptions: async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const sites = optionList('SITE');
      const problems = optionList('PROBLEM');
      res.json({
        success: true,
        data: {
          sites,
          problems,
          takingTo: TAKING_TO,
          statuses: STATUSES.map((key) => ({ key, label: STATUS_LABELS[key] })),
          unknownProblem: UNKNOWN_PROBLEM,
        },
      });
    } catch (err) {
      fail(res, err, 'Failed to load options.', 'SI options');
    }
  },

  /** GET / — server-side search + filters + pagination. */
  listIntakes: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, customerId, site, reportedById, takingTo, dateFrom, dateTo, search, archived } = req.query as Record<string, string | undefined>;
      const take = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);

      const and: Prisma.ServiceIntakeWhereInput[] = [{ archivedAt: archived === 'true' ? { not: null } : null }];
      if (status && isStatus(status)) and.push({ status });
      if (customerId) and.push({ customerId });
      if (site) and.push({ siteName: { equals: site, mode: 'insensitive' } });
      if (reportedById) and.push({ createdById: reportedById });
      if (takingTo && TAKING_TO_KEYS.includes(takingTo)) and.push({ takingTo });
      if (dateFrom) and.push({ receivedAt: { gte: new Date(dateFrom) } });
      if (dateTo) and.push({ receivedAt: { lte: new Date(dateTo) } });

      const q = search?.trim();
      if (q) {
        const c = { contains: q, mode: 'insensitive' as const };
        and.push({
          OR: [
            { intakeNumber: c },
            { siteName: c },
            { customerName: c }, // legacy rows only
            { customer: { is: { OR: [{ name: c }, { mobile: c }] } } },
            {
              items: {
                some: {
                  OR: [{ serialNumber: c }, { productModel: c }, { product: { is: { OR: [{ name: c }, { model: c }] } } }],
                },
              },
            },
          ],
        });
      }
      const where: Prisma.ServiceIntakeWhereInput = { AND: and };

      const [total, rows] = await Promise.all([
        prisma.serviceIntake.count({ where }),
        prisma.serviceIntake.findMany({
          where,
          orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
          take,
          skip: (page - 1) * take,
          select: {
            id: true,
            intakeNumber: true,
            status: true,
            siteName: true,
            problems: true,
            takingTo: true,
            receivedAt: true,
            closedAt: true,
            customerName: true, // legacy fallback
            customer: { select: { id: true, name: true, mobile: true } },
            createdBy: { select: { id: true, name: true } },
            items: { orderBy: { createdAt: 'asc' }, select: { id: true, itemType: true } },
            _count: { select: { images: true } },
          },
        }),
      ]);

      res.json({
        success: true,
        data: rows.map((r) => ({ ...r, problems: decodeProblems(r.problems), ageDays: ageDays(r.receivedAt, r.closedAt), items: r.items.map((item) => ({ ...item, status: r.status })) })),
        pagination: { total, page, limit: take, totalPages: Math.ceil(total / take) },
      });
    } catch (err) {
      fail(res, err, 'Failed to retrieve service intakes.', 'SI list');
    }
  },

  /** GET /:id */
  getIntake: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const intake = await prisma.serviceIntake.findUnique({
        where: { id: req.params.id },
        include: {
          customer: true,
          createdBy: { select: { id: true, name: true, employeeCode: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            include: {
              product: { select: { id: true, name: true, model: true } },
              responsibleEmployee: { select: { id: true, name: true, employeeCode: true } },
            },
          },
          images: { orderBy: { createdAt: 'asc' } }, // intake-level (itemId null) + unit images; client groups by itemId
          events: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!intake) return void res.status(404).json({ success: false, message: 'Service intake not found.' });
      res.json({ success: true, data: withItemStatus({ ...intake, problems: decodeProblems(intake.problems), ageDays: ageDays(intake.receivedAt, intake.closedAt) }) });
    } catch (err) {
      fail(res, err, 'Failed to retrieve service intake.', 'SI get');
    }
  },

  /** POST / — reporting person is ALWAYS the authenticated user. */
  createIntake: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });

      const { customerId, siteName, problems, takingTo, notes, items } = req.body ?? {};
      if (!customerId || typeof customerId !== 'string') throw new HttpError(400, 'Please select a customer.');
      if (!TAKING_TO_KEYS.includes(takingTo)) throw new HttpError(400, 'Please choose where the unit is being taken.');
      const units: UnitInput[] = Array.isArray(items) ? items : [];
      if (units.length > 20) throw new HttpError(400, 'Too many units in one intake.');

      const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } });
      if (!customer) throw new HttpError(400, 'Selected customer was not found.');

      let created: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          created = await prisma.$transaction(async (tx) => {
            const [site] = siteName ? canonicalize('SITE', [String(siteName)]) : [null];
            const probs = canonicalize('PROBLEM', cleanProblems(problems));
            const intakeNumber = await nextIntakeNumber(tx);

            const intake = await tx.serviceIntake.create({
              data: {
                intakeNumber,
                customerId,
                customerName: customer.name || 'Unnamed Customer',
                siteName: site ?? null,
                problems: encodeProblems(probs),
                takingTo,
                notes: str(notes, LIMITS.notes),
                status: 'NOT_STARTED',
                createdById: w.id, // reporting person
              },
            });
            await logEvent(tx, w, {
              intakeId: intake.id,
              eventType: 'INTAKE_CREATED',
              title: 'Service Intake Created',
              description: `Reported by ${w.name}. Taking to ${takingToLabel(takingTo)}.`,
            });

            const base = Date.now();
            const createdItems = [];
            for (let i = 0; i < units.length; i++) {
              const data = await buildItemData(tx, units[i]);
              // explicit createdAt keeps unit order stable (now() is identical within one transaction)
              const item = await tx.serviceIntakeItem.create({
                data: { ...data, intakeId: intake.id, createdAt: new Date(base + i) },
              });
              createdItems.push(item);
              await logEvent(tx, w, {
                intakeId: intake.id,
                itemId: item.id,
                eventType: 'ITEM_ADDED',
                title: `Unit Added: ${data.itemTypeLabel}`,
                description: [data.productModel, data.serialNumber && `S/N ${data.serialNumber}`].filter(Boolean).join(' · ') || null,
              });
            }
            return { ...intake, items: createdItems }; // items in creation order — mobile maps photos by index
          });
          break;
        } catch (e: any) {
          if (e?.code === 'P2002' && attempt < 2) continue; // intakeNumber race — retry
          throw e;
        }
      }

      res.status(201).json({ success: true, message: `Service Intake ${created.intakeNumber} created.`, data: created });
    } catch (err) {
      fail(res, err, 'Failed to create service intake.', 'SI create');
    }
  },

  /** PATCH /:id — site, problems, takingTo, notes, customer (privileged). */
  updateIntake: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id } = req.params;
      const body = req.body ?? {};

      const existing = await prisma.serviceIntake.findUnique({ where: { id }, include: { customer: { select: { name: true } } } });
      if (!existing) throw new HttpError(404, 'Service intake not found.');

      const updated = await prisma.$transaction(async (tx) => {
        const data: Prisma.ServiceIntakeUpdateInput = {};

        if (body.siteName !== undefined) {
          const [site] = body.siteName ? canonicalize('SITE', [String(body.siteName)]) : [null];
          if ((site ?? null) !== existing.siteName) {
            data.siteName = site ?? null;
            await logEvent(tx, w, { intakeId: id, eventType: 'SITE_CHANGED', title: 'Site Changed', oldValue: existing.siteName, newValue: site ?? null, description: `${existing.siteName ?? 'None'} → ${site ?? 'None'}` });
          }
        }
        if (body.problems !== undefined) {
          const probs = canonicalize('PROBLEM', cleanProblems(body.problems));
          if (probs.join('|') !== decodeProblems(existing.problems).join('|')) {
            data.problems = encodeProblems(probs);
            await logEvent(tx, w, { intakeId: id, eventType: 'PROBLEMS_CHANGED', title: 'Problems Changed', oldValue: decodeProblems(existing.problems).join(', '), newValue: probs.join(', '), description: `${decodeProblems(existing.problems).join(', ') || 'None'} → ${probs.join(', ')}` });
          }
        }
        if (body.takingTo !== undefined) {
          if (!TAKING_TO_KEYS.includes(body.takingTo)) throw new HttpError(400, 'Invalid destination.');
          if (body.takingTo !== existing.takingTo) {
            data.takingTo = body.takingTo;
            await logEvent(tx, w, { intakeId: id, eventType: 'TAKING_TO_CHANGED', title: 'Taking To Changed', oldValue: existing.takingTo, newValue: body.takingTo, description: `${takingToLabel(existing.takingTo) ?? 'None'} → ${takingToLabel(body.takingTo)}` });
          }
        }
        if (body.notes !== undefined) {
          const notes = str(body.notes, LIMITS.notes);
          if (notes !== (existing.notes ?? null)) {
            data.notes = notes;
            await logEvent(tx, w, { intakeId: id, eventType: 'NOTES_CHANGED', title: 'Notes Changed' });
          }
        }
        if (body.customerId !== undefined && body.customerId !== existing.customerId) {
          if (!isPrivileged(w)) throw new HttpError(403, 'You are not allowed to change the customer.');
          const c = await tx.customer.findUnique({ where: { id: String(body.customerId) }, select: { id: true, name: true } });
          if (!c) throw new HttpError(400, 'Selected customer was not found.');
          data.customer = { connect: { id: c.id } };
          await logEvent(tx, w, { intakeId: id, eventType: 'CUSTOMER_CHANGED', title: 'Customer Changed', description: `${existing.customer?.name ?? existing.customerName ?? 'None'} → ${c.name ?? 'Unnamed'}` });
        }

        return Object.keys(data).length ? tx.serviceIntake.update({ where: { id }, data }) : existing;
      });

      res.json({ success: true, message: 'Service intake updated.', data: updated });
    } catch (err) {
      fail(res, err, 'Failed to update service intake.', 'SI update');
    }
  },

  /** POST /:id/status — stage change requires a fresh intake-level photo. */
  changeIntakeStatus: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id } = req.params;
      const { status, note } = req.body ?? {};
      if (!isStatus(status)) throw new HttpError(400, 'Invalid status.');

      const existing = await prisma.serviceIntake.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) throw new HttpError(404, 'Service intake not found.');

      if (existing.status === status) {
        return void res.json({ success: true, message: `Status is already ${label(status)}.` });
      }

      await prisma.$transaction(async (tx) => {
        await requireFreshStagePhoto(tx, id);
        await tx.serviceIntake.update({
          where: { id },
          data: { status, ...terminalFields(status, w) },
        });
        await logEvent(tx, w, {
          intakeId: id,
          eventType: 'STATUS_CHANGED',
          title: `Status: ${label(existing.status)} → ${label(status)}`,
          description: str(note, LIMITS.notes),
          oldValue: existing.status,
          newValue: status,
        });
      });

      res.json({ success: true, message: `Status set to ${label(status)}.` });
    } catch (err) {
      fail(res, err, 'Failed to change status.', 'SI status');
    }
  },

  /** POST /:id/items */
  addItem: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id } = req.params;
      if (!(await prisma.serviceIntake.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, 'Service intake not found.');

      const item = await prisma.$transaction(async (tx) => {
        const data = await buildItemData(tx, req.body ?? {});
        const created = await tx.serviceIntakeItem.create({ data: { ...data, intakeId: id } });
        await logEvent(tx, w, {
          intakeId: id,
          itemId: created.id,
          eventType: 'ITEM_ADDED',
          title: `Unit Added: ${data.itemTypeLabel}`,
          description: [data.productModel, data.serialNumber && `S/N ${data.serialNumber}`].filter(Boolean).join(' · ') || null,
        });
        return created;
      });
      res.status(201).json({ success: true, message: 'Unit added.', data: item });
    } catch (err) {
      fail(res, err, 'Failed to add unit.', 'SI addItem');
    }
  },

  /** PATCH /:id/items/:itemId — model, serial, notes. */
  updateItem: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id, itemId } = req.params;
      const { productId, serialNumber, notes } = req.body ?? {};

      const item = await prisma.serviceIntakeItem.findFirst({ where: { id: itemId, intakeId: id } });
      if (!item) throw new HttpError(404, 'Unit not found in this intake.');

      const updated = await prisma.$transaction(async (tx) => {
        const data: Prisma.ServiceIntakeItemUpdateInput = {};
        const name = item.itemTypeLabel || ITEM_TYPE_LABELS[item.itemType] || 'Unit';

        if (productId !== undefined && (productId || null) !== item.productId) {
          if (productId) {
            const p = await tx.product.findUnique({ where: { id: String(productId) }, select: { id: true, name: true, model: true } });
            if (!p) throw new HttpError(400, 'Selected model was not found.');
            const model = p.model || p.name;
            data.product = { connect: { id: p.id } };
            data.productModel = model;
            await logEvent(tx, w, { intakeId: id, itemId, eventType: 'PRODUCT_CHANGED', title: `${name}: Model Changed`, oldValue: item.productModel, newValue: model, description: `${item.productModel ?? 'None'} → ${model}` });
          } else {
            data.product = { disconnect: true };
            data.productModel = null;
            await logEvent(tx, w, { intakeId: id, itemId, eventType: 'PRODUCT_CHANGED', title: `${name}: Model Cleared`, oldValue: item.productModel });
          }
        }
        if (serialNumber !== undefined) {
          const s = str(serialNumber, LIMITS.serial);
          if (s !== (item.serialNumber ?? null)) {
            data.serialNumber = s;
            await logEvent(tx, w, { intakeId: id, itemId, eventType: 'SERIAL_CHANGED', title: `${name}: Serial Changed`, oldValue: item.serialNumber, newValue: s, description: `${item.serialNumber ?? 'None'} → ${s ?? 'None'}` });
          }
        }
        if (notes !== undefined) {
          const n = str(notes, LIMITS.notes);
          if (n !== (item.notes ?? null)) {
            data.notes = n;
            await logEvent(tx, w, { intakeId: id, itemId, eventType: 'ITEM_UPDATED', title: `${name}: Notes Changed` });
          }
        }
        return Object.keys(data).length ? tx.serviceIntakeItem.update({ where: { id: itemId }, data }) : item;
      });
      res.json({ success: true, message: 'Unit updated.', data: updated });
    } catch (err) {
      fail(res, err, 'Failed to update unit.', 'SI updateItem');
    }
  },

  /** POST /:id/items/:itemId/status — schema has no per-item status column. */
  changeItemStatus: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id, itemId } = req.params;
      const { status, note } = req.body ?? {};
      if (!isStatus(status)) throw new HttpError(400, 'Invalid status.');

      const [intake, item] = await Promise.all([
        prisma.serviceIntake.findUnique({ where: { id }, select: { status: true } }),
        prisma.serviceIntakeItem.findFirst({ where: { id: itemId, intakeId: id }, select: { id: true, itemTypeLabel: true } }),
      ]);
      if (!intake) throw new HttpError(404, 'Service intake not found.');
      if (!item) throw new HttpError(404, 'Unit not found in this intake.');

      if (intake.status === status) {
        return void res.json({ success: true, message: `Status is already ${label(status)}.` });
      }

      await prisma.$transaction(async (tx) => {
        await requireFreshStagePhoto(tx, id, itemId);
        await tx.serviceIntake.update({
          where: { id },
          data: { status, ...terminalFields(status, w) },
        });
        await logEvent(tx, w, {
          intakeId: id,
          itemId,
          eventType: 'STATUS_CHANGED',
          title: `${item.itemTypeLabel || 'Unit'}: ${label(intake.status)} → ${label(status)}`,
          description: str(note, LIMITS.notes),
          oldValue: intake.status,
          newValue: status,
        });
      });

      res.json({ success: true, message: `Unit stage set to ${label(status)}.` });
    } catch (err) {
      fail(res, err, 'Failed to change unit status.', 'SI itemStatus');
    }
  },

  /** POST /:id/items/:itemId/responsible — separate from the reporting person. */
  changeItemResponsible: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id, itemId } = req.params;
      const { employeeId } = req.body ?? {};

      const [item, emp] = await Promise.all([
        prisma.serviceIntakeItem.findFirst({ where: { id: itemId, intakeId: id } }),
        employeeId ? prisma.user.findUnique({ where: { id: String(employeeId) }, select: { id: true, name: true, isActive: true } }) : null,
      ]);
      if (!item) throw new HttpError(404, 'Unit not found in this intake.');
      if (!emp || !emp.isActive) throw new HttpError(400, 'Employee not found.');

      await prisma.$transaction(async (tx) => {
        await tx.serviceIntakeItem.update({ where: { id: itemId }, data: { responsibleEmployeeId: emp.id, responsibleEmployeeName: emp.name } });
        await logEvent(tx, w, {
          intakeId: id,
          itemId,
          eventType: 'RESPONSIBLE_CHANGED',
          title: `${item.itemTypeLabel || 'Unit'}: Responsible Changed`,
          oldValue: item.responsibleEmployeeName,
          newValue: emp.name,
          description: `${item.responsibleEmployeeName ?? 'Unassigned'} → ${emp.name}`,
        });
      });
      res.json({ success: true, message: `Assigned to ${emp.name}.` });
    } catch (err) {
      fail(res, err, 'Failed to assign employee.', 'SI responsible');
    }
  },

  /** POST /:id/notes — timeline note (optionally for one unit via body.itemId). */
  addNote: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id } = req.params;
      const note = str(req.body?.note, LIMITS.notes);
      if (!note) throw new HttpError(400, 'Note text is required.');
      const itemId = req.body?.itemId ? String(req.body.itemId) : null;
      if (!(await prisma.serviceIntake.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, 'Service intake not found.');
      if (itemId && !(await prisma.serviceIntakeItem.findFirst({ where: { id: itemId, intakeId: id }, select: { id: true } }))) throw new HttpError(404, 'Unit not found.');
      await prisma.$transaction((tx) => logEvent(tx, w, { intakeId: id, itemId, eventType: 'NOTE_ADDED', title: 'Note Added', description: note }));
      res.status(201).json({ success: true, message: 'Note added.' });
    } catch (err) {
      fail(res, err, 'Failed to add note.', 'SI note');
    }
  },

  /**
   * POST /:id/images and POST /:id/items/:itemId/images
   * Body is the raw image bytes (Content-Type image/*) — no base64, no multipart.
   * Route must use express.raw({ type: 'image/*', limit: '12mb' }).
   */
  uploadImage: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id, itemId } = req.params as { id: string; itemId?: string };
      const buf: Buffer = req.body;
      if (!Buffer.isBuffer(buf) || buf.length < 100) throw new HttpError(400, 'Image data is required.');
      if (buf.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Image is too large.');

      const ext = buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        ? '.jpg'
        : buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
          ? '.png'
          : buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP'
            ? '.webp'
            : null;
      if (!ext) throw new HttpError(400, 'Only JPEG, PNG or WebP images are supported.');

      const intake = await prisma.serviceIntake.findUnique({ where: { id }, select: { id: true } });
      if (!intake) throw new HttpError(404, 'Service intake not found.');
      let unitLabel = 'intake';
      if (itemId) {
        const item = await prisma.serviceIntakeItem.findFirst({ where: { id: itemId, intakeId: id }, select: { itemTypeLabel: true } });
        if (!item) throw new HttpError(404, 'Unit not found in this intake.');
        unitLabel = item.itemTypeLabel || 'unit';
      }

      fs.mkdirSync(SERVICE_INTAKE_DIR, { recursive: true });
      const storageFileName = `si_${id}_${randomUUID()}${ext}`;
      await fs.promises.writeFile(path.join(SERVICE_INTAKE_DIR, storageFileName), buf);

      try {
        const image = await prisma.$transaction(async (tx) => {
          const img = await tx.serviceIntakeImage.create({
            data: {
              intakeId: id,
              itemId: itemId ?? null,
              imageUrl: `/api/service-intakes/images/${storageFileName}`,
              storageFileName,
              fileSize: buf.length,
              uploadedById: w.id,
            },
          });
          await logEvent(tx, w, { intakeId: id, itemId: itemId ?? null, eventType: 'IMAGE_ADDED', title: 'Photo Added', description: `Photo added to ${unitLabel}.` });
          return img;
        });
        res.status(201).json({ success: true, data: image });
      } catch (dbErr) {
        await fs.promises.unlink(path.join(SERVICE_INTAKE_DIR, storageFileName)).catch(() => undefined);
        throw dbErr;
      }
    } catch (err) {
      fail(res, err, 'Failed to upload image.', 'SI upload');
    }
  },

  /** DELETE /:id/images/:imageId — uploader or privileged role. */
  deleteImage: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      const { id, imageId } = req.params;
      const img = await prisma.serviceIntakeImage.findFirst({ where: { id: imageId, intakeId: id } });
      if (!img) throw new HttpError(404, 'Image not found.');
      if (img.uploadedById !== w.id && !isPrivileged(w)) throw new HttpError(403, 'You can only remove photos you added.');

      await prisma.$transaction(async (tx) => {
        await tx.serviceIntakeImage.delete({ where: { id: imageId } });
        await logEvent(tx, w, { intakeId: id, itemId: img.itemId, eventType: 'IMAGE_REMOVED', title: 'Photo Removed' });
      });
      await fs.promises.unlink(path.join(SERVICE_INTAKE_DIR, path.basename(img.storageFileName))).catch(() => undefined);
      res.json({ success: true, message: 'Photo removed.' });
    } catch (err) {
      fail(res, err, 'Failed to remove image.', 'SI deleteImage');
    }
  },

  /** POST /:id/archive — soft delete (privileged). */
  archiveIntake: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const w = who(req);
      if (!w) return void res.status(401).json({ success: false, message: 'Authentication required.' });
      if (!isPrivileged(w)) throw new HttpError(403, 'You are not allowed to archive service intakes.');
      const { id } = req.params;
      if (!(await prisma.serviceIntake.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, 'Service intake not found.');
      await prisma.$transaction(async (tx) => {
        await tx.serviceIntake.update({ where: { id }, data: { archivedAt: new Date() } });
        await logEvent(tx, w, { intakeId: id, eventType: 'ARCHIVED', title: 'Service Intake Archived' });
      });
      res.json({ success: true, message: 'Service intake archived.' });
    } catch (err) {
      fail(res, err, 'Failed to archive service intake.', 'SI archive');
    }
  },

  /** GET /images/:filename — unchanged behaviour from the previous module. */
  serveImage: async (req: any, res: Response) => {
    try {
      const safe = path.basename(req.params.filename);
      const filePath = path.join(SERVICE_INTAKE_DIR, safe);
      if (!fs.existsSync(filePath)) return void res.status(404).json({ success: false, message: 'Image file not found.' });
      const ext = path.extname(safe).toLowerCase();
      res.setHeader('Content-Type', ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      fail(res, err, 'Failed to serve image.', 'SI serve');
    }
  },
};
