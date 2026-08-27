import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { mobileApi } from '../services/api';
import { Quotation } from '../types';

interface QuotationListScreenProps {
  onNewQuotation: () => void;
  onSelectQuotation: (q: Quotation) => void;
  userRole?: string;
}

export const QuotationListScreen: React.FC<QuotationListScreenProps> = ({
  onNewQuotation,
  onSelectQuotation,
  userRole = 'SALES',
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [creatorFilter, setCreatorFilter] = useState<string>('ALL');

  const fetchQuotations = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listQuotations(
        creatorFilter === 'ALL' ? undefined : creatorFilter
      );
      if (res.success) {
        setQuotations(res.data);
      }
    } catch (err) {
      console.error('Failed to load quotes', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
    if (userRole === 'ADMIN') {
      mobileApi.listEmployees().then((res) => {
        if (res.success) {
          // Filter to show sales & admin creators
          const salesCreators = res.data.filter((e: any) =>
            ['SALES', 'ADMIN', 'MANAGER', 'IT_ADMIN'].includes(e.role)
          );
          setCreators(salesCreators);
        }
      }).catch(console.error);
    }
  }, [creatorFilter, userRole]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {userRole === 'ADMIN' ? 'All Quotations' : 'My Quotations'}
          </Text>
          <Text style={styles.subtitle}>
            {userRole === 'ADMIN' ? 'Commercial proposals & sales offers' : 'Only your created commercial offers'}
          </Text>
        </View>

        {userRole !== 'EMPLOYEE' && (
          <TouchableOpacity style={styles.newBtn} onPress={onNewQuotation}>
            <Text style={styles.newBtnText}>+ NEW</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Admin Creator Filter Chips */}
      {userRole === 'ADMIN' && creators.length > 0 && (
        <View style={styles.filterBarContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[styles.filterChip, creatorFilter === 'ALL' && styles.filterChipActive]}
              onPress={() => setCreatorFilter('ALL')}
            >
              <Text style={{ fontSize: 13 }}>🌐</Text>
              <Text style={[styles.filterChipText, creatorFilter === 'ALL' && styles.filterChipTextActive]}>
                All Creators
              </Text>
            </TouchableOpacity>

            {creators.map((c) => {
              const avatar = c.role === 'ADMIN' ? '👨‍💼' : '👩‍💼';
              const isSelected = creatorFilter === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.filterChip, isSelected && styles.filterChipActive]}
                  onPress={() => setCreatorFilter(c.id)}
                >
                  <Text style={{ fontSize: 13 }}>{avatar}</Text>
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                    {c.name} ({c.role})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchQuotations} tintColor="#0066CC" />}
      >
        {isLoading && quotations.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : quotations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📄</Text>
            <Text style={styles.emptyTitle}>No quotations found</Text>
            <Text style={styles.emptySub}>Tap [+ NEW] to draft a quotation in seconds.</Text>
          </View>
        ) : (
          quotations.map((q) => (
            <TouchableOpacity key={q.id} style={styles.quoteCard} onPress={() => onSelectQuotation(q)}>
              <View style={styles.rowBetween}>
                <Text style={styles.quoteNum}>{q.quotationNumber}</Text>
                <View style={[styles.badge, { backgroundColor: q.status === 'FINAL' ? '#ECFDF5' : '#FEF3C7' }]}>
                  <Text style={[styles.badgeText, { color: q.status === 'FINAL' ? '#059669' : '#D97706' }]}>
                    {q.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.customerName}>{q.customerName}</Text>
              <Text style={styles.customerAddress} numberOfLines={1}>📍 {q.customerAddress}</Text>

              {userRole === 'ADMIN' && q.createdByName && (
                <Text style={styles.creatorNameText}>👤 Prepared by: {q.createdByName}</Text>
              )}

              <View style={[styles.rowBetween, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderColor: '#F1F5F9' }]}>
                <Text style={styles.dateText}>Date: {q.date}</Text>
                <Text style={styles.totalText}>
                  ₹{Number(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
    marginTop: 2,
  },
  newBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  filterBarContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  filterChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
  },
  quoteCard: {
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
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066CC',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  customerAddress: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  creatorNameText: {
    fontSize: 11,
    color: '#0284C7',
    fontWeight: '600',
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
});
