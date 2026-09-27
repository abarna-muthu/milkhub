import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sun,
  Moon,
  Calendar,
  IndianRupee,
  Users,
  CreditCard,
  Wallet,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  PlusCircle,
  FileText,
  History,
  ShieldCheck,
  Milk,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { customerApi, deliveryApi, salesApi, paymentApi } from '../services/api';
import {
  Customer,
  DayWiseSaleItem,
  DeliveryItem,
  Payment,
  CustomerAdvanceInfo,
} from '../types';
import { useToast } from '../context/ToastContext';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, dbStatus, refreshDbStatus } = useAuth();
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Core Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [morningDeliveries, setMorningDeliveries] = useState<DeliveryItem[]>([]);
  const [eveningDeliveries, setEveningDeliveries] = useState<DeliveryItem[]>([]);
  const [dayWiseSales, setDayWiseSales] = useState<DayWiseSaleItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customerAdvances, setCustomerAdvances] = useState<Record<string, CustomerAdvanceInfo>>({});

  // Fetch all dashboard data for selected date
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Customers
      const custRes = await customerApi.getAll({ status: 'active' });
      const activeCusts = custRes.customers;
      setCustomers(activeCusts);

      // 2. Fetch Morning & Evening Deliveries in parallel
      const [mRes, eRes, salesRes, payRes] = await Promise.all([
        deliveryApi.getDeliveries(selectedDate, 'morning').catch(() => ({ deliveries: [] })),
        deliveryApi.getDeliveries(selectedDate, 'evening').catch(() => ({ deliveries: [] })),
        salesApi.getDayWiseSales(selectedDate).catch(() => ({ sales: [] })),
        paymentApi.getPayments({ date: selectedDate }).catch(() => ({ payments: [] })),
      ]);

      setMorningDeliveries(mRes.deliveries);
      setEveningDeliveries(eRes.deliveries);
      setDayWiseSales(salesRes.sales);
      setPayments(payRes.payments);

      // 3. Fetch advances for customer pool
      const advMap: Record<string, CustomerAdvanceInfo> = {};
      await Promise.all(
        activeCusts.map(async (c) => {
          try {
            const adv = await paymentApi.getCustomerAdvance(c.id);
            advMap[c.id] = adv;
          } catch (e) {
            // ignore
          }
        })
      );
      setCustomerAdvances(advMap);
    } catch (err: any) {
      console.error('Failed to load dashboard metrics:', err);
      showToast('Failed to load dashboard metrics', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Aggregated KPI Calculations
  const morningLitres = useMemo(() => {
    return morningDeliveries.reduce((sum, d) => sum + (Number(d.actual_qty) || 0), 0);
  }, [morningDeliveries]);

  const eveningLitres = useMemo(() => {
    return eveningDeliveries.reduce((sum, d) => sum + (Number(d.actual_qty) || 0), 0);
  }, [eveningDeliveries]);

  const totalLitresToday = useMemo(() => {
    return Math.round((morningLitres + eveningLitres) * 100) / 100;
  }, [morningLitres, eveningLitres]);

  const totalSalesToday = useMemo(() => {
    return dayWiseSales.reduce((sum, s) => sum + (Number(s.sale_amount) || 0), 0);
  }, [dayWiseSales]);

  const totalAdvanceUsedToday = useMemo(() => {
    return dayWiseSales.reduce((sum, s) => sum + (Number(s.advance_used) || 0), 0);
  }, [dayWiseSales]);

  const totalPaidToday = useMemo(() => {
    return payments
      .filter((p) => p.payment_type === 'daily')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const totalAdvanceReceivedToday = useMemo(() => {
    return payments
      .filter((p) => p.payment_type === 'advance')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  const totalDueToday = useMemo(() => {
    return dayWiseSales.reduce((sum, s) => sum + (Number(s.due) || 0), 0);
  }, [dayWiseSales]);

  const totalAdvanceBalancePool = useMemo(() => {
    return Object.values(customerAdvances).reduce(
      (sum, a) => sum + (Number(a.advance_balance) || 0),
      0
    );
  }, [customerAdvances]);

  // Session Stats
  const morningDeliveredCount = useMemo(() => {
    return morningDeliveries.filter((d) => d.status === 'delivered' && d.actual_qty > 0).length;
  }, [morningDeliveries]);

  const morningNoMilkCount = useMemo(() => {
    return morningDeliveries.filter((d) => d.status === 'no_milk' || d.actual_qty === 0).length;
  }, [morningDeliveries]);

  const eveningDeliveredCount = useMemo(() => {
    return eveningDeliveries.filter((d) => d.status === 'delivered' && d.actual_qty > 0).length;
  }, [eveningDeliveries]);

  const eveningNoMilkCount = useMemo(() => {
    return eveningDeliveries.filter((d) => d.status === 'no_milk' || d.actual_qty === 0).length;
  }, [eveningDeliveries]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Operational Status Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white p-6 sm:p-8 border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Phase 6 Operations Dashboard</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Owner: {user?.email}</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Daily Milk Business Operations
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Real-time monitoring of daily deliveries, automatic sales calculations, advance adjustments, and payment collections.
            </p>
          </div>

          {/* Quick Date Selector & Refresh */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700/80 backdrop-blur-md">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 rounded-xl border border-slate-700">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedDate === todayStr
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={loadDashboardData}
              disabled={isLoading}
              title="Refresh dashboard metrics"
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* CRM Workflow Stepper Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <span>CRM Workflow Pipeline (PDF Specification)</span>
          <span className="text-emerald-600 font-semibold lowercase">automated backend execution</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => onNavigate('customers')}
            className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 text-left transition group"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700">Step 1</div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-900 flex items-center justify-between mt-0.5">
              <span>Customers</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition group-hover:translate-x-0.5" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{customers.length} Active</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('deliveries-morning')}
            className="p-3 rounded-xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 text-left transition group"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-amber-700">Step 2</div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-amber-900 flex items-center justify-between mt-0.5">
              <span>Morning</span>
              <Sun className="w-3 h-3 text-amber-500" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{morningLitres.toFixed(1)} Litres</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('deliveries-evening')}
            className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 text-left transition group"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-700">Step 3</div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-900 flex items-center justify-between mt-0.5">
              <span>Evening</span>
              <Moon className="w-3 h-3 text-indigo-500" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{eveningLitres.toFixed(1)} Litres</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="p-3 rounded-xl bg-slate-50 hover:bg-teal-50/50 border border-slate-200/80 hover:border-teal-300 text-left transition group"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-teal-700">Step 4</div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-teal-900 flex items-center justify-between mt-0.5">
              <span>Daily Sales</span>
              <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-teal-600 transition group-hover:translate-x-0.5" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">₹{totalSalesToday.toFixed(0)} Total</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('payments')}
            className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 text-left transition group"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700">Step 5</div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-900 flex items-center justify-between mt-0.5">
              <span>Payments</span>
              <CreditCard className="w-3 h-3 text-emerald-500" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">₹{totalPaidToday.toFixed(0)} Paid</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('customers')}
            className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50/50 border border-slate-200/80 hover:border-purple-300 text-left transition group"
          >
            <div className="text-[10px] font-bold text-slate-400 group-hover:text-purple-700">Step 6</div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-purple-900 flex items-center justify-between mt-0.5">
              <span>Customer History</span>
              <History className="w-3 h-3 text-purple-500" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Ledger & Summary</div>
          </button>
        </div>
      </div>

      {/* 5 High-Impact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Milk Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Milk Delivered</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Milk className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {totalLitresToday.toFixed(2)} <span className="text-sm font-semibold text-slate-500">L</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Morning: {morningLitres.toFixed(1)}L • Evening: {eveningLitres.toFixed(1)}L
            </p>
          </div>
        </div>

        {/* Card 2: Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Daily Sale</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-700 tracking-tight font-mono">
              ₹{totalSalesToday.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Calculated by Litres × Milk Rate
            </p>
          </div>
        </div>

        {/* Card 3: Cash & UPI Paid Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cash / Paid Today</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight font-mono">
              ₹{totalPaidToday.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Advance Used: ₹{totalAdvanceUsedToday.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Card 4: Outstanding Due */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Due Today</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600 tracking-tight font-mono">
              ₹{totalDueToday.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              After advance & daily payment
            </p>
          </div>
        </div>

        {/* Card 5: Advance Balance Pool */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Advance Pool</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600 tracking-tight font-mono">
              ₹{totalAdvanceBalancePool.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Held across all active customers
            </p>
          </div>
        </div>
      </div>

      {/* Two Delivery Session Cards (Morning & Evening) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Morning Session Card */}
        <div className="bg-white rounded-2xl border border-amber-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Sun className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Morning Delivery Session</h3>
                  <p className="text-xs text-slate-500">{selectedDate}</p>
                </div>
              </div>
              <span className="text-xs font-black font-mono text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                {morningLitres.toFixed(2)} Litres
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 my-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Active Custs</span>
                <div className="text-base font-bold text-slate-800">{customers.length}</div>
              </div>
              <div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase">Delivered</span>
                <div className="text-base font-bold text-emerald-700">{morningDeliveredCount}</div>
              </div>
              <div>
                <span className="text-[10px] text-rose-600 font-bold uppercase">No Milk (0L)</span>
                <div className="text-base font-bold text-rose-700">{morningNoMilkCount}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('deliveries-morning')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-98"
          >
            <span>Open Morning Delivery Sheet</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Evening Session Card */}
        <div className="bg-white rounded-2xl border border-indigo-200/80 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <Moon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Evening Delivery Session</h3>
                  <p className="text-xs text-slate-500">{selectedDate}</p>
                </div>
              </div>
              <span className="text-xs font-black font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                {eveningLitres.toFixed(2)} Litres
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 my-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Active Custs</span>
                <div className="text-base font-bold text-slate-800">{customers.length}</div>
              </div>
              <div>
                <span className="text-[10px] text-indigo-600 font-bold uppercase">Delivered</span>
                <div className="text-base font-bold text-indigo-700">{eveningDeliveredCount}</div>
              </div>
              <div>
                <span className="text-[10px] text-rose-600 font-bold uppercase">No Milk (0L)</span>
                <div className="text-base font-bold text-rose-700">{eveningNoMilkCount}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('deliveries-evening')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-98"
          >
            <span>Open Evening Delivery Sheet</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day-Wise Sales Live Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              <span>Day-Wise Sales & Collection Breakdown for {selectedDate}</span>
            </h2>
            <p className="text-xs text-slate-500">
              Morning + Evening = Total Litres × Milk Rate = Daily Sale. Advance Used and Due automatically adjusted.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition"
            >
              <span>View Full Sales Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-xs transition shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payments Desk</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Area</th>
                <th className="py-3 px-4 text-center">Morning</th>
                <th className="py-3 px-4 text-center">Evening</th>
                <th className="py-3 px-4 text-center">Total Milk</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Daily Sale</th>
                <th className="py-3 px-4 text-right">Advance Used</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Due</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                    Calculating today's live sales...
                  </td>
                </tr>
              ) : dayWiseSales.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    No delivery records saved for {selectedDate} yet. Use Morning or Evening delivery to enter milk quantities.
                  </td>
                </tr>
              ) : (
                dayWiseSales.map((s) => {
                  const isPaid = s.due <= 0 && s.sale_amount > 0;
                  const isPartial = s.paid > 0 && s.due > 0;

                  return (
                    <tr key={s.customer_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.customer_name}</td>
                      <td className="py-3 px-4 text-slate-600">{s.customer_area}</td>
                      <td className="py-3 px-4 text-center text-amber-700 font-semibold">
                        {Number(s.morning_qty).toFixed(1)}L
                      </td>
                      <td className="py-3 px-4 text-center text-indigo-700 font-semibold">
                        {Number(s.evening_qty).toFixed(1)}L
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {Number(s.total_litres).toFixed(2)}L
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{Number(s.rate).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{Number(s.sale_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-700 font-semibold">
                        ₹{Number(s.advance_used).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                        ₹{Number(s.paid).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black">
                        <span className={s.due > 0 ? 'text-rose-600' : 'text-slate-400'}>
                          ₹{Number(s.due).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> Partial
                          </span>
                        )}
                        {!isPaid && !isPartial && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" /> Due
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
    </div>
  );
};
