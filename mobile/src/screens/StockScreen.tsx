import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { mobileApi } from '../services/api';

interface StockScreenProps {
  onClose?: () => void;
  userRole?: 'ADMIN' | 'SALES' | 'EMPLOYEE';
}

export const StockScreen: React.FC<StockScreenProps> = ({
  onClose,
  userRole = 'SALES',
}) => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MAIN_UNIT' | 'LOW_SIDE'>('ALL');

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [name, setName] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [category, setCategory] = useState<'MAIN_UNIT' | 'LOW_SIDE'>('MAIN_UNIT');
  const [availableStock, setAvailableStock] = useState<string>('10');
  const [defaultPrice, setDefaultPrice] = useState<string>('35000');
  const [defaultUnit, setDefaultUnit] = useState<string>('Nos');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchStock = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listProducts(
        categoryFilter === 'ALL' ? undefined : categoryFilter,
        searchQuery || undefined
      );
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error('Failed to load stock', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [categoryFilter, searchQuery]);

  const getStockStatus = (stock: number) => {
    if (stock >= 5) {
      return { label: 'IN STOCK', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
    }
    if (stock > 0 && stock < 5) {
      return { label: 'LOW STOCK', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
    }
    return { label: 'OUT OF STOCK', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setName('');
    setModel('');
    setCategory('MAIN_UNIT');
    setAvailableStock('10');
    setDefaultPrice('35000');
    setDefaultUnit('Nos');
    setDescription('');
    setModalVisible(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingProduct(item);
    setName(item.name || '');
    setModel(item.model || '');
    setCategory(item.category || 'MAIN_UNIT');
    setAvailableStock(String(item.availableStock ?? 0));
    setDefaultPrice(String(item.defaultPrice ?? 0));
    setDefaultUnit(item.defaultUnit || 'Nos');
    setDescription(item.description || '');
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || !defaultPrice.trim()) {
      alert('Product name and default price are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        model: model.trim() || null,
        category,
        availableStock: parseInt(availableStock) || 0,
        defaultPrice: parseFloat(defaultPrice) || 0,
        defaultUnit: defaultUnit.trim() || 'Nos',
        description: description.trim() || `${name} (${category})`,
      };

      if (editingProduct) {
        const res = await mobileApi.updateMachine(editingProduct.id, payload);
        if (res.success) {
          alert('Stock item updated successfully.');
          setModalVisible(false);
          fetchStock();
        }
      } else {
        const res = await mobileApi.createMachine(payload);
        if (res.success) {
          alert('New stock item added successfully.');
          setModalVisible(false);
          fetchStock();
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (item: any) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
        try {
          const res = await mobileApi.deleteMachine(item.id);
          if (res.success) {
            alert('Item deleted.');
            fetchStock();
          }
        } catch (err: any) {
          alert(err.message || 'Delete failed');
        }
      }
    } else {
      Alert.alert(
        'Delete Stock Item',
        `Are you sure you want to delete '${item.name}'?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await mobileApi.deleteMachine(item.id);
                if (res.success) {
                  alert('Item deleted.');
                  fetchStock();
                }
              } catch (err: any) {
                alert(err.message || 'Delete failed');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stock & Inventory</Text>
          <Text style={styles.subtitle}>
            {userRole === 'ADMIN' ? 'Warehouse Stock & Product Catalog' : 'Available Air Conditioners & Materials'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(userRole === 'ADMIN' || userRole === 'SALES') && (
            <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
              <Text style={styles.addBtnText}>+ ADD ITEM</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name, model, or category..."
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

      {/* Category Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, categoryFilter === 'ALL' && styles.tabActive]}
          onPress={() => setCategoryFilter('ALL')}
        >
          <Text style={[styles.tabText, categoryFilter === 'ALL' && styles.tabTextActive]}>All Items</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, categoryFilter === 'MAIN_UNIT' && styles.tabActive]}
          onPress={() => setCategoryFilter('MAIN_UNIT')}
        >
          <Text style={[styles.tabText, categoryFilter === 'MAIN_UNIT' && styles.tabTextActive]}>AC Units</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, categoryFilter === 'LOW_SIDE' && styles.tabActive]}
          onPress={() => setCategoryFilter('LOW_SIDE')}
        >
          <Text style={[styles.tabText, categoryFilter === 'LOW_SIDE' && styles.tabTextActive]}>Low Side</Text>
        </TouchableOpacity>
      </View>

      {/* Stock Cards List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchStock} tintColor="#0066CC" />}
      >
        {isLoading && products.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : products.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
            <Text style={styles.emptyTitle}>No Stock Items Found</Text>
            <Text style={styles.emptySub}>
              {userRole === 'ADMIN' || userRole === 'SALES'
                ? 'Tap [+ ADD ITEM] to add products to the warehouse inventory.'
                : 'No products currently registered in warehouse.'}
            </Text>
          </View>
        ) : (
          products.map((item) => {
            const stockQty = Number(item.availableStock ?? 0);
            const status = getStockStatus(stockQty);
            const stockId = item.model || `PROD-${item.id.substring(0, 6).toUpperCase()}`;

            return (
              <View key={item.id} style={styles.stockCard}>
                {/* Visual Header */}
                <View style={styles.cardTop}>
                  <View style={styles.imageBadge}>
                    <Text style={{ fontSize: 24 }}>
                      {item.category === 'LOW_SIDE' ? '🔧' : '❄️'}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.stockIdText}>Stock ID: {stockId}</Text>
                      {/* Stock Status Pill */}
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: status.bg, borderColor: status.border },
                        ]}
                      >
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                        <Text style={[styles.statusPillText, { color: status.color }]}>
                          {status.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.categoryBadgeText}>
                      {item.category === 'MAIN_UNIT' ? 'Main Unit (AC)' : 'Low Side Material'}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                {item.description && (
                  <Text style={styles.descriptionText} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}

                {/* Stock Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Available Stock</Text>
                    <Text style={[styles.statVal, { color: status.color }]}>
                      {stockQty} {item.defaultUnit || 'Nos'}
                    </Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Base Price</Text>
                    <Text style={styles.statVal}>
                      ₹{Number(item.defaultPrice || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Management Actions for Admin & Sales */}
                {(userRole === 'ADMIN' || userRole === 'SALES') && (
                  <View style={styles.adminActionRow}>
                    <TouchableOpacity
                      style={styles.editCardBtn}
                      onPress={() => handleOpenEditModal(item)}
                    >
                      <Text style={styles.editCardBtnText}>✏️ Edit Stock</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteCardBtn}
                      onPress={() => handleDeleteProduct(item)}
                    >
                      <Text style={styles.deleteCardBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Product Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Stock Item' : 'Add New Stock / Product'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Product / Model Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Daikin Inverter Split AC 1.5 Ton"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Model Code / Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. FTKM50TV"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={model}
                onChangeText={setModel}
              />

              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.catPickerRow}>
                <TouchableOpacity
                  style={[styles.catChip, category === 'MAIN_UNIT' && styles.catChipActive]}
                  onPress={() => setCategory('MAIN_UNIT')}
                >
                  <Text style={[styles.catChipText, category === 'MAIN_UNIT' && styles.catChipTextActive]}>
                    ❄️ Main Unit (AC)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.catChip, category === 'LOW_SIDE' && styles.catChipActive]}
                  onPress={() => setCategory('LOW_SIDE')}
                >
                  <Text style={[styles.catChipText, category === 'LOW_SIDE' && styles.catChipTextActive]}>
                    🔧 Low Side (Materials)
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Available Stock *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={availableStock}
                    onChangeText={setAvailableStock}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nos"
                    placeholderTextColor="#94A3B8"
                    value={defaultUnit}
                    onChangeText={setDefaultUnit}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Base Unit Price (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="35000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={defaultPrice}
                onChangeText={setDefaultPrice}
              />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Short specifications or application..."
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleSaveProduct}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingProduct ? 'Save Changes' : 'Add to Inventory'}
                </Text>
              )}
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
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  addBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
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
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0066CC',
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  imageBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  descriptionText: {
    fontSize: 11,
    color: '#475569',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 9.5,
    color: '#64748B',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  editCardBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editCardBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066CC',
  },
  deleteCardBtn: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteCardBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  emptyBox: {
    padding: 50,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalClose: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748B',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
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
  catPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
