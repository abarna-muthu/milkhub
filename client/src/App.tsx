import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MobileNav } from './components/layout/MobileNav';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { SalesPage } from './pages/SalesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Milk, Sparkles } from 'lucide-react';


interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-2xl border border-rose-200 shadow-sm text-center my-6">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Unable to Display View</h3>
          <p className="text-xs text-rose-600 font-mono max-w-md mx-auto mt-1 mb-4 bg-rose-50 p-2 rounded-lg">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition"
          >
            Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // While validating session token on load
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
            <Milk className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            <span>Connecting to MilkHub...</span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 mt-2">
            Developed by GenZ Neural X
          </span>
        </div>
      </div>
    );
  }

  // Authenticated Owner -> Layout + Dashboard
  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden">
      {/* Desktop Sidebar */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <TopBar
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={handleNavigate}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary key={currentPath} onReset={() => setCurrentPath('dashboard')}>
              {currentPath === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
              {currentPath === 'customers' && <CustomersPage />}
              {currentPath === 'deliveries-morning' && <DeliveriesPage initialSession="morning" />}
              {currentPath === 'deliveries-evening' && <DeliveriesPage initialSession="evening" />}
              {currentPath === 'sales' && <SalesPage />}
              {currentPath === 'payments' && <PaymentsPage initialTab="daily" />}
              {currentPath === 'payments-daily' && <PaymentsPage initialTab="daily" />}
              {currentPath === 'payments-advance' && <PaymentsPage initialTab="advance" />}
              {currentPath === 'settings' && <SettingsPage />}
              {currentPath !== 'dashboard' &&
                currentPath !== 'customers' &&
                currentPath !== 'deliveries-morning' &&
                currentPath !== 'deliveries-evening' &&
                currentPath !== 'sales' &&
                currentPath !== 'payments' &&
                currentPath !== 'payments-daily' &&
                currentPath !== 'payments-advance' &&
                currentPath !== 'settings' && (
                  <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 capitalize">
                      {currentPath.replace('-', ' ')}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                      MilkHub management system is active and operational.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentPath('dashboard')}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                )}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
