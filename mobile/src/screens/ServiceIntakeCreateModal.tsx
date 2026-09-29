import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { TagSelector } from '../components/TagSelector';
import { PhotoGrid, PhotoItem } from '../components/PhotoGrid';
import { ServiceIntakeOptions, TakingTo, UnitType, TAKING_TO_LABELS, UNIT_TYPE_LABELS, NewUnitInput } from '../types/serviceIntake';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (createdIntake: any) => void;
}

interface SelectedCustomer {
  id: string;
  name: string | null;
  mobile: string | null;
  address: string | null;
}

let unitSeq = 0;
const newUnitId = () => `local-${Date.now()}-${unitSeq++}`;

export const ServiceIntakeCreateModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const insets = useSafeAreaInsets();

  const [options, setOptions] = useState<ServiceIntakeOptions | null>(null);
  const [site, setSite] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [takingTo, setTakingTo] = useState<TakingTo | null>(null);
  const [notes, setNotes] = useState('');
  const [units, setUnits] = useState<(NewUnitInput & { id: string; photos: PhotoItem[] })[]>([]);
  const [productPicker, setProductPicker] = useState<{ unitId: string } | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --------------------------------------------------------------------
  // Customer selection — mirrors the "Select Customer" picker used on
  // QuotationCreateScreen.tsx (fetchCustomersForPicker / handleSelectCustomer /
  // handleCreateCustomerInline), reusing the same Customer system and the
  // same mobileApi.listCustomers / mobileApi.createCustomer calls. Unlike the
  // quotation screen, there is no "Skip / Create Without Customer" option —
  // a customer is mandatory for Service Intake.
  // --------------------------------------------------------------------
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isAddingCustomerInline, setIsAddingCustomerInline] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlineAddress, setInlineAddress] = useState('');
  const [inlineMobile, setInlineMobile] = useState('');
  const [isSavingCustomerInline, setIsSavingCustomerInline] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [optRes, prodRes] = await Promise.all([mobileApi.getServiceIntakeOptions(), mobileApi.listProducts()]);
      if (optRes.success) setOptions(optRes.data);
      if (prodRes.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    })();
  }, [visible]);

  const resetForm = () => {
    setSelectedCustomer(null); setSite([]); setProblems([]); setTakingTo(null); setNotes(''); setUnits([]);
  };

  const fetchCustomersForPicker = async (search?: string) => {
    try {
      setIsLoadingCustomers(true);
      const res = await mobileApi.listCustomers(search);
      if (res.success && res.data) setCustomerList(res.data);
    } catch (err) {
      console.error('[Fetch Customers Error]', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const openCustomerModal = () => {
    setIsAddingCustomerInline(false);
    setCustomerSearchQuery('');
    fetchCustomersForPicker();
    setCustomerModalVisible(true);
  };

  const handleSelectCustomer = (c: any) => {
    setSelectedCustomer({ id: c.id, name: c.name || null, mobile: c.mobile || null, address: c.address || null });
    setCustomerModalVisible(false);
  };

  const handleCreateCustomerInline = async () => {
    if (!inlineName.trim() && !inlineMobile.trim()) {
      Alert.alert('Required', 'Enter at least a name or a mobile number.');
      return;
    }
    try {
      setIsSavingCustomerInline(true);
      const res = await mobileApi.createCustomer({
        name: inlineName.trim() || undefined,
        address: inlineAddress.trim() || undefined,
        mobile: inlineMobile.trim() || undefined,
      });
      if (res.success && res.data) {
        handleSelectCustomer(res.data);
        setIsAddingCustomerInline(false);
        setInlineName(''); setInlineAddress(''); setInlineMobile('');
      } else {
        Alert.alert('Error', res.message || 'Failed to save customer.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save customer.');
    } finally {
      setIsSavingCustomerInline(false);
    }
  };

  // --------------------------------------------------------------------
  // Units
  // --------------------------------------------------------------------
  const addUnit = (itemType: UnitType) => {
    setUnits((u) => [...u, { id: newUnitId(), itemType, localImages: [], photos: [] }]);
  };
  const removeUnit = (id: string) => setUnits((u) => u.filter((x) => x.id !== id));
  const patchUnit = (id: string, patch: Partial<NewUnitInput>) =>
    setUnits((u) => u.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addUnitPhotos = (id: string, uris: string[]) =>
    setUnits((u) => u.map((x) => (x.id === id ? { ...x, photos: [...x.photos, ...uris.map((uri) => ({ id: `${Date.now()}-${uri}`, uri }))] } : x)));
  const removeUnitPhoto = (unitId: string, photoId: string) =>
    setUnits((u) => u.map((x) => (x.id === unitId ? { ...x, photos: x.photos.filter((p) => p.id !== photoId) } : x)));

  const uploadPendingPhotos = async (intakeId: string, itemId: string, photos: PhotoItem[]) => {
    for (const p of photos) {
      try {
        await mobileApi.uploadServiceIntakeImage(intakeId, p.uri, 'image/jpeg', itemId);
      } catch (e) {
        console.warn('[Photo upload failed]', e);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) return Alert.alert('Customer Required', 'Please select or add a customer.');
    if (!takingTo) return Alert.alert('Destination Required', 'Please choose where the unit is being taken.');

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer.id,
        siteName: site[0],
        problems: problems.length ? problems : [options?.unknownProblem || 'Unknown Problem'],
        takingTo,
        notes: notes.trim() || undefined,
        items: units.map((u) => ({ itemType: u.itemType, productId: u.productId || undefined, serialNumber: u.serialNumber, notes: u.notes })),
      };
      const res = await mobileApi.createServiceIntake(payload);
      if (!res.success || !res.data) throw new Error(res.message || 'Failed to create service intake.');

      // Match created items to local units by order, then upload each unit's photos.
      const createdItems: any[] = res.data.items || [];
      await Promise.all(units.map((u, i) => (createdItems[i] ? uploadPendingPhotos(res.data.id, createdItems[i].id, u.photos) : Promise.resolve())));

      Alert.alert('✓ Intake Created', `Service Intake ${res.data.intakeNumber} created.`);
      resetForm();
      onSuccess(res.data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create service intake.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F8FAFC' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
          <Text style={styles.headerTitle}>New Service Intake</Text>
          <View style={{ width: 36 }} />
        </View>

        {!options ? (
          <ActivityIndicator style={{ marginTop: 60 }} color="#10B981" />
        ) : (
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 24) + 90 }]}>
            {/* Customer */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Customer</Text>
              <TouchableOpacity style={styles.pickCustomerBtn} onPress={openCustomerModal}>
                <Text style={styles.pickCustomerBtnText}>
                  {selectedCustomer ? '👤 Change Customer' : '👤 Select Customer'}
                </Text>
              </TouchableOpacity>
              {selectedCustomer && (
                <View style={styles.selectedCustomerBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedCustomerName}>{selectedCustomer.name || 'Unnamed Customer'}</Text>
                    {!!selectedCustomer.mobile && <Text style={styles.selectedCustomerSub}>📞 {selectedCustomer.mobile}</Text>}
                    {!!selectedCustomer.address && <Text style={styles.selectedCustomerSub} numberOfLines={1}>📍 {selectedCustomer.address}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                    <Text style={styles.clearCustomerText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TagSelector
              label="Site"
              options={options.sites}
              selected={site}
              onChange={setSite}
              onAddNew={() => { }}
            />

            <TagSelector
              label="Problem"
              options={options.problems}
              selected={problems}
              onChange={setProblems}
              multi
              exclusiveOption={options.unknownProblem}
              onAddNew={() => { }}
            />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Taking To</Text>
              <View style={styles.row}>
                {options.takingTo.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.destChip, takingTo === t.key && styles.destChipActive]}
                    onPress={() => setTakingTo(t.key)}
                  >
                    <Text style={[styles.destChipText, takingTo === t.key && styles.destChipTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Units</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.addUnitBtn} onPress={() => addUnit('INDOOR_UNIT')}>
                  <Text style={styles.addUnitText}>+ Add Indoor Unit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addUnitBtn} onPress={() => addUnit('OUTDOOR_UNIT')}>
                  <Text style={styles.addUnitText}>+ Add Outdoor Unit</Text>
                </TouchableOpacity>
              </View>

              {units.map((u, idx) => (
                <View key={u.id} style={styles.unitCard}>
                  <View style={styles.unitHeader}>
                    <Text style={styles.unitTitle}>{UNIT_TYPE_LABELS[u.itemType]} {idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeUnit(u.id)}><Text style={styles.removeUnitText}>Remove</Text></TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.modelSelect} onPress={() => { setProductSearch(''); setProductPicker({ unitId: u.id }); }}>
                    <Text style={u.productId ? styles.modelSelected : styles.modelPlaceholder}>
                      {u.productId ? products.find((p) => p.id === u.productId)?.model || products.find((p) => p.id === u.productId)?.name : 'Select Model (optional)'}
                    </Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.input}
                    placeholder="Serial Number (optional)"
                    value={u.serialNumber}
                    onChangeText={(t) => patchUnit(u.id, { serialNumber: t })}
                  />
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    placeholder="Notes"
                    value={u.notes}
                    onChangeText={(t) => patchUnit(u.id, { notes: t })}
                    multiline
                  />

                  <PhotoGrid photos={u.photos} onAdd={(uris) => addUnitPhotos(u.id, uris)} onRemove={(id) => removeUnitPhoto(u.id, id)} />
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes</Text>
              <TextInput style={[styles.input, styles.multiline]} placeholder="Optional notes" value={notes} onChangeText={setNotes} multiline />
            </View>
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Create Service Intake</Text>}
          </TouchableOpacity>
        </View>

        {/* --------------------------------------------------------------
            CUSTOMER PICKER & QUICK INLINE CREATION MODAL
            Same pattern as QuotationCreateScreen.tsx's customer modal:
            one Modal, two views toggled by isAddingCustomerInline, using
            mobileApi.listCustomers / mobileApi.createCustomer. No "Skip"
            option here — customer is mandatory for Service Intake.
        -------------------------------------------------------------- */}
        <Modal
          visible={customerModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCustomerModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Select Customer</Text>
                  <Text style={styles.modalSubtitle}>Pick an existing customer or add one</Text>
                </View>
                <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {isAddingCustomerInline ? (
                <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }} keyboardShouldPersistTaps="handled">
                  <Text style={styles.quickAddTitle}>Quick Add New Customer</Text>
                  <Text style={styles.quickAddHint}>* All fields are optional except name or mobile.</Text>

                  <Text style={styles.fieldLabel}>Customer / Company Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. ABC Enterprises or Mr. Ramesh"
                    placeholderTextColor="#94A3B8"
                    value={inlineName}
                    onChangeText={setInlineName}
                  />

                  <Text style={styles.fieldLabel}>Mobile Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#94A3B8"
                    value={inlineMobile}
                    onChangeText={setInlineMobile}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.fieldLabel}>Address / Location</Text>
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    placeholder="e.g. 42 Cross Street, Coimbatore"
                    placeholderTextColor="#94A3B8"
                    value={inlineAddress}
                    onChangeText={setInlineAddress}
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.submitBtn, isSavingCustomerInline && { opacity: 0.6 }]}
                    onPress={handleCreateCustomerInline}
                    disabled={isSavingCustomerInline}
                  >
                    {isSavingCustomerInline ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>Save & Select Customer</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.backToListBtn} onPress={() => setIsAddingCustomerInline(false)}>
                    <Text style={styles.backToListText}>Back to Customer List</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <>
                  <View style={styles.searchAddRow}>
                    <View style={styles.modalSearchBox}>
                      <Text style={{ fontSize: 15 }}>🔍</Text>
                      <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search name, phone, address..."
                        placeholderTextColor="#94A3B8"
                        value={customerSearchQuery}
                        onChangeText={(t) => { setCustomerSearchQuery(t); fetchCustomersForPicker(t); }}
                      />
                      {customerSearchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => { setCustomerSearchQuery(''); fetchCustomersForPicker(''); }}>
                          <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '700' }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity style={styles.quickAddBtn} onPress={() => setIsAddingCustomerInline(true)}>
                      <Text style={styles.quickAddBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}>
                    {isLoadingCustomers ? (
                      <ActivityIndicator size="small" color="#10B981" style={{ marginTop: 20 }} />
                    ) : customerList.length === 0 ? (
                      <View style={{ padding: 24, alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginBottom: 6 }}>👥</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>No customers found</Text>
                        <TouchableOpacity style={styles.quickAddBtnLarge} onPress={() => setIsAddingCustomerInline(true)}>
                          <Text style={styles.quickAddBtnText}>+ Add New Customer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      customerList.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.customerRow, selectedCustomer?.id === c.id && styles.customerRowActive]}
                          onPress={() => handleSelectCustomer(c)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.customerRowTop}>
                            <Text style={styles.customerRowName}>{c.name || 'Unnamed Client'}</Text>
                            {!!c.mobile && <Text style={styles.customerRowMobile}>📞 {c.mobile}</Text>}
                          </View>
                          {!!c.address && (
                            <Text style={styles.customerRowAddress} numberOfLines={1}>📍 {c.address}</Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={!!productPicker} animationType="slide" onRequestClose={() => setProductPicker(null)}>
          <View style={styles.pickerRoot}>
            <View style={styles.productModalHeader}>
              <TouchableOpacity onPress={() => setProductPicker(null)}><Text style={styles.closeBtnText}>✕</Text></TouchableOpacity>
              <Text style={styles.headerTitle}>Select Model</Text>
              <View style={{ width: 24 }} />
            </View>
            <TextInput style={styles.searchInput} placeholder="Search model..." value={productSearch} onChangeText={setProductSearch} />
            <ScrollView>
              {products
                .filter((p) => !productSearch || `${p.name} ${p.model}`.toLowerCase().includes(productSearch.toLowerCase()))
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.prodRow}
                    onPress={() => { if (productPicker) patchUnit(productPicker.unitId, { productId: p.id }); setProductPicker(null); }}
                  >
                    <Text style={styles.prodName}>{p.name}</Text>
                    {!!p.model && <Text style={styles.prodSub}>{p.model}</Text>}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 18, color: '#0F172A', fontWeight: '800' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  body: { padding: 16 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Customer — "select" button + selected banner on the main form
  pickCustomerBtn: { backgroundColor: '#0F172A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  pickCustomerBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  selectedCustomerBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  selectedCustomerName: { fontSize: 14, fontWeight: '800', color: '#065F46' },
  selectedCustomerSub: { fontSize: 12, color: '#047857', marginTop: 2 },
  clearCustomerText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },

  destChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  destChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  destChipText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  destChipTextActive: { color: '#FFFFFF' },
  addUnitBtn: { flex: 1, minWidth: '45%', paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#10B981', alignItems: 'center', backgroundColor: '#ECFDF5' },
  addUnitText: { color: '#10B981', fontWeight: '800', fontSize: 13 },
  unitCard: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  unitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  unitTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  removeUnitText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  modelSelect: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10 },
  modelPlaceholder: { color: '#94A3B8', fontSize: 13 },
  modelSelected: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, fontSize: 13, color: '#0F172A', backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E8F0' },
  submitBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  // Customer picker modal (mirrors QuotationCreateScreen's modal)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 11, color: '#64748B', marginTop: 2 },
  modalCloseText: { fontSize: 18, color: '#64748B', fontWeight: '800' },
  searchAddRow: { flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginTop: 10 },
  modalSearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  modalSearchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  quickAddBtn: { backgroundColor: '#10B981', paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quickAddBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  quickAddBtnLarge: { marginTop: 10, backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  customerRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  customerRowActive: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  customerRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerRowName: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  customerRowMobile: { fontSize: 11, color: '#10B981', fontWeight: '700' },
  customerRowAddress: { fontSize: 11, color: '#64748B', marginTop: 2 },
  quickAddTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  quickAddHint: { fontSize: 11, color: '#10B981', fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#334155' },
  backToListBtn: { paddingVertical: 12, alignItems: 'center' },
  backToListText: { color: '#64748B', fontWeight: '700', fontSize: 13 },

  pickerRoot: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 50 },
  productModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  searchInput: { marginHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF', fontSize: 14, marginBottom: 10 },
  prodRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  prodName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  prodSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});