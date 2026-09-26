import React, { useState, useEffect } from 'react';
import {
  Milk,
  IndianRupee,
  Users,
  AlertCircle,
  TrendingUp,
  Sun,
  Moon,
  ArrowRight,
  RefreshCw,
  Eye,
  Plus,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { dashboardApi } from '../services/api';
import { formatCurrency, formatLitres, formatPercent } from '../utils/formatters';

interface DashboardPageProps {
  onNavigate: (path: string, param?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { centers, selectedCenterId, setSelectedCenterId, selectedCenterName } = useCenter();

  // Date Filter State: Today, Yesterday, Custom Date
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [isLoading, setIsLoading] = useState(true);

  const [data, setData] = useState<{
    kpis: {
      today_milk: number;
      morning_milk?: number;
      evening_milk?: number;
      today_amount: number;
      today_sales?: number;
      today_paid?: number;
      today_due?: number;
      total_centers?: number;
      total_suppliers: number;
      total_registered_suppliers?: number;
      direct_collections_today?: number;
      pending_payments: number;
    };
    center_breakdown?: Array<{
      center_id: string;
      center_name: string;
      code?: string;
      location?: string;
      morning_milk: number;
      evening_milk: number;
      today_total: number;
      today_amount?: number;
      today_sales?: number;
      today_paid?: number;
      today_due?: number;
      registered_suppliers: number;
    }>;
    morning_vs_evening: {
      morning: number;
      evening: number;
      total: number;
    };
    weekly_collection: Array<{
      date: string;
      day: string;
      morning: number;
      evening: number;
      total: number;
    }>;
    recent_deliveries?: Array<{
      id: string;
      customer_name: string;
      customer_code: string;
      center_name: string;
      session: string;
      actual_qty: number;
      status: string;
      total_amount: number;
      date: string;
    }>;
    recent_payments?: Array<{
      id: string;
      customer_name: string;
      customer_code: string;
      amount: number;
      payment_type: string;
      payment_mode: string;
      reference_id: string;
      date: string;
    }>;
    pending_payments: Array<any>;
    pending_balances?: Array<{
      customer_id: string;
      customer_name: string;
      customer_code: string;
      center_name: string;
      sale: number;
      paid: number;
      due: number;
    }>;
  }>({
    kpis: {
      today_milk: 0,
      morning_milk: 0,
      evening_milk: 0,
      today_amount: 0,
      today_sales: 0,
      today_paid: 0,
      today_due: 0,
      total_centers: 0,
      total_suppliers: 0,
      pending_payments: 0,
    },
    center_breakdown: [],
    morning_vs_evening: { morning: 0, evening: 0, total: 0 },
    weekly_collection: [],
    recent_deliveries: [],
    recent_payments: [],
    pending_payments: [],
    pending_balances: [],
  });

  const handleDateModeSelect = (mode: 'today' | 'yesterday' | 'custom') => {
    setDateMode(mode);
    if (mode === 'today') {
      setSelectedDate(getTodayStr());
    } else if (mode === 'yesterday') {
      setSelectedDate(getYesterdayStr());
    }
  };

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const res = await dashboardApi.getStats(
        selectedCenterId !== 'all' ? selectedCenterId : undefined,
        selectedDate
      );
      setData(res);
    } catch (err) {
      console.warn('Dashboard stats fallback', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedCenterId, selectedDate]);

  const handleCenterClick = (centerId: string) => {
    setSelectedCenterId(centerId);
  };

  // Safe KPI access
  const totalMilk = data.kpis.today_milk || 0;
  const morningMilk = data.kpis.morning_milk ?? data.morning_vs_evening.morning ?? 0;
  const eveningMilk = data.kpis.evening_milk ?? data.morning_vs_evening.evening ?? 0;
  const todaySales = data.kpis.today_sales ?? data.kpis.today_amount ?? 0;
  const todayPaid = data.kpis.today_paid ?? 0;
  const todayDue = data.kpis.today_due ?? data.kpis.pending_payments ?? 0;
  const activeSuppliers = data.kpis.total_suppliers || data.kpis.total_registered_suppliers || 0;
  const collectionCenters = data.kpis.total_centers || (centers.length > 0 ? centers.length : 1);

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Operational Dashboard
            </h1>
            <span className="text-[11px] font-semibold bg-brand-50 text-brand-900 border border-brand-200 px-2 py-0.5 rounded-full">
              Live Database
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time dairy metrics, intake sessions, financial settlements & center distribution.
          </p>
        </div>

        {/* Date Filter & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Filter Buttons: Today, Yesterday, Custom */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleDateModeSelect('today')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateMode === 'today'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDateModeSelect('yesterday')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateMode === 'yesterday'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handleDateModeSelect('custom')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateMode === 'custom'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom Date
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setDateMode('custom');
                setSelectedDate(e.target.value);
              }}
              className="border-none bg-transparent font-medium text-slate-800 text-xs focus:outline-hidden"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('deliveries-morning')}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Record Intake
          </Button>
        </div>
      </div>

      {/* 8 Core Business KPIs Grid (Phase 6 Requirement) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Total Milk */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Total Milk</span>
            <Milk className="w-3.5 h-3.5 text-brand-900" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-slate-900 font-mono tabular-nums leading-tight">
              {formatLitres(totalMilk)}
            </div>
            <span className="text-[10px] text-slate-400">Consolidated</span>
          </div>
        </div>

        {/* 2. Morning Milk */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 text-[10px] font-bold uppercase tracking-wider">
            <span>Morning</span>
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-amber-950 font-mono tabular-nums leading-tight">
              {formatLitres(morningMilk)}
            </div>
            <span className="text-[10px] text-amber-600/70">Session 1</span>
          </div>
        </div>

        {/* 3. Evening Milk */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
            <span>Evening</span>
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-indigo-950 font-mono tabular-nums leading-tight">
              {formatLitres(eveningMilk)}
            </div>
            <span className="text-[10px] text-indigo-600/70">Session 2</span>
          </div>
        </div>

        {/* 4. Today's Sales */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
            <span>Sales Value</span>
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-emerald-950 font-mono tabular-nums leading-tight">
              {formatCurrency(todaySales)}
            </div>
            <span className="text-[10px] text-emerald-600/70">Gross delivery</span>
          </div>
        </div>

        {/* 5. Today's Paid */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700 text-[10px] font-bold uppercase tracking-wider">
            <span>Paid</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-blue-950 font-mono tabular-nums leading-tight">
              {formatCurrency(todayPaid)}
            </div>
            <span className="text-[10px] text-blue-600/70">Disbursed</span>
          </div>
        </div>

        {/* 6. Today's Due */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700 text-[10px] font-bold uppercase tracking-wider">
            <span>Due</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-rose-950 font-mono tabular-nums leading-tight">
              {formatCurrency(todayDue)}
            </div>
            <span className="text-[10px] text-rose-600/70">Unsettled</span>
          </div>
        </div>

        {/* 7. Active Suppliers */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Suppliers</span>
            <Users className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-slate-900 font-mono tabular-nums leading-tight">
              {activeSuppliers}
            </div>
            <span className="text-[10px] text-slate-400">Active accounts</span>
          </div>
        </div>

        {/* 8. Collection Centers */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Centers</span>
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-black text-slate-900 font-mono tabular-nums leading-tight">
              {collectionCenters}
            </div>
            <span className="text-[10px] text-slate-400">Hub stations</span>
          </div>
        </div>
      </div>

      {/* Center-wise Milk Collection Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-900" />
              Center-wise Collection & Financial Breakdown ({selectedDate})
            </h2>
            <p className="text-[11px] text-slate-500">
              Live intake volume, gross sales value, disbursements, and dues per hub station.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('centers')}
            className="text-xs text-brand-900 font-semibold hover:underline flex items-center gap-1"
          >
            Manage Centers <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {(data.center_breakdown || []).length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No collection recorded for this date.
            </div>
          ) : (
            (data.center_breakdown || []).map((ctr) => {
              const isSelected = selectedCenterId === ctr.center_id;
              return (
                <div
                  key={ctr.center_id}
                  onClick={() => handleCenterClick(ctr.center_id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-brand-800 bg-brand-50/30 ring-1 ring-brand-800 shadow-xs'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs truncate">
                      {ctr.center_name}
                    </span>
                    <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                      {ctr.registered_suppliers} suppliers
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-200/70 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Morning</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{ctr.morning_milk}L</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Evening</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{ctr.evening_milk}L</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Milk</span>
                      <span className="text-xs font-black text-brand-900 font-mono">{ctr.today_total}L</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Sales: <strong className="text-slate-800">₹{ctr.today_sales ?? ctr.today_amount ?? 0}</strong>
                    </span>
                    <span className="text-slate-500">
                      Due: <strong className="text-rose-700">₹{ctr.today_due ?? (ctr as any).pending_payments ?? 0}</strong>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Analytics Row: 7-Day Collection Trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-subtle">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              7-Day Milk Collection Trend
            </h2>
            <span className="text-[11px] text-slate-500">Morning and Evening intake trajectory in Litres</span>
          </div>
          <span className="text-xs text-brand-800 font-medium bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
            Database Aggregation
          </span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weekly_collection} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '6px', fontSize: '11px' }}
                formatter={(val: any) => [`${val} L`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="morning" name="Morning (L)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="evening" name="Evening (L)" fill="#4338ca" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Tables Section: Recent Deliveries, Recent Payments & Pending Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Recent Deliveries (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recent Deliveries
                </h3>
                <p className="text-[11px] text-slate-500">Latest recorded milk intake</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('deliveries-morning')}
                className="text-xs text-brand-900 hover:underline font-semibold flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Supplier</th>
                    <th className="px-2 py-2.5">Session</th>
                    <th className="px-2 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!data.recent_deliveries || data.recent_deliveries.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                        No deliveries recorded recently.
                      </td>
                    </tr>
                  ) : (
                    data.recent_deliveries.slice(0, 7).map((del) => (
                      <tr key={del.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900">{del.customer_name}</div>
                          <span className="text-[10px] font-mono text-slate-400">{del.customer_code}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge variant={del.session === 'MORNING' ? 'morning' : 'evening'} size="sm">
                            {del.session === 'MORNING' ? 'Morn' : 'Eve'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold text-slate-900 font-mono">
                          {del.actual_qty}L
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-800 font-mono">
                          ₹{del.total_amount?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              del.status === 'DELIVERED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {del.status === 'DELIVERED' ? 'Delivered' : 'No Milk'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2. Recent Payments (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recent Payments
                </h3>
                <p className="text-[11px] text-slate-500">Disbursements & advances</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="text-xs text-brand-900 hover:underline font-semibold flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {(!data.recent_payments || data.recent_payments.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No payments recorded recently.
                </div>
              ) : (
                data.recent_payments.slice(0, 7).map((pay) => (
                  <div key={pay.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{pay.customer_name}</div>
                      <div className="text-[10px] text-slate-400">
                        {pay.payment_type === 'ADVANCE' ? 'Advance Credit' : 'Daily Settlement'} • {pay.payment_mode}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 font-mono text-sm">
                        {formatCurrency(pay.amount)}
                      </div>
                      <span className="text-[10px] text-slate-400">{pay.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. Pending Balances (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Pending Balances
                </h3>
                <p className="text-[11px] text-slate-500">Unsettled amounts</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="text-xs text-brand-900 hover:underline font-semibold flex items-center gap-1"
              >
                Pay <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {(!data.pending_balances || data.pending_balances.length === 0) ? (
                <div className="p-6 text-center text-xs text-emerald-700 bg-emerald-50/30">
                  <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                  All accounts settled for this date!
                </div>
              ) : (
                data.pending_balances.slice(0, 7).map((p) => (
                  <div key={p.customer_id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{p.customer_name}</div>
                      <div className="text-[10px] text-slate-400">{p.customer_code} • {p.center_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-rose-700 font-mono text-xs">
                        {formatCurrency(p.due)}
                      </div>
                      <span className="text-[10px] text-slate-400">Sale: ₹{p.sale}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
