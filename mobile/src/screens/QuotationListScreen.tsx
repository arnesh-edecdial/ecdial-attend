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
import { mobileApi, getActiveEmployeeId } from '../services/api';
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
  }, [creatorFilter, userRole]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            {userRole === 'ADMIN' ? 'All Quotations' : 'My Quotations'}
          </Text>
          <Text style={styles.subtitle}>
            {userRole === 'ADMIN' ? 'All sales reps & commercial offers' : 'Only your created commercial offers'}
          </Text>
        </View>

        {userRole !== 'EMPLOYEE' && (
          <TouchableOpacity style={styles.newBtn} onPress={onNewQuotation}>
            <Text style={styles.newBtnText}>+ NEW</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Admin Creator Filter Chips (Rule 22, 45) */}
      {userRole === 'ADMIN' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            {['ALL', 'usr-sales-1', 'usr-admin-1'].map((cId) => (
              <TouchableOpacity
                key={cId}
                style={[styles.filterChip, creatorFilter === cId && styles.filterChipActive]}
                onPress={() => setCreatorFilter(cId)}
              >
                <Text style={[styles.filterChipText, creatorFilter === cId && styles.filterChipTextActive]}>
                  {cId === 'ALL' ? 'All Creators' : cId === 'usr-sales-1' ? 'Priya (Sales)' : 'Arun (Admin)'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchQuotations} tintColor="#0066CC" />}
      >
        {isLoading && quotations.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : quotations.length === 0 ? (
          <View style={styles.emptyCard}>
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
  },
  newBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  filterScroll: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: '#F1F5F9',
  },
  filterChipActive: {
    backgroundColor: '#0066CC',
  },
  filterChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
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
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptyCard: {
    padding: 50,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
