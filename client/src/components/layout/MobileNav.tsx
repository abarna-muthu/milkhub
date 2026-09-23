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
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCenter } from '../../context/CenterContext';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentPath,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { isAdmin, user } = useAuth();
  const { selectedCenterName } = useCenter();

  const navItems = [
    { path: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard className="w-4 h-4" />, adminOnly: false },
    { path: 'customers', label: t('customers'), icon: <Users className="w-4 h-4" />, adminOnly: false },
    { path: 'collection', label: t('milk_collection'), icon: <Milk className="w-4 h-4" />, adminOnly: false },
    { path: 'payments', label: t('payments_settlement'), icon: <CreditCard className="w-4 h-4" />, adminOnly: false },
    { path: 'ledger', label: t('customer_ledger'), icon: <BookOpen className="w-4 h-4" />, adminOnly: false },
    { path: 'rates', label: t('milk_rates'), icon: <DollarSign className="w-4 h-4" />, adminOnly: true },
    { path: 'reports', label: t('reports'), icon: <FileBarChart className="w-4 h-4" />, adminOnly: false },
    { path: 'expenses', label: t('expenses'), icon: <Receipt className="w-4 h-4" />, adminOnly: false },
    { path: 'staff', label: t('staff_management'), icon: <UserCog className="w-4 h-4" />, adminOnly: true },
    { path: 'centers', label: t('collection_centers'), icon: <Building2 className="w-4 h-4" />, adminOnly: false },
    { path: 'settings', label: t('settings'), icon: <Settings className="w-4 h-4" />, adminOnly: false },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl flex flex-col z-50 border-r border-slate-200">
        {/* Header */}
        <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-brand-900 text-white flex items-center justify-center font-bold text-sm">
              MH
            </div>
            <div>
              <div className="font-bold text-xs text-slate-900">{t('brand_name')}</div>
              <div className="text-[10px] text-brand-800 font-medium">{selectedCenterName}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const isActive = currentPath === item.path;

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  onNavigate(item.path);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-900 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs">
          <div className="text-slate-900 font-medium truncate">{user?.name}</div>
          <div className="text-slate-500 text-[10px] uppercase font-semibold">
            {isAdmin ? 'Administrator' : 'Collection Staff'}
          </div>
          <div className="text-[9px] text-slate-500 pt-1 mt-1 border-t border-slate-200/60 font-medium">
            {t('developed_by')}
          </div>
        </div>
      </div>
    </div>
  );
};
