import { mobileApi } from '../services/api';

/**
 * Low-side materials are ordinary products with category 'LOW_SIDE', so they use
 * the same API, storage and permissions as the AC catalogue. Two small markers
 * live at the start of `description` (the same trick the app already uses for
 * "[Brand: x]"):
 *   [Default]    -> pre-selected in every new quotation
 *   [Order: n]   -> position among the defaults
 * Anything after the markers is a free-text note and is preserved.
 */
export interface LowSideItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  isDefault: boolean;
  order: number;
  note: string;
  raw: any;
}

const TAG_DEFAULT = /\[Default\]\s*/i;
const TAG_ORDER = /\[Order:\s*(\d+)\]\s*/i;

export const parseLowSide = (p: any): LowSideItem => {
  const d = String(p?.description || '');
  return {
    id: String(p.id),
    name: String(p.name || ''),
    unit: p.defaultUnit || 'Nos',
    price: Number(p.defaultPrice) || 0,
    isDefault: TAG_DEFAULT.test(d),
    order: Number(TAG_ORDER.exec(d)?.[1]) || 9999,
    note: d.replace(TAG_DEFAULT, '').replace(TAG_ORDER, '').trim(),
    raw: p,
  };
};

export async function fetchLowSide(): Promise<LowSideItem[]> {
  const res = await mobileApi.listProducts('LOW_SIDE');
  if (!res?.success || !Array.isArray(res.data)) throw new Error(res?.message || 'Could not load low side items.');
  return res.data.map(parseLowSide).sort((a: LowSideItem, b: LowSideItem) => a.order - b.order || a.name.localeCompare(b.name));
}

export interface LowSideInput {
  name: string;
  unit: string;
  price: number;
  isDefault: boolean;
  order: number;
  note?: string;
}

const body = (v: LowSideInput, raw?: any) => ({
  name: v.name.trim(),
  model: raw?.model ?? null,
  brand: raw?.brand || 'Universal',
  category: 'LOW_SIDE',
  acType: raw?.acType || 'SPLIT',
  description: `${v.isDefault ? '[Default] ' : ''}[Order: ${v.order}]${v.note ? ' ' + v.note : ''}`,
  defaultPrice: v.price,
  defaultUnit: v.unit.trim() || 'Nos',
  // keep stock and anything else already stored on this item
  availableStock: raw?.availableStock ?? 0,
  specifications: raw?.specifications ?? [],
  images: raw?.images ?? [],
});

export const createLowSide = (v: LowSideInput) => mobileApi.createProduct(body(v));
export const updateLowSide = (item: LowSideItem, v: LowSideInput) => mobileApi.updateProduct(item.id, body(v, item.raw));
export const deleteLowSide = (id: string) => mobileApi.deleteProduct(id);

/** The six lines every quotation has carried so far. Offered once as a one-tap import. */
export const STANDARD_ITEMS: LowSideInput[] = [
  { name: 'Installation and testing commissioning Charges of Split ac', unit: 'Nos', price: 1500, isDefault: true, order: 1 },
  { name: 'Supply and installation of Copper Pipe', unit: 'Mtr', price: 1280, isDefault: true, order: 2 },
  { name: 'Supply and installation of Communication Cable', unit: 'Mtr', price: 290, isDefault: true, order: 3 },
  { name: 'Supply and installation of Supply Cable', unit: 'Mtr', price: 190, isDefault: true, order: 4 },
  { name: 'Supply and installation of Outdoor Stand', unit: 'Nos', price: 1450, isDefault: true, order: 5 },
  { name: 'Supply And Installation Of White Packing Tape', unit: 'Nos', price: 300, isDefault: true, order: 6 },
];

/** Library item -> quotation line (qty 1; price and qty stay editable per quotation). */
export const toQuoteItem = (it: LowSideItem, order: number) => ({
  section: 'LOW_SIDE' as const,
  itemOrder: order,
  description: it.name,
  quantity: 1,
  unit: it.unit,
  unitPrice: it.price,
  amount: it.price,
});

export const sameLine = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
