import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { mobileApi } from '../services/api';
import { dataCache } from '../services/dataCache';
import { CatalogueDetailSheet } from './CatalogueDetailSheet';
import { CatalogueEditorModal } from './CatalogueEditorModal';
import { AC_TYPES, C, extractBrand, imgSource, productImages, titleCase } from './catalogueShared';

interface ProductCatalogueScreenProps {
  userRole?: string;
  onClose?: () => void;
  onOpenStockRequirements?: () => void; // kept so existing callers still compile
}

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'MANAGER', 'IT_ADMIN', 'SALES'];
const ROW_H = 76;

interface Item { p: any; b: string; t: string; hay: string }

/* ---------------- Row ---------------- */
const ProductRow = memo(({ item, onPress }: { item: Item; onPress: (p: any) => void }) => {
  const { p, b, t } = item;
  const img = productImages(p)[0];
  const sub = [b, titleCase(t), p.model].filter(Boolean).join('  ·  ');
  return (
    <Pressable onPress={() => onPress(p)} style={({ pressed }) => [s.row, pressed && s.rowOn]}>
      {img ? (
        <Image source={imgSource(img)} style={s.thumb} />
      ) : (
        <View style={[s.thumb, s.thumbEmpty]}>
          <Text style={s.snow}>❄︎</Text>
        </View>
      )}
      <View style={s.rowBody}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle} numberOfLines={1}>{p.name}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{sub}</Text>
        </View>
        <Text style={s.chev}>›</Text>
      </View>
    </Pressable>
  );
});

const SearchIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2.4} strokeLinecap="round">
    <Circle cx="11" cy="11" r="7" />
    <Path d="M20 20l-3.5-3.5" />
  </Svg>
);

/* ---------------- Screen ---------------- */
export const ProductCatalogueScreen: React.FC<ProductCatalogueScreenProps> = ({ userRole = 'SALES' }) => {
  const insets = useSafeAreaInsets();
  const canEdit = ADMIN_MANAGEMENT_ROLES.includes((userRole || '').toUpperCase());

  // cache-first: paint instantly from cache, refresh in the background
  const [products, setProducts] = useState<any[]>(() => dataCache.get<any>('products:ALL:ALL:')?.data || []);
  const [loading, setLoading] = useState<boolean>(() => products.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [brand, setBrand] = useState('ALL');
  const [type, setType] = useState('ALL');

  const [detail, setDetail] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editor, setEditor] = useState<{ product: any | null } | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      // Filtering is done on the device, so one fetch (and one cache key) is enough.
      const res = await mobileApi.getCachedProducts(undefined, undefined, {
        forceRefresh: force,
        onBackgroundUpdate: (fresh: any) => {
          if (fresh?.success && Array.isArray(fresh.data)) setProducts(fresh.data);
        },
      });
      if (res?.success && Array.isArray(res.data)) setProducts(res.data);
    } catch (e) {
      console.warn('[Catalogue] load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // Search text + brand are computed once per data change, not per keystroke.
  const items = useMemo<Item[]>(() => {
    return products.map((p) => {
      const b = extractBrand(p);
      const specs: any[] = Array.isArray(p.specifications) ? p.specifications : [];
      const hay = [p.name, p.model, b, p.description, ...specs.map((c) => `${c?.iduModel || ''} ${c?.oduModel || ''}`)]
        .join(' ')
        .toLowerCase();
      return { p, b, t: String(p.acType || 'SPLIT').toUpperCase(), hay };
    });
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.b));
    return ['ALL', ...Array.from(set).sort()];
  }, [items]);

  const data = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return items.filter(
      (i) => (brand === 'ALL' || i.b === brand) && (type === 'ALL' || i.t === type) && (!q || i.hay.includes(q))
    );
  }, [items, brand, type, deferredQuery]);

  const cycleType = useCallback(
    () =>
      setType((cur) => {
        const list = ['ALL', ...AC_TYPES];
        return list[(list.indexOf(cur) + 1) % list.length];
      }),
    []
  );

  /* ---- detail / edit / delete ---- */
  const openDetail = useCallback((p: any) => {
    setDetail(p);
    setSheetOpen(true);
    // show instantly from the list, then swap in fresh data (new signed URLs etc.)
    mobileApi
      .getProduct(p.id)
      .then((res: any) => {
        if (res?.success && res.data) setDetail((cur: any) => (cur && cur.id === p.id ? res.data : cur));
      })
      .catch(() => {});
  }, []);

  const startEdit = useCallback((p: any | null) => {
    setSheetOpen(false);
    // iOS cannot present a modal while another one is still dismissing
    setTimeout(() => setEditor({ product: p }), Platform.OS === 'ios' && p ? 400 : 0);
  }, []);

  const onSaved = useCallback(
    (id?: string) => {
      setEditor(null);
      load(true);
      if (!id) return;
      mobileApi
        .getProduct(id)
        .then((res: any) => {
          if (res?.success && res.data) {
            setDetail(res.data);
            setTimeout(() => setSheetOpen(true), Platform.OS === 'ios' ? 400 : 0);
          }
        })
        .catch(() => {});
    },
    [load]
  );

  const onDelete = useCallback(
    (p: any) =>
      Alert.alert('Delete catalogue', `“${p.name}” with its photos and tables will be permanently deleted.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteProduct(p.id);
              if (!res?.success) throw new Error(res?.message || 'Could not delete the catalogue.');
              if (p.catalogueDocId) Promise.resolve(mobileApi.deleteCatalogue(p.catalogueDocId)).catch(() => {});
              setSheetOpen(false);
              setProducts((cur) => cur.filter((x) => x.id !== p.id));
              load(true);
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message || 'Please try again.');
            }
          },
        },
      ]),
    [load]
  );

  const renderItem = useCallback(({ item }: { item: Item }) => <ProductRow item={item} onPress={openDetail} />, [openDetail]);

  return (
    <View style={[s.container, { paddingTop: Math.max(insets.top, 8) }]}>
      {/* Title */}
      <View style={s.titleRow}>
        <Text style={s.title}>Catalogue</Text>
        {canEdit && (
          <Pressable style={({ pressed }) => [s.plus, pressed && { opacity: 0.7 }]} onPress={() => startEdit(null)} hitSlop={8}>
            <Text style={s.plusText}>＋</Text>
          </Pressable>
        )}
      </View>

      {/* Search + type */}
      <View style={s.searchRow}>
        <View style={s.search}>
          <SearchIcon />
          <TextInput
            style={s.searchInput}
            placeholder="Search"
            placeholderTextColor={C.sub}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable style={[s.typePill, type !== 'ALL' && s.typePillOn]} onPress={cycleType}>
          <Text style={[s.typeText, type !== 'ALL' && s.typeTextOn]}>{type === 'ALL' ? 'All types' : titleCase(type)}</Text>
        </Pressable>
      </View>

      {/* Brand quick filter */}
      <View style={{ height: 44 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {brands.map((b) => {
            const on = brand === b;
            return (
              <Pressable key={b} style={[s.chip, on && s.chipOn]} onPress={() => setBrand(b)}>
                <Text style={[s.chipText, on && s.chipTextOn]}>{b === 'ALL' ? 'All' : b}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(i) => String(i.p.id)}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 60 }} />
          ) : (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{query || brand !== 'ALL' || type !== 'ALL' ? 'No results' : 'No catalogues yet'}</Text>
              <Text style={s.emptySub}>
                {query || brand !== 'ALL' || type !== 'ALL'
                  ? 'Try a different search or filter.'
                  : canEdit
                  ? 'Tap ＋ to add the first one.'
                  : 'Catalogues will appear here.'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          data.length > 0 ? <Text style={s.count}>{data.length} {data.length === 1 ? 'catalogue' : 'catalogues'}</Text> : null
        }
      />

      <CatalogueDetailSheet
        visible={sheetOpen}
        product={detail}
        canEdit={canEdit}
        onClose={() => setSheetOpen(false)}
        onEdit={startEdit}
        onDelete={onDelete}
      />

      {editor && <CatalogueEditorModal product={editor.product} onClose={() => setEditor(null)} onSaved={onSaved} />}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '700', color: C.label, letterSpacing: 0.37 },
  plus: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: C.blue, fontSize: 20, fontWeight: '600', marginTop: -1 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, borderRadius: 10, paddingHorizontal: 10, backgroundColor: '#7676801F' },
  searchInput: { flex: 1, fontSize: 16, color: C.label, padding: 0 },
  typePill: { height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#7676801F', justifyContent: 'center' },
  typePillOn: { backgroundColor: C.blueSoft },
  typeText: { fontSize: 14, color: C.label, fontWeight: '500' },
  typeTextOn: { color: C.blue, fontWeight: '600' },

  chips: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.fill, justifyContent: 'center' },
  chipOn: { backgroundColor: C.blue },
  chipText: { fontSize: 14, color: C.label, fontWeight: '500' },
  chipTextOn: { color: '#fff', fontWeight: '600' },

  row: { height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, backgroundColor: '#fff' },
  rowOn: { backgroundColor: '#F2F2F7' },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.fill },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  snow: { fontSize: 24, color: '#AEAEB2' },
  rowBody: { flex: 1, height: '100%', flexDirection: 'row', alignItems: 'center', marginLeft: 14, paddingRight: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  rowTitle: { fontSize: 17, fontWeight: '600', color: C.label },
  rowSub: { fontSize: 14, color: C.sub, marginTop: 2 },
  chev: { fontSize: 26, color: '#C7C7CC', marginLeft: 8, marginTop: -3 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: C.label },
  emptySub: { fontSize: 15, color: C.sub, marginTop: 6, textAlign: 'center' },
  count: { textAlign: 'center', color: C.sub, fontSize: 13, marginTop: 16 },
});
