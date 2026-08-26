import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { QRScannerScreen } from './src/screens/QRScannerScreen';
import { AttendanceRequestScreen } from './src/screens/AttendanceRequestScreen';
import { AttendanceCalendarScreen } from './src/screens/AttendanceCalendarScreen';
import { QuotationListScreen } from './src/screens/QuotationListScreen';
import { QuotationCreateScreen } from './src/screens/QuotationCreateScreen';
import { QuotationPreviewScreen } from './src/screens/QuotationPreviewScreen';
import { setActiveEmployeeId } from './src/services/api';
import { Quotation } from './src/types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'ATTENDANCE' | 'QUOTATIONS'>('ATTENDANCE');
  const [activeModal, setActiveModal] = useState<'NONE' | 'SCANNER' | 'REQUEST' | 'CALENDAR' | 'NEW_QUOTE' | 'PREVIEW_QUOTE'>('NONE');
  const [requestInitialDate, setRequestInitialDate] = useState<string | undefined>();
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<string>('TECHNICIAN');

  const handleSwitchUser = (empId: string, role: string) => {
    setActiveEmployeeId(empId);
    setActiveUserRole(role);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1D" />

      {/* Top Mobile App Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandTitle}>ECDIAL</Text>
          <Text style={styles.brandSub}>Field Mobile App</Text>
        </View>

        {/* Persona quick switch for testing */}
        <View style={styles.personaRow}>
          <TouchableOpacity
            style={[styles.personaBtn, activeUserRole === 'TECHNICIAN' && styles.personaBtnActive]}
            onPress={() => handleSwitchUser('usr-tech-1', 'TECHNICIAN')}
          >
            <Text style={[styles.personaText, activeUserRole === 'TECHNICIAN' && styles.personaTextActive]}>
              Tech
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.personaBtn, activeUserRole === 'SALES' && styles.personaBtnActive]}
            onPress={() => handleSwitchUser('usr-sales-1', 'SALES')}
          >
            <Text style={[styles.personaText, activeUserRole === 'SALES' && styles.personaTextActive]}>
              Sales
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.personaBtn, activeUserRole === 'ADMIN' && styles.personaBtnActive]}
            onPress={() => handleSwitchUser('usr-admin-1', 'ADMIN')}
          >
            <Text style={[styles.personaText, activeUserRole === 'ADMIN' && styles.personaTextActive]}>
              Admin
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Content */}
      <View style={styles.mainContent}>
        {currentTab === 'ATTENDANCE' ? (
          <AttendanceScreen
            onOpenScanner={() => setActiveModal('SCANNER')}
            onOpenRequest={(date) => {
              setRequestInitialDate(date);
              setActiveModal('REQUEST');
            }}
            onOpenCalendar={() => setActiveModal('CALENDAR')}
          />
        ) : (
          <QuotationListScreen
            onNewQuotation={() => setActiveModal('NEW_QUOTE')}
            onSelectQuotation={(q) => {
              setSelectedQuotation(q);
              setActiveModal('PREVIEW_QUOTE');
            }}
          />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[styles.navItem, currentTab === 'ATTENDANCE' && styles.navItemActive]}
          onPress={() => setCurrentTab('ATTENDANCE')}
        >
          <Text style={[styles.navText, currentTab === 'ATTENDANCE' && styles.navTextActive]}>
            Attendance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, currentTab === 'QUOTATIONS' && styles.navItemActive]}
          onPress={() => setCurrentTab('QUOTATIONS')}
        >
          <Text style={[styles.navText, currentTab === 'QUOTATIONS' && styles.navTextActive]}>
            Quotations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modals & Overlays */}
      {activeModal === 'SCANNER' && (
        <View style={StyleSheet.absoluteFillObject}>
          <QRScannerScreen
            onClose={() => setActiveModal('NONE')}
            onSuccess={() => setActiveModal('NONE')}
            onRequestAttendance={() => setActiveModal('REQUEST')}
          />
        </View>
      )}

      {activeModal === 'REQUEST' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AttendanceRequestScreen
            onClose={() => setActiveModal('NONE')}
            onSuccess={() => setActiveModal('NONE')}
            initialDate={requestInitialDate}
          />
        </View>
      )}

      {activeModal === 'CALENDAR' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AttendanceCalendarScreen
            onClose={() => setActiveModal('NONE')}
            onRequestCorrection={(date) => {
              setRequestInitialDate(date);
              setActiveModal('REQUEST');
            }}
          />
        </View>
      )}

      {activeModal === 'NEW_QUOTE' && (
        <View style={StyleSheet.absoluteFillObject}>
          <QuotationCreateScreen
            onClose={() => setActiveModal('NONE')}
            onSuccess={(created) => {
              setSelectedQuotation(created);
              setActiveModal('PREVIEW_QUOTE');
            }}
          />
        </View>
      )}

      {activeModal === 'PREVIEW_QUOTE' && (
        <View style={StyleSheet.absoluteFillObject}>
          <QuotationPreviewScreen
            quotation={selectedQuotation}
            onClose={() => setActiveModal('NONE')}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  brandSub: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  personaRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 3,
    borderRadius: 99,
  },
  personaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  personaBtnActive: {
    backgroundColor: '#0066CC',
  },
  personaText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  personaTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mainContent: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#0D1527',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemActive: {
    borderTopWidth: 3,
    borderColor: '#0066CC',
  },
  navText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  navTextActive: {
    color: '#0066CC',
    fontWeight: '700',
  },
});
