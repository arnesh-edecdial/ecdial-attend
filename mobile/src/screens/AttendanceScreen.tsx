import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { mobileApi, getAuthToken, getActiveEmployeeId } from '../services/api';
import * as Location from 'expo-location';
import { TodayAttendanceStatus } from '../types';
import { DynamicQRCode } from '../components/DynamicQRCode';
import { NotificationCenterModal } from '../components/NotificationCenterModal';
import { downloadAndSaveFile, shareDocument } from '../services/fileDownloader';
import { canSkipAttendance } from '../utils/roles';
import { formatTime12, formatSchedule12 } from '../utils/time';

interface AttendanceScreenProps {
  onOpenDrawer: () => void;
  onOpenScanner: () => void;
  onOpenRequest: (date?: string, mode?: 'TODAY' | 'MISSED' | 'CLOSING') => void;
  onOpenCalendar: () => void;
  onOpenQuotations: () => void;
  onOpenApprovals?: () => void;
  onOpenMachines?: () => void;
  onOpenAdminCalendar?: () => void;
  onOpenStock?: () => void;
  onOpenEmployees?: () => void;
  onOpenCustomers?: () => void;
  onOpenLocationCalibration?: () => void;
  onNavigateNotification?: (screen: string, entityId?: string | null, metadata?: any) => void;
  userName?: string;
  userRole?: string;
}

export const AttendanceScreen: React.FC<AttendanceScreenProps> = ({
  onOpenDrawer,
  onOpenScanner,
  onOpenRequest,
  onOpenCalendar,
  onOpenQuotations,
  onOpenApprovals,
  onOpenMachines,
  onOpenAdminCalendar,
  onOpenStock,
  onOpenEmployees,
  onOpenCustomers,
  onOpenLocationCalibration,
  onNavigateNotification,
  userName = 'Employee',
  userRole = 'EMPLOYEE',
}) => {
  const [statusData, setStatusData] = useState<TodayAttendanceStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [officeQR, setOfficeQR] = useState<any | null>(null);
  const [officeConfig, setOfficeConfig] = useState<any | null>(null);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloadingQR, setIsDownloadingQR] = useState<boolean>(false);
  const [currentMonthName, setCurrentMonthName] = useState<string>('August 2026');

  // In-App Notification Center State
  const [notifModalVisible, setNotifModalVisible] = useState<boolean>(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);

  // Excel Attendance Export State (Admin Only)
  const [isExportingToday, setIsExportingToday] = useState<boolean>(false);
  const [isSharingToday, setIsSharingToday] = useState<boolean>(false);
  const [isExportingMonth, setIsExportingMonth] = useState<boolean>(false);
  const [isSharingMonth, setIsSharingMonth] = useState<boolean>(false);
  const [monthExportModalVisible, setMonthExportModalVisible] = useState<boolean>(false);
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth() + 1);

  // Live Device Coordinates & Geofence Distance
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const d = new Date();
      const [statusRes, dashRes, qrRes, calRes, officeRes, notifRes] = await Promise.all([
        mobileApi.getTodayStatus(),
        canSkipAttendance(userRole) ? mobileApi.getTodayDashboard() : Promise.resolve(null),
        canSkipAttendance(userRole) ? mobileApi.getTodayQR() : Promise.resolve(null),
        mobileApi.getCalendar(undefined, d.getFullYear(), d.getMonth() + 1),
        mobileApi.getOfficeConfig().catch(() => null),
        mobileApi.listNotifications().catch(() => null),
      ]);

      if (statusRes && statusRes.success) setStatusData(statusRes.data);
      if (dashRes && dashRes.success) setDashboardData(dashRes.data);
      if (qrRes && qrRes.success) setOfficeQR(qrRes.data);
      if (calRes && calRes.success) setCalendarDays(calRes.data.days);
      if (officeRes && officeRes.success && officeRes.data) setOfficeConfig(officeRes.data);
      if (notifRes && notifRes.success && notifRes.data) {
        setUnreadNotifsCount(notifRes.data.unreadCount || 0);
      }

      // Check device GPS location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = (await Location.getLastKnownPositionAsync()) ||
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
          if (loc && loc.coords) {
            setDeviceCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
          }
        }
      } catch (locErr) {
        console.log('[Attendance GPS Check]', locErr);
      }
    } catch (err) {
      console.error('Failed to load status', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [isSharingQR, setIsSharingQR] = useState<boolean>(false);

  const handleDownloadOfficeQR = async () => {
    setIsDownloadingQR(true);
    try {
      const qrImageUrl = mobileApi.getOfficeQrImageUrl();
      const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const localFileUri = `${docDir}ECDIAL_Office_Attendance_QR.png`;

      let result = await FileSystem.downloadAsync(qrImageUrl, localFileUri).catch(() => null);
      if (!result || result.status !== 200) {
        const qrValue = officeQR?.token || 'ECDIAL_OFFICE_ATTENDANCE_QR_HQ_COIMBATORE';
        const fallbackUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrValue)}&size=600&caption=${encodeURIComponent('ECDIAL - Official Attendance QR')}&margin=2`;
        result = await FileSystem.downloadAsync(fallbackUrl, localFileUri);
      }

      if (result && result.status === 200 && result.uri) {
        const info = await FileSystem.getInfoAsync(result.uri);
        if (info.exists && typeof (info as any).size === 'number' && (info as any).size > 100) {
          Alert.alert('✓ QR Downloaded', 'ECDIAL_Office_Attendance_QR.png saved to device.');
          return;
        }
      }
      Alert.alert('Download Failed', 'Unable to generate QR image. Please try again.');
    } catch (err: any) {
      console.error('[Download QR Error]', err);
      Alert.alert('Error', err.message || 'Failed to download QR image.');
    } finally {
      setIsDownloadingQR(false);
    }
  };

  const handleShareOfficeQR = async () => {
    setIsSharingQR(true);
    try {
      const qrImageUrl = mobileApi.getOfficeQrImageUrl();
      const docDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const localFileUri = `${docDir}ECDIAL_Office_Attendance_QR.png`;

      let result = await FileSystem.downloadAsync(qrImageUrl, localFileUri).catch(() => null);
      if (!result || result.status !== 200) {
        const qrValue = officeQR?.token || 'ECDIAL_OFFICE_ATTENDANCE_QR_HQ_COIMBATORE';
        const fallbackUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrValue)}&size=600&caption=${encodeURIComponent('ECDIAL - Official Attendance QR')}&margin=2`;
        result = await FileSystem.downloadAsync(fallbackUrl, localFileUri);
      }

      if (result && result.status === 200 && result.uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'image/png',
            dialogTitle: 'ECDIAL Office Attendance QR',
            UTI: 'public.png',
          });
        } else {
          Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
        }
      } else {
        Alert.alert('Unable to Share', 'Unable to generate QR image. Please try again.');
      }
    } catch (err: any) {
      console.error('[Share QR Error]', err);
      Alert.alert('Unable to Share QR', 'Please try again.');
    } finally {
      setIsSharingQR(false);
    }
  };

  const handleExportTodayExcel = async () => {
    try {
      setIsExportingToday(true);
      const url = mobileApi.getTodayExportUrl();
      const token = getAuthToken();
      const d = new Date();
      const dateStr = d.toISOString().substring(0, 10);
      const localFilename = `ECDIAL_Attendance_Today_${dateStr}.xlsx`;

      const result = await downloadAndSaveFile({
        url,
        rawFilename: localFilename,
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-employee-id': getActiveEmployeeId(),
        },
        dialogTitle: `Export Today's Attendance (${dateStr})`,
        showShareFallbackOnAndroid: true,
      });

      if (result.success) {
        Alert.alert('✓ Excel Exported', `${result.filename} is downloaded and ready to view.`);
      } else {
        Alert.alert('Export Failed', result.error || 'Unable to download today\'s attendance report.');
      }
    } catch (err: any) {
      console.error('[Export Today Excel]', err);
      Alert.alert('Export Error', err.message || 'Failed to export attendance report.');
    } finally {
      setIsExportingToday(false);
    }
  };

  const handleExportMonthExcel = async (yearNum?: number, monthNum?: number) => {
    try {
      setIsExportingMonth(true);
      const y = yearNum || exportYear;
      const m = monthNum || exportMonth;
      const mStr = String(m).padStart(2, '0');

      const url = mobileApi.getMonthExportUrl(y, m);
      const token = getAuthToken();
      const localFilename = `ECDIAL_Attendance_Month_${y}-${mStr}.xlsx`;

      const result = await downloadAndSaveFile({
        url,
        rawFilename: localFilename,
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-employee-id': getActiveEmployeeId(),
        },
        dialogTitle: `Export Monthly Attendance (${y}-${mStr})`,
        showShareFallbackOnAndroid: true,
      });

      if (result.success) {
        setMonthExportModalVisible(false);
        Alert.alert('✓ Excel Exported', `${result.filename} is downloaded and ready to view.`);
      } else {
        Alert.alert('Export Failed', result.error || 'Unable to download monthly attendance report.');
      }
    } catch (err: any) {
      console.error('[Export Month Excel]', err);
      Alert.alert('Export Error', err.message || 'Failed to export monthly attendance report.');
    } finally {
      setIsExportingMonth(false);
    }
  };

  const handleShareTodayExcel = async () => {
    try {
      setIsSharingToday(true);
      const url = mobileApi.getTodayExportUrl();
      const token = getAuthToken();
      const d = new Date();
      const dateStr = d.toISOString().substring(0, 10);
      const localFilename = `ECDIAL_Attendance_Today_${dateStr}.xlsx`;

      const result = await shareDocument({
        url,
        rawFilename: localFilename,
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-employee-id': getActiveEmployeeId(),
        },
      });

      if (!result.success && result.error) {
        Alert.alert('Share Failed', result.error);
      }
    } catch (err: any) {
      console.error('[Share Today Excel]', err);
      Alert.alert('Share Error', err.message || 'Failed to share attendance report.');
    } finally {
      setIsSharingToday(false);
    }
  };

  const handleShareMonthExcel = async (yearNum?: number, monthNum?: number) => {
    try {
      setIsSharingMonth(true);
      const y = yearNum || exportYear;
      const m = monthNum || exportMonth;
      const mStr = String(m).padStart(2, '0');

      const url = mobileApi.getMonthExportUrl(y, m);
      const token = getAuthToken();
      const localFilename = `ECDIAL_Attendance_Month_${y}-${mStr}.xlsx`;

      const result = await shareDocument({
        url,
        rawFilename: localFilename,
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-employee-id': getActiveEmployeeId(),
        },
      });

      if (result.success) {
        setMonthExportModalVisible(false);
      } else if (result.error) {
        Alert.alert('Share Failed', result.error);
      }
    } catch (err: any) {
      console.error('[Share Month Excel]', err);
      Alert.alert('Share Error', err.message || 'Failed to share monthly attendance report.');
    } finally {
      setIsSharingMonth(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const d = new Date();
    const mNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    setCurrentMonthName(`${mNames[d.getMonth()]} ${d.getFullYear()}`);
  }, [userRole]);

  // Auto-refresh every 60 s while the employee is live (CHECKED_IN).
  // This catches admin-approved closings without requiring a manual pull-to-refresh.
  useEffect(() => {
    if (!statusData?.isCurrentlyWorking) return;
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [statusData?.isCurrentlyWorking]);

  useEffect(() => {
    if (deviceCoords && (officeConfig || statusData?.office)) {
      const officeLat = Number(officeConfig?.latitude || 11.0168);
      const officeLon = Number(officeConfig?.longitude || 76.9558);
      const dist = calculateDistance(deviceCoords.lat, deviceCoords.lon, officeLat, officeLon);
      setLiveDistance(dist);
    }
  }, [deviceCoords, officeConfig, statusData]);

  const allowedRadius = Number(officeConfig?.allowedRadiusMeters || statusData?.office?.allowedRadiusMeters || 200);
  const isOutsidePerimeter = liveDistance !== null && liveDistance > allowedRadius;

  const isCheckedIn = statusData?.displayStatus === 'CHECKED_IN' || statusData?.displayStatus === 'PRESENT';
  const isCompleted = statusData?.displayStatus === 'COMPLETED';
  const isCompanyLeave = statusData?.displayStatus === 'COMPANY_LEAVE';
  const hasActiveRequest = Boolean(statusData && (statusData as any).activeRequest);

  // Timezone-aware local time formatter for Indian Standard Time
  const formatLocalTime = (isoString?: string | null, fallbackFormatted?: string | null): string => {
    if (fallbackFormatted && fallbackFormatted !== '—' && !fallbackFormatted.includes('NaN')) {
      return formatTime12(fallbackFormatted);
    }
    if (!isoString) return '—';
    return formatTime12(isoString);
  };

  const checkInTimeDisplay = formatLocalTime(
    (statusData?.attendance as any)?.checkInTime,
    statusData?.attendance?.checkInFormatted
  );
  const checkOutTimeDisplay = formatLocalTime(
    (statusData?.attendance as any)?.checkOutTime,
    (statusData?.attendance as any)?.checkOutFormatted
  );

  const durationDisplay = statusData?.attendance?.durationFormatted || '00h 00m';
  const rawOtMins: number = (statusData?.attendance as any)?.liveOtMinutes ?? 0;
  const otDisplay = rawOtMins > 0
    ? `${Math.floor(rawOtMins / 60)}h ${String(rawOtMins % 60).padStart(2, '0')}m`
    : '00h 00m';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchStatus} tintColor="#10B981" />}
    >
      {/* 1. TOP HEADER (Responsive & Safe) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          {/* HAMBURGER MENU BUTTON (Rule 5) */}
          <TouchableOpacity
            style={styles.menuIcon}
            onPress={onOpenDrawer}
            activeOpacity={0.7}
          >
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 14 }]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>

          <View style={styles.greetingContainer}>
            <Text style={styles.greetingText}>Good Morning, 👋</Text>
            <Text style={styles.userNameText} numberOfLines={1}>{userName}</Text>
            <Text style={styles.subGreeting}>
              {canSkipAttendance(userRole)
                ? 'Admin Management Dashboard'
                : userRole === 'SALES'
                ? 'Sales & Quotations Portal'
                : 'Have a productive day at work!'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => setNotifModalVisible(true)}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {(unreadNotifsCount > 0 || (canSkipAttendance(userRole) && (dashboardData?.summary?.pending ?? 0) > 0)) && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifsCount > 0 ? unreadNotifsCount : (dashboardData?.summary?.pending ?? 0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User Avatar with Green Online Dot */}
          <TouchableOpacity style={styles.avatarWrapper} onPress={onOpenDrawer}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 18 }}>
                {canSkipAttendance(userRole) ? '👨‍💼' : userRole === 'SALES' ? '👩‍💼' : '👷‍♂️'}
              </Text>
            </View>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* CASE A: ADMIN ROLE VIEW (Today's Stats + Visible Office QR + Employees)    */}
      {/* ========================================================================= */}
      {canSkipAttendance(userRole) && (
        <View style={{ marginBottom: 14 }}>
          {/* 1. TODAY'S ATTENDANCE STATS CARDS (Rule 3) */}
          <View style={styles.adminStatsGrid}>
            <View style={[styles.adminStatCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}>
              <Text style={styles.adminStatNum}>{dashboardData?.summary?.present ?? 0}</Text>
              <Text style={styles.adminStatLabel}>PRESENT</Text>
            </View>

            <View style={[styles.adminStatCard, { borderLeftColor: '#EF4444', borderLeftWidth: 4 }]}>
              <Text style={[styles.adminStatNum, { color: '#EF4444' }]}>{dashboardData?.summary?.absent ?? 0}</Text>
              <Text style={styles.adminStatLabel}>ABSENT</Text>
            </View>

            <View style={[styles.adminStatCard, { borderLeftColor: '#F59E0B', borderLeftWidth: 4 }]}>
              <Text style={[styles.adminStatNum, { color: '#D97706' }]}>{dashboardData?.summary?.notMarked ?? 0}</Text>
              <Text style={styles.adminStatLabel}>NOT MARKED</Text>
            </View>

            <View style={[styles.adminStatCard, { borderLeftColor: '#0284C7', borderLeftWidth: 4 }]}>
              <Text style={[styles.adminStatNum, { color: '#0284C7' }]}>{dashboardData?.summary?.currentlyWorking ?? 0}</Text>
              <Text style={styles.adminStatLabel}>WORKING</Text>
            </View>
          </View>

          {/* 2. GOOGLE PAY STYLE STATIC OFFICE ATTENDANCE QR DISPLAY (REFERENCE 1) */}
          <View style={styles.gpayQrCard}>
            {/* Top Identity Header */}
            <View style={styles.gpayCardHeader}>
              <View style={styles.gpayAvatarCircle}>
                <Text style={{ fontSize: 24 }}>🏢</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gpayOfficeName}>
                  {officeConfig?.officeName || officeQR?.officeName || 'ECDIAL Headquarters'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <View style={styles.activeDot} />
                  <Text style={styles.gpayBadgeText}>Official Attendance QR</Text>
                </View>
              </View>
            </View>

            {/* Large Clean QR Card Box */}
            <View style={styles.gpayQrWrapper}>
              <DynamicQRCode
                value={officeQR?.token || 'ECDIAL_OFFICE_ATTENDANCE_QR_HQ_COIMBATORE'}
                size={220}
              />
            </View>

            {/* Instruction text */}
            <Text style={styles.gpayScanInstruction}>
              Scan to mark attendance with ECDIAL app
            </Text>
            <Text style={styles.gpayPerimeterNote}>
              Valid within {allowedRadius}m office perimeter
            </Text>

            {/* Download & Share Actions Row */}
            <View style={styles.gpayActionRow}>
              <TouchableOpacity
                style={styles.gpayDownloadBtn}
                onPress={handleDownloadOfficeQR}
                disabled={isDownloadingQR}
                activeOpacity={0.85}
              >
                {isDownloadingQR ? (
                  <ActivityIndicator color="#0066CC" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>📥</Text>
                    <Text style={styles.gpayDownloadBtnText}>Download QR</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gpayShareBtn}
                onPress={handleShareOfficeQR}
                disabled={isSharingQR}
                activeOpacity={0.85}
              >
                {isSharingQR ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>📤</Text>
                    <Text style={styles.gpayShareBtnText}>Share QR</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 3. LOCATION & GEOFENCE CALIBRATION ACTION CARD */}
          <TouchableOpacity
            style={styles.adminCalibCard}
            onPress={onOpenLocationCalibration}
            activeOpacity={0.88}
          >
            <View style={styles.calibIconWrapper}>
              <Text style={{ fontSize: 22 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.calibTitle}>Office Geofence & Location</Text>
              <Text style={styles.calibSubtitle}>
                Perimeter: {allowedRadius}m • {officeConfig?.officeName || 'ECDIAL Headquarters'}
              </Text>
            </View>
            <View style={styles.calibActionBtn}>
              <Text style={styles.calibActionText}>Calibrate ›</Text>
            </View>
          </TouchableOpacity>

          {/* 4. TODAY'S EMPLOYEE ATTENDANCE LIST (Rule 4, 5) */}
          <View style={styles.employeeListCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.sectionHeaderTitle}>Today's Employees</Text>
                <Text style={styles.employeeCountText}>
                  {dashboardData?.employees?.length || 0} Total
                </Text>
              </View>
              <TouchableOpacity
                style={styles.exportTodaySmallBtn}
                onPress={handleExportTodayExcel}
                disabled={isExportingToday}
                activeOpacity={0.8}
              >
                {isExportingToday ? (
                  <ActivityIndicator size="small" color="#0066CC" />
                ) : (
                  <Text style={styles.exportTodaySmallBtnText}>📊 Export (Excel)</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.employeeList}>
              {!dashboardData?.employees || dashboardData.employees.length === 0 ? (
                <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>No attendance records recorded yet today.</Text>
                </View>
              ) : (
                dashboardData.employees.map((emp: any) => (
                  <View key={emp.id} style={styles.empRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empName}>{emp.name}</Text>
                      <Text style={styles.empRole}>{emp.role} • {emp.schedule || '09:00 - 18:00'}</Text>
                    </View>
                    <View style={[styles.empBadge, emp.status === 'PRESENT' || emp.status === 'COMPLETED' ? styles.empBadgeGreen : emp.status === 'ABSENT' ? styles.empBadgeRed : styles.empBadgeGray]}>
                      <Text style={[styles.empBadgeText, emp.status === 'PRESENT' || emp.status === 'COMPLETED' ? styles.empTextGreen : emp.status === 'ABSENT' ? styles.empTextRed : styles.empTextGray]}>
                        {emp.statusBadge || emp.status}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* 5. EXCEL ATTENDANCE EXPORTS (ADMIN ONLY) */}
          <View style={styles.exportSectionCard}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.exportIconCircle}>
                  <Text style={{ fontSize: 18 }}>📊</Text>
                </View>
                <View>
                  <Text style={styles.exportSectionTitle}>Attendance Excel Exports</Text>
                  <Text style={styles.exportSectionSubtitle}>Official spreadsheet reports (.xlsx)</Text>
                </View>
              </View>
            </View>
            {/* Today's Attendance Export Card with Download & Share Options */}
            <View style={styles.dailyExportBox}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.exportItemTitle}>Today's Attendance</Text>
                <Text style={styles.exportItemSubtitle}>Daily breakdown with logins & hours</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={styles.exportMiniBtnPrimary}
                  onPress={handleExportTodayExcel}
                  disabled={isExportingToday || isSharingToday}
                  activeOpacity={0.85}
                >
                  {isExportingToday ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.exportMiniBtnText}>📥 Download</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.exportMiniBtnShare}
                  onPress={handleShareTodayExcel}
                  disabled={isExportingToday || isSharingToday}
                  activeOpacity={0.85}
                >
                  {isSharingToday ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.exportMiniBtnText}>📤 Share</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Monthly Attendance Card */}
            <View style={[styles.dailyExportBox, { marginTop: 10, backgroundColor: '#F8FAFC' }]}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.exportItemTitleSec}>Monthly Attendance (.xlsx)</Text>
                <Text style={styles.exportItemSubtitle}>Summary & individual logs with overtime</Text>
              </View>
              <TouchableOpacity
                style={styles.exportMiniBtnMonth}
                onPress={() => setMonthExportModalVisible(true)}
                disabled={isExportingMonth || isSharingMonth}
                activeOpacity={0.85}
              >
                <Text style={styles.exportMiniBtnMonthText}>📅 Select & Export</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 6. ADMIN QUICK ACTIONS (Rule 27) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Management</Text>
          </View>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={onOpenEmployees}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Text style={{ fontSize: 20 }}>👥</Text>
              </View>
              <Text style={styles.actionCardTitle}>Employees</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={onOpenApprovals}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={{ fontSize: 20 }}>📝</Text>
              </View>
              <Text style={styles.actionCardTitle}>Requests</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={onOpenAdminCalendar}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#E0F2FE' }]}>
                <Text style={{ fontSize: 20 }}>📅</Text>
              </View>
              <Text style={styles.actionCardTitle}>Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={onOpenStock}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#F1F5F9' }]}>
                <Text style={{ fontSize: 20 }}>📦</Text>
              </View>
              <Text style={styles.actionCardTitle}>Stock</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={onOpenMachines}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Text style={{ fontSize: 20 }}>❄️</Text>
              </View>
              <Text style={styles.actionCardTitle}>Machines</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={onOpenCustomers}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#FEF2F2' }]}>
                <Text style={{ fontSize: 20 }}>🏢</Text>
              </View>
              <Text style={styles.actionCardTitle}>Customers</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={onOpenQuotations}>
              <View style={[styles.actionIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 20 }}>📄</Text>
              </View>
              <Text style={styles.actionCardTitle}>Quotations</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* CASE B: EMPLOYEE & SALES VIEW (Hero Card + Scan Action + Stock/Quotes)    */}
      {/* ========================================================================= */}
      {!canSkipAttendance(userRole) && (
        <View>
          {/* COMPANY LEAVE NOTICE */}
          {isCompanyLeave && (
            <View style={styles.companyLeaveBanner}>
              <Text style={{ fontSize: 22 }}>🏢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.companyLeaveTitle}>Company Leave Day</Text>
                <Text style={styles.companyLeaveSub}>
                  Today is a company leave day. Normal attendance check-in is not required.
                </Text>
              </View>
            </View>
          )}

          {/* LOGGED IN AT BANNER (Prominently shows employee logged in time) */}
          {(isCheckedIn || isCompleted) && (
            <View style={styles.loggedInBanner}>
              <View style={styles.loggedInIconCircle}>
                <Text style={{ fontSize: 18 }}>⏱️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.loggedInBannerTitle}>
                  {isCheckedIn ? 'Currently Logged In' : 'Shift Completed Today'}
                </Text>
                <Text style={styles.loggedInBannerSub}>
                  Logged in at <Text style={{ fontWeight: '800', color: '#0F172A' }}>{checkInTimeDisplay}</Text>
                  {isCompleted && checkOutTimeDisplay !== '—' ? ` • Closed at ${checkOutTimeDisplay}` : ''}
                </Text>
              </View>
              <View style={[styles.loggedInStatusTag, isCheckedIn ? styles.tagActive : styles.tagDone]}>
                <View style={[styles.tagDot, isCheckedIn ? styles.tagDotActive : styles.tagDotDone]} />
                <Text style={[styles.tagText, isCheckedIn ? styles.tagTextActive : styles.tagTextDone]}>
                  {isCheckedIn ? 'ONLINE' : 'CLOSED'}
                </Text>
              </View>
            </View>
          )}

          {/* HERO ATTENDANCE CARD */}
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.ringWrapper}>
                <View style={[styles.statusRing, isCheckedIn ? styles.ringGreen : styles.ringGray]}>
                  <View style={styles.ringInner}>
                    <Text style={[styles.checkmarkIcon, { color: isCheckedIn ? '#10B981' : '#94A3B8' }]}>
                      {isCheckedIn ? '✓' : isCompanyLeave ? '🏢' : '⏱'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.statusDetails}>
                <Text style={styles.attendanceLabel}>TODAY'S ATTENDANCE</Text>
                <Text style={[styles.statusTitle, { color: isCheckedIn ? '#059669' : isCompanyLeave ? '#0284C7' : '#DC2626' }]}>
                  {isCheckedIn ? 'Checked In' : isCompleted ? 'Completed' : isCompanyLeave ? 'Company Leave' : hasActiveRequest ? 'Under Approval' : 'Not Marked'}
                </Text>
                <View style={[styles.workingPill, isCompanyLeave && { backgroundColor: '#E0F2FE' }]}>
                  <View style={[styles.workingDot, isCompanyLeave && { backgroundColor: '#0284C7' }]} />
                  <Text style={[styles.workingText, isCompanyLeave && { color: '#0369A1' }]}>
                    {isCheckedIn ? 'Working' : isCompleted ? 'Shift Ended' : isCompanyLeave ? 'Holiday' : hasActiveRequest ? 'Pending Admin' : 'Pending'}
                  </Text>
                </View>
              </View>

              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>
                  {isCompleted ? 'Check In / Out' : 'Check In Time'}
                </Text>
                <Text style={styles.timeValue}>
                  {isCheckedIn || isCompleted ? checkInTimeDisplay : '--:--'}
                </Text>
                {isCompleted && checkOutTimeDisplay && checkOutTimeDisplay !== '—' && (
                  <Text style={[styles.timeValue, { fontSize: 13, color: '#059669', marginTop: 2 }]}>
                    → {checkOutTimeDisplay}
                  </Text>
                )}
                <Text style={styles.dateSubText}>{statusData?.date || 'Aug 20, 2026'}</Text>
              </View>
            </View>

            {/* 3 Stat Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <View style={styles.statTop}>
                  <View style={[styles.statIconBg, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={{ fontSize: 13 }}>🕒</Text>
                  </View>
                  <View>
                    <Text style={styles.statLabel}>Working For</Text>
                    <Text style={[styles.statVal, { color: '#0284C7' }]}>{durationDisplay}</Text>
                  </View>
                </View>
                <View style={[styles.accentBar, { backgroundColor: '#0284C7' }]} />
              </View>

              <View style={styles.statPill}>
                <View style={styles.statTop}>
                  <View style={[styles.statIconBg, { backgroundColor: '#FAF5FF' }]}>
                    <Text style={{ fontSize: 13 }}>⏱️</Text>
                  </View>
                  <View>
                    <Text style={styles.statLabel}>Overtime</Text>
                    <Text style={[styles.statVal, { color: '#8B5CF6' }]}>{otDisplay}</Text>
                  </View>
                </View>
                <View style={[styles.accentBar, { backgroundColor: '#8B5CF6' }]} />
              </View>

              <View style={styles.statPill}>
                <View style={styles.statTop}>
                  <View style={[styles.statIconBg, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={{ fontSize: 13 }}>📅</Text>
                  </View>
                  <View>
                    <Text style={styles.statLabel}>Work Schedule</Text>
                    <Text style={[styles.statVal, { color: '#D97706', fontSize: 10.5 }]}>
                      {statusData?.schedule ? formatSchedule12(`${statusData.schedule.startTime} - ${statusData.schedule.endTime}`) : '09:00 AM - 06:00 PM'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.accentBar, { backgroundColor: '#F59E0B' }]} />
              </View>
            </View>
          </View>

          {/* LIVE GEOFENCE PERIMETER BADGE */}
          {liveDistance !== null && !isCompanyLeave && (
            <View
              style={[
                styles.perimeterStatusCard,
                {
                  backgroundColor: isOutsidePerimeter ? '#FEF2F2' : '#ECFDF5',
                  borderColor: isOutsidePerimeter ? '#FECACA' : '#A7F3D0',
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{isOutsidePerimeter ? '⚠️' : '📍'}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.perimeterStatusTitle,
                    { color: isOutsidePerimeter ? '#B91C1C' : '#065F46' },
                  ]}
                >
                  {isOutsidePerimeter
                    ? `Outside Office Perimeter (${liveDistance}m away)`
                    : `Within Office Perimeter (${liveDistance}m away)`}
                </Text>
                <Text style={styles.perimeterStatusSub}>
                  {isOutsidePerimeter
                    ? `You are outside the ${allowedRadius}m allowed perimeter for ${officeConfig?.officeName || statusData?.office?.officeName || 'ECDIAL Office'}. QR scan is disabled.`
                    : `QR scan is available within the allowed ${allowedRadius}m office boundary.`}
                </Text>
              </View>
            </View>
          )}

          {/* MAIN QR SCAN BANNER */}
          {!isCompanyLeave ? (
            <TouchableOpacity
              style={[
                styles.scanBanner,
                isOutsidePerimeter && styles.scanBannerOutside,
              ]}
              onPress={() => {
                if (isOutsidePerimeter) {
                  Alert.alert(
                    '📍 Outside Office Perimeter',
                    `You are ${liveDistance}m away from the office (${allowedRadius}m allowed).\n\nQR attendance check-in is not permitted from outside the office. Please submit an attendance request instead.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Request Attendance',
                        onPress: () => onOpenRequest(undefined, isCheckedIn ? 'CLOSING' : 'TODAY'),
                      },
                    ]
                  );
                } else {
                  onOpenScanner();
                }
              }}
              activeOpacity={0.88}
            >
              <View style={[styles.scanIconBox, isOutsidePerimeter && { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Text style={{ fontSize: 24 }}>{isOutsidePerimeter ? '🔒' : '🔲'}</Text>
              </View>

              <View style={styles.scanBannerText}>
                <Text style={styles.scanBannerTitle}>
                  {isOutsidePerimeter
                    ? 'QR Scan Disabled (Outside Office)'
                    : isCheckedIn
                    ? 'Scan QR to Check Out'
                    : 'Scan QR to Check In'}
                </Text>
                <Text style={styles.scanBannerSub}>
                  {isOutsidePerimeter
                    ? `Must be within ${allowedRadius}m to scan QR`
                    : isCheckedIn
                    ? 'Scan office QR code to end your day'
                    : 'Scan office QR code to start your day'}
                </Text>
              </View>

              <View style={styles.chevronBox}>
                <Text style={styles.chevronText}>›</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.scanBanner, { backgroundColor: '#1E293B' }]}>
              <Text style={{ fontSize: 24, marginRight: 12 }}>🏢</Text>
              <View style={styles.scanBannerText}>
                <Text style={styles.scanBannerTitle}>Company Leave</Text>
                <Text style={styles.scanBannerSub}>QR Attendance is not required today.</Text>
              </View>
            </View>
          )}

          {/* QUICK SHORTCUTS FOR SALES (Rules 28) */}
          {userRole === 'SALES' && (
            <View style={styles.salesShortcutsRow}>
              <TouchableOpacity
                style={[styles.salesActionCard, { backgroundColor: '#0066CC' }]}
                onPress={onOpenQuotations}
              >
                <Text style={{ fontSize: 18, color: '#FFFFFF' }}>➕</Text>
                <Text style={styles.salesActionCardText}>Create Quotation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.salesActionCard, { backgroundColor: '#0A1E3F' }]}
                onPress={onOpenStock}
              >
                <Text style={{ fontSize: 18, color: '#FFFFFF' }}>📦</Text>
                <Text style={styles.salesActionCardText}>View Stock</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* REQUEST ATTENDANCE BUTTON */}
          <TouchableOpacity
            style={[
              styles.requestButtonMain,
              isOutsidePerimeter && styles.requestButtonProminent,
              hasActiveRequest && styles.requestButtonDisabled,
            ]}
            onPress={() => onOpenRequest(undefined, isCheckedIn ? 'CLOSING' : 'TODAY')}
            disabled={hasActiveRequest}
          >
            <Text style={[styles.requestButtonText, isOutsidePerimeter && { color: '#FFFFFF' }]}>
              {hasActiveRequest
                ? 'UNDER APPROVAL'
                : isOutsidePerimeter
                ? '📝 Submit Attendance / Remote Request'
                : isCheckedIn
                ? 'Request Closing / Offsite'
                : 'Request Attendance'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* MONTHLY EXCEL EXPORT MODAL (ADMIN ONLY) */}
      <Modal
        visible={monthExportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.monthModalCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.monthModalTitle}>Export Monthly Attendance</Text>
                <Text style={styles.monthModalSubtitle}>Download overall month spreadsheet (.xlsx)</Text>
              </View>
              <TouchableOpacity onPress={() => setMonthExportModalVisible(false)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Year Selector */}
            <View style={styles.yearSelectorRow}>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setExportYear((y) => y - 1)}
              >
                <Text style={styles.yearBtnText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.yearDisplay}>{exportYear}</Text>
              <TouchableOpacity
                style={styles.yearBtn}
                onPress={() => setExportYear((y) => y + 1)}
              >
                <Text style={styles.yearBtnText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Month Grid */}
            <View style={styles.monthGrid}>
              {[
                'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
              ].map((mName, idx) => {
                const mNum = idx + 1;
                const isSelected = exportMonth === mNum;
                return (
                  <TouchableOpacity
                    key={mName}
                    style={[styles.monthChip, isSelected && styles.monthChipSelected]}
                    onPress={() => setExportMonth(mNum)}
                  >
                    <Text style={[styles.monthChipText, isSelected && styles.monthChipTextSelected]}>
                      {mName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Export Action Buttons: Download & Share */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalExportBtn, { flex: 1 }]}
                onPress={() => handleExportMonthExcel(exportYear, exportMonth)}
                disabled={isExportingMonth || isSharingMonth}
              >
                {isExportingMonth ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalExportBtnText}>📥 Download</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalExportBtn, { flex: 1, backgroundColor: '#0284C7' }]}
                onPress={() => handleShareMonthExcel(exportYear, exportMonth)}
                disabled={isExportingMonth || isSharingMonth}
              >
                {isSharingMonth ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalExportBtnText}>📤 Share</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* In-App Notification Center Modal */}
      <NotificationCenterModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        onUnreadCountChange={setUnreadNotifsCount}
        onNavigateToScreen={(screen, entityId, metadata) => {
          setNotifModalVisible(false);
          if (onNavigateNotification) {
            onNavigateNotification(screen, entityId, metadata);
          } else {
            if (screen === 'ADMIN_APPROVALS') {
              onOpenApprovals?.();
            } else if (screen === 'ATTENDANCE_REQUEST') {
              onOpenRequest?.(metadata?.date, metadata?.mode || 'MISSED');
            } else if (screen === 'QUOTATION_PREVIEW' || screen === 'QUOTATION') {
              onOpenQuotations?.();
            } else if (screen === 'STOCK') {
              onOpenStock?.();
            } else if (screen === 'CUSTOMERS') {
              onOpenCustomers?.();
            } else if (screen === 'CALENDAR') {
              onOpenCalendar?.();
            }
          }
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 6,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuLine: {
    width: 18,
    height: 2.5,
    backgroundColor: '#0F172A',
    borderRadius: 2,
  },
  greetingContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: -2,
  },
  subGreeting: {
    fontSize: 10.5,
    color: '#64748B',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  adminStatsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  adminStatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  adminStatNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
  adminStatLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  gpayQrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  gpayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  gpayAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  gpayOfficeName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  gpayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  gpayQrWrapper: {
    marginVertical: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpayScanInstruction: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  gpayPerimeterNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 16,
  },
  gpayActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  gpayDownloadBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  gpayDownloadBtnText: {
    color: '#0066CC',
    fontSize: 13,
    fontWeight: '800',
  },
  gpayShareBtn: {
    flex: 1,
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066CC',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  gpayShareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  employeeListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  employeeCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  employeeList: {
    marginTop: 10,
    gap: 8,
  },
  empRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  empName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  empRole: {
    fontSize: 10.5,
    color: '#64748B',
  },
  empBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  empBadgeGreen: { backgroundColor: '#ECFDF5' },
  empBadgeRed: { backgroundColor: '#FEF2F2' },
  empBadgeGray: { backgroundColor: '#F1F5F9' },
  empBadgeText: { fontSize: 10.5, fontWeight: '700' },
  empTextGreen: { color: '#059669' },
  empTextRed: { color: '#DC2626' },
  empTextGray: { color: '#64748B' },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  ringWrapper: {
    marginRight: 10,
  },
  statusRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringGreen: {
    borderWidth: 4,
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  ringGray: {
    borderWidth: 4,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  ringInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkIcon: {
    fontSize: 22,
    fontWeight: '900',
  },
  statusDetails: {
    flex: 1,
  },
  attendanceLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  workingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  workingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  workingText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  timeBlock: {
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  dateSubText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    justifyContent: 'space-between',
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statIconBg: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 8.5,
    color: '#64748B',
  },
  statVal: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  accentBar: {
    height: 3,
    borderRadius: 2,
    width: '100%',
  },
  loggedInBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  loggedInIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loggedInBannerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loggedInBannerSub: {
    fontSize: 13,
    color: '#334155',
    marginTop: 1,
  },
  loggedInStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagActive: {
    backgroundColor: '#DCFCE7',
  },
  tagDone: {
    backgroundColor: '#F1F5F9',
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagDotActive: {
    backgroundColor: '#16A34A',
  },
  tagDotDone: {
    backgroundColor: '#64748B',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tagTextActive: {
    color: '#16A34A',
  },
  tagTextDone: {
    color: '#64748B',
  },
  scanBanner: {
    backgroundColor: '#0F1E36',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  scanIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scanBannerText: {
    flex: 1,
  },
  scanBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scanBannerSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  salesShortcutsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  salesActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  salesActionCardText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  requestButtonMain: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  requestButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  companyLeaveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  companyLeaveTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  companyLeaveSub: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  actionCard: {
    flex: 1,
    minWidth: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCardTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  arrowBtn: {
    paddingHorizontal: 4,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748B',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayBoxPresent: { backgroundColor: '#ECFDF5' },
  dayBoxAbsent: { backgroundColor: '#FEF2F2' },
  dayBoxHalf: { backgroundColor: '#FFFBEB' },
  dayBoxToday: { backgroundColor: '#10B981' },
  dayNumText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  dayNumPresent: { color: '#059669' },
  dayNumAbsent: { color: '#DC2626' },
  dayNumHalf: { color: '#D97706' },
  dayNumToday: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  todaySubText: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: -2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminCalibCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  calibIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  calibTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  calibSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  calibActionBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  calibActionText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  perimeterStatusCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perimeterStatusTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  perimeterStatusSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  scanBannerOutside: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  requestButtonProminent: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
    shadowColor: '#0066CC',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  exportTodaySmallBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  exportTodaySmallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
  },
  exportSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  exportIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  exportSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  exportSectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dailyExportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  exportItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066CC',
  },
  exportItemTitleSec: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  exportItemSubtitle: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  exportMiniBtnPrimary: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportMiniBtnShare: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportMiniBtnMonth: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportMiniBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  exportMiniBtnMonthText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  exportActionBtnPrimary: {
    flex: 1,
    backgroundColor: '#0066CC',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportActionBtnSecondary: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportActionBtnTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  exportActionBtnSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    marginTop: 2,
  },
  exportActionBtnTitleSec: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  exportActionBtnSubSec: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  monthModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  monthModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  monthModalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  yearSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    gap: 16,
  },
  yearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearBtnText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  yearDisplay: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0066CC',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthChip: {
    width: '22%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  monthChipSelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  monthChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  monthChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalExportBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalExportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
