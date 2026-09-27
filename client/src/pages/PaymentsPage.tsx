import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  PlusCircle,
  RefreshCw,
  Search,
  X,
  Phone,
  MapPin,
  IndianRupee,
  History,
  ShieldCheck,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingDown,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Customer,
  Payment,
  DayWiseSaleItem,
  CustomerAdvanceInfo,
} from '../types';
import { customerApi, paymentApi, salesApi } from '../services/api';
import { useToast } from '../context/ToastContext';

interface PaymentsPageProps {
  initialTab?: 'daily' | 'advance' | 'log';
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({ initialTab = 'daily' }) => {
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'daily' | 'advance' | 'log'>(initialTab);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters required by specification:
  // - Date
  // - Customer
  // - Daily/Advance
  // - Paid/Partial/Due
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'daily' | 'advance'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'due'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Core Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [todaySales, setTodaySales] = useState<DayWiseSaleItem[]>([]);
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [customerAdvances, setCustomerAdvances] = useState<Record<string, CustomerAdvanceInfo>>({});

  // Modals
  const [isDailyPaymentModalOpen, setIsDailyPaymentModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [ledgerModalCustomer, setLedgerModalCustomer] = useState<CustomerAdvanceInfo | null>(null);

  // Form State: Daily Payment
  const [dailyForm, setDailyForm] = useState({
    customer_id: '',
    date: todayStr,
    amount: '',
    payment_mode: 'cash',
  });

  // Form State: Advance
  const [advanceForm, setAdvanceForm] = useState({
    customer_id: '',
    date: todayStr,
    amount: '',
    payment_mode: 'upi',
  });

  // Sync if initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Load all required data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Load active customers
      const custList = await customerApi.getAll({ status: 'active' }).catch(() => ({ customers: [] }));
      const activeCusts = Array.isArray(custList?.customers) ? custList.customers : [];
      setCustomers(activeCusts);

      // 2. Load sales for selected date to know due amounts
      const salesData = await salesApi.getDayWiseSales(selectedDate).catch(() => ({ sales: [] }));
      setTodaySales(Array.isArray(salesData?.sales) ? salesData.sales : []);

      // 3. Load payments for selected date
      const payData = await paymentApi.getPayments({ date: selectedDate }).catch(() => ({ payments: [] }));
      setPaymentsList(Array.isArray(payData?.payments) ? payData.payments : []);

      // 4. Fetch advance balances for all active customers
      const advMap: Record<string, CustomerAdvanceInfo> = {};
      if (Array.isArray(activeCusts)) {
        await Promise.all(
          activeCusts.map(async (c) => {
            try {
              const adv = await paymentApi.getCustomerAdvance(c.id);
              if (adv) advMap[c.id] = adv;
            } catch (e) {
              // Ignore individual failure
            }
          })
        );
      }
      setCustomerAdvances(advMap);
    } catch (err: any) {
      console.error('Failed to load payments data:', err);
      showToast(err.response?.data?.error || 'Failed to load payments data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived KPI metrics
  const totalDailyCashCollectedToday = useMemo(() => {
    return (paymentsList || [])
      .filter((p) => p?.payment_type === 'daily')
      .reduce((acc, p) => acc + (Number(p?.amount) || 0), 0);
  }, [paymentsList]);

  const totalAdvanceReceivedToday = useMemo(() => {
    return (paymentsList || [])
      .filter((p) => p?.payment_type === 'advance')
      .reduce((acc, p) => acc + (Number(p?.amount) || 0), 0);
  }, [paymentsList]);

  const totalOutstandingDueToday = useMemo(() => {
    return (todaySales || []).reduce((acc, s) => acc + (Number(s?.due) || 0), 0);
  }, [todaySales]);

  const totalAdvanceBalanceAllCustomers = useMemo(() => {
    return Object.values(customerAdvances || {}).reduce(
      (acc, a) => acc + (Number(a?.advance_balance) || 0),
      0
    );
  }, [customerAdvances]);

  // Handle customer selection in Daily Payment Modal to auto-fill due amount
  const handleDailyCustomerChange = (customerId: string) => {
    const saleItem = todaySales.find((s) => s.customer_id === customerId);
    const suggestedAmount = saleItem ? saleItem.due : 0;
    setDailyForm((prev) => ({
      ...prev,
      customer_id: customerId,
      amount: Number(suggestedAmount) > 0 ? String(suggestedAmount) : '',
    }));
  };

  // Open Daily Payment Modal pre-filled for a specific customer
  const handleQuickPayCustomer = (customerId: string) => {
    handleDailyCustomerChange(customerId);
    setDailyForm((prev) => ({ ...prev, date: selectedDate }));
    setIsDailyPaymentModalOpen(true);
  };

  // Submit Daily Payment
  const handleDailyPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyForm.customer_id) {
      showToast('Please select a customer', 'error');
      return;
    }
    const amt = Number(dailyForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentApi.recordPayment({
        customer_id: dailyForm.customer_id,
        date: dailyForm.date,
        amount: amt,
        payment_type: 'daily',
        payment_mode: dailyForm.payment_mode,
      });

      showToast(`Daily payment of ₹${amt} recorded successfully!`, 'success');
      setIsDailyPaymentModalOpen(false);
      setDailyForm({
        customer_id: '',
        date: selectedDate,
        amount: '',
        payment_mode: 'cash',
      });
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Payment recording failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Advance Deposit
  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.customer_id) {
      showToast('Please select a customer', 'error');
      return;
    }
    const amt = Number(advanceForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid advance credit amount', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await paymentApi.recordPayment({
        customer_id: advanceForm.customer_id,
        date: advanceForm.date,
        amount: amt,
        payment_type: 'advance',
        payment_mode: advanceForm.payment_mode,
      });

      showToast(
        `Advance of ₹${amt} credited! New advance balance: ₹${res.advance_balance}`,
        'success'
      );
      setIsAdvanceModalOpen(false);
      setAdvanceForm({
        customer_id: '',
        date: selectedDate,
        amount: '',
        payment_mode: 'upi',
      });
      loadData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.message || 'Advance deposit failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Ledger Modal for a customer
  const handleOpenLedger = async (customerId: string) => {
    try {
      const info = await paymentApi.getCustomerAdvance(customerId);
      setLedgerModalCustomer(info);
    } catch (err: any) {
      showToast('Failed to fetch advance ledger details', 'error');
    }
  };

  // Helper to determine Paid/Partial/Due status of a sale item
  const getSaleStatus = (item: DayWiseSaleItem): 'paid' | 'partial' | 'due' => {
    if (item.due <= 0 && item.sale_amount > 0) return 'paid';
    if (item.paid > 0 && item.due > 0) return 'partial';
    return 'due';
  };

  // Filtered Daily Sales by:
  // - Customer filter
  // - Paid / Partial / Due status filter
  // - Search query
  const filteredDailySales = useMemo(() => {
    return todaySales.filter((item) => {
      // Customer filter
      if (customerFilter !== 'all' && item.customer_id !== customerFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const st = getSaleStatus(item);
        if (st !== statusFilter) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.customer_name?.toLowerCase().includes(q);
        const matchesArea = item.customer_area?.toLowerCase().includes(q);
        const matchesPhone = item.customer_phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesArea && !matchesPhone) return false;
      }
      return true;
    });
  }, [todaySales, customerFilter, statusFilter, searchQuery]);

  // Filtered Customer Advances list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (customerFilter !== 'all' && c.id !== customerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.area.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, customerFilter, searchQuery]);

  // Filtered Payment Transactions Log by:
  // - Date (already handled by API, synced with selectedDate)
  // - Customer filter
  // - Daily / Advance filter
  // - Search query
  const filteredPaymentsLog = useMemo(() => {
    return paymentsList.filter((p) => {
      if (customerFilter !== 'all' && p.customer_id !== customerFilter) return false;
      if (paymentTypeFilter !== 'all' && p.payment_type !== paymentTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cust = customers.find((c) => c.id === p.customer_id);
        const matchesName = cust?.name.toLowerCase().includes(q);
        const matchesPhone = cust?.phone.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId) return false;
      }
      return true;
    });
  }, [paymentsList, customerFilter, paymentTypeFilter, searchQuery, customers]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Payments & Advance Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track daily sales payments, automatic advance adjustments, customer credit balances, and traceable transaction logs.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setDailyForm({
                customer_id: '',
                date: selectedDate,
                amount: '',
                payment_mode: 'cash',
              });
              setIsDailyPaymentModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Daily Payment</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdvanceForm({
                customer_id: '',
                date: selectedDate,
                amount: '',
                payment_mode: 'upi',
              });
              setIsAdvanceModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
          >
            <Wallet className="w-4 h-4" />
            <span>+ Deposit Advance</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh payments"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Daily Cash Collected</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              ₹{totalDailyCashCollectedToday.toFixed(2)}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Recorded daily payments for {selectedDate}</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Advance Deposits</span>
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-indigo-600 tracking-tight">
              ₹{totalAdvanceReceivedToday.toFixed(2)}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Credit added for future sales</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Customer Advance Pool</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Wallet className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-amber-600 tracking-tight">
              ₹{totalAdvanceBalanceAllCustomers.toFixed(2)}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Total credit held across all customers</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Outstanding Due Today</span>
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">
              ₹{totalOutstandingDueToday.toFixed(2)}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Pending balance after advance & payments</p>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'daily'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Daily Payments ({filteredDailySales.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('advance')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'advance'
              ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Customer Advance Accounts & Ledgers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('log')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === 'log'
              ? 'border-slate-800 text-slate-900 bg-slate-100/60 rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Payment Transactions Log ({filteredPaymentsLog.length})</span>
        </button>
      </div>

      {/* Unified Filter Toolbar for Payments (Date, Customer, Daily/Advance, Paid/Partial/Due) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              selectedDate === todayStr
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Today
          </button>
        </div>

        {/* Customer Dropdown Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Customer:</span>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[200px]"
          >
            <option value="all">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.area})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter for Daily Payments (Paid / Partial / Due) */}
        {activeTab === 'daily' && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paid
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('partial')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'partial'
                  ? 'bg-amber-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Partial
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('due')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'due'
                  ? 'bg-rose-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Due
            </button>
          </div>
        )}

        {/* Payment Type Filter for Transactions Log (Daily / Advance) */}
        {activeTab === 'log' && (
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setPaymentTypeFilter('all')}
              className={`px-3 py-1 rounded-lg transition ${
                paymentTypeFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Types
            </button>
            <button
              type="button"
              onClick={() => setPaymentTypeFilter('daily')}
              className={`px-3 py-1 rounded-lg transition ${
                paymentTypeFilter === 'daily'
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily
            </button>
            <button
              type="button"
              onClick={() => setPaymentTypeFilter('advance')}
              className={`px-3 py-1 rounded-lg transition ${
                paymentTypeFilter === 'advance'
                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Advance
            </button>
          </div>
        )}

        {/* Search input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, phone, area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: DAILY PAYMENTS WORKFLOW */}
      {activeTab === 'daily' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Daily Sales Collection for {selectedDate}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Track each customer's daily sale amount, automatic advance deduction, cash paid, and remaining due.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDailyForm({
                  customer_id: '',
                  date: selectedDate,
                  amount: '',
                  payment_mode: 'cash',
                });
                setIsDailyPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Daily Payment</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4 text-center">Milk (M + E)</th>
                  <th className="py-3 px-4 text-right">Sale Amount</th>
                  <th className="py-3 px-4 text-right">Advance Used</th>
                  <th className="py-3 px-4 text-right">Paid Today</th>
                  <th className="py-3 px-4 text-right">Due Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading sales and payment records...
                    </td>
                  </tr>
                ) : filteredDailySales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No sales records found matching the selected filters for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  filteredDailySales.map((item) => {
                    const status = getSaleStatus(item);
                    return (
                      <tr key={item.customer_id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.customer_name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{item.customer_phone}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{item.customer_area}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-semibold text-slate-800">
                          {Number(item.total_litres).toFixed(2)}L
                          <div className="text-[10px] text-slate-400 font-normal">
                            ({item.morning_qty}L + {item.evening_qty}L)
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                          ₹{Number(item.sale_amount).toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right text-indigo-700 font-mono font-semibold">
                          ₹{Number(item.advance_used).toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right text-emerald-700 font-mono font-semibold">
                          ₹{Number(item.paid).toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right font-black font-mono">
                          <span
                            className={
                              Number(item.due) > 0 ? 'text-rose-600' : 'text-slate-400'
                            }
                          >
                            ₹{Number(item.due).toFixed(2)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {status === 'paid' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Paid
                            </span>
                          )}
                          {status === 'partial' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Partial
                            </span>
                          )}
                          {status === 'due' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> Due
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {Number(item.due) > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleQuickPayCustomer(item.customer_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-xs"
                            >
                              <span>Pay ₹{item.due.toFixed(2)}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ADVANCE ACCOUNTS & LEDGERS */}
      {activeTab === 'advance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Customer Advance Balances & Traceable Ledgers</span>
              </h2>
              <p className="text-xs text-slate-500">
                Advance credits are stored separately from today's cash. The backend automatically adjusts advances against daily sales.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdvanceForm({
                  customer_id: '',
                  date: selectedDate,
                  amount: '',
                  payment_mode: 'upi',
                });
                setIsAdvanceModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Advance Credit</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4 text-right">Available Advance Balance</th>
                  <th className="py-3 px-4 text-right">Total Credited</th>
                  <th className="py-3 px-4 text-right">Total Adjusted</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No customers found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const adv = customerAdvances[cust.id];
                    const balance = adv?.advance_balance ?? 0;
                    const credited = adv?.total_advance_credited ?? 0;
                    const used = adv?.total_advance_used ?? 0;

                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{cust.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{cust.phone}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{cust.area}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs ${
                              balance > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <IndianRupee className="w-3 h-3" />
                            <span>{balance.toFixed(2)}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right text-slate-700 font-mono">
                          ₹{credited.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right text-slate-500 font-mono">
                          ₹{used.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenLedger(cust.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] transition"
                            >
                              <History className="w-3 h-3 text-indigo-500" />
                              <span>Ledger</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdvanceForm({
                                  customer_id: cust.id,
                                  date: selectedDate,
                                  amount: '',
                                  payment_mode: 'upi',
                                });
                                setIsAdvanceModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold text-[11px] transition"
                            >
                              <span>+ Advance</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT TRANSACTIONS LOG */}
      {activeTab === 'log' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Payment Transactions Log for {selectedDate}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Complete audit ledger of cash collections and advance deposits for this date.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Recorded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPaymentsLog.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No payments recorded matching filters for {selectedDate}. Use "Record Daily Payment" or "Deposit Advance".
                    </td>
                  </tr>
                ) : (
                  filteredPaymentsLog.map((p) => {
                    const cust = customers.find((c) => c.id === p.customer_id);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{p.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {cust?.name || p.customer_id}
                          {cust && <span className="block text-[10px] text-slate-400">{cust.area}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              p.payment_type === 'advance'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {p.payment_type === 'advance' ? 'Advance Deposit' : 'Daily Sale Payment'}
                          </span>
                        </td>
                        <td className="py-3 px-4 uppercase text-[11px] font-semibold text-slate-600">
                          {p.payment_mode}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 font-mono">
                          ₹{Number(p.amount).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                          {p.created_at ? new Date(p.created_at).toLocaleTimeString() : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Record Daily Payment */}
      {isDailyPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CreditCard className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Record Daily Payment</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDailyPaymentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDailyPaymentSubmit} className="space-y-4 text-xs">
              {/* Customer Select */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Customer</label>
                <select
                  required
                  value={dailyForm.customer_id}
                  onChange={(e) => handleDailyCustomerChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => {
                    const sale = todaySales.find((s) => s.customer_id === c.id);
                    const dueAmt = sale ? sale.due : 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.area}) — Due Today: ₹{dueAmt.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={dailyForm.date}
                  onChange={(e) => setDailyForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-xs"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-slate-400 font-normal">(Partial supported)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 50"
                  value={dailyForm.amount}
                  onChange={(e) => setDailyForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-sm font-bold font-mono"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={dailyForm.payment_mode}
                  onChange={(e) => setDailyForm((prev) => ({ ...prev, payment_mode: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-xs uppercase font-semibold"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDailyPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Deposit Advance */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Wallet className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">Add Advance Deposit</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdvanceSubmit} className="space-y-4 text-xs">
              {/* Customer Select */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Customer</label>
                <select
                  required
                  value={advanceForm.customer_id}
                  onChange={(e) => setAdvanceForm((prev) => ({ ...prev, customer_id: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => {
                    const currentAdv = customerAdvances[c.id]?.advance_balance ?? 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.area}) — Current Adv: ₹{currentAdv.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Deposit Date</label>
                <input
                  type="date"
                  required
                  value={advanceForm.date}
                  onChange={(e) => setAdvanceForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-xs"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Advance Credit Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 500"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-sm font-bold font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This credit will be stored in the customer's advance ledger and automatically applied towards future milk deliveries.
                </p>
              </div>

              {/* Mode */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={advanceForm.payment_mode}
                  onChange={(e) => setAdvanceForm((prev) => ({ ...prev, payment_mode: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none text-xs uppercase font-semibold"
                >
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Crediting...' : 'Credit Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Advance Ledger History */}
      {ledgerModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <span>Advance Ledger: {ledgerModalCustomer.customer_name}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Current Advance Balance:{' '}
                  <strong className="text-emerald-600 font-mono text-sm">
                    ₹{ledgerModalCustomer.advance_balance.toFixed(2)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLedgerModalCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3">Reference / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerModalCustomer.ledger.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No ledger transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    ledgerModalCustomer.ledger.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{entry.date}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              entry.type === 'credit'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {entry.type === 'credit' ? '+ Credit' : '- Deduction'}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            entry.type === 'credit' ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {entry.type === 'credit' ? '+' : '-'}₹{Number(entry.amount).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {entry.reference_id || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLedgerModalCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
