import React, { useState } from 'react';
import { Milk, Shield, UserCheck, ArrowRight, Lock, Phone } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, switchRole } = useAuth();
  const { t, language } = useLanguage();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      showToast(
        language === 'ta'
          ? 'பயனர் பெயர் மற்றும் கடவுச்சொல்லை உள்ளிடவும்'
          : 'Please enter both Username and Password',
        'warning'
      );
      return;
    }

    setIsLoading(true);
    try {
      const data = await authApi.login(cleanId, password);
      login(data.token, data.user);
      showToast(
        language === 'ta' ? `வரவேற்கிறோம், ${data.user.name}` : `Welcome back, ${data.user.name}`,
        'success'
      );
      onLoginSuccess();
    } catch (err: any) {
      // Strict fallback validation - ONLY admin@MilkHub and @MilkHub#123 allowed
      if (
        (cleanId.toLowerCase() === 'admin@milkhub' || cleanId.toLowerCase() === 'admin') &&
        password === '@MilkHub#123'
      ) {
        login('u1', {
          id: 'u1',
          name: 'Admin',
          mobile: '9842100001',
          email: 'admin@MilkHub',
          role: 'admin',
          collection_center_id: 'c1',
          collection_center_name: 'Srivilliputtur Center',
          status: 'active',
        });
        showToast(
          language === 'ta'
            ? 'வரவேற்கிறோம்! வெற்றிகரமாக உள்நுழைந்தது'
            : 'Welcome! Logged in as Administrator',
          'success'
        );
        onLoginSuccess();
      } else {
        showToast(
          language === 'ta'
            ? 'தவறான பயனர் பெயர் அல்லது கடவுச்சொல்! (பயனர் பெயர்: admin@MilkHub, கடவுச்சொல்: @MilkHub#123)'
            : 'Invalid Username or Password! (Username: admin@MilkHub, Password: @MilkHub#123)',
          'error'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillCredentials = () => {
    setIdentifier('admin@MilkHub');
    setPassword('@MilkHub#123');
    showToast(
      language === 'ta'
        ? 'நிர்வாகி விவரங்கள் நிரப்பப்பட்டன! உள்நுழைக என்பதை அழுத்தவும்.'
        : 'Credentials auto-filled! Click Sign In to continue.',
      'info'
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-xl bg-brand-900 text-white mx-auto flex items-center justify-center font-bold text-xl shadow-md border border-brand-950">
          MH
        </div>
        <h1 className="mt-4 text-2xl font-black text-slate-900 tracking-tight">
          {t('brand_name')}
        </h1>
        <p className="text-xs font-semibold text-brand-800 uppercase tracking-widest mt-0.5">
          {t('login_title')}
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-card rounded-lg border border-slate-200 sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('mobile_or_email')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@MilkHub"
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-brand-800 text-slate-900 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('password')}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="@MilkHub#123"
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-brand-800 text-slate-900"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-brand-900 focus:ring-brand-800"
                />
                {t('remember_me')}
              </label>

              <button
                type="button"
                onClick={() => showToast('Please contact dairy admin to reset password', 'info')}
                className="font-medium text-brand-800 hover:text-brand-900"
              >
                {t('forgot_password')}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full justify-center shadow-md mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {t('sign_in')}
            </Button>
          </form>

          {/* Official Admin Credentials Card */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="p-3 bg-brand-50/60 border border-brand-200/80 rounded-lg text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-brand-950">
                  <Shield className="w-4 h-4 text-brand-800" />
                  <span>{t('admin_credentials_box')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleFillCredentials}
                  className="text-[11px] font-semibold text-brand-800 hover:text-brand-950 underline cursor-pointer"
                >
                  {t('autofill')}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-brand-100">
                <div className="bg-white p-2 rounded border border-brand-100">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">{t('mobile_or_email')}</div>
                  <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">admin@MilkHub</div>
                </div>
                <div className="bg-white p-2 rounded border border-brand-100">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">{t('password')}</div>
                  <div className="font-mono font-bold text-slate-900 text-xs mt-0.5">@MilkHub#123</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-slate-500 font-medium">
          MilkHub • {t('developed_by')}
        </p>
      </div>
    </div>
  );
};
