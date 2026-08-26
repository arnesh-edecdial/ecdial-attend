import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { mobileApi } from '../services/api';

interface AdminApprovalsScreenProps {
  onClose: () => void;
}

export const AdminApprovalsScreen: React.FC<AdminApprovalsScreenProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApprovals = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listApprovals();
      if (res.success) {
        setQueue(res.data.queue);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = async (item: any, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(item.id);
    try {
      const res = await mobileApi.processApproval(item.id, action, 'Approved via mobile admin panel');
      if (res.success) {
        alert(res.message);
        fetchApprovals();
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pending Approvals</Text>
          <Text style={styles.subtitle}>1-Click Admin Decision Queue ({queue.length} pending)</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : queue.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>✓</Text>
            <Text style={styles.emptyTitle}>Queue Clean</Text>
            <Text style={styles.emptySub}>No pending attendance, closing, or overtime requests.</Text>
          </View>
        ) : (
          queue.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{item.type}</Text>
                </View>
                <Text style={styles.dateText}>{item.datesFormatted}</Text>
              </View>

              <Text style={styles.empName}>{item.employeeName}</Text>
              <Text style={styles.empRole}>{item.role} • {item.employeeCode}</Text>

              {item.checkInTime && (
                <Text style={styles.timeInfo}>
                  Time: {item.checkInTime} {item.checkOutTime ? `→ ${item.checkOutTime}` : '(Start Only)'}
                </Text>
              )}

              <Text style={styles.reasonText}>Reason: {item.reason}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btnReject, processingId === item.id && { opacity: 0.5 }]}
                  onPress={() => handleAction(item, 'REJECT')}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.btnRejectText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnApprove, processingId === item.id && { opacity: 0.5 }]}
                  onPress={() => handleAction(item, 'APPROVE')}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.btnApproveText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  listContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#0066CC',
    fontSize: 10,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  empName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  empRole: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  timeInfo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 12,
    color: '#334155',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnReject: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnRejectText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '800',
  },
  btnApprove: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnApproveText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  emptyBox: {
    padding: 60,
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
    textAlign: 'center',
    marginTop: 4,
  },
});
