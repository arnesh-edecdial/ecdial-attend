import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { mobileApi } from '../services/api';

interface AttendanceRequestScreenProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialMode?: 'TODAY' | 'MISSED' | 'CLOSING';
}

export const AttendanceRequestScreen: React.FC<AttendanceRequestScreenProps> = ({
  onClose,
  onSuccess,
  initialDate,
  initialMode = 'TODAY',
}) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [requestMode, setRequestMode] = useState<'TODAY' | 'MISSED' | 'CLOSING'>(initialMode);
  const [dates, setDates] = useState<string[]>(initialDate ? [initialDate] : [todayStr]);

  // Alarm-style Time States
  const [checkInHour, setCheckInHour] = useState<number>(9);
  const [checkInMinute, setCheckInMinute] = useState<number>(0);
  const [checkInPeriod, setCheckInPeriod] = useState<'AM' | 'PM'>('AM');

  const [checkOutHour, setCheckOutHour] = useState<number>(6);
  const [checkOutMinute, setCheckOutMinute] = useState<number>(0);
  const [checkOutPeriod, setCheckOutPeriod] = useState<'AM' | 'PM'>('PM');

  // Alarm Time Picker Modal State
  const [timePickerTarget, setTimePickerTarget] = useState<'IN' | 'OUT' | null>(null);

  const [reason, setReason] = useState<string>('Site work / Offsite project');
  const [remarks, setRemarks] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasActiveRequest, setHasActiveRequest] = useState<boolean>(false);
  const [activeRequestInfo, setActiveRequestInfo] = useState<string | null>(null);

  // Check if employee already has an active pending request (Rule 26)
  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.getTodayStatus();
        if (res.success && res.data.activeRequest) {
          setHasActiveRequest(true);
          setActiveRequestInfo(
            `Existing request (${res.data.activeRequest.requestType}) is currently UNDER APPROVAL.`
          );
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // Format 24h for backend payload
  const formatTime24h = (hour: number, minute: number, period: 'AM' | 'PM') => {
    let h = hour;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const formatDisplayTime = (hour: number, minute: number, period: 'AM' | 'PM') => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const recentDates = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().substring(0, 10);
  });

  const toggleDate = (dStr: string) => {
    if (dates.includes(dStr)) {
      if (dates.length > 1) setDates(dates.filter((d) => d !== dStr));
    } else {
      setDates([...dates, dStr]);
    }
  };

  const handleSubmit = async () => {
    if (hasActiveRequest) {
      alert('You already have an attendance request under approval. Please wait until it is reviewed.');
      return;
    }

    if (!reason.trim()) {
      alert('Please provide a reason.');
      return;
    }

    setIsLoading(true);
    try {
      const inTime24 = formatTime24h(checkInHour, checkInMinute, checkInPeriod);
      const outTime24 = formatTime24h(checkOutHour, checkOutMinute, checkOutPeriod);

      let payload: any = {
        dates,
        reason,
        remarks,
      };

      if (requestMode === 'TODAY') {
        payload.requestType = 'TODAY_ATTENDANCE';
        payload.checkInTime = inTime24;
        payload.checkOutTime = null; // No end time required for today request!
      } else if (requestMode === 'CLOSING') {
        payload.requestType = 'CLOSING_REQUEST';
        payload.closingTime = outTime24;
        payload.checkOutTime = outTime24;
      } else {
        payload.requestType = dates.length > 1 ? 'MULTI_DAY_MISSED' : 'MISSED_ATTENDANCE';
        payload.checkInTime = inTime24;
        payload.checkOutTime = outTime24;
      }

      const res = await mobileApi.submitRequest(payload);
      if (res.success) {
        alert('Attendance request submitted successfully. Status: UNDER APPROVAL.');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Request</Text>
        <Text style={styles.subtitle}>Single active request submission with alarm time picker</Text>
      </View>

      {/* Single Active Request Warning Banner (Rule 26) */}
      {hasActiveRequest && (
        <View style={styles.warningBanner}>
          <Text style={{ fontSize: 18 }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Request Under Approval</Text>
            <Text style={styles.warningSub}>
              You already have an attendance request under approval. You must wait until it is reviewed before submitting another.
            </Text>
          </View>
        </View>
      )}

      {/* Mode Selector Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.modeTab, requestMode === 'TODAY' && styles.modeTabActive]}
          onPress={() => setRequestMode('TODAY')}
        >
          <Text style={[styles.modeTabText, requestMode === 'TODAY' && styles.modeTabTextActive]}>
            Today Request
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, requestMode === 'CLOSING' && styles.modeTabActive]}
          onPress={() => setRequestMode('CLOSING')}
        >
          <Text style={[styles.modeTabText, requestMode === 'CLOSING' && styles.modeTabTextActive]}>
            Closing / Offsite
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, requestMode === 'MISSED' && styles.modeTabActive]}
          onPress={() => setRequestMode('MISSED')}
        >
          <Text style={[styles.modeTabText, requestMode === 'MISSED' && styles.modeTabTextActive]}>
            Previous Days
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Selector (If Missed Days) */}
      {requestMode === 'MISSED' && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SELECT DATE(S)</Text>
          <View style={styles.datesGrid}>
            {recentDates.map((dStr) => {
              const isSelected = dates.includes(dStr);
              return (
                <TouchableOpacity
                  key={dStr}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                  onPress={() => toggleDate(dStr)}
                >
                  <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                    {isSelected ? '✓ ' : ''}{dStr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ALARM-STYLE TIME PICKER CARDS (Rule 28) */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>TIME SELECTION (ALARM STYLE)</Text>

        <View style={styles.timePickerRow}>
          {requestMode !== 'CLOSING' && (
            <TouchableOpacity
              style={styles.timeCard}
              onPress={() => setTimePickerTarget('IN')}
            >
              <Text style={styles.timeCardLabel}>Check-in Time (Start)</Text>
              <Text style={styles.timeCardValue}>
                {formatDisplayTime(checkInHour, checkInMinute, checkInPeriod)}
              </Text>
              <Text style={styles.timeCardHelper}>⏰ Tap to set start time</Text>
            </TouchableOpacity>
          )}

          {requestMode !== 'TODAY' && (
            <TouchableOpacity
              style={styles.timeCard}
              onPress={() => setTimePickerTarget('OUT')}
            >
              <Text style={styles.timeCardLabel}>
                {requestMode === 'CLOSING' ? 'Requested Closing Time' : 'Check-out Time (End)'}
              </Text>
              <Text style={[styles.timeCardValue, { color: '#0066CC' }]}>
                {formatDisplayTime(checkOutHour, checkOutMinute, checkOutPeriod)}
              </Text>
              <Text style={styles.timeCardHelper}>⏰ Tap to set closing time</Text>
            </TouchableOpacity>
          )}
        </View>

        {requestMode === 'TODAY' && (
          <Text style={styles.noteText}>
            ℹ️ Note: Today's request starts attendance immediately once approved. End time remains empty while you work.
          </Text>
        )}
      </View>

      {/* REASON & SITE REMARKS */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>REASON FOR REQUEST</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Project site work / Customer location"
          placeholderTextColor="#94A3B8"
          value={reason}
          onChangeText={setReason}
        />

        <Text style={[styles.cardLabel, { marginTop: 10 }]}>PROJECT / SITE REMARKS (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
          placeholder="Additional site notes for manager approval..."
          placeholderTextColor="#94A3B8"
          value={remarks}
          onChangeText={setRemarks}
          multiline
        />
      </View>

      {/* SUBMIT BUTTON WITH ACTIVE REQUEST LOCK */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (hasActiveRequest || isLoading) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={hasActiveRequest || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {hasActiveRequest ? 'UNDER APPROVAL' : '[ SUBMIT ATTENDANCE REQUEST ]'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>

      {/* ALARM TIME PICKER MODAL (Wheel & Stepper) */}
      <Modal
        visible={timePickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alarmModal}>
            <Text style={styles.alarmTitle}>
              Set {timePickerTarget === 'IN' ? 'Check-In' : 'Closing'} Time
            </Text>

            {/* Alarm Digits Box */}
            <View style={styles.alarmDigitsBox}>
              {/* Hours Stepper */}
              <View style={styles.digitCol}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInHour((h) => (h === 12 ? 1 : h + 1));
                    else setCheckOutHour((h) => (h === 12 ? 1 : h + 1));
                  }}
                >
                  <Text style={styles.stepBtnText}>▲</Text>
                </TouchableOpacity>

                <Text style={styles.digitText}>
                  {String(timePickerTarget === 'IN' ? checkInHour : checkOutHour).padStart(2, '0')}
                </Text>

                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInHour((h) => (h === 1 ? 12 : h - 1));
                    else setCheckOutHour((h) => (h === 1 ? 12 : h - 1));
                  }}
                >
                  <Text style={styles.stepBtnText}>▼</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.colonText}>:</Text>

              {/* Minutes Stepper */}
              <View style={styles.digitCol}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInMinute((m) => (m + 5) % 60);
                    else setCheckOutMinute((m) => (m + 5) % 60);
                  }}
                >
                  <Text style={styles.stepBtnText}>▲</Text>
                </TouchableOpacity>

                <Text style={styles.digitText}>
                  {String(timePickerTarget === 'IN' ? checkInMinute : checkOutMinute).padStart(2, '0')}
                </Text>

                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInMinute((m) => (m === 0 ? 55 : m - 5));
                    else setCheckOutMinute((m) => (m === 0 ? 55 : m - 5));
                  }}
                >
                  <Text style={styles.stepBtnText}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* AM / PM Toggle */}
              <View style={styles.periodCol}>
                <TouchableOpacity
                  style={[
                    styles.periodBtn,
                    (timePickerTarget === 'IN' ? checkInPeriod : checkOutPeriod) === 'AM' && styles.periodBtnActive,
                  ]}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInPeriod('AM');
                    else setCheckOutPeriod('AM');
                  }}
                >
                  <Text style={styles.periodText}>AM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.periodBtn,
                    (timePickerTarget === 'IN' ? checkInPeriod : checkOutPeriod) === 'PM' && styles.periodBtnActive,
                  ]}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInPeriod('PM');
                    else setCheckOutPeriod('PM');
                  }}
                >
                  <Text style={styles.periodText}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneAlarmBtn}
              onPress={() => setTimePickerTarget(null)}
            >
              <Text style={styles.doneAlarmBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  warningSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#0F172A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  datesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dateChipSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  dateChipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  dateChipTextSelected: {
    color: '#059669',
    fontWeight: '800',
  },
  timePickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  timeCardLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
  },
  timeCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 4,
  },
  timeCardHelper: {
    fontSize: 9.5,
    color: '#94A3B8',
  },
  noteText: {
    fontSize: 11,
    color: '#0369A1',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    color: '#0F172A',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alarmModal: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  alarmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  alarmDigitsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  digitCol: {
    alignItems: 'center',
  },
  stepBtn: {
    padding: 6,
  },
  stepBtnText: {
    fontSize: 14,
    color: '#0066CC',
    fontWeight: '900',
  },
  digitText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0F172A',
  },
  colonText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#64748B',
  },
  periodCol: {
    gap: 6,
    marginLeft: 6,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  periodBtnActive: {
    backgroundColor: '#0066CC',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  doneAlarmBtn: {
    backgroundColor: '#0066CC',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneAlarmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
