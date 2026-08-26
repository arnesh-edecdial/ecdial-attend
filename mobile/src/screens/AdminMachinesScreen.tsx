import React, { useState, useEffect } from 'react';
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
  onClose: () => void;
}

export const AdminMachinesScreen: React.FC<AdminMachinesScreenProps> = ({ onClose }) => {
  const [machines, setMachines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingMachine, setEditingMachine] = useState<any | null>(null);

  // Form fields
  const [name, setName] = useState<string>('');
  const [brand, setBrand] = useState<string>('Daikin');
  const [model, setModel] = useState<string>('');
  const [capacity, setCapacity] = useState<string>('1.5 Ton');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('10');

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

  const openAddModal = () => {
    setEditingMachine(null);
    setName('');
    setBrand('Daikin');
    setModel('');
    setCapacity('1.5 Ton');
    setDescription('');
    setPrice('');
    setStock('10');
    setModalVisible(true);
  };

  const openEditModal = (m: any) => {
    setEditingMachine(m);
    setName(m.name);
    setBrand(m.brand || 'Daikin');
    setModel(m.model || '');
    setCapacity(m.capacity || '1.5 Ton');
    setDescription(m.description || '');
    setPrice(String(m.defaultPrice || ''));
    setStock(String(m.availableStock || '10'));
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      alert('Please enter machine name and price.');
      return;
    }

    try {
      const payload = {
        name,
        brand,
        model: model || name,
        capacity,
        category: 'MAIN_UNIT',
        description: description || `${brand} ${capacity} AC Unit`,
        defaultPrice: parseFloat(price) || 0,
        availableStock: parseInt(stock) || 0,
      };

      if (editingMachine) {
        await mobileApi.updateMachine(editingMachine.id, payload);
      } else {
        await mobileApi.createMachine(payload);
      }

      setModalVisible(false);
      fetchMachines();
    } catch (err: any) {
      alert(err.message || 'Failed to save machine');
    }
  };

  const handleToggleActive = async (m: any) => {
    try {
      await mobileApi.toggleMachine(m.id);
      fetchMachines();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Machine Models</Text>
          <Text style={styles.subtitle}>Admin catalogue management for Sales quotations</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : machines.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No machine models configured.</Text>
          </View>
        ) : (
          machines.map((m) => (
            <View key={m.id} style={styles.machineCard}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.machineName}>{m.name}</Text>
                  <Text style={styles.machineModel}>Model: {m.model || 'Standard'} • Brand: {m.brand || 'Daikin'}</Text>
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
          ))
        )}
      </ScrollView>

      {/* ADD / EDIT MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingMachine ? 'Edit Machine Model' : 'Add New Machine Model'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Model Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Daikin 1.5Tr 3Star Inverter" />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Brand</Text>
                  <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Daikin" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Capacity</Text>
                  <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} placeholder="1.5 Ton" />
                </View>
              </View>

              <Text style={styles.inputLabel}>Model Number / Code</Text>
              <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="FTKC48XV16" />

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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  addBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 10,
  },
  machineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  machineName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  machineModel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066CC',
  },
  stockText: {
    fontSize: 11,
    color: '#64748B',
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
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
    color: '#64748B',
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 12,
  },
});
