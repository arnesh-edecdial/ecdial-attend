import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { User, EmployeeScheduleItem } from '../../types';
import { X, Clock, Save, Calendar } from 'lucide-react';

interface ScheduleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: User | null;
  onSuccess: () => void;
}

export const ScheduleConfigModal: React.FC<ScheduleConfigModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
}) => {
  const [schedules, setSchedules] = useState<EmployeeScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employee) {
      loadSchedule();
    }
  }, [isOpen, employee]);

  const loadSchedule = async () => {
    if (!employee) return;
    try {
      setIsLoading(true);
      const res = await api.getEmployeeSchedule(employee.id);
      if (res.success) {
        setSchedules(res.data.schedules);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s))
    );
  };

  const handleToggleWorkingDay = (dayOfWeek: number) => {
    setSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, isWorkingDay: !s.isWorkingDay } : s))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.updateEmployeeSchedule(employee.id, schedules);
      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '650px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>
              Custom Working Schedule: {employee.name}
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {employee.employeeCode} • {employee.role} • Configured individually per employee
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ padding: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid var(--status-absent)', borderRadius: 'var(--radius-md)', color: '#FF8888', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading schedule settings...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {schedules.map((item) => {
                const dayName = dayNames[item.dayOfWeek];
                return (
                  <div
                    key={item.dayOfWeek}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: item.isWorkingDay ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.2)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      opacity: item.isWorkingDay ? 1 : 0.65,
                    }}
                  >
                    <div style={{ width: '120px', fontWeight: 700, color: item.dayOfWeek === 0 ? 'var(--status-absent)' : '#FFFFFF' }}>
                      {dayName}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={item.isWorkingDay}
                        onChange={() => handleToggleWorkingDay(item.dayOfWeek)}
                      />
                      <span>{item.isWorkingDay ? 'Working Day' : 'Weekly Off (Grey)'}</span>
                    </label>

                    {item.isWorkingDay ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="time"
                          className="form-control"
                          style={{ width: '110px', padding: '4px 8px' }}
                          value={item.startTime}
                          onChange={(e) => handleTimeChange(item.dayOfWeek, 'startTime', e.target.value)}
                        />
                        <span style={{ color: 'var(--text-dim)' }}>to</span>
                        <input
                          type="time"
                          className="form-control"
                          style={{ width: '110px', padding: '4px 8px' }}
                          value={item.endTime}
                          onChange={(e) => handleTimeChange(item.dayOfWeek, 'endTime', e.target.value)}
                        />
                      </div>
                    ) : (
                      <div style={{ width: '240px', textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                        No expected check-in / No absent penalty
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            <Save size={15} /> {isSaving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};
