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
} from 'react-native';
import { mobileApi } from '../services/api';
import { CalendarDay } from '../types';

interface AdminCalendarScreenProps {
  onClose: () => void;
}

export const AdminCalendarScreen: React.FC<AdminCalendarScreenProps> = ({ onClose }) => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [holidayName, setHolidayName] = useState<string>('Company Annual Leave');

  const fetchCalendar = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.getCalendar(undefined, year, month);
      if (res.success) {
        setDays(res.data.days);
        const todayStr = new Date().toISOString().substring(0, 10);
        setSelectedDay(res.data.days.find((d: CalendarDay) => d.date === todayStr) || res.data.days[0]);
      }
    } catch (err) {
      console.error('Failed to load calendar', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [year, month]);

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Company Attendance Calendar</Text>
          <Text style={styles.subtitle}>Admin calendar control & Company Leave management</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Back</Text>
        </TouchableOpacity>
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

      {/* Days Header */}
      <View style={styles.daysHeader}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
          <Text key={i} style={styles.dayHeaderText}>{d}</Text>
        ))}
      </View>

      {/* Days Grid */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#0066CC" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.calendarGrid}>
          {days.map((day) => {
            const isSelected = selectedDay?.date === day.date;
            const isCompanyLeave = (day as any).isCompanyLeave || day.holidayName;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isCompanyLeave && styles.dayCellHoliday,
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayNum, isSelected && { color: '#0066CC', fontWeight: '900' }]}>
                  {day.dayNumber}
                </Text>
                <Text style={[styles.daySymbol, isCompanyLeave && { color: '#0284C7', fontWeight: '800' }]}>
                  {isCompanyLeave ? 'HOL' : (day as any).symbol || (day.colorCode === 'GREEN' ? '✓' : day.colorCode === 'RED' ? '×' : '—')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected Day Control Panel */}
      {selectedDay && (
        <View style={styles.controlCard}>
          <Text style={styles.controlDate}>Selected: {selectedDay.date} ({selectedDay.dayName})</Text>

          {selectedDay.holidayName ? (
            <View style={styles.holidayBadge}>
              <Text style={styles.holidayBadgeText}>🏢 COMPANY LEAVE: {selectedDay.holidayName}</Text>
              <Text style={styles.holidaySubText}>Normal QR attendance is disabled for all employees on this date.</Text>
              <TouchableOpacity style={styles.removeLeaveBtn} onPress={handleRemoveCompanyLeave}>
                <Text style={styles.removeLeaveBtnText}>Remove Company Leave (Restore Working Day)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.infoText}>Status: Normal Working Day</Text>
              <TouchableOpacity style={styles.markLeaveBtn} onPress={() => setLeaveModalVisible(true)}>
                <Text style={styles.markLeaveBtnText}>🏢 Mark Date as Company Leave</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
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
    padding: 12,
    borderRadius: 12,
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
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dayHeaderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    width: 44,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  dayCell: {
    width: 44,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayCellSelected: {
    borderColor: '#0066CC',
    backgroundColor: '#EFF6FF',
  },
  dayCellHoliday: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  dayNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  daySymbol: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
  },
  controlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  controlDate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
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
  holidayBadge: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 10,
  },
  holidayBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0369A1',
  },
  holidaySubText: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 4,
    marginBottom: 10,
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
});
