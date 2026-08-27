import React, { useState, useEffect, useMemo } from 'react';
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
import { CalendarDay } from '../types';

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
}) => {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const currentHour24 = today.getHours();
  const isPastNoon = currentHour24 >= 12;

  // Selected Dates State
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || todayStr);
  const [multiSelectMode, setMultiSelectMode] = useState<boolean>(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([initialDate || todayStr]);

  // Calendar State
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(true);
  const [employeeStartDate, setEmployeeStartDate] = useState<string>('2026-01-01');

  // Alarm-Style Time Picker States
  const [checkInHour, setCheckInHour] = useState<number>(9);
  const [checkInMinute, setCheckInMinute] = useState<number>(0);
  const [checkInPeriod, setCheckInPeriod] = useState<'AM' | 'PM'>('AM');

  const [checkOutHour, setCheckOutHour] = useState<number>(6);
  const [checkOutMinute, setCheckOutMinute] = useState<number>(0);
  const [checkOutPeriod, setCheckOutPeriod] = useState<'AM' | 'PM'>('PM');
  const [includeCheckoutForPast, setIncludeCheckoutForPast] = useState<boolean>(true);

  // Time Picker Modal Target ('IN' | 'OUT' | null)
  const [timePickerTarget, setTimePickerTarget] = useState<'IN' | 'OUT' | null>(null);

  // Form Fields
  const [reason, setReason] = useState<string>('Site Work / Offsite Project');
  const [remarks, setRemarks] = useState<string>('');
  const [isLoadingSubmit, setIsLoadingSubmit] = useState<boolean>(false);
  const [hasActiveRequest, setHasActiveRequest] = useState<boolean>(false);
  const [activeRequestMsg, setActiveRequestMsg] = useState<string | null>(null);

  // Quick Reason Presets
  const reasonPresets = [
    'Site Work / Offsite Project',
    'Customer Site Visit',
    'Travelling for Work',
    'Missed Office QR Scan',
    'Half Day Work',
  ];

  // Fetch Calendar & Profile
  const fetchCalendar = async () => {
    try {
      setIsLoadingCalendar(true);
      const res = await mobileApi.getCalendar(undefined, year, month);
      if (res.success && res.data.days) {
        setCalendarDays(res.data.days);
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

  // Check Active Request Status
  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.getTodayStatus();
        if (res.success && res.data.activeRequest) {
          setHasActiveRequest(true);
          setActiveRequestMsg(
            `You have an active request (${res.data.activeRequest.requestType}) under approval.`
          );
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // Format Helper: 24h String
  const formatTime24h = (hour: number, minute: number, period: 'AM' | 'PM') => {
    let h = hour;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const formatDisplayTime = (hour: number, minute: number, period: 'AM' | 'PM') => {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  };

  // Find currently selected day record from calendar
  const currentSelectedDayInfo = useMemo(() => {
    return calendarDays.find((d) => d.date === selectedDate);
  }, [calendarDays, selectedDate]);

  // Unmarked Past Days (Eligible for quick batch selection)
  const unmarkedPastDays = useMemo(() => {
    return calendarDays.filter((d) => {
      const isPast = d.date < todayStr;
      const isEligible = d.date >= employeeStartDate;
      const isSunday = new Date(d.date).getDay() === 0;
      const isUnmarked = !d.status || d.status === 'NOT_MARKED' || d.colorCode === 'GREY';
      return isPast && isEligible && !isSunday && isUnmarked && !d.isCompanyLeave;
    });
  }, [calendarDays, todayStr, employeeStartDate]);

  // Date Selection Handlers
  const handleSelectDate = (dateStr: string) => {
    if (dateStr > todayStr) return; // Future date blocked
    if (dateStr < employeeStartDate) return; // Pre-joining blocked

    if (multiSelectMode) {
      if (selectedDates.includes(dateStr)) {
        if (selectedDates.length > 1) {
          setSelectedDates(selectedDates.filter((d) => d !== dateStr));
        }
      } else {
        setSelectedDates([...selectedDates, dateStr]);
      }
    } else {
      setSelectedDate(dateStr);
      setSelectedDates([dateStr]);
    }
  };

  const toggleMultiSelectBatch = () => {
    if (!multiSelectMode) {
      setMultiSelectMode(true);
      const batch = unmarkedPastDays.map((d) => d.date);
      if (batch.length > 0) {
        setSelectedDates(batch);
        setSelectedDate(batch[0]);
      }
    } else {
      setMultiSelectMode(false);
      setSelectedDates([selectedDate]);
    }
  };

  // Dynamic Closing Time Lock Rules
  const isSelectedToday = selectedDate === todayStr && !multiSelectMode;
  const isClosingLockedToday = isSelectedToday && !isPastNoon;

  // Status computation for selected day
  const isSundaySelected = new Date(selectedDate).getDay() === 0;
  const dayStatusLabel = isSundaySelected
    ? 'Sunday (Weekly Off)'
    : currentSelectedDayInfo?.status === 'PRESENT'
    ? 'Present'
    : currentSelectedDayInfo?.status === 'HALF_DAY'
    ? 'Half Day'
    : currentSelectedDayInfo?.status === 'ABSENT'
    ? 'Absent'
    : currentSelectedDayInfo?.status === 'LEAVE'
    ? 'On Leave'
    : currentSelectedDayInfo?.badge || 'Attendance Not Marked';

  const isAlreadyPresent = currentSelectedDayInfo?.status === 'PRESENT' && currentSelectedDayInfo?.checkOut;

  // Handle Form Submission
  const handleSubmitRequest = async () => {
    if (hasActiveRequest) {
      alert('You already have an active request under review. Please wait for admin approval.');
      return;
    }

    if (!reason.trim()) {
      alert('Please select or specify a reason for this attendance request.');
      return;
    }

    setIsLoadingSubmit(true);
    try {
      const inTime24 = formatTime24h(checkInHour, checkInMinute, checkInPeriod);
      const outTime24 = formatTime24h(checkOutHour, checkOutMinute, checkOutPeriod);

      const targetDates = multiSelectMode ? selectedDates : [selectedDate];

      let payload: any = {
        dates: targetDates,
        reason: reason.trim(),
        remarks: remarks.trim() || undefined,
      };

      if (isSelectedToday) {
        if (!isPastNoon) {
          // Today Before 12 PM -> Start time only, Closing time strictly null
          payload.requestType = 'TODAY_ATTENDANCE';
          payload.checkInTime = inTime24;
          payload.checkOutTime = null;
        } else {
          // Today After 12 PM -> Check-in + optional Closing time
          payload.requestType = 'TODAY_ATTENDANCE';
          payload.checkInTime = inTime24;
          payload.checkOutTime = outTime24;
        }
      } else if (targetDates.length > 1) {
        // Multi-Day Missed Attendance
        payload.requestType = 'MULTI_DAY_MISSED';
        payload.checkInTime = inTime24;
        payload.checkOutTime = includeCheckoutForPast ? outTime24 : null;
      } else {
        // Single Past Missed Day
        payload.requestType = 'MISSED_ATTENDANCE';
        payload.checkInTime = inTime24;
        payload.checkOutTime = includeCheckoutForPast ? outTime24 : null;
      }

      const res = await mobileApi.submitRequest(payload);
      if (res.success) {
        alert('✓ Attendance request submitted successfully!\nStatus: UNDER APPROVAL.');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      alert(err.message || 'Submission failed');
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
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Attendance Request</Text>
          <Text style={styles.subtitle}>Unified Smart Single-Page Attendance Flow</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Pending Request Warning Banner */}
        {hasActiveRequest && (
          <View style={styles.warningBanner}>
            <Text style={{ fontSize: 20 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Pending Request Under Review</Text>
              <Text style={styles.warningSub}>
                {activeRequestMsg || 'You already have an attendance request waiting for Admin review.'}
              </Text>
            </View>
          </View>
        )}

        {/* 1. TOP INTERACTIVE ATTENDANCE CALENDAR */}
        <View style={styles.calendarCard}>
          <View style={styles.monthNavRow}>
            <TouchableOpacity
              onPress={() => setMonth((m) => (m === 1 ? 12 : m - 1))}
              style={styles.navArrowBtn}
            >
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {monthNames[month - 1]} {year}
            </Text>

            <TouchableOpacity
              onPress={() => setMonth((m) => (m === 12 ? 1 : m + 1))}
              style={styles.navArrowBtn}
            >
              <Text style={styles.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Weekday Header */}
          <View style={styles.weekHeader}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
              <Text
                key={i}
                style={[styles.weekHeaderText, i === 0 && { color: '#8B5CF6' }]}
              >
                {d}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          {isLoadingCalendar ? (
            <ActivityIndicator color="#0066CC" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.calendarGrid}>
              {calendarDays.map((day) => {
                const isSelected = multiSelectMode
                  ? selectedDates.includes(day.date)
                  : selectedDate === day.date;
                const isToday = day.date === todayStr;
                const isFuture = day.date > todayStr;
                const isPreJoining = day.date < employeeStartDate;
                const isSunday = new Date(day.date).getDay() === 0;

                const isPresent = day.colorCode === 'GREEN';
                const isAbsent = day.colorCode === 'RED';
                const isHalf = day.colorCode === 'YELLOW';

                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[
                      styles.dayCell,
                      isFuture && styles.dayCellFuture,
                      isPreJoining && styles.dayCellPreJoining,
                      isSelected && styles.dayCellSelected,
                      isPresent && !isSelected && styles.dayCellPresent,
                      isAbsent && !isSelected && styles.dayCellAbsent,
                      isHalf && !isSelected && styles.dayCellHalf,
                      isSunday && !isPresent && !isAbsent && styles.dayCellSunday,
                    ]}
                    onPress={() => handleSelectDate(day.date)}
                    disabled={isFuture || isPreJoining}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayNumText,
                        isToday && { fontWeight: '900', color: '#0066CC' },
                        isSunday && { color: '#8B5CF6' },
                        isFuture && { color: '#CBD5E1' },
                        isSelected && { color: '#0066CC', fontWeight: '900' },
                      ]}
                    >
                      {day.dayNumber}
                    </Text>

                    {/* Status Dot */}
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isPresent
                            ? '#10B981'
                            : isAbsent
                            ? '#EF4444'
                            : isHalf
                            ? '#F59E0B'
                            : isSunday
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

          {/* Calendar Status Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Half Day</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.legendText}>Sunday/Off</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#CBD5E1' }]} />
              <Text style={styles.legendText}>Unmarked</Text>
            </View>
          </View>
        </View>

        {/* 2. MULTI-MISSING DAYS SHORTCUT BANNER */}
        {unmarkedPastDays.length >= 2 && (
          <TouchableOpacity
            style={[styles.batchBanner, multiSelectMode && styles.batchBannerActive]}
            onPress={toggleMultiSelectBatch}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.batchTitle}>
                📌 {unmarkedPastDays.length} Attendance Days Not Marked
              </Text>
              <Text style={styles.batchSub}>
                {multiSelectMode
                  ? 'Batch mode active. Selected dates will be requested together.'
                  : 'Tap to select and request missing attendance for these days.'}
              </Text>
            </View>
            <View style={styles.batchBtn}>
              <Text style={styles.batchBtnText}>
                {multiSelectMode ? 'Single Mode' : 'Request All'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 3. SELECTED DATE INFORMATION & STATUS PANEL */}
        <View style={styles.infoCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.infoDate}>
                {multiSelectMode
                  ? `${selectedDates.length} Dates Selected`
                  : `${selectedDate} (${currentSelectedDayInfo?.dayName || 'Day'})`}
              </Text>
              {isSelectedToday && (
                <Text style={styles.todayPill}>📅 Today's Session</Text>
              )}
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    dayStatusLabel.includes('Present')
                      ? '#ECFDF5'
                      : dayStatusLabel.includes('Sunday')
                      ? '#FAF5FF'
                      : '#FEF3C7',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      dayStatusLabel.includes('Present')
                        ? '#059669'
                        : dayStatusLabel.includes('Sunday')
                        ? '#8B5CF6'
                        : '#D97706',
                  },
                ]}
              >
                {dayStatusLabel}
              </Text>
            </View>
          </View>

          {/* Real Times Breakdown */}
          <View style={styles.timeStatsRow}>
            <View style={styles.timeStatBox}>
              <Text style={styles.timeStatLabel}>Recorded In</Text>
              <Text style={styles.timeStatVal}>
                {currentSelectedDayInfo?.checkIn || '—'}
              </Text>
            </View>

            <View style={styles.timeStatBox}>
              <Text style={styles.timeStatLabel}>Recorded Out</Text>
              <Text style={styles.timeStatVal}>
                {currentSelectedDayInfo?.checkOut || '—'}
              </Text>
            </View>

            <View style={styles.timeStatBox}>
              <Text style={styles.timeStatLabel}>Working Duration</Text>
              <Text style={[styles.timeStatVal, { color: '#0066CC' }]}>
                {currentSelectedDayInfo?.workingDuration || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. SMART TIME SELECTION (ALARM STYLE) */}
        <View style={styles.formCard}>
          <Text style={styles.cardSectionTitle}>TIME SELECTION (ALARM STYLE)</Text>

          <View style={styles.timePickerCardsRow}>
            {/* Start Time Card */}
            <TouchableOpacity
              style={styles.alarmTimeCard}
              onPress={() => setTimePickerTarget('IN')}
            >
              <Text style={styles.alarmCardLabel}>Start Time (Check-In)</Text>
              <Text style={styles.alarmCardValue}>
                {formatDisplayTime(checkInHour, checkInMinute, checkInPeriod)}
              </Text>
              <Text style={styles.alarmCardHelper}>⏰ Tap to set start time</Text>
            </TouchableOpacity>

            {/* Closing Time Card (Dynamic 12 PM Rule) */}
            {isClosingLockedToday ? (
              <View style={[styles.alarmTimeCard, styles.alarmTimeCardLocked]}>
                <View style={styles.lockRow}>
                  <Text style={{ fontSize: 14 }}>🔒</Text>
                  <Text style={styles.lockTitle}>Closing Time Locked</Text>
                </View>
                <Text style={styles.lockSubtitle}>
                  Available after 12:00 PM
                </Text>
                <Text style={styles.lockHelper}>
                  End time will be recorded upon shift checkout.
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.alarmTimeCard,
                  !isSelectedToday && !includeCheckoutForPast && { opacity: 0.5 },
                ]}
                onPress={() => setTimePickerTarget('OUT')}
              >
                <Text style={styles.alarmCardLabel}>Closing Time (End)</Text>
                <Text style={[styles.alarmCardValue, { color: '#0066CC' }]}>
                  {formatDisplayTime(checkOutHour, checkOutMinute, checkOutPeriod)}
                </Text>
                <Text style={styles.alarmCardHelper}>⏰ Tap to set closing time</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Toggle for optional checkout on past dates */}
          {!isSelectedToday && (
            <TouchableOpacity
              style={styles.checkoutToggleRow}
              onPress={() => setIncludeCheckoutForPast(!includeCheckoutForPast)}
            >
              <Text style={{ fontSize: 16 }}>
                {includeCheckoutForPast ? '☑️' : '◻️'}
              </Text>
              <Text style={styles.checkoutToggleText}>
                Include Closing Time (Uncheck if you only missed check-in)
              </Text>
            </TouchableOpacity>
          )}

          {/* 5. REASON & REMARKS */}
          <Text style={[styles.cardSectionTitle, { marginTop: 16 }]}>
            REASON FOR OFFSITE / REQUEST
          </Text>

          {/* Reason Presets */}
          <View style={styles.presetChipRow}>
            {reasonPresets.map((p) => {
              const isSelected = reason === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                  onPress={() => setReason(p)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      isSelected && styles.presetChipTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Or specify custom reason..."
            placeholderTextColor="#94A3B8"
            value={reason}
            onChangeText={setReason}
          />

          <Text style={[styles.cardSectionTitle, { marginTop: 12 }]}>
            PROJECT / SITE REMARKS (OPTIONAL)
          </Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            placeholder="Customer site notes, job details, or approval remarks..."
            placeholderTextColor="#94A3B8"
            value={remarks}
            onChangeText={setRemarks}
            multiline
          />

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              Boolean(hasActiveRequest || isLoadingSubmit || isAlreadyPresent) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmitRequest}
            disabled={Boolean(hasActiveRequest || isLoadingSubmit || isAlreadyPresent)}
          >
            {isLoadingSubmit ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {hasActiveRequest
                  ? 'UNDER APPROVAL (PENDING)'
                  : isAlreadyPresent
                  ? 'ATTENDANCE ALREADY COMPLETED'
                  : isSelectedToday && !isPastNoon
                  ? '[ SUBMIT CHECK-IN REQUEST ]'
                  : '[ SUBMIT ATTENDANCE REQUEST ]'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 6. ALARM-STYLE TIME PICKER MODAL */}
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

            {/* Stepper Digits */}
            <View style={styles.alarmDigitsBox}>
              {/* Hours */}
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

              {/* Minutes */}
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
                    if (timePickerTarget === 'IN') setCheckInMinute((m) => (m - 5 + 60) % 60);
                    else setCheckOutMinute((m) => (m - 5 + 60) % 60);
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
                    (timePickerTarget === 'IN' ? checkInPeriod : checkOutPeriod) === 'AM' &&
                      styles.periodBtnActive,
                  ]}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInPeriod('AM');
                    else setCheckOutPeriod('AM');
                  }}
                >
                  <Text
                    style={[
                      styles.periodText,
                      (timePickerTarget === 'IN' ? checkInPeriod : checkOutPeriod) === 'AM' &&
                        styles.periodTextActive,
                    ]}
                  >
                    AM
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.periodBtn,
                    (timePickerTarget === 'IN' ? checkInPeriod : checkOutPeriod) === 'PM' &&
                      styles.periodBtnActive,
                  ]}
                  onPress={() => {
                    if (timePickerTarget === 'IN') setCheckInPeriod('PM');
                    else setCheckOutPeriod('PM');
                  }}
                >
                  <Text
                    style={[
                      styles.periodText,
                      (timePickerTarget === 'IN' ? checkInPeriod : checkOutPeriod) === 'PM' &&
                        styles.periodTextActive,
                    ]}
                  >
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Alarm Presets */}
            <View style={styles.alarmPresetRow}>
              {['09:00 AM', '09:30 AM', '01:30 PM', '06:00 PM', '06:30 PM'].map((timeStr) => (
                <TouchableOpacity
                  key={timeStr}
                  style={styles.alarmPresetBtn}
                  onPress={() => {
                    const [t, p] = timeStr.split(' ');
                    const [h, m] = t.split(':');
                    if (timePickerTarget === 'IN') {
                      setCheckInHour(parseInt(h));
                      setCheckInMinute(parseInt(m));
                      setCheckInPeriod(p as 'AM' | 'PM');
                    } else {
                      setCheckOutHour(parseInt(h));
                      setCheckOutMinute(parseInt(m));
                      setCheckOutPeriod(p as 'AM' | 'PM');
                    }
                  }}
                >
                  <Text style={styles.alarmPresetText}>{timeStr}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.alarmDoneBtn}
              onPress={() => setTimePickerTarget(null)}
            >
              <Text style={styles.alarmDoneBtnText}>Set Time</Text>
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
    marginTop: 1,
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
    gap: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    borderRadius: 10,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  warningSub: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  navArrowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navArrow: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0066CC',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  weekHeaderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    width: '14%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
    borderRadius: 6,
  },
  dayCellSelected: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0066CC',
  },
  dayCellPresent: {
    backgroundColor: '#ECFDF5',
  },
  dayCellAbsent: {
    backgroundColor: '#FEF2F2',
  },
  dayCellHalf: {
    backgroundColor: '#FFFBEB',
  },
  dayCellSunday: {
    backgroundColor: '#FAF5FF',
  },
  dayCellFuture: {
    opacity: 0.35,
  },
  dayCellPreJoining: {
    opacity: 0.25,
  },
  dayNumText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  batchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  batchBannerActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#0066CC',
  },
  batchTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066CC',
  },
  batchSub: {
    fontSize: 10.5,
    color: '#1E40AF',
    marginTop: 1,
  },
  batchBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  batchBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoDate: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  todayPill: {
    fontSize: 10.5,
    color: '#0066CC',
    fontWeight: '700',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  timeStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  timeStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeStatLabel: {
    fontSize: 9.5,
    color: '#64748B',
  },
  timeStatVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timePickerCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  alarmTimeCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  alarmTimeCardLocked: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  alarmCardLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  alarmCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 4,
  },
  alarmCardHelper: {
    fontSize: 9.5,
    color: '#64748B',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lockTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  lockSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
    marginTop: 2,
  },
  lockHelper: {
    fontSize: 8.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  checkoutToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  checkoutToggleText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  presetChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  presetChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0F172A',
  },
  submitBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  alarmModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  alarmTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 16,
  },
  alarmDigitsBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  digitCol: {
    alignItems: 'center',
  },
  stepBtn: {
    padding: 8,
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
    minWidth: 44,
    textAlign: 'center',
  },
  colonText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#64748B',
  },
  periodCol: {
    gap: 6,
    marginLeft: 8,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  periodBtnActive: {
    backgroundColor: '#0066CC',
  },
  periodText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  alarmPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  alarmPresetBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  alarmPresetText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0066CC',
  },
  alarmDoneBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  alarmDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
