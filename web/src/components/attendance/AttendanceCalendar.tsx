import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarDay } from '../../types';
import { ChevronLeft, ChevronRight, Clock, AlertCircle, PlusCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatTime12 } from '../../utils/time';

interface AttendanceCalendarProps {
  onRequestCorrection: (preselectedDate?: string) => void;
}

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ onRequestCorrection }) => {
  const { currentUser, employees } = useAuth();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(currentUser?.id || 'usr-tech-1');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCalendar = async () => {
    try {
      setIsLoading(true);
      const res = await api.getMonthlyCalendar(selectedEmployeeId, year, month);
      if (res.success) {
        setCalendarDays(res.data.days);
        // Default select today or first day
        const todayStr = new Date().toISOString().substring(0, 10);
        const match = res.data.days.find((d: CalendarDay) => d.date === todayStr) || res.data.days[0];
        setSelectedDay(match);
      }
    } catch (err) {
      console.error('Failed to load calendar', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [selectedEmployeeId, year, month]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getColorStyle = (colorCode: string) => {
    switch (colorCode) {
      case 'GREEN':
        return { dot: 'var(--status-present)', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)' };
      case 'RED':
        return { dot: 'var(--status-absent)', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.4)' };
      case 'YELLOW':
        return { dot: 'var(--status-pending)', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)' };
      case 'PURPLE':
        return { dot: 'var(--status-overtime)', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.45)' };
      default:
        return { dot: 'var(--status-grey)', bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)' };
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
      {/* Calendar View */}
      <div className="glass-card">
        {/* Header & Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
              {monthNames[month - 1]} {year}
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary btn-icon" onClick={handlePrevMonth}>
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-secondary btn-icon" onClick={handleNextMonth}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Employee Selector for Admins / Managers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Viewing:</span>
            <select
              className="form-select"
              style={{ width: '220px', padding: '6px 12px' }}
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '10px 16px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '12px',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-present)' }} />
            Green: Present
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-absent)' }} />
            Red: Absent
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-pending)' }} />
            Pale Yellow: Waiting for Approval
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-overtime)' }} />
            Purple: Overtime
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-grey)' }} />
            Grey: Holiday / Weekly Off
          </span>
        </div>

        {/* Days Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px', textAlign: 'center' }}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d, i) => (
            <div key={d} style={{ fontSize: '11.5px', fontWeight: 700, color: i === 0 ? 'var(--status-absent)' : 'var(--text-dim)', padding: '6px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {/* Offset leading empty days */}
          {calendarDays.length > 0 && Array.from({ length: calendarDays[0].dayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: '80px', opacity: 0.2 }} />
          ))}

          {calendarDays.map((day) => {
            const styles = getColorStyle(day.colorCode);
            const isSelected = selectedDay?.date === day.date;

            return (
              <div
                key={day.date}
                onClick={() => setSelectedDay(day)}
                style={{
                  minHeight: '84px',
                  padding: '8px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'rgba(0, 102, 204, 0.25)' : styles.bg,
                  border: `1px solid ${isSelected ? 'var(--primary-400)' : styles.border}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? 'var(--primary-400)' : '#FFFFFF' }}>
                    {day.dayNumber}
                  </span>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: styles.dot }} />
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {day.badge && (
                    <div style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: styles.dot,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {day.badge}
                    </div>
                  )}
                  {day.checkIn && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      In: {formatTime12(day.checkIn)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector Panel */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          Date Details
        </h3>

        {selectedDay ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Date</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>
                {selectedDay.date} ({selectedDay.dayName})
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Attendance Status</div>
              <div style={{ marginTop: '4px' }}>
                <span className={`badge ${
                  selectedDay.colorCode === 'GREEN' ? 'badge-present' :
                  selectedDay.colorCode === 'RED' ? 'badge-absent' :
                  selectedDay.colorCode === 'YELLOW' ? 'badge-pending' :
                  selectedDay.colorCode === 'PURPLE' ? 'badge-overtime' : 'badge-grey'
                }`}>
                  {selectedDay.badge || selectedDay.status}
                </span>
              </div>
            </div>

            {selectedDay.holidayName && (
              <div style={{ padding: '10px', background: 'rgba(100, 116, 139, 0.15)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Government Holiday</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{selectedDay.holidayName}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Check-in</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTime12(selectedDay.checkIn)}</div>
              </div>
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Check-out</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{formatTime12(selectedDay.checkOut)}</div>
              </div>
            </div>

            {selectedDay.workingDuration && (
              <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Working Duration</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-400)' }}>
                  {selectedDay.workingDuration}
                </div>
              </div>
            )}

            {selectedDay.otFormatted && (
              <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <div style={{ fontSize: '11px', color: 'var(--status-overtime)' }}>Overtime Duration</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--status-overtime)' }}>
                  {selectedDay.otFormatted} ({selectedDay.otStatus || 'Pending'})
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
              <button
                className="btn btn-secondary"
                style={{ width: '100%' }}
                onClick={() => onRequestCorrection(selectedDay.date)}
              >
                <PlusCircle size={15} /> Request Attendance Correction
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
            Click on any date to inspect details.
          </div>
        )}
      </div>
    </div>
  );
};
