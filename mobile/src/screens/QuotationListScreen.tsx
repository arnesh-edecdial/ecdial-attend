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
}

export const QuotationListScreen: React.FC<QuotationListScreenProps> = ({
  onNewQuotation,
  onSelectQuotation,
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchQuotations = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listQuotations();
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
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Quotations</Text>
          <Text style={styles.subtitle}>Sales Commercial Offers & PDFs</Text>
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={onNewQuotation}>
          <Text style={styles.newBtnText}>+ NEW</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchQuotations} tintColor="#0066CC" />}
      >
        {isLoading && quotations.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : quotations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No quotations created yet</Text>
            <Text style={styles.emptySub}>Tap [+ NEW] to generate a new customer quotation in seconds.</Text>
          </View>
        ) : (
          quotations.map((q) => (
            <TouchableOpacity key={q.id} style={styles.quoteCard} onPress={() => onSelectQuotation(q)}>
              <View style={styles.rowBetween}>
                <Text style={styles.quoteNum}>{q.quotationNumber}</Text>
                <View style={[styles.badge, { backgroundColor: q.status === 'FINAL' ? '#064E3B' : '#78350F' }]}>
                  <Text style={[styles.badgeText, { color: q.status === 'FINAL' ? '#10B981' : '#F59E0B' }]}>
                    {q.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.customerName}>{q.customerName}</Text>
              <Text style={styles.customerAddress} numberOfLines={1}>{q.customerAddress}</Text>

              <View style={[styles.rowBetween, { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={styles.dateText}>{q.date}</Text>
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
    backgroundColor: '#0A0F1D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
  },
  newBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  quoteCard: {
    backgroundColor: 'rgba(18, 27, 48, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0066CC',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  customerAddress: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyCard: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
