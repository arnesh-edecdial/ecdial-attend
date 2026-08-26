import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { mobileApi } from '../services/api';
import { TodayAttendanceStatus } from '../types';

interface AttendanceScreenProps {
  onOpenScanner: () => void;
  onOpenRequest: (date?: string) => void;
  onOpenCalendar: () => void;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({
  onOpenScanner,
  onOpenRequest,
  onOpenCalendar,
}) => {
  const [statusData, setStatusData] = useState<TodayAttendanceStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.getTodayStatus();
      if (res.success) {
        setStatusData(res.data);
      }
    } catch (err) {
      console.error('Failed to load status', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCheckOut = async () => {
    setIsCheckingOut(true);
    setCheckoutMessage(null);
    try {
      const res = await mobileApi.checkOut({
        latitude: 13.0827,
        longitude: 80.2707,
        accuracy: 12,
      });
      if (res.success) {
        setCheckoutMessage(res.message);
        fetchStatus();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to check out');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (isLoading && !statusData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.mutedText}>Loading today's attendance...</Text>
      </View>
    );
  }

  const isCheckedIn = statusData?.displayStatus === 'CHECKED_IN';
  const isCompleted = statusData?.displayStatus === 'COMPLETED';
  const isHoliday = statusData?.displayStatus === 'HOLIDAY';
  const isWeeklyOff = statusData?.displayStatus === 'WEEKLY_OFF';
  const isWaitingApproval = statusData?.displayStatus === 'WAITING_FOR_APPROVAL';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchStatus} tintColor="#0066CC" />}
    >
      {/* Date Header */}
      <View style={styles.header}>
        <Text style={styles.dateTitle}>{statusData?.date || 'Today'}</Text>
        <Text style={styles.officeSub}>
          {statusData?.office?.officeName || 'ECDIAL Office'}
        </Text>
      </View>

      {/* Main Attendance Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>TODAY'S ATTENDANCE</Text>

        {isCompleted ? (
          <View style={styles.statusContent}>
            <View style={[styles.statusBadge, { backgroundColor: '#064E3B' }]}>
              <Text style={[styles.statusText, { color: '#10B981' }]}>✓ ATTENDANCE COMPLETE</Text>
            </View>
            <Text style={styles.timeRangeText}>
              {statusData?.attendance?.checkInFormatted} → {statusData?.attendance?.checkOutFormatted}
            </Text>
            {statusData?.attendance?.durationFormatted && (
              <Text style={styles.durationText}>
                Total Working Duration: {statusData?.attendance?.durationFormatted}
              </Text>
            )}
          </View>
        ) : isCheckedIn ? (
          <View style={styles.statusContent}>
            <View style={[styles.statusBadge, { backgroundColor: '#064E3B' }]}>
              <Text style={[styles.statusText, { color: '#10B981' }]}>CHECKED IN</Text>
            </View>
            <Text style={styles.timeMainText}>
              {statusData?.attendance?.checkInFormatted}
            </Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.checkOutButton]}
              onPress={handleCheckOut}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>[ CHECK OUT ]</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : isHoliday ? (
          <View style={styles.statusContent}>
            <View style={[styles.statusBadge, { backgroundColor: '#334155' }]}>
              <Text style={[styles.statusText, { color: '#94A3B8' }]}>GOVERNMENT HOLIDAY</Text>
            </View>
            <Text style={styles.timeMainText}>{statusData?.holiday?.name}</Text>
            <Text style={styles.durationText}>No attendance check-in required today.</Text>
          </View>
        ) : isWeeklyOff ? (
          <View style={styles.statusContent}>
            <View style={[styles.statusBadge, { backgroundColor: '#334155' }]}>
              <Text style={[styles.statusText, { color: '#94A3B8' }]}>WEEKLY OFF</Text>
            </View>
            <Text style={styles.timeMainText}>Scheduled Day Off</Text>
            <Text style={styles.durationText}>Enjoy your weekly rest day.</Text>
          </View>
        ) : isWaitingApproval ? (
          <View style={styles.statusContent}>
            <View style={[styles.statusBadge, { backgroundColor: '#78350F' }]}>
              <Text style={[styles.statusText, { color: '#F59E0B' }]}>WAITING FOR APPROVAL</Text>
            </View>
            <Text style={styles.durationText}>Correction request submitted to admin.</Text>
          </View>
        ) : (
          <View style={styles.statusContent}>
            <Text style={styles.notMarkedText}>NOT MARKED</Text>
            <TouchableOpacity style={[styles.actionButton, styles.scanButton]} onPress={onOpenScanner}>
              <Text style={styles.actionButtonText}>[ SCAN ATTENDANCE ]</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Schedule Info */}
      {statusData?.schedule && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Your Configured Schedule Today:</Text>
          <Text style={styles.infoValue}>
            {statusData.schedule.startTime} - {statusData.schedule.endTime} ({statusData.schedule.isWorkingDay ? 'Working Day' : 'Day Off'})
          </Text>
        </View>
      )}

      {/* Navigation Quick Actions */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onOpenCalendar}>
          <Text style={styles.secondaryButtonText}>Monthly Calendar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => onOpenRequest()}>
          <Text style={styles.secondaryButtonText}>Request Correction</Text>
        </TouchableOpacity>
      </View>
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
  centerContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  dateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  officeSub: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(18, 27, 48, 0.9)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 16,
  },
  statusContent: {
    alignItems: 'center',
    width: '100%',
  },
  notMarkedText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 20,
  },
  timeMainText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginVertical: 12,
  },
  timeRangeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 10,
  },
  durationText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  scanButton: {
    backgroundColor: '#0066CC',
  },
  checkOutButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  mutedText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
  },
});
