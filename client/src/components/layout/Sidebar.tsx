import React from 'react';
import {
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
  CheckCircle2,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout, dbStatus } = useAuth();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      active: true,
      phase: 'Phase 1',
      phaseStatus: 'Active',
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: <Users className="w-4 h-4" />,
      active: true,
      phase: 'Phase 2',
      phaseStatus: 'Active',
    },
    {
      id: 'deliveries-morning',
      label: 'Morning Delivery',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      active: true,
      phase: 'Phase 3',
      phaseStatus: 'Active',
    },
    {
      id: 'deliveries-evening',
      label: 'Evening Delivery',
      icon: <Moon className="w-4 h-4 text-indigo-400" />,
      active: true,
      phase: 'Phase 3',
      phaseStatus: 'Active',
    },
    {
      id: 'sales',
      label: 'Day-wise Sales',
      icon: <Receipt className="w-4 h-4 text-emerald-400" />,
      active: true,
      phase: 'Phase 4',
      phaseStatus: 'Active',
    },
    {
      id: 'payments',
      label: 'Payments & Advance',
      icon: <CreditCard className="w-4 h-4 text-emerald-400" />,
      active: true,
      phase: 'Phase 5',
      phaseStatus: 'Active',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      active: true,
      phase: 'Phase 6',
      phaseStatus: 'Active',
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col h-screen select-none shrink-0 shadow-xl">
      {/* Brand Header */}
      <div className="h-18 px-5 py-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shrink-0">
          <Milk className="w-5 h-5 text-slate-950" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-base text-white tracking-tight leading-tight truncate">
            MILK CRM
          </span>
          <span className="text-[11px] font-medium text-emerald-400 tracking-wide uppercase truncate">
            React + Node + TiDB
          </span>
        </div>
      </div>

      {/* Role Notice Card */}
      <div className="mx-3 my-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 flex flex-col gap-1 text-[11px]">
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Owner Access Portal</span>
        </div>
        <p className="text-slate-400 text-[10px] leading-tight">
          Customer has <strong className="text-emerald-300">NO LOGIN</strong>. Owner is the primary system user.
        </p>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
        <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Main Navigation
        </div>
        {navItems.map((item) => {
          const isCurrent = currentPath === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isCurrent
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={isCurrent ? 'text-slate-950' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  isCurrent
                    ? 'bg-slate-950 text-emerald-400'
                    : item.phaseStatus === 'Active'
                    ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {item.phase}
              </span>
            </button>
          );
        })}
      </nav>

      {/* TiDB Live Status Diagnostic */}
      <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[11px]">
        <div className="flex items-center justify-between text-slate-400 mb-1">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <Database className="w-3.5 h-3.5 text-teal-400" />
            TiDB Database
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              dbStatus?.connected
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-amber-950 text-amber-400 border border-amber-800'
            }`}
          >
            {dbStatus?.connected ? (
              <>
                <CheckCircle2 className="w-2.5 h-2.5" /> Live TiDB
              </>
            ) : (
              <>
                <AlertCircle className="w-2.5 h-2.5" /> Fallback Mode
              </>
            )}
          </span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          {dbStatus?.host}:{dbStatus?.port} • {dbStatus?.database}
        </div>
      </div>

      {/* Owner Profile & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0">
            {user?.email?.charAt(0).toUpperCase() || 'O'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {user?.email || 'Owner'}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium truncate">
              Owner (Primary User)
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Sign out of Owner portal"
          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
