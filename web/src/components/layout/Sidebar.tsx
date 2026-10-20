import React from 'react';
import {
  Clock,
  QrCode,
  Calendar,
  CheckSquare,
  MapPin,
  CalendarDays,
  FileSpreadsheet,
  FilePlus,
  Layers,
  Settings,
  History,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentModule: 'ATTENDANCE' | 'QUOTATION';
  setCurrentModule: (mod: 'ATTENDANCE' | 'QUOTATION') => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  setCurrentModule,
  activeTab,
  setActiveTab,
}) => {
  const { currentUser } = useAuth();
  const isAdminOrManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'IT_ADMIN' || currentUser?.role === 'MANAGER';

  return (
    <aside style={{
      width: '260px',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
    }}>
      {/* Module Switcher Tabs */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          gap: '4px',
        }}>
          <button
            onClick={() => {
              setCurrentModule('ATTENDANCE');
              setActiveTab('DASHBOARD');
            }}
            style={{
              padding: '8px 10px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: currentModule === 'ATTENDANCE' ? 'var(--primary-500)' : 'transparent',
              color: currentModule === 'ATTENDANCE' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Clock size={14} />
            Attendance
          </button>

          <button
            onClick={() => {
              setCurrentModule('QUOTATION');
              setActiveTab('NEW_QUOTATION');
            }}
            style={{
              padding: '8px 10px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: currentModule === 'QUOTATION' ? 'var(--primary-500)' : 'transparent',
              color: currentModule === 'QUOTATION' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <FileSpreadsheet size={14} />
            Quotation
          </button>
        </div>
      </div>

      {/* Navigation Sub-Items */}
      <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        {currentModule === 'ATTENDANCE' ? (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '6px 12px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Operations
            </div>

            <NavItem
              icon={<Clock size={16} />}
              label="Today Overview"
              active={activeTab === 'DASHBOARD'}
              onClick={() => setActiveTab('DASHBOARD')}
            />

            <NavItem
              icon={<QrCode size={16} />}
              label="Live QR Kiosk"
              active={activeTab === 'QR_KIOSK'}
              onClick={() => setActiveTab('QR_KIOSK')}
              badge="Rotating"
            />

            <NavItem
              icon={<Calendar size={16} />}
              label="Monthly Calendar"
              active={activeTab === 'CALENDAR'}
              onClick={() => setActiveTab('CALENDAR')}
            />

            {isAdminOrManager && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '16px 12px 6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Management & Config
                </div>

                <NavItem
                  icon={<CheckSquare size={16} />}
                  label="Pending Approvals"
                  active={activeTab === 'APPROVALS'}
                  onClick={() => setActiveTab('APPROVALS')}
                />

                <NavItem
                  icon={<CalendarDays size={16} />}
                  label="Employee Schedules"
                  active={activeTab === 'SCHEDULES'}
                  onClick={() => setActiveTab('SCHEDULES')}
                />

                <NavItem
                  icon={<MapPin size={16} />}
                  label="Office Geofence"
                  active={activeTab === 'OFFICE_CONFIG'}
                  onClick={() => setActiveTab('OFFICE_CONFIG')}
                />

                <NavItem
                  icon={<Calendar size={16} />}
                  label="Govt Holidays"
                  active={activeTab === 'HOLIDAYS'}
                  onClick={() => setActiveTab('HOLIDAYS')}
                />

                <NavItem
                  icon={<History size={16} />}
                  label="Audit Log"
                  active={activeTab === 'AUDIT_LOG'}
                  onClick={() => setActiveTab('AUDIT_LOG')}
                />
              </>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '6px 12px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Quotation Workspace
            </div>

            <NavItem
              icon={<FilePlus size={16} />}
              label="+ New Quotation"
              active={activeTab === 'NEW_QUOTATION'}
              onClick={() => setActiveTab('NEW_QUOTATION')}
              highlight
            />

            <NavItem
              icon={<FileSpreadsheet size={16} />}
              label="All Quotations"
              active={activeTab === 'QUOTATION_LIST'}
              onClick={() => setActiveTab('QUOTATION_LIST')}
            />

            <NavItem
              icon={<Layers size={16} />}
              label="Product Catalogue"
              active={activeTab === 'CATALOGUE'}
              onClick={() => setActiveTab('CATALOGUE')}
            />

            {isAdminOrManager && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '16px 12px 6px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Quotation Settings
                </div>

                <NavItem
                  icon={<Settings size={16} />}
                  label="Tax & Term Templates"
                  active={activeTab === 'QUOTATION_CONFIG'}
                  onClick={() => setActiveTab('QUOTATION_CONFIG')}
                />

                <NavItem
                  icon={<Layers size={16} />}
                  label="Catalogue PDFs"
                  active={activeTab === 'CATALOGUE_PDFS'}
                  onClick={() => setActiveTab('CATALOGUE_PDFS')}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Shield size={14} color="var(--primary-400)" />
        <span>Node.js • MySQL • Prisma</span>
      </div>
    </aside>
  );
};

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  highlight?: boolean;
}> = ({ icon, label, active, onClick, badge, highlight }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 12px',
      marginBottom: '4px',
      borderRadius: 'var(--radius-md)',
      border: 'none',
      cursor: 'pointer',
      fontSize: '13.5px',
      fontWeight: active || highlight ? 600 : 500,
      background: active
        ? 'rgba(0, 102, 204, 0.15)'
        : highlight
        ? 'rgba(16, 185, 129, 0.1)'
        : 'transparent',
      color: active
        ? 'var(--primary-400)'
        : highlight
        ? 'var(--status-present)'
        : 'var(--text-muted)',
      borderLeft: active ? '3px solid var(--primary-400)' : '3px solid transparent',
      transition: 'all var(--transition-fast)',
      textAlign: 'left',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {icon}
      <span>{label}</span>
    </div>
    {badge && (
      <span style={{
        fontSize: '10px',
        fontWeight: 700,
        background: 'rgba(0, 102, 204, 0.3)',
        color: 'var(--primary-400)',
        padding: '2px 6px',
        borderRadius: '4px',
      }}>
        {badge}
      </span>
    )}
  </button>
);
