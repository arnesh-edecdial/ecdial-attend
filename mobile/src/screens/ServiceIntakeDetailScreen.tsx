import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, Alert, TextInput, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { ServiceIntakeTimeline } from '../components/ServiceIntakeTimeline';
import { PhotoGrid, PhotoItem } from '../components/PhotoGrid';
import {
  ServiceIntake, ServiceIntakeItem, ServiceStatus, TakingTo, ServiceIntakeOptions,
  STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, TAKING_TO_LABELS,
  ITEM_TYPE_OPTIONS, UNIT_TYPE_LABELS, ItemType,
} from '../types/serviceIntake';

interface Props { intakeId: string; userRole?: string; onClose: () => void; onRefreshList?: () => void; }
const BLOCKED_ROLES = ['HR', 'IT_ADMIN', 'IT'];
const canEditService = (role: string) => !BLOCKED_ROLES.includes(String(role || '').toUpperCase());
const formatDateTime = (iso: string) => { try { return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return iso; } };

export const ServiceIntakeDetailScreen: React.FC<Props> = ({ intakeId, userRole = 'ADMIN', onClose, onRefreshList }) => {
  const insets = useSafeAreaInsets();
  const canManage = canEditService(userRole);
  const [intake, setIntake] = useState<ServiceIntake | null>(null);
  const [options, setOptions] = useState<ServiceIntakeOptions | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusItemId, setStatusItemId] = useState<string | null>(null);
  const [stageTarget, setStageTarget] = useState<{ itemId: string; status: ServiceStatus } | null>(null);
  const [stagePhotos, setStagePhotos] = useState<PhotoItem[]>([]);
  const [stageBusy, setStageBusy] = useState(false);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [responsibleItemId, setResponsibleItemId] = useState<string | null>(null);
  const [addItemVisible, setAddItemVisible] = useState(false);
  const [addType, setAddType] = useState<ItemType>('INDOOR_UNIT');
  const [addName, setAddName] = useState('');
  const [addIdentifierType, setAddIdentifierType] = useState('');
  const [addIdentifierValue, setAddIdentifierValue] = useState('');
  const [addProductId, setAddProductId] = useState<string | null>(null);
  const [addNotes, setAddNotes] = useState('');
  const [productPicker, setProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [previewGallery, setPreviewGallery] = useState<Array<{ id: string; uri: string }>>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [itemDeleteBusy, setItemDeleteBusy] = useState(false);
  const [editIntakeVisible, setEditIntakeVisible] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editSite, setEditSite] = useState('');
  const [editProblems, setEditProblems] = useState<string[]>([]);
  const [editTakingTo, setEditTakingTo] = useState<TakingTo>('SHOWROOM');
  const [editNotes, setEditNotes] = useState('');
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [customerPicker, setCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemIdentifierType, setEditItemIdentifierType] = useState('');
  const [editItemIdentifierValue, setEditItemIdentifierValue] = useState('');
  const [editItemProblems, setEditItemProblems] = useState<string[]>([]);
  const [editItemNotes, setEditItemNotes] = useState('');
  const [editItemProductId, setEditItemProductId] = useState<string | null>(null);
  const [editItemProductPicker, setEditItemProductPicker] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchIntake = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await mobileApi.getServiceIntake(intakeId);
      if (res.success && res.data) {
        const data: ServiceIntake = { ...res.data, items: Array.isArray(res.data.items) ? res.data.items : [], problems: Array.isArray(res.data.problems) ? res.data.problems : [], images: Array.isArray(res.data.images) ? res.data.images : [], events: Array.isArray(res.data.events) ? res.data.events : [] };
        setIntake(data);
        // Warm the native image cache without blocking the screen.
        const urls = data.items.flatMap((item) => (item.images || []).map((img: any) => img.signedUrl).filter(Boolean)).slice(-8);
        Promise.all(urls.map((url: string) => Image.prefetch(url))).catch(() => undefined);
      }
    } catch (err: any) {
      if (!silent) Alert.alert('Error', err.message || 'Failed to load service intake.');
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, [intakeId]);

  useEffect(() => {
    fetchIntake();
    (async () => {
      try {
        const [optRes, empRes, prodRes, custRes] = await Promise.all([
          mobileApi.getServiceIntakeOptions(), mobileApi.listEmployees(), mobileApi.listProducts(), mobileApi.listCustomers('', 1, 100),
        ]);
        if (optRes.success) setOptions(optRes.data);
        if (empRes.success && Array.isArray(empRes.data)) setEmployees(empRes.data);
        if (prodRes.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
        if (custRes.success) setCustomers(Array.isArray(custRes.data) ? custRes.data : Array.isArray(custRes.data?.data) ? custRes.data.data : []);
      } catch { /* detail remains usable if auxiliary pickers fail */ }
    })();
  }, [fetchIntake]);

  const items = Array.isArray(intake?.items) ? intake!.items : [];
  const problems = Array.isArray(intake?.problems) ? intake!.problems : [];
  const imagesForItem = (itemId: string) => (intake?.images || []).filter((img) => img.itemId === itemId);
  const photoUri = (img: any) => img.signedUrl || mobileApi.getServiceIntakeImageUrl(img.storageFileName);
  const buildPhotoItems = (itemId: string) => imagesForItem(itemId).slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)).map((img) => ({ id: img.id, uri: photoUri(img) }));
  const latestImage = (item: ServiceIntakeItem) => imagesForItem(item.id).slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const latestStatusEvent = (itemId: string) => (intake?.events || []).filter((e) => e.itemId === itemId && e.eventType === 'STATUS_CHANGED').sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const hasFreshPhoto = (itemId: string) => { const img = imagesForItem(itemId).slice().sort((a,b)=>+new Date(b.createdAt)-+new Date(a.createdAt))[0]; const event = latestStatusEvent(itemId); return !!img && (!event || +new Date(img.createdAt) > +new Date(event.createdAt)); };
  const openPreview = (photos: Array<{ id: string; uri: string }>, index: number) => { if (!photos.length) return; setPreviewGallery(photos); setPreviewIndex(Math.max(0, Math.min(index, photos.length - 1))); };
  const closePreview = () => { setPreviewGallery([]); setPreviewIndex(0); };

  const uploadPhotos = async (itemId: string, uris: string[]) => {
    if (!canManage || !uris.length) return false;
    try {
      await Promise.all(uris.map((uri) => mobileApi.uploadServiceIntakeImage(intakeId, uri, 'image/jpeg', itemId)));
      return true;
    } catch (e: any) { Alert.alert('Upload failed', e.message || 'One or more photos could not be uploaded.'); return false; }
  };

  const requestStatusChange = (status: ServiceStatus) => {
    if (!canManage || !statusItemId) return;
    const item = items.find((x) => x.id === statusItemId);
    setStatusItemId(null);
    if (!item || item.status === status) return;
    setStagePhotos([]);
    setStageTarget({ itemId: item.id, status });
  };

  const completeStageStatus = async () => {
    if (!stageTarget || !stagePhotos.length || stageBusy) return;
    setStageBusy(true);
    try {
      const ok = await uploadPhotos(stageTarget.itemId, stagePhotos.map((p) => p.uri));
      if (!ok) return;
      await mobileApi.changeServiceItemStatus(intakeId, stageTarget.itemId, stageTarget.status);
      setStageTarget(null); setStagePhotos([]);
      await fetchIntake(true); onRefreshList?.();
    } catch (err: any) { Alert.alert('Unable to change stage', err.message || 'The status was not changed.'); }
    finally { setStageBusy(false); }
  };

  const removePhoto = async (imageId: string) => {
    try {
      await mobileApi.deleteServiceIntakeImage(intakeId, imageId);
      setPhotoMenuVisible(false);
      closePreview();
      await fetchIntake(true);
    } catch (err: any) {
      Alert.alert('Unable to remove photo', err.message || 'Please try again.');
    }
  };

  const confirmDeletePhoto = () => {
    const selected = previewGallery[previewIndex];
    if (!selected) return;
    setPhotoMenuVisible(false);
    Alert.alert('Delete Photo?', 'This photo will be permanently removed from this service item.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removePhoto(selected.id) },
    ]);
  };

  const confirmDeleteItem = (item: ServiceIntakeItem) => {
    if (!canManage || itemDeleteBusy) return;
    const label = item.itemName || item.itemTypeLabel || UNIT_TYPE_LABELS[item.itemType] || 'Service Item';
    Alert.alert(
      'Delete Service Item?',
      `Delete ${label}? Its photos will be removed, while its history will remain in the service intake timeline.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Item', style: 'destructive', onPress: async () => {
          setItemDeleteBusy(true);
          try {
            await mobileApi.deleteServiceIntakeItem(intakeId, item.id);
            await fetchIntake(true);
            onRefreshList?.();
          } catch (err: any) {
            Alert.alert('Delete failed', err.message || 'Could not delete the service item.');
          } finally {
            setItemDeleteBusy(false);
          }
        } },
      ],
    );
  };

  const addItem = async () => {
    if (!canManage) return;
    if (addType === 'OTHER' && !addName.trim()) return Alert.alert('Item name required', 'Enter a name for the custom item.');
    setEditBusy(true);
    try {
      await mobileApi.addServiceIntakeItem(intakeId, { itemType: addType, itemName: addName.trim() || undefined, productId: addProductId || undefined, identifierType: addIdentifierType.trim() || undefined, identifierValue: addIdentifierValue.trim() || undefined, notes: addNotes.trim() || undefined });
      setAddItemVisible(false); setAddName(''); setAddIdentifierType(''); setAddIdentifierValue(''); setAddProductId(null); setAddNotes('');
      await fetchIntake(true); onRefreshList?.();
    } catch (err: any) { Alert.alert('Error', err.message || 'Failed to add item.'); }
    finally { setEditBusy(false); }
  };

  const submitNote = async () => { if (!noteText.trim()) return; try { await mobileApi.addServiceIntakeNote(intakeId, noteText.trim(), noteItemId || undefined); setNoteText(''); setNoteItemId(null); await fetchIntake(true); } catch (err: any) { Alert.alert('Error', err.message || 'Failed to add note.'); } };
  const assignResponsible = async (employeeId: string) => { if (!responsibleItemId) return; try { await mobileApi.changeServiceItemResponsible(intakeId, responsibleItemId, employeeId); setResponsibleItemId(null); await fetchIntake(true); } catch (err: any) { Alert.alert('Error', err.message || 'Failed to assign employee.'); } };

  const openEditIntake = () => { if (!intake) return; setEditSite(intake.siteName || ''); setEditProblems(problems); setEditTakingTo(intake.takingTo || 'SHOWROOM'); setEditNotes(intake.notes || ''); setEditCustomerId(intake.customerId); setEditIntakeVisible(true); };
  const saveIntakeEdit = async () => {
    if (!intake || editBusy) return; setEditBusy(true);
    try { await mobileApi.updateServiceIntake(intake.id, { customerId: editCustomerId || undefined, siteName: editSite.trim(), problems: editProblems, takingTo: editTakingTo, notes: editNotes.trim() }); setEditIntakeVisible(false); await fetchIntake(true); onRefreshList?.(); }
    catch (err: any) { Alert.alert('Save failed', err.message || 'Could not update service intake.'); }
    finally { setEditBusy(false); }
  };
  const openEditItem = (item: ServiceIntakeItem) => { setEditItemId(item.id); setEditItemName(item.itemName || (item.itemType === 'OTHER' ? '' : item.itemTypeLabel || '')); setEditItemIdentifierType(item.identifierType || (item.serialNumber ? 'Serial Number' : '')); setEditItemIdentifierValue(item.identifierValue || item.serialNumber || ''); setEditItemProblems(item.problems || []); setEditItemNotes(item.notes || ''); setEditItemProductId(item.productId); };
  const saveItemEdit = async () => {
    if (!editItemId || editBusy) return; setEditBusy(true);
    try { await mobileApi.updateServiceIntakeItem(intakeId, editItemId, { itemName: editItemName.trim() || undefined, productId: editItemProductId, problems: editItemProblems, identifierType: editItemIdentifierType.trim() || undefined, identifierValue: editItemIdentifierValue.trim() || undefined, notes: editItemNotes.trim() }); setEditItemId(null); await fetchIntake(true); }
    catch (err: any) { Alert.alert('Save failed', err.message || 'Could not update service item.'); }
    finally { setEditBusy(false); }
  };

  const confirmDelete = () => {
    if (!canManage || deleteBusy) return;
    Alert.alert('Delete Service Intake?', `This will permanently delete ${intake?.intakeNumber}, its units, history and stored photos.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteIntake },
    ]);
  };
  const deleteIntake = async () => {
    if (!intake) return; setDeleteBusy(true);
    try { await mobileApi.deleteServiceIntake(intake.id); onRefreshList?.(); onClose(); }
    catch (err: any) { Alert.alert('Delete failed', err.message || 'Could not delete service intake.'); }
    finally { setDeleteBusy(false); }
  };

  const filteredProducts = useMemo(() => products.filter((p) => !productSearch.trim() || `${p.name || ''} ${p.model || ''}`.toLowerCase().includes(productSearch.toLowerCase())), [products, productSearch]);
  const filteredCustomers = useMemo(() => customers.filter((c) => !customerSearch.trim() || `${c.name || ''} ${c.mobile || ''}`.toLowerCase().includes(customerSearch.toLowerCase())), [customers, customerSearch]);
  const itemCount = items.length;
  const statusCounts = items.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});

  if (isLoading || !intake) return <View style={styles.centered}><ActivityIndicator size="small" color="#007AFF" /></View>;
  const customerName = intake.customer?.name || intake.customerName || 'Unnamed Customer';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose}><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <View style={styles.headerMain}><Text style={styles.headerTitle}>{intake.intakeNumber}</Text><Text style={styles.headerSub}>{intake.lifecycleStatus || 'OPEN'} · {itemCount} item{itemCount === 1 ? '' : 's'}</Text></View>
        {canManage && <TouchableOpacity style={styles.addItemBtn} onPress={() => setAddItemVisible(true)}><Text style={styles.addItemText}>+ Item</Text></TouchableOpacity>}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 110 }} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchIntake(true); }} tintColor="#007AFF" />}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.customerBlock}>
              <Text style={styles.customerName}>{customerName}</Text>
              {!!intake.customer?.mobile && <Text style={styles.meta}>{intake.customer.mobile}</Text>}
            </View>
            <View style={styles.openBadge}><Text style={styles.openBadgeText}>{intake.lifecycleStatus || 'OPEN'}</Text></View>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailCell}><Text style={styles.detailLabel}>SITE</Text><Text style={styles.detailValue} numberOfLines={2}>{intake.siteName || '—'}</Text></View>
            <View style={styles.detailCell}><Text style={styles.detailLabel}>TAKING TO</Text><Text style={styles.detailValue} numberOfLines={2}>{intake.takingTo ? TAKING_TO_LABELS[intake.takingTo] : '—'}</Text></View>
            <View style={styles.detailCell}><Text style={styles.detailLabel}>REPORTED BY</Text><Text style={styles.detailValue} numberOfLines={2}>{intake.createdBy?.name || 'System'}</Text></View>
            <View style={styles.detailCell}><Text style={styles.detailLabel}>RECEIVED</Text><Text style={styles.detailValue} numberOfLines={2}>{formatDateTime(intake.receivedAt)}</Text></View>
          </View>
          {problems.length > 0 && <View style={styles.chipsRow}>{problems.map((p) => <View key={p} style={styles.infoChip}><Text style={styles.infoChipText}>{p}</Text></View>)}</View>}
          {Object.keys(statusCounts).length > 0 && <View style={styles.summaryRow}>{Object.entries(statusCounts).map(([s, count]) => { const c = STATUS_COLORS[s as ServiceStatus] || STATUS_COLORS.NOT_STARTED; return <View key={s} style={[styles.summaryChip, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[styles.summaryChipText, { color: c.text }]}>{count} {STATUS_LABELS[s as ServiceStatus] || s}</Text></View>; })}</View>}
          {!!intake.notes && <Text style={styles.notesPreview}>{intake.notes}</Text>}
          {canManage && <TouchableOpacity style={styles.editDetailsBtn} onPress={openEditIntake}><Text style={styles.secondaryBtnText}>Edit Details</Text></TouchableOpacity>}
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Service Items</Text><Text style={styles.sectionHint}>Each item has its own stage</Text></View>
        {items.map((item) => {
          const c = STATUS_COLORS[item.status] || STATUS_COLORS.NOT_STARTED; const photos = buildPhotoItems(item.id); const image = latestImage(item);
          return <View key={item.id} style={[styles.itemCard, { backgroundColor: c.bg, borderColor: c.border }]}>
            <View style={styles.itemTop}><View style={{ flex: 1 }}><Text style={styles.itemTitle}>{item.itemName || item.itemTypeLabel || UNIT_TYPE_LABELS[item.itemType] || 'Service Item'}</Text>{!!item.productModel && <Text style={styles.itemMeta}>Model · {item.productModel}</Text>}{!!(item.identifierValue || item.serialNumber) && <Text style={styles.itemMeta}>{item.identifierType || 'Identifier'} · {item.identifierValue || item.serialNumber}</Text>}{!!item.responsibleEmployeeName && <Text style={styles.itemMeta}>Assigned · {item.responsibleEmployeeName}</Text>}</View><TouchableOpacity style={[styles.statusPill, { backgroundColor: '#FFFFFFCC', borderColor: c.border }]} onPress={() => setStatusItemId(item.id)}><Text style={[styles.statusPillText, { color: c.text }]}>{STATUS_LABELS[item.status]}</Text><Text style={[styles.chevron, { color: c.text }]}>›</Text></TouchableOpacity></View>
            <View style={styles.photoHeader}><Text style={styles.photoLabel}>{image ? 'Latest photo' : 'No photos yet'}</Text>{photos.length > 1 && <Text style={styles.photoCount}>{photos.length} photos</Text>}</View>
            {image && <TouchableOpacity activeOpacity={0.85} onPress={() => openPreview(photos, Math.max(0, photos.length - 1))}><Image source={{ uri: photoUri(image) }} style={styles.latestPhoto} resizeMode="cover" /></TouchableOpacity>}
            <PhotoGrid photos={photos} onAdd={async (uris) => { const ok = await uploadPhotos(item.id, uris); if (ok) await fetchIntake(true); }} onPreview={(p, idx) => openPreview(photos, idx)} disabled={!canManage} />
            {canManage && <View style={styles.actionRow}><TouchableOpacity style={styles.actionBtn} onPress={() => openEditItem(item)}><Text style={styles.actionText}>Edit Unit</Text></TouchableOpacity><TouchableOpacity style={styles.actionBtn} onPress={() => setResponsibleItemId(item.id)}><Text style={styles.actionText}>Assign</Text></TouchableOpacity><TouchableOpacity style={styles.actionBtn} onPress={() => { setNoteItemId(item.id); setNoteText(''); }}><Text style={styles.actionText}>Note</Text></TouchableOpacity><TouchableOpacity style={styles.itemMenuBtn} onPress={() => confirmDeleteItem(item)}><Text style={styles.itemMenuText}>•••</Text></TouchableOpacity></View>}
          </View>;
        })}
        {items.length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No service items</Text><Text style={styles.emptyText}>Add an indoor unit, outdoor unit, motor, PCB board, fan or custom component.</Text></View>}

        <View style={styles.historyCard}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>History</Text>{canManage && <TouchableOpacity onPress={() => { setNoteItemId(null); setNoteText(''); }}><Text style={styles.linkText}>+ Add Note</Text></TouchableOpacity>}</View><ServiceIntakeTimeline events={intake.events || []} /></View>
      </ScrollView>

      {/* Status sheet */}
      <Modal visible={!!statusItemId} transparent animationType="slide" onRequestClose={() => setStatusItemId(null)}><View style={styles.modalOverlay}><View style={styles.sheet}><View style={styles.grabber}/><Text style={styles.sheetTitle}>Change Service Stage</Text><Text style={styles.sheetHint}>Every stage change requires a fresh photo. Add the evidence first, then the stage is updated.</Text>{STATUS_ORDER.map((s) => { const c=STATUS_COLORS[s]; return <TouchableOpacity key={s} style={[styles.statusRow,{backgroundColor:c.bg,borderColor:c.border}]} onPress={()=>requestStatusChange(s)}><View style={[styles.statusDot,{backgroundColor:c.text}]} /><Text style={[styles.statusRowText,{color:c.text}]}>{STATUS_LABELS[s]}</Text><Text style={[styles.statusRowArrow,{color:c.text}]}>›</Text></TouchableOpacity>; })}<TouchableOpacity style={styles.cancelBtn} onPress={()=>setStatusItemId(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>

      {/* Stage evidence sheet */}
      <Modal visible={!!stageTarget} animationType="slide" onRequestClose={()=>!stageBusy&&setStageTarget(null)}><View style={styles.modalPage}><View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}><TouchableOpacity style={styles.backBtn} onPress={()=>!stageBusy&&setStageTarget(null)}><Text style={styles.backText}>‹</Text></TouchableOpacity><View style={{flex:1}}><Text style={styles.modalTitle}>Stage Photo</Text><Text style={styles.modalSub}>{stageTarget ? STATUS_LABELS[stageTarget.status] : ''}</Text></View></View><ScrollView contentContainerStyle={{padding:16,paddingBottom:120}}><View style={styles.cleanCard}><Text style={styles.cleanTitle}>Fresh evidence required</Text><Text style={styles.cleanHint}>Take or choose at least one new photo. The stage will only change after the upload succeeds.</Text></View><View style={styles.cleanCard}><PhotoGrid photos={stagePhotos} onAdd={(uris)=>setStagePhotos((cur)=>[...cur,...uris.map((uri)=>({id:`${Date.now()}-${uri}`,uri}))])} onRemove={(id)=>setStagePhotos((cur)=>cur.filter((p)=>p.id!==id))} showRemove /></View></ScrollView><View style={[styles.bottomBar,{paddingBottom:Math.max(insets.bottom,12)}]}><TouchableOpacity disabled={stageBusy||stagePhotos.length===0} onPress={completeStageStatus} style={[styles.primaryBtn,(stageBusy||stagePhotos.length===0)&&styles.disabledBtn]}>{stageBusy?<ActivityIndicator color="#FFF"/>:<Text style={styles.primaryText}>Upload & Change Stage</Text>}</TouchableOpacity></View></View></Modal>

      {/* Intake edit */}
      <Modal visible={editIntakeVisible} animationType="slide" onRequestClose={()=>!editBusy&&!deleteBusy&&setEditIntakeVisible(false)}>
        <View style={styles.modalPage}>
          <View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}>
            <TouchableOpacity style={styles.backBtn} onPress={()=>!editBusy&&!deleteBusy&&setEditIntakeVisible(false)}><Text style={styles.backText}>‹</Text></TouchableOpacity>
            <View style={{flex:1}}><Text style={styles.modalTitle}>Edit Service Intake</Text><Text style={styles.modalSub}>{intake.intakeNumber}</Text></View>
            <TouchableOpacity disabled={editBusy||deleteBusy} onPress={saveIntakeEdit}><Text style={styles.saveLink}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.editIntakeContent}>
            <Text style={styles.formLabel}>Customer</Text>
            <TouchableOpacity style={styles.field} onPress={()=>setCustomerPicker(true)}><Text style={styles.fieldText}>{customers.find(c=>c.id===editCustomerId)?.name || intake.customer?.name || 'Select customer'}</Text><Text style={styles.fieldChevron}>›</Text></TouchableOpacity>
            <Text style={styles.formLabel}>Site</Text>
            <View style={styles.chipWrap}>{(options?.sites||[]).map((s)=><TouchableOpacity key={s} onPress={()=>setEditSite(s)} style={[styles.formChip,editSite===s&&styles.formChipActive]}><Text style={[styles.formChipText,editSite===s&&styles.formChipTextActive]}>{s}</Text></TouchableOpacity>)}</View>
            <TextInput style={styles.field} placeholder="Custom site" value={editSite} onChangeText={setEditSite}/>
            <Text style={styles.formLabel}>Problems</Text>
            <View style={styles.chipWrap}>{(options?.problems||[]).map((p)=><TouchableOpacity key={p} onPress={()=>setEditProblems(cur=>cur.includes(p)?cur.filter(x=>x!==p):[...cur,p])} style={[styles.formChip,editProblems.includes(p)&&styles.formChipActive]}><Text style={[styles.formChipText,editProblems.includes(p)&&styles.formChipTextActive]}>{p}</Text></TouchableOpacity>)}</View>
            <Text style={styles.formLabel}>Taking To</Text>
            <View style={styles.chipWrap}>{(options?.takingTo||[]).map((t)=><TouchableOpacity key={t.key} onPress={()=>setEditTakingTo(t.key)} style={[styles.formChip,editTakingTo===t.key&&styles.formChipActive]}><Text style={[styles.formChipText,editTakingTo===t.key&&styles.formChipTextActive]}>{t.label}</Text></TouchableOpacity>)}</View>
            <Text style={styles.formLabel}>Notes</Text>
            <TextInput style={[styles.field,styles.multiline]} placeholder="Notes" value={editNotes} onChangeText={setEditNotes} multiline/>
            {canManage && <View style={styles.editDangerSection}>
              <View style={styles.editDangerDivider}/>
              <Text style={styles.editDangerTitle}>Danger Zone</Text>
              <Text style={styles.editDangerHint}>Permanently delete this service intake, its items, photos, and stored history.</Text>
              <TouchableOpacity disabled={deleteBusy||editBusy} style={[styles.deleteFullBtn,(deleteBusy||editBusy)&&styles.disabledBtn]} onPress={confirmDelete}>
                {deleteBusy ? <ActivityIndicator color="#B42318"/> : <Text style={styles.deleteFullText}>Delete Service Intake</Text>}
              </TouchableOpacity>
            </View>}
          </ScrollView>
        </View>
      </Modal>

      {/* Customer picker */}
      <Modal visible={customerPicker} animationType="slide" onRequestClose={()=>setCustomerPicker(false)}><View style={styles.modalPage}><View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}><TouchableOpacity style={styles.backBtn} onPress={()=>setCustomerPicker(false)}><Text style={styles.backText}>‹</Text></TouchableOpacity><Text style={styles.modalTitle}>Select Customer</Text><View style={{width:40}}/></View><TextInput style={[styles.field,{margin:16}]} placeholder="Search customer" value={customerSearch} onChangeText={setCustomerSearch}/><ScrollView>{filteredCustomers.map((c)=><TouchableOpacity key={c.id} style={styles.customerRow} onPress={()=>{setEditCustomerId(c.id);setCustomerPicker(false)}}><Text style={styles.customerRowTitle}>{c.name||'Unnamed Customer'}</Text><Text style={styles.meta}>{c.mobile||''}</Text></TouchableOpacity>)}</ScrollView></View></Modal>

      {/* Item edit */}
      <Modal visible={!!editItemId} animationType="slide" onRequestClose={()=>!editBusy&&setEditItemId(null)}><View style={styles.modalPage}><View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}><TouchableOpacity style={styles.backBtn} onPress={()=>!editBusy&&setEditItemId(null)}><Text style={styles.backText}>‹</Text></TouchableOpacity><View style={{flex:1}}><Text style={styles.modalTitle}>Edit Unit</Text><Text style={styles.modalSub}>{items.find(i=>i.id===editItemId)?.itemTypeLabel||'Service Item'}</Text></View><TouchableOpacity disabled={editBusy} onPress={saveItemEdit}><Text style={styles.saveLink}>Save</Text></TouchableOpacity></View><ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}><Text style={styles.formLabel}>Item name</Text><TextInput style={styles.field} placeholder="Item name" value={editItemName} onChangeText={setEditItemName}/><Text style={styles.formLabel}>Model</Text><TouchableOpacity style={styles.field} onPress={()=>setEditItemProductPicker(true)}><Text style={styles.fieldText}>{products.find(p=>p.id===editItemProductId)?.model||products.find(p=>p.id===editItemProductId)?.name||items.find(i=>i.id===editItemId)?.productModel||'Select model'}</Text><Text style={styles.fieldChevron}>›</Text></TouchableOpacity><Text style={styles.formLabel}>Identifier type</Text><TextInput style={styles.field} placeholder="Serial Number / Board No. / Rating" value={editItemIdentifierType} onChangeText={setEditItemIdentifierType}/><Text style={styles.formLabel}>Identifier value</Text><TextInput style={styles.field} placeholder="Value" value={editItemIdentifierValue} onChangeText={setEditItemIdentifierValue}/><Text style={styles.formLabel}>Problems</Text><View style={styles.chipWrap}>{(options?.problems||[]).map((p)=><TouchableOpacity key={p} onPress={()=>setEditItemProblems(cur=>cur.includes(p)?cur.filter(x=>x!==p):[...cur,p])} style={[styles.formChip,editItemProblems.includes(p)&&styles.formChipActive]}><Text style={[styles.formChipText,editItemProblems.includes(p)&&styles.formChipTextActive]}>{p}</Text></TouchableOpacity>)}</View><Text style={styles.formLabel}>Notes</Text><TextInput style={[styles.field,styles.multiline]} placeholder="Notes" value={editItemNotes} onChangeText={setEditItemNotes} multiline/></ScrollView></View></Modal>

      {/* Item product picker */}
      <Modal visible={editItemProductPicker} animationType="slide" onRequestClose={()=>setEditItemProductPicker(false)}><View style={styles.modalPage}><View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}><TouchableOpacity style={styles.backBtn} onPress={()=>setEditItemProductPicker(false)}><Text style={styles.backText}>‹</Text></TouchableOpacity><Text style={styles.modalTitle}>Select Model</Text><View style={{width:40}}/></View><TextInput style={[styles.field,{margin:16}]} placeholder="Search model" value={productSearch} onChangeText={setProductSearch}/><ScrollView>{filteredProducts.map((p)=><TouchableOpacity key={p.id} style={styles.customerRow} onPress={()=>{setEditItemProductId(p.id);setEditItemProductPicker(false)}}><Text style={styles.customerRowTitle}>{p.name}</Text><Text style={styles.meta}>{p.model||''}</Text></TouchableOpacity>)}</ScrollView></View></Modal>

      {/* Add item */}
      <Modal visible={addItemVisible} animationType="slide" onRequestClose={()=>!editBusy&&setAddItemVisible(false)}><View style={styles.modalPage}><View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}><TouchableOpacity style={styles.backBtn} onPress={()=>!editBusy&&setAddItemVisible(false)}><Text style={styles.backText}>‹</Text></TouchableOpacity><Text style={styles.modalTitle}>Add Service Item</Text><View style={{width:40}}/></View><ScrollView contentContainerStyle={{padding:16,paddingBottom:40}}><Text style={styles.formLabel}>Item type</Text><View style={styles.chipWrap}>{ITEM_TYPE_OPTIONS.map((type)=><TouchableOpacity key={type} onPress={()=>setAddType(type)} style={[styles.formChip,addType===type&&styles.formChipActive]}><Text style={[styles.formChipText,addType===type&&styles.formChipTextActive]}>{UNIT_TYPE_LABELS[type]}</Text></TouchableOpacity>)}</View>{addType==='OTHER'&&<><Text style={styles.formLabel}>Item name</Text><TextInput style={styles.field} placeholder="Custom item name" value={addName} onChangeText={setAddName}/></>}<Text style={styles.formLabel}>Model</Text><TouchableOpacity style={styles.field} onPress={()=>setProductPicker(true)}><Text style={styles.fieldText}>{products.find(p=>p.id===addProductId)?.model||products.find(p=>p.id===addProductId)?.name||'Select model'}</Text><Text style={styles.fieldChevron}>›</Text></TouchableOpacity><Text style={styles.formLabel}>Identifier type</Text><TextInput style={styles.field} placeholder="Serial Number / Board No. / Rating" value={addIdentifierType} onChangeText={setAddIdentifierType}/><Text style={styles.formLabel}>Identifier value</Text><TextInput style={styles.field} placeholder="Value" value={addIdentifierValue} onChangeText={setAddIdentifierValue}/><Text style={styles.formLabel}>Notes</Text><TextInput style={[styles.field,styles.multiline]} placeholder="Notes" value={addNotes} onChangeText={setAddNotes} multiline/><TouchableOpacity disabled={editBusy} style={[styles.primaryBtn,editBusy&&styles.disabledBtn]} onPress={addItem}>{editBusy?<ActivityIndicator color="#FFF"/>:<Text style={styles.primaryText}>Add Item</Text>}</TouchableOpacity></ScrollView></View></Modal>

      {/* Add item product picker */}
      <Modal visible={productPicker} animationType="slide" onRequestClose={()=>setProductPicker(false)}><View style={styles.modalPage}><View style={[styles.modalHeader,{paddingTop:Math.max(insets.top,12)}]}><TouchableOpacity style={styles.backBtn} onPress={()=>setProductPicker(false)}><Text style={styles.backText}>‹</Text></TouchableOpacity><Text style={styles.modalTitle}>Select Model</Text><View style={{width:40}}/></View><TextInput style={[styles.field,{margin:16}]} placeholder="Search model" value={productSearch} onChangeText={setProductSearch}/><ScrollView>{filteredProducts.map((p)=><TouchableOpacity key={p.id} style={styles.customerRow} onPress={()=>{setAddProductId(p.id);setProductPicker(false)}}><Text style={styles.customerRowTitle}>{p.name}</Text><Text style={styles.meta}>{p.model||''}</Text></TouchableOpacity>)}</ScrollView></View></Modal>

      {/* Responsible */}
      <Modal visible={!!responsibleItemId} transparent animationType="slide" onRequestClose={()=>setResponsibleItemId(null)}><View style={styles.modalOverlay}><View style={styles.sheet}><View style={styles.grabber}/><Text style={styles.sheetTitle}>Assign Technician</Text><ScrollView>{employees.map((e)=><TouchableOpacity key={e.id} style={styles.personRow} onPress={()=>assignResponsible(e.id)}><Text style={styles.customerRowTitle}>{e.name}</Text><Text style={styles.meta}>{e.role} · {e.employeeCode}</Text></TouchableOpacity>)}</ScrollView><TouchableOpacity style={styles.cancelBtn} onPress={()=>setResponsibleItemId(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>

      {/* Note */}
      <Modal visible={noteItemId !== null} transparent animationType="slide" onRequestClose={()=>setNoteItemId(null)}><View style={styles.modalOverlay}><View style={styles.sheet}><View style={styles.grabber}/><Text style={styles.sheetTitle}>Add Note</Text><TextInput autoFocus style={[styles.field,styles.multiline]} placeholder="Write a note" value={noteText} onChangeText={setNoteText} multiline/><TouchableOpacity style={styles.primaryBtn} onPress={submitNote}><Text style={styles.primaryText}>Add Note</Text></TouchableOpacity><TouchableOpacity style={styles.cancelBtn} onPress={()=>setNoteItemId(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>

      {/* Preview */}
      <Modal visible={previewGallery.length > 0} transparent animationType="fade" onRequestClose={closePreview}><View style={styles.previewOverlay}><TouchableOpacity style={styles.previewClose} onPress={closePreview}><Text style={styles.previewCloseText}>×</Text></TouchableOpacity>{canManage && <TouchableOpacity style={styles.previewMenuBtn} onPress={() => setPhotoMenuVisible(true)}><Text style={styles.previewMenuText}>•••</Text></TouchableOpacity>}{previewGallery.length>0&&<Image source={{uri:previewGallery[previewIndex].uri}} style={styles.previewImage} resizeMode="contain"/>}{previewGallery.length>1&&<><TouchableOpacity style={[styles.galleryArrow,styles.galleryArrowLeft,previewIndex===0&&styles.galleryArrowDisabled]} disabled={previewIndex===0} onPress={()=>setPreviewIndex(i=>Math.max(0,i-1))}><Text style={styles.galleryArrowText}>‹</Text></TouchableOpacity><TouchableOpacity style={[styles.galleryArrow,styles.galleryArrowRight,previewIndex===previewGallery.length-1&&styles.galleryArrowDisabled]} disabled={previewIndex===previewGallery.length-1} onPress={()=>setPreviewIndex(i=>Math.min(previewGallery.length-1,i+1))}><Text style={styles.galleryArrowText}>›</Text></TouchableOpacity></>}<View style={styles.previewCounter}><Text style={styles.previewCounterText}>{previewIndex+1} / {previewGallery.length}</Text></View></View></Modal>
      <Modal visible={photoMenuVisible} transparent animationType="slide" onRequestClose={() => setPhotoMenuVisible(false)}><View style={styles.photoMenuOverlay}><View style={styles.photoMenuSheet}><View style={styles.grabber}/><TouchableOpacity style={styles.photoDeleteAction} onPress={confirmDeletePhoto}><Text style={styles.photoDeleteText}>Delete Photo</Text></TouchableOpacity><TouchableOpacity style={styles.cancelBtn} onPress={() => setPhotoMenuVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View></View></Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F7F8FA'}, centered:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#F7F8FA'},
  header:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingBottom:12,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#D9DDE3'}, backBtn:{width:40,height:40,borderRadius:20,backgroundColor:'#F2F4F7',alignItems:'center',justifyContent:'center'}, backText:{fontSize:32,lineHeight:34,color:'#111827',fontWeight:'300'}, headerMain:{flex:1}, headerTitle:{fontSize:20,fontWeight:'700',color:'#111827',letterSpacing:-.3}, headerSub:{fontSize:12,color:'#7B8494',marginTop:2}, headerIconBtn:{width:38,height:38,borderRadius:19,backgroundColor:'#F2F4F7',alignItems:'center',justifyContent:'center'},headerIcon:{fontSize:19,color:'#111827'},addItemBtn:{paddingHorizontal:14,paddingVertical:10,borderRadius:14,backgroundColor:'#E9F9F2'},addItemText:{fontSize:14,fontWeight:'700',color:'#0A8F5A'},
  heroCard:{backgroundColor:'#FFF',borderRadius:22,borderWidth:1,borderColor:'#E3E6EA',padding:16,marginBottom:16},heroTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},customerBlock:{flex:1,paddingRight:12},customerName:{fontSize:25,fontWeight:'700',letterSpacing:-.5,color:'#101828'},openBadge:{backgroundColor:'#F2F4F7',borderRadius:20,paddingHorizontal:11,paddingVertical:6},openBadgeText:{fontSize:10,fontWeight:'800',color:'#667085',letterSpacing:.5},detailGrid:{flexDirection:'row',flexWrap:'wrap',marginTop:14,borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#E3E6EA',paddingTop:12},detailCell:{width:'50%',paddingRight:12,paddingBottom:11},detailLabel:{fontSize:9,fontWeight:'800',letterSpacing:.8,color:'#98A2B3',marginBottom:3},detailValue:{fontSize:13,fontWeight:'600',color:'#475467',lineHeight:18},meta:{fontSize:13,color:'#697586',lineHeight:18},chipsRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:10},infoChip:{backgroundColor:'#F2F4F7',paddingHorizontal:11,paddingVertical:7,borderRadius:14},infoChipText:{fontSize:12,fontWeight:'600',color:'#344054'},summaryRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:12,paddingTop:11,borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#E3E6EA'},summaryChip:{borderWidth:1,paddingHorizontal:10,paddingVertical:6,borderRadius:13},summaryChipText:{fontSize:11,fontWeight:'700'},notesPreview:{marginTop:10,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#E3E6EA',fontSize:13,color:'#475467',lineHeight:19},editDetailsBtn:{marginTop:12,borderWidth:1,borderColor:'#D0D5DD',borderRadius:14,paddingVertical:12,alignItems:'center',backgroundColor:'#FFF'},secondaryBtn:{flex:1,borderWidth:1,borderColor:'#D0D5DD',borderRadius:14,paddingVertical:11,alignItems:'center'},secondaryBtnText:{fontSize:13,fontWeight:'700',color:'#344054'},
  sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},sectionTitle:{fontSize:21,fontWeight:'700',letterSpacing:-.4,color:'#101828'},sectionHint:{fontSize:11,color:'#98A2B3'},linkText:{fontSize:13,fontWeight:'700',color:'#007AFF'},
  itemCard:{borderRadius:22,borderWidth:1,padding:15,marginBottom:12},itemTop:{flexDirection:'row',alignItems:'flex-start',gap:10},itemTitle:{fontSize:18,fontWeight:'700',letterSpacing:-.2,color:'#101828'},itemMeta:{fontSize:12,color:'#667085',marginTop:4},statusPill:{borderWidth:1,borderRadius:18,paddingHorizontal:10,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:3,maxWidth:'55%'},statusPillText:{fontSize:10,fontWeight:'800'},chevron:{fontSize:18,lineHeight:14},photoHeader:{flexDirection:'row',justifyContent:'space-between',marginTop:15,marginBottom:7},photoLabel:{fontSize:12,fontWeight:'700',color:'#475467'},photoCount:{fontSize:11,color:'#98A2B3'},latestPhoto:{width:'100%',height:190,borderRadius:16,backgroundColor:'#E4E7EC',marginBottom:9},actionRow:{flexDirection:'row',gap:8,marginTop:5},actionBtn:{borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFFFFFAA',borderRadius:13,paddingHorizontal:12,paddingVertical:8},itemMenuBtn:{width:38,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFFFFFAA',borderRadius:13,alignItems:'center',justifyContent:'center'},itemMenuText:{fontSize:14,fontWeight:'800',color:'#667085',letterSpacing:1},actionText:{fontSize:12,fontWeight:'700',color:'#344054'},emptyCard:{backgroundColor:'#FFF',borderRadius:20,borderWidth:1,borderColor:'#E3E6EA',padding:20,marginBottom:14},emptyTitle:{fontSize:16,fontWeight:'700',color:'#101828'},emptyText:{fontSize:13,color:'#667085',lineHeight:19,marginTop:5},historyCard:{backgroundColor:'#FFF',borderRadius:22,borderWidth:1,borderColor:'#E3E6EA',padding:17,marginTop:8},
  modalOverlay:{flex:1,backgroundColor:'rgba(17,24,39,.28)',justifyContent:'flex-end'},sheet:{backgroundColor:'#FFF',borderTopLeftRadius:28,borderTopRightRadius:28,padding:18,maxHeight:'82%'},grabber:{alignSelf:'center',width:38,height:4,borderRadius:2,backgroundColor:'#D0D5DD',marginBottom:14},sheetTitle:{fontSize:20,fontWeight:'700',color:'#101828',marginBottom:6},sheetHint:{fontSize:13,color:'#667085',lineHeight:19,marginBottom:12},statusRow:{minHeight:52,borderWidth:1,borderRadius:16,marginBottom:8,paddingHorizontal:14,flexDirection:'row',alignItems:'center'},statusDot:{width:9,height:9,borderRadius:5,marginRight:10},statusRowText:{fontSize:14,fontWeight:'700',flex:1},statusRowArrow:{fontSize:24,fontWeight:'300'},cancelBtn:{alignItems:'center',paddingVertical:13,marginTop:4},cancelText:{fontSize:14,fontWeight:'700',color:'#667085'},personRow:{paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#EAECF0'},
  modalPage:{flex:1,backgroundColor:'#F7F8FA'},modalHeader:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingBottom:12,backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#D9DDE3'},modalTitle:{fontSize:20,fontWeight:'700',color:'#101828',flex:1},modalSub:{fontSize:12,color:'#98A2B3',marginTop:2},saveLink:{fontSize:14,fontWeight:'700',color:'#007AFF'},editIntakeContent:{padding:16,paddingBottom:44},editDangerSection:{marginTop:24,paddingBottom:18},editDangerDivider:{height:StyleSheet.hairlineWidth,backgroundColor:'#D9DDE3',marginBottom:18},editDangerTitle:{fontSize:13,fontWeight:'800',color:'#B42318',marginBottom:5},editDangerHint:{fontSize:12,color:'#667085',lineHeight:18,marginBottom:12},deleteFullBtn:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:'#FECACA',backgroundColor:'#FFF7F6',alignItems:'center',justifyContent:'center'},deleteFullText:{fontSize:14,fontWeight:'700',color:'#B42318'},cleanCard:{backgroundColor:'#FFF',borderRadius:20,borderWidth:1,borderColor:'#E3E6EA',padding:18,marginBottom:12},cleanTitle:{fontSize:16,fontWeight:'700',color:'#101828'},cleanHint:{fontSize:13,color:'#667085',lineHeight:19,marginTop:5},bottomBar:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:16,paddingTop:10,backgroundColor:'#FFFFFFEE',borderTopWidth:StyleSheet.hairlineWidth,borderColor:'#D9DDE3'},primaryBtn:{backgroundColor:'#007AFF',borderRadius:15,paddingVertical:13,alignItems:'center',justifyContent:'center',minHeight:48},primaryText:{color:'#FFF',fontSize:14,fontWeight:'700'},disabledBtn:{opacity:.45},formLabel:{fontSize:12,fontWeight:'700',color:'#475467',marginBottom:7,marginTop:10},field:{minHeight:46,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',borderRadius:13,paddingHorizontal:13,paddingVertical:11,fontSize:14,color:'#101828',marginBottom:4},fieldText:{fontSize:14,color:'#344054',flex:1},fieldChevron:{fontSize:23,color:'#98A2B3'},chipWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},formChip:{borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',paddingHorizontal:11,paddingVertical:8,borderRadius:14},formChipActive:{backgroundColor:'#101828',borderColor:'#101828'},formChipText:{fontSize:12,fontWeight:'600',color:'#475467'},formChipTextActive:{color:'#FFF'},multiline:{minHeight:90,textAlignVertical:'top'},customerRow:{backgroundColor:'#FFF',padding:16,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:'#EAECF0'},customerRowTitle:{fontSize:14,fontWeight:'700',color:'#101828'},
  previewOverlay:{flex:1,backgroundColor:'rgba(0,0,0,.96)',justifyContent:'center',alignItems:'center'},previewImage:{width:'100%',height:'78%'},previewClose:{position:'absolute',top:52,right:18,zIndex:5,width:42,height:42,borderRadius:21,backgroundColor:'#FFFFFF22',alignItems:'center',justifyContent:'center'},previewCloseText:{fontSize:27,color:'#FFF',fontWeight:'300'},previewMenuBtn:{position:'absolute',top:52,left:18,zIndex:5,width:42,height:42,borderRadius:21,backgroundColor:'#FFFFFF22',alignItems:'center',justifyContent:'center'},previewMenuText:{fontSize:16,color:'#FFF',fontWeight:'800',letterSpacing:2},photoMenuOverlay:{flex:1,backgroundColor:'rgba(0,0,0,.28)',justifyContent:'flex-end'},photoMenuSheet:{backgroundColor:'#FFF',borderTopLeftRadius:28,borderTopRightRadius:28,padding:18,paddingBottom:28},photoDeleteAction:{height:52,borderRadius:15,backgroundColor:'#FFF1F0',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#FECACA'},photoDeleteText:{fontSize:15,fontWeight:'700',color:'#B42318'},galleryArrow:{position:'absolute',top:'50%',marginTop:-24,width:48,height:48,borderRadius:24,backgroundColor:'#FFFFFF22',alignItems:'center',justifyContent:'center'},galleryArrowLeft:{left:12},galleryArrowRight:{right:12},galleryArrowDisabled:{opacity:.2},galleryArrowText:{fontSize:38,color:'#FFF',fontWeight:'300'},previewCounter:{position:'absolute',bottom:46,backgroundColor:'#FFFFFF22',paddingHorizontal:13,paddingVertical:7,borderRadius:14},previewCounterText:{fontSize:12,color:'#FFF',fontWeight:'700'},
});
