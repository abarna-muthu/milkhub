import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Database,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Milk,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, dbStatus, refreshDbStatus } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('milkhub@admin.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFillDemo = () => {
    setEmail('milkhub@admin.com');
    setPassword('Admin@123');
    setErrorMessage(null);
    showToast('Loaded default Owner credentials', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your owner email address.');
      return;
    }

    if (!cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: cleanEmail, password });
      showToast('Welcome back, Owner! Logged in successfully.', 'success');
      onLoginSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0f1d] text-slate-100 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-500/20">
            <Milk className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-white tracking-tight leading-tight">
              MILK BUSINESS CRM
            </h1>
            <p className="text-[11px] font-medium text-emerald-400 tracking-wider uppercase">
              React • Node.js • TiDB Cloud
            </p>
          </div>
        </div>

        {/* Phase Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold">Phase 1: Owner Authentication</span>
        </div>
      </header>

      {/* Main Login Center Area */}
      <main className="w-full max-w-md mx-auto px-4 py-8 z-10 flex flex-col items-center">
        {/* Architectural Constraint Banner */}
        <div className="w-full mb-4 p-3 rounded-xl bg-slate-900/90 border border-emerald-900/60 shadow-lg text-center backdrop-blur-md">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            System Rule
          </div>
          <p className="text-xs text-slate-300 font-medium">
            <strong className="text-white">Customer has NO login.</strong> Owner is the primary system user.
          </p>
        </div>

        {/* Main Card */}
        <div className="w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Owner Sign In
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Authenticate via TiDB <code className="text-emerald-400">users</code> table
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 flex items-start gap-2.5 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="owner-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Owner Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="owner-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. milkhub@admin.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="owner-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Demo Pre-fill Button */}
            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-slate-400">Need default credentials?</span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fill Demo Credentials
              </button>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-button"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying against TiDB...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Owner</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* TiDB Live Status Widget */}
          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>
                TiDB:{' '}
                <strong className={dbStatus?.connected ? 'text-emerald-400' : 'text-amber-400'}>
                  {dbStatus?.connected ? 'Live Connected' : 'Fallback Active'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={refreshDbStatus}
              className="text-[11px] text-slate-500 hover:text-slate-300 underline"
            >
              Re-check
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 z-10 gap-2 border-t border-slate-900">
        <div>
          Milk Business CRM • Built strictly according to Full MVP Developer Blueprint
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span>API: POST /api/auth/login</span>
        </div>
      </footer>
    </div>
  );
};
