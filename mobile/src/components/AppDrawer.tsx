import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { canSkipAttendance } from '../utils/roles';

interface AppDrawerProps {
  visible: boolean;
  onClose: () => void;
  userRole: string;
  userName: string;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({
  visible,
  onClose,
  userRole,
  userName,
  onNavigate,
  onLogout,
}) => {
  const getMenuItems = () => {
    if (canSkipAttendance(userRole)) {
      return [
        { id: 'HOME', label: 'Dashboard Home', icon: '🏠' },
        { id: 'ADMIN_EMPLOYEES', label: 'Employee Management', icon: '👥' },
        { id: 'CUSTOMERS', label: 'Customer Directory', icon: '👤' },
        { id: 'ADMIN_CALENDAR', label: 'Company Calendar & Leave', icon: '📅' },
        { id: 'ADMIN_APPROVALS', label: 'Attendance Requests', icon: '📝' },
        { id: 'STOCK', label: 'Stock & Inventory', icon: '📦' },
        { id: 'STOCK_REQUIREMENTS', label: 'Stock Requirements', icon: '📋' },
        { id: 'CATALOGUES', label: 'AC Catalogues', icon: '📚' },
        { id: 'ADMIN_MACHINES', label: 'Machine Models', icon: '❄️' },
        { id: 'QUOTATIONS', label: 'All Quotations', icon: '📄' },
        { id: 'SERVICE_INTAKE', label: 'Service Intake', icon: '🔧' },
        { id: 'LOCATION_CALIBRATION', label: 'Location & Geofence Calibration', icon: '📍' },
      ];
    }
    if (['SALES', 'CRM'].includes((userRole || '').toUpperCase())) {
      return [
        { id: 'HOME', label: 'Sales Home', icon: '🏠' },
        { id: 'CUSTOMERS', label: 'Customer Directory', icon: '👤' },
        { id: 'CALENDAR', label: 'My Attendance Calendar', icon: '📅' },
        { id: 'STOCK', label: 'Stock & Inventory (View Only)', icon: '📦' },
        { id: 'STOCK_REQUIREMENTS', label: 'My Stock Requests', icon: '📋' },
        { id: 'CATALOGUES', label: 'AC Catalogues', icon: '📚' },
        { id: 'QUOTATIONS', label: 'My Quotations', icon: '📄' },
        { id: 'NEW_QUOTE', label: 'Create Quotation', icon: '➕' },
      ];
    }
    // Employee / Technician
    return [
      { id: 'HOME', label: 'Employee Home', icon: '🏠' },
      { id: 'CALENDAR', label: 'My Attendance History', icon: '📅' },
      { id: 'CATALOGUES', label: 'AC Catalogues', icon: '📚' },
      { id: 'REQUEST', label: 'Request Attendance', icon: '📝' },
    ];
  };

  const menuItems = getMenuItems();

  const handleSelect = (id: string) => {
    onClose();
    onNavigate(id);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <SafeAreaView style={styles.drawerContainer} edges={['top', 'left', 'bottom']}>
          {/* User Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 26 }}>
                {canSkipAttendance(userRole) ? '👨‍💼' : ['SALES', 'CRM'].includes((userRole || '').toUpperCase()) ? '👩‍💼' : '👷‍♂️'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName}</Text>
              <View style={styles.rolePill}>
                <Text style={styles.roleText}>{userRole}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Links */}
          <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionHeading}>MENU</Text>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleSelect(item.id)}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
            ))}

            {/* Logout Action (Rule 18) */}
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <Text style={{ fontSize: 18 }}>🚪</Text>
              <Text style={styles.logoutBtnText}>Sign Out / Logout</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Footer Branding */}
          <View style={styles.drawerFooter}>
            <Text style={styles.footerBrand}>ECDIAL SYSTEM</Text>
            <Text style={styles.footerVersion}>Version 2.4.0 • Enterprise Mobile</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContainer: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    height: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  rolePill: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  menuScroll: {
    flex: 1,
    padding: 16,
  },
  sectionHeading: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuIcon: {
    fontSize: 18,
    width: 28,
  },
  menuLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  menuChevron: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 20,
    marginBottom: 20,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '800',
  },
  drawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
  },
  footerVersion: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2,
  },
});
