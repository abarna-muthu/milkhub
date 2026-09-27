import React from 'react';
import {
  X,
  LayoutDashboard,
  Users,
  Sun,
  Moon,
  CreditCard,
  Settings,
  Database,
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
  const { user, logout, dbStatus } = useAuth();

  if (!isOpen) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, phase: 'Phase 1' },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" />, phase: 'Phase 2' },
    { id: 'deliveries-morning', label: 'Morning Delivery', icon: <Sun className="w-4 h-4 text-amber-500" />, phase: 'Phase 3' },
    { id: 'deliveries-evening', label: 'Evening Delivery', icon: <Moon className="w-4 h-4 text-indigo-400" />, phase: 'Phase 3' },
    { id: 'sales', label: 'Day-wise Sales', icon: <Receipt className="w-4 h-4 text-emerald-400" />, phase: 'Phase 4' },
    { id: 'payments', label: 'Payments & Advance', icon: <CreditCard className="w-4 h-4 text-emerald-400" />, phase: 'Phase 5' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, phase: 'Phase 6' },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[80vw] bg-slate-900 text-slate-200 h-full flex flex-col shadow-2xl z-10">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
              <Milk className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-white text-base">MILK CRM</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-emerald-950/40 border-b border-emerald-800/40 text-[11px] text-emerald-300">
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
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium ${
                  isCurrent
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <span className="text-[10px] opacity-70">{item.phase}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">{user?.email}</div>
            <div className="text-[10px] text-emerald-400">Owner Account</div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              onClose();
            }}
            className="p-2 text-rose-400 hover:bg-slate-800 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
