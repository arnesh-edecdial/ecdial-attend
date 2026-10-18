import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { QuoteAssets, QuoteTemplate } from './quotationHtml';
import { resolveQuotationType } from './quotationType';

/**
 * The static brand images (header, terms, bank/UPI, footer) are bundled with the
 * app, so quotes render instantly and offline. They live in assets/quotation/.
 * To change one, replace the file (same name) and rebuild.
 *
 * Each template is converted to data: URIs once and kept in memory, so opening
 * a second quotation costs nothing.
 */
const SRC: Record<QuoteTemplate, Record<'header' | 'terms' | 'bank' | 'footer', number>> = {
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

const toDataUri = async (mod: number, mime = 'image/jpeg'): Promise<string> => {
  const asset = Asset.fromModule(mod);
  if (!asset.localUri) await asset.downloadAsync();
  const b64 = await FileSystem.readAsStringAsync((asset.localUri || asset.uri) as string, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${b64}`;
};

export const templateOf = (q: any): QuoteTemplate => resolveQuotationType(q);

/** Brand logos for the "Authorized Sales & Service Dealer" strip (from assets/brands). */
const LOGO_SRC: Record<string, number> = {
  DAIKIN: require('../../assets/brands/daikin.png'),
  MITSUBISHI: require('../../assets/brands/mitsubishi.png'),
  LG: require('../../assets/brands/lg.png'),
  GENERAL: require('../../assets/brands/general.png'),
  GODREJ: require('../../assets/brands/godrej.png'),
  BLUESTAR: require('../../assets/brands/bluestar.png'),
  ONIDA: require('../../assets/brands/onida.png'),
};
const logoMemo: Record<string, Promise<string | null>> = {};

/** Loads only the logos a quotation needs; a logo that fails to load is skipped, never fatal. */
export async function loadBrandLogos(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    keys.map(async (k) => {
      if (!LOGO_SRC[k]) return;
      if (!logoMemo[k]) logoMemo[k] = toDataUri(LOGO_SRC[k], 'image/png').catch(() => null);
      const uri = await logoMemo[k];
      if (uri) out[k] = uri;
    })
  );
  return out;
}

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
