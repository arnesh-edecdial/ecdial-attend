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
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { AttendanceScreen } from './src/screens/AttendanceScreen';
import { QRScannerScreen } from './src/screens/QRScannerScreen';
import { AttendanceRequestScreen } from './src/screens/AttendanceRequestScreen';
import { AttendanceCalendarScreen } from './src/screens/AttendanceCalendarScreen';
import { AdminCalendarScreen } from './src/screens/AdminCalendarScreen';
import { AdminMachinesScreen } from './src/screens/AdminMachinesScreen';
import { AdminApprovalsScreen } from './src/screens/AdminApprovalsScreen';
import { StockScreen } from './src/screens/StockScreen';
import { CustomerScreen } from './src/screens/CustomerScreen';
import { QuotationListScreen } from './src/screens/QuotationListScreen';
import { QuotationCreateScreen } from './src/screens/QuotationCreateScreen';
import { QuotationPreviewScreen } from './src/screens/QuotationPreviewScreen';
import { AdminEmployeesScreen } from './src/screens/AdminEmployeesScreen';
import { AdminLocationCalibrationScreen } from './src/screens/AdminLocationCalibrationScreen';
import { AppDrawer } from './src/components/AppDrawer';
import { setActiveEmployeeId, setAuthToken } from './src/services/api';
import { Quotation } from './src/types';
import { notificationService, DeepLinkPayload } from './src/services/notificationService';

function MainApp() {
  const insets = useSafeAreaInsets();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<
    'HOME' | 'CALENDAR' | 'APPROVALS' | 'EMPLOYEES' | 'MACHINES' | 'STOCK' | 'QUOTATIONS' | 'CUSTOMERS'
  >('HOME');
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'SCANNER' | 'REQUEST' | 'NEW_QUOTE' | 'PREVIEW_QUOTE' | 'LOCATION_CALIBRATION' | 'CUSTOMERS_MODAL'
  >('NONE');

  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [requestInitialDate, setRequestInitialDate] = useState<string | undefined>();
  const [requestInitialMode, setRequestInitialMode] = useState<'TODAY' | 'MISSED' | 'CLOSING'>('TODAY');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<'ADMIN' | 'SALES' | 'EMPLOYEE'>('ADMIN');
  const [activeUserName, setActiveUserName] = useState<string>('Arun Kumar');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Deep Link Navigation Handler
  const handleDeepLink = (payload: DeepLinkPayload | string, entityId?: string | null, metadata?: any) => {
    let screen = typeof payload === 'string' ? payload : payload.targetScreen || '';
    let id = typeof payload === 'string' ? entityId : payload.entityId;
    let meta = typeof payload === 'string' ? metadata : payload.metadata;

    setDrawerVisible(false);
    setActiveModal('NONE');

    if (screen === 'ADMIN_APPROVALS' || screen === 'APPROVALS') {
      setCurrentTab('APPROVALS');
    } else if (screen === 'ATTENDANCE_REQUEST' || screen === 'REQUEST') {
      if (meta?.date) setRequestInitialDate(meta.date);
      if (meta?.mode) setRequestInitialMode(meta.mode);
      setActiveModal('REQUEST');
    } else if (screen === 'QUOTATION_PREVIEW' || screen === 'QUOTATIONS') {
      setCurrentTab('QUOTATIONS');
    } else if (screen === 'STOCK') {
      setCurrentTab('STOCK');
    } else if (screen === 'CUSTOMERS') {
      setCurrentTab('CUSTOMERS');
    } else if (screen === 'CALENDAR') {
      setCurrentTab('CALENDAR');
    } else {
      setCurrentTab('HOME');
    }
  };

  // Setup Notification Listeners
  useEffect(() => {
    notificationService.setNavigationHandler(handleDeepLink);
    const cleanup = notificationService.setupNotificationListeners();
    return () => cleanup();
  }, [isAuthenticated]);

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

    // Register Device for Push Notifications
    notificationService.registerForPushNotifications().catch((e) => console.warn(e));
  };

  const handleLogout = () => {
    notificationService.unregister().catch((e) => console.warn(e));
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
    } else if (screenId === 'CUSTOMERS') {
      setCurrentTab('CUSTOMERS');
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
            onOpenCustomers={() => setCurrentTab('CUSTOMERS')}
            onOpenLocationCalibration={() => setActiveModal('LOCATION_CALIBRATION')}
            onNavigateNotification={handleDeepLink}
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
        ) : currentTab === 'CUSTOMERS' ? (
          <CustomerScreen
            userRole={activeUserRole}
            onClose={() => setCurrentTab('HOME')}
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

      {/* Production-Grade Role-Aware Bottom Navigation Bar */}
      {activeModal === 'NONE' && (
        <View
          style={[
            styles.bottomNavContainer,
            {
              paddingBottom: Math.max(insets.bottom, 8),
              backgroundColor: '#FFFFFF',
            },
          ]}
        >
          <View style={styles.bottomNavBar}>
            {/* 1. Home */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('HOME')}
              activeOpacity={0.7}
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
              activeOpacity={0.7}
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
                  activeUserRole === 'ADMIN' && { backgroundColor: '#0066CC', shadowColor: '#0066CC' },
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
                <Text style={{ fontSize: 24, color: '#FFFFFF' }}>
                  {activeUserRole === 'ADMIN' ? '📝' : '🔲'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4. Stock & Inventory */}
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setCurrentTab('STOCK')}
              activeOpacity={0.7}
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
              activeOpacity={0.7}
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
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  bottomNavBar: {
    flexDirection: 'row',
    height: 58,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0066CC',
    fontWeight: '800',
  },
  centerBtnWrapper: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  centerGlowButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
  },
});
