import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuthToken, mobileApi } from '../services/api';
import { ServiceIntake, ServiceStatus, STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, TAKING_TO_LABELS } from '../types/serviceIntake';
import { ServiceIntakeCreateModal } from './ServiceIntakeCreateModal';
import { ServiceIntakeDetailScreen } from './ServiceIntakeDetailScreen';

interface Props { userRole?: string; onClose?: () => void; }
const BLOCKED_ROLES = ['HR', 'IT_ADMIN', 'IT'];
const canUse = (role: string) => !BLOCKED_ROLES.includes(String(role || '').toUpperCase());
const formatDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; } };

export const ServiceIntakeListScreen: React.FC<Props> = ({ userRole = 'ADMIN', onClose }) => {
  const insets = useSafeAreaInsets();
  const allowed = canUse(userRole);
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [isLoading, setIsLoading] = useState(true); const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | 'ALL'>('ALL'); const [searchQuery, setSearchQuery] = useState(''); const [filterVisible, setFilterVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false); const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchIntakes = useCallback(async () => {
    if (!allowed) { setIsLoading(false); return; }
    try { const res = await mobileApi.listServiceIntakes({ status: statusFilter === 'ALL' ? undefined : statusFilter, search: searchQuery.trim() || undefined }); if (res.success && Array.isArray(res.data)) setIntakes(res.data); }
    catch (err: any) { console.warn('[Service Intake list]', err); }
    finally { setIsLoading(false); setIsRefreshing(false); }
  }, [allowed, statusFilter, searchQuery]);
  useEffect(() => { setIsLoading(true); fetchIntakes(); }, [fetchIntakes]);

  if (!allowed) return <View style={styles.centered}><Text style={styles.emptyTitle}>Service Intake unavailable</Text><Text style={styles.emptySub}>Your role does not have access to Service Intake.</Text></View>;
  if (selectedId) return <ServiceIntakeDetailScreen intakeId={selectedId} userRole={userRole} onClose={() => setSelectedId(null)} onRefreshList={fetchIntakes} />;

  return <View style={styles.container}>
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
      {onClose && <TouchableOpacity style={styles.backBtn} onPress={onClose}><Text style={styles.backText}>←</Text></TouchableOpacity>}
      <View style={{ flex: 1 }}><Text style={styles.title}>Service Intake</Text><Text style={styles.subtitle}>{intakes.length} records</Text></View>
      <TouchableOpacity style={styles.addBtn} onPress={() => setCreateVisible(true)}><Text style={styles.addText}>+ New</Text></TouchableOpacity>
    </View>
    <View style={styles.searchRow}><TextInput style={styles.search} placeholder="Search customer, site, model, identifier..." value={searchQuery} onChangeText={setSearchQuery}/><TouchableOpacity style={styles.filterBtn} onPress={() => setFilterVisible(true)}><Text style={styles.filterText}>{statusFilter === 'ALL' ? 'Filter' : STATUS_LABELS[statusFilter]}</Text></TouchableOpacity></View>
    {isLoading ? <ActivityIndicator style={{ marginTop: 60 }} color="#10B981" /> : <FlatList
      data={intakes} keyExtractor={(x) => x.id} contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchIntakes(); }} tintColor="#10B981" />}
      ListEmptyComponent={<View style={styles.centered}><Text style={styles.emptyTitle}>No Service Intakes yet</Text><Text style={styles.emptySub}>Tap + New to create the first service record.</Text></View>}
      renderItem={({ item }) => {
        const anyItem: any = item as any; const currentImage = anyItem.currentImage; const cust = item.customer?.name || item.customerName || 'Unnamed Customer';
        return <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setSelectedId(item.id)}>
          {currentImage ? <Image source={{ uri: mobileApi.getServiceIntakeImageUrl(currentImage.storageFileName), headers: getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : undefined }} style={styles.heroImage} resizeMode="cover" /> : <View style={styles.noImage}><Text style={styles.noImageText}>No current photo</Text></View>}
          <View style={styles.cardBody}>
            <View style={styles.cardTop}><Text style={styles.number}>{item.intakeNumber}</Text><Text style={styles.lifecycle}>{anyItem.lifecycleStatus || 'OPEN'}</Text></View>
            <Text style={styles.customer} numberOfLines={1}>{cust}</Text>
            <Text style={styles.meta}>{[item.siteName, item.takingTo ? TAKING_TO_LABELS[item.takingTo] : null].filter(Boolean).join(' · ')}</Text>
            <View style={styles.itemRows}>
              {(item.items || []).slice(0, 4).map((serviceItem: any) => { const c = STATUS_COLORS[serviceItem.status as ServiceStatus] || STATUS_COLORS.NOT_STARTED; return <View key={serviceItem.id} style={styles.itemRow}><Text style={styles.itemName} numberOfLines={1}>{serviceItem.itemName || serviceItem.itemTypeLabel || 'Service Item'}</Text><View style={[styles.miniStatus, { backgroundColor: c.bg, borderColor: c.border }]}><Text style={[styles.miniStatusText, { color: c.text }]}>{STATUS_LABELS[serviceItem.status as ServiceStatus] || serviceItem.status}</Text></View></View>; })}
              {(item.items || []).length > 4 && <Text style={styles.more}>+ {(item.items || []).length - 4} more items</Text>}
            </View>
            <View style={styles.bottom}><Text style={styles.problem} numberOfLines={1}>{item.problems?.join(' · ') || 'No problem recorded'}</Text><Text style={styles.date}>{formatDate(item.receivedAt)}</Text></View>
          </View>
        </TouchableOpacity>;
      }}
    />}

    <ServiceIntakeCreateModal visible={createVisible} onClose={() => setCreateVisible(false)} onSuccess={() => { setCreateVisible(false); fetchIntakes(); }} />
    <Modal visible={filterVisible} transparent animationType="fade" onRequestClose={() => setFilterVisible(false)}><TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFilterVisible(false)}><View style={styles.sheet}><TouchableOpacity style={styles.filterRow} onPress={() => { setStatusFilter('ALL'); setFilterVisible(false); }}><Text style={styles.filterRowText}>All</Text></TouchableOpacity>{STATUS_ORDER.map((s) => <TouchableOpacity key={s} style={styles.filterRow} onPress={() => { setStatusFilter(s); setFilterVisible(false); }}><Text style={styles.filterRowText}>{STATUS_LABELS[s]}</Text></TouchableOpacity>)}</View></TouchableOpacity></Modal>
  </View>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }, backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, backText: { fontSize: 19, fontWeight: '800', color: '#0F172A' }, title: { fontSize: 19, fontWeight: '800', color: '#0F172A' }, subtitle: { color: '#94A3B8', fontSize: 11, marginTop: 2 }, addBtn: { backgroundColor: '#059669', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }, addText: { color: '#FFF', fontWeight: '800', fontSize: 12 }, searchRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#F8FAFC' }, search: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 }, filterBtn: { paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', justifyContent: 'center' }, filterText: { color: '#334155', fontWeight: '800', fontSize: 11 }, list: { paddingHorizontal: 14, paddingTop: 4 }, card: { backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }, heroImage: { width: '100%', height: 190, backgroundColor: '#E2E8F0' }, noImage: { height: 130, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, noImageText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' }, cardBody: { padding: 15 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between' }, number: { color: '#64748B', fontSize: 11, fontWeight: '800' }, lifecycle: { color: '#059669', fontSize: 10, fontWeight: '800' }, customer: { color: '#0F172A', fontSize: 19, fontWeight: '800', marginTop: 5 }, meta: { color: '#64748B', fontSize: 11, marginTop: 3 }, itemRows: { marginTop: 12, gap: 7 }, itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, itemName: { flex: 1, color: '#334155', fontSize: 12, fontWeight: '700' }, miniStatus: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4 }, miniStatusText: { fontSize: 9, fontWeight: '800' }, more: { color: '#059669', fontSize: 10, fontWeight: '800' }, bottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9' }, problem: { flex: 1, color: '#64748B', fontSize: 10 }, date: { color: '#94A3B8', fontSize: 10 }, centered: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 }, emptyTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800' }, emptySub: { color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 6 }, overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28 }, filterRow: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderColor: '#F1F5F9' }, filterRowText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
});
