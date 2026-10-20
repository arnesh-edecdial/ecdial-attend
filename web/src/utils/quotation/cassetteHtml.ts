/**
 * Cassette quotation -> paged A4 HTML (595 x 842 CSS px, 1 px = 1 pt).
 *
 * Same approach as quotationHtml.ts (Split): the layout is pure TypeScript with a height
 * estimator, so every page break is computed here and not by the browser. The header and
 * footer are the user's existing asset images (QUOTE_IMAGES[template].header / .footer).
 *
 * Page 1  : Equipment & Cost Schedule  (A High-side, B Low-side, Total Project Cost A+B)
 * Page 2  : Scope, Terms & Payment     (C Customer scope, D Requirements, E Terms, F Bank)
 * Longer tables / lists flow onto "contd." pages automatically.
 *
 * The preview renders the SAVED quotation (amounts and totals come from the backend response).
 */
import { QuoteAssets, QuoteLike, QuoteTemplate, BuildOptions, fmtINR } from './quotationHtml';

/* ------------------------------------------------------------------ */
/* Public types / defaults                                             */
/* ------------------------------------------------------------------ */
export interface CassetteQuoteLike extends QuoteLike {
  acType?: string;
  systemDesignation?: string | null;
  totalCapacity?: string | null;
  offerType?: string | null;
  scopeExclusions?: string | null;
  commissioningReqs?: string | null;
  termsAndConditions?: string | null;
  paymentMethod?: string | null;
  mainUnitTotal?: number | null;
  lowSideSupplyTotal?: number | null;
  lowSideInstallTotal?: number | null;
  lowSideTotal?: number | null;
}

/** Bank block (section F). The QR is cut out of the existing bank asset image. */
export const BANK_DETAILS = {
  accountName: 'ECDIAL',
  accountNumber: '59212062011123',
  bank: 'HDFC LTD.',
  branch: 'Tirupur Main Branch (Aristo International)',
  ifsc: 'HDFC0000445',
  upi: '8428118111@okbizaxis',
};

/** Where the QR sits inside each template's bank image (431 px wide asset). */
const QR_CROP: Record<QuoteTemplate, { x: number; y: number; w: number; h: number; W: number; H: number }> = {
  DAIKIN: { x: 163, y: 243, w: 112, h: 94, W: 431, H: 387 },
  ECDIAL: { x: 165, y: 226, w: 109, h: 95, W: 431, H: 366 },
};

/** Text used when no preset exists yet. One entry per line / bullet. */
export const CASSETTE_DEFAULTS = {
  scope: [
    'All masonry/civil works: outdoor-unit supports, cutting and making good walls/floor slabs, trenches and scaffolding.',
    'Main power supply to each outdoor unit (3-phase) with ELCB and near each indoor unit (single-phase).',
    'False-ceiling, boxing, wooden framework and carpentry work.',
    'MS angle support for indoor units, if necessary.',
    'Provision of necessary drain points.',
    'Any under-deck or false-ceiling insulation work.',
    'Protected storage space at site.',
    'Power for erection, testing and commissioning.',
    'Any dismantling work.',
    "Items not specifically mentioned in ECDIAL's scope of work are excluded.",
    'ODU and AHU lifting to terrace.',
  ].join('\n'),
  requirements: [
    'Earth voltage must be maintained at a minimum of 0–3 V.',
    'Commissioning power: outdoor units, 3-phase 420-440 V; indoor units, single-phase 220-240 V.',
    'Electrical works must comply with issued specifications/drawings and electrical safety standards.',
  ].join('\n'),
  terms: 'AC price and labour charges are exclusive of GST and subject to 18% GST.',
  payment: [
    '100% advance with purchase order for machines.',
    '70% advance of total low-side value along with purchase order.',
    '25% after completion of erection works.',
    '5% payment after raising the final bill.',
    'Final bill based on actual quantities used at site after measurement.',
  ].join('\n'),
};

/** Duct reuses the Cassette wording (scope, requirements, terms, payment). */
export const DUCT_DEFAULTS = CASSETTE_DEFAULTS;

/**
 * Duct low-side lines can be grouped (1. Refrigerant piping -> 1.1, 1.2 ...). The group is kept at the
 * start of the item description as "[Group: Refrigerant piping]", the same trick as [Default] / [Order: n],
 * so no schema change is needed.
 */
const GROUP_TAG = /^\s*\[Group:\s*([^\]]*)\]\s*/i;
export const parseGroup = (desc?: string | null): { group: string; text: string } => {
  const d = String(desc || '');
  const m = GROUP_TAG.exec(d);
  return { group: m ? m[1].trim() : '', text: d.replace(GROUP_TAG, '') };
};
export const withGroup = (text: string, group?: string | null): string => {
  const g = String(group || '').trim().replace(/[\]\[]/g, '');
  return g ? `[Group: ${g}] ${text}` : text;
};

/**
 * Main-unit line kinds (VRV): a [Heading] line has no price (e.g. "Daikin VRV Alpha indoor unit ..."),
 * [Sub] lines sit under it and are lettered a, b, c. Stored at the start of the description, like [Group: ...].
 */
const KIND_TAG = /^\s*\[(Heading|Sub)\]\s*/i;
export type LineKind = 'NORMAL' | 'HEADING' | 'SUB';
export const parseKind = (desc?: string | null): { kind: LineKind; text: string } => {
  const d = String(desc || '');
  const m = KIND_TAG.exec(d);
  return { kind: m ? (m[1].toUpperCase() as LineKind) : 'NORMAL', text: d.replace(KIND_TAG, '') };
};
export const withKind = (text: string, kind?: LineKind | null): string =>
  kind === 'HEADING' ? `[Heading] ${text}` : kind === 'SUB' ? `[Sub] ${text}` : text;

/** Text block -> clean lines (drops blank lines and any "1." / "01)" / "-" / "•" prefix). */
export const splitLines = (text?: string | null): string[] =>
  String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d{1,2}[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ */
/* Geometry (px). The estimator and the CSS use the same numbers.      */
/* ------------------------------------------------------------------ */
const PAGE_W = 595;
const PAGE_H = 840; // 2px under A4 so rounding never creates a blank page
const MX = 20;
const CONTENT_W = PAGE_W - MX * 2; // 555

const HEAD_H: Record<QuoteTemplate, number> = { ECDIAL: 126, DAIKIN: 133 };
const FOOT_H = 51;
const TITLE_H = 44;
const INFO_H = 58; // Prepared for + Quotation description + Offer type
const infoH = (_grouped?: boolean) => INFO_H;
const CONT_BAR_H = 26; // slim bar that replaces the big header on every page after the first

const SEC_H = 24;
const SEC_GAP = 4;
const SEC_SPACE = 6;
const THEAD_H = 20;
const ROW_BASE = 9; // 4 + 4 padding + 1 border
const LINE_H = 11;
const TOT_A_H = 24;
const LOW_BAR_H = 26;
const PROJ_H = 36;
const BANK_H = 96;
const SAFETY = 8;

const FONT_PX = 9;
const DUCT_LOW_W = 245; // Duct low-side description column (single rate + amount, indented under its group)
const DESC_W = 261; // narrowest description column (table B: 555 - 282 = 273) minus cell padding
const SCOPE_W = CONTENT_W - 2 - 34 - 10; // pill column + right padding
const REQ_W = CONTENT_W - 2 - 20 - 20 - 16; // box padding, number column
const TERM_W = CONTENT_W - 2 - 110 - 20 - 12; // label column, padding, bullet indent

/* ------------------------------------------------------------------ */
/* Themes (the Daikin one is sampled from the approved reference)      */
/* ------------------------------------------------------------------ */
const THEMES = {
  DAIKIN: {
    head: '#0B3F7A', accent: '#0B6BC4', badge: '#0B6BC4', light: '#E4F0FB', soft: '#F3F8FE',
    border: '#CFDDEE', ink: '#10284A', muted: '#5B6B80', bar: '#0B4A86', big: '#1596E8', group: '#E4F0FB',
  },
  ECDIAL: {
    head: '#14204F', accent: '#F47A20', badge: '#1B2160', light: '#EEF0FC', soft: '#F8F9FE',
    border: '#DDE1F0', ink: '#1B1F3B', muted: '#5B6078', bar: '#14204F', big: '#F47A20', group: '#FCEBDD',
  },
} as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const esc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmtDate = (d?: string) => {
  const [y, m, day] = String(d || '').split('-');
  return y && m && day ? `${day}-${m}-${y}` : String(d || '');
};

const addDays = (d: string, days: number) => {
  const [y, m, day] = String(d || '').split('-').map(Number);
  if (!y || !m || !day) return d;
  const dt = new Date(y, m - 1, day);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const num = (v: any): number => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const has = (v: any): boolean => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const money = (v: any) => fmtINR(v);
const moneyOrDash = (v: any) => (num(v) > 0 ? fmtINR(v) : '—');

/** Estimated rendered width of a string in px (conservative: slightly wide). */
const textW = (s: string) => {
  let w = 0;
  for (const ch of s) {
    if (ch === ' ') w += 0.28;
    else if (/[WMm@%]/.test(ch)) w += 0.88;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[0-9]/.test(ch)) w += 0.56;
    else if (/[ijlI.,;:'|!()]/.test(ch)) w += 0.3;
    else if (ch.charCodeAt(0) > 0x2fff) w += 1.0;
    else w += 0.52;
  }
  return w * FONT_PX * 1.04;
};

/** Number of wrapped lines for a text in a column `width` px wide (greedy word wrap, honours \n). */
const countLines = (text: string, width: number): number => {
  let lines = 0;
  for (const para of String(text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let cur = 0;
    let n = 1;
    for (const w of words) {
      const ww = textW(w);
      const add = cur === 0 ? ww : ww + textW(' ');
      if (cur + add > width && cur > 0) { n += 1; cur = ww; } else cur += add;
      while (cur > width) { n += 1; cur -= width; }
    }
    lines += n;
  }
  return Math.max(1, lines);
};

/* ------------------------------------------------------------------ */
/* Sections / pagination                                               */
/* ------------------------------------------------------------------ */
export interface Row { h: number; html: string }
export interface Sec {
  letter: string; title: string; sub: string; part: 1 | 2;
  wrap: 'tblA' | 'tblB' | 'plain' | 'box' | 'terms' | 'bank';
  thead: string; boxPad: number; rows: Row[];
}
export interface Chunk { sec: Sec; cont: boolean; rows: Row[] }
export type Kind = 'first' | 'cont';
export interface Page { kind: Kind; chunks: Chunk[]; used: number }

const topH = (k: Kind, t: QuoteTemplate, duct = false) =>
  k === 'first' ? HEAD_H[t] + 4 + TITLE_H + 6 + infoH(duct) + 8 : CONT_BAR_H + 8;

export function paginateCassette(secs: Sec[], template: QuoteTemplate, duct = false): Page[] {
  const budget = (p: Page) => PAGE_H - topH(p.kind, template, duct) - FOOT_H - 6 - SAFETY;
  const pages: Page[] = [{ kind: 'first', chunks: [], used: 0 }];
  const cur = () => pages[pages.length - 1];
  const newPage = (kind: Kind) => pages.push({ kind, chunks: [], used: 0 });
  let part2 = false;

  for (const s of secs) {
    // C-F start on their own page only when page 1 holds just the schedule (the reference 2-page look);
    // after a continued table they simply follow it, so nothing is left half-empty.
    if (s.part === 2 && !part2) {
      part2 = true;
      if (pages.length === 1 && cur().used > 0) newPage('cont');
    }
    const headH = SEC_H + SEC_GAP + (s.thead ? THEAD_H : 0) + s.boxPad;
    let i = 0;
    let cont = false;
    while (i < s.rows.length) {
      let page = cur();
      const gap = page.used > 0 ? SEC_SPACE : 0;
      if (page.used > 0 && page.used + gap + headH + s.rows[i].h > budget(page)) {
        // Bank details never travel alone: bring the terms block over with them
        const prev = page.chunks[page.chunks.length - 1];
        const carry = s.wrap === 'bank' && prev && prev.sec.wrap === 'terms' && !prev.cont && page.chunks.length > 1 ? prev : null;
        if (carry) {
          page.chunks.pop();
          page.used -= SEC_SPACE + SEC_H + SEC_GAP + carry.sec.boxPad + carry.rows.reduce((a, r) => a + r.h, 0);
        }
        newPage('cont');
        page = cur();
        if (carry) {
          page.chunks.push(carry);
          page.used += SEC_H + SEC_GAP + carry.sec.boxPad + carry.rows.reduce((a, r) => a + r.h, 0);
        }
      }
      const g = page.used > 0 ? SEC_SPACE : 0;
      const chunk: Chunk = { sec: s, cont, rows: [] };
      page.chunks.push(chunk);
      page.used += g + headH;
      const b = budget(page);
      do {
        chunk.rows.push(s.rows[i]);
        page.used += s.rows[i].h;
        i += 1;
      } while (i < s.rows.length && page.used + s.rows[i].h <= b);
      // never strand a single row (it carries the totals bars) alone on the next page
      if (i === s.rows.length - 1 && chunk.rows.length > 1) {
        const back = chunk.rows.pop() as Row;
        page.used -= back.h;
        i -= 1;
      }
      if (i < s.rows.length) { newPage('cont'); cont = true; }
    }
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */
const css = (T: (typeof THEMES)[QuoteTemplate], mode: 'screen' | 'print', template: QuoteTemplate, scale = 1, duct = false) => `
@page{size:${scale === 1 ? `${PAGE_W}px 842px` : '595pt 842pt'};margin:0}
${mode === 'print' && scale !== 1 ? `html{zoom:${scale}}` : ''}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${PAGE_W}px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:${T.ink};font-size:${FONT_PX}px;line-height:${LINE_H}px;${mode === 'screen' ? 'background:#E6E9F0;padding:8px 0' : 'background:#fff'}}
.page{width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;position:relative;display:flex;flex-direction:column;overflow:hidden;${mode === 'screen' ? 'margin:0 auto 10px;box-shadow:0 1px 6px rgba(15,23,42,.18)' : 'page-break-after:always;break-after:page'}}
${mode === 'print' ? '.page:last-child{page-break-after:auto;break-after:auto}' : ''}
.hdr{display:block;width:${PAGE_W}px;height:${HEAD_H[template]}px;object-fit:cover;object-position:bottom}
.ftr{display:block;width:${PAGE_W}px;height:auto;margin-top:6px}
.grow{flex:1 1 auto;min-height:0}
.ttl{position:relative;margin:4px ${MX}px 0;height:${TITLE_H}px}
.ttl .eb{padding-top:2px;font-size:7.5px;line-height:10px;font-weight:700;letter-spacing:.6px;color:${T.accent};text-transform:uppercase}
.ttl .h1{font-size:19px;line-height:24px;font-weight:800;color:${T.ink}}
.ttl .rule{position:absolute;left:0;right:0;bottom:0;height:1.5px;background:${T.border}}
.ttl .rule:before{content:"";position:absolute;left:0;top:-1px;width:46px;height:3px;background:${T.accent}}
.ttl .qm{position:absolute;right:0;top:1px;text-align:right;font-size:8px;line-height:10px;color:${T.muted}}
.ttl .qm b{color:${T.ink};font-weight:700}
.info{margin:6px ${MX}px 0;height:${infoH(duct)}px;border:1px solid ${T.border};background:${T.soft};border-radius:7px;display:flex}
.info>div{padding:7px 12px;min-width:0;overflow:hidden}
.info>div+div{border-left:1px solid ${T.border}}
.i1{flex:1.25}.i2{flex:1.35}.i3{flex:.8}
.info .l{font-size:7px;line-height:9px;font-weight:800;letter-spacing:.6px;color:${T.accent};text-transform:uppercase}
.info .v{font-size:12px;line-height:16px;font-weight:800;color:${T.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.info .s{font-size:8.5px;line-height:11px;color:${T.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.body{padding:0 ${MX}px;margin-top:8px}
.blk+.blk{margin-top:${SEC_SPACE}px}
.sec{height:${SEC_H}px;display:flex;align-items:center;gap:8px;margin-bottom:${SEC_GAP}px}
.sec .b{flex:0 0 22px;height:22px;border-radius:5px;background:${T.badge};color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
.sec .t{font-size:11px;line-height:12px;font-weight:800;color:${T.ink};text-transform:uppercase;letter-spacing:.2px}
.sec .t small{display:block;font-size:7.5px;line-height:10px;font-weight:500;text-transform:none;letter-spacing:0;color:${T.muted}}
.tbl{border:1px solid ${T.border};border-radius:6px;overflow:hidden;background:#fff}
.th,.tr{display:flex;align-items:stretch}
.th{height:${THEAD_H}px;background:${T.light};color:${T.ink};font-weight:800;font-size:8px;align-items:center;white-space:nowrap}
.tr{min-height:${ROW_BASE + LINE_H}px;border-top:1px solid ${T.border}}
.c{padding:4px 6px;display:flex;align-items:center;justify-content:center;text-align:center}
.th .c{padding:0 6px}
.k1{flex:0 0 34px}.k2{flex:1 1 auto;min-width:0;justify-content:flex-start;text-align:left;white-space:pre-line;overflow-wrap:anywhere}
.k3{flex:0 0 36px}.k4{flex:0 0 32px}
.tblA .k5{flex:0 0 76px}.tblA .k6{flex:0 0 80px}.tblB .k5,.tblB .k6{flex:0 0 90px}
.k5,.k6{justify-content:flex-end;text-align:right;padding-right:8px;font-variant-numeric:tabular-nums}
.tr .k2{font-weight:500}
.tr.tot{min-height:${TOT_A_H}px;background:${T.light};align-items:center;font-weight:800}
.tr.tot .lb{flex:1 1 auto;padding-left:10px;font-size:9px;letter-spacing:.3px}
.tr.tot .am{flex:0 0 160px;text-align:right;padding-right:8px;font-size:12px}
.lowbar{height:${LOW_BAR_H}px;background:${T.bar};color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 10px;font-size:9px;font-weight:800;letter-spacing:.2px}
.lowbar span+span{font-size:9.5px}
.proj{height:${PROJ_H}px;display:flex;background:${T.head};color:#fff}
.proj .l{flex:1 1 auto;display:flex;align-items:center;padding-left:10px;font-size:11px;font-weight:800;letter-spacing:.3px}
.proj .r{flex:0 0 220px;background:${T.big};clip-path:polygon(16px 0,100% 0,100% 100%,0 100%);display:flex;align-items:center;justify-content:flex-end;padding:0 12px;font-size:18px;font-weight:800}
.sc{display:flex;align-items:center;gap:8px;margin-bottom:1px;padding:2px 8px 2px 6px;border:1px solid ${T.border};border-radius:4px;background:#fff}
.sc:nth-child(even){background:${T.soft}}
.sc i{flex:0 0 22px;height:12px;line-height:11px;border:1px solid ${T.accent};border-radius:3px;text-align:center;font-style:normal;font-size:7px;font-weight:800;color:${T.accent};background:#fff}
.sc span{flex:1 1 auto;min-width:0}
.box{border:1px solid ${T.border};border-radius:6px;background:#fff;padding:5px 10px}
.rq{display:flex;gap:8px;padding:1px 0}
.rq b{flex:0 0 12px;color:${T.accent};font-weight:800}
.rq span{flex:1 1 auto;min-width:0}
.box.terms{padding:0;overflow:hidden;background:${T.soft}}
.tm{display:flex;border-top:1px solid ${T.border}}
.tm:first-child{border-top:0}
.tm .lab{flex:0 0 110px;padding:5px 10px;background:${T.light};color:${T.accent};font-size:7.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase}
.tm .txt{flex:1 1 auto;min-width:0;padding:5px 10px}
.tm .txt div{min-height:${LINE_H}px}
.tm .txt div.bl{position:relative;padding-left:12px}
.tm .txt div.bl:before{content:"";position:absolute;left:3px;top:4px;width:4px;height:4px;border-radius:50%;background:${T.accent}}
.bk{display:flex;height:${BANK_H}px;border:1px solid ${T.border};border-radius:7px;background:${T.soft};overflow:hidden}
.bk .f{flex:1 1 auto;padding:4px 12px;display:grid;grid-template-columns:96px 1fr;align-content:center;row-gap:3px;column-gap:8px;line-height:11px}
.bk .f span{color:${T.muted};font-weight:700;text-transform:uppercase;letter-spacing:.3px;font-size:7.5px}
.bk .f b{color:${T.ink};font-weight:800;font-size:9.5px}
.bk .qr{flex:0 0 140px;border-left:1px solid ${T.border};background:${T.light};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center}
.bk .qr .q1{font-size:7px;line-height:9px;font-weight:800;color:${T.accent};letter-spacing:.4px}
.bk .qr i{display:block;background-repeat:no-repeat;background-color:#fff}
.gr{display:flex;align-items:center;gap:6px;height:${ROW_BASE + LINE_H}px;padding:0 10px;background:${T.group};border-top:1px solid ${T.border};font-weight:800;font-size:8.5px;letter-spacing:.2px;text-transform:uppercase}
.gr b{flex:0 0 16px}
.tr.sub .k2{padding-left:18px}
${duct ? '.tr.tot{background:#E4F1E4}.lowbar{background:#E4F1E4;color:#10284A}' : ''}
.cont{height:${CONT_BAR_H}px;padding:0 ${MX}px;display:flex;align-items:center;justify-content:space-between;background:${T.head};color:#fff;font-weight:700;font-size:10px;letter-spacing:.2px}
`;

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */
export function buildCassetteHtml(q: CassetteQuoteLike, assets: QuoteAssets, opts: BuildOptions = {}): string {
  const mode = opts.mode || 'print';
  const template: QuoteTemplate = String(q.quotationType || 'DAIKIN').toUpperCase() === 'ECDIAL' ? 'ECDIAL' : 'DAIKIN';
  const T = THEMES[template];
  const items = Array.isArray(q.items) ? q.items : [];
  const main = items.filter((i) => i.section === 'MAIN_UNIT');
  const hasLow = q.hasLowSide !== false && items.some((i) => i.section === 'LOW_SIDE');
  const low = hasLow ? items.filter((i) => i.section === 'LOW_SIDE') : [];
  const showBank = q.includeBankDetails !== false;
  // Cassette, Duct (and VRV later) share one layout: grouped low side, ONE rate + amount per line
  const duct = true;

  /* ---- totals: the saved values win, sums are only a fallback for old rows ---- */
  const lowSup = (it: any) => (num(it.supplyAmount) || num(it.installAmount) ? num(it.supplyAmount) : num(it.amount));
  const mainTotal = has(q.mainUnitTotal) ? num(q.mainUnitTotal) : main.reduce((a, i) => a + num(i.amount), 0);
  const lowSupplyTotal = has(q.lowSideSupplyTotal) ? num(q.lowSideSupplyTotal) : low.reduce((a, i) => a + lowSup(i), 0);
  const lowInstallTotal = has(q.lowSideInstallTotal) ? num(q.lowSideInstallTotal) : low.reduce((a, i) => a + num(i.installAmount), 0);
  const lowTotal = has(q.lowSideTotal) && num(q.lowSideTotal) > 0
    ? num(q.lowSideTotal)
    : duct ? low.reduce((a, i) => a + num(i.amount), 0) : lowSupplyTotal + lowInstallTotal;
  const projectTotal = Math.round((mainTotal + (hasLow ? lowTotal : 0)) * 100) / 100;

  /* ---- rows ---- */
  const projBar = (label: string) =>
    `<div class="proj"><div class="l">${label}</div><div class="r">₹ ${money(projectTotal)}</div></div>`;

  let mainNo = 0;
  let subNo = 0;
  const mainRows: Row[] = main.length
    ? main.map((it) => {
        const { kind, text } = parseKind(it.description);
        if (kind === 'SUB') {
          const letter = String.fromCharCode(97 + (subNo++ % 26));
          return {
            h: ROW_BASE + LINE_H * countLines(text, DESC_W - 18),
            html: `<div class="tr sub"><div class="c k1">${letter}</div><div class="c k2">${esc(text)}</div><div class="c k3">${esc(it.unit)}</div><div class="c k4">${esc(it.quantity)}</div><div class="c k5">${money(num(it.supplyRate) > 0 ? it.supplyRate : it.unitPrice)}</div><div class="c k6">${money(it.amount)}</div></div>`,
          };
        }
        subNo = 0;
        mainNo += 1;
        if (kind === 'HEADING') {
          return {
            h: ROW_BASE + LINE_H * countLines(text, DESC_W),
            html: `<div class="tr"><div class="c k1">${mainNo}</div><div class="c k2">${esc(text)}</div><div class="c k3">—</div><div class="c k4">—</div><div class="c k5">—</div><div class="c k6">—</div></div>`,
          };
        }
        return {
          h: ROW_BASE + LINE_H * countLines(text, DESC_W),
          html: `<div class="tr"><div class="c k1">${mainNo}</div><div class="c k2">${esc(text)}</div><div class="c k3">${esc(it.unit)}</div><div class="c k4">${esc(it.quantity)}</div><div class="c k5">${money(num(it.supplyRate) > 0 ? it.supplyRate : it.unitPrice)}</div><div class="c k6">${money(it.amount)}</div></div>`,
        };
      })
    : [{ h: ROW_BASE + LINE_H, html: '<div class="tr"><div class="c k2" style="justify-content:center;color:#64748B">No main units specified.</div></div>' }];

  const mainTail =
    `<div class="tr tot"><div class="lb">${duct ? 'TOTAL – MAIN UNIT' : 'TOTAL – HIGH-SIDE EQUIPMENT'}</div><div class="am">₹ ${money(mainTotal)}</div></div>` +
    (hasLow ? '' : projBar('TOTAL PROJECT COST&nbsp;&nbsp;(A)'));
  const mainTailH = TOT_A_H + (hasLow ? 0 : PROJ_H);
  mainRows[mainRows.length - 1] = {
    h: mainRows[mainRows.length - 1].h + mainTailH,
    html: mainRows[mainRows.length - 1].html + mainTail,
  };

  let lowRows: Row[] = [];
  if (duct) {
    /* Duct: grouped low side (1. Refrigerant piping -> 1.1, 1.2 ...), one rate and one amount per line */
    const parsed = low.map((it) => ({ it, ...parseGroup(it.description) }));
    const anyGroup = parsed.some((x) => x.group);
    const order: string[] = [];
    const byGroup = new Map<string, typeof parsed>();
    for (const x of parsed) {
      const g = x.group || (anyGroup ? 'Other works' : '');
      if (!byGroup.has(g)) { byGroup.set(g, []); order.push(g); }
      byGroup.get(g)!.push(x);
    }
    let seq = 0;
    order.forEach((g, gi) => {
      (byGroup.get(g) as typeof parsed).forEach((x, j) => {
        seq += 1;
        const no = anyGroup ? '' : String(seq); // the group header carries the number, lines under it are not numbered
        const head = anyGroup && j === 0 ? `<div class="gr"><b>${gi + 1}.</b><span>${esc(g)}</span></div>` : '';
        lowRows.push({
          h: (head ? ROW_BASE + LINE_H : 0) + ROW_BASE + LINE_H * countLines(x.text, DUCT_LOW_W),
          html: `${head}<div class="tr${anyGroup ? ' sub' : ''}"><div class="c k1">${no}</div><div class="c k2">${esc(x.text)}</div><div class="c k3">${esc(x.it.unit)}</div><div class="c k4">${esc(x.it.quantity)}</div><div class="c k5">${money(num(x.it.installRate) > 0 ? num(x.it.supplyRate) + num(x.it.installRate) : num(x.it.supplyRate) > 0 ? x.it.supplyRate : x.it.unitPrice)}</div><div class="c k6">${money(x.it.amount)}</div></div>`,
        });
      });
    });
    if (lowRows.length) {
      const last = lowRows[lowRows.length - 1];
      last.h += TOT_A_H + PROJ_H;
      last.html +=
        `<div class="tr tot"><div class="lb">TOTAL – LOW-SIDE WORKS</div><div class="am">₹ ${money(lowTotal)}</div></div>` +
        projBar('TOTAL PROJECT COST&nbsp;&nbsp;(A + B)');
    }
  } else {
    lowRows = low.map((it, i) => ({
      h: ROW_BASE + LINE_H * countLines(it.description, DESC_W),
      html: `<div class="tr"><div class="c k1">${i + 1}</div><div class="c k2">${esc(it.description)}</div><div class="c k3">${esc(it.unit)}</div><div class="c k4">${esc(it.quantity)}</div><div class="c k5">${moneyOrDash(lowSup(it))}</div><div class="c k6">${moneyOrDash(it.installAmount)}</div></div>`,
    }));
    if (lowRows.length) {
      const last = lowRows[lowRows.length - 1];
      last.h += LOW_BAR_H + PROJ_H;
      last.html +=
        `<div class="lowbar"><span>TOTAL LOW-SIDE WORKS</span><span>Supply ₹${money(lowSupplyTotal)}&nbsp;&nbsp;/&nbsp;&nbsp;Installation ₹${money(lowInstallTotal)}</span></div>` +
        projBar('TOTAL PROJECT COST&nbsp;&nbsp;(A + B)');
    }
  }

  const scopeLines = splitLines(q.scopeExclusions);
  const scopeRows: Row[] = scopeLines.map((t, i) => ({
    h: 7 + Math.max(12, LINE_H * countLines(t, SCOPE_W)),
    html: `<div class="sc"><i>${String(i + 1).padStart(2, '0')}</i><span>${esc(t)}</span></div>`,
  }));

  const reqLines = splitLines(q.commissioningReqs);
  const reqRows: Row[] = reqLines.map((t, i) => ({
    h: 2 + LINE_H * countLines(t, REQ_W),
    html: `<div class="rq"><b>${i + 1}.</b><span>${esc(t)}</span></div>`,
  }));

  const termLines = splitLines(q.termsAndConditions);
  const payLines = splitLines(q.paymentMethod);
  const termRows: Row[] = [];
  if (termLines.length) {
    const lines = termLines.reduce((a, t) => a + countLines(t, TERM_W), 0);
    termRows.push({
      h: 11 + LINE_H * lines,
      html: `<div class="tm"><div class="lab">Tax &amp; terms</div><div class="txt">${termLines.map((t) => `<div>${esc(t)}</div>`).join('')}</div></div>`,
    });
  }
  if (payLines.length) {
    const lines = payLines.reduce((a, t) => a + countLines(t, TERM_W - 12), 0);
    termRows.push({
      h: 11 + LINE_H * lines,
      html: `<div class="tm"><div class="lab">Payment schedule</div><div class="txt">${payLines.map((t) => `<div class="bl">${esc(t)}</div>`).join('')}</div></div>`,
    });
  }

  const crop = QR_CROP[template];
  const QR_W = 76;
  const k = QR_W / crop.w;
  const qrHtml = assets.bank
    ? `<i style="width:${QR_W}px;height:${Math.round(crop.h * k)}px;background-image:url(${assets.bank});background-size:${Math.round(crop.W * k)}px ${Math.round(crop.H * k)}px;background-position:-${Math.round(crop.x * k)}px -${Math.round(crop.y * k)}px"></i>`
    : '';
  const B = BANK_DETAILS;
  const bankRows: Row[] = [{
    h: BANK_H,
    html: `<div class="bk"><div class="f"><span>Account name</span><b>${esc(B.accountName)}</b><span>Account number</span><b>${esc(B.accountNumber)}</b><span>Bank</span><b>${esc(B.bank)}</b><span>Branch</span><b>${esc(B.branch)}</b><span>IFSC code</span><b>${esc(B.ifsc)}</b><span>UPI ID</span><b>${esc(B.upi)}</b></div><div class="qr"><div class="q1">SCAN TO PAY</div>${qrHtml}<div class="q1" style="color:${T.muted}">UPI / BANK TRANSFER</div></div></div>`,
  }];

  /* ---- sections (letters follow the sections that are actually present) ---- */
  const thA = `<div class="th"><div class="c k1">Item</div><div class="c k2">Equipment / model description</div><div class="c k3">Unit</div><div class="c k4">Qty</div><div class="c k5">Supply rate (₹)</div><div class="c k6">Amount (₹)</div></div>`;
  const thB = `<div class="th"><div class="c k1">Item</div><div class="c k2">Work description / specification</div><div class="c k3">Unit</div><div class="c k4">Qty</div><div class="c k5">Supply amount (₹)</div><div class="c k6">Installation (₹)</div></div>`;

  const thD = (d: string) => `<div class="th"><div class="c k1">S.No</div><div class="c k2">${d}</div><div class="c k3">Unit</div><div class="c k4">Qty</div><div class="c k5">Rate (₹)</div><div class="c k6">Amount (₹)</div></div>`;
  const defs: Array<Omit<Sec, 'letter'>> = [
    duct
      ? { title: 'Main unit / high-side equipment', sub: 'Supply of main equipment as per BOQ', part: 1, wrap: 'tblA', thead: thD('Description'), boxPad: 2, rows: mainRows }
      : { title: 'Main units / high-side equipment', sub: 'Supply schedule - model references retained from source quotation', part: 1, wrap: 'tblA', thead: thA, boxPad: 2, rows: mainRows },
  ];
  if (hasLow) defs.push(duct
    ? { title: 'Low-side works', sub: 'Supply and installation as per specification', part: 1, wrap: 'tblA', thead: thD('Description'), boxPad: 2, rows: lowRows }
    : { title: 'Low-side works', sub: 'Supply and installation amounts shown separately', part: 1, wrap: 'tblB', thead: thB, boxPad: 2, rows: lowRows });
  if (scopeRows.length) defs.push({ title: 'Customer scope / exclusions', sub: 'Items below are to be arranged by the customer unless agreed otherwise', part: 2, wrap: 'plain', thead: '', boxPad: 0, rows: scopeRows });
  if (reqRows.length) defs.push({ title: 'Requirements before commissioning', sub: '', part: 2, wrap: 'box', thead: '', boxPad: 12, rows: reqRows });
  if (termRows.length) defs.push({ title: 'Terms & conditions', sub: '', part: 2, wrap: 'terms', thead: '', boxPad: 2, rows: termRows });
  if (showBank) defs.push({ title: 'Bank details', sub: '', part: 2, wrap: 'bank', thead: '', boxPad: 0, rows: bankRows });
  const secs: Sec[] = defs.map((d, i) => ({ ...d, letter: String.fromCharCode(65 + i) }));

  const pages = paginateCassette(secs, template, duct);
  const total = pages.length;

  const chunkHtml = (c: Chunk) => {
    const s = c.sec;
    const head = `<div class="sec"><div class="b">${s.letter}</div><div class="t">${esc(s.title)}${c.cont ? ' <small style="display:inline;font-size:8px">(contd.)</small>' : s.sub ? `<small>${esc(s.sub)}</small>` : ''}</div></div>`;
    const rows = c.rows.map((r) => r.html).join('');
    let body: string;
    if (s.wrap === 'tblA' || s.wrap === 'tblB') body = `<div class="tbl ${s.wrap}">${s.thead}${rows}</div>`;
    else if (s.wrap === 'box') body = `<div class="box">${rows}</div>`;
    else if (s.wrap === 'terms') body = `<div class="box terms">${rows}</div>`;
    else body = rows; // 'plain' (scope pills) and 'bank' draw their own border
    return `<div class="blk">${head}${body}</div>`;
  };

  const validTill = q.validTill || addDays(q.date, 10);
  const cust = q.customerName && q.customerName.trim() ? q.customerName.trim() : '';
  const meta = `<div class="qm"><div>Quotation <b>${esc(q.quotationNumber || '')}</b></div><div>Date <b>${esc(fmtDate(q.date))}</b> · Valid till <b>${esc(fmtDate(validTill))}</b></div></div>`;

  const topHtml = (p: Page, idx: number) => {
    if (p.kind === 'cont') {
      return `<div class="cont"><span>${template === 'ECDIAL' ? 'Ec Dial' : 'Daikin · Ec Dial'} — Quotation ${esc(q.quotationNumber || '')}${cust ? ' · ' + esc(cust) : ''}</span><span>Page ${idx + 1} of ${total}</span></div>`;
    }
    const first = true;
    const ttl = `<div class="ttl"><div class="eb">Commercial proposal · Page ${idx + 1} of ${total}</div><div class="h1">Equipment &amp; Cost Schedule</div><div class="rule"></div>${meta}</div>`;
    const acLabel = ({ CASSETTE: 'Cassette AC', DUCT: 'Duct AC', VRV: 'VRV / VRF' } as Record<string, string>)[String(q.acType || '').toUpperCase()] || 'AC';
    const brandName = template === 'ECDIAL' ? 'Ec Dial' : 'Daikin';
    const descTitle = (q.systemDesignation || '').trim() || `${brandName} ${acLabel.replace(' AC', '')} Quote`;
    const typeLine = `${acLabel} · ${brandName}`;
    const info = first
      ? `<div class="info"><div class="i1"><div class="l">Prepared for</div><div class="v">${esc(cust || '—')}</div><div class="s">${esc((q.customerAddress || '').replace(/\s*\n\s*/g, ', '))}</div></div><div class="i2"><div class="l">Quotation</div><div class="v">${esc(descTitle)}</div><div class="s">${esc(typeLine)}</div></div><div class="i3"><div class="l">Offer type</div><div class="v" style="white-space:normal;line-height:14px">${esc(q.offerType || 'Supply and Installation')}</div></div></div>`
      : '';
    return `<img class="hdr" src="${assets.header}"/>${ttl}${info}`;
  };

  const pageHtml = pages
    .map((p, idx) => `<section class="page">${topHtml(p, idx)}<div class="body">${p.chunks.map(chunkHtml).join('')}</div><div class="grow"></div><img class="ftr" src="${assets.footer}"/></section>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="${mode === 'screen' ? `width=${PAGE_W}, maximum-scale=4, user-scalable=yes` : `width=${PAGE_W}, initial-scale=1, maximum-scale=1`}"><title>Quotation ${esc(q.quotationNumber || '')}</title><style>${css(T, mode, template, opts.scale || 1, duct)}</style></head><body>${pageHtml}</body></html>`;
}
