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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AttendanceCalendarScreenProps {
  onClose?: () => void;
  onRequestCorrection: (date: string) => void;
  employeeId?: string;
}

export const AttendanceCalendarScreen: React.FC<AttendanceCalendarScreenProps> = ({
  onClose,
  onRequestCorrection,
  employeeId,
}) => {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  const fetchCalendar = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.getCalendar(employeeId, year, month);
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
  }, [year, month, employeeId]);

  const getColorDot = (code: string, isSunday?: boolean, isHoliday?: boolean) => {
    if (isHoliday) {
      return '#0284C7'; // Distinct cyan/sky blue for Company Holiday / Leave
    }
    if (isSunday && (code === 'GREY' || !code)) {
      return '#8B5CF6'; // Distinct subtle purple for Sunday weekly off
    }
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
        return '#94A3B8';
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
          <Text style={styles.title}>{monthNames[month - 1]} {year}</Text>
          <Text style={styles.subtitle}>Monthly Attendance Summary</Text>
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
          <Text style={styles.legendText}>Sunday/Off</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#0284C7' }]} />
          <Text style={styles.legendText}>Holiday</Text>
        </View>
      </View>

      {/* Days Header */}
      <View style={styles.daysHeader}>
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
          <Text key={i} style={[styles.dayHeaderText, i === 0 && { color: '#8B5CF6' }]}>
            {d}
          </Text>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0066CC" style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.calendarGrid}>
          {/* Leading Blank Cells to Align First Day of Month under Correct Weekday (Sun=0..Sat=6) */}
          {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
            <View key={`blank-${i}`} style={styles.dayCell} />
          ))}

          {days.map((day) => {
            const isSelected = selectedDay?.date === day.date;
            const isSunday = new Date(year, month - 1, day.dayNumber).getDay() === 0;
            const isHoliday = !!day.holidayName || !!(day as any).isCompanyLeave;
            const dotColor = getColorDot(day.colorCode, isSunday, isHoliday);

            return (
              <TouchableOpacity
                key={day.date}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isHoliday && styles.dayCellHoliday,
                  day.colorCode === 'GREEN' && !isHoliday && styles.dayCellPresent,
                  day.colorCode === 'RED' && !isHoliday && styles.dayCellAbsent,
                  isSunday && day.colorCode === 'GREY' && !isHoliday && styles.dayCellSunday,
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayNum,
                    isHoliday && { color: '#0284C7', fontWeight: '800' },
                    isSunday && !isHoliday && { color: '#8B5CF6', fontWeight: '700' },
                    isSelected && { color: '#0066CC', fontWeight: '900' },
                  ]}
                >
                  {day.dayNumber}
                </Text>
                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Selected Day Details */}
      {selectedDay && (() => {
        const isSunday = new Date(selectedDay.date).getDay() === 0;
        const displayBadge = isSunday && selectedDay.colorCode === 'GREY'
          ? 'Sunday (Weekly Off)'
          : (selectedDay.badge || selectedDay.status);
        const dotColor = getColorDot(selectedDay.colorCode, isSunday);

        return (
          <View style={styles.detailCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.detailDate}>{selectedDay.date} ({selectedDay.dayName})</Text>
              <View style={[styles.statusBadge, { backgroundColor: dotColor + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: dotColor }]}>
                  {displayBadge}
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
        );
      })()}
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  navArrow: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0066CC',
    paddingHorizontal: 12,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
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
    fontSize: 10,
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
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellSelected: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0066CC',
  },
  dayCellPresent: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
  },
  dayCellAbsent: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  dayCellSunday: {
    backgroundColor: '#FAF5FF',
    borderRadius: 8,
  },
  dayCellHoliday: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 8,
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: 12,
    color: '#0066CC',
    fontWeight: '700',
    marginTop: 6,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  timeBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeBoxLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  timeBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  durationNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 8,
  },
  otNote: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B5CF6',
    marginTop: 2,
  },
  requestBtn: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  requestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066CC',
  },
});
