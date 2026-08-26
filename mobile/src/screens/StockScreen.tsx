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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stock & Inventory</Text>
          <Text style={styles.subtitle}>
            {userRole === 'SALES' ? 'View Available Air Conditioners & Materials' : 'Real-time Warehouse Inventory'}
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar (Rule 15) */}
      <View style={styles.searchContainer}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name, model, or Stock ID..."
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

      {/* Stock Cards List (Rule 12, 13, 14) */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchStock} tintColor="#0066CC" />}
      >
        {isLoading && products.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📦</Text>
            <Text style={styles.emptyTitle}>No Stock Found</Text>
            <Text style={styles.emptySub}>Try searching for a different model or category.</Text>
          </View>
        ) : (
          products.map((item, idx) => {
            const stockQty = item.availableStock !== undefined ? Number(item.availableStock) : 10;
            const status = getStockStatus(stockQty);
            const stockId = `ECD-AC-00${idx + 1}`;

            return (
              <View key={item.id} style={styles.stockCard}>
                {/* Visual Header / Image Placeholder */}
                <View style={styles.cardTop}>
                  <View style={styles.imageBadge}>
                    <Text style={{ fontSize: 26 }}>
                      {item.category === 'LOW_SIDE' ? '🔧' : '❄️'}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.stockIdText}>Stock ID: {stockId}</Text>
                      {/* Stock Status Pill (Rule 14) */}
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

                    <Text style={styles.productName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.productModel}>
                      Model: {item.model || 'Standard'} • {item.brand || 'Daikin'}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.descriptionText} numberOfLines={2}>
                  {item.description || `${item.brand || 'Daikin'} ${item.capacity || '1.5 Ton'} Split Air Conditioner`}
                </Text>

                {/* Bottom Stats: Available Quantity & Price */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.footerLabel}>Available Stock</Text>
                    <Text style={[styles.availableQtyText, { color: status.color }]}>
                      {stockQty} {item.defaultUnit || 'Units'}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.footerLabel}>Unit Selling Price</Text>
                    <Text style={styles.priceText}>
                      ₹{Number(item.defaultPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 3,
    marginBottom: 10,
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
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  stockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  stockIdText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  productModel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  descriptionText: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 8,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  footerLabel: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '700',
  },
  availableQtyText: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0066CC',
    marginTop: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyCard: {
    padding: 50,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
