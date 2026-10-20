import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, BookOpen, ArrowLeft, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import { CustomerItem } from '../../types';
import { extractBrand } from '../../utils/quotation/brands';
import { resolveQuotationType } from '../../utils/quotation/quotationType';
import { LowSideItem, fetchLowSide, forCategory, sameLine } from '../../utils/quotation/lowSideLibrary';
import { CASSETTE_DEFAULTS } from '../../utils/quotation/cassetteHtml';
import { MachinePicker, LowSidePicker, LowSideManager } from './SplitPickers';
import { SplitQuotationPreview } from './SplitQuotationPreview';

/**
 * Cassette AC quotation editor (Daikin / Ec Dial), web only.
 *
 *  A  Main units / high-side  : qty x supply rate
 *  B  Low-side works          : qty x supply rate  +  qty x installation rate (shown in separate columns)
 *  C  Customer scope, D Requirements before commissioning, E Terms (+ payment schedule)
 *     -> text blocks, one item per line, seeded from QuotationPreset (acType CASSETTE + brand)
 *  F  Bank details            : static (see BANK_DETAILS in cassetteHtml.ts)
 *
 * The amounts and totals that get printed are the ones the backend returns after saving.
 */
interface Props {
  editQuotationId?: string | null;
  initialAcType?: string;
  initialQuotationType?: 'DAIKIN' | 'ECDIAL';
  initialCustomer?: CustomerItem | null;
  onBack?: () => void;
  onSuccess?: () => void;
}

type Section = 'MAIN_UNIT' | 'LOW_SIDE';
type Line = {
  id?: string; productId?: string | null; section: Section; itemOrder: number; description: string;
  quantity: number; unit: string; supplyRate: number; installRate: number; brand?: string | null;
};
type BlockKey = 'scope' | 'req' | 'terms' | 'payment';

const AC_TYPE = 'CASSETTE';
const OFFER_TYPES = ['Supply and Installation', 'Supply only', 'Installation only'];
const UNITS = ['Nos', 'Mtr', 'RMT', 'Sq.Mt', 'Sqft', 'Kg', 'Set', 'Lot', 'Hour', 'Service', 'Roll', 'Piece', 'Other'];
const BLOCK_DEFAULTS: Record<BlockKey, string> = {
  scope: CASSETTE_DEFAULTS.scope, req: CASSETTE_DEFAULTS.requirements,
  terms: CASSETTE_DEFAULTS.terms, payment: CASSETTE_DEFAULTS.payment,
};

const num = (v: any) => Number(v) || 0;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const addDays = (d: string, days: number) => {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, day || 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const showDate = (d: string) => { const [y, m, day] = d.split('-'); return y && m && day ? `${day}-${m}-${y}` : d; };

/** Which text block does a saved preset belong to? (matches on its presetType name) */
const bucketOf = (p: any): BlockKey | null => {
  const t = String(p?.presetType || '').toUpperCase();
  if (/SCOPE|EXCLUS/.test(t)) return 'scope';
  if (/COMMISSION|REQUIRE/.test(t)) return 'req';
  if (/PAYMENT/.test(t)) return 'payment';
  if (/TERM/.test(t)) return 'terms';
  return null;
};

/** Saved-library item -> Cassette low-side line. Uses the item's own supply / install rates when it has them. */
const toLowLine = (it: LowSideItem, order: number): Line => {
  const sr = num(it.raw?.defaultSupplyRate);
  const ir = num(it.raw?.defaultInstallRate);
  const split = sr > 0 || ir > 0;
  return { section: 'LOW_SIDE', itemOrder: order, description: it.name, quantity: 1, unit: it.unit, supplyRate: split ? sr : it.price, installRate: split ? ir : 0 };
};

/** Saved quotation item -> editor line. */
const fromSaved = (it: any): Line => {
  const sr = num(it.supplyRate);
  const ir = num(it.installRate);
  const main = it.section === 'MAIN_UNIT';
  return {
    id: it.id, productId: it.productId || null, section: main ? 'MAIN_UNIT' : 'LOW_SIDE', itemOrder: it.itemOrder || 0,
    description: it.description || '', quantity: num(it.quantity) || 1, unit: it.unit || 'Nos', brand: it.brand || null,
    supplyRate: main ? (sr > 0 ? sr : num(it.unitPrice)) : (sr > 0 || ir > 0 ? sr : num(it.unitPrice)),
    installRate: main ? 0 : ir,
  };
};

/* ---- styles ---- */
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, color: '#0F172A' };
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 };
const input: React.CSSProperties = { height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px', fontSize: 14, width: '100%', background: '#fff', color: '#0F172A' };
const primary: React.CSSProperties = { height: 40, padding: '0 18px', borderRadius: 10, border: 0, background: '#0B4A86', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const ghost: React.CSSProperties = { height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

/* ---- one line item (memoised so typing in one card never re-renders the others) ---- */
const CassetteRow = memo(({ section, idx, item, onChange, onRemove, onPickModel }: {
  section: Section; idx: number; item: Line;
  onChange: (s: Section, i: number, f: 'description' | 'unit' | 'quantity' | 'supplyRate' | 'installRate', v: any) => void;
  onRemove: (s: Section, i: number) => void;
  onPickModel?: (i: number) => void;
}) => {
  const [qty, setQty] = useState(String(item.quantity));
  const [sup, setSup] = useState(String(item.supplyRate));
  const [ins, setIns] = useState(String(item.installRate));
  useEffect(() => { if ((parseFloat(qty) || 0) !== item.quantity) setQty(String(item.quantity)); }, [item.quantity]); // eslint-disable-line
  useEffect(() => { if ((parseFloat(sup) || 0) !== item.supplyRate) setSup(String(item.supplyRate)); }, [item.supplyRate]); // eslint-disable-line
  useEffect(() => { if ((parseFloat(ins) || 0) !== item.installRate) setIns(String(item.installRate)); }, [item.installRate]); // eslint-disable-line
  const main = section === 'MAIN_UNIT';
  const supplyAmt = round2(item.quantity * item.supplyRate);
  const installAmt = round2(item.quantity * item.installRate);

  return (
    <div style={{ ...card, marginBottom: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{main ? `Equipment ${idx + 1}` : `Work item ${idx + 1}`}</div>
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
        placeholder={main ? 'Equipment / model description' : 'Work description / specification'}
        value={item.description}
        onChange={(e) => onChange(section, idx, 'description', e.target.value)}
      />
      <div style={{ display: 'grid', gridTemplateColumns: main ? '1fr 1fr 1.6fr' : '1fr 1fr 1.3fr 1.3fr', gap: 8, marginTop: 10 }}>
        <div><span style={label}>Qty</span>
          <input style={{ ...input, textAlign: 'center' }} inputMode="decimal" value={qty} onChange={(e) => { setQty(e.target.value); onChange(section, idx, 'quantity', e.target.value); }} /></div>
        <div><span style={label}>Unit</span>
          <select style={input} value={item.unit} onChange={(e) => onChange(section, idx, 'unit', e.target.value)}>
            {(UNITS.includes(item.unit) ? UNITS : [item.unit, ...UNITS]).map((u) => <option key={u}>{u}</option>)}
          </select></div>
        <div><span style={label}>Supply rate (₹)</span>
          <input style={{ ...input, textAlign: 'right', fontWeight: 600 }} inputMode="decimal" value={sup} onChange={(e) => { setSup(e.target.value); onChange(section, idx, 'supplyRate', e.target.value); }} /></div>
        {!main && (
          <div><span style={label}>Install rate (₹)</span>
            <input style={{ ...input, textAlign: 'right', fontWeight: 600 }} inputMode="decimal" value={ins} onChange={(e) => { setIns(e.target.value); onChange(section, idx, 'installRate', e.target.value); }} /></div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid #E2E8F0', fontSize: 13 }}>
        {main ? (
          <><span style={{ color: '#64748B' }}>Amount</span><b>₹{money(supplyAmt)}</b></>
        ) : (
          <>
            <span style={{ color: '#64748B' }}>Supply <b style={{ color: '#0F172A' }}>₹{money(supplyAmt)}</b></span>
            <span style={{ color: '#64748B' }}>Installation <b style={{ color: '#0F172A' }}>₹{money(installAmt)}</b></span>
            <span style={{ color: '#64748B' }}>Line total <b style={{ color: '#0F172A' }}>₹{money(supplyAmt + installAmt)}</b></span>
          </>
        )}
      </div>
    </div>
  );
});

/* ---- editor ---- */
export const CassetteQuotationEditor: React.FC<Props> = ({ editQuotationId, initialQuotationType = 'DAIKIN', initialCustomer = null, onBack, onSuccess }) => {
  const [quotationType, setQuotationType] = useState<'DAIKIN' | 'ECDIAL'>(initialQuotationType);
  const [includeBank, setIncludeBank] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(initialCustomer?.id || null);
  const [customerName, setCustomerName] = useState(initialCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(initialCustomer?.mobile || '');
  const [customerEmail, setCustomerEmail] = useState(initialCustomer?.email || '');
  const [customerAddress, setCustomerAddress] = useState(initialCustomer?.address || '');
  const [pdfName, setPdfName] = useState('');

  const [systemDesignation, setSystemDesignation] = useState(initialQuotationType === 'ECDIAL' ? 'ECDIAL Cassette' : 'Daikin Cassette');
  const [totalCapacity, setTotalCapacity] = useState('');
  const [offerType, setOfferType] = useState(OFFER_TYPES[0]);
  const designationTouched = useRef(false);

  const [mainItems, setMainItems] = useState<Line[]>([]);
  const [hasLowSide, setHasLowSide] = useState(true);
  const [lowItems, setLowItems] = useState<Line[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [library, setLibrary] = useState<LowSideItem[] | null>(null);
  const [loaded, setLoaded] = useState(!editQuotationId);

  const [blocks, setBlocks] = useState<Record<BlockKey, string>>({ ...BLOCK_DEFAULTS });
  const dirty = useRef<Record<BlockKey, boolean>>({ scope: false, req: false, terms: false, payment: false });
  const presetText = useRef<Partial<Record<BlockKey, string>>>({});

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
  useEffect(() => {
    (async () => {
      try { const r = await api.listProducts('MAIN_UNIT'); if (r.success) setMachines(r.data); } catch (e) { console.error('catalogue', e); }
    })();
  }, []);
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
          if (q.systemDesignation) { setSystemDesignation(q.systemDesignation); designationTouched.current = true; }
          setTotalCapacity(q.totalCapacity || '');
          setOfferType(q.offerType || OFFER_TYPES[0]);
          setBlocks({ scope: q.scopeExclusions || '', req: q.commissioningReqs || '', terms: q.termsAndConditions || '', payment: q.paymentMethod || '' });
          dirty.current = { scope: true, req: true, terms: true, payment: true }; // saved text is never overwritten by presets
          const items: any[] = Array.isArray(q.items) ? q.items : [];
          setMainItems(items.filter((i) => i.section === 'MAIN_UNIT').map(fromSaved));
          setLowItems(items.filter((i) => i.section === 'LOW_SIDE').map(fromSaved));
          lowTouched.current = true;
        }
      } catch (e: any) { setError(e?.message || 'Could not load the quotation.'); } finally { setLoaded(true); }
    })();
  }, [editQuotationId]);

  /* brand switch changes the default system designation (until the user types their own) */
  useEffect(() => {
    if (!designationTouched.current) setSystemDesignation(quotationType === 'ECDIAL' ? 'ECDIAL Cassette' : 'Daikin Cassette');
  }, [quotationType]);

  /* terms / scope / requirements / payment: presets for CASSETTE + this brand, built-in text if none exist */
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    (async () => {
      const found: Partial<Record<BlockKey, string>> = {};
      try {
        const r = await api.listPresets(undefined, AC_TYPE, quotationType);
        if (r?.success && Array.isArray(r.data)) {
          for (const p of r.data) { const k = bucketOf(p); if (k && !found[k] && p.content) found[k] = String(p.content); }
        }
      } catch (e) { console.warn('[Presets]', e); }
      if (!alive) return;
      presetText.current = found;
      setBlocks((cur) => {
        const next = { ...cur };
        (Object.keys(BLOCK_DEFAULTS) as BlockKey[]).forEach((k) => { if (!dirty.current[k]) next[k] = found[k] ?? BLOCK_DEFAULTS[k]; });
        return next;
      });
    })();
    return () => { alive = false; };
  }, [loaded, quotationType]);

  const setBlock = (k: BlockKey, v: string) => { dirty.current[k] = true; setBlocks((c) => ({ ...c, [k]: v })); };
  const resetBlock = (k: BlockKey) => { dirty.current[k] = false; setBlocks((c) => ({ ...c, [k]: presetText.current[k] ?? BLOCK_DEFAULTS[k] })); };

  /* defaults: only items flagged "default" for CASSETTE (or All types) are pre-filled on a new quotation */
  useEffect(() => {
    if (editQuotationId || lowTouched.current || !library) return;
    const defs = forCategory(library, AC_TYPE).filter((i) => i.isDefault);
    if (defs.length) setLowItems(defs.map((i, k) => toLowLine(i, k + 1)));
  }, [library, editQuotationId]);

  /* handlers */
  const updateItem = useCallback((section: Section, idx: number, field: 'description' | 'unit' | 'quantity' | 'supplyRate' | 'installRate', val: any) => {
    const apply = (list: Line[]) => {
      const next = [...list];
      const it = { ...next[idx] };
      if (field === 'description') it.description = val;
      else if (field === 'unit') it.unit = val;
      else it[field] = parseFloat(val) || 0;
      next[idx] = it;
      return next;
    };
    if (section === 'LOW_SIDE') { lowTouched.current = true; setLowItems(apply); } else setMainItems(apply);
  }, []);

  const removeItem = useCallback((section: Section, idx: number) => {
    if (section === 'LOW_SIDE') { lowTouched.current = true; setLowItems((c) => c.filter((_, i) => i !== idx)); }
    else setMainItems((c) => c.filter((_, i) => i !== idx));
  }, []);

  const blank = (section: Section, order: number, unit: string): Line => ({ section, itemOrder: order, description: '', quantity: 1, unit, supplyRate: 0, installRate: 0 });
  const addMain = () => setMainItems((c) => [...c, blank('MAIN_UNIT', c.length + 1, 'Nos')]);
  const addCustomLow = () => { lowTouched.current = true; setLowItems((c) => [...c, blank('LOW_SIDE', c.length + 1, 'Nos')]); };

  const pickModel = useCallback((idx: number) => { setActiveMachine(idx); setMachineOpen(true); }, []);
  const selectMachine = (m: any) => {
    const description = `${m.name} (${m.model || m.name})`;
    const price = num(m.defaultSupplyRate) > 0 ? num(m.defaultSupplyRate) : num(m.defaultPrice);
    const unit = m.defaultUnit || 'Nos';
    const brand = extractBrand(m);
    setMainItems((cur) => {
      const list = [...cur];
      if (activeMachine >= list.length) list.push({ section: 'MAIN_UNIT', itemOrder: list.length + 1, description, quantity: 1, unit, supplyRate: price, installRate: 0, brand, productId: m.id });
      else list[activeMachine] = { ...list[activeMachine], description, supplyRate: price, unit, brand, productId: m.id };
      return list;
    });
    setMachineOpen(false);
  };
  const addMachineFromCatalogue = () => { setActiveMachine(mainItems.length); setMachineOpen(true); };

  const applyLow = (add: LowSideItem[], removeNames: string[]) => {
    lowTouched.current = true;
    setLowItems((cur) =>
      [...cur.filter((x) => !removeNames.some((n) => sameLine(n, x.description))), ...add.map((i) => toLowLine(i, 0))]
        .map((x, i) => ({ ...x, itemOrder: i + 1 }))
    );
    setPickerOpen(false);
  };

  /* totals. Cassette: GST is charged on A + B (the backend does the same for every non-Split type). */
  const mainTotal = round2(mainItems.reduce((a, i) => a + round2(i.quantity * i.supplyRate), 0));
  const lowSupply = hasLowSide ? round2(lowItems.reduce((a, i) => a + round2(i.quantity * i.supplyRate), 0)) : 0;
  const lowInstall = hasLowSide ? round2(lowItems.reduce((a, i) => a + round2(i.quantity * i.installRate), 0)) : 0;
  const lowTotal = round2(lowSupply + lowInstall);
  const projectTotal = round2(mainTotal + lowTotal);
  const cgst = round2((projectTotal * 9) / 100);
  const sgst = round2((projectTotal * 9) / 100);
  const grand = round2(projectTotal + cgst + sgst);

  const today = new Date().toISOString().slice(0, 10);
  const validTill = showDate(addDays(existingDate || today, 10));
  const lowNames = useMemo(() => lowItems.map((i) => i.description), [lowItems]);

  const save = async () => {
    setError(''); setWarnings([]);
    if (mainItems.length === 0) { setError('Add at least one piece of equipment.'); return; }
    setSaving(true);
    const mainPayload = mainItems.map((i, idx) => ({
      section: 'MAIN_UNIT', itemOrder: idx + 1, productId: i.productId || undefined, brand: i.brand || undefined,
      description: i.description, quantity: i.quantity, unit: i.unit,
      unitPrice: i.supplyRate, supplyRate: i.supplyRate, installRate: 0, amount: round2(i.quantity * i.supplyRate),
    }));
    const lowPayload = hasLowSide ? lowItems.map((i, idx) => {
      const supplyAmount = round2(i.quantity * i.supplyRate);
      const installAmount = round2(i.quantity * i.installRate);
      return {
        section: 'LOW_SIDE', itemOrder: idx + 1, description: i.description, quantity: i.quantity, unit: i.unit,
        unitPrice: i.supplyRate, supplyRate: i.supplyRate, installRate: i.installRate,
        supplyAmount, installAmount, amount: round2(supplyAmount + installAmount),
      };
    }) : [];
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
      systemDesignation: systemDesignation.trim() || undefined,
      totalCapacity: totalCapacity.trim() || undefined,
      offerType: offerType.trim() || undefined,
      scopeExclusions: blocks.scope.trim(),
      commissioningReqs: blocks.req.trim(),
      termsAndConditions: blocks.terms.trim(),
      paymentMethod: blocks.payment.trim(),
      includeBankDetails: includeBank,
      hasLowSide,
      items: [...mainPayload, ...lowPayload],
      cgstPercent: 9,
      sgstPercent: 9,
      status: 'FINAL',
      pdfName: typed || `${quotationType}_Cassette_Quotation_${safe}`,
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
  const textBlock = (k: BlockKey, letter: string, title: string, hint: string, rows: number) => (
    <>
      {secHead(letter, title, <button style={{ ...ghost, height: 30 }} onClick={() => resetBlock(k)}><RotateCcw size={13} /> Reset</button>)}
      <div style={card}>
        <textarea
          style={{ ...input, height: 'auto', padding: '9px 10px', resize: 'vertical', lineHeight: 1.5 }}
          rows={rows}
          value={blocks[k]}
          onChange={(e) => setBlock(k, e.target.value)}
        />
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>{hint}</div>
      </div>
    </>
  );

  if (!loaded) return <div style={{ padding: 24, color: '#64748B' }}>Loading quotation…</div>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 90 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {onBack && !editQuotationId && <button style={ghost} onClick={onBack}><ArrowLeft size={14} /> Back</button>}
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, flex: 1 }}>{savedId ? 'Edit Cassette Quotation' : 'New Cassette Quotation'}</h2>
      </div>

      <div style={{ display: 'flex', padding: 2, borderRadius: 10, background: '#E2E8F0' }}>
        <button style={segBtn('ECDIAL')} onClick={() => setQuotationType('ECDIAL')}>Ec Dial</button>
        <button style={segBtn('DAIKIN')} onClick={() => setQuotationType('DAIKIN')}>Daikin</button>
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 6 }}>Cassette AC commercial proposal</div>

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
      </div>

      {/* Proposal details */}
      <div style={{ ...label, margin: '22px 4px 8px' }}>Proposal details</div>
      <div style={{ ...card, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: 12 }}>
          <div><span style={label}>System designation</span>
            <input style={input} value={systemDesignation} onChange={(e) => { designationTouched.current = true; setSystemDesignation(e.target.value); }} /></div>
          <div><span style={label}>Total capacity</span>
            <input style={input} placeholder="e.g. 5 TR" value={totalCapacity} onChange={(e) => setTotalCapacity(e.target.value)} /></div>
          <div><span style={label}>Offer type</span>
            <input style={input} list="cassette-offer-types" value={offerType} onChange={(e) => setOfferType(e.target.value)} />
            <datalist id="cassette-offer-types">{OFFER_TYPES.map((o) => <option key={o} value={o} />)}</datalist></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Valid till <small style={{ color: '#64748B' }}>(10 days from the quotation date)</small></span><b>{validTill}</b></div>
        <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span>Include bank details (section F)</span>
          <input type="checkbox" checked={includeBank} onChange={(e) => setIncludeBank(e.target.checked)} style={{ width: 18, height: 18 }} />
        </label>
      </div>

      {/* A */}
      {secHead('A', 'Main units / high-side equipment', <>
        <button style={ghost} onClick={addMachineFromCatalogue}><BookOpen size={14} /> Add from catalogue</button>
        <button style={ghost} onClick={addMain}><Plus size={14} /> Blank item</button>
      </>)}
      {mainItems.length === 0
        ? <div style={{ ...card, textAlign: 'center', color: '#64748B' }}>No equipment yet. Tap “Add from catalogue”.</div>
        : mainItems.map((it, i) => <CassetteRow key={i} section="MAIN_UNIT" idx={i} item={it} onChange={updateItem} onRemove={removeItem} onPickModel={pickModel} />)}

      {/* B */}
      {secHead('B', 'Low-side works', (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={hasLowSide} onChange={(e) => setHasLowSide(e.target.checked)} style={{ width: 18, height: 18 }} /> Include
        </label>
      ))}
      {hasLowSide && (
        <>
          {lowItems.length === 0
            ? <div style={{ ...card, textAlign: 'center', color: '#64748B' }}>No low-side items. Add from your saved list.</div>
            : lowItems.map((it, i) => <CassetteRow key={i} section="LOW_SIDE" idx={i} item={it} onChange={updateItem} onRemove={removeItem} />)}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <button style={{ ...ghost, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0B4A86' }} onClick={() => setPickerOpen(true)}><Plus size={14} /> From saved items</button>
            <button style={ghost} onClick={addCustomLow}>Custom line</button>
            <button style={ghost} onClick={() => setManageOpen(true)}>Manage saved list</button>
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
            Saved items load their price as the supply rate (or their own supply / install rates if set). Add the installation rate on the line.
          </div>
        </>
      )}

      {/* C, D, E */}
      {textBlock('scope', 'C', 'Customer scope / exclusions', 'One item per line. The 01, 02, 03… numbers are added automatically.', 9)}
      {textBlock('req', 'D', 'Requirements before commissioning', 'One item per line.', 4)}
      {textBlock('terms', 'E', 'Terms & conditions (tax)', 'Shown in the “Tax & terms” row.', 3)}
      {textBlock('payment', 'E', 'Payment schedule', 'One bullet per line. Shown in the “Payment schedule” row.', 5)}

      {/* Summary */}
      <div style={{ ...label, margin: '22px 4px 8px' }}>Summary</div>
      <div style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>A · Total high-side equipment</span><span>₹{money(mainTotal)}</span></div>
        {hasLowSide && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>B · Low-side supply</span><span>₹{money(lowSupply)}</span></div>}
        {hasLowSide && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>B · Low-side installation</span><span>₹{money(lowInstall)}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '1px solid #E2E8F0', paddingTop: 8 }}><span>Total project cost {hasLowSide ? '(A + B)' : '(A)'}</span><span>₹{money(projectTotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 13 }}><span>CGST 9% + SGST 9% (on the total project cost)</span><span>₹{money(cgst + sgst)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: 13 }}><span>Total incl. GST (saved with the quotation)</span><span>₹{money(grand)}</span></div>
        <div style={{ fontSize: 12, color: '#64748B' }}>The printed proposal shows the total project cost; GST is stated in the terms.</div>
      </div>

      {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', fontSize: 14 }}>{error}</div>}
      {warnings.length > 0 && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#FFFBEB', color: '#92400E', fontSize: 13 }}>{warnings.map((w, i) => <div key={i}>{w}</div>)}</div>}

      <div style={{ position: 'sticky', bottom: 0, marginTop: 18, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 -4px 16px rgba(15,23,42,.06)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>Total project cost (excl. GST)</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>₹{money(projectTotal)}</div>
        </div>
        <button style={{ ...primary, opacity: saving ? 0.6 : 1, minWidth: 170 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Preview PDF'}</button>
      </div>

      <MachinePicker isOpen={machineOpen} machines={machines} acType={AC_TYPE} currentDescription={mainItems[activeMachine]?.description || ''} onSelect={selectMachine} onClose={() => setMachineOpen(false)} />
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
