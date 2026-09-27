import React from 'react';
import {
  LayoutDashboard,
  Users,
  Milk,
  CreditCard,
  BookOpen,
  DollarSign,
  FileBarChart,
  Receipt,
  UserCog,
  Building2,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCenter } from '../../context/CenterContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { t } = useLanguage();
  const { isAdmin, user } = useAuth();
  const { selectedCenterName } = useCenter();

  const navItems = [
    { path: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard className="w-4 h-4" />, adminOnly: false },
    { path: 'customers', label: t('customers'), icon: <Users className="w-4 h-4" />, adminOnly: false },
    { path: 'deliveries-morning', label: 'Morning Delivery', icon: <Sun className="w-4 h-4 text-amber-500" />, adminOnly: false },
    { path: 'deliveries-evening', label: 'Evening Delivery', icon: <Moon className="w-4 h-4 text-indigo-400" />, adminOnly: false },
    { path: 'collection', label: t('milk_collection'), icon: <Milk className="w-4 h-4" />, adminOnly: false, badge: 'Core' },
    { path: 'payments', label: t('payments_settlement'), icon: <CreditCard className="w-4 h-4" />, adminOnly: false },
    { path: 'ledger', label: t('customer_ledger'), icon: <BookOpen className="w-4 h-4" />, adminOnly: false },
    { path: 'rates', label: t('milk_rates'), icon: <DollarSign className="w-4 h-4" />, adminOnly: true },
    { path: 'reports', label: t('reports'), icon: <FileBarChart className="w-4 h-4" />, adminOnly: false },
    { path: 'expenses', label: t('expenses'), icon: <Receipt className="w-4 h-4" />, adminOnly: false },
    { path: 'staff', label: t('staff_management'), icon: <UserCog className="w-4 h-4" />, adminOnly: true },
    { path: 'centers', label: t('collection_centers'), icon: <Building2 className="w-4 h-4" />, adminOnly: false },
    { path: 'settings', label: t('settings'), icon: <Settings className="w-4 h-4" />, adminOnly: false },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-200 px-5 flex items-center gap-3 bg-white">
        <div className="w-9 h-9 rounded-md bg-brand-900 text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0 border border-brand-950 tracking-tight">
          MH
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base text-slate-900 tracking-tight truncate">
              {t('brand_name')}
            </span>
          </div>
          <span className="text-[10px] font-medium text-brand-800 tracking-wider uppercase truncate">
            {t('brand_sub')}
          </span>
        </div>
      </div>

      {/* Active Center Badge Banner */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
          <span className="truncate font-medium">{selectedCenterName}</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        <div className="px-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {t('main_menu')}
        </div>
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;

          const isActive = currentPath === item.path;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-brand-900 text-white shadow-subtle'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={isActive ? 'text-white' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                    isActive
                      ? 'bg-brand-800 text-brand-100'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Role Card & Developed by in Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2">
        <div className="flex items-center gap-2.5 p-2 rounded-md bg-white border border-slate-200">
          <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-900 border border-brand-300 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.name ? user.name.charAt(0) : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user?.name || (isAdmin ? t('role_admin') : t('role_staff'))}
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span
                className={`font-semibold uppercase tracking-wider ${
                  isAdmin ? 'text-brand-800' : 'text-slate-600'
                }`}
              >
                {isAdmin ? t('role_admin') : t('role_staff')}
              </span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-center text-slate-400 font-medium">
          {t('developed_by')}
        </div>
      </div>
    </aside>
  );
};
