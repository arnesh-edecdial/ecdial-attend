import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Switch,
  RefreshControl,
  Alert,
} from 'react-native';
import { mobileApi } from '../services/api';

interface AdminEmployeesScreenProps {
  onClose?: () => void;
}

export const AdminEmployeesScreen: React.FC<AdminEmployeesScreenProps> = ({ onClose }) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // New Employee Form Fields
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [employeeCode, setEmployeeCode] = useState<string>('');
  const [role, setRole] = useState<string>('TECHNICIAN');
  const [phone, setPhone] = useState<string>('');
  const [department, setDepartment] = useState<string>('HVAC Field Operations');
  const [password, setPassword] = useState<string>('Password@123');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listEmployees();
      if (res.success) {
        setEmployees(res.data);
      }
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openAddModal = () => {
    setName('');
    setEmail('');
    setEmployeeCode(`EMP00${employees.length + 1}`);
    setRole('TECHNICIAN');
    setPhone('');
    setDepartment('HVAC Field Operations');
    setPassword('Password@123');
    setStartTime('09:00');
    setEndTime('18:00');
    setModalVisible(true);
  };

  const handleCreateEmployee = async () => {
    if (!name.trim() || !email.trim() || !employeeCode.trim()) {
      alert('Please fill in Name, Email, and Employee Code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await mobileApi.createEmployee({
        name: name.trim(),
        email: email.trim(),
        employeeCode: employeeCode.trim(),
        role,
        phone: phone.trim(),
        department: department.trim(),
        password: password.trim(),
        startTime,
        endTime,
        isActive: true,
      });

      if (res.success) {
        alert(res.message || 'Employee created successfully.');
        setModalVisible(false);
        fetchEmployees();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: any) => {
    try {
      const res = await mobileApi.toggleEmployeeStatus(emp.id);
      if (res.success) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, isActive: !e.isActive } : e))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update employee status');
    }
  };

  const handleDeleteEmployee = (emp: any) => {
    Alert.alert(
      'Delete Employee?',
      `Are you sure you want to delete or deactivate ${emp.name}? If the employee has attendance records or quotations, they will be safely deactivated to preserve historical integrity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteEmployee(emp.id);
              if (res.success) {
                Alert.alert('Success', res.message || 'Employee processed successfully.');
                fetchEmployees();
              } else {
                Alert.alert('Error', res.message || 'Failed to delete employee.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete employee.');
            }
          },
        },
      ]
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.email.toLowerCase().includes(q) ||
      (emp.department && emp.department.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Employee Management</Text>
          <Text style={styles.subtitle}>
            Admin Employee Directory & Work Schedules ({employees.length} Total)
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>+ ADD</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, employee code, email, or department..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={{ fontSize: 14, color: '#94A3B8', fontWeight: '800' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Employee Cards List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchEmployees} tintColor="#0066CC" />}
      >
        {isLoading && employees.length === 0 ? (
          <ActivityIndicator size="large" color="#0066CC" style={{ marginTop: 40 }} />
        ) : filteredEmployees.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={styles.emptyTitle}>No Employees Found</Text>
            <Text style={styles.emptySub}>Tap [+ ADD] to register a new employee with a schedule.</Text>
          </View>
        ) : (
          filteredEmployees.map((emp) => (
            <View key={emp.id} style={[styles.empCard, !emp.isActive && styles.empCardInactive]}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.empName}>{emp.name}</Text>
                    <View style={[styles.statusBadge, emp.isActive ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.statusBadgeText, emp.isActive ? styles.textActive : styles.textInactive]}>
                        {emp.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.empRole}>
                    {emp.role} • {emp.employeeCode}
                  </Text>
                </View>

                {/* Status Toggle Switch & Delete */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Switch
                      value={emp.isActive}
                      onValueChange={() => handleToggleStatus(emp)}
                      trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                      thumbColor={emp.isActive ? '#0066CC' : '#94A3B8'}
                    />
                    <Text style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                      {emp.isActive ? 'Enabled' : 'Disabled'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.empDeleteBtn}
                    onPress={() => handleDeleteEmployee(emp)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 14 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Employee Details & Schedule */}
              <View style={styles.detailsBox}>
                <Text style={styles.detailText}>📧 {emp.email}</Text>
                {emp.phone && <Text style={styles.detailText}>📞 {emp.phone}</Text>}
                {emp.department && <Text style={styles.detailText}>🏢 {emp.department}</Text>}
                <Text style={styles.scheduleText}>
                  🕒 Schedule: Mon-Sat ({emp.schedule || '09:00 - 18:00'}) • Sun Off
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Employee Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Employee</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Rajesh Kannan"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. rajesh@ecdial.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.inputLabel}>Employee Code *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. TEC003"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={employeeCode}
                onChangeText={setEmployeeCode}
              />

              <Text style={styles.inputLabel}>Role *</Text>
              <View style={styles.rolePickerRow}>
                {['TECHNICIAN', 'SALES', 'MANAGER', 'ADMIN'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. HVAC Installation"
                placeholderTextColor="#94A3B8"
                value={department}
                onChangeText={setDepartment}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +91 98765 00008"
                placeholderTextColor="#94A3B8"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.inputLabel}>Initial Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Password@123"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
              />

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Working Schedule (Mon - Sat)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeSubLabel}>Start Time (24h)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="09:00"
                    placeholderTextColor="#94A3B8"
                    value={startTime}
                    onChangeText={setStartTime}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeSubLabel}>Expected End Time (24h)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="18:00"
                    placeholderTextColor="#94A3B8"
                    value={endTime}
                    onChangeText={setEndTime}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
              onPress={handleCreateEmployee}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Create & Activate Employee</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  addBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  closeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  empCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  empCardInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    opacity: 0.8,
  },
  empDeleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  empName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  empRole: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeActive: {
    backgroundColor: '#ECFDF5',
  },
  badgeInactive: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  textActive: {
    color: '#059669',
  },
  textInactive: {
    color: '#DC2626',
  },
  detailsBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    gap: 3,
  },
  detailText: {
    fontSize: 11.5,
    color: '#475569',
  },
  scheduleText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0066CC',
    marginTop: 2,
  },
  emptyBox: {
    padding: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalClose: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748B',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  timeSubLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
