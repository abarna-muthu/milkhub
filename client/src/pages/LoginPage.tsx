import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Milk,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
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
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 text-slate-800 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Decorative ambient elements */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-xl shadow-md shadow-emerald-600/20">
            <Milk className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 tracking-tight leading-tight">
              MILKHUB
            </h1>
            <p className="text-[11px] font-semibold text-emerald-700 tracking-wide">
              Milk Business CRM
            </p>
          </div>
        </div>

        {/* System Access Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs text-xs text-slate-700">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold">Owner Portal</span>
        </div>
      </header>

      {/* Main Login Center Area */}
      <main className="w-full max-w-md mx-auto px-4 py-8 z-10 flex flex-col items-center">
        {/* System Notice Banner */}
        <div className="w-full mb-4 p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 shadow-xs text-center backdrop-blur-md">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Owner Access
          </div>
          <p className="text-xs text-slate-700 font-medium">
            <strong className="text-slate-900">Customer has NO login.</strong> Managed exclusively by the business owner.
          </p>
        </div>

        {/* Main Clean White Card */}
        <div className="w-full bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Owner Sign In
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Sign in to manage your daily milk business operations
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="owner-email"
                className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide"
              >
                Owner Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="owner-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. milkhub@admin.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="owner-password"
                className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Demo Pre-fill Button */}
            <div className="pt-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">Need default credentials?</span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
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
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In as Owner</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer strictly with MilkHub • Developed by GenZ Neural X */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 z-10 gap-2 border-t border-slate-200/80">
        <div className="flex items-center gap-2 font-medium">
          <span className="font-bold text-slate-800">MilkHub</span>
          <span>•</span>
          <span className="text-emerald-700 font-semibold">Developed by GenZ Neural X</span>
        </div>
        <div className="text-[11px] text-slate-400">
          Daily Collection, Delivery & Payment Operations
        </div>
      </footer>
    </div>
  );
};
