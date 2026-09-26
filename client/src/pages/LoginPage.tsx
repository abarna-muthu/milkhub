import React, { useState } from 'react';
import { Shield, ArrowRight, Lock, Mail, Eye, EyeOff, AlertCircle, Database } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Dedicated UI States
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidCredentialsError, setInvalidCredentialsError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    setValidationError(null);
    setInvalidCredentialsError(null);
    setServerError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setValidationError('Email address is required.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Allow standard admin@milkhub or standard email formats
    const isEmailValid = emailRegex.test(cleanEmail) || /^[^\s@]+@[^\s@]+$/.test(cleanEmail);
    if (!isEmailValid) {
      setValidationError('Please enter a valid email address.');
      return false;
    }

    if (!password) {
      setValidationError('Password is required.');
      return false;
    }

    if (password.length < 4) {
      setValidationError('Password must be at least 4 characters long.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setValidationError(null);
    setInvalidCredentialsError(null);
    setServerError(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      // Secure backend authentication
      const data = await authApi.login(cleanEmail, password);

      if (data && data.token && data.user) {
        login(data.token, data.user);
        showToast(
          language === 'ta' ? `வரவேற்கிறோம், ${data.user.name || 'உரிமையாளர்'}` : `Welcome back, ${data.user.name || 'Owner'}`,
          'success'
        );
        onLoginSuccess();
      } else {
        setInvalidCredentialsError('Invalid response received from authentication service.');
      }
    } catch (err: any) {
      console.error('[Login Error]:', err);
      const status = err.response?.status;
      const errorMsg = err.response?.data?.error;

      if (status === 400) {
        setValidationError(errorMsg || 'Please provide valid credentials.');
      } else if (status === 401) {
        setInvalidCredentialsError(errorMsg || 'Invalid email or password. Please verify your credentials.');
      } else if (status === 403) {
        setInvalidCredentialsError(errorMsg || 'Account is inactive. Please contact support.');
      } else {
        // Network / 500 error
        setServerError('Unable to connect to MilkHub backend server. Please verify the server is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutofillOwner = () => {
    setEmail('admin@milkhub.com');
    setPassword('@MilkHub#123');
    setValidationError(null);
    setInvalidCredentialsError(null);
    setServerError(null);
    showToast(
      language === 'ta' ? 'உரிமையாளர் விவரங்கள் நிரப்பப்பட்டன' : 'Owner credentials auto-filled',
      'info'
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-2xl shadow-lg border border-slate-800">
          MH
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          MilkHub CRM
        </h1>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mt-1">
          Owner Portal • TiDB Cloud Production
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
          {/* Error State Displays */}
          {validationError && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {invalidCredentialsError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{invalidCredentialsError}</span>
            </div>
          )}

          {serverError && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div>
              <label htmlFor="owner-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Owner Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="owner-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationError) setValidationError(null);
                    if (invalidCredentialsError) setInvalidCredentialsError(null);
                  }}
                  placeholder="admin@milkhub.com"
                  className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900 font-medium transition"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="owner-password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="owner-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationError) setValidationError(null);
                    if (invalidCredentialsError) setInvalidCredentialsError(null);
                  }}
                  placeholder="••••••••••••"
                  className="w-full h-10 pl-9 pr-10 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900 transition"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me & Note */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Remember session</span>
              </label>

              <span className="text-[11px] text-slate-400">Secure SHA-256 JWT</span>
            </div>

            {/* Submit Button (Handles Loading State) */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full justify-center shadow-sm mt-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold h-10"
              icon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              {isLoading ? 'Verifying Credentials...' : 'Sign In to MilkHub'}
            </Button>
          </form>

          {/* Quick Owner Autofill Helper */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>Default Owner Account</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutofillOwner}
                  className="text-[11px] font-semibold text-slate-900 hover:text-black underline cursor-pointer"
                >
                  Auto-fill
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Email</div>
                  <div className="font-mono font-bold text-slate-900 text-xs mt-0.5 truncate">
                    admin@milkhub.com
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Password</div>
                  <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">
                    @MilkHub#123
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-500 font-medium">
          MilkHub CRM • Production Node.js + React + TiDB
        </p>
      </div>
    </div>
  );
};
