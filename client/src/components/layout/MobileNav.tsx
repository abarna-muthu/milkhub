import React from 'react';
import {
  X,
  LayoutDashboard,
  Users,
  Sun,
  Moon,
  CreditCard,
  Settings,
  ShieldCheck,
  LogOut,
  Milk,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
  const { user, logout } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'deliveries-morning', label: 'Morning Delivery', icon: <Sun className="w-4 h-4" /> },
    { id: 'deliveries-evening', label: 'Evening Delivery', icon: <Moon className="w-4 h-4" /> },
    { id: 'sales', label: 'Day-wise Sales', icon: <Receipt className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments & Advance', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[80vw] bg-white text-slate-800 h-full flex flex-col shadow-2xl z-10 border-r border-slate-200">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold">
              <Milk className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-slate-900 text-base">MilkHub</span>
              <div className="text-[10px] text-emerald-700 font-semibold leading-none">
                Developed by GenZ Neural X
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-emerald-50/80 border-b border-emerald-100 text-[11px] text-emerald-800 font-medium">
          Customer has NO LOGIN. Owner is the primary system user.
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isCurrent = currentPath === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center p-2.5 rounded-xl text-xs font-semibold ${
                  isCurrent
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isCurrent ? 'text-white' : ''}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">{user?.email}</div>
            <div className="text-[10px] text-emerald-700 font-semibold">Owner Account</div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
