import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { DashboardData, User } from '../types';
import { LiveQRKiosk } from '../components/attendance/LiveQRKiosk';
import { AttendanceCalendar } from '../components/attendance/AttendanceCalendar';
import { ApprovalQueueView } from '../components/attendance/ApprovalQueueView';
import { AttendanceRequestModal } from '../components/attendance/AttendanceRequestModal';
import { ScheduleConfigModal } from '../components/attendance/ScheduleConfigModal';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Settings,
  Plus,
  Trash2,
  MapPin,
  Save,
  FileText,
  Calendar,
} from 'lucide-react';

interface AttendancePageProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, employees } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().substring(0, 10));
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [requestModalOpen, setRequestModalOpen] = useState<boolean>(false);
  const [requestPreselectedDate, setRequestPreselectedDate] = useState<string | undefined>();
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [targetEmployeeForSchedule, setTargetEmployeeForSchedule] = useState<User | null>(null);

  // Office Config state
  const [officeConfig, setOfficeConfig] = useState<any>(null);
  const [officeSaving, setOfficeSaving] = useState<boolean>(false);
  const [officeMessage, setOfficeMessage] = useState<string | null>(null);

  // Holidays state
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayName, setNewHolidayName] = useState<string>('');

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await api.getTodayDashboard(dateFilter, roleFilter, statusFilter, searchFilter);
      if (res.success) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOfficeConfig = async () => {
    try {
      const res = await api.getOfficeConfig();
      if (res.success) setOfficeConfig(res.data);
    } catch (err) {
      console.error('Failed to load office config', err);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await api.listHolidays();
      if (res.success) setHolidays(res.data);
    } catch (err) {
      console.error('Failed to load holidays', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.listAuditLogs();
      if (res.success) setAuditLogs(res.data.logs);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'DASHBOARD') fetchDashboard();
    if (activeTab === 'OFFICE_CONFIG') fetchOfficeConfig();
    if (activeTab === 'HOLIDAYS') fetchHolidays();
    if (activeTab === 'AUDIT_LOG') fetchAuditLogs();
  }, [activeTab, dateFilter, roleFilter, statusFilter, searchFilter]);

  const handleSaveOffice = async () => {
    if (!officeConfig) return;
    setOfficeSaving(true);
    setOfficeMessage(null);
    try {
      const res = await api.updateOfficeConfig(officeConfig);
      if (res.success) {
        setOfficeMessage('Office geofence settings updated successfully.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update office settings');
    } finally {
      setOfficeSaving(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return;
    try {
      const res = await api.createHoliday({ date: newHolidayDate, name: newHolidayName });
      if (res.success) {
        setNewHolidayDate('');
        setNewHolidayName('');
        fetchHolidays();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create holiday');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const res = await api.deleteHoliday(id);
      if (res.success) fetchHolidays();
    } catch (err: any) {
      alert(err.message || 'Failed to delete holiday');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tab 1: Live QR Kiosk */}
      {activeTab === 'QR_KIOSK' && <LiveQRKiosk />}

      {/* Tab 2: Monthly Calendar */}
      {activeTab === 'CALENDAR' && (
        <AttendanceCalendar
          onRequestCorrection={(date?: string) => {
            setRequestPreselectedDate(date);
            setRequestModalOpen(true);
          }}
        />
      )}

      {/* Tab 3: Central Approvals Queue */}
      {activeTab === 'APPROVALS' && <ApprovalQueueView />}

      {/* Tab 4: Employee Schedules Management */}
      {activeTab === 'SCHEDULES' && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Employee Working Schedules</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Configure individual shift timings, expected working hours, and weekly off days for each employee
              </p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Working Days</th>
                  <th>Shift Timings</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: User) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{emp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{emp.employeeCode}</div>
                    </td>
                    <td><span className="badge badge-grey">{emp.role}</span></td>
                    <td>{emp.department || 'ECDIAL'}</td>
                    <td><span style={{ color: 'var(--status-present)', fontWeight: 600 }}>Monday - Saturday</span></td>
                    <td>09:00 - 20:00</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setTargetEmployeeForSchedule(emp);
                          setScheduleModalOpen(true);
                        }}
                      >
                        <Settings size={14} /> Configure Schedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Office Geofence & Location Config */}
      {activeTab === 'OFFICE_CONFIG' && officeConfig && (
        <div className="glass-card" style={{ maxWidth: '750px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <MapPin size={22} color="var(--primary-400)" />
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>ECDIAL Office Location & Geo-Fence</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Authoritative boundary for physical employee check-in verification
              </p>
            </div>
          </div>

          {officeMessage && (
            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--status-present)', color: 'var(--status-present)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13.5px' }}>
              ✓ {officeMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Office Name</label>
              <input
                type="text"
                className="form-control"
                value={officeConfig.officeName}
                onChange={(e) => setOfficeConfig({ ...officeConfig, officeName: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-control"
                  value={officeConfig.latitude}
                  onChange={(e) => setOfficeConfig({ ...officeConfig, latitude: parseFloat(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-control"
                  value={officeConfig.longitude}
                  onChange={(e) => setOfficeConfig({ ...officeConfig, longitude: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Allowed Geofence Radius (Metres)</label>
                <select
                  className="form-select"
                  value={officeConfig.allowedRadiusMeters}
                  onChange={(e) => setOfficeConfig({ ...officeConfig, allowedRadiusMeters: parseFloat(e.target.value) })}
                >
                  <option value="50">50 Metres (Strict)</option>
                  <option value="100">100 Metres (Default standard)</option>
                  <option value="150">150 Metres (Wide campus)</option>
                  <option value="200">200 Metres (Extended area)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">QR Token Rotation Interval</label>
                <select
                  className="form-select"
                  value={officeConfig.qrRotationSeconds}
                  onChange={(e) => setOfficeConfig({ ...officeConfig, qrRotationSeconds: parseInt(e.target.value) })}
                >
                  <option value="15">15 Seconds (High security)</option>
                  <option value="30">30 Seconds (Recommended)</option>
                  <option value="45">45 Seconds</option>
                  <option value="60">60 Seconds</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-primary" onClick={handleSaveOffice} disabled={officeSaving}>
                <Save size={15} /> {officeSaving ? 'Saving...' : 'Save Office Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Government Holidays */}
      {activeTab === 'HOLIDAYS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          <div className="glass-card">
            <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Government Holidays</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Employees are not expected to mark attendance on configured holidays (displayed in Grey, not marked absent)
            </p>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Holiday Name</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary-400)' }}>{h.date}</td>
                      <td style={{ fontWeight: 600, color: '#FFFFFF' }}>{h.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>{h.description || 'Government Holiday'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => handleDeleteHoliday(h.id)}>
                          <Trash2 size={14} color="var(--status-absent)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>+ Add Government Holiday</h3>
            <form onSubmit={handleAddHoliday} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Holiday Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Holiday Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Independence Day / Diwali"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                <Plus size={15} /> Add Holiday
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 7: Audit Log */}
      {activeTab === 'AUDIT_LOG' && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Attendance Audit Trail</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Immutable security log of check-ins, check-outs, GPS accuracy, distance, and administrative approvals
              </p>
            </div>
            <span className="badge badge-grey">{auditLogs.length} Logged Events</span>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Employee</th>
                  <th>Action</th>
                  <th>Method</th>
                  <th>Distance</th>
                  <th>GPS Accuracy</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: '#FFFFFF' }}>{log.employeeName}</td>
                    <td>
                      <span className={`badge ${
                        log.action.includes('APPROVED') || log.action === 'CHECK_IN' ? 'badge-present' :
                        log.action.includes('FAILED') || log.action.includes('REJECTED') ? 'badge-absent' : 'badge-overtime'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td>{log.method || 'SYSTEM'}</td>
                    <td>{log.distance !== null && log.distance !== undefined ? `${log.distance}m` : '—'}</td>
                    <td>{log.gpsAccuracy ? `±${log.gpsAccuracy}m` : '—'}</td>
                    <td style={{ fontSize: '11.5px', color: 'var(--text-dim)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 8: Today Overview Dashboard */}
      {activeTab === 'DASHBOARD' && dashboardData && (
        <>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
            <div className="glass-card" style={{ borderLeft: '4px solid var(--status-present)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Present Today
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-present)', marginTop: '4px' }}>
                {dashboardData.summary.present}
              </div>
            </div>

            <div className="glass-card" style={{ borderLeft: '4px solid var(--status-absent)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Absent
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-absent)', marginTop: '4px' }}>
                {dashboardData.summary.absent}
              </div>
            </div>

            <div className="glass-card" style={{ borderLeft: '4px solid var(--status-pending)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Pending Requests
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-pending)', marginTop: '4px' }}>
                {dashboardData.summary.pending}
              </div>
            </div>

            <div className="glass-card" style={{ borderLeft: '4px solid var(--status-overtime)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Overtime Pending
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-overtime)', marginTop: '4px' }}>
                {dashboardData.summary.otPending}
              </div>
            </div>

            <div className="glass-card" style={{ borderLeft: '4px solid var(--primary-400)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Total Employees
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', marginTop: '4px' }}>
                {dashboardData.summary.totalEmployees}
              </div>
            </div>
          </div>

          {/* Filter Bar & Employee Table */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: '36px' }}
                    placeholder="Filter employee or code..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>

                <select
                  className="form-select"
                  style={{ width: '160px' }}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="TECHNICIAN">Technicians</option>
                  <option value="SALES">Sales</option>
                  <option value="MANAGER">Managers</option>
                  <option value="ACCOUNTANT">Accountants</option>
                  <option value="ADMIN">Admins</option>
                </select>

                <select
                  className="form-select"
                  style={{ width: '160px' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="COMPLETED">Completed Shift</option>
                  <option value="ABSENT">Absent</option>
                  <option value="WAITING_FOR_APPROVAL">Waiting Approval</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="WEEKLY_OFF">Weekly Off</option>
                </select>

                <input
                  type="date"
                  className="form-control"
                  style={{ width: '160px' }}
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <button className="btn btn-primary" onClick={() => setRequestModalOpen(true)}>
                <Plus size={15} /> Request Attendance Correction
              </button>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Schedule</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Overtime</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {emp.employeeCode} • {emp.department}
                        </div>
                      </td>
                      <td><span className="badge badge-grey">{emp.role}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp.schedule}</td>
                      <td style={{ fontWeight: 600 }}>{emp.checkIn || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{emp.checkOut || '—'}</td>
                      <td>{emp.duration || '—'}</td>
                      <td>
                        <span className={`badge ${
                          emp.status === 'PRESENT' || emp.status === 'COMPLETED' ? 'badge-present' :
                          emp.status === 'ABSENT' ? 'badge-absent' :
                          emp.status === 'WAITING_FOR_APPROVAL' ? 'badge-pending' : 'badge-grey'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td>
                        {emp.ot ? (
                          <span className={`badge ${emp.otStatus === 'OT_APPROVED' ? 'badge-present' : 'badge-overtime'}`}>
                            {emp.ot}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Correction Request Modal */}
      <AttendanceRequestModal
        isOpen={requestModalOpen}
        onClose={() => {
          setRequestModalOpen(false);
          setRequestPreselectedDate(undefined);
        }}
        initialDate={requestPreselectedDate}
        onSuccess={() => {
          if (activeTab === 'DASHBOARD') fetchDashboard();
        }}
      />

      {/* Schedule Config Modal */}
      <ScheduleConfigModal
        isOpen={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setTargetEmployeeForSchedule(null);
        }}
        employee={targetEmployeeForSchedule}
        onSuccess={() => {
          if (activeTab === 'SCHEDULES') fetchDashboard();
        }}
      />
    </div>
  );
};
