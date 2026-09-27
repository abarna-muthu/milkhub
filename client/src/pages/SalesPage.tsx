import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  IndianRupee,
  RefreshCw,
  Search,
  X,
  Phone,
  MapPin,
  TrendingUp,
  Receipt,
  Sun,
  Moon,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { DayWiseSaleItem, SalesSummary } from '../types';
import { salesApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export const SalesPage: React.FC = () => {
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [salesItems, setSalesItems] = useState<DayWiseSaleItem[]>([]);
  const [summary, setSummary] = useState<SalesSummary>({
    total_morning_litres: 0,
    total_evening_litres: 0,
    total_litres: 0,
    total_sales_amount: 0,
    total_advance_used: 0,
    total_paid: 0,
    total_due: 0,
  });

  // Load sales from backend
  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await salesApi.getDayWiseSales(selectedDate);
      setSalesItems(data.sales);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Failed to load day-wise sales:', err);
      showToast(err.response?.data?.error || 'Failed to load sales data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Date shortcut helpers
  const setDateShortcut = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Filtered sales by customer name, phone, or area
  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return salesItems;
    const q = searchQuery.toLowerCase();
    return salesItems.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(q) ||
        s.customer_phone.toLowerCase().includes(q) ||
        s.customer_area.toLowerCase().includes(q)
    );
  }, [salesItems, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Day-wise Sales</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Phase 4 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automatic sales calculation: Morning Qty + Evening Qty = Total Litres • Total Litres × Milk Rate = Daily Sale.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadSales}
            title="Recalculate & reload sales"
            className="flex items-center gap-1.5 p-2.5 px-3.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh Calculation</span>
          </button>
        </div>
      </div>

      {/* Business Calculation Callout */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 shadow-md flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-white">Backend Financial Formula:</span>{' '}
          <span className="text-amber-300 font-semibold">Morning Actual Qty</span> +{' '}
          <span className="text-indigo-300 font-semibold">Evening Actual Qty</span> ={' '}
          <span className="text-white font-bold">Total Litres</span> &nbsp;•&nbsp;{' '}
          <span className="text-white font-bold">Total Litres</span> ×{' '}
          <span className="text-teal-300 font-semibold">Milk Rate/Litre</span> ={' '}
          <span className="text-emerald-400 font-bold">Daily Sale</span> &nbsp;•&nbsp;{' '}
          <span className="text-rose-300 font-bold">Due</span> = Daily Sale - (Advance Used + Paid).
        </div>
      </div>

      {/* Date & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Date Selector & Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setDateShortcut(-1)}
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-900 transition"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDateShortcut(0)}
              className={`px-2.5 py-1 rounded-lg transition ${
                selectedDate === todayStr ? 'bg-white font-bold text-slate-900 shadow-sm' : 'hover:bg-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateShortcut(1)}
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-900 transition"
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, area..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Morning Litres */}
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/40 shadow-sm">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-500" /> Morning Litres
          </span>
          <div className="text-xl font-black text-amber-800 mt-1">
            {summary.total_morning_litres.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">L</span>
          </div>
        </div>

        {/* Evening Litres */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-white to-indigo-50/40 shadow-sm">
          <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <Moon className="w-3 h-3 text-indigo-500" /> Evening Litres
          </span>
          <div className="text-xl font-black text-indigo-800 mt-1">
            {summary.total_evening_litres.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">L</span>
          </div>
        </div>

        {/* Total Litres */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Milk Sold
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">
            {summary.total_litres.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">L</span>
          </div>
        </div>

        {/* Total Sale */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 shadow-sm">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> Total Daily Sale
          </span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            ₹{summary.total_sales_amount.toFixed(2)}
          </div>
        </div>

        {/* Paid / Advance Used */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Advance / Paid
          </span>
          <div className="text-xl font-black text-slate-500 mt-1">
            ₹{(summary.total_advance_used + summary.total_paid).toFixed(2)}
          </div>
        </div>

        {/* Total Due */}
        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-gradient-to-br from-white to-rose-50/40 shadow-sm">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <IndianRupee className="w-3 h-3 text-rose-500" /> Total Due Amount
          </span>
          <div className="text-xl font-black text-rose-700 mt-1">
            ₹{summary.total_due.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Day-Wise Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs font-medium">Computing day-wise sales for {selectedDate}...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Sales Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No customers match your search query.'
                : 'There are no active customers available to compute sales for this date.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Morning (L)</th>
                  <th className="py-3 px-4 text-center">Evening (L)</th>
                  <th className="py-3 px-4 text-center">Total (L)</th>
                  <th className="py-3 px-4 text-right">Rate (₹/L)</th>
                  <th className="py-3 px-4 text-right">Sale (₹)</th>
                  <th className="py-3 px-4 text-right">Advance Used</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((item) => (
                  <tr key={item.customer_id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Date */}
                    <td className="py-3.5 px-4 font-mono text-slate-600 font-medium whitespace-nowrap">
                      {item.date}
                    </td>

                    {/* Customer Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {item.customer_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{item.customer_name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{item.customer_area}</span>
                            <span>•</span>
                            <span>{item.customer_phone}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Morning (L) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                        {Number(item.morning_qty).toFixed(2)} L
                      </span>
                    </td>

                    {/* Evening (L) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60">
                        {Number(item.evening_qty).toFixed(2)} L
                      </span>
                    </td>

                    {/* Total (L) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                        {Number(item.total_litres).toFixed(2)} L
                      </span>
                    </td>

                    {/* Rate (₹/L) */}
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      ₹{Number(item.rate).toFixed(2)}
                    </td>

                    {/* Sale Amount (₹) */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-black text-emerald-700 text-sm">
                        ₹{Number(item.sale_amount).toFixed(2)}
                      </span>
                    </td>

                    {/* Advance Used (₹) */}
                    <td className="py-3.5 px-4 text-right">
                      {item.advance_used > 0 ? (
                        <span className="font-bold text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          -₹{Number(item.advance_used).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">₹0.00</span>
                      )}
                    </td>

                    {/* Paid (₹) */}
                    <td className="py-3.5 px-4 text-right">
                      {item.paid > 0 ? (
                        <span className="font-bold text-emerald-700 font-mono bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          -₹{Number(item.paid).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">₹0.00</span>
                      )}
                    </td>

                    {/* Due (₹) */}
                    <td className="py-3.5 px-4 text-right">
                      {item.due <= 0 ? (
                        <span className="font-bold text-emerald-600 bg-emerald-50 text-[11px] px-2 py-0.5 rounded-full border border-emerald-200">
                          ₹0.00 (Settled)
                        </span>
                      ) : (
                        <span className="font-black text-rose-600 text-sm font-mono">
                          ₹{Number(item.due).toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer Totals Row */}
              <tfoot className="bg-slate-100/80 border-t-2 border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-xs font-black uppercase tracking-wider">
                    Total Summary ({filteredSales.length} Customers)
                  </td>
                  <td className="py-3 px-4 text-center text-amber-800">
                    {summary.total_morning_litres.toFixed(2)} L
                  </td>
                  <td className="py-3 px-4 text-center text-indigo-800">
                    {summary.total_evening_litres.toFixed(2)} L
                  </td>
                  <td className="py-3 px-4 text-center text-slate-950 font-black">
                    {summary.total_litres.toFixed(2)} L
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500">—</td>
                  <td className="py-3 px-4 text-right text-emerald-700 text-sm font-black font-mono">
                    ₹{summary.total_sales_amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-700 font-mono">
                    ₹{summary.total_advance_used.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700 font-mono">
                    ₹{summary.total_paid.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-rose-600 text-sm font-black font-mono">
                    ₹{summary.total_due.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
