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
import { AdminCalendarScreen } from './src/screens/AdminCalendarScreen';
import { AdminMachinesScreen } from './src/screens/AdminMachinesScreen';
import { AdminApprovalsScreen } from './src/screens/AdminApprovalsScreen';
import { QuotationListScreen } from './src/screens/QuotationListScreen';
import { QuotationCreateScreen } from './src/screens/QuotationCreateScreen';
import { QuotationPreviewScreen } from './src/screens/QuotationPreviewScreen';
import { setActiveEmployeeId } from './src/services/api';
import { Quotation } from './src/types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'HOME' | 'ATTENDANCE' | 'REQUESTS' | 'QUOTATIONS'>('HOME');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'SCANNER' | 'REQUEST' | 'CALENDAR' | 'ADMIN_CALENDAR' | 'ADMIN_MACHINES' | 'ADMIN_APPROVALS' | 'NEW_QUOTE' | 'PREVIEW_QUOTE'
  >('NONE');

  const [requestInitialDate, setRequestInitialDate] = useState<string | undefined>();
  const [requestInitialMode, setRequestInitialMode] = useState<'TODAY' | 'MISSED' | 'CLOSING'>('TODAY');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<'ADMIN' | 'SALES' | 'EMPLOYEE'>('ADMIN');
  const [activeUserName, setActiveUserName] = useState<string>('Arun Kumar');

  const handleSwitchUser = (empId: string, role: 'ADMIN' | 'SALES' | 'EMPLOYEE', name: string) => {
    setActiveEmployeeId(empId);
    setActiveUserRole(role);
    setActiveUserName(name);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Role / Persona Quick Switcher Bar for Testing */}
      <View style={styles.personaBar}>
        <Text style={styles.personaLabel}>Active Role:</Text>
        <View style={styles.personaRow}>
          <TouchableOpacity
            style={[styles.personaBtn, activeUserRole === 'ADMIN' && styles.personaBtnActive]}
            onPress={() => handleSwitchUser('usr-admin-1', 'ADMIN', 'Arun Kumar')}
          >
            <Text style={[styles.personaText, activeUserRole === 'ADMIN' && styles.personaTextActive]}>
              Admin
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.personaBtn, activeUserRole === 'SALES' && styles.personaBtnActive]}
            onPress={() => handleSwitchUser('usr-sales-1', 'SALES', 'Priya Sharma')}
          >
            <Text style={[styles.personaText, activeUserRole === 'SALES' && styles.personaTextActive]}>
              Sales
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.personaBtn, activeUserRole === 'EMPLOYEE' && styles.personaBtnActive]}
            onPress={() => handleSwitchUser('usr-tech-1', 'EMPLOYEE', 'Ramesh Tech')}
          >
            <Text style={[styles.personaText, activeUserRole === 'EMPLOYEE' && styles.personaTextActive]}>
              Tech / Employee
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tab Content */}
      <View style={styles.mainContent}>
        {currentTab === 'HOME' ? (
          <AttendanceScreen
            userName={activeUserName}
            userRole={activeUserRole}
            onOpenScanner={() => setActiveModal('SCANNER')}
            onOpenRequest={(date, mode) => {
              setRequestInitialDate(date);
              setRequestInitialMode(mode || 'TODAY');
              setActiveModal('REQUEST');
            }}
            onOpenCalendar={() => setActiveModal('CALENDAR')}
            onOpenQuotations={() => setCurrentTab('QUOTATIONS')}
            onOpenApprovals={() => setActiveModal('ADMIN_APPROVALS')}
            onOpenMachines={() => setActiveModal('ADMIN_MACHINES')}
            onOpenAdminCalendar={() => setActiveModal('ADMIN_CALENDAR')}
          />
        ) : currentTab === 'ATTENDANCE' ? (
          <AttendanceCalendarScreen
            onClose={() => setCurrentTab('HOME')}
            onRequestCorrection={(date) => {
              setRequestInitialDate(date);
              setRequestInitialMode('MISSED');
              setActiveModal('REQUEST');
            }}
          />
        ) : currentTab === 'REQUESTS' ? (
          <AttendanceRequestScreen
            onClose={() => setCurrentTab('HOME')}
            onSuccess={() => setCurrentTab('HOME')}
            initialDate={requestInitialDate}
            initialMode={requestInitialMode}
          />
        ) : (
          <QuotationListScreen
            userRole={activeUserRole}
            onNewQuotation={() => setActiveModal('NEW_QUOTE')}
            onSelectQuotation={(q) => {
              setSelectedQuotation(q);
              setActiveModal('PREVIEW_QUOTE');
            }}
          />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.bottomNavBar}>
          {/* 1. Home */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('HOME')}
          >
            <Text style={{ fontSize: 20 }}>🏠</Text>
            <Text style={[styles.navLabel, currentTab === 'HOME' && styles.navLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>

          {/* 2. Attendance */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('ATTENDANCE')}
          >
            <Text style={{ fontSize: 20 }}>📅</Text>
            <Text style={[styles.navLabel, currentTab === 'ATTENDANCE' && styles.navLabelActive]}>
              Attendance
            </Text>
          </TouchableOpacity>

          {/* 3. Center Elevated Glowing Scan Button */}
          <View style={styles.centerBtnWrapper}>
            <TouchableOpacity
              style={styles.centerGlowButton}
              onPress={() => setActiveModal('SCANNER')}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 26, color: '#FFFFFF' }}>🔲</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Requests */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              if (activeUserRole === 'ADMIN') {
                setActiveModal('ADMIN_APPROVALS');
              } else {
                setRequestInitialMode('TODAY');
                setActiveModal('REQUEST');
              }
            }}
          >
            <Text style={{ fontSize: 20 }}>📝</Text>
            <Text style={[styles.navLabel, currentTab === 'REQUESTS' && styles.navLabelActive]}>
              Requests
            </Text>
          </TouchableOpacity>

          {/* 5. Quotations */}
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => {
              if (activeUserRole === 'EMPLOYEE') {
                alert('Quotations are available to Sales and Admin roles.');
              } else {
                setCurrentTab('QUOTATIONS');
              }
            }}
          >
            <Text style={{ fontSize: 20 }}>📄</Text>
            <Text style={[styles.navLabel, currentTab === 'QUOTATIONS' && styles.navLabelActive]}>
              Quotations
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals & Overlays */}
      {activeModal === 'SCANNER' && (
        <View style={StyleSheet.absoluteFillObject}>
          <QRScannerScreen
            onClose={() => setActiveModal('NONE')}
            onSuccess={() => setActiveModal('NONE')}
            onRequestAttendance={() => {
              setRequestInitialMode('TODAY');
              setActiveModal('REQUEST');
            }}
          />
        </View>
      )}

      {activeModal === 'REQUEST' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AttendanceRequestScreen
            onClose={() => setActiveModal('NONE')}
            onSuccess={() => setActiveModal('NONE')}
            initialDate={requestInitialDate}
            initialMode={requestInitialMode}
          />
        </View>
      )}

      {activeModal === 'CALENDAR' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AttendanceCalendarScreen
            onClose={() => setActiveModal('NONE')}
            onRequestCorrection={(date) => {
              setRequestInitialDate(date);
              setRequestInitialMode('MISSED');
              setActiveModal('REQUEST');
            }}
          />
        </View>
      )}

      {activeModal === 'ADMIN_CALENDAR' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AdminCalendarScreen onClose={() => setActiveModal('NONE')} />
        </View>
      )}

      {activeModal === 'ADMIN_MACHINES' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AdminMachinesScreen onClose={() => setActiveModal('NONE')} />
        </View>
      )}

      {activeModal === 'ADMIN_APPROVALS' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AdminApprovalsScreen onClose={() => setActiveModal('NONE')} />
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
            onEdit={() => setActiveModal('NEW_QUOTE')}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  personaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
  },
  personaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  personaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  personaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  personaBtnActive: {
    backgroundColor: '#10B981',
  },
  personaText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  personaTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  mainContent: {
    flex: 1,
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  bottomNavBar: {
    flexDirection: 'row',
    height: 68,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#10B981',
    fontWeight: '800',
  },
  centerBtnWrapper: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerGlowButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
});
