import { mobileApi, getAuthToken, getActiveEmployeeId } from '../services/api';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
export const BRANDS = [
  'Daikin', 'Mitsubishi', 'LG', 'Godrej', 'Voltas', 'Panasonic',
  'Carrier', 'Blue Star', 'Hitachi', 'O General', 'Lloyd', 'Samsung',
];
export const AC_TYPES = ['SPLIT', 'CASSETTE', 'DUCT', 'VRV'];

// iOS-style palette
export const C = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  label: '#1C1C1E',
  sub: '#8E8E93',
  line: '#D1D1D6',
  fill: '#E9E9EB',
  head: '#F7F7FA',
  blue: '#007AFF',
  blueSoft: '#E5F0FF',
  red: '#FF3B30',
};

/* ------------------------------------------------------------------ */
/* Spec table model                                                    */
/* A table is a matrix: columns = IDU/ODU models, rows = attributes.   */
/* ------------------------------------------------------------------ */
export type MetricKey = 'coolingCapacity' | 'iseerRating' | 'annualPowerConsumption' | 'iduColour';

export const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'coolingCapacity', label: 'Rated Cooling Capacity', unit: 'kW' },
  { key: 'iseerRating', label: 'ISEER Rating', unit: 'Wh/Wh' },
  { key: 'annualPowerConsumption', label: 'Rated Annual Power Consumption', unit: 'kWh' },
  { key: 'iduColour', label: 'IDU Colour', unit: '' },
];

export interface SpecColumn { id: string; idu: string; odu: string }
export interface SpecRow {
  id: string;
  label: string;
  unit: string;
  key?: MetricKey; // maps to the 4 legacy metric fields so the old server PDF keeps working
  values: Record<string, string>; // columnId -> value
}
export interface SpecTable { id: string; title: string; columns: SpecColumn[]; rows: SpecRow[] }

let seq = 0;
export const uid = (p = 'x') => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const newTable = (): SpecTable => ({
  id: uid('t'),
  title: '',
  columns: [{ id: uid('c'), idu: '', odu: '' }],
  rows: METRICS.map((m) => ({ id: uid('r'), label: m.label, unit: m.unit, key: m.key, values: {} })),
});

/**
 * Stored format == the existing "IDU/ODU combination" format (one object per
 * column) plus `tableId` / `tableTitle`, so anything that already reads
 * `product.specifications` (server PDF, search) keeps working.
 * Old records without tableId load as ONE table with every combo as a column.
 */
export function specsToTables(specs: any): SpecTable[] {
  if (!Array.isArray(specs) || specs.length === 0) return [];

  const groups = new Map<string, any[]>();
  for (const c of specs) {
    if (!c || typeof c !== 'object') continue;
    const gid = c.tableId || '__legacy';
    const arr = groups.get(gid);
    if (arr) arr.push(c);
    else groups.set(gid, [c]);
  }

  const tables: SpecTable[] = [];
  groups.forEach((combos, gid) => {
    const columns: SpecColumn[] = combos.map((c) => ({
      id: String(c.id || uid('c')),
      idu: String(c.iduModel || ''),
      odu: String(c.oduModel || ''),
    }));
    const rows: SpecRow[] = [];

    METRICS.forEach((m) => {
      if (combos.some((c) => String(c[m.key] || '').trim())) {
        const values: Record<string, string> = {};
        combos.forEach((c, i) => { values[columns[i].id] = String(c[m.key] || ''); });
        // unit is already inside the stored value ("3.52 kW")
        rows.push({ id: uid('r'), label: m.label, unit: '', key: m.key, values });
      }
    });

    const byKey = new Map<string, SpecRow>();
    combos.forEach((c, i) => {
      (Array.isArray(c.specRows) ? c.specRows : []).forEach((r: any) => {
        const label = String(r?.attribute || '').trim();
        if (!label) return;
        const unit = String(r?.unit || '').trim();
        const k = `${label.toLowerCase()}|${unit.toLowerCase()}`;
        let row = byKey.get(k);
        if (!row) {
          row = { id: uid('r'), label, unit, values: {} };
          byKey.set(k, row);
          rows.push(row);
        }
        row.values[columns[i].id] = String(r?.value || '');
      });
    });

    tables.push({
      id: gid === '__legacy' ? uid('t') : gid,
      title: String(combos[0]?.tableTitle || ''),
      columns,
      rows,
    });
  });
  return tables;
}

export function tablesToSpecs(tables: SpecTable[]): any[] {
  const out: any[] = [];
  tables.forEach((t) => {
    const rows = t.rows.filter((r) => r.label.trim());
    if (!t.columns.length || !rows.length) return;
    t.columns.forEach((col) => {
      const combo: any = {
        id: col.id,
        tableId: t.id,
        tableTitle: t.title.trim(),
        iduModel: col.idu.trim(),
        oduModel: col.odu.trim(),
        coolingCapacity: '',
        iseerRating: '',
        annualPowerConsumption: '',
        iduColour: '',
        specRows: [],
      };
      rows.forEach((r) => {
        const v = (r.values[col.id] || '').trim();
        if (!v) return;
        const unit = r.unit.trim();
        if (r.key) {
          combo[r.key] = unit && !v.toLowerCase().includes(unit.toLowerCase()) ? `${v} ${unit}` : v;
        } else {
          combo.specRows.push({ id: r.id, attribute: r.label.trim(), unit, value: v });
        }
      });
      out.push(combo);
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Product helpers                                                     */
/* ------------------------------------------------------------------ */
export const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

export const extractBrand = (item: any): string => {
  if (item?.brand) return item.brand;
  const m = item?.description?.match(/\[Brand:\s*([^\]]+)\]/i);
  if (m) return m[1].trim();
  const full = `${item?.name || ''} ${item?.model || ''} ${item?.description || ''}`.toLowerCase();
  for (const b of BRANDS) if (full.includes(b.toLowerCase())) return b;
  return item?.category === 'LOW_SIDE' ? 'Universal' : 'Other';
};

export const authHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const emp = getActiveEmployeeId();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(emp ? { 'x-employee-id': emp } : {}),
  };
};

export const productImages = (p: any): any[] =>
  Array.isArray(p?.images) && p.images.length
    ? p.images
    : p?.imageUrl
    ? [{ id: 'legacy', imageUrl: p.imageUrl }]
    : [];

/** Signed/public URL when present; otherwise the authenticated storage URL. */
export const imgSource = (img: any): { uri: string; headers?: Record<string, string> } => {
  const direct = img?.signedUrl || img?.imageUrl;
  if (direct) return { uri: direct };
  if (img?.storageFileName) {
    return { uri: mobileApi.getProductImageUrl(img.storageFileName), headers: authHeaders() };
  }
  return { uri: '' };
};

/** Uploaded PDF if one is linked, otherwise the server-generated spec PDF. Always sends auth. */
export const pdfRequest = (p: any) => {
  const base = `Catalogue_${extractBrand(p)}_${p.model || p.name}`.replace(/[^\w\-]+/g, '_');
  const url = p.catalogueDocId
    ? mobileApi.getCataloguePdfUrl(p.catalogueDocId, base)
    : mobileApi.getProductCataloguePdfUrl(p.id, `${base}.pdf`);
  return {
    url,
    rawFilename: base,
    extension: 'pdf',
    mimeType: 'application/pdf',
    headers: authHeaders(),
  };
};
