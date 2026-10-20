import { buildQuotationHtml, detectBrands, DEALER_STRIP_TEMPLATES, QuoteLike, QuoteAssets, BuildOptions } from './quotationHtml';
import { buildCassetteHtml } from './cassetteHtml';
import { loadBrandLogos, loadQuoteAssets, templateOf } from './quotationAssets';

/**
 * Web twin of the mobile quotationPdf.ts. The SAME buildQuotationHtml() renders the
 * preview and the PDF, so what you see on the web is exactly what the Android app produces.
 */
const withType = (q: QuoteLike): QuoteLike => ({ ...q, quotationType: templateOf(q) });

/** Cassette and Duct share the 2-page proposal layout; Split keeps its own; VRV comes later. */
const isCassette = (q: any) => ['CASSETTE', 'DUCT', 'VRV'].includes(String(q?.acType || '').toUpperCase()); // Cassette, Duct and VRV share one builder
const build = (q: QuoteLike, assets: QuoteAssets, opts: BuildOptions) =>
  isCassette(q) ? buildCassetteHtml(q as any, assets, opts) : buildQuotationHtml(q, assets, opts);

const assetsFor = async (q: QuoteLike) => {
  const t = templateOf(q);
  const base = await loadQuoteAssets(t);
  const keys = DEALER_STRIP_TEMPLATES.includes(t) && !isCassette(q) ? detectBrands(q.items) : [];
  return { ...base, logos: keys.length ? await loadBrandLogos(keys) : {} };
};

/** Stacked A4 pages on grey, for the preview iframe. */
export const previewHtml = async (q: QuoteLike) =>
  build(withType(q), await assetsFor(q), { mode: 'screen' });

/**
 * Print layout. Browsers lay out 1 CSS px = 0.75 pt (96 dpi), exactly like Android's print
 * engine, so the same 96/72 enlargement used on Android makes the page fill the A4 sheet.
 */
export const printHtml = async (q: QuoteLike) =>
  build(withType(q), await assetsFor(q), { mode: 'print', scale: 96 / 72 });

export const safeFileName = (name: string) => (name || 'Quotation').trim().replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * Opens the browser print dialog for the quotation (choose "Save as PDF").
 * The document title becomes the suggested file name.
 */
export async function downloadQuotationPdf(q: QuoteLike, fileName: string): Promise<void> {
  const name = safeFileName(fileName);
  const html = (await printHtml(q)).replace(/<title>[\s\S]*?<\/title>/, `<title>${name}</title>`);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const previousTitle = document.title;
  const cleanup = () => {
    document.title = previousTitle;
    setTimeout(() => iframe.remove(), 500);
  };

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = html;
  });

  // images are data: URIs, give the layout one frame to settle before printing
  await new Promise((r) => setTimeout(r, 250));
  const win = iframe.contentWindow;
  if (!win) { cleanup(); throw new Error('Could not open the print view.'); }
  document.title = name; // Chrome/Edge use the top document title for the saved file name
  win.addEventListener('afterprint', cleanup);
  win.focus();
  win.print();
  setTimeout(cleanup, 60_000); // safety net if afterprint never fires
}
