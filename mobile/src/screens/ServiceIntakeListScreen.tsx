import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, RefreshControl, Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { ServiceIntake, ServiceStatus, STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, TAKING_TO_LABELS } from '../types/serviceIntake';
import { ServiceIntakeCreateModal } from './ServiceIntakeCreateModal';
import { ServiceIntakeDetailScreen } from './ServiceIntakeDetailScreen';

interface Props {
  userRole?: string;
  onClose?: () => void;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

export const ServiceIntakeListScreen: React.FC<Props> = ({ userRole = 'ADMIN', onClose }) => {
  const insets = useSafeAreaInsets();

  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<ServiceStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [createVisible, setCreateVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchIntakes = useCallback(async () => {
    try {
      const res = await mobileApi.listServiceIntakes({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (res.success && Array.isArray(res.data)) setIntakes(res.data);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { setIsLoading(true); fetchIntakes(); }, [fetchIntakes]);

  const onRefresh = () => { setIsRefreshing(true); fetchIntakes(); };

  if (selectedId) {
    return (
      <ServiceIntakeDetailScreen
        intakeId={selectedId}
        userRole={userRole}
        onClose={() => setSelectedId(null)}
        onRefreshList={fetchIntakes}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        {onClose && (
          <TouchableOpacity style={styles.backBtn} onPress={onClose}><Text style={styles.backBtnText}>←</Text></TouchableOpacity>
        )}
        <Text style={styles.title}>Service Intake</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search customer, site, serial, model..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
          <Text style={styles.filterBtnText}>{statusFilter === 'ALL' ? 'Status' : STATUS_LABELS[statusFilter]}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#10B981" />
      ) : (
        <FlatList
          data={intakes}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#10B981" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No service intakes yet</Text>
              <Text style={styles.emptySub}>Tap "+ New" to record a unit brought in for service.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const colors = STATUS_COLORS[item.status];
            const custName = item.customer?.name || item.customerName || 'Unnamed Customer';
            return (
              <TouchableOpacity style={styles.card} onPress={() => setSelectedId(item.id)}>
                <View style={styles.cardTop}>
                  <Text style={styles.intakeNumber}>{item.intakeNumber}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.statusText, { color: colors.text }]}>{STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.customerName} numberOfLines={1}>{custName}</Text>
                {!!item.siteName && <Text style={styles.metaLine}>Site: {item.siteName}</Text>}
                {!!item.problems?.length && <Text style={styles.metaLine} numberOfLines={1}>{item.problems.join(', ')}</Text>}
                <View style={styles.cardBottom}>
                  <Text style={styles.metaSmall}>{item.items?.length || 0} unit{item.items?.length === 1 ? '' : 's'}</Text>
                  {!!item.takingTo && <Text style={styles.metaSmall}>{TAKING_TO_LABELS[item.takingTo]}</Text>}
                  <Text style={styles.metaSmall}>{formatDate(item.receivedAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <ServiceIntakeCreateModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSuccess={() => { setCreateVisible(false); fetchIntakes(); }}
      />

      <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={styles.filterSheet}>
            <TouchableOpacity style={styles.filterRow} onPress={() => { setStatusFilter('ALL'); setFilterModalVisible(false); }}>
              <Text style={styles.filterRowText}>All Statuses</Text>
            </TouchableOpacity>
            {STATUS_ORDER.map((s) => (
              <TouchableOpacity key={s} style={styles.filterRow} onPress={() => { setStatusFilter(s); setFilterModalVisible(false); }}>
                <Text style={styles.filterRowText}>{STATUS_LABELS[s]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backBtnText: { fontSize: 18, color: '#0F172A', fontWeight: '800' },
  title: { fontSize: 17, fontWeight: '800', color: '#0F172A', flex: 1 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: '#10B981' },
  addBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', fontSize: 13 },
  filterBtn: { paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  filterBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  list: { padding: 16, gap: 12 },
  centered: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  intakeNumber: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '800' },
  customerName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  metaLine: { fontSize: 12, color: '#475569', marginBottom: 2 },
  cardBottom: { flexDirection: 'row', gap: 14, marginTop: 8 },
  metaSmall: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  filterOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8, paddingBottom: 30 },
  filterRow: { paddingHorizontal: 20, paddingVertical: 14 },
  filterRowText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
});
