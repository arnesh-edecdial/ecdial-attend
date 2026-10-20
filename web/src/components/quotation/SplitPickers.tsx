import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus, Trash2, Pencil, Check } from 'lucide-react';
import { api } from '../../services/api';
import { extractBrand, BRANDS } from '../../utils/quotation/brands';
import {
  LowSideItem, LowSideCategory, LOW_SIDE_CATEGORIES, forCategory, sameLine,
  createLowSide, updateLowSide, deleteLowSide,
} from '../../utils/quotation/lowSideLibrary';

const money = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UNITS = ['Nos', 'Mtr', 'RMT', 'Sq.Mt', 'Sqft', 'Kg', 'Set', 'Lot', 'Hour', 'Service', 'Roll', 'Piece', 'Other'];

/* ---------- shared modal shell ---------- */
const Shell: React.FC<{ title: string; onClose: () => void; width?: number; children: React.ReactNode; footer?: React.ReactNode }> = ({ title, onClose, width = 560, children, footer }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', color: '#0F172A', borderRadius: 14, width: `min(${width}px,100%)`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>{title}</div>
        <button onClick={onClose} aria-label="Close" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
      </div>
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>{children}</div>
      {footer && <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>{footer}</div>}
    </div>
  </div>
);

const input: React.CSSProperties = { height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px', fontSize: 14, width: '100%', background: '#fff', color: '#0F172A' };
const primary: React.CSSProperties = { height: 38, padding: '0 16px', borderRadius: 8, border: 0, background: '#0B4A86', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const ghost: React.CSSProperties = { height: 38, padding: '0 14px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A', fontWeight: 600, cursor: 'pointer' };

/* ---------- Machine picker (Main unit model) + add / edit / delete catalogue machines ---------- */
const emptyMachine = (acType: string) => ({ name: '', model: '', brand: '', unit: 'Nos', price: '', stock: '10', acType });
const MACHINE_TYPES = ['SPLIT', 'CASSETTE', 'DUCT', 'VRV', 'ALL'];

export const MachinePicker: React.FC<{
  isOpen: boolean; machines: any[]; acType: string; currentDescription: string;
  onSelect: (m: any) => void; onClose: () => void; onChanged?: () => void;
  /** multi-select (tick several machines, add them all): used when ADDING lines, not when replacing one */
  multi?: boolean; addedNames?: string[]; onSelectMany?: (ms: any[]) => void;
}> = ({ isOpen, machines, acType, currentDescription, onSelect, onClose, onChanged, multi, addedNames, onSelectMany }) => {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<any | 'new' | null>(null);
  const [form, setForm] = useState(emptyMachine(acType));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (isOpen) { setQ(''); setAll(false); setEditing(null); setErr(''); setTicked(new Set()); } }, [isOpen]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return machines
      .filter((m) => all || !m.acType || m.acType === acType || m.acType === 'ALL')
      .filter((m) => !t || `${m.name} ${m.model || ''} ${extractBrand(m)}`.toLowerCase().includes(t));
  }, [machines, q, all, acType]);

  if (!isOpen) return null;

  const useMulti = !!(multi && onSelectMany);
  const isAdded = (m: any) => (addedNames || []).some((d) => sameLine(d, `${m.name} (${m.model || m.name})`));
  const selectable = list.filter((m) => !isAdded(m));
  const allTicked = selectable.length > 0 && selectable.every((m) => ticked.has(m.id));
  const setTick = (ids: string[], on: boolean) => setTicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const addTicked = () => onSelectMany && onSelectMany(machines.filter((m) => ticked.has(m.id)));

  const startNew = () => { setForm(emptyMachine(acType)); setEditing('new'); setErr(''); };
  const startEdit = (m: any) => {
    setForm({
      name: m.name || '', model: m.model || '', brand: m.brand || '', unit: m.defaultUnit || 'Nos',
      price: String(Number(m.defaultSupplyRate) > 0 ? m.defaultSupplyRate : m.defaultPrice || ''),
      stock: String(m.availableStock ?? 0), acType: m.acType || acType,
    });
    setEditing(m); setErr('');
  };
  const save = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    const price = parseFloat(form.price) || 0;
    const base = {
      name: form.name.trim(), model: form.model.trim() || null, brand: form.brand.trim() || undefined,
      category: 'MAIN_UNIT', acType: form.acType, defaultUnit: form.unit || 'Nos',
      defaultPrice: price, defaultSupplyRate: price, defaultInstallRate: 0,
      availableStock: parseInt(form.stock, 10) || 0,
    };
    try {
      setSaving(true); setErr('');
      const res = editing === 'new'
        ? await api.createProduct({ ...base, description: form.name.trim() })
        : await api.updateProduct((editing as any).id, { ...base, description: (editing as any).description || form.name.trim() });
      if (res?.success === false) throw new Error(res.message || 'Could not save.');
      setEditing(null); onChanged?.();
    } catch (e: any) { setErr(e?.message || 'Could not save.'); } finally { setSaving(false); }
  };
  const remove = async (m: any) => {
    if (!window.confirm(`Delete “${m.name}” from the catalogue?`)) return;
    try { const r = await api.deleteProduct(m.id); if (r?.success === false) throw new Error(r.message); onChanged?.(); }
    catch (e: any) { alert(e?.message || 'Could not delete.'); }
  };

  if (editing) {
    return (
      <Shell title={editing === 'new' ? 'Add machine to catalogue' : 'Edit catalogue machine'} onClose={() => setEditing(null)} width={560}
        footer={<>
          {err && <span style={{ color: '#B91C1C', fontSize: 13, flex: 1 }}>{err}</span>}
          <button style={ghost} onClick={() => setEditing(null)}>Back</button>
          <button style={{ ...primary, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <input style={input} autoFocus placeholder="Name, e.g. Daikin 5 TR outdoor unit" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input style={input} placeholder="Model, e.g. RZQ125BY1E" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input style={input} list="machine-brands" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <datalist id="machine-brands">{BRANDS.map((b) => <option key={b} value={b} />)}</datalist>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <select style={input} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <input style={input} inputMode="decimal" placeholder="Rate ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input style={input} inputMode="numeric" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            <select style={input} value={form.acType} onChange={(e) => setForm({ ...form, acType: e.target.value })}>
              {MACHINE_TYPES.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All types' : c}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Indoor and outdoor units are separate catalogue items: add each one with its own name, model and rate.</div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Choose machine from catalogue" onClose={onClose} width={640}
      footer={<>
        <button style={{ ...ghost, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={startNew}><Plus size={14} /> Add new machine</button>
        <div style={{ flex: 1 }} />
        {useMulti && <button style={{ ...primary, opacity: ticked.size ? 1 : 0.5 }} disabled={!ticked.size} onClick={addTicked}>Add selected ({ticked.size})</button>}
      </>}>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: '#94A3B8' }} />
        <input style={{ ...input, paddingLeft: 32 }} autoFocus placeholder="Search model, brand…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#64748B', marginBottom: 10 }}>
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show every AC type (not only {acType})
      </label>
      {list.length === 0 && <div style={{ color: '#64748B', padding: 16, textAlign: 'center' }}>No machines found. Use “Add new machine” below.</div>}
      {useMulti && selectable.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          <input type="checkbox" checked={allTicked} onChange={() => setTick(selectable.map((m) => m.id), !allTicked)} />
          Select all ({selectable.length})
          <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: 12, color: '#64748B' }}>{ticked.size} selected</span>
        </label>
      )}
      {list.map((m) => {
        const desc = `${m.name} (${m.model || m.name})`;
        const on = sameLine(desc, currentDescription || '');
        const added = useMulti && isAdded(m);
        return (
          <div key={m.id} onClick={() => (useMulti ? (!added && setTick([m.id], !ticked.has(m.id))) : onSelect(m))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${on ? '#0B4A86' : '#E2E8F0'}`, marginBottom: 6, cursor: 'pointer', background: on ? '#EFF6FF' : '#fff' }}>
            {useMulti && <input type="checkbox" checked={added || ticked.has(m.id)} disabled={added} onChange={() => setTick([m.id], !ticked.has(m.id))} onClick={(e) => e.stopPropagation()} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}{added ? <span style={{ fontWeight: 500, fontSize: 12, color: '#16A34A' }}> · already added</span> : null}</div>
              <div style={{ fontSize: 12, color: '#64748B' }}>{extractBrand(m)}{m.model ? ` · ${m.model}` : ''}{m.acType ? ` · ${m.acType}` : ''}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>₹{money(m.defaultPrice)}</div>
            {on && <Check size={16} color="#0B4A86" />}
            <button style={{ ...ghost, height: 30, padding: '0 8px' }} onClick={(e) => { e.stopPropagation(); startEdit(m); }} aria-label="Edit"><Pencil size={13} /></button>
            <button style={{ ...ghost, height: 30, padding: '0 8px', color: '#B91C1C' }} onClick={(e) => { e.stopPropagation(); remove(m); }} aria-label="Delete"><Trash2 size={13} /></button>
          </div>
        );
      })}
    </Shell>
  );
};

/* ---------- Low-side picker (tick items from the saved list) ---------- */
export const LowSidePicker: React.FC<{
  isOpen: boolean; library: LowSideItem[] | null; acType: string; currentDescriptions: string[];
  onApply: (add: LowSideItem[], removeNames: string[]) => void; onManage: () => void; onClose: () => void;
}> = ({ isOpen, library, acType, currentDescriptions, onApply, onManage, onClose }) => {
  const items = useMemo(() => forCategory(library || [], acType), [library, acType]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setPicked(new Set(items.filter((i) => currentDescriptions.some((d) => sameLine(d, i.name))).map((i) => i.id)));
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setMany = (ids: string[], on: boolean) => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const allOn = items.length > 0 && items.every((i) => picked.has(i.id));
  const groups: Array<[string, LowSideItem[]]> = (() => {
    const m = new Map<string, LowSideItem[]>();
    items.forEach((i) => { const g = i.group || ''; if (!m.has(g)) m.set(g, []); (m.get(g) as LowSideItem[]).push(i); });
    return Array.from(m.entries());
  })();

  const apply = () => {
    const already = (i: LowSideItem) => currentDescriptions.some((d) => sameLine(d, i.name));
    const add = items.filter((i) => picked.has(i.id) && !already(i));
    const removeNames = items.filter((i) => !picked.has(i.id) && already(i)).map((i) => i.name);
    onApply(add, removeNames);
  };

  return (
    <Shell
      title={`Saved low side items · ${acType}`}
      onClose={onClose}
      footer={<>
        <button style={ghost} onClick={onManage}>Manage list</button>
        <div style={{ flex: 1 }} />
        <button style={ghost} onClick={onClose}>Cancel</button>
        <button style={primary} onClick={apply}>Apply</button>
      </>}
    >
      {library === null && <div style={{ color: '#64748B' }}>Loading…</div>}
      {library !== null && items.length === 0 && <div style={{ color: '#64748B', textAlign: 'center', padding: 16 }}>No saved {acType} items yet. Use “Manage list” to add some.</div>}
      {items.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          <input type="checkbox" checked={allOn} onChange={() => setMany(items.map((i) => i.id), !allOn)} />
          Select all ({items.length})
          <span style={{ marginLeft: 'auto', fontWeight: 500, fontSize: 12, color: '#64748B' }}>{picked.size} selected</span>
        </label>
      )}
      {groups.map(([g, list]) => {
        const gOn = list.every((i) => picked.has(i.id));
        return (
          <div key={g || '_'} style={{ marginBottom: 6 }}>
            {groups.length > 1 || g ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12, fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: 0.4, cursor: 'pointer' }}>
                <input type="checkbox" checked={gOn} onChange={() => setMany(list.map((i) => i.id), !gOn)} />
                {g || 'No group'} <span style={{ fontWeight: 500, color: '#94A3B8' }}>({list.length})</span>
              </label>
            ) : null}
            {list.map((i) => (
              <label key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {i.unit}{i.category === 'ALL' ? ' · All types' : ''}{i.isDefault ? ' · Default' : ''}
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>₹{money(i.price)}</div>
              </label>
            ))}
          </div>
        );
      })}
    </Shell>
  );
};

/* ---------- Low-side library manager (add / edit / delete / category / default toggle) ---------- */
export const LowSideManager: React.FC<{
  isOpen: boolean; library: LowSideItem[] | null; defaultCategory: LowSideCategory;
  onChanged: () => void; onClose: () => void;
}> = ({ isOpen, library, defaultCategory, onChanged, onClose }) => {
  const [tab, setTab] = useState<LowSideCategory>(defaultCategory);
  const [editing, setEditing] = useState<LowSideItem | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'Nos', price: '', category: defaultCategory as LowSideCategory, isDefault: false, order: '1', note: '', group: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { if (isOpen) { setTab(defaultCategory); setEditing(null); setErr(''); } }, [isOpen, defaultCategory]);

  const visible = useMemo(() => (library || []).filter((i) => i.category === tab), [library, tab]);

  if (!isOpen) return null;

  const startNew = () => {
    setForm({ name: '', unit: 'Nos', price: '', category: tab, isDefault: false, order: String((library || []).filter((i) => i.category === tab).length + 1), note: '', group: '' });
    setEditing('new'); setErr('');
  };
  const startEdit = (i: LowSideItem) => {
    setForm({ name: i.name, unit: i.unit, price: String(i.price), category: i.category, isDefault: i.isDefault, order: String(i.order === 9999 ? 1 : i.order), note: i.note, group: i.group });
    setEditing(i); setErr('');
  };

  const save = async () => {
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    const v = { name: form.name, unit: form.unit, price: parseFloat(form.price) || 0, isDefault: form.isDefault, order: parseInt(form.order, 10) || 1, category: form.category, note: form.note.trim(), group: form.group.trim() };
    try {
      setSaving(true); setErr('');
      const res = editing === 'new' ? await createLowSide(v) : await updateLowSide(editing as LowSideItem, v);
      if (res?.success === false) throw new Error(res.message || 'Could not save.');
      setEditing(null); onChanged();
    } catch (e: any) { setErr(e?.message || 'Could not save.'); } finally { setSaving(false); }
  };

  const remove = async (i: LowSideItem) => {
    if (!window.confirm(`Delete “${i.name}” from the saved list?`)) return;
    try { await deleteLowSide(i.id); onChanged(); } catch (e: any) { alert(e?.message || 'Could not delete.'); }
  };

  return (
    <Shell title="Saved low side items" onClose={onClose} width={680}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {LOW_SIDE_CATEGORIES.map((c) => (
          <button key={c} onClick={() => { setTab(c); setEditing(null); }} style={{ ...ghost, height: 32, padding: '0 12px', fontSize: 12, ...(tab === c ? { background: '#0B4A86', color: '#fff', border: '1px solid #0B4A86' } : {}) }}>
            {c === 'ALL' ? 'All types' : c}
          </button>
        ))}
      </div>

      {editing ? (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>{editing === 'new' ? 'New item' : 'Edit item'}</div>
          <input style={input} placeholder="Item name (as it prints in the quotation)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <select style={input} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
            <input style={input} inputMode="decimal" placeholder="Price ₹" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <select style={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LowSideCategory })}>
              {LOW_SIDE_CATEGORIES.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All types' : c}</option>)}
            </select>
          </div>
          <div>
            <input style={input} list="low-groups" placeholder="Group / inner category (optional), e.g. Refrigerant piping" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
            <datalist id="low-groups">{Array.from(new Set((library || []).map((i) => i.group).filter(Boolean))).map((g) => <option key={g} value={g} />)}</datalist>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            Add to every new {form.category === 'ALL' ? '' : form.category + ' '}quotation (default)
          </label>
          {form.isDefault && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              Order among defaults <input style={{ ...input, width: 80 }} inputMode="numeric" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
          )}
          {err && <div style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={ghost} onClick={() => setEditing(null)}>Cancel</button>
            <button style={{ ...primary, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <>
          <button style={{ ...primary, marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={startNew}><Plus size={14} /> Add item to {tab === 'ALL' ? 'All types' : tab}</button>
          {library === null && <div style={{ color: '#64748B' }}>Loading…</div>}
          {library !== null && visible.length === 0 && <div style={{ color: '#64748B', padding: 12 }}>Nothing saved under this category yet.</div>}
          {visible.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: 10, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{i.group ? `${i.group} · ` : ''}{i.unit} · ₹{money(i.price)}{i.isDefault ? ' · ✓ Default' : ''}</div>
              </div>
              <button style={{ ...ghost, height: 32, padding: '0 10px' }} onClick={() => startEdit(i)} aria-label="Edit"><Pencil size={14} /></button>
              <button style={{ ...ghost, height: 32, padding: '0 10px', color: '#B91C1C' }} onClick={() => remove(i)} aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          ))}
        </>
      )}
    </Shell>
  );
};
