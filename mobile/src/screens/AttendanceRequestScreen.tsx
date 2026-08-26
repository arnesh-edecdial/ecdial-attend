import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { mobileApi } from '../services/api';

interface AttendanceRequestScreenProps {
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
}

export const AttendanceRequestScreen: React.FC<AttendanceRequestScreenProps> = ({
  onClose,
  onSuccess,
  initialDate,
}) => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [dates, setDates] = useState<string[]>(initialDate ? [initialDate] : [todayStr]);
  const [checkInTime, setCheckInTime] = useState<string>('09:00');
  const [checkOutTime, setCheckOutTime] = useState<string>('20:00');
  const [reason, setReason] = useState<string>('Forgot to mark attendance');
  const [remarks, setRemarks] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Generate last 5 dates for fast multi-day checkbox selection
  const recentDates = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().substring(0, 10);
  });

  const toggleDate = (dateStr: string) => {
    if (dates.includes(dateStr)) {
      if (dates.length > 1) {
        setDates(dates.filter((d) => d !== dateStr));
      }
    } else {
      setDates([...dates, dateStr]);
    }
  };

  const handleSubmit = async () => {
    if (dates.length === 0) {
      setError('Please select at least one date.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await mobileApi.submitRequest({
        requestType: dates.length > 1 ? 'MULTI_DAY_MISSED' : 'CHECKIN_FAILURE',
        dates,
        checkInTime,
        checkOutTime,
        reason,
        remarks,
      });

      if (res.success) {
        alert('Attendance request submitted. Waiting for admin approval.');
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit attendance request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Correction</Text>
        <Text style={styles.subtitle}>Submit single or multiple missed dates for admin approval</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Date Multi-Selection Checkboxes */}
      <Text style={styles.sectionLabel}>SELECT DATE(S)</Text>
      <View style={styles.datesList}>
        {recentDates.map((dateStr) => {
          const isSelected = dates.includes(dateStr);
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.dateCheckbox, isSelected && styles.dateCheckboxSelected]}
              onPress={() => toggleDate(dateStr)}
            >
              <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>
                {isSelected ? '✓ ' : '[ ] '} {dateStr}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Times */}
      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.inputLabel}>Check-in Time</Text>
          <TextInput
            style={styles.input}
            value={checkInTime}
            onChangeText={setCheckInTime}
            placeholder="09:00"
            placeholderTextColor="#64748B"
          />
        </View>

        <View style={styles.halfField}>
          <Text style={styles.inputLabel}>Check-out Time</Text>
          <TextInput
            style={styles.input}
            value={checkOutTime}
            onChangeText={setCheckOutTime}
            placeholder="20:00"
            placeholderTextColor="#64748B"
          />
        </View>
      </View>

      {/* Reason */}
      <Text style={styles.inputLabel}>Reason for Request</Text>
      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. Forgot to mark attendance"
        placeholderTextColor="#64748B"
      />

      {/* Remarks */}
      <Text style={styles.inputLabel}>Remarks (Optional)</Text>
      <TextInput
        style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Additional context for manager..."
        placeholderTextColor="#64748B"
        multiline
      />

      <View style={styles.statusInfo}>
        <Text style={styles.statusInfoText}>
          Status: <Text style={{ color: '#F59E0B', fontWeight: '700' }}>WAITING FOR APPROVAL (Pale Yellow)</Text>
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>[ SUBMIT REQUEST ]</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  datesList: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 18,
  },
  dateCheckbox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  dateCheckboxSelected: {
    backgroundColor: 'rgba(0, 102, 204, 0.2)',
    borderColor: '#0066CC',
  },
  dateText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  dateTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  halfField: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#152238',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 14,
  },
  statusInfo: {
    padding: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 20,
  },
  statusInfoText: {
    fontSize: 12.5,
    color: '#CBD5E1',
  },
  submitButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  errorBox: {
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#FF8888',
    fontSize: 13,
  },
});
