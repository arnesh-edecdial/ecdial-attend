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
} from 'react-native';
import { mobileApi } from '../services/api';
import { CalendarDay } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollTimePickerModal } from '../components/ScrollTimePicker';

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

  // Sub-Tab Switch: NEW Request vs All My Requests History
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');

  // Single Date Selection State
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

  // Employee Requests History & SLA
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);

  // Time Picker State (Initialized responsibly based on current time)
  const [checkInHour, setCheckInHour] = useState<number>(() => {
    let h = today.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [checkInMinute, setCheckInMinute] = useState<number>(() => today.getMinutes());
  const [checkInPeriod, setCheckInPeriod] = useState<'AM' | 'PM'>(() => (today.getHours() >= 12 ? 'PM' : 'AM'));

  const [closingHour, setClosingHour] = useState<number>(() => {
    let h = today.getHours() % 12;
    return h === 0 ? 12 : h;
  });
  const [closingMinute, setClosingMinute] = useState<number>(() => today.getMinutes());
  const [closingPeriod, setClosingPeriod] = useState<'AM' | 'PM'>(() => (today.getHours() >= 12 ? 'PM' : 'AM'));

  const [timePickerTarget, setTimePickerTarget] = useState<'IN' | 'OUT' | null>(null);

  // Form Fields
  const [reason, setReason] = useState<string>('Customer Site Visit');
  const [remarks, setRemarks] = useState<string>('');
  const [isLoadingSubmit, setIsLoadingSubmit] = useState<boolean>(false);

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

  // Fetch Employee's Requests History
  const fetchMyRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const res = await mobileApi.getMyAttendanceRequests();
      if (res && res.success && Array.isArray(res.data)) {
        setMyRequests(res.data);
      }
    } catch (err) {
      console.error('[Fetch My Requests Error]', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [year, month]);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  // Check if a specific date has a pending request
  const checkPendingRequestForDate = (dateStr: string) => {
    return myRequests.find((r) => {
      const isPending = r.status === 'WAITING_FOR_APPROVAL' || r.status === 'UNDER_APPROVAL';
      if (!isPending) return false;
      let dArr: string[] = [];
      try {
        dArr = r.parsedDates || (typeof r.dates === 'string' ? JSON.parse(r.dates) : (r.dates || []));
      } catch {
        dArr = [];
      }
      return Array.isArray(dArr) && dArr.includes(dateStr);
    });
  };

  // Check if currently selected date has a pending request
  const pendingRequestForSelectedDate = useMemo(() => {
    return checkPendingRequestForDate(selectedDate);
  }, [myRequests, selectedDate]);

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

  // Format SLA time remaining or elapsed
  const formatSlaCountdown = (createdAt: string, slaHours: number = 5) => {
    const created = new Date(createdAt).getTime();
    const deadline = created + slaHours * 60 * 60 * 1000;
    const now = Date.now();
    const diffMs = deadline - now;

    if (diffMs <= 0) {
      return 'SLA target crossed (escalated to Admin)';
    }
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMins}m remaining`;
  };

  const formatSubmittedTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  // Future Time Limit for Today
  const isSelectedDateToday = selectedDate === todayStr;
  const maxAllowedTime = useMemo(() => {
    if (!isSelectedDateToday) return undefined;
    const now = new Date();
    return { hour24: now.getHours(), minute: now.getMinutes() };
  }, [isSelectedDateToday]);

  // Submit Handler
  const handleSubmit = async () => {
    if (pendingRequestForSelectedDate) {
      Alert.alert(
        'Request Already Pending',
        `A request for ${selectedDate} is already under review. You cannot submit another request for this date until it is resolved. You can select other dates.`
      );
      return;
    }

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
      requestType:
        requestType === 'CLOSING'
          ? 'CLOSING_REQUEST'
          : selectedDate === todayStr
          ? 'TODAY_ATTENDANCE'
          : 'MISSED_ATTENDANCE',
      dates: [selectedDate],
      checkInTime: requestType === 'CLOSING' ? selectedDayInfo?.checkIn || checkIn24 : checkIn24,
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
          'Your attendance request was submitted successfully. Resolution SLA: within 5 hours by Admin.',
          [
            {
              text: 'View Requests',
              onPress: () => {
                fetchMyRequests();
                setActiveTab('HISTORY');
                onSuccess();
              },
            },
            {
              text: 'Done',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
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
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Attendance Requests</Text>
          <Text style={styles.subtitle}>Submit corrections or monitor resolution SLA</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-Tab Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'NEW' && styles.tabButtonActive]}
          onPress={() => setActiveTab('NEW')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === 'NEW' && styles.tabButtonTextActive]}>
            ➕ New Request
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'HISTORY' && styles.tabButtonActive]}
          onPress={() => {
            fetchMyRequests();
            setActiveTab('HISTORY');
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabButtonText, activeTab === 'HISTORY' && styles.tabButtonTextActive]}>
            📋 My Requests {myRequests.length > 0 ? `(${myRequests.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* VIEW 1: NEW REQUEST FLOW */}
      {activeTab === 'NEW' ? (
        <>
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 90 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Pending Request Banner for Selected Date */}
            {pendingRequestForSelectedDate && (
              <View style={styles.pendingDateWarningCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 18 }}>⏳</Text>
                  <Text style={styles.pendingDateWarningTitle}>
                    Request Under Review for {selectedDate}
                  </Text>
                </View>
                <Text style={styles.pendingDateWarningSubtitle}>
                  You already submitted an attendance correction for this date.
                  It is currently pending approval.
                </Text>
                <View style={styles.slaBadgeRow}>
                  <Text style={styles.slaBadgeText}>
                    ⏱️ Admin SLA: Resolves within 5 hrs (
                    {formatSlaCountdown(pendingRequestForSelectedDate.createdAt, 5)})
                  </Text>
                </View>
                <Text style={styles.pendingDateInstruction}>
                  💡 Select another date above to submit a request for other dates!
                </Text>
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
                  <Text style={styles.monthNavText}>
                    {monthNames[month - 1]} {year}
                  </Text>
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
                    const isPending = !!checkPendingRequestForDate(d.date);

                    return (
                      <TouchableOpacity
                        key={d.date}
                        style={[
                          styles.calendarDayCell,
                          isSelected && styles.dayCellSelected,
                          isFuture && styles.dayCellDisabled,
                          isPreJoin && styles.dayCellDisabled,
                          isPending && !isSelected && styles.dayCellPending,
                        ]}
                        disabled={isFuture || isPreJoin}
                        onPress={() => setSelectedDate(d.date)}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            isSelected && styles.dayNumberSelected,
                            (isFuture || isPreJoin) && styles.dayNumberDisabled,
                          ]}
                        >
                          {d.dayNumber}
                        </Text>
                        {isPending && !isSelected && <View style={styles.pendingDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.dateStatusBox}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                  Target Date: <Text style={{ color: '#0066CC' }}>{selectedDate}</Text>{' '}
                  {selectedDate === todayStr ? '(Today)' : ''}
                </Text>
                {pendingRequestForSelectedDate && (
                  <Text style={{ fontSize: 11, color: '#D97706', fontWeight: '700', marginTop: 4 }}>
                    ⚠️ This date has a pending request under review.
                  </Text>
                )}
              </View>
            </View>

            {/* STEP 2: REQUEST TYPE */}
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
                  <Text style={styles.typeOptionSub}>Mark arrival time</Text>
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
                    Closing time request is disabled before afternoon. It unlocks at 1:00 PM.
                  </Text>
                </View>
              )}

              {isSelectedDateToday && (
                <View style={styles.futureNotice}>
                  <Text style={{ fontSize: 13 }}>ℹ️</Text>
                  <Text style={styles.futureNoticeText}>
                    Future times beyond current local time are disabled in the scroll wheel.
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
                  <Text style={styles.changeTimeBadgeText}>Scroll Time Wheel ⏱️</Text>
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
                (!!pendingRequestForSelectedDate ||
                  (requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible)) &&
                  styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={
                isLoadingSubmit ||
                !!pendingRequestForSelectedDate ||
                (requestType === 'CLOSING' && selectedDate === todayStr && !isAfternoonEligible)
              }
            >
              {isLoadingSubmit ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {pendingRequestForSelectedDate ? 'Pending Approval (Locked)' : 'Submit Request'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* VIEW 2: ALL SUBMITTED REQUESTS & SLA STATUS */
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Info Banner */}
          <View style={styles.slaGlobalInfoCard}>
            <Text style={styles.slaGlobalInfoTitle}>⏱️ Admin SLA Policy</Text>
            <Text style={styles.slaGlobalInfoSub}>
              All attendance requests submitted by employees are resolved by Admin within 5 hours.
            </Text>
          </View>

          {isLoadingRequests ? (
            <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
          ) : myRequests.length === 0 ? (
            <View style={styles.emptyRequestsBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
              <Text style={styles.emptyRequestsTitle}>No Requests Yet</Text>
              <Text style={styles.emptyRequestsSub}>
                You haven't submitted any attendance correction requests.
              </Text>
              <TouchableOpacity
                style={styles.newReqShortcutBtn}
                onPress={() => setActiveTab('NEW')}
              >
                <Text style={styles.newReqShortcutText}>+ Submit New Request</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myRequests.map((req: any) => {
              const isPending =
                req.status === 'WAITING_FOR_APPROVAL' || req.status === 'UNDER_APPROVAL';
              const isApproved = req.status === 'APPROVED';
              const isRejected = req.status === 'REJECTED';

              let datesList = '';
              try {
                const parsed =
                  req.parsedDates ||
                  (typeof req.dates === 'string' ? JSON.parse(req.dates) : (req.dates || []));
                datesList = Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
              } catch {
                datesList = String(req.dates || '');
              }

              return (
                <View key={req.id} style={styles.requestItemCard}>
                  {/* Card Header: Type & Status Pill */}
                  <View style={styles.requestCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestCardType}>
                        {req.requestType === 'CLOSING_REQUEST'
                          ? '🏁 Closing Request'
                          : req.requestType === 'TODAY_ATTENDANCE'
                          ? '⏱️ Check-In (Today)'
                          : '📅 Missed Attendance'}
                      </Text>
                      <Text style={styles.requestCardDate}>{datesList}</Text>
                    </View>

                    {isPending && (
                      <View style={styles.statusPillPending}>
                        <Text style={styles.statusPillPendingText}>⏳ Under Review</Text>
                      </View>
                    )}
                    {isApproved && (
                      <View style={styles.statusPillApproved}>
                        <Text style={styles.statusPillApprovedText}>✅ Approved</Text>
                      </View>
                    )}
                    {isRejected && (
                      <View style={styles.statusPillRejected}>
                        <Text style={styles.statusPillRejectedText}>❌ Rejected</Text>
                      </View>
                    )}
                  </View>

                  {/* Times Requested */}
                  <View style={styles.requestTimesRow}>
                    {req.checkInTime && (
                      <View style={styles.timeTag}>
                        <Text style={styles.timeTagLabel}>Check-In:</Text>
                        <Text style={styles.timeTagValue}>{req.checkInTime}</Text>
                      </View>
                    )}
                    {req.checkOutTime && (
                      <View style={styles.timeTag}>
                        <Text style={styles.timeTagLabel}>Check-Out:</Text>
                        <Text style={styles.timeTagValue}>{req.checkOutTime}</Text>
                      </View>
                    )}
                  </View>

                  {/* Reason & Remarks */}
                  {req.reason && (
                    <Text style={styles.requestReasonText}>
                      <Text style={{ fontWeight: '700' }}>Reason: </Text>
                      {req.reason}
                    </Text>
                  )}
                  {req.remarks && (
                    <Text style={styles.requestRemarksText}>
                      <Text style={{ fontWeight: '700' }}>Note: </Text>
                      {req.remarks}
                    </Text>
                  )}

                  {/* SLA Countdown Badge if Pending */}
                  {isPending && (
                    <View style={styles.requestSlaCard}>
                      <Text style={styles.requestSlaText}>
                        ⏱️ Admin SLA (5h): {formatSlaCountdown(req.createdAt, req.slaHours || 5)}
                      </Text>
                      <Text style={styles.requestSubmittedAtText}>
                        Submitted at {formatSubmittedTime(req.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* UNIFIED WHEEL SCROLL TIME PICKER */}
      <ScrollTimePickerModal
        visible={timePickerTarget !== null}
        initialHour={timePickerTarget === 'IN' ? checkInHour : closingHour}
        initialMinute={timePickerTarget === 'IN' ? checkInMinute : closingMinute}
        initialPeriod={timePickerTarget === 'IN' ? checkInPeriod : closingPeriod}
        title={timePickerTarget === 'IN' ? 'Select Check-In Time' : 'Select Closing Time'}
        maxTime={maxAllowedTime}
        onConfirm={(val) => {
          if (timePickerTarget === 'IN') {
            setCheckInHour(val.hour12);
            setCheckInMinute(val.minute);
            setCheckInPeriod(val.period);
          } else {
            setClosingHour(val.hour12);
            setClosingMinute(val.minute);
            setClosingPeriod(val.period);
          }
          setTimePickerTarget(null);
        }}
        onCancel={() => setTimePickerTarget(null)}
      />
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
    paddingBottom: 10,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#0066CC',
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 12,
  },
  pendingDateWarningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    gap: 6,
  },
  pendingDateWarningTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  pendingDateWarningSubtitle: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  slaBadgeRow: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  slaBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  pendingDateInstruction: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    marginTop: 4,
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
  dayCellPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  pendingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D97706',
    marginTop: 2,
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
  futureNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 8,
  },
  futureNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#1D4ED8',
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

  // View 2 (History) Styles
  slaGlobalInfoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 6,
  },
  slaGlobalInfoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 4,
  },
  slaGlobalInfoSub: {
    fontSize: 12,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  emptyRequestsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyRequestsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  emptyRequestsSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  newReqShortcutBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  newReqShortcutText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  requestItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestCardType: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  requestCardDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  statusPillPendingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  statusPillApproved: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  statusPillApprovedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  statusPillRejected: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  statusPillRejectedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  requestTimesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  timeTagLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  timeTagValue: {
    fontSize: 11.5,
    color: '#0F172A',
    fontWeight: '800',
  },
  requestReasonText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  requestRemarksText: {
    fontSize: 11.5,
    color: '#64748B',
    fontStyle: 'italic',
  },
  requestSlaCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  requestSlaText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
  },
  requestSubmittedAtText: {
    fontSize: 10,
    color: '#92400E',
    marginTop: 2,
  },
});
