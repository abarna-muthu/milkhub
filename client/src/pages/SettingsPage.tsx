import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  DollarSign,
  CreditCard,
  Users,
  Globe,
  Database,
  Bell,
  Check,
  Shield,
} from 'lucide-react';
import { BusinessSettings } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { settingsApi } from '../services/api';

export const SettingsPage: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { isAdmin, switchRole } = useAuth();
  const { showToast } = useToast();

  const [activeSection, setActiveSection] = useState<
    'profile' | 'rates' | 'payments' | 'roles' | 'language' | 'backup'
  >('profile');

  const [settings, setSettings] = useState<BusinessSettings>({
    business_name: 'MilkHub Dairy & Milk Collection',
    tagline: 'Precision Dairy Operations & Farmer Management Platform • Developed by Gen Z Neural-X',
    brand_code: 'MILKHUB',
    phone: '+91 98421 00001',
    email: 'operations@milkhubdairy.com',
    address: '42, Dairy Development Road, Near Milk Chilling Center',
    district: 'Virudhunagar',
    state: 'Tamil Nadu',
    default_pricing_mode: 'fat_snf',
    base_cow_rate: 42.0,
    base_buffalo_rate: 52.0,
    default_language: 'en',
    whatsapp_enabled: true,
    currency_symbol: '₹',
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then((data) => {
      if (data) setSettings(data);
    });
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Only Administrators can save system settings', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await settingsApi.update(settings);
      setSettings(updated);
      showToast('Business & system settings saved successfully', 'success');
    } catch (err: any) {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    const backupJson = JSON.stringify(settings, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MilkHub_Dairy_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Database configuration backup downloaded', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {t('settings')} &amp; Dairy Profile
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          General business metadata, pricing formulas, WhatsApp integration, and language preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Settings Navigation Sidebar (3 cols) */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg p-2 shadow-subtle space-y-1 text-xs">
          {[
            { id: 'profile', label: 'Business Profile', icon: <Building className="w-4 h-4" /> },
            { id: 'rates', label: 'Pricing Engine Defaults', icon: <DollarSign className="w-4 h-4" /> },
            { id: 'payments', label: 'Payment Channels', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'roles', label: 'Users & Permissions', icon: <Users className="w-4 h-4" /> },
            { id: 'language', label: 'Language & Locale', icon: <Globe className="w-4 h-4" /> },
            { id: 'backup', label: 'System Backup & TiDB', icon: <Database className="w-4 h-4" /> },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id as any)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded font-medium transition-colors ${
                activeSection === item.id
                  ? 'bg-brand-900 text-white shadow-subtle'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Form Container (9 cols) */}
        <div className="md:col-span-9 bg-white border border-slate-200 rounded-lg p-6 shadow-subtle">
          <form onSubmit={handleSaveSettings} className="space-y-5 text-xs">
            {/* Section 1: Business Profile */}
            {activeSection === 'profile' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">Dairy Federation &amp; Business Profile</h2>
                  <p className="text-[11px] text-slate-500">Header information used on PDF statements and receipts</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business / Dairy Name</label>
                  <input
                    type="text"
                    value={settings.business_name}
                    onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800 font-semibold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Brand Tagline</label>
                    <input
                      type="text"
                      value={settings.tagline}
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Brand Code</label>
                    <input
                      type="text"
                      value={settings.brand_code}
                      onChange={(e) => setSettings({ ...settings, brand_code: e.target.value })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800 uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Official Mobile / Helpline</label>
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Operations Email</label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registered Address</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">District</label>
                    <input
                      type="text"
                      value={settings.district}
                      onChange={(e) => setSettings({ ...settings, district: e.target.value })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={settings.state}
                      onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Rates Default */}
            {activeSection === 'rates' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">Pricing Engine Defaults</h2>
                  <p className="text-[11px] text-slate-500">Configure default pricing calculation mode across all collection docks</p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-2">Default Pricing Model</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-3 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                      <input
                        type="radio"
                        name="pricing"
                        checked={settings.default_pricing_mode === 'fat_snf'}
                        onChange={() => setSettings({ ...settings, default_pricing_mode: 'fat_snf' })}
                        className="text-brand-900 focus:ring-brand-800"
                      />
                      <div>
                        <div className="font-bold text-slate-900">Fat &amp; SNF Formula (Recommended)</div>
                        <div className="text-[11px] text-slate-500">Indexed to Fat &gt; 4.2% and SNF &gt; 8.5%</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-3 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                      <input
                        type="radio"
                        name="pricing"
                        checked={settings.default_pricing_mode === 'fixed'}
                        onChange={() => setSettings({ ...settings, default_pricing_mode: 'fixed' })}
                        className="text-brand-900 focus:ring-brand-800"
                      />
                      <div>
                        <div className="font-bold text-slate-900">Fixed Rate per Litre</div>
                        <div className="text-[11px] text-slate-500">Flat rate regardless of fat percentage</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standard Cow Base Rate (₹/L)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={settings.base_cow_rate}
                      onChange={(e) => setSettings({ ...settings, base_cow_rate: parseFloat(e.target.value) || 42 })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Standard Buffalo Base Rate (₹/L)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={settings.base_buffalo_rate}
                      onChange={(e) => setSettings({ ...settings, base_buffalo_rate: parseFloat(e.target.value) || 52 })}
                      className="w-full h-9 px-3 bg-white border border-slate-300 rounded font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Payment Channels & WhatsApp */}
            {activeSection === 'payments' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">Payment &amp; Communication Channels</h2>
                  <p className="text-[11px] text-slate-500">Enable disbursement methods and farmer WhatsApp notification gateway</p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded border border-slate-200 bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">Direct Cash Counter Disbursements</div>
                      <div className="text-[11px] text-slate-500">Allow counter cash payouts with instant voucher generation</div>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand-900" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded border border-slate-200 bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">UPI / QR Code Transfers</div>
                      <div className="text-[11px] text-slate-500">Log UPI transaction reference numbers</div>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand-900" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded border border-slate-200 bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">Direct Bank NEFT / IMPS</div>
                      <div className="text-[11px] text-slate-500">Support bank account disbursement batches</div>
                    </div>
                    <input type="checkbox" defaultChecked className="rounded border-slate-300 text-brand-900" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded border border-emerald-200 bg-emerald-50/50">
                    <div>
                      <div className="font-bold text-emerald-950">WhatsApp Cloud Direct Messages</div>
                      <div className="text-[11px] text-emerald-800">
                        Enable pre-formatted Tamil &amp; English WhatsApp payment receipts &amp; settlement summaries
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.whatsapp_enabled}
                      onChange={(e) => setSettings({ ...settings, whatsapp_enabled: e.target.checked })}
                      className="rounded border-emerald-300 text-brand-900 focus:ring-brand-800"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Section 4: Users & Roles */}
            {activeSection === 'roles' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">Role-Based Access Control (RBAC)</h2>
                  <p className="text-[11px] text-slate-500">Verify permission enforcement between Administrator and Collection Staff</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded border border-brand-200 bg-brand-50/40">
                    <div className="flex items-center gap-2 text-brand-900 font-bold mb-1">
                      <Shield className="w-4 h-4" />
                      Administrator
                    </div>
                    <p className="text-[11px] text-slate-600 mb-3">
                      Full access to Dashboard, Suppliers, Collections, Rates, Payments, Ledger, Reports, Expenses, Staff, and Settings.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        switchRole('admin');
                        showToast('Switched to Administrator role', 'success');
                      }}
                    >
                      {isAdmin ? 'Active Now' : 'Switch to Admin'}
                    </Button>
                  </div>

                  <div className="p-4 rounded border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2 text-slate-800 font-bold mb-1">
                      <Users className="w-4 h-4" />
                      Collection Staff
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Restricted to Daily Milk Collection, View Suppliers, Record Payments, and Limited Reports. Cannot change rates or delete records.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        switchRole('staff');
                        showToast('Switched to Staff role', 'info');
                      }}
                    >
                      {!isAdmin ? 'Active Now' : 'Switch to Staff'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 5: Language & Locale */}
            {activeSection === 'language' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    {language === 'ta' ? 'மொழி அமைப்புகள்' : 'Language & Localization'}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {language === 'ta'
                      ? 'பயன்பாட்டு மொழியை ஆங்கிலம் அல்லது தமிழாக மாற்றவும்'
                      : 'Choose your preferred application language'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      showToast(
                        language === 'ta'
                          ? 'மொழி ஆங்கிலத்திற்கு மாற்றப்பட்டது'
                          : 'Language set to English',
                        'info'
                      );
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      language === 'en'
                        ? 'border-brand-800 bg-brand-50 text-brand-900 font-bold shadow-xs ring-1 ring-brand-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-base font-bold">
                      {language === 'ta' ? 'ஆங்கிலம்' : 'English'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-1">
                      {language === 'ta'
                        ? 'நிலையான ஆங்கில பால் பண்ணை பயன்பாடு'
                        : 'Standard English dairy operations terminology'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('ta');
                      showToast(
                        language === 'ta'
                          ? 'மொழி தமிழுக்கு மாற்றப்பட்டது'
                          : 'Language changed to Tamil',
                        'info'
                      );
                    }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      language === 'ta'
                        ? 'border-brand-800 bg-brand-50 text-brand-900 font-bold shadow-xs ring-1 ring-brand-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-base font-bold">
                      {language === 'ta' ? 'தமிழ்' : 'Tamil'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-normal mt-1">
                      {language === 'ta'
                        ? 'பால் பண்ணை மற்றும் சேகரிப்பு நிலையங்களுக்கான தமிழ் பயன்பாடு'
                        : 'Tamil interface for milk collection and dairy centers'}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Section 6: Backup & TiDB */}
            {activeSection === 'backup' && (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-slate-900">System Database &amp; TiDB Cloud Sync</h2>
                  <p className="text-[11px] text-slate-500">Local JSON persistent storage with TiDB / MySQL production connector</p>
                </div>

                <div className="p-4 rounded border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Local High-Speed Persistence</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        server/data/dairy_crm.json (Synchronized with 186 suppliers)
                      </div>
                    </div>
                    <Badge variant="success">Operational</Badge>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Download Offline JSON Backup</div>
                      <div className="text-[11px] text-slate-500">Save complete state to local disk</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadBackup}
                    >
                      Export Backup
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded border border-slate-200 bg-slate-50">
                  <div className="font-bold text-slate-900 mb-1">TiDB / MySQL Connection Environment</div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    To connect to a live TiDB Serverless or MySQL cluster, specify <code className="bg-slate-200 px-1 py-0.5 rounded">TIDB_HOST</code>, <code className="bg-slate-200 px-1 py-0.5 rounded">TIDB_PORT</code>, and credentials in the server <code className="bg-slate-200 px-1 py-0.5 rounded">.env</code>. The DDL script is located in <code className="bg-slate-200 px-1 py-0.5 rounded">server/src/db/schema.sql</code>.
                  </p>
                </div>
              </div>
            )}

            {/* Save Action */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSaving}
                icon={<Check className="w-4 h-4" />}
              >
                Save All Settings
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
