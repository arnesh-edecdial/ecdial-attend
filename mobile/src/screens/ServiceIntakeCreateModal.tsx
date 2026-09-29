import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api'; // core: listProducts
import { serviceIntakeApi } from '../services/serviceIntakeApi'; // service-intake specific
import { TagSelector } from '../components/serviceIntake/TagSelector';
import { CustomerPicker } from '../components/serviceIntake/CustomerPicker';
import { PhotoGrid, PhotoItem } from '../components/serviceIntake/PhotoGrid';
import { ServiceIntakeOptions, TakingTo, UnitType, TAKING_TO_LABELS, UNIT_TYPE_LABELS, NewUnitInput } from '../types/serviceIntake';

// TODO: point this at the project's real quotation customer-creation form component.
import { QuotationCustomerForm } from './QuotationCustomerForm'; // placeholder import — replace with the actual component

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (createdIntake: any) => void;
}

let unitSeq = 0;
const newUnitId = () => `local-${Date.now()}-${unitSeq++}`;

export const ServiceIntakeCreateModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const insets = useSafeAreaInsets();

  const [options, setOptions] = useState<ServiceIntakeOptions | null>(null);
  const [customer, setCustomer] = useState<{ id: string; name: string | null; mobile: string | null } | null>(null);
  const [site, setSite] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [takingTo, setTakingTo] = useState<TakingTo | null>(null);
  const [notes, setNotes] = useState('');
  const [units, setUnits] = useState<(NewUnitInput & { id: string; photos: PhotoItem[] })[]>([]);
  const [productPicker, setProductPicker] = useState<{ unitId: string } | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [optRes, prodRes] = await Promise.all([serviceIntakeApi.getOptions(), mobileApi.listProducts()]);
      if (optRes.success) setOptions(optRes.data);
      if (prodRes.success && Array.isArray(prodRes.data)) setProducts(prodRes.data);
    })();
  }, [visible]);

  const resetForm = () => {
    setCustomer(null); setSite([]); setProblems([]); setTakingTo(null); setNotes(''); setUnits([]);
  };

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
        await serviceIntakeApi.uploadImage(intakeId, p.uri, 'image/jpeg', itemId);
      } catch (e) {
        console.warn('[Photo upload failed]', e);
      }
    }
  };

  const handleSubmit = async () => {
    if (!customer) return Alert.alert('Customer Required', 'Please select or add a customer.');
    if (!takingTo) return Alert.alert('Destination Required', 'Please choose where the unit is being taken.');

    setIsSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        siteName: site[0],
        problems: problems.length ? problems : [options?.unknownProblem || 'Unknown Problem'],
        takingTo,
        notes: notes.trim() || undefined,
        items: units.map((u) => ({ itemType: u.itemType, productId: u.productId || undefined, serialNumber: u.serialNumber, notes: u.notes })),
      };
      const res = await serviceIntakeApi.create(payload);
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
            <CustomerPicker
              value={customer}
              onSelect={setCustomer}
              renderAddCustomerForm={({ onCreated, onCancel }) => (
                <QuotationCustomerForm onCreated={onCreated} onCancel={onCancel} />
              )}
            />

            <TagSelector
              label="Site"
              options={options.sites}
              selected={site}
              onChange={setSite}
              onAddNew={() => {}}
            />

            <TagSelector
              label="Problem"
              options={options.problems}
              selected={problems}
              onChange={setProblems}
              multi
              exclusiveOption={options.unknownProblem}
              onAddNew={() => {}}
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

        <Modal visible={!!productPicker} animationType="slide" onRequestClose={() => setProductPicker(null)}>
          <View style={styles.pickerRoot}>
            <View style={styles.modalHeader}>
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
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 10, fontSize: 13, color: '#0F172A' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#E2E8F0' },
  submitBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  pickerRoot: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  searchInput: { marginHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF', fontSize: 14, marginBottom: 10 },
  prodRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  prodName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  prodSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});
