import { api } from '../../services/api';

/**
 * Saved low-side materials. Same storage trick as the mobile app (ordinary products with
 * category 'LOW_SIDE', and two markers at the start of `description`):
 *   [Default]  -> pre-selected in every new quotation of that category
 *   [Order: n] -> position among the defaults
 * NEW on the web: each item belongs to a category (acType): SPLIT, CASSETTE, DUCT, VRV
 * or ALL (usable everywhere). Items saved by the Android app have acType SPLIT.
 */
export type LowSideCategory = 'SPLIT' | 'CASSETTE' | 'DUCT' | 'VRV' | 'ALL';
export const LOW_SIDE_CATEGORIES: LowSideCategory[] = ['SPLIT', 'CASSETTE', 'DUCT', 'VRV', 'ALL'];

export interface LowSideItem {
  id: string;
  name: string;
  unit: string;
  price: number;
  isDefault: boolean;
  order: number;
  note: string;
  /** inner category (e.g. "Refrigerant piping"); kept in the description as [Group: name] */
  group: string;
  category: LowSideCategory;
  raw: any;
}

const TAG_DEFAULT = /\[Default\]\s*/i;
const TAG_ORDER = /\[Order:\s*(\d+)\]\s*/i;
const TAG_GROUP = /\[Group:\s*([^\]]*)\]\s*/i;

export const parseLowSide = (p: any): LowSideItem => {
  const d = String(p?.description || '');
  const cat = String(p?.acType || 'SPLIT').toUpperCase();
  return {
    id: String(p.id),
    name: String(p.name || ''),
    unit: p.defaultUnit || 'Nos',
    price: Number(p.defaultPrice) || 0,
    isDefault: TAG_DEFAULT.test(d),
    order: Number(TAG_ORDER.exec(d)?.[1]) || 9999,
    note: d.replace(TAG_DEFAULT, '').replace(TAG_ORDER, '').replace(TAG_GROUP, '').trim(),
    group: (TAG_GROUP.exec(d)?.[1] || '').trim(),
    category: (LOW_SIDE_CATEGORIES as string[]).includes(cat) ? (cat as LowSideCategory) : 'SPLIT',
    raw: p,
  };
};

/** Items usable in a quotation of this AC type (its own category + "ALL"). */
export const forCategory = (list: LowSideItem[], acType: string) =>
  list.filter((i) => i.category === acType || i.category === 'ALL');

export async function fetchLowSide(): Promise<LowSideItem[]> {
  // No acType filter on the request: filtering is done here so it works whatever the server does with ?acType=
  const res = await api.listProducts('LOW_SIDE');
  if (!res?.success || !Array.isArray(res.data)) throw new Error(res?.message || 'Could not load low side items.');
  return res.data
    .map(parseLowSide)
    .sort((a: LowSideItem, b: LowSideItem) => a.order - b.order || a.name.localeCompare(b.name));
}

export interface LowSideInput {
  name: string;
  unit: string;
  price: number;
  isDefault: boolean;
  order: number;
  category: LowSideCategory;
  group?: string;
  note?: string;
}

const body = (v: LowSideInput, raw?: any) => ({
  name: v.name.trim(),
  model: raw?.model ?? null,
  brand: raw?.brand || 'Universal',
  category: 'LOW_SIDE',
  acType: v.category,
  description: `${v.isDefault ? '[Default] ' : ''}[Order: ${v.order}]${v.group && v.group.trim() ? ` [Group: ${v.group.trim().replace(/[\]\[]/g, '')}]` : ''}${v.note ? ' ' + v.note : ''}`,
  defaultPrice: v.price,
  defaultUnit: v.unit.trim() || 'Nos',
  availableStock: raw?.availableStock ?? 0,
  specifications: raw?.specifications ?? [],
  images: raw?.images ?? [],
});

export const createLowSide = (v: LowSideInput) => api.createProduct(body(v));
export const updateLowSide = (item: LowSideItem, v: LowSideInput) => api.updateProduct(item.id, body(v, item.raw));
export const deleteLowSide = (id: string) => api.deleteProduct(id);

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
