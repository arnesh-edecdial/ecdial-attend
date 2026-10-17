import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { downloadAndSaveFile, shareDocument } from '../services/fileDownloader';
import {
  C,
  SpecTable,
  extractBrand,
  imgSource,
  pdfRequest,
  productImages,
  specsToTables,
  titleCase,
} from './catalogueShared';

const LABEL_W = 124;
const COL_W = 132;
const HEAD_H = 54;
const ROW_H = 46;

/* ---------------- Spec matrix (label column pinned, models scroll) ---------------- */
const SpecMatrix = memo(({ t }: { t: SpecTable }) => {
  const { width } = useWindowDimensions();
  // few models: stretch to fill the card; many models: fixed width + swipe sideways
  const colW = Math.max(COL_W, Math.floor((width - 40 - LABEL_W) / Math.max(1, t.columns.length)));
  return (
  <View style={s.matrix}>
    <View style={{ width: LABEL_W }}>
      <View style={[s.cornerCell, { height: HEAD_H }]}>
        <Text style={s.cornerText}>IDU{'\n'}ODU</Text>
      </View>
      {t.rows.map((r, i) => (
        <View key={r.id} style={[s.labelCell, i % 2 === 1 && s.zebra]}>
          <Text maxFontSizeMultiplier={1.15} style={s.labelText} numberOfLines={2}>
            {r.label}
            {!!r.unit && <Text maxFontSizeMultiplier={1.15} style={s.unitText}>{`  ${r.unit}`}</Text>}
          </Text>
        </View>
      ))}
    </View>

    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} bounces style={{ flex: 1 }}>
      <View>
        <View style={{ flexDirection: 'row', height: HEAD_H }}>
          {t.columns.map((c) => (
            <View key={c.id} style={[s.headCell, { width: colW }]}>
              <Text maxFontSizeMultiplier={1.15} style={s.headIdu} numberOfLines={1}>{c.idu || '—'}</Text>
              {!!c.odu && <Text maxFontSizeMultiplier={1.15} style={s.headOdu} numberOfLines={1}>{c.odu}</Text>}
            </View>
          ))}
        </View>
        {t.rows.map((r, i) => (
          <View key={r.id} style={[s.valRow, i % 2 === 1 && s.zebra]}>
            {t.columns.map((c) => (
              <View key={c.id} style={[s.valCell, { width: colW }]}>
                <Text maxFontSizeMultiplier={1.15} style={s.valText} numberOfLines={2}>{r.values[c.id] || '—'}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  </View>
  );
});

/* ---------------- Banner carousel ---------------- */
const Banner = memo(({ images, onOpen }: { images: any[]; onOpen: (i: number) => void }) => {
  const { width } = useWindowDimensions();
  const bw = width - 40;
  const bh = Math.round(bw * 0.56);
  const [idx, setIdx] = useState(0);
  const onEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => setIdx(Math.round(e.nativeEvent.contentOffset.x / bw)),
    [bw]
  );
  return (
    <View style={{ height: bh, borderRadius: 20, overflow: 'hidden', backgroundColor: C.fill }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(im, i) => String(im.id || im.storageFileName || i)}
        getItemLayout={(_, i) => ({ length: bw, offset: bw * i, index: i })}
        onMomentumScrollEnd={onEnd}
        initialNumToRender={1}
        windowSize={3}
        renderItem={({ item, index }) => (
          <Pressable onPress={() => onOpen(index)}>
            <Image source={imgSource(item)} style={{ width: bw, height: bh }} resizeMode="cover" />
          </Pressable>
        )}
      />
      {images.length > 1 && (
        <View style={s.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[s.dot, i === idx && s.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
});

/* ---------------- Fullscreen swipe viewer ---------------- */
const Viewer = ({ images, start, onClose }: { images: any[]; start: number; onClose: () => void }) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(start);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          keyExtractor={(im, i) => String(im.id || im.storageFileName || i)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}
          windowSize={3}
          renderItem={({ item }) => (
            <ScrollView
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ width, height, justifyContent: 'center' }}
            >
              <Image source={imgSource(item)} style={{ width, height: height * 0.8 }} resizeMode="contain" />
            </ScrollView>
          )}
        />
        <View style={[s.vTop, { top: insets.top + 8 }]}>
          <Text style={s.vCount}>{idx + 1} / {images.length}</Text>
          <Pressable onPress={onClose} style={s.vClose} hitSlop={10}>
            <Text style={s.vX}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

/* ---------------- Sheet ---------------- */
interface Props {
  visible: boolean;
  product: any | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
}

export const CatalogueDetailSheet: React.FC<Props> = ({ visible, product, canEdit, onClose, onEdit, onDelete }) => {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'dl' | 'share' | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const images = useMemo(() => (product ? productImages(product) : []), [product]);
  const tables = useMemo(() => (product ? specsToTables(product.specifications) : []), [product]);

  const runPdf = useCallback(
    async (mode: 'dl' | 'share') => {
      if (!product || busy) return;
      setBusy(mode);
      try {
        const req = pdfRequest(product);
        if (mode === 'dl') {
          const r = await downloadAndSaveFile({ ...req, dialogTitle: `Save ${product.name}`, showShareFallbackOnAndroid: true });
          if (r.success) Alert.alert('Saved', `${r.filename} was saved.`);
          else if (!r.userCancelled) Alert.alert('Download failed', r.error || 'Could not save the PDF.');
        } else {
          const r = await shareDocument(req);
          if (!r.success && r.error) Alert.alert('Share failed', r.error);
        }
      } catch (e: any) {
        Alert.alert('Something went wrong', e?.message || 'Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [product, busy]
  );

  if (!product) return null;

  const p = product;
  const brand = extractBrand(p);
  const hasPdf = !!p.catalogueDocId;
  const price = Number(p.defaultPrice) || 0;
  const subtitle = [p.model, price > 0 ? `₹${price.toLocaleString('en-IN')}` : ''].filter(Boolean).join('  ·  ');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.grabRow}>
            <View style={s.grab} />
            <Pressable style={s.close} onPress={onClose} hitSlop={8}>
              <Text style={s.closeX}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
            <View style={s.chips}>
              <View style={s.chipBrand}><Text style={s.chipBrandText}>{brand}</Text></View>
              <View style={s.chipType}><Text style={s.chipTypeText}>{titleCase(p.acType || 'SPLIT')}</Text></View>
            </View>

            <Text style={s.h1} accessibilityRole="header">{p.name}</Text>
            {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}

            {images.length > 0 && (
              <View style={{ marginTop: 18 }}>
                <Banner images={images} onOpen={setViewer} />
              </View>
            )}

            {!!p.description?.trim() && <Text style={s.desc}>{p.description.trim()}</Text>}

            {tables.length > 0 && (
              <View style={{ marginTop: 22 }}>
                <Text style={s.sec}>Specifications</Text>
                {tables.map((t) => (
                  <View key={t.id} style={{ marginBottom: 16 }}>
                    {!!t.title && <Text style={s.tTitle}>{t.title}</Text>}
                    <SpecMatrix t={t} />
                  </View>
                ))}
                {tables.some((t) => t.columns.length > 2) && <Text style={s.hint}>Swipe the table sideways to see every model</Text>}
              </View>
            )}

            {hasPdf && (
              <View style={{ marginTop: 10 }}>
                <Text style={s.sec}>Catalogue</Text>
                <View style={s.group}>
                  <View style={s.pdfRow}>
                    <View style={s.pdfIcon}><Text style={s.pdfIconText}>PDF</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pdfTitle}>Product catalogue</Text>
                      <Text style={s.pdfSub}>Uploaded PDF</Text>
                    </View>
                  </View>
                  <View style={s.pdfActions}>
                    <Pressable
                      style={({ pressed }) => [s.btnPrimary, pressed && { opacity: 0.8 }]}
                      onPress={() => runPdf('dl')}
                      disabled={!!busy}
                    >
                      {busy === 'dl' ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Download</Text>}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [s.btnSecondary, pressed && { opacity: 0.7 }]}
                      onPress={() => runPdf('share')}
                      disabled={!!busy}
                    >
                      {busy === 'share' ? <ActivityIndicator color={C.blue} /> : <Text style={s.btnSecondaryText}>Share</Text>}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

            {canEdit && (
              <View style={[s.group, { marginTop: 26 }]}>
                <Pressable style={({ pressed }) => [s.listBtn, pressed && s.listBtnOn]} onPress={() => onEdit(p)}>
                  <Text style={s.listBtnBlue}>Edit catalogue</Text>
                </Pressable>
                <View style={s.hair} />
                <Pressable style={({ pressed }) => [s.listBtn, pressed && s.listBtnOn]} onPress={() => onDelete(p)}>
                  <Text style={s.listBtnRed}>Delete catalogue</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>

        {viewer !== null && <Viewer images={images} start={viewer} onClose={() => setViewer(null)} />}
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '94%' },
  grabRow: { alignItems: 'center', paddingTop: 8, height: 40 },
  grab: { width: 38, height: 5, borderRadius: 3, backgroundColor: '#C7C7CC' },
  close: { position: 'absolute', right: 14, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: '#E3E3E8', alignItems: 'center', justifyContent: 'center' },
  closeX: { fontSize: 13, color: C.sub, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingBottom: 24 },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipBrand: { backgroundColor: C.blueSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipBrandText: { color: C.blue, fontSize: 12, fontWeight: '700' },
  chipType: { backgroundColor: C.fill, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chipTypeText: { color: '#3C3C43', fontSize: 12, fontWeight: '600' },

  h1: { fontSize: 28, lineHeight: 33, fontWeight: '700', color: C.label, letterSpacing: 0.3 },
  subtitle: { fontSize: 15, color: C.sub, marginTop: 4 },
  desc: { fontSize: 15, lineHeight: 22, color: '#3C3C43', marginTop: 16 },

  sec: { fontSize: 13, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginLeft: 4 },
  tTitle: { fontSize: 16, fontWeight: '600', color: C.label, marginBottom: 8, marginLeft: 4 },
  hint: { fontSize: 12, color: C.sub, textAlign: 'center', marginTop: -6 },

  matrix: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, overflow: 'hidden' },
  cornerCell: { backgroundColor: C.head, justifyContent: 'center', paddingLeft: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  cornerText: { fontSize: 10, fontWeight: '700', color: C.sub, lineHeight: 14, letterSpacing: 0.5 },
  headCell: { width: COL_W, height: HEAD_H, backgroundColor: C.head, justifyContent: 'center', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  headIdu: { fontSize: 12, fontWeight: '700', color: C.label },
  headOdu: { fontSize: 11, color: C.sub, marginTop: 2 },
  labelCell: { height: ROW_H, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, backgroundColor: C.card },
  labelText: { fontSize: 12.5, fontWeight: '600', color: C.label, lineHeight: 16 },
  unitText: { fontWeight: '400', color: C.sub, fontSize: 11 },
  valRow: { flexDirection: 'row', height: ROW_H, backgroundColor: C.card, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  valCell: { width: COL_W, justifyContent: 'center', paddingHorizontal: 10 },
  valText: { fontSize: 13, color: C.label, lineHeight: 17 },
  zebra: { backgroundColor: '#FAFAFC' },

  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { backgroundColor: '#fff' },

  group: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pdfIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#FFEBEA', alignItems: 'center', justifyContent: 'center' },
  pdfIconText: { fontSize: 11, fontWeight: '800', color: C.red },
  pdfTitle: { fontSize: 16, fontWeight: '600', color: C.label },
  pdfSub: { fontSize: 13, color: C.sub, marginTop: 1 },
  pdfActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 },
  btnPrimary: { flex: 1, height: 44, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondary: { flex: 1, height: 44, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { color: C.blue, fontSize: 16, fontWeight: '600' },

  listBtn: { height: 50, alignItems: 'center', justifyContent: 'center' },
  listBtnOn: { backgroundColor: '#F2F2F7' },
  listBtnBlue: { color: C.blue, fontSize: 17 },
  listBtnRed: { color: C.red, fontSize: 17 },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },

  vTop: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vCount: { color: '#fff', fontSize: 14, fontWeight: '600' },
  vClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  vX: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
