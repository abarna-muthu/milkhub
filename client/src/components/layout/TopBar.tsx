import React from 'react';
import {
  Menu,
  Database,
  ShieldCheck,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopBarProps {
  onToggleMobileMenu: () => void;
  onNavigate: (path: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileMenu }) => {
  const { user, logout, dbStatus, refreshDbStatus, isLoading } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 tracking-tight">
            Milk Business CRM
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Sparkles className="w-2.5 h-2.5" /> Phase 7 Tested & Deployment Ready
          </span>
        </div>
      </div>

      {/* Right: Architecture Badge, TiDB Diagnostic, User info & Logout */}
      <div className="flex items-center gap-3">
        {/* Architecture Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs border border-slate-200">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold">Customer has NO login</span>
        </div>

        {/* TiDB Status Quick Indicator */}
        <button
          type="button"
          onClick={refreshDbStatus}
          title="Click to refresh TiDB connection status"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
            dbStatus?.connected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            TiDB: {dbStatus?.connected ? 'Online' : 'Fallback'}
          </span>
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Owner Account Details */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-900 leading-tight">
              {user?.email}
            </div>
            <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
              Primary System User
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
