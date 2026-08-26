import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { mobileApi } from '../services/api';
import { CalendarDay } from '../types';

interface AttendanceCalendarScreenProps {
  onClose: () => void;
  onRequestCorrection: (date?: string) => void;
}

export const AttendanceCalendarScreen: React.FC<AttendanceCalendarScreenProps> = ({
  onClose,
  onRequestCorrection,
}) => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  const getColorDot = (code: string) => {
    switch (code) {
      case 'GREEN':
        return '#10B981';
      case 'RED':
        return '#EF4444';
      case 'YELLOW':
        return '#F59E0B';
      case 'PURPLE':
        return '#8B5CF6';
      default:
        return '#64748B';
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
          <Text style={styles.title}>{monthNames[month - 1]} {year}</Text>
          <Text style={styles.subtitle}>Monthly Attendance Summary</Text>
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

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Present</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Absent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>Approval</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#8B5CF6' }]} />
          <Text style={styles.legendText}>Overtime</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#64748B' }]} />
          <Text style={styles.legendText}>Off/Holiday</Text>
        </View>
      </View>

      {/* Days Header */}
      <View style={styles.daysHeader}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
          <Text key={i} style={[styles.dayHeaderText, i === 0 && { color: '#EF4444' }]}>
            {d}
          </Text>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0066CC" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.calendarGrid}>
          {days.map((day) => {
            const isSelected = selectedDay?.date === day.date;
            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  day.colorCode === 'GREEN' && styles.dayCellPresent,
                  day.colorCode === 'RED' && styles.dayCellAbsent,
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayNum, isSelected && { color: '#0066CC', fontWeight: '900' }]}>
                  {day.dayNumber}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: getColorDot(day.colorCode) }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected Day Details */}
      {selectedDay && (
        <View style={styles.detailCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.detailDate}>{selectedDay.date} ({selectedDay.dayName})</Text>
            <View style={[styles.statusBadge, { backgroundColor: getColorDot(selectedDay.colorCode) + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: getColorDot(selectedDay.colorCode) }]}>
                {selectedDay.badge || selectedDay.status}
              </Text>
            </View>
          </View>

          {selectedDay.holidayName && (
            <Text style={styles.holidayText}>🏢 Holiday: {selectedDay.holidayName}</Text>
          )}

          <View style={styles.timeRow}>
            <View style={styles.timeBox}>
              <Text style={styles.timeBoxLabel}>Check-In</Text>
              <Text style={styles.timeBoxVal}>{selectedDay.checkIn || '—'}</Text>
            </View>
            <View style={styles.timeBox}>
              <Text style={styles.timeBoxLabel}>Check-Out</Text>
              <Text style={styles.timeBoxVal}>{selectedDay.checkOut || '—'}</Text>
            </View>
          </View>

          {selectedDay.workingDuration && (
            <Text style={styles.durationNote}>Working Duration: {selectedDay.workingDuration}</Text>
          )}

          {selectedDay.otFormatted && (
            <Text style={styles.otNote}>Overtime: +{selectedDay.otFormatted}</Text>
          )}

          <TouchableOpacity
            style={styles.requestBtn}
            onPress={() => onRequestCorrection(selectedDay.date)}
          >
            <Text style={styles.requestBtnText}>Request Correction for this Date</Text>
          </TouchableOpacity>
        </View>
      )}
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
    fontSize: 20,
    fontWeight: '900',
    color: '#0066CC',
    paddingHorizontal: 12,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayHeaderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 16,
  },
  dayCell: {
    width: 40,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  dayCellSelected: {
    borderColor: '#0066CC',
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  dayCellPresent: { backgroundColor: '#ECFDF5' },
  dayCellAbsent: { backgroundColor: '#FEF2F2' },
  dayNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  detailDate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  holidayText: {
    fontSize: 11.5,
    color: '#0284C7',
    marginTop: 4,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  timeBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeBoxLabel: {
    fontSize: 9.5,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  timeBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  durationNote: {
    fontSize: 12,
    color: '#0066CC',
    fontWeight: '700',
    marginBottom: 2,
  },
  otNote: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '700',
    marginBottom: 6,
  },
  requestBtn: {
    marginTop: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
