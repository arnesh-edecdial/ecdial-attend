import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { mobileApi } from '../services/api';
import { C } from './catalogueShared';

export interface PickedPdf {
  id: string;
  name: string;
  size?: number | null;
}

interface Props {
  selectedId?: string | null;
  onSelect: (pdf: PickedPdf) => void;
  onClose: () => void;
}

export const fmtPdfSize = (b?: number | null) =>
  !b ? '' : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/** Read-only list of PDFs already uploaded from the web admin page. One cached request; search is local. */
export const CataloguePdfPicker: React.FC<Props> = ({ selectedId, onSelect, onClose }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    mobileApi
      .getCachedCatalogues(undefined, undefined, {
        onBackgroundUpdate: (fresh) => alive && Array.isArray(fresh?.data) && setItems(fresh.data),
      })
      .then((res) => alive && Array.isArray(res?.data) && setItems(res.data))
      .catch((e) => console.warn('[PDF picker]', e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => `${i.displayName || ''} ${i.fileName || ''} ${i.model || ''}`.toLowerCase().includes(t));
  }, [items, q]);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={s.nav}>
          <Pressable onPress={onClose} hitSlop={10} style={{ width: 70 }}>
            <Text style={s.blue}>Cancel</Text>
          </Pressable>
          <Text style={s.title}>Select PDF</Text>
          <View style={{ width: 70 }} />
        </View>
        <TextInput
          style={s.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search PDFs"
          placeholderTextColor={C.sub}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {loading && items.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={C.blue} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(i) => String(i.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <Text style={s.empty}>{q ? 'No PDFs match your search.' : 'No PDFs uploaded yet. Upload them from the web admin page.'}</Text>
            }
            renderItem={({ item }) => {
              const on = String(item.id) === String(selectedId);
              return (
                <Pressable
                  style={[s.row, on && s.rowOn]}
                  onPress={() => onSelect({ id: String(item.id), name: item.displayName || item.fileName, size: item.fileSize })}
                >
                  <View style={s.icon}><Text style={s.iconText}>PDF</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={2}>{item.displayName || item.fileName}</Text>
                    {!!fmtPdfSize(item.fileSize) && <Text style={s.sub}>{fmtPdfSize(item.fileSize)}</Text>}
                  </View>
                  {on && <Text style={s.blue}>✓</Text>}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, paddingTop: Platform.OS === 'ios' ? 0 : 8 },
  title: { fontSize: 17, fontWeight: '600', color: C.label },
  blue: { fontSize: 17, color: C.blue },
  search: { marginHorizontal: 16, marginBottom: 4, height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: C.fill, color: C.label, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: C.card, marginBottom: 8 },
  rowOn: { borderWidth: 1.5, borderColor: C.blue },
  icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFEBEA', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 11, fontWeight: '800', color: C.red },
  name: { fontSize: 15, fontWeight: '600', color: C.label },
  sub: { fontSize: 12, color: C.sub, marginTop: 2 },
  empty: { textAlign: 'center', color: C.sub, marginTop: 40, fontSize: 14 },
});
