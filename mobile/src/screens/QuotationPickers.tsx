import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { C, extractBrand } from './catalogueShared';
import { LowSideItem, sameLine } from './lowSideLibrary';

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ------------------------------------------------------------------ */
/* Bottom sheet shell                                                  */
/* ------------------------------------------------------------------ */
const Sheet: React.FC<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  doneLabel?: string;
  children: React.ReactNode;
}> = ({ visible, title, subtitle, onClose, doneLabel = 'Done', children }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={s.grab} />
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.headTitle}>{title}</Text>
                {!!subtitle && <Text style={s.headSub}>{subtitle}</Text>}
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={s.done}>{doneLabel}</Text>
              </Pressable>
            </View>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <TextInput
    style={s.search}
    placeholder={placeholder}
    placeholderTextColor={C.sub}
    value={value}
    onChangeText={onChange}
    autoCorrect={false}
    clearButtonMode="while-editing"
  />
);

/* ------------------------------------------------------------------ */
/* Machine model picker                                                */
/* ------------------------------------------------------------------ */
const MachineRow = memo(
  ({ m, brand, selected, onPress }: { m: any; brand: string; selected: boolean; onPress: (m: any) => void }) => (
    <Pressable onPress={() => onPress(m)} style={({ pressed }) => [s.row, pressed && s.rowOn]}>
      <View style={[s.radio, selected && s.radioOn]}>{selected && <Text style={s.tick}>✓</Text>}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={2}>{m.name}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {[brand, m.model].filter(Boolean).join('  ·  ')}
        </Text>
      </View>
      <Text style={s.rowPrice}>₹{money(Number(m.defaultPrice) || 0)}</Text>
    </Pressable>
  )
);

export const MachinePickerSheet: React.FC<{
  visible: boolean;
  machines: any[];
  currentDescription: string;
  onSelect: (m: any) => void;
  onClose: () => void;
}> = ({ visible, machines, currentDescription, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('ALL');

  // brand + search text are computed once per list, not per keystroke
  const indexed = useMemo(
    () =>
      machines.map((m) => {
        const b = extractBrand(m);
        return { m, b, hay: `${m.name || ''} ${m.model || ''} ${m.description || ''} ${b}`.toLowerCase() };
      }),
    [machines]
  );
  const brands = useMemo(() => ['ALL', ...Array.from(new Set(indexed.map((i) => i.b))).sort()], [indexed]);
  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return indexed.filter((i) => (brand === 'ALL' || i.b === brand) && (!q || i.hay.includes(q)));
  }, [indexed, brand, query]);

  const cur = currentDescription || '';
  const isSel = (m: any) => !!cur && (cur.includes(m.name) || (!!m.model && cur.includes(m.model)));

  return (
    <Sheet visible={visible} title="Select Machine" subtitle="Tap a model to fill the line" onClose={onClose} doneLabel="Close">
      <SearchBox value={query} onChange={setQuery} placeholder="Search brand or model" />
      <View style={{ height: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
          {brands.map((b) => (
            <Pressable key={b} style={[s.chip, brand === b && s.chipOn]} onPress={() => setBrand(b)}>
              <Text style={[s.chipText, brand === b && s.chipTextOn]}>{b === 'ALL' ? 'All' : b}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        style={{ height: 380 }}
        data={data}
        keyExtractor={(i) => String(i.m.id)}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        windowSize={7}
        extraData={cur}
        renderItem={({ item }) => <MachineRow m={item.m} brand={item.b} selected={isSel(item.m)} onPress={onSelect} />}
        ListEmptyComponent={<Text style={s.empty}>No matching machines.</Text>}
      />
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/* Customer picker (with quick add)                                    */
/* ------------------------------------------------------------------ */
const CustomerRow = memo(({ c, onPress }: { c: any; onPress: (c: any) => void }) => (
  <Pressable onPress={() => onPress(c)} style={({ pressed }) => [s.row, pressed && s.rowOn]}>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle} numberOfLines={1}>{c.name || 'Unnamed customer'}</Text>
      <Text style={s.rowSub} numberOfLines={1}>{[c.mobile, c.address].filter(Boolean).join('  ·  ') || '—'}</Text>
    </View>
    <Text style={s.chev}>›</Text>
  </Pressable>
));

export const CustomerPickerSheet: React.FC<{
  visible: boolean;
  onSelect: (c: any) => void;
  onClose: () => void;
}> = ({ visible, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<any>(null);

  const fetchList = useCallback(async (q?: string) => {
    try {
      setLoading(true);
      const res = await mobileApi.listCustomers(q);
      if (res.success && res.data) setList(res.data);
    } catch (e) {
      console.error('[Customers]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setAdding(false);
      fetchList(query || undefined);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (t: string) => {
    setQuery(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchList(t), 250); // debounce: one request per pause, not per key
  };

  const createInline = async () => {
    try {
      setSaving(true);
      const res = await mobileApi.createCustomer({
        name: name.trim() || undefined,
        address: address.trim() || undefined,
        mobile: mobile.trim() || undefined,
      });
      if (res.success && res.data) {
        setName(''); setMobile(''); setAddress(''); setAdding(false);
        onSelect(res.data);
      }
    } catch (e: any) {
      Alert.alert('Could not save customer', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={adding ? 'New Customer' : 'Select Customer'}
      subtitle={adding ? 'All fields are optional. Your quotation is kept.' : undefined}
      onClose={adding ? () => setAdding(false) : onClose}
      doneLabel={adding ? 'Back' : 'Close'}
    >
      {adding ? (
        <View style={{ paddingBottom: 8 }}>
          <View style={s.form}>
            <TextInput style={s.formInput} placeholder="Name" placeholderTextColor={C.sub} value={name} onChangeText={setName} />
            <View style={s.hair} />
            <TextInput style={s.formInput} placeholder="Mobile" placeholderTextColor={C.sub} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
            <View style={s.hair} />
            <TextInput style={[s.formInput, { height: 70, paddingTop: 12, textAlignVertical: 'top' }]} placeholder="Address" placeholderTextColor={C.sub} value={address} onChangeText={setAddress} multiline />
          </View>
          <Pressable style={[s.primary, saving && { opacity: 0.6 }]} onPress={createInline} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Save & Select</Text>}
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <SearchBox value={query} onChange={onSearch} placeholder="Search name, phone, address" />
            </View>
            <Pressable style={s.addBtn} onPress={() => setAdding(true)}>
              <Text style={s.addBtnText}>＋ New</Text>
            </Pressable>
          </View>
          <Pressable style={s.skip} onPress={() => onSelect(null)}>
            <Text style={s.skipText}>Continue without a customer profile</Text>
          </Pressable>
          {loading && list.length === 0 ? (
            <ActivityIndicator style={{ marginVertical: 30 }} />
          ) : (
            <FlatList
              style={{ height: 340 }}
              data={list}
              keyExtractor={(c) => String(c.id)}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              renderItem={({ item }) => <CustomerRow c={item} onPress={onSelect} />}
              ListEmptyComponent={<Text style={s.empty}>No customers found.</Text>}
            />
          )}
        </>
      )}
    </Sheet>
  );
};

/* ------------------------------------------------------------------ */
/* Low side picker: choices are local until "Add" (no parent re-render) */
/* ------------------------------------------------------------------ */
const LowRow = memo(({ it, on, onToggle }: { it: LowSideItem; on: boolean; onToggle: (id: string) => void }) => (
  <Pressable onPress={() => onToggle(it.id)} style={({ pressed }) => [s.row, pressed && s.rowOn]}>
    <View style={[s.check, on && s.checkOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle} numberOfLines={2}>{it.name}</Text>
      <Text style={s.rowSub}>₹{money(it.price)} / {it.unit}</Text>
    </View>
  </Pressable>
));

export const LowSidePickerSheet: React.FC<{
  visible: boolean;
  library: LowSideItem[] | null;
  currentDescriptions: string[];
  onApply: (add: LowSideItem[], removeNames: string[]) => void;
  onManage: () => void;
  onClose: () => void;
}> = ({ visible, library, currentDescriptions, onApply, onManage, onClose }) => {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // start from what the quotation already contains each time the sheet opens
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setPicked(new Set((library || []).filter((it) => currentDescriptions.some((d) => sameLine(d, it.name))).map((it) => it.id)));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((id: string) => {
    setPicked((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library || []).filter((i) => !q || i.name.toLowerCase().includes(q));
  }, [library, query]);

  const apply = () => {
    const lib = library || [];
    const had = new Set(lib.filter((it) => currentDescriptions.some((d) => sameLine(d, it.name))).map((it) => it.id));
    const add = lib.filter((it) => picked.has(it.id) && !had.has(it.id));
    const removeNames = lib.filter((it) => !picked.has(it.id) && had.has(it.id)).map((it) => it.name);
    onApply(add, removeNames);
  };

  return (
    <Sheet visible={visible} title="Low Side Items" subtitle={picked.size ? `${picked.size} selected` : 'Tick the items to include'} onClose={onClose} doneLabel="Cancel">
      {library === null ? (
        <ActivityIndicator style={{ marginVertical: 40 }} />
      ) : library.length === 0 ? (
        <View style={{ paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center' }}>
          <Text style={s.emptyTitle}>No saved items yet</Text>
          <Text style={s.empty}>Add your materials once and pick them in any quotation.</Text>
        </View>
      ) : (
        <>
          <SearchBox value={query} onChange={setQuery} placeholder="Search" />
          <FlatList
            style={{ height: 340 }}
            data={data}
            keyExtractor={(i) => i.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={14}
            windowSize={7}
            extraData={picked}
            renderItem={({ item }) => <LowRow it={item} on={picked.has(item.id)} onToggle={toggle} />}
            ListEmptyComponent={<Text style={s.empty}>No matches.</Text>}
          />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 10 }}>
        <Pressable style={[s.secondary, { flex: 1 }]} onPress={onManage}>
          <Text style={s.secondaryText}>Manage list</Text>
        </Pressable>
        {!!library && library.length > 0 && (
          <Pressable style={[s.primary, { flex: 1.4, marginHorizontal: 0, marginTop: 0 }]} onPress={apply}>
            <Text style={s.primaryText}>Add to quotation</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8 },
  grab: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: '#C7C7CC', marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10 },
  headTitle: { fontSize: 20, fontWeight: '700', color: C.label },
  headSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  done: { fontSize: 17, color: C.blue, fontWeight: '600' },
  search: { marginHorizontal: 16, marginBottom: 8, height: 38, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#7676801F', fontSize: 16, color: C.label },
  chips: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.fill, justifyContent: 'center' },
  chipOn: { backgroundColor: C.blue },
  chipText: { fontSize: 14, color: C.label, fontWeight: '500' },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: '#fff' },
  rowOn: { backgroundColor: '#F2F2F7' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: C.label },
  rowSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  rowPrice: { fontSize: 14, fontWeight: '600', color: C.label },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: C.blue, borderColor: C.blue },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.blue, borderColor: C.blue },
  tick: { color: '#fff', fontSize: 13, fontWeight: '800' },
  chev: { fontSize: 26, color: '#C7C7CC', marginTop: -3 },
  empty: { textAlign: 'center', color: C.sub, paddingVertical: 24, paddingHorizontal: 24, fontSize: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.label },
  primary: { height: 46, marginHorizontal: 16, marginTop: 12, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { height: 46, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: C.blue, fontSize: 16, fontWeight: '600' },
  addBtn: { marginRight: 16, marginBottom: 8, height: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.blueSoft, justifyContent: 'center' },
  addBtnText: { color: C.blue, fontWeight: '600', fontSize: 15 },
  skip: { marginHorizontal: 16, marginBottom: 6, paddingVertical: 8, alignItems: 'center' },
  skipText: { color: C.blue, fontSize: 14 },
  form: { marginHorizontal: 16, backgroundColor: C.bg, borderRadius: 12, overflow: 'hidden' },
  formInput: { height: 48, paddingHorizontal: 14, fontSize: 16, color: C.label },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 14 },
});
