import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AttendancePage } from './pages/AttendancePage';
import { QuotationPage } from './pages/QuotationPage';

export const App: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<'ATTENDANCE' | 'QUOTATION'>('ATTENDANCE');
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');

  return (
    <AuthProvider>
      <div className="app-container">
        {/* Left Sidebar */}
        <Sidebar
          currentModule={currentModule}
          setCurrentModule={setCurrentModule}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Main Application Area */}
        <div className="main-content">
          <Navbar />
          <main className="content-body">
            {currentModule === 'ATTENDANCE' ? (
              <AttendancePage activeTab={activeTab} setActiveTab={setActiveTab} />
            ) : (
              <QuotationPage activeTab={activeTab} setActiveTab={setActiveTab} />
            )}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
};
