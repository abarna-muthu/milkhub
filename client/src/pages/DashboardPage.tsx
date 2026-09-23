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
  Zap,
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

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<{
    kpis: {
      today_milk: number;
      today_amount: number;
      total_centers?: number;
      total_suppliers: number;
      total_registered_suppliers?: number;
      direct_collections_today?: number;
      pending_payments: number;
    };
    center_breakdown?: Array<{
      center_id: string;
      center_name: string;
      code: string;
      location: string;
      morning_milk: number;
      evening_milk: number;
      today_total: number;
      today_amount: number;
      registered_suppliers: number;
      direct_collections: number;
      pending_payments: number;
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
    recent_collections: Array<{
      id: string;
      customer_id: string;
      customer_name: string;
      customer_code: string;
      supplier_type?: string;
      center_name?: string;
      session: 'morning' | 'evening';
      milk: number;
      fat: number;
      snf: number;
      rate: number;
      amount: number;
      payment_status?: string;
      status: string;
      date: string;
    }>;
    pending_payments: Array<{
      customer_id: string;
      customer_name: string;
      customer_code: string;
      mobile: string;
      village: string;
      total_amount: number;
      paid: number;
      pending: number;
      due_date: string;
    }>;
  }>({
    kpis: {
      today_milk: 1248.0,
      today_amount: 52416.0,
      total_centers: 4,
      total_suppliers: 186,
      total_registered_suppliers: 186,
      direct_collections_today: 4,
      pending_payments: 18750.0,
    },
    center_breakdown: [
      {
        center_id: 'c1',
        center_name: 'Srivilliputtur Center',
        code: 'SVPR',
        location: 'Madurai Road',
        morning_milk: 650.0,
        evening_milk: 580.0,
        today_total: 1230.0,
        today_amount: 51660.0,
        registered_suppliers: 186,
        direct_collections: 2,
        pending_payments: 18750.0,
      },
      {
        center_id: 'c2',
        center_name: 'Rajapalayam Center',
        code: 'RJPM',
        location: 'Tenkasi Highway',
        morning_milk: 420.0,
        evening_milk: 390.0,
        today_total: 810.0,
        today_amount: 34020.0,
        registered_suppliers: 124,
        direct_collections: 1,
        pending_payments: 12400.0,
      },
      {
        center_id: 'c3',
        center_name: 'Sivakasi Center',
        code: 'SVKS',
        location: 'Sattur Road',
        morning_milk: 480.0,
        evening_milk: 440.0,
        today_total: 920.0,
        today_amount: 38640.0,
        registered_suppliers: 142,
        direct_collections: 1,
        pending_payments: 15200.0,
      },
      {
        center_id: 'c4',
        center_name: 'Virudhunagar Center',
        code: 'VDR',
        location: 'Collectorate Junction',
        morning_milk: 350.0,
        evening_milk: 310.0,
        today_total: 660.0,
        today_amount: 27720.0,
        registered_suppliers: 98,
        direct_collections: 0,
        pending_payments: 9800.0,
      },
    ],
    morning_vs_evening: {
      morning: 684.0,
      evening: 564.0,
      total: 1248.0,
    },
    weekly_collection: [
      { date: '2026-09-17', day: 'Wed', morning: 640, evening: 520, total: 1160 },
      { date: '2026-09-18', day: 'Thu', morning: 660, evening: 535, total: 1195 },
      { date: '2026-09-19', day: 'Fri', morning: 675, evening: 545, total: 1220 },
      { date: '2026-09-20', day: 'Sat', morning: 670, evening: 550, total: 1220 },
      { date: '2026-09-21', day: 'Sun', morning: 680, evening: 560, total: 1240 },
      { date: '2026-09-22', day: 'Mon', morning: 682, evening: 558, total: 1240 },
      { date: '2026-09-23', day: 'Tue', morning: 684, evening: 564, total: 1248 },
    ],
    recent_collections: [],
    pending_payments: [],
  });

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const res = await dashboardApi.getStats(selectedCenterId);
      setData(res);
    } catch (err) {
      console.warn('Dashboard stats fallback', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedCenterId]);

  const handleCenterClick = (centerId: string) => {
    setSelectedCenterId(centerId);
    onNavigate('collection');
  };

  const centerBarColors = ['#14532d', '#15803d', '#16a34a', '#22c55e', '#4ade80'];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('dashboard')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational Dairy CRM Overview • <span className="font-semibold text-brand-900">{selectedCenterName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {t('refresh')}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('collection')}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('intake_dock')}
          </Button>
        </div>
      </div>

      {/* KPI Cards (Requirement 10: 6 Core Business KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title={t('today_milk')}
          value={formatLitres(data.kpis.today_milk)}
          subtitle={t('both')}
          icon={<Milk className="w-4 h-4 text-brand-900" />}
          highlightColor="green"
        />

        <StatCard
          title={t('today_amount')}
          value={formatCurrency(data.kpis.today_amount)}
          subtitle={t('recent_collections')}
          icon={<IndianRupee className="w-4 h-4 text-emerald-800" />}
          highlightColor="green"
        />

        <StatCard
          title={t('total_centers')}
          value={data.kpis.total_centers || centers.length}
          subtitle={t('active_dock')}
          icon={<Building2 className="w-4 h-4 text-slate-700" />}
          highlightColor="blue"
        />

        <StatCard
          title={t('registered_suppliers')}
          value={data.kpis.total_registered_suppliers || data.kpis.total_suppliers}
          subtitle={t('active_farmers')}
          icon={<Users className="w-4 h-4 text-slate-700" />}
          highlightColor="blue"
        />

        <StatCard
          title={t('direct_collections')}
          value={data.kpis.direct_collections_today ?? 0}
          subtitle={t('box2_badge')}
          icon={<Zap className="w-4 h-4 text-amber-600" />}
          highlightColor="amber"
        />

        <StatCard
          title={t('pending_payments')}
          value={formatCurrency(data.kpis.pending_payments)}
          subtitle={t('balance_due')}
          icon={<AlertCircle className="w-4 h-4 text-rose-600" />}
          highlightColor="amber"
        />
      </div>

      {/* Center-wise Milk Collection Section (Requirement 10) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-900" />
              {t('center_wise_collection')}
            </h2>
            <p className="text-[11px] text-slate-500">
              {t('center_wise_desc')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('centers')}
            className="text-xs text-brand-900 font-semibold hover:underline flex items-center gap-1"
          >
            {t('manage_centers')} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Cards & Bar Chart Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Visual Bar Chart (5 columns) */}
          <div className="lg:col-span-5 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.center_breakdown || []}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                  formatter={(val: any) => [`${val} L`, 'Today Total']}
                />
                <Bar
                  dataKey="today_total"
                  name="Milk (L)"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => handleCenterClick(entry?.center_id || entry?.payload?.center_id)}
                >
                  {(data.center_breakdown || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.center_id === selectedCenterId ? '#14532d' : '#15803d'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Center Summary Table / Cards (7 columns) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data.center_breakdown || []).map((ctr) => {
              const isSelected = selectedCenterId === ctr.center_id;

              return (
                <div
                  key={ctr.center_id}
                  onClick={() => handleCenterClick(ctr.center_id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-brand-900 bg-brand-50/40 ring-1 ring-brand-900'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {ctr.center_name}
                    </span>
                    <span className="font-mono text-[10px] font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                      {ctr.code}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] text-slate-500 block">{t('today_milk')}:</span>
                      <span className="text-base font-extrabold text-brand-900 tabular-nums">
                        {ctr.today_total} {t('litres')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">{t('amount')}:</span>
                      <span className="text-xs font-bold text-emerald-800 tabular-nums">
                        {formatCurrency(ctr.today_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-500">
                    <span>M: {ctr.morning_milk}L • E: {ctr.evening_milk}L</span>
                    <span className="font-semibold text-brand-900 flex items-center gap-0.5">
                      {t('view')} →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Analytics Row: Morning vs Evening Split & Weekly Last 7 Days */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Morning vs Evening Collection Card (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t('morning_vs_evening')}
              </h2>
              <span className="text-xs text-slate-400 font-medium">Today</span>
            </div>

            <div className="mt-4 space-y-4">
              {/* Morning Session */}
              <div className="p-3 rounded-md bg-amber-50/60 border border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      {t('morning')}
                    </span>
                    <span className="text-[11px] text-slate-500">Peak dock intake</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-900 tabular-nums block">
                    {formatLitres(data.morning_vs_evening.morning)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {data.morning_vs_evening.total > 0
                      ? `${((data.morning_vs_evening.morning / data.morning_vs_evening.total) * 100).toFixed(0)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              {/* Evening Session */}
              <div className="p-3 rounded-md bg-indigo-50/60 border border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-800 flex items-center justify-center">
                    <Moon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      {t('evening')}
                    </span>
                    <span className="text-[11px] text-slate-500">Second session</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-slate-900 tabular-nums block">
                    {formatLitres(data.morning_vs_evening.evening)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {data.morning_vs_evening.total > 0
                      ? `${((data.morning_vs_evening.evening / data.morning_vs_evening.total) * 100).toFixed(0)}%`
                      : '0%'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Daily Consolidated:</span>
            <span className="font-bold text-slate-900 text-sm">
              {formatLitres(data.morning_vs_evening.total)}
            </span>
          </div>
        </div>

        {/* Weekly Collection (Last 7 Days) (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t('weekly_collection')}
              </h2>
              <span className="text-[11px] text-slate-500">Morning and Evening volume in Litres</span>
            </div>
            <span className="text-xs text-brand-800 font-medium bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
              7-Day Trend
            </span>
          </div>

          <div className="h-56 w-full">
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
      </div>

      {/* Tables Section: Recent Collections & Top Pending Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Collections Table (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {t('recent_collections')}
              </h3>
              <p className="text-[11px] text-slate-500">{t('dashboard_overview')}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('collection')}
              className="text-xs text-brand-900 hover:underline font-semibold flex items-center gap-1"
            >
              {t('view')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t('table_farmer_name')}</th>
                  <th className="px-2 py-2.5">{t('category')}</th>
                  <th className="px-2 py-2.5">{t('session')}</th>
                  <th className="px-2 py-2.5 text-right">{t('table_milk_l')}</th>
                  <th className="px-2 py-2.5 text-right">{t('table_fat')}</th>
                  <th className="px-2 py-2.5 text-right">{t('table_snf')}</th>
                  <th className="px-2 py-2.5 text-right">{t('table_rate')}</th>
                  <th className="px-3 py-2.5 text-right">{t('table_amount')}</th>
                  <th className="px-3 py-2.5 text-center">{t('table_status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_collections.map((col) => (
                  <tr key={col.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{col.customer_name}</div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {col.center_name || col.customer_code}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          col.supplier_type === 'DIRECT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {col.supplier_type === 'DIRECT' ? 'Direct' : 'Reg'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <Badge variant={col.session === 'morning' ? 'morning' : 'evening'} size="sm">
                        {col.session === 'morning' ? 'Morn' : 'Eve'}
                      </Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                      {formatLitres(col.milk)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">
                      {formatPercent(col.fat)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-600">
                      {formatPercent(col.snf)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">
                      ₹{col.rate.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-brand-900 tabular-nums">
                      {formatCurrency(col.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant="success" size="sm">
                        Collected
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Pending Payments (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {t('pending_payments')}
              </h3>
              <p className="text-[11px] text-slate-500">Unsettled farmer balances</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-xs text-brand-900 hover:underline font-semibold flex items-center gap-1"
            >
              {t('record_payment')} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {data.pending_payments.map((p) => (
              <div
                key={p.customer_id}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{p.customer_name}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.village} • {p.customer_code}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-amber-800 tabular-nums text-sm">
                    {formatCurrency(p.pending)}
                  </div>
                  <span className="text-[10px] text-slate-400">Due {p.due_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
