import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, Alert, TextInput, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuthToken, mobileApi } from '../services/api';
import { ServiceIntakeTimeline } from '../components/ServiceIntakeTimeline';
import { PhotoGrid } from '../components/PhotoGrid';
import {
  ServiceIntake, ServiceIntakeItem, ServiceStatus, ServiceIntakeOptions,
  STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, TAKING_TO_LABELS,
  ITEM_TYPE_OPTIONS, UNIT_TYPE_LABELS, UnitType,
} from '../types/serviceIntake';

interface Props {
  intakeId: string;
  userRole?: string;
  onClose: () => void;
  onRefreshList?: () => void;
}

const BLOCKED_ROLES = ['HR', 'IT_ADMIN', 'IT'];
const TERMINAL: ServiceStatus[] = ['REPAIRED', 'NOT_REPAIRED'];
const canEditService = (role: string) => !BLOCKED_ROLES.includes(String(role || '').toUpperCase());

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
};

export const ServiceIntakeDetailScreen: React.FC<Props> = ({ intakeId, userRole = 'ADMIN', onClose, onRefreshList }) => {
  const insets = useSafeAreaInsets();
  const canManage = canEditService(userRole);
  const [intake, setIntake] = useState<ServiceIntake | null>(null);
  const [options, setOptions] = useState<ServiceIntakeOptions | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusItemId, setStatusItemId] = useState<string | null>(null);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [responsibleItemId, setResponsibleItemId] = useState<string | null>(null);
  const [addItemVisible, setAddItemVisible] = useState(false);
  const [addType, setAddType] = useState<UnitType>('INDOOR_UNIT');
  const [addName, setAddName] = useState('');
  const [addIdentifierType, setAddIdentifierType] = useState('');
  const [addIdentifierValue, setAddIdentifierValue] = useState('');
  const [addProductId, setAddProductId] = useState<string | null>(null);
  const [addNotes, setAddNotes] = useState('');
  const [productPicker, setProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewGallery, setPreviewGallery] = useState<Array<{ id: string; uri: string }>>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const fetchIntake = useCallback(async () => {
    try {
      const res = await mobileApi.getServiceIntake(intakeId);
      if (res.success && res.data) setIntake(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load service intake.');
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, [intakeId]);

  useEffect(() => {
    fetchIntake();
    (async () => {
      const [optRes, empRes, prodRes] = await Promise.all([
        mobileApi.getServiceIntakeOptions(), mobileApi.listEmployees(), mobileApi.listProducts(),
      ]);
      if (optRes.success) setOptions(optRes.data);
      if (empRes.success && Array.isArray(empRes.data)) setEmployees(empRes.data);
      if (prodRes.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    })();
  }, [fetchIntake]);

  const imagesForItem = (itemId: string) => (intake?.images || []).filter((img) => img.itemId === itemId);

  const buildPhotoItems = (itemId: string) => imagesForItem(itemId)
    .slice()
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((img) => ({ id: img.id, uri: mobileApi.getServiceIntakeImageUrl(img.storageFileName) }));

  const openPreview = (photos: Array<{ id: string; uri: string }>, index: number) => {
    if (!photos.length) return;
    setPreviewGallery(photos);
    setPreviewIndex(Math.max(0, Math.min(index, photos.length - 1)));
  };

  const closePreview = () => {
    setPreviewGallery([]);
    setPreviewIndex(0);
  };
  const latestImage = (item: ServiceIntakeItem) => imagesForItem(item.id).slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const latestStatusEvent = (itemId: string) => (intake?.events || []).filter((e) => e.itemId === itemId && e.eventType === 'STATUS_CHANGED').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

  const hasFreshPhoto = (item: ServiceIntakeItem) => {
    const image = latestImage(item); const event = latestStatusEvent(item);
    return !!image && (!event || +new Date(image.createdAt) > +new Date(event.createdAt));
  };

  const uploadPhotos = async (itemId: string, uris: string[]) => {
    if (!canManage) return;
    for (const uri of uris) {
      try { await mobileApi.uploadServiceIntakeImage(intakeId, uri, 'image/jpeg', itemId); }
      catch (e: any) { Alert.alert('Upload failed', e.message || 'One photo could not be uploaded.'); }
    }
    await fetchIntake(); onRefreshList?.();
  };

  const changeStatus = async (status: ServiceStatus) => {
    if (!intake || !statusItemId || !canManage) return;
    const item = intake.items.find((x) => x.id === statusItemId);
    if (!item) return;
    if (status !== item.status && !TERMINAL.includes(status) && !hasFreshPhoto(item)) {
      setStatusItemId(null);
      Alert.alert('Photo required', 'Upload a new updated photo for this item before changing its service stage. Repaired / Not Repaired can be completed without another photo.');
      return;
    }
    try {
      await mobileApi.changeServiceItemStatus(intake.id, item.id, status);
      setStatusItemId(null); await fetchIntake(); onRefreshList?.();
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to change status.'); }
  };

  const addPhotosForItem = (itemId: string, uris: string[]) => uploadPhotos(itemId, uris);

  const addItem = async () => {
    if (!canManage) return;
    if (addType === 'OTHER' && !addName.trim()) return Alert.alert('Item name required', 'Enter a name for the custom item.');
    setBusy(true);
    try {
      await mobileApi.addServiceIntakeItem(intakeId, {
        itemType: addType, itemName: addName.trim() || undefined,
        productId: addProductId || undefined,
        identifierType: addIdentifierType.trim() || undefined,
        identifierValue: addIdentifierValue.trim() || undefined,
        notes: addNotes.trim() || undefined,
      });
      setAddItemVisible(false); setAddName(''); setAddIdentifierType(''); setAddIdentifierValue(''); setAddProductId(null); setAddNotes('');
      await fetchIntake(); onRefreshList?.();
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to add item.'); }
    finally { setBusy(false); }
  };

  const submitNote = async () => {
    if (!noteText.trim()) return;
    try { await mobileApi.addServiceIntakeNote(intakeId, noteText.trim(), noteItemId || undefined); setNoteText(''); setNoteItemId(null); await fetchIntake(); }
    catch (err: any) { Alert.alert('Error', err.message || 'Failed to add note.'); }
  };

  const assignResponsible = async (employeeId: string) => {
    if (!responsibleItemId) return;
    try { await mobileApi.changeServiceItemResponsible(intakeId, responsibleItemId, employeeId); setResponsibleItemId(null); await fetchIntake(); }
    catch (err: any) { Alert.alert('Error', err.message || 'Failed to assign employee.'); }
  };

  const filteredProducts = useMemo(() => products.filter((p) => !productSearch.trim() || `${p.name} ${p.model}`.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch]);

  if (isLoading || !intake) return <View style={styles.centered}><ActivityIndicator color="#10B981" /></View>;

  const customerName = intake.customer?.name || intake.customerName || 'Unnamed Customer';
  const itemCount = intake.items?.length || 0;
  const statusCounts = intake.items.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.headerTitle}>{intake.intakeNumber}</Text><Text style={styles.headerSub}>{intake.lifecycleStatus || 'OPEN'} · {itemCount} item{itemCount === 1 ? '' : 's'}</Text></View>
        {canManage && <TouchableOpacity style={styles.editBtn} onPress={() => setAddItemVisible(true)}><Text style={styles.editText}>+ Item</Text></TouchableOpacity>}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 30 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchIntake(); }} tintColor="#10B981" />}
      >
        <View style={styles.topCard}>
          <Text style={styles.customerName}>{customerName}</Text>
          {!!intake.customer?.mobile && <Text style={styles.meta}>{intake.customer.mobile}</Text>}
          <View style={styles.metaGrid}>
            {!!intake.siteName && <Text style={styles.meta}>📍 {intake.siteName}</Text>}
            {!!intake.takingTo && <Text style={styles.meta}>→ {TAKING_TO_LABELS[intake.takingTo]}</Text>}
            <Text style={styles.meta}>Reported by {intake.createdBy?.name || 'System'}</Text>
            <Text style={styles.meta}>{formatDateTime(intake.receivedAt)}</Text>
          </View>
          <View style={styles.chipsRow}>{(intake.problems || []).map((p) => <View key={p} style={styles.infoChip}><Text style={styles.infoChipText}>{p}</Text></View>)}</View>
          <View style={styles.summaryLine}>
            {Object.entries(statusCounts).map(([status, count]) => <Text key={status} style={styles.summaryText}>{count} {STATUS_LABELS[status as ServiceStatus] || status}</Text>)}
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Service Items</Text><Text style={styles.sectionHint}>Latest photo + current state</Text></View>

        {intake.items.map((item) => {
          const colors = STATUS_COLORS[item.status] || STATUS_COLORS.NOT_STARTED;
          const photos = imagesForItem(item.id);
          const image = latestImage(item);
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.itemName || item.itemTypeLabel || UNIT_TYPE_LABELS[item.itemType] || 'Service Item'}</Text>
                  {!!item.productModel && <Text style={styles.itemMeta}>Model: {item.productModel}</Text>}
                  {!!item.identifierValue && <Text style={styles.itemMeta}>{item.identifierType || 'Identifier'}: {item.identifierValue}</Text>}
                </View>
                <TouchableOpacity disabled={!canManage} onPress={() => canManage && setStatusItemId(item.id)} style={[styles.statusPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Text style={[styles.statusPillText, { color: colors.text }]}>{STATUS_LABELS[item.status] || item.status}</Text>
                </TouchableOpacity>
              </View>

              {image ? (
                <TouchableOpacity
                  onPress={() => openPreview(buildPhotoItems(item.id), Math.max(0, buildPhotoItems(item.id).length - 1))}
                  activeOpacity={0.75}
                >
                  <Text style={styles.latestLabel}>Latest photo · tap to preview{photos.length > 1 ? ` · ${photos.length} photos` : ''}</Text>
                </TouchableOpacity>
              ) : <Text style={styles.noPhoto}>No photo uploaded yet</Text>}
              <PhotoGrid
                photos={buildPhotoItems(item.id)}
                onAdd={canManage ? (uris) => addPhotosForItem(item.id, uris) : () => {}}
                onRemove={undefined}
                onPreview={(photo, index) => openPreview(buildPhotoItems(item.id), index)}
                disabled={!canManage}
              />

              {canManage && <View style={styles.itemActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setNoteItemId(item.id); }}><Text style={styles.actionText}>Add Note</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setResponsibleItemId(item.id)}><Text style={styles.actionText}>Assign</Text></TouchableOpacity>
              </View>}
            </View>
          );
        })}

        {intake.items.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No service items yet</Text><Text style={styles.emptyText}>Tap + Item to add a motor, PCB, fan, unit or custom component.</Text></View>}

        <View style={styles.timelineCard}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>History</Text>{canManage && <TouchableOpacity onPress={() => setNoteItemId('INTAKE')}><Text style={styles.addNote}>+ Add Note</Text></TouchableOpacity>}</View>
          <ServiceIntakeTimeline events={intake.events || []} />
        </View>
      </ScrollView>

      <Modal visible={!!statusItemId} transparent animationType="fade" onRequestClose={() => setStatusItemId(null)}>
        <View style={styles.overlay}><View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Update Service Status</Text>
          <Text style={styles.sheetHint}>Upload a new photo before changing to an active service stage. Completion does not require another photo.</Text>
          {STATUS_ORDER.map((status) => <TouchableOpacity key={status} style={styles.statusOption} onPress={() => changeStatus(status)}><Text style={styles.statusOptionText}>{STATUS_LABELS[status]}</Text></TouchableOpacity>)}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setStatusItemId(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={addItemVisible} animationType="slide" onRequestClose={() => setAddItemVisible(false)}>
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.header}><TouchableOpacity style={styles.backBtn} onPress={() => setAddItemVisible(false)}><Text style={styles.backText}>✕</Text></TouchableOpacity><Text style={styles.headerTitle}>Add Service Item</Text><View style={{ width: 70 }} /></View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={styles.formLabel}>Item type</Text>
            <View style={styles.typeGrid}>{ITEM_TYPE_OPTIONS.map((type) => <TouchableOpacity key={type} style={[styles.typeChip, addType === type && styles.typeChipActive]} onPress={() => setAddType(type)}><Text style={[styles.typeChipText, addType === type && styles.typeChipTextActive]}>{UNIT_TYPE_LABELS[type]}</Text></TouchableOpacity>)}</View>
            {addType === 'OTHER' && <TextInput style={styles.input} placeholder="Custom item name" value={addName} onChangeText={setAddName} />}
            <TouchableOpacity style={styles.input} onPress={() => setProductPicker(true)}><Text style={{ color: addProductId ? '#0F172A' : '#94A3B8' }}>{addProductId ? (products.find((p) => p.id === addProductId)?.model || products.find((p) => p.id === addProductId)?.name) : 'Model / Product (optional)'}</Text></TouchableOpacity>
            <TextInput style={styles.input} placeholder="Identifier type (Serial Number, Board No., Rating...)" value={addIdentifierType} onChangeText={setAddIdentifierType} />
            <TextInput style={styles.input} placeholder="Identifier value (optional)" value={addIdentifierValue} onChangeText={setAddIdentifierValue} />
            <TextInput style={[styles.input, styles.multiline]} placeholder="Notes (optional)" value={addNotes} onChangeText={setAddNotes} multiline />
            <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: .6 }]} disabled={busy} onPress={addItem}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryText}>Add Item</Text>}</TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={productPicker} animationType="slide" onRequestClose={() => setProductPicker(false)}>
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}><View style={styles.header}><TouchableOpacity style={styles.backBtn} onPress={() => setProductPicker(false)}><Text style={styles.backText}>✕</Text></TouchableOpacity><Text style={styles.headerTitle}>Select Model</Text><View style={{ width: 36 }} /></View><TextInput style={[styles.input, { margin: 16 }]} placeholder="Search model" value={productSearch} onChangeText={setProductSearch} /><ScrollView>{filteredProducts.map((p) => <TouchableOpacity key={p.id} style={styles.productRow} onPress={() => { setAddProductId(p.id); setProductPicker(false); }}><Text style={styles.customerName}>{p.name}</Text>{!!p.model && <Text style={styles.meta}>{p.model}</Text>}</TouchableOpacity>)}</ScrollView></View>
      </Modal>

      <Modal visible={previewGallery.length > 0} transparent animationType="fade" onRequestClose={closePreview}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={closePreview} activeOpacity={0.8}>
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
          {previewGallery.length > 0 && (
            <>
              <Image
                source={{
                  uri: previewGallery[previewIndex].uri,
                  headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : undefined,
                }}
                style={styles.previewImage}
                resizeMode="contain"
              />
              {previewGallery.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.galleryArrow, styles.galleryArrowLeft, previewIndex === 0 && styles.galleryArrowDisabled]}
                    disabled={previewIndex === 0}
                    onPress={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                  >
                    <Text style={styles.galleryArrowText}>‹</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.galleryArrow, styles.galleryArrowRight, previewIndex === previewGallery.length - 1 && styles.galleryArrowDisabled]}
                    disabled={previewIndex === previewGallery.length - 1}
                    onPress={() => setPreviewIndex((i) => Math.min(previewGallery.length - 1, i + 1))}
                  >
                    <Text style={styles.galleryArrowText}>›</Text>
                  </TouchableOpacity>
                </>
              )}
              <View style={styles.previewCounter}>
                <Text style={styles.previewCounterText}>{previewIndex + 1} / {previewGallery.length}</Text>
              </View>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={!!responsibleItemId} transparent animationType="fade" onRequestClose={() => setResponsibleItemId(null)}><View style={styles.overlay}><ScrollView style={styles.sheet}>{employees.map((e) => <TouchableOpacity key={e.id} style={styles.statusOption} onPress={() => assignResponsible(e.id)}><Text style={styles.statusOptionText}>{e.name}</Text><Text style={styles.sheetHint}>{e.role} · {e.employeeCode}</Text></TouchableOpacity>)}</ScrollView></View></Modal>

      <Modal visible={!!noteItemId} transparent animationType="fade" onRequestClose={() => setNoteItemId(null)}><View style={styles.overlay}><View style={styles.sheet}><Text style={styles.sheetTitle}>Add Note</Text><TextInput autoFocus style={[styles.input, styles.multiline]} placeholder="Write a note" value={noteText} onChangeText={setNoteText} multiline /><View style={styles.itemActions}><TouchableOpacity style={styles.cancelBtn} onPress={() => { setNoteItemId(null); setNoteText(''); }}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.primarySmall} onPress={submitNote}><Text style={styles.primaryText}>Add</Text></TouchableOpacity></View></View></View></Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 20, color: '#0F172A', fontWeight: '800' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' }, headerSub: { color: '#64748B', fontSize: 12, marginTop: 2 }, editBtn: { backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 }, editText: { color: '#059669', fontWeight: '800' },
  topCard: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 18, marginBottom: 18 }, customerName: { fontSize: 22, fontWeight: '800', color: '#0F172A' }, meta: { fontSize: 12, color: '#64748B', marginTop: 4 }, metaGrid: { gap: 2, marginTop: 8 }, chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }, infoChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }, infoChipText: { color: '#334155', fontSize: 11, fontWeight: '700' }, summaryLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: '#E2E8F0' }, summaryText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' }, sectionHint: { fontSize: 11, color: '#94A3B8' }, addNote: { color: '#059669', fontWeight: '800' },
  itemCard: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 }, itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, itemTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' }, itemMeta: { fontSize: 12, color: '#64748B', marginTop: 3 }, statusPill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }, statusPillText: { fontSize: 10, fontWeight: '800' }, latestLabel: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 12, marginBottom: 5 }, noPhoto: { color: '#94A3B8', fontSize: 11, marginTop: 14, marginBottom: 8 }, itemActions: { flexDirection: 'row', gap: 8, marginTop: 8 }, actionBtn: { paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }, actionText: { color: '#334155', fontSize: 11, fontWeight: '800' }, emptyCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }, emptyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' }, emptyText: { fontSize: 12, color: '#64748B', marginTop: 5 }, timelineCard: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '80%' }, sheetTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 6 }, sheetHint: { color: '#64748B', fontSize: 12, lineHeight: 18, marginBottom: 8 }, statusOption: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' }, statusOptionText: { fontSize: 14, fontWeight: '700', color: '#0F172A' }, cancelBtn: { marginTop: 12, paddingVertical: 12, alignItems: 'center' }, cancelText: { color: '#64748B', fontWeight: '800' },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '78%' },
  previewClose: { position: 'absolute', top: 50, right: 18, zIndex: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  previewCloseText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  galleryArrow: { position: 'absolute', top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  galleryArrowLeft: { left: 12 }, galleryArrowRight: { right: 12 }, galleryArrowDisabled: { opacity: 0.25 },
  galleryArrowText: { color: '#FFFFFF', fontSize: 38, lineHeight: 42, fontWeight: '300' },
  previewCounter: { position: 'absolute', bottom: 48, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)' },
  previewCounterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }, typeChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }, typeChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' }, typeChipText: { fontSize: 12, color: '#334155', fontWeight: '700' }, typeChipTextActive: { color: '#FFF' }, input: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, color: '#0F172A', marginBottom: 10 }, multiline: { minHeight: 80, textAlignVertical: 'top' }, formLabel: { fontSize: 13, fontWeight: '800', color: '#334155', marginBottom: 8 }, primaryBtn: { backgroundColor: '#059669', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 8 }, primarySmall: { backgroundColor: '#059669', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 }, primaryText: { color: '#FFF', fontWeight: '800' }, productRow: { backgroundColor: '#FFF', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
});
