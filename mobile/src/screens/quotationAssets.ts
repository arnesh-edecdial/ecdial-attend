import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { QuoteAssets, QuoteTemplate } from './quotationHtml';

/**
 * The static brand images (header, terms, bank/UPI, footer) are bundled with the
 * app, so quotes render instantly and offline. They live in assets/quotation/.
 * To change one, replace the file (same name) and rebuild.
 *
 * Each template is converted to data: URIs once and kept in memory, so opening
 * a second quotation costs nothing.
 */
const SRC: Record<QuoteTemplate, Record<keyof QuoteAssets, number>> = {
  ECDIAL: {
    header: require('../../assets/quotation/ecdial_quotation_header.jpg'),
    terms: require('../../assets/quotation/ecdial_quotation_terms.jpg'),
    bank: require('../../assets/quotation/ecdial_quotation_bank.jpg'),
    footer: require('../../assets/quotation/ecdial_quotation_footer.jpg'),
  },
  DAIKIN: {
    header: require('../../assets/quotation/daikin_quotation_header.jpg'),
    terms: require('../../assets/quotation/daikin_quotation_terms.jpg'),
    bank: require('../../assets/quotation/daikin_quotation_bank.jpg'),
    footer: require('../../assets/quotation/daikin_quotation_footer.jpg'),
  },
};

const memo: Partial<Record<QuoteTemplate, Promise<QuoteAssets>>> = {};

const toDataUri = async (mod: number): Promise<string> => {
  const asset = Asset.fromModule(mod);
  if (!asset.localUri) await asset.downloadAsync();
  const b64 = await FileSystem.readAsStringAsync((asset.localUri || asset.uri) as string, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:image/jpeg;base64,${b64}`;
};

export const templateOf = (q: { quotationType?: string }): QuoteTemplate =>
  String(q?.quotationType || 'DAIKIN').toUpperCase() === 'ECDIAL' ? 'ECDIAL' : 'DAIKIN';

export const loadQuoteAssets = (t: QuoteTemplate): Promise<QuoteAssets> => {
  if (!memo[t]) {
    memo[t] = (async () => {
      const s = SRC[t];
      const [header, terms, bank, footer] = await Promise.all([
        toDataUri(s.header),
        toDataUri(s.terms),
        toDataUri(s.bank),
        toDataUri(s.footer),
      ]);
      return { header, terms, bank, footer };
    })().catch((e) => {
      delete memo[t]; // allow a retry next time
      throw e;
    });
  }
  return memo[t] as Promise<QuoteAssets>;
};
