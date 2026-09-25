import React, { useState, useEffect, useMemo } from 'react';
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
import { dataCache } from '../services/dataCache';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StockScreenProps {
  onClose?: () => void;
  userRole?: string;
  onOpenStockRequirements?: () => void;
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

export const StockScreen: React.FC<StockScreenProps> = ({
  onClose,
  userRole = 'SALES',
  onOpenStockRequirements,
}) => {
  const insets = useSafeAreaInsets();
  // Cache-first: initialize with cached data for instant 0ms rendering
  const [products, setProducts] = useState<any[]>(() => {
    return dataCache.get<any>('products:ALL:')?.data || [];
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(() => products.length === 0);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'MAIN_UNIT' | 'LOW_SIDE'>('ALL');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');

  // Add / Edit Modal State
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [name, setName] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('Daikin');
  const [customBrandName, setCustomBrandName] = useState<string>('');
  const [isAddingNewBrand, setIsAddingNewBrand] = useState<boolean>(false);
  const [category, setCategory] = useState<'MAIN_UNIT' | 'LOW_SIDE'>('MAIN_UNIT');
  const [availableStock, setAvailableStock] = useState<string>('10');
  const [defaultPrice, setDefaultPrice] = useState<string>('35000');
  const [defaultUnit, setDefaultUnit] = useState<string>('Nos');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Helper to extract brand from product description or name/model
  const extractBrand = (item: any): string => {
    if (item.brand) return item.brand;
    const descMatch = item.description?.match(/\[Brand:\s*([^\]]+)\]/i);
    if (descMatch) return descMatch[1].trim();

    const fullText = `${item.name || ''} ${item.model || ''} ${item.description || ''}`.toLowerCase();
    for (const b of DEFAULT_BRANDS) {
      if (fullText.includes(b.toLowerCase())) {
        return b;
      }
    }
    return item.category === 'LOW_SIDE' ? 'Universal' : 'Other';
  };

  const fetchStock = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh && products.length === 0) setIsLoading(true);
      const res = await mobileApi.getCachedProducts(
        categoryFilter === 'ALL' ? undefined : categoryFilter,
        searchQuery || undefined,
        {
          forceRefresh,
          onBackgroundUpdate: (fresh) => {
            if (fresh && fresh.success && Array.isArray(fresh.data)) {
              setProducts(fresh.data);
            }
          },
        }
      );
      if (res && res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error('Failed to load stock', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(false);
  }, [categoryFilter, searchQuery]);

  // Compute all available brands dynamically from products and defaults
  const allBrandsWithCounts = useMemo(() => {
    const brandCounts: Record<string, number> = {};
    products.forEach((p) => {
      const b = extractBrand(p);
      brandCounts[b] = (brandCounts[b] || 0) + 1;
    });

    const uniqueBrands = Array.from(
      new Set([...DEFAULT_BRANDS, ...Object.keys(brandCounts)])
    ).filter(Boolean);

    return {
      brands: uniqueBrands,
      counts: brandCounts,
    };
  }, [products]);

  // Filter products by selected brand
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      if (selectedBrandFilter === 'ALL') return true;
      const b = extractBrand(item);
      return b.toLowerCase() === selectedBrandFilter.toLowerCase();
    });
  }, [products, selectedBrandFilter]);

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
    setSelectedBrand('Daikin');
    setCustomBrandName('');
    setIsAddingNewBrand(false);
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
    const currentBrand = extractBrand(item);
    if (DEFAULT_BRANDS.includes(currentBrand)) {
      setSelectedBrand(currentBrand);
      setIsAddingNewBrand(false);
      setCustomBrandName('');
    } else {
      setSelectedBrand('CUSTOM');
      setIsAddingNewBrand(true);
      setCustomBrandName(currentBrand === 'Other' || currentBrand === 'Universal' ? '' : currentBrand);
    }
    setCategory(item.category || 'MAIN_UNIT');
    setAvailableStock(String(item.availableStock ?? 0));
    setDefaultPrice(String(item.defaultPrice ?? 0));
    setDefaultUnit(item.defaultUnit || 'Nos');
    const cleanDesc = (item.description || '').replace(/\[Brand:[^\]]+\]\s*/i, '');
    setDescription(cleanDesc);
    setModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim() || !defaultPrice.trim()) {
      alert('Product name and default price are required.');
      return;
    }

    const finalBrand = isAddingNewBrand
      ? customBrandName.trim() || 'Other'
      : selectedBrand;

    setIsSubmitting(true);
    try {
      const cleanDesc = description.replace(/\[Brand:[^\]]+\]\s*/i, '').trim();
      const payload = {
        name: name.trim(),
        model: model.trim() || null,
        category,
        availableStock: parseInt(availableStock, 10) || 0,
        defaultPrice: parseFloat(defaultPrice) || 0,
        defaultUnit: defaultUnit.trim() || 'Nos',
        description: `[Brand: ${finalBrand}] ${cleanDesc || `${name} (${category})`}`,
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
      {/* Header with Safe Area Inset */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stock & Inventory</Text>
          <Text style={styles.subtitle}>
            {userRole === 'ADMIN' ? 'Warehouse Inventory & Brand Catalog' : 'Available Air Conditioners & Materials'}
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

      {/* SECTION SWITCHER: CURRENT STOCK vs STOCK REQUIREMENTS */}
      {onOpenStockRequirements && (
        <View style={styles.sectionSwitcher}>
          <TouchableOpacity style={[styles.switcherTab, styles.switcherTabActive]}>
            <Text style={[styles.switcherTabText, styles.switcherTabTextActive]}>📦 Current Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.switcherTab} onPress={onOpenStockRequirements}>
            <Text style={styles.switcherTabText}>📋 Stock Requirements ›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by model, name, brand, or SKU..."
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

      {/* Category Tabs (All / AC Units / Low Side) */}
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
          <Text style={[styles.tabText, categoryFilter === 'MAIN_UNIT' && styles.tabTextActive]}>❄️ AC Units</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, categoryFilter === 'LOW_SIDE' && styles.tabActive]}
          onPress={() => setCategoryFilter('LOW_SIDE')}
        >
          <Text style={[styles.tabText, categoryFilter === 'LOW_SIDE' && styles.tabTextActive]}>🔧 Low Side</Text>
        </TouchableOpacity>
      </View>

      {/* E-Commerce Style Brand Filter Tabs */}
      <View style={styles.brandFilterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandScroll}
        >
          <TouchableOpacity
            style={[
              styles.brandChip,
              selectedBrandFilter === 'ALL' && styles.brandChipActive,
            ]}
            onPress={() => setSelectedBrandFilter('ALL')}
          >
            <Text
              style={[
                styles.brandChipText,
                selectedBrandFilter === 'ALL' && styles.brandChipTextActive,
              ]}
            >
              ALL BRANDS ({products.length})
            </Text>
          </TouchableOpacity>

          {allBrandsWithCounts.brands.map((b) => {
            const count = allBrandsWithCounts.counts[b] || 0;
            const isSelected = selectedBrandFilter.toLowerCase() === b.toLowerCase();
            return (
              <TouchableOpacity
                key={b}
                style={[styles.brandChip, isSelected && styles.brandChipActive]}
                onPress={() => setSelectedBrandFilter(isSelected ? 'ALL' : b)}
              >
                <Text style={[styles.brandChipText, isSelected && styles.brandChipTextActive]}>
                  {b} {count > 0 ? `(${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Stock Cards List */}
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 130 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchStock} tintColor="#0066CC" />}
      >
        {isLoading && products.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
            <Text style={styles.emptyTitle}>No Stock Items Found</Text>
            <Text style={styles.emptySub}>
              {selectedBrandFilter !== 'ALL'
                ? `No products found for brand '${selectedBrandFilter}'. Try selecting 'ALL BRANDS'.`
                : userRole === 'ADMIN' || userRole === 'SALES'
                ? 'Tap [+ ADD ITEM] to add products to the warehouse inventory.'
                : 'No products currently registered in warehouse.'}
            </Text>
          </View>
        ) : (
          filteredProducts.map((item) => {
            const stockQty = Number(item.availableStock ?? 0);
            const status = getStockStatus(stockQty);
            const brand = extractBrand(item);
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
                      {/* Brand Pill */}
                      <View style={styles.itemBrandBadge}>
                        <Text style={styles.itemBrandText}>🏷️ {brand}</Text>
                      </View>

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={styles.stockIdText}>Model / SKU: {stockId}</Text>
                      <Text style={{ color: '#CBD5E1' }}>•</Text>
                      <Text style={styles.categoryBadgeText}>
                        {item.category === 'MAIN_UNIT' ? 'Main Unit (AC)' : 'Low Side Material'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                {item.description && (
                  <Text style={styles.descriptionText} numberOfLines={2}>
                    {item.description.replace(/\[Brand:[^\]]+\]\s*/i, '')}
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
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
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
              {/* BRAND SELECTION DROPDOWN / CHIPS */}
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

              {/* Custom Brand Text Input */}
              {isAddingNewBrand && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.inputLabel}>Custom Brand Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Toshiba, O General, TCL, Haier..."
                    placeholderTextColor="#94A3B8"
                    value={customBrandName}
                    onChangeText={setCustomBrandName}
                    autoFocus
                  />
                </View>
              )}

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Product / Model Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Daikin Inverter Split AC 1.5 Ton 3-Star"
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

              <Text style={styles.inputLabel}>Description & Specifications</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Short specifications, warranty, or application..."
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
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingProduct ? 'Save Changes' : 'Add Item to Warehouse'}
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
    fontWeight: '900',
    color: '#0A1E3F',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  brandFilterWrapper: {
    marginTop: 8,
    marginBottom: 4,
  },
  brandScroll: {
    paddingHorizontal: 16,
    gap: 6,
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
    paddingBottom: 100,
    gap: 12,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  imageBadge: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemBrandBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  itemBrandText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0066CC',
  },
  stockIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  productName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  categoryBadgeText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 8,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  adminActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
  },
  editCardBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  editCardBtnText: {
    color: '#0066CC',
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteCardBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteCardBtnText: {
    color: '#DC2626',
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
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalBrandChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  modalBrandChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  modalBrandChipTextActive: {
    color: '#FFFFFF',
  },
  catPickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  catChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  catChipActive: {
    backgroundColor: '#0A1E3F',
    borderColor: '#0A1E3F',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  sectionSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  switcherTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  switcherTabActive: {
    backgroundColor: '#0066CC',
  },
  switcherTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  switcherTabTextActive: {
    color: '#FFFFFF',
  },
});
