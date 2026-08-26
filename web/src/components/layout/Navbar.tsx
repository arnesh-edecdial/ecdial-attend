import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, employees, switchUser } = useAuth();

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'ADMIN':
      case 'IT_ADMIN':
        return 'badge-overtime';
      case 'MANAGER':
        return 'badge-pending';
      case 'SALES':
        return 'badge-present';
      default:
        return 'badge-grey';
    }
  };

  return (
    <header style={{
      height: '68px',
      background: 'rgba(13, 21, 39, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #0066CC, #003D7A)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0, 102, 204, 0.4)',
        }}>
          <ShieldCheck size={22} color="#FFFFFF" />
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', color: '#FFFFFF' }}>
            ECDIAL
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Enterprise Workspace
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Quick Role Switcher */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '6px 14px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-color)',
        }}>
          <UserCheck size={16} color="var(--primary-400)" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Persona:</span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id} style={{ background: '#0D1527', color: '#FFFFFF' }}>
                {emp.name} ({emp.role})
              </option>
            ))}
          </select>
        </div>

        {/* Current User Info Badge */}
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#FFFFFF' }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {currentUser.employeeCode} • {currentUser.department || 'ECDIAL'}
              </div>
            </div>
            <span className={`badge ${getRoleBadgeClass(currentUser.role)}`}>
              {currentUser.role}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
