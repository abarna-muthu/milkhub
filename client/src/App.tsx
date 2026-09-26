import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { CenterProvider } from './context/CenterContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MobileNav } from './components/layout/MobileNav';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerProfilePage } from './pages/CustomerProfilePage';
import { DailyCollectionPage } from './pages/DailyCollectionPage';
import { MilkRatesPage } from './pages/MilkRatesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { CustomerLedgerPage } from './pages/CustomerLedgerPage';
import { ReportsPage } from './pages/ReportsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { StaffPage } from './pages/StaffPage';
import { CentersPage } from './pages/CentersPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { SettingsPage } from './pages/SettingsPage';

function MainApp() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('dashboard');
  const [routeParam, setRouteParam] = useState<string | undefined>();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigate = (path: string, param?: string) => {
    setCurrentPath(path);
    setRouteParam(param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // While verifying session on refresh
  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-lg shadow-md animate-pulse">
            MH
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-600">Verifying session...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show Login page
  if (!isAuthenticated || currentPath === 'login') {
    return <LoginPage onLoginSuccess={() => setCurrentPath('dashboard')} />;
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] text-[#0f172a] overflow-hidden">
      {/* Desktop Left Sidebar */}
      <div className="hidden md:block">
        <Sidebar currentPath={currentPath} onNavigate={handleNavigate} />
      </div>

      {/* Mobile Drawer Navigation */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentPath={currentPath}
        onNavigate={handleNavigate}
      />

      {/* Right Column: TopBar + Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={handleNavigate}
        />

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {currentPath === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}

            {currentPath === 'customers' && (
              <CustomersPage onNavigate={handleNavigate} selectedCustomerId={routeParam} />
            )}

            {currentPath === 'customer-profile' && (
              <CustomerProfilePage
                customerId={routeParam || 'cust_1'}
                onNavigate={handleNavigate}
              />
            )}

            {currentPath === 'collection' && <DailyCollectionPage onNavigate={handleNavigate} />}

            {(currentPath === 'deliveries' || currentPath === 'deliveries/morning' || currentPath === 'deliveries-morning') && (
              <DeliveriesPage initialSession="MORNING" onNavigate={handleNavigate} />
            )}

            {(currentPath === 'deliveries/evening' || currentPath === 'deliveries-evening') && (
              <DeliveriesPage initialSession="EVENING" onNavigate={handleNavigate} />
            )}

            {currentPath === 'rates' && <MilkRatesPage onNavigate={handleNavigate} />}

            {currentPath === 'payments' && <PaymentsPage onNavigate={handleNavigate} />}

            {currentPath === 'ledger' && (
              <CustomerLedgerPage
                initialCustomerId={routeParam}
                onNavigate={handleNavigate}
              />
            )}

            {currentPath === 'reports' && <ReportsPage />}

            {currentPath === 'expenses' && <ExpensesPage />}

            {currentPath === 'staff' && <StaffPage onNavigate={handleNavigate} />}

            {currentPath === 'centers' && <CentersPage onNavigate={handleNavigate} />}

            {currentPath === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <CenterProvider>
          <ToastProvider>
            <MainApp />
          </ToastProvider>
        </CenterProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
