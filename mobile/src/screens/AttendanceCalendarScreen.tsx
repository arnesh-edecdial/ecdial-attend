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

      {/* Days Grid */}
      <View style={styles.daysHeader}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
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
                style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayNum, isSelected && { color: '#0066CC', fontWeight: '800' }]}>
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
          <Text style={styles.detailDate}>{selectedDay.date} ({selectedDay.dayName})</Text>
          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: '#94A3B8' }}>Status:</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: getColorDot(selectedDay.colorCode) }}>
              {selectedDay.badge || selectedDay.status}
            </Text>
          </View>

          {selectedDay.holidayName && (
            <Text style={styles.holidayText}>Holiday: {selectedDay.holidayName}</Text>
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
    backgroundColor: '#0A0F1D',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
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
    fontSize: 11,
    color: '#94A3B8',
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 20,
  },
  dayCell: {
    width: 42,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dayCellSelected: {
    backgroundColor: 'rgba(0, 102, 204, 0.25)',
    borderColor: '#0066CC',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  detailCard: {
    backgroundColor: 'rgba(18, 27, 48, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detailDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  holidayText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
  },
  timeBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 10,
    borderRadius: 8,
  },
  timeBoxLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  timeBoxVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  durationNote: {
    fontSize: 13,
    color: '#0066CC',
    fontWeight: '600',
    marginBottom: 4,
  },
  otNote: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '700',
    marginBottom: 8,
  },
  requestBtn: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
