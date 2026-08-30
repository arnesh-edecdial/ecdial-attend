import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { mobileApi } from '../services/api';
import { TodayAttendanceStatus } from '../types';
import { DynamicQRCode } from '../components/DynamicQRCode';

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
  userName?: string;
  userRole?: 'ADMIN' | 'SALES' | 'EMPLOYEE';
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
  userName = 'Employee',
  userRole = 'EMPLOYEE',
}) => {
  const [statusData, setStatusData] = useState<TodayAttendanceStatus | null>(null);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [officeQR, setOfficeQR] = useState<any | null>(null);
  const [calendarDays, setCalendarDays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentMonthName, setCurrentMonthName] = useState<string>('August 2026');

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const d = new Date();
      const [statusRes, dashRes, qrRes, calRes] = await Promise.all([
        mobileApi.getTodayStatus(),
        userRole === 'ADMIN' ? mobileApi.getTodayDashboard() : Promise.resolve(null),
        userRole === 'ADMIN' ? mobileApi.getTodayQR() : Promise.resolve(null),
        mobileApi.getCalendar(undefined, d.getFullYear(), d.getMonth() + 1),
      ]);

      if (statusRes && statusRes.success) setStatusData(statusRes.data);
      if (dashRes && dashRes.success) setDashboardData(dashRes.data);
      if (qrRes && qrRes.success) setOfficeQR(qrRes.data);
      if (calRes && calRes.success) setCalendarDays(calRes.data.days);
    } catch (err) {
      console.error('Failed to load status', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const d = new Date();
    const mNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    setCurrentMonthName(`${mNames[d.getMonth()]} ${d.getFullYear()}`);
  }, [userRole]);

  const isCheckedIn = statusData?.displayStatus === 'CHECKED_IN' || statusData?.displayStatus === 'PRESENT';
  const isCompleted = statusData?.displayStatus === 'COMPLETED';
  const isCompanyLeave = statusData?.displayStatus === 'COMPANY_LEAVE';
  const hasActiveRequest = Boolean(statusData && (statusData as any).activeRequest);

  const checkInTimeDisplay = statusData?.attendance?.checkInFormatted || '—';
  const durationDisplay = statusData?.attendance?.durationFormatted || '00h 00m';
  const otDisplay = statusData?.attendance?.otMinutes
    ? `${Math.floor(statusData.attendance.otMinutes / 60)}h ${statusData.attendance.otMinutes % 60}m`
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
              {userRole === 'ADMIN'
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
            onPress={userRole === 'ADMIN' ? onOpenApprovals : onOpenCalendar}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {userRole === 'ADMIN' && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {dashboardData?.summary?.pending ?? 0}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User Avatar with Green Online Dot */}
          <TouchableOpacity style={styles.avatarWrapper} onPress={onOpenDrawer}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 18 }}>
                {userRole === 'ADMIN' ? '👨‍💼' : userRole === 'SALES' ? '👩‍💼' : '👷‍♂️'}
              </Text>
            </View>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* CASE A: ADMIN ROLE VIEW (Today's Stats + Visible Office QR + Employees)    */}
      {/* ========================================================================= */}
      {userRole === 'ADMIN' && (
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

          {/* 2. OFFICE ATTENDANCE QR DISPLAY (Rules 8, 9, 10 — VISIBLE & SCANNABLE) */}
          <View style={styles.adminQrCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.qrCardTitle}>OFFICE ATTENDANCE</Text>
                <View style={styles.activeQrPill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeQrPillText}>ACTIVE QR CODE</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.regenBtn} onPress={fetchStatus}>
                <Text style={styles.regenBtnText}>⚡ Regenerate</Text>
              </TouchableOpacity>
            </View>

            {/* Rendered Scannable Vector QR Code */}
            <View style={styles.qrVisualContainer}>
              <DynamicQRCode
                value={officeQR?.token || 'ECDIAL-OFFICE-ATTENDANCE-ACTIVE-SESSION'}
                size={160}
              />
            </View>

            <Text style={styles.qrHelperText}>
              📱 Employees scan this QR code on arrival & departure
            </Text>
            <Text style={styles.qrOfficeLabel}>
              {officeQR?.officeName || 'ECDIAL Headquarters'} • Radius: 100m • Rotates 30s
            </Text>
          </View>

          {/* 3. TODAY'S EMPLOYEE ATTENDANCE LIST (Rule 4, 5) */}
          <View style={styles.employeeListCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionHeaderTitle}>Today's Employees</Text>
              <Text style={styles.employeeCountText}>
                {dashboardData?.employees?.length || 0} Total
              </Text>
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

          {/* 4. ADMIN QUICK ACTIONS (Rule 27) */}
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
      {userRole !== 'ADMIN' && (
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
                <Text style={styles.timeLabel}>Check In Time</Text>
                <Text style={styles.timeValue}>{isCheckedIn ? checkInTimeDisplay : '--:--'}</Text>
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
                      {statusData?.schedule ? `${statusData.schedule.startTime} - ${statusData.schedule.endTime}` : '09:00 - 18:00'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.accentBar, { backgroundColor: '#F59E0B' }]} />
              </View>
            </View>
          </View>

          {/* MAIN QR SCAN BANNER */}
          {!isCompanyLeave ? (
            <TouchableOpacity style={styles.scanBanner} onPress={onOpenScanner} activeOpacity={0.88}>
              <View style={styles.scanIconBox}>
                <Text style={{ fontSize: 24 }}>🔲</Text>
              </View>

              <View style={styles.scanBannerText}>
                <Text style={styles.scanBannerTitle}>
                  {isCheckedIn ? 'Scan QR to Check Out' : 'Scan QR to Check In'}
                </Text>
                <Text style={styles.scanBannerSub}>
                  {isCheckedIn ? 'Scan office QR code to end your day' : 'Scan office QR code to start your day'}
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
              hasActiveRequest && styles.requestButtonDisabled,
            ]}
            onPress={() => onOpenRequest(undefined, isCheckedIn ? 'CLOSING' : 'TODAY')}
            disabled={hasActiveRequest}
          >
            <Text style={styles.requestButtonText}>
              {hasActiveRequest
                ? 'UNDER APPROVAL'
                : isCheckedIn
                ? 'Request Closing / Offsite'
                : 'Request Attendance'}
            </Text>
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
  adminQrCard: {
    backgroundColor: '#0F1E36',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  qrCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  activeQrPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeQrPillText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '800',
  },
  regenBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  regenBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  qrVisualContainer: {
    marginVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrHelperText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  qrOfficeLabel: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
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
});
