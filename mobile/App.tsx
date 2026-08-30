import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { QRScannerScreen } from './src/screens/QRScannerScreen';
import { AttendanceRequestScreen } from './src/screens/AttendanceRequestScreen';
import { AttendanceCalendarScreen } from './src/screens/AttendanceCalendarScreen';
import { AdminCalendarScreen } from './src/screens/AdminCalendarScreen';
import { AdminMachinesScreen } from './src/screens/AdminMachinesScreen';
import { AdminApprovalsScreen } from './src/screens/AdminApprovalsScreen';
import { StockScreen } from './src/screens/StockScreen';
import { QuotationListScreen } from './src/screens/QuotationListScreen';
import { QuotationCreateScreen } from './src/screens/QuotationCreateScreen';
import { QuotationPreviewScreen } from './src/screens/QuotationPreviewScreen';
import { AdminEmployeesScreen } from './src/screens/AdminEmployeesScreen';
import { AdminLocationCalibrationScreen } from './src/screens/AdminLocationCalibrationScreen';
import { AppDrawer } from './src/components/AppDrawer';
import { setActiveEmployeeId, setAuthToken } from './src/services/api';
import { Quotation } from './src/types';

function MainApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<
    'HOME' | 'CALENDAR' | 'APPROVALS' | 'EMPLOYEES' | 'MACHINES' | 'STOCK' | 'QUOTATIONS'
  >('HOME');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'SCANNER' | 'REQUEST' | 'NEW_QUOTE' | 'PREVIEW_QUOTE' | 'LOCATION_CALIBRATION'
  >('NONE');

  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [requestInitialDate, setRequestInitialDate] = useState<string | undefined>();
  const [requestInitialMode, setRequestInitialMode] = useState<'TODAY' | 'MISSED' | 'CLOSING'>('TODAY');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<'ADMIN' | 'SALES' | 'EMPLOYEE'>('ADMIN');
  const [activeUserName, setActiveUserName] = useState<string>('Arun Kumar');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Android Hardware Back Button Handling
  useEffect(() => {
    const onBackPress = () => {
      if (!isAuthenticated) {
        return false;
      }
      if (drawerVisible) {
        setDrawerVisible(false);
        return true;
      }
      if (activeModal !== 'NONE') {
        setActiveModal('NONE');
        return true;
      }
      if (currentTab !== 'HOME') {
        setCurrentTab('HOME');
        return true;
      }
      // At root HOME: allow default Android app exit
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isAuthenticated, drawerVisible, activeModal, currentTab]);

  const handleLoginSuccess = (user: any, token: string) => {
    setAuthToken(token);
    setActiveEmployeeId(user.id);
    setActiveUserName(user.name);
    const roleMap: Record<string, 'ADMIN' | 'SALES' | 'EMPLOYEE'> = {
      ADMIN: 'ADMIN',
      IT_ADMIN: 'ADMIN',
      MANAGER: 'ADMIN',
      SERVICE_MANAGER: 'ADMIN',
      HR: 'ADMIN',
      CRM: 'SALES',
      SALES: 'SALES',
      TECHNICIAN: 'EMPLOYEE',
      ACCOUNTANT: 'EMPLOYEE',
    };
    setActiveUserRole(roleMap[user.role] || 'EMPLOYEE');
    setIsAuthenticated(true);
    setCurrentTab('HOME');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setActiveEmployeeId('');
    setActiveUserName('');
    setActiveUserRole('EMPLOYEE');
    setIsAuthenticated(false);
    setDrawerVisible(false);
    setSelectedQuotation(null);
    setActiveModal('NONE');
    setCurrentTab('HOME');
  };

  const handleDrawerNavigate = (screenId: string) => {
    setDrawerVisible(false);
    if (screenId === 'LOGOUT') {
      handleLogout();
    } else if (screenId === 'CALENDAR' || screenId === 'ADMIN_CALENDAR') {
      setCurrentTab('CALENDAR');
    } else if (screenId === 'APPROVALS' || screenId === 'ADMIN_APPROVALS') {
      setCurrentTab('APPROVALS');
    } else if (screenId === 'EMPLOYEES' || screenId === 'ADMIN_EMPLOYEES') {
      setCurrentTab('EMPLOYEES');
    } else if (screenId === 'MACHINES' || screenId === 'ADMIN_MACHINES') {
      setCurrentTab('MACHINES');
    } else if (screenId === 'STOCK') {
      setCurrentTab('STOCK');
    } else if (screenId === 'QUOTATIONS') {
      setCurrentTab('QUOTATIONS');
    } else if (screenId === 'LOCATION_CALIBRATION') {
      setActiveModal('LOCATION_CALIBRATION');
    } else if (screenId === 'NEW_QUOTE') {
      setActiveModal('NEW_QUOTE');
    } else if (screenId === 'REQUEST') {
      setRequestInitialMode('TODAY');
      setActiveModal('REQUEST');
    } else {
      setCurrentTab('HOME');
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#0F172A' }]} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* Main Tab Content */}
      <View style={styles.mainContent}>
        {currentTab === 'HOME' ? (
          <AttendanceScreen
            key={`home-${refreshKey}`}
            userName={activeUserName}
            userRole={activeUserRole}
            onOpenDrawer={() => setDrawerVisible(true)}
            onOpenScanner={() => setActiveModal('SCANNER')}
            onOpenRequest={(date, mode) => {
              setRequestInitialDate(date);
              setRequestInitialMode(mode || 'TODAY');
              setActiveModal('REQUEST');
            }}
            onOpenCalendar={() => setCurrentTab('CALENDAR')}
            onOpenQuotations={() => setCurrentTab('QUOTATIONS')}
            onOpenApprovals={() => setCurrentTab('APPROVALS')}
            onOpenMachines={() => setCurrentTab('MACHINES')}
            onOpenAdminCalendar={() => setCurrentTab('CALENDAR')}
            onOpenStock={() => setCurrentTab('STOCK')}
            onOpenEmployees={() => setCurrentTab('EMPLOYEES')}
            onOpenLocationCalibration={() => setActiveModal('LOCATION_CALIBRATION')}
          />
        ) : currentTab === 'CALENDAR' ? (
          activeUserRole === 'ADMIN' ? (
            <AdminCalendarScreen />
          ) : (
            <AttendanceCalendarScreen
              onRequestCorrection={(date) => {
                setRequestInitialDate(date);
                setRequestInitialMode('MISSED');
                setActiveModal('REQUEST');
              }}
            />
          )
        ) : currentTab === 'APPROVALS' ? (
          <AdminApprovalsScreen />
        ) : currentTab === 'EMPLOYEES' ? (
          <AdminEmployeesScreen />
        ) : currentTab === 'MACHINES' ? (
          <AdminMachinesScreen />
        ) : currentTab === 'STOCK' ? (
          <StockScreen userRole={activeUserRole} />
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

      {/* Role-Aware Bottom Navigation Bar (Always visible across all tabs; hidden only on Scanner modal) */}
      {activeModal === 'NONE' && (
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

            {/* 2. Attendance / Calendar */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('CALENDAR')}
            >
              <Text style={{ fontSize: 20 }}>📅</Text>
              <Text style={[styles.navLabel, currentTab === 'CALENDAR' && styles.navLabelActive]}>
                {activeUserRole === 'ADMIN' ? 'Calendar' : 'Attendance'}
              </Text>
            </TouchableOpacity>

            {/* 3. Center Elevated Action Button (Scan for Employee/Sales; Requests for Admin) */}
            <View style={styles.centerBtnWrapper}>
              <TouchableOpacity
                style={[
                  styles.centerGlowButton,
                  activeUserRole === 'ADMIN' && { backgroundColor: '#0066CC' },
                ]}
                onPress={() => {
                  if (activeUserRole === 'ADMIN') {
                    setCurrentTab('APPROVALS');
                  } else {
                    setActiveModal('SCANNER');
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 26, color: '#FFFFFF' }}>
                  {activeUserRole === 'ADMIN' ? '📝' : '🔲'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4. Stock & Inventory */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('STOCK')}
            >
              <Text style={{ fontSize: 20 }}>📦</Text>
              <Text style={[styles.navLabel, currentTab === 'STOCK' && styles.navLabelActive]}>
                Stock
              </Text>
            </TouchableOpacity>

            {/* 5. Quotations / Requests */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => {
                if (activeUserRole === 'EMPLOYEE') {
                  setRequestInitialMode('TODAY');
                  setActiveModal('REQUEST');
                } else {
                  setCurrentTab('QUOTATIONS');
                }
              }}
            >
              <Text style={{ fontSize: 20 }}>
                {activeUserRole === 'EMPLOYEE' ? '📝' : '📄'}
              </Text>
              <Text style={[styles.navLabel, currentTab === 'QUOTATIONS' && styles.navLabelActive]}>
                {activeUserRole === 'EMPLOYEE' ? 'Requests' : 'Quotations'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Hamburger Drawer Navigation */}
      <AppDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        userRole={activeUserRole}
        userName={activeUserName}
        onNavigate={handleDrawerNavigate}
        onLogout={handleLogout}
      />

      {/* Modals & Overlays */}
      {activeModal === 'SCANNER' && (
        <View style={StyleSheet.absoluteFillObject}>
          <QRScannerScreen
            onClose={() => setActiveModal('NONE')}
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              setActiveModal('NONE');
            }}
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
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              setActiveModal('NONE');
            }}
            initialDate={requestInitialDate}
            initialMode={requestInitialMode}
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
            onEdit={() => setActiveModal('NEW_QUOTE')}
          />
        </View>
      )}

      {activeModal === 'LOCATION_CALIBRATION' && (
        <View style={StyleSheet.absoluteFillObject}>
          <AdminLocationCalibrationScreen
            onClose={() => setActiveModal('NONE')}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
  },
});
