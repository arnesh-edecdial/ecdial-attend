import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ApprovalItem } from '../../types';
import { CheckSquare, Check, X, Clock, AlertTriangle } from 'lucide-react';

export const ApprovalQueueView: React.FC = () => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [totalPending, setTotalPending] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      setIsLoading(true);
      const res = await api.listPendingApprovals();
      if (res.success) {
        setApprovals(res.data.queue);
        setTotalPending(res.data.totalPending);
      }
    } catch (err) {
      console.error('Failed to load approvals queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setActionLoadingId(id);
    setActionMessage(null);
    try {
      const res = await api.processApproval(id, action);
      if (res.success) {
        setActionMessage(res.message);
        fetchQueue();
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckSquare size={22} color="var(--primary-400)" />
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Central Approval Queue</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Review pending Attendance Corrections, Multi-Day Requests, and Overtime Submissions
            </p>
          </div>
        </div>

        <span className="badge badge-pending" style={{ fontSize: '13px', padding: '6px 14px' }}>
          {totalPending} Pending Approvals
        </span>
      </div>

      {actionMessage && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid var(--status-present)',
          color: 'var(--status-present)',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
        }}>
          ✓ {actionMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading approval requests...
        </div>
      ) : approvals.length === 0 ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-color)',
        }}>
          <Check size={36} color="var(--status-present)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>All caught up!</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            There are no pending attendance or overtime approvals waiting for review.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Employee</th>
                <th>Target Date(s)</th>
                <th>Details / Reason</th>
                <th>Expected Hours / OT</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((item) => {
                const isOvertime = item.type === 'OVERTIME';
                const isMultiDay = item.type === 'MULTI_DAY_REQUEST';

                return (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge ${isOvertime ? 'badge-overtime' : isMultiDay ? 'badge-present' : 'badge-pending'}`}>
                        {isOvertime ? 'Overtime' : isMultiDay ? 'Multi-Day Missed' : 'Attendance Correction'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{item.employeeName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {item.employeeCode} • {item.role}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--primary-400)' }}>
                        {item.datesFormatted}
                      </div>
                      {isMultiDay && (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          {item.dates.length} Days Covered
                        </div>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-main)' }}>{item.reason}</div>
                      {item.remarks && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                          Note: "{item.remarks}"
                        </div>
                      )}
                    </td>
                    <td>
                      {isOvertime ? (
                        <div style={{ fontWeight: 700, color: 'var(--status-overtime)' }}>
                          +{item.otFormatted} OT
                        </div>
                      ) : (
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          {item.checkInTime || '09:00'} → {item.checkOutTime || '20:00'}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={actionLoadingId === item.id}
                          onClick={() => handleAction(item.id, 'APPROVE')}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={actionLoadingId === item.id}
                          onClick={() => handleAction(item.id, 'REJECT')}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
