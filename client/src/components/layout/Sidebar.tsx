import React from 'react';
import {
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

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'deliveries-morning',
      label: 'Morning Delivery',
      icon: <Sun className="w-4 h-4" />,
    },
    {
      id: 'deliveries-evening',
      label: 'Evening Delivery',
      icon: <Moon className="w-4 h-4" />,
    },
    {
      id: 'sales',
      label: 'Day-wise Sales',
      icon: <Receipt className="w-4 h-4" />,
    },
    {
      id: 'payments',
      label: 'Payments & Advance',
      icon: <CreditCard className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-64 bg-white text-slate-700 border-r border-slate-200/90 flex flex-col h-screen select-none shrink-0 shadow-xs">
      {/* Brand Header */}
      <div className="h-18 px-5 py-4 border-b border-slate-100 flex items-center gap-3 bg-white">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
          <Milk className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-black text-base text-slate-900 tracking-tight leading-tight truncate">
            MilkHub
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 tracking-tight truncate">
            Developed by GenZ Neural X
          </span>
        </div>
      </div>

      {/* Owner Access Badge */}
      <div className="mx-3 my-3 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col gap-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Owner Access Portal</span>
        </div>
        <p className="text-slate-600 text-[10px] leading-tight">
          Customer has <strong className="text-emerald-900">NO LOGIN</strong>.
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
        <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Menu
        </div>
        {navItems.map((item) => {
          const isCurrent = currentPath === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isCurrent
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={isCurrent ? 'text-white' : ''}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Footer: Owner Profile & Branding */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.email?.charAt(0).toUpperCase() || 'O'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {user?.email || 'Owner'}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold truncate">
                Business Owner
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out of Owner portal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center pt-1 border-t border-slate-200/60 text-[10px] text-slate-400 font-medium">
          MilkHub • Developed by GenZ Neural X
        </div>
      </div>
    </aside>
  );
};
