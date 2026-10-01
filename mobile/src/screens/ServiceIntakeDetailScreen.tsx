import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Modal, Alert, TextInput, Image, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { ServiceIntakeTimeline } from '../components/ServiceIntakeTimeline'; // existing shared component — reused as-is
import { TagSelector } from '../components/TagSelector';
import { PhotoGrid, PhotoItem } from '../components/PhotoGrid';
import {
  ServiceIntake, ServiceIntakeItem, ServiceStatus, UnitType,
  STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, TAKING_TO_LABELS, UNIT_TYPE_LABELS,
  ServiceIntakeOptions,
} from '../types/serviceIntake';

interface Props {
  intakeId: string;
  userRole?: string;
  onClose: () => void;
  onRefreshList?: () => void;
}

const PRIVILEGED_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'IT_ADMIN', 'MANAGER'];

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export const ServiceIntakeDetailScreen: React.FC<Props> = ({ intakeId, userRole = 'ADMIN', onClose, onRefreshList }) => {
  const insets = useSafeAreaInsets();
  const canManageCustomer = PRIVILEGED_ROLES.includes(userRole);

  const [intake, setIntake] = useState<ServiceIntake | null>(null);
  const [options, setOptions] = useState<ServiceIntakeOptions | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [previewImage, setPreviewImage] = useState<{ uri: string } | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteItemId, setNoteItemId] = useState<string | null>(null);

  const [statusModalItemId, setStatusModalItemId] = useState<'INTAKE' | string | null>(null);
  const [responsibleModalItemId, setResponsibleModalItemId] = useState<string | null>(null);

  // Add-unit modal
  const [addUnitVisible, setAddUnitVisible] = useState(false);
  const [addUnitType, setAddUnitType] = useState<UnitType>('INDOOR_UNIT');
  const [addUnitProductId, setAddUnitProductId] = useState<string | null>(null);
  const [addUnitSerial, setAddUnitSerial] = useState('');
  const [addUnitNotes, setAddUnitNotes] = useState('');
  const [addUnitBusy, setAddUnitBusy] = useState(false);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSerial, setEditSerial] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fetchIntake = useCallback(async () => {
    try {
      const res = await mobileApi.getServiceIntake(intakeId);
      if (res.success && res.data) setIntake(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load service intake details.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [intakeId]);

  useEffect(() => {
    fetchIntake();
    (async () => {
      const [optRes, empRes, prodRes] = await Promise.all([
        mobileApi.getServiceIntakeOptions(),
        mobileApi.listEmployees(),
        mobileApi.listProducts(),
      ]);
      if (optRes.success) setOptions(optRes.data);
      if (empRes.success && Array.isArray(empRes.data)) setEmployees(empRes.data);
      if (prodRes.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    })();
  }, [fetchIntake]);

  const onRefresh = () => { setIsRefreshing(true); fetchIntake(); };

  const imagesForItem = (itemId: string | null) => (intake?.images || []).filter((img) => img.itemId === itemId);

  /* ---- Status ---- */
  const applyStatus = async (status: ServiceStatus) => {
    if (!intake) return;
    try {
      if (statusModalItemId === 'INTAKE') {
        await mobileApi.changeServiceIntakeStatus(intake.id, status);
      } else if (statusModalItemId) {
        await mobileApi.changeServiceItemStatus(intake.id, statusModalItemId, status);
      }
      setStatusModalItemId(null);
      fetchIntake();
      onRefreshList?.();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to change status.');
    }
  };

  /* ---- Responsible ---- */
  const applyResponsible = async (employeeId: string) => {
    if (!intake || !responsibleModalItemId) return;
    try {
      await mobileApi.changeServiceItemResponsible(intake.id, responsibleModalItemId, employeeId);
      setResponsibleModalItemId(null);
      fetchIntake();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to assign employee.');
    }
  };

  /* ---- Notes ---- */
  const submitNote = async () => {
    if (!intake || !noteText.trim()) return;
    try {
      await mobileApi.addServiceIntakeNote(intake.id, noteText.trim(), noteItemId || undefined);
      setNoteModalVisible(false); setNoteText(''); setNoteItemId(null);
      fetchIntake();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add note.');
    }
  };

  /* ---- Site / Problems (inline edit) ---- */
  const updateSite = async (values: string[]) => {
    if (!intake) return;
    try { await mobileApi.updateServiceIntake(intake.id, { siteName: values[0] }); fetchIntake(); }
    catch (err: any) { Alert.alert('Error', err.message || 'Failed to update site.'); }
  };
  const updateProblems = async (values: string[]) => {
    if (!intake) return;
    try { await mobileApi.updateServiceIntake(intake.id, { problems: values }); fetchIntake(); }
    catch (err: any) { Alert.alert('Error', err.message || 'Failed to update problem.'); }
  };

  /* ---- Photos ---- */
  const addPhotosToIntake = async (uris: string[], itemId?: string) => {
    if (!intake) return;
    for (const uri of uris) {
      try {
        await mobileApi.uploadServiceIntakeImage(intake.id, uri, 'image/jpeg', itemId);
      } catch (e) {
        console.warn('[Photo upload failed]', e);
      }
    }
    fetchIntake();
  };
  const removePhoto = async (imageId: string) => {
    if (!intake) return;
    try { await mobileApi.deleteServiceIntakeImage(intake.id, imageId); fetchIntake(); }
    catch (err: any) { Alert.alert('Error', err.message || 'Failed to remove photo.'); }
  };

  /* ---- Add unit ---- */
  const submitAddUnit = async () => {
    if (!intake) return;
    setAddUnitBusy(true);
    try {
      await mobileApi.addServiceIntakeItem(intake.id, {
        itemType: addUnitType,
        productId: addUnitProductId || undefined,
        serialNumber: addUnitSerial || undefined,
        notes: addUnitNotes || undefined,
      });
      setAddUnitVisible(false);
      setAddUnitProductId(null); setAddUnitSerial(''); setAddUnitNotes('');
      fetchIntake();
      onRefreshList?.();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add unit.');
    } finally {
      setAddUnitBusy(false);
    }
  };

  /* ---- Edit unit (model/serial/notes) ---- */
  const startEditItem = (item: ServiceIntakeItem) => {
    setEditingItemId(item.id); setEditSerial(item.serialNumber || ''); setEditNotes(item.notes || '');
  };
  const saveEditItem = async () => {
    if (!intake || !editingItemId) return;
    try {
      await mobileApi.updateServiceIntakeItem(intake.id, editingItemId, { serialNumber: editSerial, notes: editNotes });
      setEditingItemId(null);
      fetchIntake();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update unit.');
    }
  };

  if (isLoading || !intake) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#10B981" />
      </View>
    );
  }

  const custName = intake.customer?.name || intake.customerName || 'Unnamed Customer';
  const intakeColors = STATUS_COLORS[intake.status] ?? {
    bg: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
  };
  const intakeStatusLabel = STATUS_LABELS[intake.status] ?? intake.status ?? 'Unknown Status';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose}><Text style={styles.backBtnText}>←</Text></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{intake.intakeNumber}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 30 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#10B981" />}
      >
        {/* Summary card */}
        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{custName}</Text>
              {!!intake.customer?.mobile && <Text style={styles.metaLine}>{intake.customer.mobile}</Text>}
            </View>
            <TouchableOpacity
              style={[styles.statusBadge, { backgroundColor: intakeColors.bg, borderColor: intakeColors.border }]}
              onPress={() => setStatusModalItemId('INTAKE')}
            >
              <Text style={[styles.statusText, { color: intakeColors.text }]}>{intakeStatusLabel}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.metaLine}>Reported by {intake.createdBy?.name} · {formatDateTime(intake.receivedAt)}</Text>
          <Text style={styles.metaLine}>Age: {intake.ageDays} day{intake.ageDays === 1 ? '' : 's'}</Text>
          {!!intake.takingTo && <Text style={styles.metaLine}>Taking To: {TAKING_TO_LABELS[intake.takingTo]}</Text>}
        </View>

        {/* Site & Problem */}
        {options && (
          <View style={styles.card}>
            <TagSelector label="Site" options={options.sites} selected={intake.siteName ? [intake.siteName] : []} onChange={updateSite} onAddNew={() => { }} />
            <TagSelector
              label="Problem"
              options={options.problems}
              selected={intake.problems || []}
              onChange={updateProblems}
              multi
              exclusiveOption={options.unknownProblem}
              onAddNew={() => { }}
            />
          </View>
        )}

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <Text style={styles.notesText}>{intake.notes || 'No notes.'}</Text>
        </View>

        {/* Intake-level photos */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Photos</Text>
          <PhotoGrid
            photos={imagesForItem(null).map((img) => ({ id: img.id, uri: mobileApi.getServiceIntakeImageUrl(img.storageFileName) }))}
            onAdd={(uris) => addPhotosToIntake(uris)}
            onRemove={(id) => removePhoto(id)}
          />
        </View>

        {/* Units */}
        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <Text style={styles.sectionLabel}>Units</Text>
          </View>
          <View style={styles.addUnitRow}>
            <TouchableOpacity style={styles.addUnitBtn} onPress={() => { setAddUnitType('INDOOR_UNIT'); setAddUnitVisible(true); }}>
              <Text style={styles.addUnitText}>+ Add Indoor Unit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addUnitBtn} onPress={() => { setAddUnitType('OUTDOOR_UNIT'); setAddUnitVisible(true); }}>
              <Text style={styles.addUnitText}>+ Add Outdoor Unit</Text>
            </TouchableOpacity>
          </View>

          {intake.items.map((item) => {
            const colors = STATUS_COLORS[item.status] ?? {
              bg: '#F1F5F9',
              text: '#475569',
              border: '#CBD5E1',
            };
            const itemStatusLabel = STATUS_LABELS[item.status] ?? item.status ?? 'Unknown Status';
            const editing = editingItemId === item.id;
            return (
              <View key={item.id} style={styles.unitCard}>
                <View style={styles.summaryTop}>
                  <Text style={styles.unitTitle}>{item.itemTypeLabel || UNIT_TYPE_LABELS[item.itemType]}</Text>
                  <TouchableOpacity
                    style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}
                    onPress={() => setStatusModalItemId(item.id)}
                  >
                    <Text style={[styles.statusText, { color: colors.text }]}>{itemStatusLabel}</Text>
                  </TouchableOpacity>
                </View>

                {editing ? (
                  <>
                    <TextInput style={styles.input} placeholder="Serial Number" value={editSerial} onChangeText={setEditSerial} />
                    <TextInput style={[styles.input, styles.multiline]} placeholder="Notes" value={editNotes} onChangeText={setEditNotes} multiline />
                    <View style={styles.editRow}>
                      <TouchableOpacity style={styles.smallBtnGhost} onPress={() => setEditingItemId(null)}><Text style={styles.smallBtnGhostText}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtn} onPress={saveEditItem}><Text style={styles.smallBtnText}>Save</Text></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {!!item.productModel && <Text style={styles.metaLine}>Model: {item.productModel}</Text>}
                    <Text style={styles.metaLine}>Serial: {item.serialNumber || '—'}</Text>
                    <Text style={styles.metaLine}>Responsible: {item.responsibleEmployeeName || 'Unassigned'}</Text>
                    {!!item.notes && <Text style={styles.metaLine}>{item.notes}</Text>}

                    <PhotoGrid
                      photos={imagesForItem(item.id).map((img) => ({ id: img.id, uri: mobileApi.getServiceIntakeImageUrl(img.storageFileName) }))}
                      onAdd={(uris) => addPhotosToIntake(uris, item.id)}
                      onRemove={(id) => removePhoto(id)}
                    />

                    <View style={styles.unitActions}>
                      <TouchableOpacity style={styles.smallBtnGhost} onPress={() => startEditItem(item)}><Text style={styles.smallBtnGhostText}>Edit</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtnGhost} onPress={() => setResponsibleModalItemId(item.id)}><Text style={styles.smallBtnGhostText}>Assign</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.smallBtnGhost} onPress={() => { setNoteItemId(item.id); setNoteModalVisible(true); }}><Text style={styles.smallBtnGhostText}>Add Note</Text></TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <Text style={styles.sectionLabel}>History</Text>
            <TouchableOpacity onPress={() => { setNoteItemId(null); setNoteModalVisible(true); }}>
              <Text style={styles.addNoteLink}>+ Add Note</Text>
            </TouchableOpacity>
          </View>
          <ServiceIntakeTimeline events={intake.events || []} />
        </View>
      </ScrollView>

      {/* Status picker modal */}
      <Modal visible={!!statusModalItemId} transparent animationType="fade" onRequestClose={() => setStatusModalItemId(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setStatusModalItemId(null)}>
          <View style={styles.sheet}>
            {STATUS_ORDER.map((s) => (
              <TouchableOpacity key={s} style={styles.sheetRow} onPress={() => applyStatus(s)}>
                <Text style={styles.sheetRowText}>{STATUS_LABELS[s]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Responsible picker modal */}
      <Modal visible={!!responsibleModalItemId} transparent animationType="fade" onRequestClose={() => setResponsibleModalItemId(null)}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setResponsibleModalItemId(null)}>
          <ScrollView style={styles.sheet}>
            {employees.map((e) => (
              <TouchableOpacity key={e.id} style={styles.sheetRow} onPress={() => applyResponsible(e.id)}>
                <Text style={styles.sheetRowText}>{e.name}</Text>
                <Text style={styles.sheetRowSub}>{e.role} · {e.employeeCode}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </Modal>

      {/* Note modal */}
      <Modal visible={noteModalVisible} transparent animationType="fade" onRequestClose={() => setNoteModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sectionLabel}>Add Note</Text>
            <TextInput style={[styles.input, styles.multiline]} placeholder="Note" value={noteText} onChangeText={setNoteText} multiline autoFocus />
            <View style={styles.editRow}>
              <TouchableOpacity style={styles.smallBtnGhost} onPress={() => { setNoteModalVisible(false); setNoteText(''); }}><Text style={styles.smallBtnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.smallBtn} onPress={submitNote}><Text style={styles.smallBtnText}>Add</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add unit modal */}
      <Modal visible={addUnitVisible} animationType="slide" onRequestClose={() => setAddUnitVisible(false)}>
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setAddUnitVisible(false)}><Text style={styles.backBtnText}>✕</Text></TouchableOpacity>
            <Text style={styles.title}>Add {UNIT_TYPE_LABELS[addUnitType]}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView style={{ padding: 16 }}>
            <TouchableOpacity style={styles.input} onPress={() => { setProductSearch(''); setProductPickerOpen(true); }}>
              <Text style={addUnitProductId ? styles.metaLine : { color: '#94A3B8' }}>
                {addUnitProductId ? (products.find((p) => p.id === addUnitProductId)?.model || products.find((p) => p.id === addUnitProductId)?.name) : 'Select Model (optional)'}
              </Text>
            </TouchableOpacity>
            <TextInput style={styles.input} placeholder="Serial Number (optional)" value={addUnitSerial} onChangeText={setAddUnitSerial} />
            <TextInput style={[styles.input, styles.multiline]} placeholder="Notes" value={addUnitNotes} onChangeText={setAddUnitNotes} multiline />
            <TouchableOpacity style={[styles.smallBtn, addUnitBusy && { opacity: 0.6 }, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={submitAddUnit} disabled={addUnitBusy}>
              {addUnitBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.smallBtnText}>Add Unit</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Product picker */}
      <Modal visible={productPickerOpen} animationType="slide" onRequestClose={() => setProductPickerOpen(false)}>
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setProductPickerOpen(false)}><Text style={styles.backBtnText}>✕</Text></TouchableOpacity>
            <Text style={styles.title}>Select Model</Text>
            <View style={{ width: 36 }} />
          </View>
          <TextInput style={[styles.input, { margin: 16 }]} placeholder="Search model..." value={productSearch} onChangeText={setProductSearch} />
          <ScrollView>
            {products.filter((p) => !productSearch || `${p.name} ${p.model}`.toLowerCase().includes(productSearch.toLowerCase())).map((p) => (
              <TouchableOpacity key={p.id} style={styles.prodRow} onPress={() => { setAddUnitProductId(p.id); setProductPickerOpen(false); }}>
                <Text style={styles.customerName}>{p.name}</Text>
                {!!p.model && <Text style={styles.metaLine}>{p.model}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Fullscreen image preview */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <TouchableOpacity style={styles.imageOverlay} activeOpacity={1} onPress={() => setPreviewImage(null)}>
          {previewImage && <Image source={{ uri: previewImage.uri }} style={styles.imageFull} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 18, color: '#0F172A', fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '800', color: '#0F172A', flex: 1, textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  customerName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  metaLine: { fontSize: 12, color: '#475569', marginBottom: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '800' },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  notesText: { fontSize: 13, color: '#334155' },
  addUnitRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  addUnitBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#10B981', alignItems: 'center', backgroundColor: '#ECFDF5' },
  addUnitText: { color: '#10B981', fontWeight: '800', fontSize: 13 },
  unitCard: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  unitTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, fontSize: 13, color: '#0F172A', backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  editRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  unitActions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  smallBtn: { backgroundColor: '#0F172A', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  smallBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  smallBtnGhost: { paddingVertical: 6 },
  smallBtnGhostText: { color: '#10B981', fontWeight: '800', fontSize: 13 },
  addNoteLink: { color: '#10B981', fontWeight: '700', fontSize: 12 },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '70%' },
  sheetRow: { paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  sheetRowText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sheetRowSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  prodRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  imageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  imageFull: { width: '100%', height: '80%' },
});