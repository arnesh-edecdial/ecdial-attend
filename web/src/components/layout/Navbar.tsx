import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'ADMIN':
      case 'IT_ADMIN': return 'badge-overtime';
      case 'MANAGER': return 'badge-pending';
      case 'SALES': return 'badge-present';
      default: return 'badge-grey';
    }
  };

  return (
    <header style={{ height: 68, background: 'rgba(13, 21, 39, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #0066CC, #003D7A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(0, 102, 204, 0.4)' }}><ShieldCheck size={22} color="#FFFFFF" /></div>
        <div><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px', color: '#FFFFFF' }}>ECDIAL</div><div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Enterprise Workspace</div></div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {currentUser && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13.5, fontWeight: 700, color: '#FFFFFF' }}>{currentUser.name}</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{currentUser.employeeCode} • {currentUser.department || 'ECDIAL'}</div></div>
          <span className={`badge ${getRoleBadgeClass(currentUser.role)}`}>{currentUser.role}</span>
        </div>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={logout} title="Sign out"><LogOut size={15} /> Sign out</button>
      </div>
    </header>
  );
};
