/**
 * Quotation -> paged A4 HTML (595 x 842 CSS px, 1 px = 1 pt).
 * One source of truth: the in-app preview (WebView) and the PDF (expo-print)
 * both render this exact HTML, so what you see is what you send.
 *
 * Pagination is computed here (not by the browser) so every page break is
 * predictable: header + totals on page 1, tables flow onto continuation pages
 * with their table header repeated, and the Terms / Bank block plus the footer
 * always sit together at the end.
 */

export type QuoteTemplate = 'DAIKIN' | 'ECDIAL';

/** data: URIs for the four static brand images */
export interface QuoteAssets {
  header: string;
  terms: string;
  bank: string;
  footer: string;
}

export interface BuildOptions {
  /** 'screen' = stacked pages on grey (preview); 'print' = bare pages (PDF) */
  mode?: 'screen' | 'print';
}

/* ------------------------------------------------------------------ */
/* Geometry (px). The estimator below and the CSS use the same numbers. */
/* ------------------------------------------------------------------ */
const PAGE_W = 595;
const PAGE_H = 840; // 2px under A4 so rounding never creates a blank page
const MX = 20; // side margin
const CONTENT_W = PAGE_W - MX * 2;

const HEAD_H = { ECDIAL: 135, DAIKIN: 140 };
const TERMS_H = { ECDIAL: 212, DAIKIN: 224 }; // terms/bank row height
const FOOT_H = 65;

const META_H = 22;
const SUM_H = 94;
const CONT_BAR_H = 30;

const SEC_H = 22; // "A  MAIN UNIT" bar
const SEC_GAP = 3; // gap bar -> table
const THEAD_H = 19;
const SEC_SPACE = 7; // space between blocks
const ROW_BASE = 9; // 4+4 padding + 1 border
const LINE_H = 11;

const FONT_PX = 9.5;
const DESC_W = CONTENT_W - (40 + 34 + 36 + 70 + 80) - 12; // description column minus padding

/* ------------------------------------------------------------------ */
/* Themes (sampled from the two approved template designs)             */
/* ------------------------------------------------------------------ */
const THEMES = {
  ECDIAL: {
    head: '#14204F', accent: '#F47A20', badge: '#1B2160', secBg: '#EEF0FC', secText: '#19198A',
    border: '#DDE1F0', metaBg: '#F5F6FE', metaBorder: '#D5D9F2', ink: '#1B1F3B', soft: '#FAFAFE',
    toBox: false, secLine: false, lineColor: '#14204F', totalBar: '#14204F', headRadius: 5,
    toBg: 'transparent',
  },
  DAIKIN: {
    head: '#0B4A86', accent: '#0B5FA5', badge: '#0B5FA5', secBg: 'transparent', secText: '#0B3FA8',
    border: '#D3E0EF', metaBg: '#F2F8FE', metaBorder: '#C9DDF1', ink: '#10284A', soft: '#F6FAFE',
    toBox: true, secLine: true, lineColor: '#3A8FD8', totalBar: '#0B5CA0', headRadius: 5,
    toBg: '#EAF3FD',
  },
} as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Indian digit grouping, 2 decimals. Pure JS so it never depends on Intl support. */
export const fmtINR = (v: any): string => {
  const n = Number(v) || 0;
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  const head = i.length > 3 ? i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3) : i;
  return `${n < 0 ? '-' : ''}${head}.${d}`;
};

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

/** Estimated rendered width of a string in px (conservative: slightly wide). */
const textW = (s: string) => {
  let w = 0;
  for (const ch of s) {
    if (ch === ' ') w += 0.28;
    else if (/[WMm@%]/.test(ch)) w += 0.88;
    else if (/[A-Z]/.test(ch)) w += 0.66;
    else if (/[0-9]/.test(ch)) w += 0.56;
    else if (/[ijlI.,;:'|!()]/.test(ch)) w += 0.3;
    else if (ch.charCodeAt(0) > 0x2fff) w += 1.0; // CJK / emoji
    else w += 0.52;
  }
  return w * FONT_PX * 1.04; // ~10% safety over Arial so iOS/Android system fonts never overflow
};

/** Number of wrapped lines for a description (greedy word wrap, honours \n). */
export const countLines = (text: string): number => {
  let lines = 0;
  for (const para of String(text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let cur = 0;
    let n = 1;
    for (const w of words) {
      const ww = textW(w);
      const add = cur === 0 ? ww : ww + textW(' ');
      if (cur + add > DESC_W && cur > 0) { n += 1; cur = ww; }
      else cur += add;
      // a single very long word wraps by characters
      while (cur > DESC_W) { n += 1; cur -= DESC_W; }
    }
    lines += n;
  }
  return Math.max(1, lines);
};

const rowH = (desc: string) => ROW_BASE + LINE_H * countLines(desc);

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */
interface RowRef { n: number; it: any; h: number; placeholder?: boolean }
interface Chunk { sec: 'A' | 'B'; cont: boolean; rows: RowRef[] }
interface Page { chunks: Chunk[]; used: number; terms: boolean }

export function paginate(main: any[], low: any[], showTermsRow: boolean, template: QuoteTemplate) {
  const top1 = HEAD_H[template] + 5 + META_H + 7 + SUM_H + 8;
  const topN = CONT_BAR_H + 8;
  const foot = FOOT_H + 6;
  const budget = (i: number) => PAGE_H - (i === 0 ? top1 : topN) - foot;

  const pages: Page[] = [{ chunks: [], used: 0, terms: false }];
  const cur = () => pages[pages.length - 1];
  const newPage = () => pages.push({ chunks: [], used: 0, terms: false });

  const sections: { sec: 'A' | 'B'; rows: RowRef[] }[] = [
    {
      sec: 'A',
      rows: main.length
        ? main.map((it, i) => ({ n: i + 1, it, h: rowH(it.description) }))
        : [{ n: 0, it: { description: 'No main units specified.' }, h: ROW_BASE + LINE_H, placeholder: true }],
    },
  ];
  if (low.length) sections.push({ sec: 'B', rows: low.map((it, i) => ({ n: i + 1, it, h: rowH(it.description) })) });

  for (const s of sections) {
    let i = 0;
    let cont = false;
    while (i < s.rows.length) {
      let page = cur();
      const bud = budget(pages.length - 1);
      const gap = page.used > 0 ? SEC_SPACE : 0;
      const head = SEC_H + SEC_GAP + THEAD_H;
      // heading + table head + at least one row must fit, otherwise start a new page
      if (page.used > 0 && page.used + gap + head + s.rows[i].h > bud) {
        newPage();
        page = cur();
      }
      const g = page.used > 0 ? SEC_SPACE : 0;
      const chunk: Chunk = { sec: s.sec, cont, rows: [] };
      page.chunks.push(chunk);
      page.used += g + head;
      const b = budget(pages.length - 1);
      // always place at least one row (guards against an endless loop on absurd rows)
      do {
        chunk.rows.push(s.rows[i]);
        page.used += s.rows[i].h;
        i += 1;
      } while (i < s.rows.length && page.used + s.rows[i].h <= b);
      if (i < s.rows.length) {
        newPage();
        cont = true;
      }
    }
  }

  const t = TERMS_H[template];
  let page = cur();
  const need = (page.used > 0 ? SEC_SPACE + 1 : 0) + t;
  if (page.used + need > budget(pages.length - 1)) {
    newPage();
    page = cur();
  }
  page.terms = true;
  void showTermsRow;
  return pages;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */
const ICON = {
  cal: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  doc: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3h8l4 4v14h-12z"/><path d="M14.5 3v4h4"/></svg>',
};

const css = (T: (typeof THEMES)[QuoteTemplate], mode: 'screen' | 'print') => `
@page{size:${PAGE_W}px 842px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${PAGE_W}px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:${T.ink};font-size:${FONT_PX}px;line-height:${LINE_H}px;${mode === 'screen' ? 'background:#E6E9F0;padding:8px 0' : 'background:#fff'}}
.page{width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;position:relative;display:flex;flex-direction:column;overflow:hidden;${mode === 'screen' ? 'margin:0 auto 10px;box-shadow:0 1px 6px rgba(15,23,42,.18)' : 'page-break-after:always;break-after:page'}}
${mode === 'print' ? '.page:last-child{page-break-after:auto;break-after:auto}' : ''}
.hdr{display:block;width:${PAGE_W}px;height:auto}
.ftr{display:block;width:${PAGE_W}px;height:auto;margin-top:6px}
.pad{padding:0 ${MX}px}
.grow{flex:1 1 auto;min-height:0}
.meta{margin:5px ${MX}px 0;height:${META_H}px;border:1px solid ${T.metaBorder};background:${T.metaBg};border-radius:6px;display:flex;align-items:center;font-weight:600;font-size:9.5px}
.meta>div{flex:1;display:flex;align-items:center;gap:6px;padding:0 10px;height:100%}
.meta>div+div{border-left:1px solid ${T.metaBorder}}
.meta>div:last-child{justify-content:flex-end}
.meta svg{color:${T.head}}
.sum{margin:7px ${MX}px 0;height:${SUM_H}px;display:flex;justify-content:space-between;gap:12px}
.to{flex:1;max-width:300px;align-self:flex-start;min-height:${T.toBox ? 62 : 0}px;padding:${T.toBox ? '9px 11px' : '2px 0'};background:${T.toBg};border-radius:6px;font-size:9.5px;line-height:13px;overflow:hidden}
.to .lbl{font-size:9px;color:#475569}
.to .nm{font-size:13.5px;font-weight:800;line-height:18px;color:${T.ink}}
.card{width:226px;border-radius:6px;overflow:hidden;background:#fff;border:1px solid ${T.border}}
.card .h{background:${T.head};color:#fff;text-align:center;font-weight:700;font-size:12px;height:22px;line-height:22px;letter-spacing:.4px}
.card .r{display:flex;justify-content:space-between;align-items:center;height:17px;padding:0 9px;border-bottom:1px solid ${T.border};font-size:9.5px}
.card .r b{font-weight:800}
.card .t{background:${T.totalBar};color:#fff;display:flex;justify-content:space-between;align-items:center;height:21px;padding:0 9px;font-weight:800;font-size:11.5px;line-height:21px}
.card .t span:last-child{font-size:13px}
.body{padding:0 ${MX}px}
.blk+.blk{margin-top:${SEC_SPACE}px}
.sec{height:${SEC_H}px;display:flex;align-items:center;gap:9px;margin-bottom:${SEC_GAP}px;${T.secBg !== 'transparent' ? `background:${T.secBg};border-radius:6px;` : ''}}
.sec .b{width:26px;height:${SEC_H}px;background:${T.badge};color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;border-radius:5px 5px ${T.secBg !== 'transparent' ? '5px 0' : '0 0'}}
.sec .tt{font-weight:800;font-size:11.5px;color:${T.secText};letter-spacing:.2px}
.sec .tt small{font-size:8.5px;font-weight:600;color:#64748B}
.sec .ln{flex:0 0 130px;height:1px;background:${T.lineColor};opacity:.8}
.tbl{border:1px solid ${T.border};border-radius:${T.headRadius + 1}px;overflow:hidden;background:#fff}
.th,.tr{display:flex;align-items:stretch}
.th{height:${THEAD_H}px;background:${T.head};color:#fff;font-weight:700;font-size:9.5px;align-items:center}
.tr{min-height:${ROW_BASE + LINE_H}px;border-top:1px solid ${T.border};font-size:${FONT_PX}px}
.tr:first-of-type{border-top:0}
.c{padding:4px 6px;display:flex;align-items:center;justify-content:center;text-align:center}
.th .c{padding:0 6px}
.c1{flex:0 0 40px}.c2{flex:1 1 auto;min-width:0;word-break:break-word;overflow-wrap:anywhere}.c3{flex:0 0 34px}.c4{flex:0 0 36px}.c5{flex:0 0 70px}.c6{flex:0 0 80px}
.tr .c5,.tr .c6{font-variant-numeric:tabular-nums}
.tr .c2{white-space:pre-line}
.empty{justify-content:center;color:#64748B}
.bt{display:flex;gap:10px;margin-top:${SEC_SPACE + 1}px;padding:0 ${MX}px}
.bt img{display:block;height:auto}
.bt .t{width:55%}
.bt .b{width:45%}
.bt .full{width:100%}
.cont{height:${CONT_BAR_H}px;margin:0;padding:0 ${MX}px;display:flex;align-items:center;justify-content:space-between;background:${T.head};color:#fff;font-weight:700;font-size:10px;letter-spacing:.2px}
`;

export interface QuoteLike {
  quotationNumber?: string;
  quotationType?: string;
  date: string;
  validTill?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  items?: any[];
  subtotal?: number;
  cgstPercent?: number;
  cgstAmount?: number;
  sgstPercent?: number;
  sgstAmount?: number;
  grandTotal?: number;
  hasLowSide?: boolean;
  includeBankDetails?: boolean;
}

export function buildQuotationHtml(q: QuoteLike, assets: QuoteAssets, opts: BuildOptions = {}): string {
  const mode = opts.mode || 'print';
  const template: QuoteTemplate = String(q.quotationType || 'DAIKIN').toUpperCase() === 'ECDIAL' ? 'ECDIAL' : 'DAIKIN';
  const T = THEMES[template];
  const items = Array.isArray(q.items) ? q.items : [];
  const main = items.filter((i) => i.section === 'MAIN_UNIT');
  const low = q.hasLowSide === false ? [] : items.filter((i) => i.section === 'LOW_SIDE');
  const showBank = q.includeBankDetails !== false;

  const pages = paginate(main, low, showBank, template);
  const total = pages.length;

  const sum = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const subtotal = q.subtotal != null ? Number(q.subtotal) : sum;
  const cgstP = q.cgstPercent != null ? q.cgstPercent : 9;
  const sgstP = q.sgstPercent != null ? q.sgstPercent : 9;
  const cgst = q.cgstAmount != null ? Number(q.cgstAmount) : Math.round(subtotal * cgstP) / 100;
  const sgst = q.sgstAmount != null ? Number(q.sgstAmount) : Math.round(subtotal * sgstP) / 100;
  const grand = q.grandTotal != null ? Number(q.grandTotal) : subtotal + cgst + sgst;
  const validTill = q.validTill || addDays(q.date, 10);

  const row = (r: RowRef) =>
    r.placeholder
      ? `<div class="tr"><div class="c c2 empty">${esc(r.it.description)}</div></div>`
      : `<div class="tr"><div class="c c1">${r.n}</div><div class="c c2">${esc(r.it.description)}</div><div class="c c3">${esc(r.it.quantity)}</div><div class="c c4">${esc(r.it.unit)}</div><div class="c c5">${fmtINR(r.it.unitPrice)}</div><div class="c c6">${fmtINR(r.it.amount)}</div></div>`;

  const chunkHtml = (c: Chunk) => {
    const title = c.sec === 'A' ? 'MAIN UNIT' : 'LOW SIDE (B) IF NEED EXTRA MATERIALS';
    return `<div class="blk"><div class="sec"><div class="b">${c.sec}</div><div class="tt">${title}${c.cont ? ' <small>(contd.)</small>' : ''}</div>${T.secLine ? '<div class="ln"></div>' : ''}</div>
<div class="tbl"><div class="th"><div class="c c1">SL.No</div><div class="c c2">Description</div><div class="c c3">Qty</div><div class="c c4">Unit</div><div class="c c5">Price (₹)</div><div class="c c6">Amount (₹)</div></div>${c.rows.map(row).join('')}</div></div>`;
  };

  const to = q.customerName && q.customerName.trim()
    ? `<div class="to"><div class="lbl">To,</div><div class="nm">${esc(q.customerName)}</div>${q.customerAddress && q.customerAddress.trim() ? `<div>${esc(q.customerAddress)}</div>` : ''}${q.customerPhone ? `<div>Mobile: ${esc(q.customerPhone)}</div>` : ''}${q.customerEmail ? `<div>Email: ${esc(q.customerEmail)}</div>` : ''}</div>`
    : '<div class="to" style="background:transparent"></div>';

  const termsBank = showBank
    ? `<div class="bt"><img class="t" src="${assets.terms}"/><img class="b" src="${assets.bank}"/></div>`
    : `<div class="bt"><img class="full" src="${assets.terms}" style="max-width:${Math.round(CONTENT_W * 0.55)}px"/></div>`;

  const pageHtml = pages
    .map((p, idx) => {
      const top =
        idx === 0
          ? `<img class="hdr" src="${assets.header}"/>
<div class="meta"><div>${ICON.cal}<span>Date: ${esc(fmtDate(q.date))}</span></div><div>${ICON.cal}<span>Valid Till: ${esc(fmtDate(validTill))}</span></div><div>${ICON.doc}<span>Page: ${idx + 1} of ${total}</span></div></div>
<div class="sum">${to}<div class="card"><div class="h">QUOTATION</div><div class="r"><span>Sub Total (A)</span><b>Rs. ${fmtINR(subtotal)}</b></div><div class="r"><span>CGST ${cgstP}%</span><b>Rs. ${fmtINR(cgst)}</b></div><div class="r"><span>SGST ${sgstP}%</span><b>Rs. ${fmtINR(sgst)}</b></div><div class="t"><span>TOTAL (A)</span><span>Rs. ${fmtINR(grand)}</span></div></div></div>`
          : `<div class="cont"><span>${template === 'ECDIAL' ? 'Ec Dial' : 'Daikin · Ec Dial'} — Quotation ${esc(q.quotationNumber || '')}${q.customerName ? ' · ' + esc(q.customerName) : ''}</span><span>Page ${idx + 1} of ${total}</span></div>`;
      return `<section class="page">${top}<div class="body" style="margin-top:${idx === 0 ? 8 : 8}px">${p.chunks.map(chunkHtml).join('')}</div>${p.terms ? termsBank : ''}<div class="grow"></div><img class="ftr" src="${assets.footer}"/></section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="${mode === 'screen' ? `width=${PAGE_W}, maximum-scale=4, user-scalable=yes` : `width=${PAGE_W}, initial-scale=1, maximum-scale=1`}"><title>Quotation ${esc(q.quotationNumber || '')}</title><style>${css(T, mode)}</style></head><body>${pageHtml}</body></html>`;
}
