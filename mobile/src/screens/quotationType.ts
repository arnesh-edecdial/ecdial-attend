export type QuotationKind = 'DAIKIN' | 'ECDIAL';

/**
 * ONE rule for "is this a Daikin or an Ec Dial quotation", used by the list,
 * the preview, the PDF and the edit form so they can never disagree.
 *
 * The auto-generated PDF name always starts with the template that was chosen
 * when the quote was saved (DAIKIN_... / ECDIAL_...), so it is a reliable second
 * source if the stored `quotationType` field is missing or wrong.
 */
export const resolveQuotationType = (q: any): QuotationKind => {
  const name = String(q?.pdfName || '').trim().toUpperCase();
  if (name.startsWith('DAIKIN_')) return 'DAIKIN';
  if (name.startsWith('ECDIAL_')) return 'ECDIAL';
  return String(q?.quotationType || '').toUpperCase() === 'DAIKIN' ? 'DAIKIN' : 'ECDIAL';
};
