import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Bell,
  Globe,
  ChevronDown,
  Building2,
  Menu,
  Shield,
  LogOut,
  UserCheck,
  Check,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useCenter } from '../../context/CenterContext';
import { NotificationItem, Customer } from '../../types';
import { notificationsApi, customersApi } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

interface TopBarProps {
  onToggleMobileMenu: () => void;
  onNavigate: (path: string, param?: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileMenu, onNavigate }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAdmin, logout, switchRole } = useAuth();
  const { centers, selectedCenterId, setSelectedCenterId } = useCenter();

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notification State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load Notifications
  const loadNotifications = async () => {
    try {
      const data = await notificationsApi.getAll();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      // Fallback notifications if offline
      setNotifications([
        { id: '1', title: 'Payment pending for Kumar (MILK001)', message: '₹849.00 pending for settlement', type: 'payment', read: false, timestamp: new Date().toISOString() },
        { id: '2', title: 'Monthly settlement due', message: 'Cycle 16-30 Sept ready', type: 'settlement', read: false, timestamp: new Date().toISOString() },
        { id: '3', title: 'New supplier added', message: 'Govindaraj registered', type: 'supplier', read: false, timestamp: new Date().toISOString() },
      ]);
      setUnreadCount(3);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Quick Customer Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await customersApi.getAll({ search: searchQuery, limit: 5 });
        setSearchResults(data.customers || []);
        setIsSearchOpen(true);
      } catch (err) {
        console.warn('Search error', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listeners
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    onNavigate('customers', customer.id);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      {/* Left: Mobile hamburger & Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar */}
        <div ref={searchRef} className="relative flex-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-brand-800 transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Quick Search Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-dropdown overflow-hidden z-50">
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                Matching Suppliers
              </div>
              <div className="max-h-60 overflow-y-auto">
                {searchResults.map((cust) => (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectCustomer(cust)}
                    className="w-full px-3 py-2 text-left hover:bg-brand-50/50 flex items-center justify-between border-b border-slate-100 last:border-b-0 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{cust.name}</span>
                      <span className="ml-2 font-mono text-brand-900 bg-brand-50 px-1.5 py-0.5 rounded text-[10px]">
                        {cust.customer_code}
                      </span>
                      <div className="text-[11px] text-slate-500">{cust.village} • {cust.mobile}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-600 block">
                        Cows: {cust.cow_count} | Buff: {cust.buffalo_count}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Center Switcher, Notifications, Language, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Collection Center Dropdown */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded px-2.5 h-9 text-xs">
          <Building2 className="w-3.5 h-3.5 text-brand-800 shrink-0" />
          <select
            value={selectedCenterId}
            onChange={(e) => setSelectedCenterId(e.target.value)}
            aria-label={t('collection_centers')}
            className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">{t('all_centers')}</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center border border-slate-300 rounded overflow-hidden h-9 bg-white">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 text-xs font-semibold h-full transition-colors ${
              language === 'en'
                ? 'bg-brand-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ta')}
            className={`px-2.5 text-xs font-semibold h-full transition-colors ${
              language === 'ta'
                ? 'bg-brand-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            தமிழ்
          </button>
        </div>

        {/* Notifications Dropdown */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded border border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 relative h-9 w-9 flex items-center justify-center transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-md shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                    {t('notifications')}
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-brand-100 text-brand-900 text-[10px] font-bold px-1.5 py-0.2 rounded">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-brand-800 hover:underline font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors hover:bg-slate-50 ${
                        !n.read ? 'bg-emerald-50/30' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-slate-900">{n.title}</span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{n.message}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {formatDateTime(n.timestamp)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Quick Role Switch */}
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 h-9 px-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors"
          >
            <div className="w-6 h-6 rounded bg-brand-900 text-white flex items-center justify-center text-xs font-bold">
              {user?.name ? user.name.charAt(0) : 'U'}
            </div>
            <span className="hidden sm:inline text-xs font-medium max-w-[100px] truncate">
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-md shadow-xl z-50 overflow-hidden text-xs">
              <div className="p-3 border-b border-slate-100 bg-slate-50/70">
                <div className="font-semibold text-slate-900">{user?.name}</div>
                <div className="text-[11px] text-slate-500">{user?.email}</div>
                <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-brand-100 text-brand-900 border border-brand-300">
                  Active Role: {isAdmin ? 'ADMIN' : 'STAFF'}
                </div>
              </div>

              {/* Role Switcher Demo Tool */}
              <div className="p-2 border-b border-slate-100 bg-slate-50/30">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Switch Active Role (Demo)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    switchRole('admin');
                    setIsUserMenuOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs ${
                    isAdmin ? 'bg-brand-50 text-brand-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-brand-800" />
                    Admin (Full Access)
                  </span>
                  {isAdmin && <Check className="w-3.5 h-3.5 text-brand-800" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    switchRole('staff');
                    setIsUserMenuOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between text-xs ${
                    !isAdmin ? 'bg-brand-50 text-brand-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                    Collection Staff (Limited)
                  </span>
                  {!isAdmin && <Check className="w-3.5 h-3.5 text-brand-800" />}
                </button>
              </div>

              {/* Logout */}
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                    onNavigate('login');
                  }}
                  className="w-full text-left px-3 py-2 text-rose-700 hover:bg-rose-50 rounded flex items-center gap-2 text-xs font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
