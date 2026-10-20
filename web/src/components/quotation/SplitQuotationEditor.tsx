import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, BookOpen, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { CustomerItem } from '../../types';
import { extractBrand } from '../../utils/quotation/brands';
import { resolveQuotationType } from '../../utils/quotation/quotationType';
import { LowSideItem, fetchLowSide, forCategory, sameLine, toQuoteItem } from '../../utils/quotation/lowSideLibrary';
import { MachinePicker, LowSidePicker, LowSideManager } from './SplitPickers';
import { SplitQuotationPreview } from './SplitQuotationPreview';

/**
 * Split AC quotation editor (Daikin / Ec Dial).
 * Mirrors the Android create screen: same fields, same totals, same payload, so a quotation
 * made here and one made on the phone are interchangeable and print identically.
 */
interface Props {
  editQuotationId?: string | null;
  initialAcType?: string;               // kept for a drop-in replacement of QuotationEditor
  initialQuotationType?: 'DAIKIN' | 'ECDIAL';
  initialCustomer?: CustomerItem | null;
  onBack?: () => void;
  onSuccess?: () => void;
}

type Section = 'MAIN_UNIT' | 'LOW_SIDE';
type Line = {
  id?: string; productId?: string | null; section: Section; itemOrder: number; description: string;
  quantity: number; unit: string; unitPrice: number; amount: number; brand?: string | null;
};

const AC_TYPE = 'SPLIT';
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UNITS = ['Nos', 'Mtr', 'RMT', 'Sq.Mt', 'Sqft', 'Kg', 'Set', 'Lot', 'Hour', 'Service', 'Roll', 'Piece', 'Other'];

const addDays = (d: string, days: number) => {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, day || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const showDate = (d: string) => { const [y, m, day] = d.split('-'); return y && m && day ? `${day}-${m}-${y}` : d; };

/* ---- styles ---- */
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, color: '#0F172A' };
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 };
const input: React.CSSProperties = { height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px', fontSize: 14, width: '100%', background: '#fff', color: '#0F172A' };
const primary: React.CSSProperties = { height: 40, padding: '0 18px', borderRadius: 10, border: 0, background: '#0B4A86', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const ghost: React.CSSProperties = { height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

/* ---- one line item (memoised so typing in one card never re-renders the others) ---- */
const ItemRow = memo(({ section, idx, item, onChange, onRemove, onPickModel }: {
  section: Section; idx: number; item: Line;
  onChange: (s: Section, i: number, f: keyof Line, v: any) => void;
  onRemove: (s: Section, i: number) => void;
  onPickModel?: (i: number) => void;
}) => {
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unitPrice));
  useEffect(() => { if ((parseFloat(qty) || 0) !== item.quantity) setQty(String(item.quantity)); }, [item.quantity]); // eslint-disable-line
  useEffect(() => { if ((parseFloat(price) || 0) !== item.unitPrice) setPrice(String(item.unitPrice)); }, [item.unitPrice]); // eslint-disable-line
  const main = section === 'MAIN_UNIT';

  return (
    <div style={{ ...card, marginBottom: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{main ? `Machine ${idx + 1}` : `Item ${idx + 1}`}</div>
        <button onClick={() => onRemove(section, idx)} style={{ ...ghost, height: 30, color: '#B91C1C' }}><Trash2 size={13} /> Remove</button>
      </div>
      {main && onPickModel && (
        <button onClick={() => onPickModel(idx)} style={{ ...ghost, width: '100%', height: 42, marginBottom: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', justifyContent: 'flex-start' }}>
          <BookOpen size={14} /> <b style={{ color: '#0B4A86' }}>Model</b>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 500, color: item.description ? '#0F172A' : '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description || 'Choose from catalogue'}</span>
        </button>
      )}
      <textarea
        style={{ ...input, height: 'auto', minHeight: 44, padding: '9px 10px', resize: 'vertical' }}
        rows={2}
        placeholder={main ? 'Machine description' : 'Material description'}
        value={item.description}
        onChange={(e) => onChange(section, idx, 'description', e.target.value)}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: 8, marginTop: 10 }}>
        <div><span style={label}>Qty</span>
          <input style={{ ...input, textAlign: 'center' }} inputMode="decimal" value={qty} onChange={(e) => { setQty(e.target.value); onChange(section, idx, 'quantity', e.target.value); }} /></div>
        <div><span style={label}>Unit</span>
          <select style={input} value={item.unit} onChange={(e) => onChange(section, idx, 'unit', e.target.value)}>
            {(UNITS.includes(item.unit) ? UNITS : [item.unit, ...UNITS]).map((u) => <option key={u}>{u}</option>)}
          </select></div>
        <div><span style={label}>Price (₹)</span>
          <input style={{ ...input, textAlign: 'right', fontWeight: 600 }} inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value); onChange(section, idx, 'unitPrice', e.target.value); }} /></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #E2E8F0' }}>
        <span style={{ fontSize: 13, color: '#64748B' }}>Amount</span>
        <b>₹{money(item.amount)}</b>
      </div>
    </div>
  );
});

/* ---- editor ---- */
export const SplitQuotationEditor: React.FC<Props> = ({ editQuotationId, initialQuotationType = 'DAIKIN', initialCustomer = null, onBack, onSuccess }) => {
  const [quotationType, setQuotationType] = useState<'DAIKIN' | 'ECDIAL'>(initialQuotationType);
  const [includeBank, setIncludeBank] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(initialCustomer?.id || null);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.mobile || '');
  const [customerEmail, setCustomerEmail] = useState(initialCustomer?.email || '');
  const [customerAddress, setCustomerAddress] = useState(initialCustomer?.address || '');
  const [pdfName, setPdfName] = useState('');
  const [mainItems, setMainItems] = useState<Line[]>([]);
  const [hasLowSide, setHasLowSide] = useState(true);
  const [lowItems, setLowItems] = useState<Line[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [library, setLibrary] = useState<LowSideItem[] | null>(null);
  const [loaded, setLoaded] = useState(!editQuotationId);

  const [machineOpen, setMachineOpen] = useState(false);
  const [activeMachine, setActiveMachine] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<string | null>(editQuotationId || null);
  const [savedQuote, setSavedQuote] = useState<any>(null);
  const [existingDate, setExistingDate] = useState<string | null>(null);
  const lowTouched = useRef(false);

  /* catalogue + low side library */
  const loadMachines = useCallback(async () => {
    try { const r = await api.listProducts('MAIN_UNIT'); if (r.success) setMachines(r.data); } catch (e) { console.error('catalogue', e); }
  }, []);
  useEffect(() => { loadMachines(); }, [loadMachines]);
  const loadLibrary = useCallback(async () => {
    try { setLibrary(await fetchLowSide()); } catch (e) { console.warn('[Low side library]', e); setLibrary([]); }
  }, []);
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  /* edit an existing quotation */
  useEffect(() => {
    if (!editQuotationId) return;
    (async () => {
      try {
        const r = await api.getQuotationById(editQuotationId);
        if (r.success) {
          const q = r.data;
          setQuotationType(resolveQuotationType(q));
          setIncludeBank(q.includeBankDetails !== false);
          setCustomerId(q.customerId || null);
          setCustomerName(q.customerName || '');
          setCustomerPhone(q.customerPhone || '');
          setCustomerEmail(q.customerEmail || '');
          setCustomerAddress(q.customerAddress || '');
          setPdfName(q.pdfName || '');
          setHasLowSide(Boolean(q.hasLowSide));
          setExistingDate(q.date || null);
          const items: Line[] = Array.isArray(q.items) ? q.items : [];
          setMainItems(items.filter((i) => i.section === 'MAIN_UNIT'));
          setLowItems(items.filter((i) => i.section === 'LOW_SIDE'));
          lowTouched.current = true;
        }
      } catch (e: any) { setError(e?.message || 'Could not load the quotation.'); } finally { setLoaded(true); }
    })();
  }, [editQuotationId]);

  /* defaults: only items flagged "default" for SPLIT (or All types) are pre-filled on a new quotation */
  useEffect(() => {
    if (editQuotationId || lowTouched.current || !library) return;
    const defs = forCategory(library, AC_TYPE).filter((i) => i.isDefault);
    if (defs.length) setLowItems(defs.map((i, k) => toQuoteItem(i, k + 1)) as Line[]);
  }, [library, editQuotationId]);

  /* handlers */
  const updateItem = useCallback((section: Section, idx: number, field: keyof Line, val: any) => {
    const apply = (list: Line[]) => {
      const next = [...list];
      const it = { ...next[idx] };
      if (field === 'quantity') { const q = parseFloat(val) || 0; it.quantity = q; it.amount = round2(q * it.unitPrice); }
      else if (field === 'unitPrice') { const p = parseFloat(val) || 0; it.unitPrice = p; it.amount = round2(it.quantity * p); }
      else if (field === 'description') it.description = val;
      else if (field === 'unit') it.unit = val;
      next[idx] = it;
      return next;
    };
    if (section === 'LOW_SIDE') { lowTouched.current = true; setLowItems(apply); } else setMainItems(apply);
  }, []);

  const removeItem = useCallback((section: Section, idx: number) => {
    if (section === 'LOW_SIDE') { lowTouched.current = true; setLowItems((c) => c.filter((_, i) => i !== idx)); }
    else setMainItems((c) => c.filter((_, i) => i !== idx));
  }, []);

  const addMain = () => setMainItems((c) => [...c, { section: 'MAIN_UNIT', itemOrder: c.length + 1, description: '', quantity: 1, unit: 'Nos', unitPrice: 0, amount: 0 }]);
  const addCustomLow = () => { lowTouched.current = true; setLowItems((c) => [...c, { section: 'LOW_SIDE', itemOrder: c.length + 1, description: '', quantity: 1, unit: 'Mtr', unitPrice: 0, amount: 0 }]); };

  const pickModel = useCallback((idx: number) => { setActiveMachine(idx); setMachineOpen(true); }, []);
  const selectMachine = (m: any) => {
    const description = `${m.name} (${m.model || m.name})`;
    const price = Number(m.defaultPrice) || 0;
    const unit = m.defaultUnit || 'Nos';
    const brand = extractBrand(m);
    setMainItems((cur) => {
      const list = [...cur];
      if (activeMachine >= list.length) list.push({ section: 'MAIN_UNIT', itemOrder: list.length + 1, description, quantity: 1, unit, unitPrice: price, amount: price, brand, productId: m.id });
      else { const it = { ...list[activeMachine], description, unitPrice: price, unit, brand, productId: m.id }; it.amount = round2(it.quantity * price); list[activeMachine] = it; }
      return list;
    });
    setMachineOpen(false);
  };
  const addMachineFromCatalogue = () => { setActiveMachine(mainItems.length); setMachineOpen(true); };

  const applyLow = (add: LowSideItem[], removeNames: string[]) => {
    lowTouched.current = true;
    setLowItems((cur) =>
      [...cur.filter((x) => !removeNames.some((n) => sameLine(n, x.description))), ...(add.map((i) => toQuoteItem(i, 0)) as Line[])]
        .map((x, i) => ({ ...x, itemOrder: i + 1 }))
    );
    setPickerOpen(false);
  };

  /* totals (same rule as the app: 9% + 9%) */
  const mainTotal = mainItems.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const lowTotal = hasLowSide ? lowItems.reduce((a, i) => a + (Number(i.amount) || 0), 0) : 0;
  const subtotal = round2(mainTotal + lowTotal);
  const cgst = round2((subtotal * 9) / 100);
  const sgst = round2((subtotal * 9) / 100);
  const grand = round2(subtotal + cgst + sgst);

  const today = new Date().toISOString().slice(0, 10);
  const validTill = showDate(addDays(existingDate || today, 10));
  const lowNames = useMemo(() => lowItems.map((i) => i.description), [lowItems]);

  const save = async () => {
    setError(''); setWarnings([]);
    if (mainItems.length === 0) { setError('Add at least one machine.'); return; }
    setSaving(true);
    const all = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT', itemOrder: idx + 1 })),
      ...(hasLowSide ? lowItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE', itemOrder: idx + 1 })) : []),
    ];
    const safe = customerName ? customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'Customer';
    const typed = pdfName.trim().replace(/^(ECDIAL|DAIKIN)(?=_)/i, quotationType);
    const payload = {
      customerId: customerId || undefined,
      customerName: customerName.trim(),
      customerAddress: customerAddress.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || undefined,
      quotationType,
      acType: AC_TYPE,
      includeBankDetails: includeBank,
      hasLowSide,
      items: all,
      cgstPercent: 9,
      sgstPercent: 9,
      status: 'FINAL',
      pdfName: typed || `${quotationType}_Quotation_${safe}`,
    };
    try {
      const res = savedId ? await api.updateQuotation(savedId, payload) : await api.createQuotation(payload);
      if (res.success) {
        setSavedId(res.data?.id || savedId);
        if (res.stockWarnings?.length) setWarnings(res.stockWarnings);
        setSavedQuote(res.data);
      } else setError(res.message || 'Failed to save quotation');
    } catch (e: any) { setError(e?.message || 'Failed to save quotation'); } finally { setSaving(false); }
  };

  const segBtn = (t: 'ECDIAL' | 'DAIKIN'): React.CSSProperties => ({
    flex: 1, height: 36, border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: quotationType === t ? 800 : 500,
    background: quotationType === t ? '#fff' : 'transparent', boxShadow: quotationType === t ? '0 1px 3px rgba(0,0,0,.15)' : 'none', color: '#0F172A',
  });
  const secHead = (letter: string, title: string, right?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '22px 0 8px' }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, background: '#0B4A86', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 }}>{letter}</span>
      <b style={{ flex: 1, textTransform: 'uppercase', fontSize: 13, color: '#334155', letterSpacing: 0.4 }}>{title}</b>
      {right}
    </div>
  );

  if (!loaded) return <div style={{ padding: 24, color: '#64748B' }}>Loading quotation…</div>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {onBack && !editQuotationId && <button style={ghost} onClick={onBack}><ArrowLeft size={14} /> Back</button>}
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, flex: 1 }}>{savedId ? 'Edit Split Quotation' : 'New Split Quotation'}</h2>
      </div>

      <div style={{ display: 'flex', padding: 2, borderRadius: 10, background: '#E2E8F0' }}>
        <button style={segBtn('ECDIAL')} onClick={() => setQuotationType('ECDIAL')}>Ec Dial</button>
        <button style={segBtn('DAIKIN')} onClick={() => setQuotationType('DAIKIN')}>Daikin</button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 6 }}>Split AC quotation</div>

      {/* Customer */}
      <div style={{ ...label, margin: '22px 4px 8px' }}>Customer</div>
      <div style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={label}>Name</span><input style={input} placeholder="Optional" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div><span style={label}>Phone</span><input style={input} placeholder="Optional" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
        </div>
        <div><span style={label}>Address</span><textarea style={{ ...input, height: 'auto', padding: '9px 10px' }} rows={2} placeholder="Optional" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><span style={label}>Email</span><input style={input} placeholder="Optional" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
          <div><span style={label}>PDF name</span>
            <input style={input} placeholder={customerName ? `${customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_Quotation` : 'Customer_Quotation'} value={pdfName} onChange={(e) => setPdfName(e.target.value)} /></div>
        </div>
        <div style={{ fontSize: 12, color: '#64748B' }}>The PDF name is saved and reused every time you download or share.</div>
      </div>

      {/* Options */}
      <div style={{ ...label, margin: '22px 4px 8px' }}>Options</div>
      <div style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Valid till <small style={{ color: '#64748B' }}>(10 days from the quotation date)</small></span><b>{validTill}</b></div>
        <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span>Include bank details</span>
          <input type="checkbox" checked={includeBank} onChange={(e) => setIncludeBank(e.target.checked)} style={{ width: 18, height: 18 }} />
        </label>
      </div>

      {/* A */}
      {secHead('A', 'Main unit', <>
        <button style={ghost} onClick={addMachineFromCatalogue}><BookOpen size={14} /> Add from catalogue</button>
        <button style={ghost} onClick={addMain}><Plus size={14} /> Blank machine</button>
      </>)}
      {mainItems.length === 0
        ? <div style={{ ...card, textAlign: 'center', color: '#64748B' }}>No machines yet. Tap “Add from catalogue”.</div>
        : mainItems.map((it, i) => <ItemRow key={i} section="MAIN_UNIT" idx={i} item={it} onChange={updateItem} onRemove={removeItem} onPickModel={pickModel} />)}

      {/* B */}
      {secHead('B', 'Low side', (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={hasLowSide} onChange={(e) => setHasLowSide(e.target.checked)} style={{ width: 18, height: 18 }} /> Include
        </label>
      ))}
      {hasLowSide && (
        <>
          {lowItems.length === 0
            ? <div style={{ ...card, textAlign: 'center', color: '#64748B' }}>No low side items. Add from your saved list.</div>
            : lowItems.map((it, i) => <ItemRow key={i} section="LOW_SIDE" idx={i} item={it} onChange={updateItem} onRemove={removeItem} />)}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <button style={{ ...ghost, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0B4A86' }} onClick={() => setPickerOpen(true)}><Plus size={14} /> From saved items</button>
            <button style={ghost} onClick={addCustomLow}>Custom line</button>
            <button style={ghost} onClick={() => setManageOpen(true)}>Manage saved list</button>
          </div>
        </>
      )}

      {/* Summary */}
      <div style={{ ...label, margin: '22px 4px 8px' }}>Summary</div>
      <div style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sub total</span><span>₹{money(subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>CGST 9%</span><span>₹{money(cgst)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SGST 9%</span><span>₹{money(sgst)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, borderTop: '1px solid #E2E8F0', paddingTop: 8 }}><span>Total</span><span>₹{money(grand)}</span></div>
      </div>

      {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 14 }}>{error}</div>}
      {warnings.length > 0 && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#FFFBEB', color: '#92400E', fontSize: 13 }}>{warnings.map((w, i) => <div key={i}>{w}</div>)}</div>}

      <div style={{ position: 'sticky', bottom: 0, marginTop: 18, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 -4px 16px rgba(15,23,42,.06)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>Total incl. GST</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>₹{money(grand)}</div>
        </div>
        <button style={{ ...primary, opacity: saving ? 0.6 : 1, minWidth: 170 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Preview PDF'}</button>
      </div>

      <MachinePicker isOpen={machineOpen} machines={machines} acType={AC_TYPE} currentDescription={mainItems[activeMachine]?.description || ''} onSelect={selectMachine} onClose={() => setMachineOpen(false)} onChanged={loadMachines} />
      <LowSidePicker isOpen={pickerOpen} library={library} acType={AC_TYPE} currentDescriptions={lowNames} onApply={applyLow}
        onManage={() => { setPickerOpen(false); setTimeout(() => setManageOpen(true), 150); }} onClose={() => setPickerOpen(false)} />
      <LowSideManager isOpen={manageOpen} library={library} defaultCategory={AC_TYPE} onChanged={loadLibrary} onClose={() => setManageOpen(false)} />

      <SplitQuotationPreview
        isOpen={!!savedQuote}
        quotation={savedQuote}
        onClose={() => { setSavedQuote(null); onSuccess?.(); }}
        onEdit={() => setSavedQuote(null)}
      />
    </div>
  );
};
