import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { mobileApi } from '../services/api';

interface Customer { id: string; name: string | null; mobile: string | null; address?: string | null; }

interface Props {
  value: Customer | null;
  onSelect: (c: Customer) => void;
  /** Reuses the same customer-creation form the quotation module uses. */
  renderAddCustomerForm: (opts: { onCreated: (c: Customer) => void; onCancel: () => void }) => React.ReactNode;
}

/** Customer selector for Service Intake — reuses the existing Customer system (search + create), never a separate table. */
export const CustomerPicker: React.FC<Props> = ({ value, onSelect, renderAddCustomerForm }) => {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'search' | 'add'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const res = await mobileApi.listCustomers(q || undefined);
      if (res.success && Array.isArray(res.data)) setResults(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visible && mode === 'search') search(query); }, [visible, mode]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Customer</Text>
      <TouchableOpacity style={styles.selectBox} onPress={() => { setMode('search'); setVisible(true); }}>
        {value ? (
          <View>
            <Text style={styles.selectedName}>{value.name || 'Unnamed Customer'}</Text>
            {!!value.mobile && <Text style={styles.selectedSub}>{value.mobile}</Text>}
          </View>
        ) : (
          <Text style={styles.placeholder}>Select Customer</Text>
        )}
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setVisible(false)}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{mode === 'search' ? 'Select Customer' : 'New Customer'}</Text>
            <View style={{ width: 24 }} />
          </View>

          {mode === 'search' ? (
            <>
              <TextInput
                value={query}
                onChangeText={(t) => { setQuery(t); search(t); }}
                placeholder="Search by name or mobile"
                style={styles.searchInput}
              />
              <TouchableOpacity style={styles.addNewRow} onPress={() => setMode('add')}>
                <Text style={styles.addNewText}>+ Add New Customer</Text>
              </TouchableOpacity>
              {loading ? (
                <ActivityIndicator style={{ marginTop: 24 }} color="#10B981" />
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  ListEmptyComponent={<Text style={styles.emptyText}>No customers found.</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.custRow} onPress={() => { onSelect(item); setVisible(false); }}>
                      <Text style={styles.custName}>{item.name || 'Unnamed Customer'}</Text>
                      {!!item.mobile && <Text style={styles.custSub}>{item.mobile}</Text>}
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          ) : (
            renderAddCustomerForm({
              onCreated: (c) => { onSelect(c); setVisible(false); setMode('search'); },
              onCancel: () => setMode('search'),
            })
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  selectBox: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  placeholder: { color: '#94A3B8', fontSize: 14 },
  selectedName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  selectedSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalRoot: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 50 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  closeText: { fontSize: 18, color: '#0F172A' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  searchInput: { marginHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF', fontSize: 14 },
  addNewRow: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 14 },
  addNewText: { color: '#10B981', fontWeight: '800', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 32, fontSize: 13 },
  custRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  custName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  custSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
});
