import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './catalogueShared';
import {
  LowSideItem,
  createLowSide,
  deleteLowSide,
  fetchLowSide,
  updateLowSide,
} from './lowSideLibrary';

const UNITS = ['Nos', 'Mtr', 'Set', 'Pair', 'Kg', 'Ltr'];
const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---------------- Row ---------------- */
const Row = memo(({ item, onPress }: { item: LowSideItem; onPress: (i: LowSideItem) => void }) => (
  <Pressable onPress={() => onPress(item)} style={({ pressed }) => [s.row, pressed && { backgroundColor: '#F2F2F7' }]}>
    <View style={s.rowBody}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={2}>{item.name}</Text>
        <Text style={s.rowSub}>{money(item.price)} / {item.unit}</Text>
      </View>
      {item.isDefault && (
        <View style={s.badge}><Text style={s.badgeText}>Default</Text></View>
      )}
      <Text style={s.chev}>›</Text>
    </View>
  </Pressable>
));

/* ---------------- Add / edit sheet ---------------- */
const ItemEditor: React.FC<{
  item: LowSideItem | null;
  nextOrder: number;
  onClose: () => void;
  onDone: () => void;
}> = ({ item, nextOrder, onClose, onDone }) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(item?.name || '');
  const [unit, setUnit] = useState(item?.unit || 'Nos');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [isDefault, setIsDefault] = useState(item?.isDefault ?? false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!name.trim()) return Alert.alert('Description required', 'Enter the text that should appear on the quotation.');
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) return Alert.alert('Rate required', 'Enter a valid rate.');
    setSaving(true);
    try {
      const v = { name, unit, price: p, isDefault, order: item && item.order !== 9999 ? item.order : nextOrder, note: item?.note };
      const res = item ? await updateLowSide(item, v) : await createLowSide(v);
      if (!res?.success) throw new Error(res?.message || 'Could not save the item.');
      onDone();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete item', 'It will no longer appear in the list. Existing quotations are not affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteLowSide(item!.id);
            if (!res?.success) throw new Error(res?.message || 'Could not delete.');
            onDone();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      },
    ]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.nav, { paddingTop: Platform.OS === 'ios' ? 0 : Math.max(insets.top, 8) }]}>
          <Pressable onPress={onClose} disabled={saving} hitSlop={10} style={s.navSide}><Text style={s.navBlue}>Cancel</Text></Pressable>
          <Text style={s.navTitle}>{item ? 'Edit Item' : 'New Item'}</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={10} style={[s.navSide, { alignItems: 'flex-end' }]}>
            {saving ? <ActivityIndicator color={C.blue} /> : <Text style={[s.navBlue, { fontWeight: '700' }]}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          <Text style={s.sec}>Quotation line</Text>
          <View style={s.group}>
            <TextInput
              style={[s.input, { height: 84, paddingTop: 12, textAlignVertical: 'top' }]}
              placeholder="e.g. Supply and installation of Copper Pipe"
              placeholderTextColor={C.sub}
              value={name}
              onChangeText={setName}
              multiline
            />
          </View>

          <Text style={s.sec}>Unit</Text>
          <View style={s.group}>
            <View style={s.unitRow}>
              {UNITS.map((u) => (
                <Pressable key={u} style={[s.chip, unit === u && s.chipOn]} onPress={() => setUnit(u)}>
                  <Text style={[s.chipText, unit === u && s.chipTextOn]}>{u}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.hair} />
            <TextInput style={s.input} placeholder="Other unit (type here)" placeholderTextColor={C.sub} value={UNITS.includes(unit) ? '' : unit} onChangeText={setUnit} />
          </View>

          <Text style={s.sec}>Rate</Text>
          <View style={s.group}>
            <TextInput style={s.input} placeholder="Rate per unit in ₹" placeholderTextColor={C.sub} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>

          <View style={[s.group, { marginTop: 22 }]}>
            <View style={s.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.switchTitle}>Add to every new quotation</Text>
                <Text style={s.switchSub}>Turn off to keep it in the list and pick it only when needed.</Text>
              </View>
              <Switch value={isDefault} onValueChange={setIsDefault} />
            </View>
          </View>

          {item && (
            <Pressable style={({ pressed }) => [s.delete, pressed && { opacity: 0.6 }]} onPress={remove}>
              <Text style={s.deleteText}>Delete item</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ---------------- Screen ---------------- */
export const LowSideLibraryScreen: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LowSideItem[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<{ item: LowSideItem | null } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchLowSide());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load items.');
      setItems((cur) => cur || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nextOrder = useMemo(() => {
    const used = (items || []).map((i) => i.order).filter((o) => o !== 9999);
    return (used.length ? Math.max(...used) : 0) + 1;
  }, [items]);

  const deleteAll = () => {
    const list = items || [];
    if (!list.length) return;
    Alert.alert(
      `Delete all ${list.length} items?`,
      'Every low side item in this list is permanently deleted, including any stock count stored on it. Existing quotations are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: async () => {
            setProgress({ done: 0, total: list.length });
            let failed = 0;
            for (let i = 0; i < list.length; i++) {
              try {
                const res = await deleteLowSide(list[i].id); // one at a time, so the server is never flooded
                if (!res?.success) failed++;
              } catch {
                failed++;
              }
              setProgress({ done: i + 1, total: list.length });
            }
            setProgress(null);
            if (failed) Alert.alert('Some items could not be deleted', `${failed} of ${list.length} failed. Pull down to refresh and try again.`);
            load();
          },
        },
      ]
    );
  };

  const open = useCallback((i: LowSideItem) => setEditing({ item: i }), []);
  const renderItem = useCallback(({ item }: { item: LowSideItem }) => <Row item={item} onPress={open} />, [open]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[s.container, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Low Side Items</Text>
            <Text style={s.titleSub}>Saved once, reused in every quotation</Text>
          </View>
          <Pressable style={s.plus} onPress={() => setEditing({ item: null })} hitSlop={8}><Text style={s.plusText}>＋</Text></Pressable>
          <Pressable onPress={onClose} hitSlop={10} style={{ marginLeft: 14 }}><Text style={s.navBlue}>Done</Text></Pressable>
        </View>

        {items === null ? (
          <ActivityIndicator style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(i) => i.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            ListHeaderComponent={error ? <Text style={s.error}>{error}</Text> : null}
            ListFooterComponent={
              items.length > 0 ? (
                <Pressable style={({ pressed }) => [s.deleteAll, pressed && { opacity: 0.6 }]} onPress={deleteAll} disabled={!!progress}>
                  <Text style={s.deleteAllText}>
                    {progress ? `Deleting ${progress.done} of ${progress.total}…` : `Delete all ${items.length} items`}
                  </Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No saved items yet</Text>
                <Text style={s.emptySub}>Tap ＋ to add a material. It is saved once and can be picked in any quotation.</Text>
              </View>
            }
          />
        )}

        {editing && (
          <ItemEditor
            item={editing.item}
            nextOrder={nextOrder}
            onClose={() => setEditing(null)}
            onDone={() => { setEditing(null); load(); }}
          />
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 30, fontWeight: '700', color: C.label, letterSpacing: 0.3 },
  titleSub: { fontSize: 13, color: C.sub, marginTop: 2 },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: C.blue, fontSize: 20, fontWeight: '600', marginTop: -1 },

  row: { minHeight: 68, paddingLeft: 20, backgroundColor: '#fff', justifyContent: 'center' },
  rowBody: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  rowTitle: { fontSize: 16, fontWeight: '600', color: C.label },
  rowSub: { fontSize: 14, color: C.sub, marginTop: 2 },
  badge: { backgroundColor: C.blueSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  badgeText: { color: C.blue, fontSize: 11, fontWeight: '700' },
  chev: { fontSize: 26, color: '#C7C7CC', marginLeft: 8, marginTop: -3 },

  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: C.label },
  emptySub: { fontSize: 15, color: C.sub, marginTop: 6, textAlign: 'center' },
  deleteAll: { marginTop: 28, marginHorizontal: 20, height: 48, borderRadius: 12, backgroundColor: '#FFEBEA', alignItems: 'center', justifyContent: 'center' },
  deleteAllText: { color: C.red, fontSize: 16, fontWeight: '600' },
  error: { color: C.red, fontSize: 13, paddingHorizontal: 20, paddingBottom: 8 },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, backgroundColor: C.bg },
  navSide: { width: 70 },
  navTitle: { fontSize: 17, fontWeight: '600', color: C.label },
  navBlue: { fontSize: 17, color: C.blue },
  sec: { fontSize: 13, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  input: { fontSize: 16, color: C.label, paddingHorizontal: 14, height: 48 },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 14 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: C.fill, justifyContent: 'center' },
  chipOn: { backgroundColor: C.blue },
  chipText: { fontSize: 14, color: C.label, fontWeight: '500' },
  chipTextOn: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  switchTitle: { fontSize: 16, color: C.label, fontWeight: '500' },
  switchSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  delete: { marginTop: 26, height: 50, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: C.red, fontSize: 17 },
});
