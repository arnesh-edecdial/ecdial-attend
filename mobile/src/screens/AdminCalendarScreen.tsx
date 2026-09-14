import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi, getAuthToken, getActiveEmployeeId } from '../services/api';
import { CalendarDay } from '../types';
import { downloadAndSaveFile } from '../services/fileDownloader';
import { ScrollTimePickerModal } from '../components/ScrollTimePicker';
import { formatTime12, formatSchedule12 } from '../utils/time';

interface AdminCalendarScreenProps {
  onClose?: () => void;
}

export const AdminCalendarScreen: React.FC<AdminCalendarScreenProps> = ({ onClose }) => {
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [dayDetails, setDayDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [holidayName, setHolidayName] = useState<string>('Company Annual Leave');

  // Direct Resolution State
  const [resolveModalVisible, setResolveModalVisible] = useState<boolean>(false);
  const [selectedEmpToResolve, setSelectedEmpToResolve] = useState<any | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'LEAVE'>('PRESENT');
  const [resolveCheckIn, setResolveCheckIn] = useState<string>('09:00');
  const [resolveCheckOut, setResolveCheckOut] = useState<string>('18:00');
  const [includeClosingTime, setIncludeClosingTime] = useState<boolean>(true);
  const [resolveRemarks, setResolveRemarks] = useState<string>('Admin direct resolution');
  const [timePickerTarget, setTimePickerTarget] = useState<'CHECK_IN' | 'CLOSING' | null>(null);
  const [isSubmittingResolve, setIsSubmittingResolve] = useState<boolean>(false);

  const to24h = (timeStr?: string | null, fallback: string = '09:00'): string => {
    if (!timeStr) return fallback;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return fallback;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const fetchCalendar = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.getCalendar(undefined, year, month);
      if (res.success) {
        setDays(res.data.days);
        const todayStr = new Date().toISOString().substring(0, 10);
        const activeDay = res.data.days.find((d: CalendarDay) => d.date === todayStr) || res.data.days[0];
        setSelectedDay(activeDay);
        if (activeDay) {
          fetchDayDetails(activeDay.date);
        }
      }
    } catch (err) {
      console.error('Failed to load calendar', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDayDetails = async (dateStr: string) => {
    try {
      const res = await mobileApi.getTodayDashboard(dateStr);
      if (res.success) {
        setDayDetails(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [year, month]);

  const handleSelectDay = (day: CalendarDay) => {
    setSelectedDay(day);
    fetchDayDetails(day.date);
  };

  const handleMarkCompanyLeave = async () => {
    if (!selectedDay) return;
    try {
      await mobileApi.createHoliday({
        date: selectedDay.date,
        name: holidayName,
        description: 'Company-wide Leave / Holiday configured by Admin',
      });
      setLeaveModalVisible(false);
      alert(`Date ${selectedDay.date} marked as Company Leave.`);
      fetchCalendar();
    } catch (err: any) {
      alert(err.message || 'Failed to set leave day');
    }
  };

  const handleRemoveCompanyLeave = async () => {
    if (!selectedDay) return;
    try {
      await mobileApi.deleteHoliday(selectedDay.date);
      alert(`Company Leave removed for ${selectedDay.date}.`);
      fetchCalendar();
    } catch (err: any) {
      alert(err.message || 'Failed to remove leave');
    }
  };

  const handleExportMonthExcel = async () => {
    try {
      setIsExportingExcel(true);
      const mStr = String(month).padStart(2, '0');
      const url = mobileApi.getMonthExportUrl(year, month);
      const token = getAuthToken();
      const localFilename = `ECDIAL_Attendance_Month_${year}-${mStr}.xlsx`;

      const result = await downloadAndSaveFile({
        url,
        rawFilename: localFilename,
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-employee-id': getActiveEmployeeId(),
        },
        dialogTitle: `Export Monthly Attendance (${year}-${mStr})`,
        showShareFallbackOnAndroid: true,
      });

      if (result.success) {
        Alert.alert('✓ Excel Exported', `${result.filename} is downloaded and ready to view.`);
      } else {
        Alert.alert('Export Failed', result.error || 'Unable to download monthly attendance report.');
      }
    } catch (err: any) {
      console.error('[Calendar Month Excel Export Error]', err);
      Alert.alert('Export Error', err.message || 'Failed to export attendance report.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 14), paddingBottom: 130 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Company Calendar</Text>
          <Text style={styles.subtitle}>Attendance overview & Company Leave control</Text>
        </View>
        {onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setMonth((m) => (m === 1 ? 12 : m - 1))}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthNames[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => setMonth((m) => (m === 12 ? 1 : m + 1))}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Monthly Excel Export Banner */}
      <TouchableOpacity
        style={styles.monthExportBanner}
        onPress={handleExportMonthExcel}
        disabled={isExportingExcel}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 18 }}>📊</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.monthExportBannerTitle}>
            {isExportingExcel ? 'Generating Monthly Excel...' : `Export ${monthNames[month - 1]} Attendance`}
          </Text>
          <Text style={styles.monthExportBannerSub}>Download full employee attendance spreadsheet (.xlsx)</Text>
        </View>
        {isExportingExcel ? (
          <ActivityIndicator size="small" color="#0066CC" />
        ) : (
          <Text style={{ fontSize: 16, color: '#0066CC', fontWeight: '800' }}>📥</Text>
        )}
      </TouchableOpacity>

      {/* Days Header */}
      <View style={styles.daysHeader}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
          <Text key={i} style={[styles.dayHeaderText, i === 0 && { color: '#8B5CF6' }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Days Grid (Clean without clutter inside cells - Rule 22) */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#0066CC" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.calendarGrid}>
          {/* Leading Blank Cells for Weekday Alignment */}
          {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
            <View key={`blank-${i}`} style={styles.dayCellBlank} />
          ))}

          {days.map((day) => {
            const isSelected = selectedDay?.date === day.date;
            const isSunday = new Date(year, month - 1, day.dayNumber).getDay() === 0;
            const isCompanyLeave = (day as any).isCompanyLeave || day.holidayName;
            const isPresent = day.colorCode === 'GREEN';
            const isAbsent = day.colorCode === 'RED';
            const isHalf = day.colorCode === 'YELLOW';

            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isCompanyLeave && styles.dayCellHoliday,
                  isSunday && !isCompanyLeave && styles.dayCellSunday,
                  isPresent && !isSelected && styles.dayCellPresent,
                  isAbsent && !isSelected && styles.dayCellAbsent,
                  isHalf && !isSelected && styles.dayCellHalf,
                ]}
                onPress={() => handleSelectDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayNum, isSunday && { color: '#8B5CF6' }, isSelected && { color: '#0066CC', fontWeight: '900' }]}>
                  {day.dayNumber}
                </Text>
                <Text style={[styles.daySymbol, isSunday && !isCompanyLeave && { color: '#8B5CF6' }, isCompanyLeave && { color: '#0284C7', fontWeight: '800' }]}>
                  {isCompanyLeave ? 'HOL' : isSunday ? 'OFF' : isPresent ? '✓' : isAbsent ? '×' : isHalf ? '½' : '—'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* SELECTED DATE ATTENDANCE SUMMARY (Rules 23, 24, 26) */}
      {selectedDay && (
        <View style={styles.detailCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.detailTitle}>
              Selected: {selectedDay.date} ({selectedDay.dayName})
            </Text>
            {dayDetails?.isCompanyLeave && (
              <View style={styles.holidayPill}>
                <Text style={styles.holidayPillText}>COMPANY LEAVE</Text>
              </View>
            )}
          </View>

          {/* 4 Attendance Summary Badges */}
          <View style={styles.summaryStatsRow}>
            <View style={[styles.statBox, { borderLeftColor: '#10B981', borderLeftWidth: 3.5 }]}>
              <Text style={styles.statNum}>{dayDetails?.summary?.present ?? 0}</Text>
              <Text style={styles.statLabel}>PRESENT</Text>
            </View>

            <View style={[styles.statBox, { borderLeftColor: '#EF4444', borderLeftWidth: 3.5 }]}>
              <Text style={[styles.statNum, { color: '#DC2626' }]}>{dayDetails?.summary?.absent ?? 0}</Text>
              <Text style={styles.statLabel}>ABSENT</Text>
            </View>

            <View style={[styles.statBox, { borderLeftColor: '#F59E0B', borderLeftWidth: 3.5 }]}>
              <Text style={[styles.statNum, { color: '#D97706' }]}>{dayDetails?.summary?.notMarked ?? 0}</Text>
              <Text style={styles.statLabel}>NOT MARKED</Text>
            </View>

            <View style={[styles.statBox, { borderLeftColor: '#0284C7', borderLeftWidth: 3.5 }]}>
              <Text style={[styles.statNum, { color: '#0284C7' }]}>
                {dayDetails?.isCompanyLeave ? 'YES' : 'NO'}
              </Text>
              <Text style={styles.statLabel}>LEAVE DAY</Text>
            </View>
          </View>

          {/* Company Leave Action Buttons (Rule 25) */}
          {dayDetails?.isCompanyLeave ? (
            <View style={styles.leaveBannerBox}>
              <Text style={styles.leaveBannerTitle}>🏢 Company Leave: {dayDetails.holidayName}</Text>
              <Text style={styles.leaveBannerSub}>
                QR attendance is disabled for all employees on this date.
              </Text>
              <TouchableOpacity style={styles.removeLeaveBtn} onPress={handleRemoveCompanyLeave}>
                <Text style={styles.removeLeaveBtnText}>Remove Company Leave (Restore Working Day)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.markLeaveBtn} onPress={() => setLeaveModalVisible(true)}>
              <Text style={styles.markLeaveBtnText}>🏢 Mark Date as Company Leave</Text>
            </TouchableOpacity>
          )}

          {/* List of Employees for Selected Date (Rule 24, 26) */}
          <Text style={[styles.sectionHeading, { marginTop: 16 }]}>
            Employee Attendance ({dayDetails?.employees?.length || 0})
          </Text>

          <View style={styles.empListContainer}>
            {!dayDetails?.employees || dayDetails.employees.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>No attendance records available for this date.</Text>
              </View>
            ) : (
              dayDetails.employees.map((emp: any) => (
                <View key={emp.id} style={styles.empRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{emp.name}</Text>
                    <Text style={styles.empRole}>{emp.role} • {formatSchedule12(emp.schedule || '09:00 - 18:00')}</Text>
                    {emp.checkIn && (
                      <Text style={styles.empTimeNote}>
                        In: {formatTime12(emp.checkIn)} {emp.checkOut ? `• Out: ${formatTime12(emp.checkOut)}` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.empBadge, emp.status === 'PRESENT' || emp.status === 'COMPLETED' ? styles.empBadgeGreen : emp.status === 'ABSENT' ? styles.empBadgeRed : styles.empBadgeGray]}>
                      <Text style={[styles.empBadgeText, emp.status === 'PRESENT' || emp.status === 'COMPLETED' ? styles.empTextGreen : emp.status === 'ABSENT' ? styles.empTextRed : styles.empTextGray]}>
                        {emp.statusBadge || emp.status}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => {
                        setSelectedEmpToResolve(emp);
                        const existingIn = to24h(emp.checkIn, '09:00');
                        const existingOut = to24h(emp.checkOut, '18:00');
                        const isHalf = emp.status === 'HALF_DAY';
                        setResolveStatus(isHalf ? 'HALF_DAY' : 'PRESENT');
                        setResolveCheckIn(existingIn);
                        setResolveCheckOut(isHalf ? '12:30' : existingOut);
                        setIncludeClosingTime(Boolean(emp.checkOut || isHalf));
                        setResolveRemarks('Admin direct resolution');
                        setResolveModalVisible(true);
                      }}
                    >
                      <Text style={styles.resolveBtnText}>⚙️ Set Attendance</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* ADMIN DIRECT RESOLVE MODAL (Rule 14) */}
      <Modal
        visible={resolveModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Set Employee Attendance</Text>
            <Text style={styles.modalSub}>
              Directly record attendance for {selectedEmpToResolve?.name} on {selectedDay?.date}.
            </Text>

            <Text style={styles.inputLabel}>Select Status *</Text>
            <View style={styles.statusOptionsRow}>
              {(['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE'] as const).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.statusOptBtn, resolveStatus === st && styles.statusOptBtnActive]}
                  onPress={() => {
                    setResolveStatus(st);
                    if (st === 'HALF_DAY') {
                      const loginTime = to24h(selectedEmpToResolve?.checkIn, resolveCheckIn || '09:00');
                      setResolveCheckIn(loginTime);
                      setResolveCheckOut('12:30');
                      setIncludeClosingTime(true);
                    }
                  }}
                >
                  <Text style={[styles.statusOptText, resolveStatus === st && styles.statusOptTextActive]}>
                    {st === 'PRESENT' ? 'Present' : st === 'HALF_DAY' ? 'Half Day' : st === 'ABSENT' ? 'Absent' : 'Leave'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(resolveStatus === 'PRESENT' || resolveStatus === 'HALF_DAY') && (
              <View style={{ marginTop: 6, marginBottom: 6 }}>
                <Text style={styles.inputLabel}>Times to Record</Text>
                <View style={styles.scopeRow}>
                  <TouchableOpacity
                    style={[styles.scopeBtn, !includeClosingTime && styles.scopeBtnActive]}
                    onPress={() => setIncludeClosingTime(false)}
                  >
                    <Text style={[styles.scopeBtnText, !includeClosingTime && styles.scopeBtnTextActive]}>
                      Check-In Only
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.scopeBtn, includeClosingTime && styles.scopeBtnActive]}
                    onPress={() => setIncludeClosingTime(true)}
                  >
                    <Text style={[styles.scopeBtnText, includeClosingTime && styles.scopeBtnTextActive]}>
                      Check-In & Closing
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Check-In Time</Text>
                    <TouchableOpacity
                      style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      onPress={() => setTimePickerTarget('CHECK_IN')}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{formatTime12(resolveCheckIn)}</Text>
                      <Text style={{ fontSize: 16 }}>🕒</Text>
                    </TouchableOpacity>
                  </View>

                  {includeClosingTime && (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>
                        {resolveStatus === 'HALF_DAY' ? 'Closing (12:30 PM)' : 'Closing Time'}
                      </Text>
                      <TouchableOpacity
                        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                        onPress={() => setTimePickerTarget('CLOSING')}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{formatTime12(resolveCheckOut)}</Text>
                        <Text style={{ fontSize: 16 }}>🕒</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.inputLabel}>Admin Remarks</Text>
            <TextInput
              style={styles.input}
              value={resolveRemarks}
              onChangeText={setResolveRemarks}
              placeholder="e.g. Approved site attendance / verified"
            />

            <TouchableOpacity
              style={[styles.confirmBtn, isSubmittingResolve && { opacity: 0.6 }]}
              onPress={async () => {
                if (!selectedEmpToResolve || !selectedDay) return;
                setIsSubmittingResolve(true);
                try {
                  const isTimeActive = resolveStatus === 'PRESENT' || resolveStatus === 'HALF_DAY';
                  const res = await mobileApi.directResolveAttendance({
                    employeeId: selectedEmpToResolve.id,
                    date: selectedDay.date,
                    status: resolveStatus,
                    checkInTime: isTimeActive ? resolveCheckIn : undefined,
                    checkOutTime: (isTimeActive && includeClosingTime) ? resolveCheckOut : undefined,
                    remarks: resolveRemarks,
                  });
                  if (res.success) {
                    alert(`✓ Attendance for ${selectedEmpToResolve.name} recorded as ${resolveStatus}.`);
                    setResolveModalVisible(false);
                    fetchDayDetails(selectedDay.date);
                    fetchCalendar();
                  }
                } catch (err: any) {
                  alert(err.message || 'Failed to set attendance');
                } finally {
                  setIsSubmittingResolve(false);
                }
              }}
              disabled={isSubmittingResolve}
            >
              {isSubmittingResolve ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Save Attendance Record</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setResolveModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WHEEL SCROLL TIME PICKER MODAL */}
        <ScrollTimePickerModal
          visible={timePickerTarget !== null}
          initialTime={timePickerTarget === 'CHECK_IN' ? resolveCheckIn : resolveCheckOut}
          title={timePickerTarget === 'CHECK_IN' ? 'Select Check-In Time' : 'Select Closing Time'}
          onConfirm={(val) => {
            if (timePickerTarget === 'CHECK_IN') {
              setResolveCheckIn(val.formatted24);
            } else {
              setResolveCheckOut(val.formatted24);
            }
            setTimePickerTarget(null);
          }}
          onCancel={() => setTimePickerTarget(null)}
        />
      </Modal>

      {/* MARK COMPANY LEAVE MODAL */}
      <Modal visible={leaveModalVisible} transparent animationType="fade" onRequestClose={() => setLeaveModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Mark Company Leave</Text>
            <Text style={styles.modalSub}>
              Disables QR check-in for all employees on {selectedDay?.date}.
            </Text>

            <Text style={styles.inputLabel}>Leave Reason / Holiday Name</Text>
            <TextInput
              style={styles.input}
              value={holidayName}
              onChangeText={setHolidayName}
              placeholder="e.g. Diwali / Annual Maintenance"
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={handleMarkCompanyLeave}>
              <Text style={styles.confirmBtnText}>Confirm Company Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLeaveModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  navArrow: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0066CC',
    paddingHorizontal: 12,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  daysHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    marginBottom: 6,
  },
  dayHeaderText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    width: '14.28%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    marginBottom: 16,
  },
  dayCellBlank: {
    width: '14.28%',
    height: 44,
  },
  dayCell: {
    width: '14.28%',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  dayCellSelected: {
    borderColor: '#0066CC',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  dayCellHoliday: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  dayCellSunday: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  dayCellPresent: { backgroundColor: '#ECFDF5' },
  dayCellAbsent: { backgroundColor: '#FEF2F2' },
  dayCellHalf: { backgroundColor: '#FFFBEB' },
  dayNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  daySymbol: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 1,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  holidayPill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  holidayPillText: {
    color: '#0284C7',
    fontSize: 9,
    fontWeight: '800',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
  },
  statLabel: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  markLeaveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  markLeaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  leaveBannerBox: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  leaveBannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  leaveBannerSub: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 3,
    marginBottom: 8,
  },
  removeLeaveBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  removeLeaveBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  empListContainer: {
    gap: 6,
  },
  empRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  empName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  empRole: {
    fontSize: 10,
    color: '#64748B',
  },
  empBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  empBadgeGreen: { backgroundColor: '#ECFDF5' },
  empBadgeRed: { backgroundColor: '#FEF2F2' },
  empBadgeGray: { backgroundColor: '#F1F5F9' },
  empBadgeText: { fontSize: 10, fontWeight: '700' },
  empTextGreen: { color: '#059669' },
  empTextRed: { color: '#DC2626' },
  empTextGray: { color: '#64748B' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 8,
    color: '#0F172A',
    fontSize: 13,
    marginBottom: 14,
  },
  confirmBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  empTimeNote: {
    fontSize: 9.5,
    color: '#0066CC',
    fontWeight: '600',
    marginTop: 2,
  },
  resolveBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  resolveBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0066CC',
  },
  statusOptionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  statusOptBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusOptBtnActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  statusOptText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusOptTextActive: {
    color: '#FFFFFF',
  },
  monthExportBanner: {
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthExportBannerTitle: {
    color: '#0066CC',
    fontSize: 12.5,
    fontWeight: '800',
  },
  monthExportBannerSub: {
    color: '#64748B',
    fontSize: 10.5,
    marginTop: 2,
  },
  monthExportBannerText: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '800',
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066CC',
  },
  scopeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  scopeBtnTextActive: {
    color: '#0066CC',
    fontWeight: '800',
  },
});
