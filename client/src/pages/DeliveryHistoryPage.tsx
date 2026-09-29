import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sun,
  Moon,
  Calendar,
  Search,
  X,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Check,
  XCircle,
  MapPin,
  Phone,
  Milk,
  Download,
  IndianRupee,
} from 'lucide-react';
import { DeliveryHistoryItem } from '../types';
import { deliveryApi } from '../services/api';
import { exportToExcel, exportTableToPDF } from '../utils/exportUtils';
import { useToast } from '../context/ToastContext';

export const DeliveryHistoryPage: React.FC = () => {
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  // Active Session Filter: 'morning' | 'evening' | 'all'
  const [selectedSession, setSelectedSession] = useState<'morning' | 'evening' | 'all'>('morning');

  // Single Date Selector
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Search and status
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'no_milk'>('all');

  // Data & loading
  const [historyItems, setHistoryItems] = useState<DeliveryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load history records
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await deliveryApi.getHistory({
        session: selectedSession,
      });
      setHistoryItems(items);
    } catch (err: any) {
      console.error('Failed to load delivery history:', err);
      showToast('Failed to load delivery history', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSession, showToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Date Preset Shortcuts
  const applyPreset = (preset: 'today' | 'yesterday' | 'all') => {
    const now = new Date();
    if (preset === 'today') {
      setSelectedDate(now.toISOString().split('T')[0]);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setSelectedDate(y.toISOString().split('T')[0]);
    }
  };

  // Filtered Items by Session, Status & Search
  const filteredItems = useMemo(() => {
    let result = historyItems;

    // Filter by session if 'all' session is not selected
    if (selectedSession !== 'all') {
      result = result.filter((item) => item.session === selectedSession);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.customer_name.toLowerCase().includes(q) ||
          item.customer_phone.toLowerCase().includes(q) ||
          item.customer_area.toLowerCase().includes(q) ||
          item.customer_id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [historyItems, selectedSession, statusFilter, searchQuery]);

  // Group records by Date: Selected Date first, then all other dates in descending order
  const dateGroups = useMemo(() => {
    const map = new Map<string, DeliveryHistoryItem[]>();

    filteredItems.forEach((item) => {
      const arr = map.get(item.date) || [];
      arr.push(item);
      map.set(item.date, arr);
    });

    // Get all unique dates
    const allDates = Array.from(map.keys());

    // Sort dates so selectedDate is FIRST, and all other dates follow in descending order
    allDates.sort((a, b) => {
      if (a === selectedDate) return -1;
      if (b === selectedDate) return 1;
      return b.localeCompare(a);
    });

    return allDates.map((d) => {
      const items = map.get(d) || [];
      const totalLitres = items.reduce(
        (sum, it) => sum + (it.status === 'delivered' ? Number(it.actual_qty) || 0 : 0),
        0
      );
      return {
        date: d,
        items,
        totalLitres: Math.round(totalLitres * 100) / 100,
        totalDeliveredCount: items.filter((it) => it.status === 'delivered').length,
        totalNoMilkCount: items.filter((it) => it.status === 'no_milk').length,
      };
    });
  }, [filteredItems, selectedDate]);

  // Dynamic Summaries across all filtered items
  const stats = useMemo(() => {
    const totalLitres = filteredItems.reduce(
      (sum, item) => sum + (item.status === 'delivered' ? Number(item.actual_qty) || 0 : 0),
      0
    );
    const deliveredCount = filteredItems.filter((i) => i.status === 'delivered').length;
    const noMilkCount = filteredItems.filter((i) => i.status === 'no_milk').length;
    const totalAmount = filteredItems.reduce(
      (sum, item) => sum + (item.status === 'delivered' ? Number(item.amount) || 0 : 0),
      0
    );

    return {
      totalLitres: Math.round(totalLitres * 100) / 100,
      deliveredCount,
      noMilkCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
    };
  }, [filteredItems]);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      showToast('No delivery records to export', 'error');
      return;
    }

    const data = filteredItems.map((item, idx) => ({
      'S.No': idx + 1,
      Date: item.date,
      Session: item.session.toUpperCase(),
      'Customer ID': item.customer_id,
      'Customer Name': item.customer_name,
      Area: item.customer_area,
      Phone: item.customer_phone,
      'Default Qty (L)': item.default_qty,
      'Delivered Qty (L)': item.actual_qty,
      'Rate (Rs)': item.rate,
      'Total Amount (Rs)': item.amount,
      Status: item.status === 'delivered' ? 'Delivered' : 'No Milk',
    }));

    const sessionLabel =
      selectedSession === 'morning'
        ? 'Morning'
        : selectedSession === 'evening'
        ? 'Evening'
        : 'All_Sessions';
    const filename = `MilkHub_${sessionLabel}_Delivery_Report_${selectedDate || 'all'}`;

    exportToExcel(data, filename, `${sessionLabel} Deliveries`);
    showToast(`Exported ${filteredItems.length} records to Excel!`, 'success');
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (filteredItems.length === 0) {
      showToast('No delivery records to export', 'error');
      return;
    }

    const sessionLabel =
      selectedSession === 'morning'
        ? 'Morning Delivery'
        : selectedSession === 'evening'
        ? 'Evening Delivery'
        : 'Morning & Evening Delivery';

    const headers = [
      'Date',
      'Session',
      'Customer',
      'Area',
      'Qty (L)',
      'Rate',
      'Amount (Rs)',
      'Status',
    ];

    const rows = filteredItems.map((item) => [
      item.date,
      item.session.charAt(0).toUpperCase() + item.session.slice(1),
      item.customer_name,
      item.customer_area,
      `${(Number(item.actual_qty) || 0).toFixed(1)} L`,
      `Rs. ${item.rate.toFixed(2)}`,
      `Rs. ${item.amount.toFixed(2)}`,
      item.status === 'delivered' ? 'DELIVERED' : 'NO MILK',
    ]);

    const filename = `MilkHub_${selectedSession}_Deliveries_${selectedDate || 'history'}`;

    exportTableToPDF(
      `${sessionLabel} History Report`,
      headers,
      rows,
      filename,
      {
        'Selected Date': selectedDate || 'All',
        'Session': sessionLabel,
        'Total Delivered Litres': `${stats.totalLitres.toFixed(2)} L`,
        'Total Value': `Rs. ${stats.totalAmount.toFixed(2)}`,
        'Delivered Count': `${stats.deliveredCount} Customers`,
      }
    );

    showToast('Exported PDF Report successfully!', 'success');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredItems.length === 0) {
      showToast('No delivery records to export', 'error');
      return;
    }

    const headers = [
      'S.No',
      'Date',
      'Session',
      'Customer ID',
      'Customer Name',
      'Area',
      'Phone',
      'Default Qty (L)',
      'Delivered Qty (L)',
      'Rate (Rs)',
      'Total Amount (Rs)',
      'Status',
    ];

    const rows = filteredItems.map((item, idx) => [
      idx + 1,
      item.date,
      item.session,
      `"${item.customer_id}"`,
      `"${item.customer_name}"`,
      `"${item.customer_area}"`,
      `"${item.customer_phone}"`,
      item.default_qty,
      item.actual_qty,
      item.rate,
      item.amount,
      item.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `MilkHub_${selectedSession}_Deliveries_${selectedDate || 'history'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Exported CSV successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Milk className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Daily Delivery History & Records
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Date-wise history of all daily saved customer deliveries for Morning and Evening sessions with instant export.
          </p>
        </div>

        {/* Export Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadHistory}
            title="Refresh history"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
            title="Export to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition active:scale-95"
            title="Export to PDF report"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            title="Print sheet"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Morning & Evening Dedicated Session Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSelectedSession('morning')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              selectedSession === 'morning'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Morning Delivery History</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSession('evening')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              selectedSession === 'evening'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Evening Delivery History</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedSession('all')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              selectedSession === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Combined</span>
          </button>
        </div>

        {/* Date Presets */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className={`px-3 py-1.5 rounded-lg transition ${
              selectedDate === todayStr ? 'bg-white font-bold text-slate-900 shadow-xs' : 'hover:bg-white'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset('yesterday')}
            className="px-3 py-1.5 rounded-lg hover:bg-white transition"
          >
            Yesterday
          </button>
        </div>
      </div>

      {/* Single Date Selector, Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Single Date Picker */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] text-slate-500 font-bold uppercase">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Search Box */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, area, phone..."
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

        {/* Status Filter */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({filteredItems.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('delivered')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'delivered'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Delivered ({stats.deliveredCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('no_milk')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'no_milk'
                ? 'bg-rose-600 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>No Milk ({stats.noMilkCount})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Litres Delivered */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Total Delivered Milk</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Milk className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {stats.totalLitres.toFixed(2)}{' '}
            <span className="text-sm font-semibold text-slate-500">Litres</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {selectedSession === 'morning' ? 'Morning session' : selectedSession === 'evening' ? 'Evening session' : 'Combined sessions'}
          </p>
        </div>

        {/* Delivered Customers */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Delivered Customers</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Check className="w-4 h-4 stroke-[3]" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {stats.deliveredCount}{' '}
            <span className="text-sm font-semibold text-slate-500">Customers</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Confirmed delivery records</p>
        </div>

        {/* No Milk Count */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>No Milk Customers</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            {stats.noMilkCount}{' '}
            <span className="text-sm font-semibold text-slate-500">0L records</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Marked absent / no delivery</p>
        </div>

        {/* Total Estimated Value */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Estimated Value</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ₹{stats.totalAmount.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Based on customer milk rates</p>
        </div>
      </div>

      {/* Deliveries History Tables (Grouped Date-wise) */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          <p className="text-xs font-medium">Loading delivery history records...</p>
        </div>
      ) : dateGroups.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Delivery Records Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery
              ? 'No customer deliveries match your search query.'
              : 'There are no saved deliveries for the selected session.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dateGroups.map((group) => {
            const isSelected = group.date === selectedDate;
            const isToday = group.date === todayStr;

            return (
              <div
                key={group.date}
                className={`bg-white rounded-2xl border shadow-xs overflow-hidden ${
                  isSelected ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-slate-200'
                }`}
              >
                {/* Date Header: Left side corner above the table */}
                <div className="flex flex-wrap items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200 gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-black text-slate-900 tracking-tight">
                      {group.date}
                    </span>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Today
                      </span>
                    )}
                    {isSelected && !isToday && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Selected Date
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                    <span>
                      <strong>{group.items.length}</strong> Deliveries
                    </span>
                    <span>•</span>
                    <span className="text-emerald-700 font-bold">
                      {group.totalLitres.toFixed(1)} L Milk
                    </span>
                    <span>•</span>
                    <span className="text-slate-700 font-bold">
                      {group.totalDeliveredCount} Delivered
                    </span>
                    {group.totalNoMilkCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-rose-600 font-bold">
                          {group.totalNoMilkCount} No Milk
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Table for this date */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/60 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Session</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Area & Contact</th>
                        <th className="py-3 px-4 text-center">Delivered Qty</th>
                        <th className="py-3 px-4 text-center">Rate / L</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4 text-center">Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const isDelivered = item.status === 'delivered';
                        const isMorning = item.session === 'morning';

                        return (
                          <tr
                            key={`${item.id}_${item.date}_${item.session}`}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Session */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                  isMorning
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                }`}
                              >
                                {isMorning ? (
                                  <Sun className="w-3 h-3 text-amber-600" />
                                ) : (
                                  <Moon className="w-3 h-3 text-indigo-600" />
                                )}
                                <span>{isMorning ? 'Morning' : 'Evening'}</span>
                              </span>
                            </td>

                            {/* Customer Name */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isMorning
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-indigo-100 text-indigo-800'
                                  }`}
                                >
                                  {item.customer_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{item.customer_name}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    ID: {item.customer_id}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Area & Contact */}
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1 text-slate-700 font-medium">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{item.customer_area}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span>{item.customer_phone}</span>
                                </div>
                              </div>
                            </td>

                            {/* Delivered Quantity */}
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl font-black text-xs ${
                                  isDelivered
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {(Number(item.actual_qty) || 0).toFixed(1)} L
                              </span>
                            </td>

                            {/* Rate */}
                            <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                              ₹{(Number(item.rate) || 0).toFixed(2)}
                            </td>

                            {/* Amount */}
                            <td className="py-3.5 px-4 text-right font-black text-slate-900">
                              ₹{(Number(item.amount) || 0).toFixed(2)}
                            </td>

                            {/* Delivery Status */}
                            <td className="py-3.5 px-4 text-center">
                              {isDelivered ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Delivered</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>No Milk (0L)</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
