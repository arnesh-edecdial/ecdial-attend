import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { mobileApi } from '../services/api';
import { CalendarDay } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  initialMode,
}) => {
  const insets = useSafeAreaInsets();
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const currentHour24 = today.getHours();
  const isAfternoonEligible = currentHour24 >= 13; // 1:00 PM Afternoon threshold

  // Single Date Selection State (Requirement 7 & 12: Each date is handled individually)
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [requestType, setRequestType] = useState<'ATTENDANCE' | 'CLOSING'>(
    initialMode === 'CLOSING' ? 'CLOSING' : 'ATTENDANCE'
  );

  // Calendar for Date Picking
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(true);
  const [employeeStartDate, setEmployeeStartDate] = useState<string>('2026-01-01');

  // Alarm-Style Time Picker State
  const [checkInHour, setCheckInHour] = useState<number>(9);
  const [checkInMinute, setCheckInMinute] = useState<number>(0);
  const [checkInPeriod, setCheckInPeriod] = useState<'AM' | 'PM'>('AM');

  const [closingHour, setClosingHour] = useState<number>(6);
  const [closingMinute, setClosingMinute] = useState<number>(0);
  const [closingPeriod, setClosingPeriod] = useState<'AM' | 'PM'>('PM');

  const [timePickerTarget, setTimePickerTarget] = useState<'IN' | 'OUT' | null>(null);

  // Form Fields
  const [reason, setReason] = useState<string>('Customer Site Visit');
  const [remarks, setRemarks] = useState<string>('');
  const [isLoadingSubmit, setIsLoadingSubmit] = useState<boolean>(false);
  const [hasActiveRequest, setHasActiveRequest] = useState<boolean>(false);
  const [activeRequestMsg, setActiveRequestMsg] = useState<string | null>(null);

  const reasonPresets = [
    'Customer Site Visit',
    'Offsite Project / Site Work',
    'Travelling on Duty',
    'Missed Office QR Scan',
    'Equipment / System Issue',
  ];

  // Fetch Calendar Data
  const fetchCalendar = async () => {
    try {
      setIsLoadingCalendar(true);
      const [calRes, meRes] = await Promise.all([
        mobileApi.getCalendar(undefined, year, month),
        mobileApi.getMe().catch(() => null),
      ]);

      if (calRes && calRes.success && calRes.data) {
        if (calRes.data.days) setCalendarDays(calRes.data.days);
        if (calRes.data.employeeStartDate) setEmployeeStartDate(calRes.data.employeeStartDate);
      }

      if (meRes && meRes.success && meRes.data?.user) {
        const u = meRes.data.user;
        const joinDate = u.firstLoginAt
          ? new Date(u.firstLoginAt).toISOString().substring(0, 10)
          : (u.createdAt ? new Date(u.createdAt).toISOString().substring(0, 10) : todayStr);
        setEmployeeStartDate(joinDate);
      }
    } catch (err) {
      console.error('[Calendar Fetch Error]', err);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [year, month]);

  // Check Active Request
  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.getTodayStatus();
        if (res.success && res.data.activeRequest) {
          setHasActiveRequest(true);
          setActiveRequestMsg(
            `You already have an attendance request (${res.data.activeRequest.requestType}) under approval.`
          );
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // Selected Day Info
  const selectedDayInfo = useMemo(() => {
    return calendarDays.find((d) => d.date === selectedDate);
  }, [calendarDays, selectedDate]);

  // Auto-set request type based on existing attendance for selected date
  useEffect(() => {
    if (selectedDayInfo) {
      if (selectedDayInfo.checkIn && !selectedDayInfo.checkOut) {
        setRequestType('CLOSING');
      } else {
        setRequestType('ATTENDANCE');
      }
    }
  }, [selectedDayInfo]);

  // 24-hour time formatting helper
  const formatTime24h = (hour: number, minute: number, period: 'AM' | 'PM') => {
    let h = hour;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const formatDisplayTime = (hour: number, minute: number, period: 'AM' | 'PM') => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!reason || reason.trim() === '') {
      Alert.alert('Required Field', 'Please provide a valid reason for this request.');
      return;
    }

    if (selectedDate > todayStr) {
      Alert.alert('Invalid Date', 'Attendance request cannot be submitted for future dates.');
      return;
    }

    if (selectedDate < employeeStartDate) {
      Alert.alert('Invalid Date', `Cannot request attendance before your joining date (${employeeStartDate}).`);
      return;
    }

    if (requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible) {
      Alert.alert(
        'Closing Time Not Yet Eligible',
        'Closing time request for today can only be submitted in the afternoon (after 1:00 PM).'
      );
      return;
    }

    const checkIn24 = formatTime24h(checkInHour, checkInMinute, checkInPeriod);
    const closing24 = formatTime24h(closingHour, closingMinute, closingPeriod);

    const payload = {
      requestType: requestType === 'CLOSING' ? 'CLOSING_REQUEST' : (selectedDate === todayStr ? 'TODAY_ATTENDANCE' : 'MISSED_ATTENDANCE'),
      dates: [selectedDate],
      checkInTime: requestType === 'CLOSING' ? (selectedDayInfo?.checkIn || checkIn24) : checkIn24,
      checkOutTime: requestType === 'CLOSING' ? closing24 : undefined,
      closingTime: requestType === 'CLOSING' ? closing24 : undefined,
      reason: reason.trim(),
      remarks: remarks.trim() || undefined,
    };

    setIsLoadingSubmit(true);
    try {
      const res = await mobileApi.submitAttendanceRequest(payload);
      if (res.success) {
        Alert.alert(
          '✓ Request Submitted',
          'Your attendance request was submitted and is now under approval.',
          [{ text: 'OK', onPress: () => { onSuccess(); onClose(); } }]
        );
      } else {
        Alert.alert('Submission Error', res.message || 'Failed to submit request.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Network error occurred while submitting.');
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <View style={styles.container}>
      {/* Top Header with Safe Area Inset */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Attendance Request</Text>
          <Text style={styles.subtitle}>Submit single-day attendance correction or closing time</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Request Warning Banner */}
        {hasActiveRequest && (
          <View style={styles.activeRequestBanner}>
            <Text style={{ fontSize: 18 }}>⏳</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeRequestTitle}>Request Under Approval</Text>
              <Text style={styles.activeRequestSub}>{activeRequestMsg}</Text>
            </View>
          </View>
        )}

        {/* STEP 1: SELECT DATE */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>1. SELECT DATE</Text>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => setMonth((m) => (m === 1 ? 12 : m - 1))}>
                <Text style={styles.monthNavBtn}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthNavText}>{monthNames[month - 1]} {year}</Text>
              <TouchableOpacity onPress={() => setMonth((m) => (m === 12 ? 1 : m + 1))}>
                <Text style={styles.monthNavBtn}>›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar Grid Header */}
          <View style={styles.daysHeaderRow}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
              <Text key={i} style={[styles.dayHeaderCell, i === 0 && { color: '#8B5CF6' }]}>
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar Days */}
          {isLoadingCalendar ? (
            <ActivityIndicator size="small" color="#0066CC" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.calendarGrid}>
              {/* Leading Blanks */}
              {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                <View key={`b-${i}`} style={styles.calendarDayCell} />
              ))}

              {calendarDays.map((d) => {
                const isSelected = selectedDate === d.date;
                const isFuture = d.date > todayStr;
                const isPreJoin = d.date < employeeStartDate;
                const isSun = new Date(year, month - 1, d.dayNumber).getDay() === 0;

                return (
                  <TouchableOpacity
                    key={d.date}
                    style={[
                      styles.calendarDayCell,
                      isSelected && styles.dayCellSelected,
                      isFuture && styles.dayCellDisabled,
                      isPreJoin && styles.dayCellDisabled,
                    ]}
                    disabled={isFuture || isPreJoin}
                    onPress={() => setSelectedDate(d.date)}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        isSelected && styles.dayNumberSelected,
                        isSun && !isSelected && { color: '#8B5CF6' },
                        (isFuture || isPreJoin) && styles.dayNumberDisabled,
                      ]}
                    >
                      {d.dayNumber}
                    </Text>
                    {/* Status Dot */}
                    <View
                      style={[
                        styles.miniDot,
                        {
                          backgroundColor:
                            d.status === 'PRESENT'
                              ? '#10B981'
                              : d.status === 'ABSENT'
                              ? '#EF4444'
                              : d.status === 'UNDER_APPROVAL'
                              ? '#F59E0B'
                              : isSun
                              ? '#8B5CF6'
                              : '#CBD5E1',
                        },
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Selected Date Status Badge */}
          <View style={styles.dateStatusBox}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                Selected: {selectedDate} {selectedDate === todayStr ? '(Today)' : ''}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color:
                    selectedDayInfo?.status === 'PRESENT'
                      ? '#059669'
                      : selectedDayInfo?.status === 'ABSENT'
                      ? '#DC2626'
                      : '#64748B',
                }}
              >
                {selectedDayInfo?.status || 'NOT MARKED'}
              </Text>
            </View>
            {selectedDayInfo?.checkIn && (
              <Text style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                Check-in logged: {selectedDayInfo.checkIn} {selectedDayInfo.checkOut ? `• Check-out: ${selectedDayInfo.checkOut}` : '• (Missing Closing Time)'}
              </Text>
            )}
          </View>
        </View>

        {/* STEP 2: REQUEST TYPE (ATTENDANCE vs CLOSING) */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>2. REQUEST TYPE</Text>
          <View style={styles.typeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.typeOption,
                requestType === 'ATTENDANCE' && styles.typeOptionActive,
              ]}
              onPress={() => setRequestType('ATTENDANCE')}
            >
              <Text style={{ fontSize: 18 }}>⏱️</Text>
              <Text
                style={[
                  styles.typeOptionText,
                  requestType === 'ATTENDANCE' && styles.typeOptionTextActive,
                ]}
              >
                Attendance Check-In
              </Text>
              <Text style={styles.typeOptionSub}>Mark attendance start time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeOption,
                requestType === 'CLOSING' && styles.typeOptionActive,
              ]}
              onPress={() => setRequestType('CLOSING')}
            >
              <Text style={{ fontSize: 18 }}>🏁</Text>
              <Text
                style={[
                  styles.typeOptionText,
                  requestType === 'CLOSING' && styles.typeOptionTextActive,
                ]}
              >
                Closing Time
              </Text>
              <Text style={styles.typeOptionSub}>End of day checkout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* STEP 3: TIME SELECTION */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            3. {requestType === 'ATTENDANCE' ? 'START / CHECK-IN TIME' : 'CLOSING / CHECK-OUT TIME'}
          </Text>

          {requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible && (
            <View style={styles.disabledTimeNotice}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={styles.disabledTimeNoticeText}>
                Closing time request is disabled before afternoon. It will automatically unlock at 1:00 PM.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.timeDisplayCard,
              requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible && { opacity: 0.5 },
            ]}
            disabled={requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible}
            onPress={() => setTimePickerTarget(requestType === 'ATTENDANCE' ? 'IN' : 'OUT')}
          >
            <View>
              <Text style={styles.timeDisplayLabel}>
                {requestType === 'ATTENDANCE' ? 'Requested Check-In' : 'Requested Closing'}
              </Text>
              <Text style={styles.timeDisplayVal}>
                {requestType === 'ATTENDANCE'
                  ? formatDisplayTime(checkInHour, checkInMinute, checkInPeriod)
                  : formatDisplayTime(closingHour, closingMinute, closingPeriod)}
              </Text>
            </View>
            <View style={styles.changeTimeBadge}>
              <Text style={styles.changeTimeBadgeText}>Change Time ✏️</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* STEP 4: REASON & DETAILS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>4. REASON FOR REQUEST</Text>
          <View style={styles.presetRow}>
            {reasonPresets.map((p, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.presetChip, reason === p && styles.presetChipActive]}
                onPress={() => setReason(p)}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    reason === p && styles.presetChipTextActive,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.reasonInput}
            placeholder="Provide specific details / reason for request..."
            placeholderTextColor="#94A3B8"
            value={reason}
            onChangeText={setReason}
          />

          <Text style={[styles.cardLabel, { marginTop: 12 }]}>OPTIONAL REMARKS</Text>
          <TextInput
            style={[styles.reasonInput, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Additional notes for manager..."
            placeholderTextColor="#94A3B8"
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />
        </View>
      </ScrollView>

      {/* STICKY BOTTOM ACTION BAR */}
      <View style={[styles.bottomActionBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          disabled={isLoadingSubmit}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (hasActiveRequest || (requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible)) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={
            isLoadingSubmit ||
            hasActiveRequest ||
            (requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible)
          }
        >
          {isLoadingSubmit ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Request</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* TIME PICKER MODAL */}
      <Modal visible={timePickerTarget !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalCard}>
            <Text style={styles.modalTitle}>
              Select {timePickerTarget === 'IN' ? 'Check-In' : 'Closing'} Time
            </Text>
            <Text style={styles.modalSub}>Pick hour, minute, and AM/PM period</Text>

            {/* Hour Selector */}
            <Text style={styles.pickerSectionLabel}>Hour (1 - 12)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
                const currentH = timePickerTarget === 'IN' ? checkInHour : closingHour;
                const isSelected = currentH === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerPill, isSelected && styles.pickerPillActive]}
                    onPress={() => {
                      if (timePickerTarget === 'IN') setCheckInHour(h);
                      else setClosingHour(h);
                    }}
                  >
                    <Text style={[styles.pickerPillText, isSelected && styles.pickerPillTextActive]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Minute Selector */}
            <Text style={styles.pickerSectionLabel}>Minute</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                const currentM = timePickerTarget === 'IN' ? checkInMinute : closingMinute;
                const isSelected = currentM === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerPill, isSelected && styles.pickerPillActive]}
                    onPress={() => {
                      if (timePickerTarget === 'IN') setCheckInMinute(m);
                      else setClosingMinute(m);
                    }}
                  >
                    <Text style={[styles.pickerPillText, isSelected && styles.pickerPillTextActive]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Period Selector */}
            <Text style={styles.pickerSectionLabel}>Period</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['AM', 'PM'] as const).map((p) => {
                const currentP = timePickerTarget === 'IN' ? checkInPeriod : closingPeriod;
                const isSelected = currentP === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.periodBtn, isSelected && styles.periodBtnActive]}
                    onPress={() => {
                      if (timePickerTarget === 'IN') setCheckInPeriod(p);
                      else setClosingPeriod(p);
                    }}
                  >
                    <Text style={[styles.periodBtnText, isSelected && styles.periodBtnTextActive]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.doneTimeBtn}
              onPress={() => setTimePickerTarget(null)}
            >
              <Text style={styles.doneTimeBtnText}>Done</Text>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  activeRequestBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  activeRequestTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  activeRequestSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0066CC',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthNavBtn: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0066CC',
    paddingHorizontal: 6,
  },
  monthNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  dayHeaderCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#0066CC',
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayNumberDisabled: {
    color: '#94A3B8',
  },
  miniDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  dateStatusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066CC',
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginTop: 4,
  },
  typeOptionTextActive: {
    color: '#0066CC',
  },
  typeOptionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  disabledTimeNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 8,
  },
  disabledTimeNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
  },
  timeDisplayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  timeDisplayLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  timeDisplayVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  changeTimeBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeTimeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066CC',
  },
  presetChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#0066CC',
    fontWeight: '800',
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    fontSize: 12.5,
    color: '#0F172A',
  },
  bottomActionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  timeModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  pickerSectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0066CC',
    marginTop: 8,
    marginBottom: 6,
  },
  pickerRow: {
    gap: 8,
    paddingVertical: 4,
  },
  pickerPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerPillActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  pickerPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodBtnActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  doneTimeBtn: {
    marginTop: 16,
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneTimeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
