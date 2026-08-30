import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import { mobileApi } from '../services/api';

interface AdminMachinesScreenProps {
  onClose?: () => void;
}

const DEFAULT_BRANDS = [
  'Daikin',
  'Mitsubishi',
  'LG',
  'Godrej',
  'Voltas',
  'Panasonic',
  'Carrier',
  'Blue Star',
  'Hitachi',
  'O General',
  'Lloyd',
  'Samsung',
];

export const AdminMachinesScreen: React.FC<AdminMachinesScreenProps> = ({ onClose }) => {
  const [machines, setMachines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingMachine, setEditingMachine] = useState<any | null>(null);

  // Search & Brand Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');

  // Form fields
  const [name, setName] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Daikin');
  const [customBrandName, setCustomBrandName] = useState<string>('');
  const [isAddingNewBrand, setIsAddingNewBrand] = useState<boolean>(false);
  const [model, setModel] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('1.5 Ton');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('10');

  const extractBrand = (item: any): string => {
    if (item.brand) return item.brand;
    const descMatch = item.description?.match(/\[Brand:\s*([^\]]+)\]/i);
    if (descMatch) return descMatch[1].trim();

    const fullText = `${item.name || ''} ${item.model || ''} ${item.description || ''}`.toLowerCase();
    for (const b of DEFAULT_BRANDS) {
      if (fullText.includes(b.toLowerCase())) return b;
    }
    return 'Other';
  };

  const fetchMachines = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listProducts('MAIN_UNIT');
      if (res.success) {
        setMachines(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const allBrands = useMemo(() => {
    const set = new Set<string>();
    machines.forEach((m) => set.add(extractBrand(m)));
    return ['ALL', ...Array.from(set).filter(Boolean)];
  }, [machines]);

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (selectedBrandFilter !== 'ALL') {
        const b = extractBrand(m);
        if (b.toLowerCase() !== selectedBrandFilter.toLowerCase()) return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const combined = `${m.name || ''} ${m.model || ''} ${m.description || ''} ${extractBrand(m)}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }
      return true;
    });
  }, [machines, selectedBrandFilter, searchQuery]);

  const openAddModal = () => {
    setEditingMachine(null);
    setName('');
    setSelectedBrand('Daikin');
    setCustomBrandName('');
    setIsAddingNewBrand(false);
    setModel('');
    setCapacity('1.5 Ton');
    setDescription('');
    setPrice('');
    setStock('10');
    setModalVisible(true);
  };

  const openEditModal = (m: any) => {
    setEditingMachine(m);
    setName(m.name || '');
    const currentBrand = extractBrand(m);
    if (DEFAULT_BRANDS.includes(currentBrand)) {
      setSelectedBrand(currentBrand);
      setIsAddingNewBrand(false);
      setCustomBrandName('');
    } else {
      setSelectedBrand('CUSTOM');
      setIsAddingNewBrand(true);
      setCustomBrandName(currentBrand === 'Other' ? '' : currentBrand);
    }
    setModel(m.model || '');
    setCapacity(m.capacity || '1.5 Ton');
    const cleanDesc = (m.description || '').replace(/\[Brand:[^\]]+\]\s*/i, '');
    setDescription(cleanDesc);
    setPrice(String(m.defaultPrice || ''));
    setStock(String(m.availableStock || '10'));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      alert('Please enter machine name and price.');
      return;
    }

    const finalBrand = isAddingNewBrand ? customBrandName.trim() || 'Other' : selectedBrand;

    try {
      const cleanDesc = description.replace(/\[Brand:[^\]]+\]\s*/i, '').trim();
      const payload = {
        name: name.trim(),
        model: model.trim() || null,
        category: 'MAIN_UNIT',
        defaultPrice: parseFloat(price) || 0,
        availableStock: parseInt(stock, 10) || 10,
        defaultUnit: 'Nos',
        description: `[Brand: ${finalBrand}] ${cleanDesc || `${name} (1.5 Ton)`}`,
      };

      if (editingMachine) {
        await mobileApi.updateMachine(editingMachine.id, payload);
        alert('Machine model updated successfully.');
      } else {
        await mobileApi.createMachine(payload);
        alert('Machine model added successfully.');
      }
      setModalVisible(false);
      fetchMachines();
    } catch (err: any) {
      alert(err.message || 'Failed to save machine model');
    }
  };

  const handleToggleActive = async (m: any) => {
    try {
      await mobileApi.toggleMachine(m.id);
      fetchMachines();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Machine Models</Text>
          <Text style={styles.subtitle}>Admin catalogue management for Sales quotations</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search machines by model, brand, capacity..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Brand Filter Bar */}
      <View style={styles.brandRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          {allBrands.map((b) => {
            const isSelected = selectedBrandFilter.toLowerCase() === b.toLowerCase();
            return (
              <TouchableOpacity
                key={b}
                style={[styles.brandChip, isSelected && styles.brandChipActive]}
                onPress={() => setSelectedBrandFilter(b)}
              >
                <Text style={[styles.brandChipText, isSelected && styles.brandChipTextActive]}>
                  {b === 'ALL' ? 'All Brands' : b}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : filteredMachines.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No machine models found.</Text>
          </View>
        ) : (
          filteredMachines.map((m) => {
            const brand = extractBrand(m);
            return (
              <View key={m.id} style={styles.machineCard}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={styles.brandTag}>
                        <Text style={styles.brandTagText}>{brand}</Text>
                      </View>
                      <Text style={styles.machineName}>{m.name}</Text>
                    </View>
                    <Text style={styles.machineModel}>Model: {m.model || 'Standard'}</Text>
                  </View>
                  <Switch
                    value={m.isActive}
                    onValueChange={() => handleToggleActive(m)}
                    trackColor={{ true: '#10B981', false: '#CBD5E1' }}
                  />
                </View>

                <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#F1F5F9' }]}>
                  <Text style={styles.priceText}>
                    Price: ₹{Number(m.defaultPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={styles.stockText}>Stock: {m.availableStock} units</Text>
                  <TouchableOpacity onPress={() => openEditModal(m)}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ADD / EDIT MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingMachine ? 'Edit Machine Model' : 'Add New Machine Model'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Brand Picker */}
              <Text style={styles.inputLabel}>Brand / Manufacturer *</Text>
              <View style={styles.brandPickerRow}>
                {DEFAULT_BRANDS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.modalBrandChip,
                      !isAddingNewBrand && selectedBrand === b && styles.modalBrandChipActive,
                    ]}
                    onPress={() => {
                      setSelectedBrand(b);
                      setIsAddingNewBrand(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalBrandChipText,
                        !isAddingNewBrand && selectedBrand === b && styles.modalBrandChipTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={[styles.modalBrandChip, isAddingNewBrand && styles.modalBrandChipActive]}
                  onPress={() => setIsAddingNewBrand(true)}
                >
                  <Text
                    style={[
                      styles.modalBrandChipText,
                      isAddingNewBrand && styles.modalBrandChipTextActive,
                    ]}
                  >
                    + Add New Brand
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom Brand Input */}
              {isAddingNewBrand && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.inputLabel}>Custom Brand Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Toshiba, O General, Haier..."
                    placeholderTextColor="#94A3B8"
                    value={customBrandName}
                    onChangeText={setCustomBrandName}
                  />
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Model Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Daikin 1.5Tr 3Star Inverter" />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Capacity</Text>
                  <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} placeholder="1.5 Ton" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Model Number / Code</Text>
                  <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="FTKC48XV16" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Selling Price (₹) *</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="30423.73" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Available Stock</Text>
                  <TextInput style={styles.input} keyboardType="numeric" value={stock} onChangeText={setStock} placeholder="10" />
                </View>
              </View>

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.input, { height: 50 }]} value={description} onChangeText={setDescription} placeholder="Short feature summary" multiline />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Machine Model</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    marginLeft: 6,
  },
  brandRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  brandChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandChipActive: {
    backgroundColor: '#0A1E3F',
    borderColor: '#0A1E3F',
  },
  brandChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  brandChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  machineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  brandTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0066CC',
  },
  machineName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  machineModel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  priceText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0066CC',
  },
  stockText: {
    fontSize: 11,
    color: '#64748B',
  },
  editText: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  brandPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  modalBrandChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalBrandChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  modalBrandChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modalBrandChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
