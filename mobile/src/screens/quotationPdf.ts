import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { buildQuotationHtml, QuoteLike } from './quotationHtml';
import { loadQuoteAssets, templateOf } from './quotationAssets';

/** HTML for the in-app preview (stacked pages on grey). */
export const previewHtml = async (q: QuoteLike) =>
  buildQuotationHtml(q, await loadQuoteAssets(templateOf(q)), { mode: 'screen' });

/** Renders the quotation to an A4 PDF in the cache folder and returns its file:// uri. */
export async function makeQuotationPdf(q: QuoteLike, fileName: string): Promise<string> {
  const html = buildQuotationHtml(q, await loadQuoteAssets(templateOf(q)), { mode: 'print' });
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const dest = `${FileSystem.cacheDirectory}${fileName}.pdf`;
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: dest });
  return dest;
}

export async function sharePdf(uri: string, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
}

/**
 * Android: pick a folder once and write the PDF there.
 * iOS: the share sheet's "Save to Files" is the native way to save.
 */
export async function savePdfToDevice(uri: string, name: string): Promise<'saved' | 'shared' | 'cancelled'> {
  if (Platform.OS === 'android') {
    const SAF = FileSystem.StorageAccessFramework;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return 'cancelled';
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const dest = await SAF.createFileAsync(perm.directoryUri, name, 'application/pdf');
    await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
    return 'saved';
  }
  await sharePdf(uri, name);
  return 'shared';
}
