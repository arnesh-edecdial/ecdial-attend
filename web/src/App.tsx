import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AttendancePage } from './pages/AttendancePage';
import { QuotationPage } from './pages/QuotationPage';
import { CataloguePdfAdminPage } from './pages/CataloguePdfAdminPage';
import { LoginPage } from './pages/LoginPage';

const AuthenticatedApp: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const [currentModule, setCurrentModule] = useState<'ATTENDANCE' | 'QUOTATION'>('ATTENDANCE');
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', background: 'var(--bg-app)' }}>Checking your ECDIAL session…</div>;
  }
  if (!currentUser) return <LoginPage />;

  return (
    <div className="app-container">
      <Sidebar currentModule={currentModule} setCurrentModule={setCurrentModule} activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        <Navbar />
        <main className="content-body">
          {currentModule === 'ATTENDANCE'
            ? <AttendancePage activeTab={activeTab} setActiveTab={setActiveTab} />
            : activeTab === 'CATALOGUE_PDFS'
              ? <CataloguePdfAdminPage />
              : <QuotationPage activeTab={activeTab} setActiveTab={setActiveTab} />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AuthenticatedApp />
  </AuthProvider>
);
