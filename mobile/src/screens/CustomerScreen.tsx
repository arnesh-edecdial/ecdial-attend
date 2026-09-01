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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { mobileApi } from '../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomerScreenProps {
  userRole?: 'ADMIN' | 'SALES' | 'EMPLOYEE';
  onClose?: () => void;
  onSelectCustomer?: (customer: any) => void;
}

export const CustomerScreen: React.FC<CustomerScreenProps> = ({
  userRole = 'SALES',
  onClose,
  onSelectCustomer,
}) => {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);

  // Form Fields (All Optional)
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchCustomers = async (search?: string) => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listCustomers(search);
      if (res.success && res.data) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error('[Fetch Customers Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    fetchCustomers(text);
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setAddress('');
    setMobile('');
    setEmail('');
    setNotes('');
    setModalVisible(true);
  };

  const openEditModal = (customer: any) => {
    setEditingCustomer(customer);
    setName(customer.name || '');
    setAddress(customer.address || '');
    setMobile(customer.mobile || '');
    setEmail(customer.email || '');
    setNotes(customer.notes || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    // All fields are optional, but if all are blank, provide a friendly default
    const payload = {
      name: name.trim() || undefined,
      address: address.trim() || undefined,
      mobile: mobile.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      setIsSaving(true);
      if (editingCustomer) {
        await mobileApi.updateCustomer(editingCustomer.id, payload);
        Alert.alert('✓ Customer Updated', 'Customer details saved successfully.');
      } else {
        const res = await mobileApi.createCustomer(payload);
        Alert.alert('✓ Customer Created', 'New customer added successfully.');
        if (onSelectCustomer && res.data) {
          onSelectCustomer(res.data);
        }
      }
      setModalVisible(false);
      fetchCustomers(searchQuery);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save customer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (customer: any) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer.name || 'this customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileApi.deleteCustomer(customer.id);
              fetchCustomers(searchQuery);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete customer.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Safe Area Inset */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.subtitle}>Client directory for Sales quotations</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.85}>
            <Text style={styles.addBtnText}>+ Add Customer</Text>
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
          placeholder="Search by customer name, mobile, address..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Customer List */}
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 130 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : customers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={styles.emptyTitle}>No Customers Found</Text>
            <Text style={styles.emptyText}>Tap "+ Add Customer" above to create your first client.</Text>
          </View>
        ) : (
          customers.map((c) => {
            const initial = (c.name || 'C').charAt(0).toUpperCase();
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.customerCard}
                onPress={() => onSelectCustomer && onSelectCustomer(c)}
                activeOpacity={onSelectCustomer ? 0.7 : 1}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>{c.name || 'Unnamed Client'}</Text>
                    {c.mobile && <Text style={styles.customerPhone}>📞 {c.mobile}</Text>}
                  </View>
                  {c._count?.quotations > 0 && (
                    <View style={styles.quoteCountBadge}>
                      <Text style={styles.quoteCountText}>{c._count.quotations} Quotes</Text>
                    </View>
                  )}
                </View>

                {c.address && (
                  <View style={styles.addressRow}>
                    <Text style={styles.addressText} numberOfLines={2}>
                      📍 {c.address}
                    </Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>
                    Added on {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => openEditModal(c)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    {userRole === 'ADMIN' && (
                      <TouchableOpacity onPress={() => handleDelete(c)}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ADD / EDIT CUSTOMER MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputNotice}>* All fields are optional. Fast entry allowed.</Text>

              <Text style={styles.inputLabel}>Customer / Company Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. ABC Enterprises or Mr. Ramesh"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Mobile / Contact Number</Text>
              <TextInput
                style={styles.input}
                value={mobile}
                onChangeText={setMobile}
                placeholder="e.g. 9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Address / Site Location</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. 42 Cross Street, RS Puram, Coimbatore"
                placeholderTextColor="#94A3B8"
                multiline
              />

              <Text style={styles.inputLabel}>Email (Optional)</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. client@company.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Notes / Instructions</Text>
              <TextInput
                style={[styles.input, { height: 50, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. Preferred delivery in morning"
                placeholderTextColor="#94A3B8"
                multiline
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Customer</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 10,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0066CC',
  },
  customerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  customerPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  quoteCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quoteCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  addressRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: '#F8FAFC',
  },
  addressText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  dateText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  editBtnText: {
    color: '#0066CC',
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 11.5,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputNotice: {
    fontSize: 10.5,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
});
