import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { mobileApi } from '../services/api';

interface AdminApprovalsScreenProps {
  onClose?: () => void;
}

export const AdminApprovalsScreen: React.FC<AdminApprovalsScreenProps> = ({ onClose }) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Edit & Accept Modal State
  const [editModalItem, setEditModalItem] = useState<any | null>(null);
  const [editCheckIn, setEditCheckIn] = useState<string>('09:00');
  const [editCheckOut, setEditCheckOut] = useState<string>('18:00');
  const [editRemarks, setEditRemarks] = useState<string>('Approved with updated time');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

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

  // 1. ACCEPT (as requested)
  const handleAccept = async (item: any) => {
    setProcessingId(item.id);
    try {
      const res = await mobileApi.processApproval(
        item.id,
        'APPROVE',
        'Approved by Admin'
      );
      if (res.success) {
        Alert.alert('Success', 'Attendance request accepted successfully.');
        fetchApprovals();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Accept action failed');
    } finally {
      setProcessingId(null);
    }
  };

  // 2. OPEN EDIT & ACCEPT MODAL
  const handleOpenEditModal = (item: any) => {
    setEditModalItem(item);
    setEditCheckIn(item.checkInTime || '09:00');
    setEditCheckOut(item.checkOutTime || '');
    setEditRemarks('Approved with updated time by Admin');
  };

  // 2B. SUBMIT EDIT & ACCEPT
  const handleSubmitEditAndAccept = async () => {
    if (!editModalItem) return;
    setIsSubmittingEdit(true);
    try {
      const res = await mobileApi.processApproval(
        editModalItem.id,
        'APPROVE',
        editRemarks.trim(),
        editCheckIn.trim(),
        editCheckOut.trim() ? editCheckOut.trim() : undefined
      );
      if (res.success) {
        Alert.alert('Success', 'Attendance request approved with updated time.');
        setEditModalItem(null);
        fetchApprovals();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to edit and approve request.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // 3. DELETE REQUEST
  const handleDeleteRequest = (item: any) => {
    Alert.alert(
      'Delete Attendance Request?',
      `Are you sure you want to delete the request for ${item.employeeName} (${item.datesFormatted})? No attendance will be created.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(item.id);
            try {
              const res = await mobileApi.deleteAttendanceRequest(item.id);
              if (res.success) {
                Alert.alert('Deleted', 'Attendance request was deleted.');
                fetchApprovals();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete request.');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pending Approvals</Text>
          <Text style={styles.subtitle}>Admin Decision Queue ({queue.length} pending)</Text>
        </View>
        {onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        )}
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
                  Requested: {item.checkInTime} {item.checkOutTime ? `→ ${item.checkOutTime}` : '(Check-in only)'}
                </Text>
              )}

              <Text style={styles.reasonText}>Reason: {item.reason}</Text>

              {/* 3 Simplified Actions: ACCEPT | EDIT & ACCEPT | DELETE (No Reject) */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btnAccept, processingId === item.id && { opacity: 0.5 }]}
                  onPress={() => handleAccept(item)}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.btnAcceptText}>✓ Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnEditAccept, processingId === item.id && { opacity: 0.5 }]}
                  onPress={() => handleOpenEditModal(item)}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.btnEditAcceptText}>✏️ Edit & Accept</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnDelete, processingId === item.id && { opacity: 0.5 }]}
                  onPress={() => handleDeleteRequest(item)}
                  disabled={processingId === item.id}
                >
                  <Text style={styles.btnDeleteText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit & Accept Modal */}
      <Modal visible={Boolean(editModalItem)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit & Accept Attendance</Text>
              <TouchableOpacity onPress={() => setEditModalItem(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSub}>
                Adjust attendance time for {editModalItem?.employeeName} ({editModalItem?.datesFormatted})
              </Text>

              <Text style={styles.inputLabel}>Check-In Time (HH:MM / 24h) *</Text>
              <TextInput
                style={styles.textInput}
                value={editCheckIn}
                onChangeText={setEditCheckIn}
                placeholder="09:00"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Check-Out Time (Optional / leave blank if check-in only)</Text>
              <TextInput
                style={styles.textInput}
                value={editCheckOut}
                onChangeText={setEditCheckOut}
                placeholder="18:00"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Admin Note / Remarks</Text>
              <TextInput
                style={[styles.textInput, { height: 64, textAlignVertical: 'top' }]}
                value={editRemarks}
                onChangeText={setEditRemarks}
                multiline
                placeholder="Remarks visible in audit"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setEditModalItem(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, isSubmittingEdit && { opacity: 0.7 }]}
                  onPress={handleSubmitEditAndAccept}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Save & Approve</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    paddingBottom: 120,
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
    gap: 8,
  },
  btnAccept: {
    flex: 1.2,
    backgroundColor: '#10B981',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAcceptText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  btnEditAccept: {
    flex: 1.4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEditAcceptText: {
    color: '#0066CC',
    fontSize: 11.5,
    fontWeight: '800',
  },
  btnDelete: {
    flex: 0.9,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeleteText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalClose: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 1.5,
    backgroundColor: '#0066CC',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
