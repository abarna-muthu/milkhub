import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Calendar,
  Building2,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Sparkles,
  BookOpen,
  DollarSign,
  TrendingDown,
  UserCheck,
} from 'lucide-react';
import { DailyPaymentSummary, AdvanceLedgerEntry, Customer, CollectionCenter, PaymentType, PaymentRecord, PaymentMode } from '../types';
import { Button } from '../components/common/Button';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { paymentsApi, centersApi, customersApi } from '../services/api';

interface PaymentsPageProps {
  onNavigate?: (path: string, param?: string) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Active view tab
  const [activeTab, setActiveTab] = useState<'daily' | 'advance_ledger' | 'records'>('daily');

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'all' | 'DAILY_PAYMENT' | 'ADVANCE'>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'all' | 'CASH' | 'UPI' | 'BANK_TRANSFER'>('all');

  // Data
  const [dailySummaries, setDailySummaries] = useState<DailyPaymentSummary[]>([]);
  const [advanceLedger, setAdvanceLedger] = useState<AdvanceLedgerEntry[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [metrics, setMetrics] = useState({
    total_sale: 0,
    total_advance_used: 0,
    total_paid: 0,
    total_due: 0,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [suggestedPaymentAmount, setSuggestedPaymentAmount] = useState<number | undefined>();
  const [suggestedPaymentType, setSuggestedPaymentType] = useState<PaymentType>('DAILY_PAYMENT');

  useEffect(() => {
    loadCentersAndCustomers();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      loadDailyPayments();
    } else if (activeTab === 'advance_ledger') {
      loadAdvanceLedger();
    } else {
      loadPaymentRecords();
    }
  }, [selectedDate, selectedCenterId, activeTab, paymentTypeFilter, paymentModeFilter]);

  const loadPaymentRecords = async () => {
    setIsLoading(true);
    try {
      const data = await paymentsApi.getAll({
        date: selectedDate,
        payment_type: paymentTypeFilter !== 'all' ? paymentTypeFilter : undefined,
        payment_method: paymentModeFilter !== 'all' ? paymentModeFilter : undefined,
      });
      setPaymentRecords(data || []);
    } catch (err: any) {
      console.error('Failed to load payment records:', err);
      showToast('Failed to load payment records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCentersAndCustomers = async () => {
    try {
      const [cData, custData] = await Promise.all([
        centersApi.getAll(),
        customersApi.getAll({ limit: 100 }),
      ]);
      setCenters(cData);
      setCustomers(custData.customers || []);
    } catch (err) {
      console.warn('Failed to load centers/customers:', err);
    }
  };

  const loadDailyPayments = async () => {
    setIsLoading(true);
    try {
      const res = await paymentsApi.getDailySummary({
        date: selectedDate,
        center_id: selectedCenterId !== 'all' ? selectedCenterId : undefined,
      });

      setDailySummaries(res.summaries || []);
      setMetrics(res.metrics || {
        total_sale: 0,
        total_advance_used: 0,
        total_paid: 0,
        total_due: 0,
      });
    } catch (err: any) {
      console.error('Failed to load daily payments:', err);
      showToast('Failed to load daily payments data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAdvanceLedger = async () => {
    setIsLoading(true);
    try {
      const data = await paymentsApi.getAdvanceLedger();
      setAdvanceLedger(data);
    } catch (err: any) {
      console.error('Failed to load advance ledger:', err);
      showToast('Failed to load advance ledger', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter daily summaries by search query
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return dailySummaries;
    const q = searchQuery.toLowerCase().trim();
    return dailySummaries.filter(
      (s) =>
        s.customer_name?.toLowerCase().includes(q) ||
        s.customer_code?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.center_name?.toLowerCase().includes(q)
    );
  }, [dailySummaries, searchQuery]);

  // Open Record Payment Modal pre-filled for a customer
  const handleOpenPayment = (summary: DailyPaymentSummary, type: PaymentType = 'DAILY_PAYMENT') => {
    const cust = customers.find((c) => c.id === summary.customer_id) || {
      id: summary.customer_id,
      name: summary.customer_name,
      customer_code: summary.customer_code,
      phone: summary.phone || '',
      area: '',
      center_id: summary.center_id,
      center_name: summary.center_name,
      cow_count: 0,
      buffalo_count: 0,
      default_morning_qty: 1,
      default_evening_qty: 1,
      rate: summary.rate,
      start_date: '',
      status: 'active',
      created_at: '',
    };

    setSelectedCustomerForPayment(cust as Customer);
    setSuggestedPaymentAmount(type === 'DAILY_PAYMENT' ? summary.due : undefined);
    setSuggestedPaymentType(type);
    setIsRecordModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Payments & Advance Ledger
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Automatic Advance Adjustment
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time daily payment calculations. Customer advances are automatically subtracted from daily sales before determining net due.
          </p>
        </div>

        {/* Tab switcher & Action Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'daily'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-brand-800" />
              Daily Payment Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('advance_ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'advance_ledger'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              Advance Ledger History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'records'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              Payment Records
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={
              activeTab === 'daily'
                ? loadDailyPayments
                : activeTab === 'advance_ledger'
                ? loadAdvanceLedger
                : loadPaymentRecords
            }
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedCustomerForPayment(null);
              setSuggestedPaymentAmount(undefined);
              setSuggestedPaymentType('DAILY_PAYMENT');
              setIsRecordModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
          >
            Record Payment / Advance
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Sale */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Today's Total Sale</span>
            <DollarSign className="w-4 h-4 text-brand-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              ₹{metrics.total_sale.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">From recorded daily deliveries</span>
        </div>

        {/* Advance Used */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold uppercase tracking-wider">
            <span>Advance Auto-Used</span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900 tracking-tight font-mono">
              ₹{metrics.total_advance_used.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Automatically applied credit</span>
        </div>

        {/* Total Paid */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold uppercase tracking-wider">
            <span>Total Paid (Cash/UPI)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-950 tracking-tight font-mono">
              ₹{metrics.total_paid.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Daily payments received</span>
        </div>

        {/* Total Due */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <span>Net Remaining Due</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 tracking-tight font-mono">
              ₹{metrics.total_due.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Remaining after advance & payments</span>
        </div>
      </div>

      {/* Main View: Daily Payment Sheet vs Advance Ledger */}
      {activeTab === 'daily' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Date Selector */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded border transition-colors ${
                    selectedDate === new Date().toISOString().split('T')[0]
                      ? 'bg-brand-900 text-white border-brand-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setSelectedDate(y.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-1.5 text-[11px] font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Yesterday
                </button>
              </div>

              {/* Center Filter */}
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedCenterId}
                  onChange={(e) => setSelectedCenterId(e.target.value)}
                  className="py-1.5 px-2.5 text-xs font-medium border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-800"
                >
                  <option value="all">All Collection Centers</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.center_name || c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search supplier, code, phone..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-800"
                />
              </div>
            </div>

            {/* Quick Count */}
            <div className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredSummaries.length}</strong> suppliers for <strong>{selectedDate}</strong>
            </div>
          </div>

          {/* Daily Payment Sheet Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4 text-right">Sale</th>
                    <th className="py-3 px-4 text-center">Advance Used</th>
                    <th className="py-3 px-4 text-right">Paid</th>
                    <th className="py-3 px-4 text-right">Due</th>
                    <th className="py-3 px-4 text-center">Payment Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CreditCard className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        No supplier records found for the selected date and filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((summary) => {
                      const hasAdvance = summary.available_advance > 0 || summary.advance_used > 0;
                      const isPaid = summary.due === 0;

                      return (
                        <tr
                          key={summary.customer_id}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* Date */}
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                            {summary.date}
                          </td>

                          {/* Supplier Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-xs shrink-0">
                                {summary.customer_name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 leading-tight">
                                  {summary.customer_name}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                  <span className="font-mono font-medium text-brand-900 bg-brand-50 px-1 rounded">
                                    {summary.customer_code}
                                  </span>
                                  <span>• {summary.center_name}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Sale */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            <div>₹{summary.sale.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {summary.total_qty.toFixed(1)}L @ ₹{summary.rate}/L
                            </div>
                          </td>

                          {/* Advance Used */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {summary.advance_used > 0 ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                  Used: ₹{summary.advance_used.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  Remaining Adv: ₹{summary.remaining_advance.toFixed(2)}
                                </span>
                              </div>
                            ) : summary.available_advance > 0 ? (
                              <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                Avail: ₹{summary.available_advance.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">₹0.00</span>
                            )}
                          </td>

                          {/* Paid */}
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-950 whitespace-nowrap">
                            ₹{summary.paid.toFixed(2)}
                          </td>

                          {/* Due */}
                          <td className="py-3 px-4 text-right font-mono font-black whitespace-nowrap">
                            <span
                              className={
                                summary.due > 0 ? 'text-rose-600' : 'text-slate-400'
                              }
                            >
                              ₹{summary.due.toFixed(2)}
                            </span>
                          </td>

                          {/* Payment Status */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight ${
                                summary.status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : summary.status === 'PARTIAL'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : summary.status === 'OVERPAID'
                                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                  : 'bg-rose-100 text-rose-900 border border-rose-300'
                              }`}
                            >
                              {summary.status === 'PAID' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                              {summary.status === 'PARTIAL' && <Clock className="w-3 h-3 text-amber-600" />}
                              {summary.status === 'PENDING' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                              {summary.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {summary.due > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayment(summary, 'DAILY_PAYMENT')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand-900 hover:bg-brand-950 text-white text-[11px] font-semibold shadow-xs transition-colors"
                                >
                                  Pay Due
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayment(summary, 'ADVANCE')}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition-colors"
                                >
                                  + Advance
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>
                  <strong>Rules 5 & 6:</strong> Advances are automatically subtracted by the backend. When Advance is ₹500 and Sale is ₹120, Advance Used is ₹120 and Due is ₹0.
                </span>
              </div>
              <div>
                Total Suppliers: <strong>{filteredSummaries.length}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Advance Ledger History Tab */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-subtle">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Traceable Advance Ledger Movements</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete audit trail of ADVANCE_ADDED credits and ADVANCE_USED deductions.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAdvanceLedger}
              isLoading={isLoading}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Ledger
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Movement Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Reference / Purpose</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {advanceLedger.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      No advance ledger records recorded yet.
                    </td>
                  </tr>
                ) : (
                  advanceLedger.map((entry) => {
                    const isAdded = entry.type === 'ADVANCE_ADDED';
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {entry.date}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{entry.customer_name}</div>
                          <span className="font-mono text-[10px] text-brand-900 bg-brand-50 px-1 rounded">
                            {entry.customer_code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isAdded
                                ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                ADVANCE_ADDED
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="w-3 h-3 text-amber-600" />
                                ADVANCE_USED
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-sm">
                          <span className={isAdded ? 'text-emerald-700' : 'text-amber-800'}>
                            {isAdded ? '+' : '-'}₹{entry.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {entry.reference_id || '---'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {entry.notes || '---'}
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

      {/* Main View 3: Payment Records History (Phase 6) */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Filter Bar (Date, Supplier, Payment Type, Payment Mode) */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Date */}
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-hidden"
                />
              </div>

              {/* Supplier Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter supplier name, code..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-hidden"
                />
              </div>

              {/* Payment Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Type:</span>
                <select
                  value={paymentTypeFilter}
                  onChange={(e) => setPaymentTypeFilter(e.target.value as any)}
                  className="py-1.5 px-2.5 text-xs font-medium border border-slate-300 rounded-md bg-white focus:outline-hidden"
                >
                  <option value="all">All Types</option>
                  <option value="DAILY_PAYMENT">Daily Payment Only</option>
                  <option value="ADVANCE">Advance Only</option>
                </select>
              </div>

              {/* Payment Mode Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Mode:</span>
                <select
                  value={paymentModeFilter}
                  onChange={(e) => setPaymentModeFilter(e.target.value as any)}
                  className="py-1.5 px-2.5 text-xs font-medium border border-slate-300 rounded-md bg-white focus:outline-hidden"
                >
                  <option value="all">All Modes</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded">
              Transactions: <strong className="text-slate-900">{paymentRecords.length}</strong>
            </span>
          </div>

          {/* Payment Records Table */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Center</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {paymentRecords
                    .filter((p) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase().trim();
                      return (
                        p.customer_name?.toLowerCase().includes(q) ||
                        p.customer_code?.toLowerCase().includes(q)
                      );
                    })
                    .length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        No payment records matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paymentRecords
                      .filter((p) => {
                        if (!searchQuery.trim()) return true;
                        const q = searchQuery.toLowerCase().trim();
                        return (
                          p.customer_name?.toLowerCase().includes(q) ||
                          p.customer_code?.toLowerCase().includes(q)
                        );
                      })
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-600">{p.date}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{p.customer_name}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{p.customer_code}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{p.center_name || 'Center'}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-sm text-slate-900">
                            ₹{p.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.payment_type === 'ADVANCE'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-blue-100 text-blue-900 border border-blue-300'
                              }`}
                            >
                              {p.payment_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{p.payment_mode}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {p.reference_id || '---'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">{p.notes || '---'}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment / Advance Modal */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => {
          loadDailyPayments();
          loadAdvanceLedger();
          loadPaymentRecords();
        }}
        defaultCustomer={selectedCustomerForPayment}
        defaultAmount={suggestedPaymentAmount}
        defaultType={suggestedPaymentType}
        customersList={customers}
      />
    </div>
  );
};
