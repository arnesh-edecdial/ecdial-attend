import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'IT_ADMIN', 'MANAGER', 'SERVICE_MANAGER'] as const;

export const stockRequirementController = {
  /**
   * 1. Create Stock Requirement (Sales / Admin)
   */
  create: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const salesUserId = req.user?.id;
      const { customerId, productId, quantity, priority = 'NORMAL', note } = req.body;

      if (!salesUserId) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      if (!customerId || !productId) {
        res.status(400).json({ success: false, message: 'Customer and Machine/Product are required.' });
        return;
      }

      const parsedQty = parseInt(quantity, 10);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        res.status(400).json({ success: false, message: 'A valid quantity greater than zero is required.' });
        return;
      }

      // Verify customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        res.status(404).json({ success: false, message: 'Selected customer not found.' });
        return;
      }

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        res.status(404).json({ success: false, message: 'Selected product/machine not found.' });
        return;
      }

      const safePriority = ['NORMAL', 'URGENT', 'EMERGENCY'].includes(priority?.toUpperCase())
        ? priority.toUpperCase()
        : 'NORMAL';

      const requirement = await prisma.stockRequirement.create({
        data: {
          salesUserId,
          customerId,
          productId,
          quantity: parsedQty,
          priority: safePriority,
          status: 'PENDING',
          note: note ? note.trim() : null,
          requestedAt: new Date(),
        },
        include: {
          customer: true,
          product: true,
          salesUser: {
            select: { id: true, name: true, employeeCode: true, email: true },
          },
        },
      });

      // Notify Admins
      notificationService.notifyAdminsOfStockRequirement({
        requirementId: requirement.id,
        salesPersonName: req.user?.name || 'Sales Representative',
        customerName: customer.name || 'Customer',
        productName: product.name,
        quantity: parsedQty,
        salesUserId,
      }).catch((notifErr) => console.warn('[Stock Req Notif Error]', notifErr));

      res.status(201).json({
        success: true,
        message: 'Stock requirement created successfully.',
        data: requirement,
      });
    } catch (err: any) {
      console.error('[Create Stock Requirement Error]', err);
      res.status(500).json({ success: false, message: 'Failed to create stock requirement.' });
    }
  },

  /**
   * 2. Get My Stock Requests (Current Sales User)
   */
  getMyRequests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const salesUserId = req.user?.id;
      if (!salesUserId) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const requirements = await prisma.stockRequirement.findMany({
        where: { salesUserId },
        include: {
          customer: true,
          product: true,
          salesUser: {
            select: { id: true, name: true, employeeCode: true },
          },
        },
        orderBy: { requestedAt: 'desc' },
      });

      res.json({
        success: true,
        data: requirements,
      });
    } catch (err: any) {
      console.error('[Get My Stock Requests Error]', err);
      res.status(500).json({ success: false, message: 'Failed to fetch your stock requests.' });
    }
  },

  /**
   * 3. Get All Stock Requirements (Admin & Management)
   */
  listAll: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { status, priority, search } = req.query;

      const where: Prisma.StockRequirementWhereInput = {};
      if (status && typeof status === 'string' && status !== 'ALL') {
        where.status = status;
      }
      if (priority && typeof priority === 'string' && priority !== 'ALL') {
        where.priority = priority;
      }
      if (search && typeof search === 'string' && search.trim().length > 0) {
        const q = search.trim();
        where.OR = [
          { customer: { name: { contains: q, mode: 'insensitive' } } },
          { product: { name: { contains: q, mode: 'insensitive' } } },
          { product: { model: { contains: q, mode: 'insensitive' } } },
          { salesUser: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }

      const requirements = await prisma.stockRequirement.findMany({
        where,
        include: {
          customer: true,
          product: true,
          salesUser: {
            select: { id: true, name: true, employeeCode: true },
          },
        },
        orderBy: [
          // Order by status priority first: PENDING first, then by requestedAt desc
          { requestedAt: 'desc' },
        ],
      });

      res.json({
        success: true,
        data: requirements,
      });
    } catch (err: any) {
      console.error('[List Stock Requirements Error]', err);
      res.status(500).json({ success: false, message: 'Failed to list stock requirements.' });
    }
  },

  /**
   * 4. Get Single Stock Requirement
   */
  getById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const requirement = await prisma.stockRequirement.findUnique({
        where: { id },
        include: {
          customer: true,
          product: true,
          salesUser: {
            select: { id: true, name: true, employeeCode: true, email: true, phone: true },
          },
        },
      });

      if (!requirement) {
        res.status(404).json({ success: false, message: 'Stock requirement not found.' });
        return;
      }

      // Check permission: Owner or Admin
      const isOwner = Boolean(req.user?.id && requirement.salesUserId === req.user.id);
      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));

      if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, message: 'You do not have permission to view this requirement.' });
        return;
      }

      res.json({
        success: true,
        data: requirement,
      });
    } catch (err: any) {
      console.error('[Get Stock Requirement Error]', err);
      res.status(500).json({ success: false, message: 'Failed to fetch stock requirement.' });
    }
  },

  /**
   * 5. Update Stock Requirement (Quantity, Priority, Note)
   */
  update: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { quantity, priority, note } = req.body;

      const requirement = await prisma.stockRequirement.findUnique({
        where: { id },
      });

      if (!requirement) {
        res.status(404).json({ success: false, message: 'Stock requirement not found.' });
        return;
      }

      const isOwner = Boolean(req.user?.id && requirement.salesUserId === req.user.id);
      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));

      if (!isOwner && !isAdmin) {
        res.status(403).json({ success: false, message: 'Unauthorized to edit this requirement.' });
        return;
      }

      // If sales user, they can only edit if still PENDING
      if (isOwner && !isAdmin && requirement.status !== 'PENDING') {
        res.status(400).json({
          success: false,
          message: 'Cannot edit requirement after it has been processed by Admin.',
        });
        return;
      }

      const dataToUpdate: any = {};
      if (quantity !== undefined) {
        const parsed = parseInt(quantity, 10);
        if (isNaN(parsed) || parsed <= 0) {
          res.status(400).json({ success: false, message: 'Quantity must be greater than zero.' });
          return;
        }
        dataToUpdate.quantity = parsed;
      }

      if (priority && ['NORMAL', 'URGENT', 'EMERGENCY'].includes(priority.toUpperCase())) {
        dataToUpdate.priority = priority.toUpperCase();
      }

      if (note !== undefined) {
        dataToUpdate.note = note ? note.trim() : null;
      }

      const updated = await prisma.stockRequirement.update({
        where: { id },
        data: dataToUpdate,
        include: {
          customer: true,
          product: true,
          salesUser: {
            select: { id: true, name: true, employeeCode: true },
          },
        },
      });

      res.json({
        success: true,
        message: 'Stock requirement updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      console.error('[Update Stock Requirement Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update stock requirement.' });
    }
  },

  /**
   * 6. Change Status (Admin Only: PENDING -> ORDERED -> RECEIVED -> COMPLETED)
   */
  changeStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));
      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'Only Admin or Managers can update requirement status.' });
        return;
      }

      const validStatuses = ['PENDING', 'ORDERED', 'RECEIVED', 'COMPLETED'];
      const upperStatus = status?.toUpperCase();
      if (!validStatuses.includes(upperStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
        return;
      }

      const requirement = await prisma.stockRequirement.findUnique({
        where: { id },
        include: { product: true },
      });

      if (!requirement) {
        res.status(404).json({ success: false, message: 'Stock requirement not found.' });
        return;
      }

      const updated = await prisma.stockRequirement.update({
        where: { id },
        data: { status: upperStatus },
        include: {
          customer: true,
          product: true,
          salesUser: {
            select: { id: true, name: true, employeeCode: true },
          },
        },
      });

      // Notify Sales User
      notificationService.notifySalesOfStockRequirementStatusChange({
        salesUserId: updated.salesUserId,
        requirementId: updated.id,
        productName: updated.product.name,
        quantity: updated.quantity,
        status: upperStatus,
      }).catch((notifErr) => console.warn('[Sales Status Notif Error]', notifErr));

      res.json({
        success: true,
        message: `Requirement status updated to ${upperStatus}.`,
        data: updated,
      });
    } catch (err: any) {
      console.error('[Change Status Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
  },

  /**
   * 7. Delete Stock Requirement (Staff deletes own request; Admin deletes any)
   */
  delete: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const requirement = await prisma.stockRequirement.findUnique({
        where: { id },
      });

      if (!requirement) {
        res.status(404).json({ success: false, message: 'Stock requirement not found.' });
        return;
      }

      const isOwner = requirement.salesUserId === userId;
      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this stock request.',
        });
        return;
      }

      // If staff deleting own request, only allow if not yet COMPLETED
      if (isOwner && !isAdmin && requirement.status === 'COMPLETED') {
        res.status(400).json({
          success: false,
          message: 'Completed stock requests cannot be deleted.',
        });
        return;
      }

      await prisma.stockRequirement.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Stock request deleted successfully.',
        data: { id },
      });
    } catch (err: any) {
      console.error('[Delete Stock Requirement Error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete stock requirement.' });
    }
  },
};
