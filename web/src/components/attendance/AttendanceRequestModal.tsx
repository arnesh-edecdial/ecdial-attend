import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, Calendar, Clock, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AttendanceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
}

export const AttendanceRequestModal: React.FC<AttendanceRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
}) => {
  const { currentUser } = useAuth();
  const [requestType, setRequestType] = useState<string>('CHECKIN_FAILURE');
  const [selectedDates, setSelectedDates] = useState<string[]>(initialDate ? [initialDate] : [new Date().toISOString().substring(0, 10)]);
  const [dateInput, setDateInput] = useState<string>(initialDate || new Date().toISOString().substring(0, 10));
  const [checkInTime, setCheckInTime] = useState<string>('09:00');
  const [checkOutTime, setCheckOutTime] = useState<string>('20:00');
  const [reason, setReason] = useState<string>('Forgot to mark attendance');
  const [remarks, setRemarks] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleDate = (d: string) => {
    if (selectedDates.includes(d)) {
      if (selectedDates.length > 1) {
        setSelectedDates(selectedDates.filter((item) => item !== d));
      }
    } else {
      setSelectedDates([...selectedDates, d]);
    }
  };

  const addDateFromInput = () => {
    if (dateInput && !selectedDates.includes(dateInput)) {
      setSelectedDates([...selectedDates, dateInput]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.submitAttendanceRequest({
        requestType: selectedDates.length > 1 ? 'MULTI_DAY_MISSED' : requestType,
        dates: selectedDates,
        checkInTime,
        checkOutTime,
        reason,
        remarks,
      });

      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit request.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} color="var(--primary-400)" />
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Attendance Correction Request</h3>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ padding: '12px', background: 'rgba(239,68,68,0.15)', border: '1px solid var(--status-absent)', borderRadius: 'var(--radius-md)', color: '#FF8888', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {/* Request Type */}
            <div className="form-group">
              <label className="form-label">Request Category</label>
              <select
                className="form-select"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
              >
                <option value="CHECKIN_FAILURE">Missed Check-In / Device Issue</option>
                <option value="CHECKOUT_CORRECTION">Checkout Correction (Incomplete Attendance)</option>
                <option value="MULTI_DAY_MISSED">Multiple Days Missed Correction</option>
              </select>
            </div>

            {/* Selected Dates Chips */}
            <div className="form-group">
              <label className="form-label">Target Date(s) (One Request covers multiple dates)</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="date"
                  className="form-control"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                />
                <button type="button" className="btn btn-secondary" onClick={addDateFromInput}>
                  + Add Date
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedDates.map((d) => (
                  <span
                    key={d}
                    style={{
                      background: 'rgba(0, 102, 204, 0.25)',
                      border: '1px solid var(--primary-400)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {d}
                    {selectedDates.length > 1 && (
                      <span
                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                        onClick={() => toggleDate(d)}
                      >
                        ×
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Expected Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Actual Check-In Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Actual Check-Out Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Reason */}
            <div className="form-group">
              <label className="form-label">Reason for Request *</label>
              <select
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="Forgot to mark attendance">Forgot to mark attendance</option>
                <option value="On-site client field emergency">On-site client field emergency</option>
                <option value="Phone battery drained / GPS unavailable">Phone battery drained / GPS unavailable</option>
                <option value="Direct site deployment by manager">Direct site deployment by manager</option>
                <option value="Other work related reason">Other work related reason</option>
              </select>
            </div>

            {/* Remarks */}
            <div className="form-group">
              <label className="form-label">Additional Remarks (Optional)</label>
              <textarea
                className="form-control"
                placeholder="Provide any additional context for the administrator..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>
              Status after submission: <strong style={{ color: 'var(--status-pending)' }}>WAITING FOR APPROVAL</strong>. The administrator will review this in the approval queue.
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
