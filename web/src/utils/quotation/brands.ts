export const BRANDS = [
  'Daikin', 'Mitsubishi', 'LG', 'Godrej', 'Voltas', 'Panasonic',
  'Carrier', 'Blue Star', 'Hitachi', 'O General', 'Lloyd', 'Samsung',
];

/** Same brand rule as the mobile catalogueShared.extractBrand. */
export const extractBrand = (item: any): string => {
  if (item?.brand) return item.brand;
  const m = item?.description?.match(/\[Brand:\s*([^\]]+)\]/i);
  if (m) return m[1].trim();
  const full = `${item?.name || ''} ${item?.model || ''} ${item?.description || ''}`.toLowerCase();
  for (const b of BRANDS) if (full.includes(b.toLowerCase())) return b;
  return item?.category === 'LOW_SIDE' ? 'Universal' : 'Other';
};
