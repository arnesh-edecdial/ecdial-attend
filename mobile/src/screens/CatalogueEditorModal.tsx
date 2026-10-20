import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi } from '../services/api';
import {
  AC_TYPES,
  BRANDS,
  C,
  SpecColumn,
  SpecRow,
  SpecTable,
  extractBrand,
  imgSource,
  newTable,
  productImages,
  specsToTables,
  tablesToSpecs,
  titleCase,
  uid,
} from './catalogueShared';
import { CataloguePdfPicker, PickedPdf, fmtPdfSize } from './CataloguePdfPicker';

/* ------------------------------------------------------------------ */
/* Matrix editor pieces (memoised: typing in one cell re-renders only  */
/* that row, never the whole form)                                     */
/* ------------------------------------------------------------------ */
type Mutate = (tid: string, fn: (t: SpecTable) => SpecTable) => void;

const LABEL_W = 150;
const COL_W = 136;
const HEAD_H = 84;
const ROW_H = 60;

const confirmThen = (title: string, msg: string, fn: () => void) =>
  Alert.alert(title, msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: fn },
  ]);

const EditLabel = memo(({ row, tid, mutate }: { row: SpecRow; tid: string; mutate: Mutate }) => (
  <View style={s.eLabel}>
    <View style={{ flex: 1 }}>
      <TextInput
        style={s.eLabelIn}
        value={row.label}
        placeholder="Attribute"
        placeholderTextColor={C.line}
        onChangeText={(v) => mutate(tid, (t) => ({ ...t, rows: t.rows.map((r) => (r.id === row.id ? { ...r, label: v } : r)) }))}
      />
      <TextInput
        style={s.eUnitIn}
        value={row.unit}
        placeholder="Unit"
        placeholderTextColor={C.line}
        onChangeText={(v) => mutate(tid, (t) => ({ ...t, rows: t.rows.map((r) => (r.id === row.id ? { ...r, unit: v } : r)) }))}
      />
    </View>
    <Pressable
      hitSlop={8}
      onPress={() => {
        const del = () => mutate(tid, (t) => ({ ...t, rows: t.rows.filter((r) => r.id !== row.id) }));
        if (Object.values(row.values).some((v) => v)) confirmThen('Delete row', `Remove “${row.label || 'this row'}” and its values?`, del);
        else del();
      }}
    >
      <Text style={s.x}>✕</Text>
    </Pressable>
  </View>
));

const EditHead = memo(({ col, tid, mutate, canRemove }: { col: SpecColumn; tid: string; mutate: Mutate; canRemove: boolean }) => {
  const set = (field: 'idu' | 'odu', v: string) =>
    mutate(tid, (t) => ({ ...t, columns: t.columns.map((c) => (c.id === col.id ? { ...c, [field]: v } : c)) }));
  return (
    <View style={s.eHead}>
      <TextInput style={s.eHeadIn} value={col.idu} placeholder="IDU model" placeholderTextColor={C.line} onChangeText={(v) => set('idu', v)} autoCapitalize="characters" />
      <TextInput style={[s.eHeadIn, { marginTop: 4 }]} value={col.odu} placeholder="ODU model" placeholderTextColor={C.line} onChangeText={(v) => set('odu', v)} autoCapitalize="characters" />
      {canRemove && (
        <Pressable
          style={s.headX}
          hitSlop={8}
          onPress={() => {
            const del = () =>
              mutate(tid, (t) => ({
                ...t,
                columns: t.columns.filter((c) => c.id !== col.id),
                rows: t.rows.map((r) => {
                  const { [col.id]: _drop, ...rest } = r.values;
                  return { ...r, values: rest };
                }),
              }));
            confirmThen('Delete column', `Remove ${col.idu || 'this model'} and all its values?`, del);
          }}
        >
          <Text style={s.x}>✕</Text>
        </Pressable>
      )}
    </View>
  );
});

const EditValues = memo(({ row, columns, tid, mutate }: { row: SpecRow; columns: SpecColumn[]; tid: string; mutate: Mutate }) => (
  <View style={{ flexDirection: 'row', height: ROW_H }}>
    {columns.map((c) => (
      <View key={c.id} style={s.eCell}>
        <TextInput
          style={s.eCellIn}
          multiline
          value={row.values[c.id] || ''}
          placeholder="—"
          placeholderTextColor={C.line}
          onChangeText={(v) =>
            mutate(tid, (t) => ({
              ...t,
              rows: t.rows.map((r) => (r.id === row.id ? { ...r, values: { ...r.values, [c.id]: v.replace(/\n/g, ' ') } } : r)),
            }))
          }
        />
      </View>
    ))}
  </View>
));

const TableEditor = memo(
  ({ t, index, mutate, onDelete }: { t: SpecTable; index: number; mutate: Mutate; onDelete: (id: string) => void }) => (
    <View style={s.tCard}>
      <View style={s.tTop}>
        <TextInput
          style={s.tTitleIn}
          value={t.title}
          placeholder={`Table ${index + 1} title (optional)`}
          placeholderTextColor={C.sub}
          onChangeText={(v) => mutate(t.id, (x) => ({ ...x, title: v }))}
        />
        <Pressable onPress={() => onDelete(t.id)} hitSlop={8}>
          <Text style={s.redText}>Delete</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: LABEL_W }}>
          <View style={[s.eCorner, { height: HEAD_H }]}>
            <Text style={s.cornerText}>IDU{'\n'}ODU</Text>
          </View>
          {t.rows.map((r) => (
            <EditLabel key={r.id} row={r} tid={t.id} mutate={mutate} />
          ))}
        </View>
        <ScrollView horizontal nestedScrollEnabled keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator style={{ flex: 1 }}>
          <View>
            <View style={{ flexDirection: 'row', height: HEAD_H }}>
              {t.columns.map((c) => (
                <EditHead key={c.id} col={c} tid={t.id} mutate={mutate} canRemove={t.columns.length > 1} />
              ))}
            </View>
            {t.rows.map((r) => (
              <EditValues key={r.id} row={r} columns={t.columns} tid={t.id} mutate={mutate} />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={s.tBtns}>
        <Pressable
          style={s.pill}
          onPress={() => mutate(t.id, (x) => ({ ...x, rows: [...x.rows, { id: uid('r'), label: '', unit: '', values: {} }] }))}
        >
          <Text style={s.pillText}>+ Row</Text>
        </Pressable>
        <Pressable
          style={s.pill}
          onPress={() => mutate(t.id, (x) => ({ ...x, columns: [...x.columns, { id: uid('c'), idu: '', odu: '' }] }))}
        >
          <Text style={s.pillText}>+ Model column</Text>
        </Pressable>
      </View>
    </View>
  )
);

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */
interface Props {
  product: any | null; // null = create
  onClose: () => void;
  onSaved: (id?: string) => void;
}

export const CatalogueEditorModal: React.FC<Props> = ({ product, onClose, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const editing = !!product?.id;

  const initialBrand = product ? extractBrand(product) : 'Daikin';
  const [custom, setCustom] = useState(!!product && !BRANDS.includes(initialBrand));
  const [brand, setBrand] = useState(initialBrand);
  const [name, setName] = useState(product?.name || '');
  const [model, setModel] = useState(product?.model || '');
  const [acType, setAcType] = useState(String(product?.acType || 'SPLIT').toUpperCase());
  const [price, setPrice] = useState(product?.defaultPrice ? String(product.defaultPrice) : '');
  const [desc, setDesc] = useState(product?.description || '');

  const [images, setImages] = useState<any[]>(() =>
    productImages(product).map((i: any) => ({
      id: String(i.id || i.storageFileName),
      storageFileName: i.storageFileName || '',
      imageUrl: i.imageUrl,
      signedUrl: i.signedUrl,
    }))
  );
  const [uploading, setUploading] = useState(0);

  // Selected PDF = reference to an already-uploaded Catalogue record (uploads happen on the web admin page).
  const [pdf, setPdf] = useState<PickedPdf | null>(
    product?.catalogueDocId ? { id: String(product.catalogueDocId), name: '' } : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasPdf = !!pdf;

  // Resolve the display name of the PDF already linked to this catalogue (one request).
  useEffect(() => {
    if (!product?.catalogueDocId) return;
    let alive = true;
    mobileApi
      .getCatalogue(String(product.catalogueDocId))
      .then((r) => alive && r?.data && setPdf({ id: String(r.data.id), name: r.data.displayName || r.data.fileName, size: r.data.fileSize }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [product?.catalogueDocId]);

  const [tables, setTables] = useState<SpecTable[]>(() => specsToTables(product?.specifications));
  const [saving, setSaving] = useState(false);

  const mutate = useCallback<Mutate>((tid, fn) => setTables((cur) => cur.map((t) => (t.id === tid ? fn(t) : t))), []);
  const deleteTable = useCallback(
    (tid: string) => confirmThen('Delete table', 'This whole table and its values will be removed.', () => setTables((c) => c.filter((t) => t.id !== tid))),
    []
  );

  /* ---------- photos ---------- */
  const addPhotos = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', source === 'camera' ? 'Allow camera access to take photos.' : 'Allow photo library access to choose photos.');
        return;
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true, mediaTypes: ['images'] });
      if (res.canceled || !res.assets?.length) return;

      if (!editing) {
        // new product: hold locally, upload after the product exists
        setImages((cur) => [
          ...cur,
          ...res.assets.map((a, i) => ({ id: `pending_${Date.now()}_${i}`, storageFileName: '', imageUrl: a.uri, signedUrl: a.uri })),
        ]);
        return;
      }
      setUploading((n) => n + res.assets.length);
      // one at a time: parallel uploads can overwrite each other on the server
      for (const a of res.assets) {
        try {
          const up = await mobileApi.uploadProductImage(product.id, a.uri, 'image/jpeg');
          if (up?.success && up.data) {
            setImages((cur) => [
              ...cur,
              { id: up.data.id || up.data.storageFileName, storageFileName: up.data.storageFileName, imageUrl: up.data.imageUrl, signedUrl: up.data.signedUrl || a.uri },
            ]);
          }
        } catch (e: any) {
          Alert.alert('Upload failed', e?.message || 'Could not upload this photo.');
        } finally {
          setUploading((n) => Math.max(0, n - 1));
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not open photos.');
    }
  };

  const photoMenu = () =>
    Alert.alert('Add photo', undefined, [
      { text: 'Take Photo', onPress: () => addPhotos('camera') },
      { text: 'Choose from Library', onPress: () => addPhotos('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const removeImage = (img: any) =>
    confirmThen('Remove photo', 'Remove this photo from the catalogue?', async () => {
      if (editing && img.storageFileName) {
        try { await mobileApi.deleteProductImage(product.id, img.storageFileName); } catch (e) { console.warn('[delete photo]', e); }
      }
      setImages((cur) => cur.filter((x) => x.id !== img.id));
    });

  /* ---------- pdf ---------- */
  /* ---------- save ---------- */
  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a catalogue name.');
      return;
    }
    setSaving(true);
    try {
      const finalBrand = brand.trim() || 'Other';
      const payload: any = {
        name: name.trim(),
        model: model.trim() || null,
        brand: finalBrand,
        category: product?.category || 'MAIN_UNIT',
        acType,
        description: desc.trim(),
        defaultPrice: parseFloat(price) || 0,
        // stock is no longer edited here; keep whatever the server already has
        availableStock: product?.availableStock ?? 0,
        defaultUnit: product?.defaultUnit || 'Nos',
        specifications: tablesToSpecs(tables),
        catalogueDocId: pdf?.id ?? null,
        images: images.filter((i) => !String(i.id).startsWith('pending_')),
      };

      let savedId: string | undefined = product?.id;
      if (editing) {
        const res = await mobileApi.updateProduct(product.id, payload);
        if (!res?.success) throw new Error(res?.message || 'Could not update the catalogue.');
      } else {
        const res = await mobileApi.createProduct(payload);
        if (!res?.success || !res.data) throw new Error(res?.message || 'Could not create the catalogue.');
        savedId = res.data.id;
        const pending = images.filter((i) => String(i.id).startsWith('pending_'));
        for (const i of pending) {
          try {
            await mobileApi.uploadProductImage(savedId as string, i.signedUrl || i.imageUrl, 'image/jpeg');
          } catch (e: any) {
            console.warn('[pending photo]', e);
          }
        }
      }

      onSaved(savedId);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const gap = 10;
  const tile = Math.floor((width - 32 - 32 - gap * 2) / 3);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.nav, { paddingTop: Platform.OS === 'ios' ? 0 : Math.max(insets.top, 8) }]}>
          <Pressable onPress={onClose} disabled={saving} hitSlop={10} style={s.navSide}>
            <Text style={s.navBlue}>Cancel</Text>
          </Pressable>
          <Text style={s.navTitle}>{editing ? 'Edit Catalogue' : 'New Catalogue'}</Text>
          <Pressable onPress={() => save()} disabled={saving} hitSlop={10} style={[s.navSide, { alignItems: 'flex-end' }]}>
            {saving ? <ActivityIndicator color={C.blue} /> : <Text style={[s.navBlue, { fontWeight: '700' }]}>Save</Text>}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 40 }}
        >
          {/* DETAILS */}
          <Text style={s.sec}>Details</Text>
          <View style={s.group}>
            <Text style={s.lbl}>Brand</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 12 }}>
              {BRANDS.map((b) => {
                const on = !custom && brand === b;
                return (
                  <Pressable key={b} style={[s.chip, on && s.chipOn]} onPress={() => { setBrand(b); setCustom(false); }}>
                    <Text style={[s.chipText, on && s.chipTextOn]}>{b}</Text>
                  </Pressable>
                );
              })}
              <Pressable style={[s.chip, custom && s.chipOn]} onPress={() => { setCustom(true); if (BRANDS.includes(brand)) setBrand(''); }}>
                <Text style={[s.chipText, custom && s.chipTextOn]}>Other…</Text>
              </Pressable>
            </ScrollView>
            {custom && (
              <>
                <View style={s.hair} />
                <TextInput style={s.input} placeholder="Brand name" placeholderTextColor={C.sub} value={brand} onChangeText={setBrand} />
              </>
            )}
            <View style={s.hair} />
            <TextInput style={s.input} placeholder="Name (e.g. FTKL Inverter Split AC)" placeholderTextColor={C.sub} value={name} onChangeText={setName} />
            <View style={s.hair} />
            <TextInput style={s.input} placeholder="Model / series (e.g. 1.5 to 3 Star)" placeholderTextColor={C.sub} value={model} onChangeText={setModel} />
            <View style={s.hair} />
            <TextInput style={s.input} placeholder="Catalogue rate in ₹ (optional)" placeholderTextColor={C.sub} value={price} onChangeText={setPrice} keyboardType="numeric" />
            <View style={s.hair} />
            <View style={s.segment}>
              {AC_TYPES.map((t) => (
                <Pressable key={t} style={[s.seg, acType === t && s.segOn]} onPress={() => setAcType(t)}>
                  <Text style={[s.segText, acType === t && s.segTextOn]}>{titleCase(t)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.hair} />
            <TextInput style={[s.input, { height: 84, textAlignVertical: 'top', paddingTop: 12 }]} placeholder="Description (optional)" placeholderTextColor={C.sub} value={desc} onChangeText={setDesc} multiline />
          </View>

          {/* PHOTOS */}
          <Text style={s.sec}>Photos</Text>
          <View style={[s.group, { padding: 16 }]}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
              {images.map((img) => (
                <View key={img.id} style={{ width: tile, height: tile }}>
                  <Image source={imgSource(img)} style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: C.fill }} />
                  <Pressable style={s.imgX} hitSlop={6} onPress={() => removeImage(img)}>
                    <Text style={s.imgXText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={[s.addTile, { width: tile, height: tile }]} onPress={photoMenu}>
                {uploading > 0 ? <ActivityIndicator color={C.blue} /> : <Text style={s.addPlus}>+</Text>}
              </Pressable>
            </View>
            {images.length === 0 && <Text style={s.help}>Optional. The first photo is used as the thumbnail.</Text>}
          </View>

          {/* PDF */}
          <Text style={s.sec}>Catalogue PDF</Text>
          <View style={s.group}>
            {hasPdf ? (
              <View style={s.pdfRow}>
                <View style={s.pdfIcon}><Text style={s.pdfIconText}>PDF</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pdfName} numberOfLines={1}>{pdf?.name || 'Catalogue PDF attached'}</Text>
                  {!!fmtPdfSize(pdf?.size) && <Text style={s.help2}>{fmtPdfSize(pdf?.size)}</Text>}
                </View>
              </View>
            ) : (
              <Text style={[s.help, { padding: 14 }]}>Optional. Without a PDF, a catalogue is generated from the tables.</Text>
            )}
            <View style={s.hair} />
            <View style={{ flexDirection: 'row' }}>
              <Pressable style={s.rowBtn} onPress={() => setPickerOpen(true)}>
                <Text style={s.navBlue}>{hasPdf ? 'Change PDF' : 'Select PDF'}</Text>
              </Pressable>
              {hasPdf && (
                <>
                  <View style={s.vHair} />
                  <Pressable style={s.rowBtn} onPress={() => setPdf(null)}>
                    <Text style={[s.navBlue, { color: C.red }]}>Remove</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
          {pickerOpen && (
            <CataloguePdfPicker
              selectedId={pdf?.id}
              onClose={() => setPickerOpen(false)}
              onSelect={(p) => {
                setPdf(p);
                setPickerOpen(false);
              }}
            />
          )}

          {/* TABLES */}
          <View style={s.secRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sec, { marginBottom: 0 }]}>Specification tables</Text>
              <Text style={s.help2}>Optional. Columns are IDU + ODU models; rows are attributes.</Text>
            </View>
            <Pressable style={s.pillBlue} onPress={() => setTables((c) => [...c, newTable()])}>
              <Text style={s.pillBlueText}>+ Add table</Text>
            </Pressable>
          </View>
          {tables.map((t, i) => (
            <TableEditor key={t.id} t={t} index={i} mutate={mutate} onDelete={deleteTable} />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, backgroundColor: C.bg },
  navSide: { width: 70 },
  navTitle: { fontSize: 17, fontWeight: '600', color: C.label },
  navBlue: { fontSize: 17, color: C.blue },

  sec: { fontSize: 13, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 22, marginBottom: 8, marginLeft: 4 },
  secRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 22, marginBottom: 10, gap: 10 },
  group: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 14 },
  vHair: { width: StyleSheet.hairlineWidth, backgroundColor: C.line },
  lbl: { fontSize: 13, color: C.sub, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  input: { fontSize: 16, color: C.label, paddingHorizontal: 14, height: 48 },
  help: { fontSize: 13, color: C.sub, marginTop: 4 },
  help2: { fontSize: 12, color: C.sub, marginTop: 2 },

  chip: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: C.fill, justifyContent: 'center' },
  chipOn: { backgroundColor: C.blue },
  chipText: { fontSize: 14, color: C.label, fontWeight: '500' },
  chipTextOn: { color: '#fff' },

  segment: { flexDirection: 'row', margin: 10, padding: 2, borderRadius: 9, backgroundColor: C.fill },
  seg: { flex: 1, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 13, color: C.label },
  segTextOn: { fontWeight: '600' },

  addTile: { borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  addPlus: { fontSize: 30, color: C.blue, fontWeight: '300' },
  imgX: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  imgXText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pdfIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFEBEA', alignItems: 'center', justifyContent: 'center' },
  pdfIconText: { fontSize: 11, fontWeight: '800', color: C.red },
  pdfName: { fontSize: 15, fontWeight: '600', color: C.label },
  rowBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },

  pillBlue: { backgroundColor: C.blueSoft, paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center' },
  pillBlueText: { color: C.blue, fontSize: 14, fontWeight: '600' },

  tCard: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  tTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 48, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  tTitleIn: { flex: 1, fontSize: 16, fontWeight: '600', color: C.label, height: 44 },
  redText: { color: C.red, fontSize: 15 },
  tBtns: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  pill: { backgroundColor: C.fill, paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center' },
  pillText: { fontSize: 14, color: C.label, fontWeight: '500' },

  eCorner: { backgroundColor: C.head, justifyContent: 'center', paddingLeft: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  cornerText: { fontSize: 10, fontWeight: '700', color: C.sub, lineHeight: 14, letterSpacing: 0.5 },
  eHead: { width: COL_W, height: HEAD_H, backgroundColor: C.head, padding: 8, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, borderLeftWidth: StyleSheet.hairlineWidth },
  eHeadIn: { height: 32, fontSize: 12, fontWeight: '600', color: C.label, backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 8, paddingRight: 22 },
  headX: { position: 'absolute', top: 12, right: 14 },
  eLabel: { height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  eLabelIn: { height: 30, fontSize: 13, fontWeight: '600', color: C.label, padding: 0 },
  eUnitIn: { height: 22, fontSize: 11, color: C.sub, padding: 0 },
  eCell: { width: COL_W, height: ROW_H, borderBottomWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.line, justifyContent: 'center' },
  eCellIn: { fontSize: 13, color: C.label, paddingHorizontal: 10, maxHeight: ROW_H - 8, textAlignVertical: 'center' },
  x: { color: C.sub, fontSize: 12, fontWeight: '700' },
});
