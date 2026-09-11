import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { mobileApi } from '../services/api';
import { Quotation } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QuotationListScreenProps {
  onNewQuotation: (type: 'DAIKIN' | 'ECDIAL') => void;
  onSelectQuotation: (q: Quotation) => void;
  userRole?: string;
}

export const QuotationListScreen: React.FC<QuotationListScreenProps> = ({
  onNewQuotation,
  onSelectQuotation,
  userRole = 'SALES',
}) => {
  const insets = useSafeAreaInsets();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [creatorFilter, setCreatorFilter] = useState<string>('ALL');
  const [typeModalVisible, setTypeModalVisible] = useState<boolean>(false);

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
          const salesCreators = res.data.filter((e: any) =>
            ['SALES', 'ADMIN', 'MANAGER', 'IT_ADMIN'].includes(e.role)
          );
          setCreators(salesCreators);
        }
      }).catch(console.error);
    }
  }, [creatorFilter, userRole]);

  const handleDeleteQuotation = (quote: any) => {
    Alert.alert(
      'Delete quotation?',
      `Are you sure you want to delete quotation ${quote.quotationNumber}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteQuotation(quote.id);
              if (res.success) {
                Alert.alert('Success', 'Quotation deleted successfully.');
                fetchQuotations();
              } else {
                Alert.alert('Error', res.message || 'Failed to delete quotation.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete quotation.');
            }
          },
        },
      ]
    );
  };

  const handleSelectType = (type: 'DAIKIN' | 'ECDIAL') => {
    setTypeModalVisible(false);
    onNewQuotation(type);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {userRole === 'ADMIN' ? 'All Quotations' : 'My Quotations'}
          </Text>
          <Text style={styles.subtitle}>
            {userRole === 'ADMIN' ? 'Commercial proposals & sales offers' : 'Only your created commercial offers'}
          </Text>
        </View>

        {userRole !== 'EMPLOYEE' && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setTypeModalVisible(true)}>
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
        contentContainerStyle={[styles.listContent, { paddingBottom: 130 + insets.bottom }]}
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
          quotations.map((q) => {
            const isEcDial = q.quotationType === 'ECDIAL';
            return (
              <TouchableOpacity key={q.id} style={styles.quoteCard} onPress={() => onSelectQuotation(q)}>
                <View style={styles.rowBetween}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.quoteNum}>{q.quotationNumber}</Text>
                    <View style={[styles.typeBadge, isEcDial ? styles.typeBadgeEcDial : styles.typeBadgeDaikin]}>
                      <Text style={[styles.typeBadgeText, isEcDial ? styles.typeBadgeEcDialText : styles.typeBadgeDaikinText]}>
                        {isEcDial ? 'EC DIAL' : 'DAIKIN'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.badge, { backgroundColor: q.status === 'FINAL' ? '#ECFDF5' : '#FEF3C7' }]}>
                      <Text style={[styles.badgeText, { color: q.status === 'FINAL' ? '#059669' : '#D97706' }]}>
                        {q.status}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.cardDeleteBtn}
                      onPress={() => handleDeleteQuotation(q)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: '#EF4444' }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.customerName}>{q.customerName || 'Standard Quotation Offer'}</Text>
                {q.customerAddress && q.customerAddress.trim().length > 0 ? (
                  <Text style={styles.customerAddress} numberOfLines={1}>{q.customerAddress}</Text>
                ) : null}

                {userRole === 'ADMIN' && q.createdByName && (
                  <Text style={styles.creatorNameText}>Prepared by: {q.createdByName}</Text>
                )}

                <View style={[styles.rowBetween, { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderColor: '#F1F5F9' }]}>
                  <Text style={styles.dateText}>Date: {q.date}</Text>
                  <Text style={styles.totalText}>
                    ₹{Number(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* SELECT QUOTATION TYPE MODAL */}
      <Modal visible={typeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.typeModalCard}>
            <Text style={styles.typeModalTitle}>Create New Quotation</Text>
            <Text style={styles.typeModalSub}>Select template theme and brand presentation</Text>

            <TouchableOpacity
              style={[styles.typeOptionCard, styles.typeOptionEcDial]}
              onPress={() => handleSelectType('ECDIAL')}
              activeOpacity={0.8}
            >
              <View style={[styles.typeIconBox, { backgroundColor: '#FFF7ED' }]}>
                <Text style={{ fontSize: 24 }}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.typeOptionHeading}>Ec Dial Quotation</Text>
                  <View style={styles.popBadge}><Text style={styles.popBadgeText}>MULTI-BRAND</Text></View>
                </View>
                <Text style={styles.typeOptionDesc}>
                  Electrical & HVAC solutions with dynamic brand logos (Daikin, Mitsubishi, LG, General, Godrej, Onida)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.typeOptionCard, styles.typeOptionDaikin]}
              onPress={() => handleSelectType('DAIKIN')}
              activeOpacity={0.8}
            >
              <View style={[styles.typeIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 24 }}>❄️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.typeOptionHeading}>Daikin Quotation</Text>
                <Text style={styles.typeOptionDesc}>
                  Official authorized Daikin air conditioning sales & dealer proposal theme
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelTypeBtn}
              onPress={() => setTypeModalVisible(false)}
            >
              <Text style={styles.cancelTypeBtnText}>Cancel</Text>
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
    paddingBottom: 120,
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
  cardDeleteBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  typeBadgeEcDial: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  typeBadgeDaikin: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  typeBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
  },
  typeBadgeEcDialText: {
    color: '#EA580C',
  },
  typeBadgeDaikinText: {
    color: '#0066CC',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  typeModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  typeModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  typeModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    gap: 12,
  },
  typeOptionEcDial: {
    backgroundColor: '#FFFBF5',
    borderColor: '#FDBA74',
  },
  typeOptionDaikin: {
    backgroundColor: '#F8FAFC',
    borderColor: '#BFDBFE',
  },
  typeIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeOptionHeading: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  popBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#C2410C',
  },
  typeOptionDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 15,
  },
  cancelTypeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelTypeBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B',
  },
});
