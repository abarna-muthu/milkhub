import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  FileDown,
  Printer,
  Building2,
  Users,
  Search,
  Zap,
  RefreshCw,
  CreditCard,
  AlertCircle,
  TrendingUp,
  Milk,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useToast } from '../context/ToastContext';
import { reportsApi, centersApi, customersApi } from '../services/api';
import { formatCurrency, formatLitres, formatPercent, formatDate } from '../utils/formatters';
import { exportTableToPDF, exportToExcel } from '../utils/exportUtils';
import { CollectionCenter, Customer } from '../types';

export const ReportsPage: React.FC = () => {
  const { t } = useLanguage();
  const { selectedCenterId, selectedCenterName } = useCenter();
  const { showToast } = useToast();

  // 8 Phase 6 Report Types
  type ReportType =
    | 'daily-milk'
    | 'center-wise'
    | 'supplier-wise'
    | 'daily-sales'
    | 'payments'
    | 'pending-due'
    | 'advance-balance'
    | 'monthly-summary';

  const [reportType, setReportType] = useState<ReportType>('daily-milk');

  // Filter States (Date, Date Range, Center, Supplier)
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getMonthStartStr = () => `${new Date().toISOString().slice(0, 7)}-01`;

  const [date, setDate] = useState<string>(getTodayStr());
  const [fromDate, setFromDate] = useState<string>(getMonthStartStr());
  const [toDate, setToDate] = useState<string>(getTodayStr());
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Dropdown options
  const [centersList, setCentersList] = useState<CollectionCenter[]>([]);
  const [suppliersList, setSuppliersList] = useState<Customer[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Load centers and suppliers for filters
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const [cData, sData] = await Promise.all([
          centersApi.getAll(),
          customersApi.getAll({ limit: 100 }),
        ]);
        setCentersList(cData);
        setSuppliersList(sData.customers || []);
      } catch (err) {
        console.warn('Failed to load filter options:', err);
      }
    };
    loadFiltersData();
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    const targetCenter = centerFilter !== 'all' ? centerFilter : undefined;
    const targetCustomer = supplierFilter !== 'all' ? supplierFilter : undefined;

    try {
      let res;
      switch (reportType) {
        case 'daily-milk':
          res = await reportsApi.getDailyMilk({
            date,
            center_id: targetCenter,
          });
          break;
        case 'center-wise':
          res = await reportsApi.getCenterWise({
            date,
            center_id: targetCenter,
          });
          break;
        case 'supplier-wise':
          res = await reportsApi.getSupplierWise({
            from_date: fromDate,
            to_date: toDate,
            center_id: targetCenter,
            customer_id: targetCustomer,
          });
          break;
        case 'daily-sales':
          res = await reportsApi.getDailySales({
            date,
            center_id: targetCenter,
            customer_id: targetCustomer,
          });
          break;
        case 'payments':
          res = await reportsApi.getPayments({
            from_date: fromDate,
            to_date: toDate,
            customer_id: targetCustomer,
          });
          break;
        case 'pending-due':
          res = await reportsApi.getPendingDue({
            date,
            center_id: targetCenter,
            customer_id: targetCustomer,
          });
          break;
        case 'advance-balance':
          res = await reportsApi.getAdvanceBalance({
            center_id: targetCenter,
            customer_id: targetCustomer,
          });
          break;
        case 'monthly-summary':
          res = await reportsApi.getMonthlySummary({
            month_year: fromDate.slice(0, 7),
            center_id: targetCenter,
          });
          break;
      }
      setReportData(res);
    } catch (err) {
      console.error('Report generation error:', err);
      showToast('Failed to generate report', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, date, fromDate, toDate, centerFilter, supplierFilter]);

  const handleExportExcel = () => {
    if (!reportData || !reportData.rows) {
      showToast('No data to export', 'error');
      return;
    }
    exportToExcel(reportData.rows, `MilkHub_${reportType}_${date}`, 'Report');
    showToast('Report downloaded as Excel (.xlsx)', 'success');
  };

  const handleExportPDF = () => {
    if (!reportData || !reportData.rows) {
      showToast('No data to export', 'error');
      return;
    }

    let headers: string[] = [];
    let rows: any[] = [];

    switch (reportType) {
      case 'daily-milk':
        headers = ['Supplier', 'Code', 'Center', 'Morning (L)', 'Evening (L)', 'Total (L)', 'Status'];
        rows = reportData.rows.map((r: any) => [
          r.customer_name,
          r.customer_code,
          r.center_name,
          `${r.morning_milk} L`,
          `${r.evening_milk} L`,
          `${r.total_milk} L`,
          r.status,
        ]);
        break;
      case 'center-wise':
        headers = ['Center', 'Active Suppliers', 'Morning (L)', 'Evening (L)', 'Total Milk (L)', 'Sales'];
        rows = reportData.rows.map((r: any) => [
          r.center_name,
          r.active_suppliers,
          `${r.morning_milk} L`,
          `${r.evening_milk} L`,
          `${r.total_milk} L`,
          `₹${r.total_sales}`,
        ]);
        break;
      case 'supplier-wise':
        headers = ['Supplier', 'Code', 'Center', 'Days', 'Morning (L)', 'Evening (L)', 'Total (L)', 'Sales'];
        rows = reportData.rows.map((r: any) => [
          r.customer_name,
          r.customer_code,
          r.center_name,
          r.delivered_days,
          `${r.morning_milk} L`,
          `${r.evening_milk} L`,
          `${r.total_milk} L`,
          `₹${r.total_sales}`,
        ]);
        break;
      case 'daily-sales':
        headers = ['Supplier', 'Code', 'Center', 'Milk (L)', 'Rate', 'Sale (₹)', 'Adv Deducted', 'Net Payable', 'Paid', 'Due'];
        rows = reportData.rows.map((r: any) => [
          r.customer_name,
          r.customer_code,
          r.center_name,
          `${r.total_milk} L`,
          `₹${r.rate}`,
          `₹${r.gross_sale}`,
          `₹${r.advance_deducted}`,
          `₹${r.net_payable}`,
          `₹${r.paid}`,
          `₹${r.due}`,
        ]);
        break;
      case 'payments':
        headers = ['Date', 'Supplier', 'Amount (₹)', 'Type', 'Mode', 'Reference', 'Notes'];
        rows = reportData.rows.map((r: any) => [
          r.date,
          r.customer_name,
          `₹${r.amount}`,
          r.payment_type,
          r.payment_mode,
          r.reference_id || '—',
          r.notes || '—',
        ]);
        break;
      case 'pending-due':
        headers = ['Supplier', 'Code', 'Center', 'Phone', 'Sale (₹)', 'Advance Used', 'Paid (₹)', 'Outstanding Due (₹)'];
        rows = reportData.rows.map((r: any) => [
          r.customer_name,
          r.customer_code,
          r.center_name,
          r.phone || '—',
          `₹${r.sale}`,
          `₹${r.advance_used}`,
          `₹${r.paid}`,
          `₹${r.outstanding_due}`,
        ]);
        break;
      case 'advance-balance':
        headers = ['Supplier', 'Code', 'Center', 'Phone', 'Added (₹)', 'Used (₹)', 'Available Balance (₹)'];
        rows = reportData.rows.map((r: any) => [
          r.customer_name,
          r.customer_code,
          r.center_name,
          r.phone || '—',
          `₹${r.total_advance_added}`,
          `₹${r.total_advance_used}`,
          `₹${r.available_balance}`,
        ]);
        break;
      case 'monthly-summary':
        headers = ['Date', 'Milk (L)', 'Sales (₹)', 'Advance Used', 'Paid (₹)', 'Due (₹)'];
        rows = reportData.rows.map((r: any) => [
          r.date,
          `${r.total_milk} L`,
          `₹${r.sales}`,
          `₹${r.advance_used}`,
          `₹${r.paid}`,
          `₹${r.due}`,
        ]);
        break;
    }

    exportTableToPDF(
      `${reportData.report_type || 'Report'} — MilkHub CRM`,
      headers,
      rows,
      `MilkHub_${reportType}_${date}`
    );
    showToast('Report generated as PDF', 'success');
  };

  const reportTabs: Array<{ id: ReportType; label: string }> = [
    { id: 'daily-milk', label: 'Daily Milk Report' },
    { id: 'center-wise', label: 'Center-wise Collection' },
    { id: 'supplier-wise', label: 'Supplier-wise Collection' },
    { id: 'daily-sales', label: 'Daily Sales Report' },
    { id: 'payments', label: 'Payment Report' },
    { id: 'pending-due', label: 'Pending / Due Report' },
    { id: 'advance-balance', label: 'Advance Balance Report' },
    { id: 'monthly-summary', label: 'Monthly Summary' },
  ];

  const isDateRangeReport = reportType === 'supplier-wise' || reportType === 'payments';
  const isMonthlyReport = reportType === 'monthly-summary';
  const isSingleDateReport = !isDateRangeReport && !isMonthlyReport;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Reports & Business Analytics
            </h1>
            <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full">
              Phase 6 Complete Suite
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete audit-ready reports covering daily milk, center distribution, sales, disbursements, and advance credit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            icon={<FileDown className="w-3.5 h-3.5 text-rose-700" />}
          >
            Print PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={fetchReport}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Report Type Selector Tabs */}
      <div className="bg-slate-100 p-1 rounded-xl border border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1 text-center">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setReportType(tab.id)}
              className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all truncate ${
                reportType === tab.id
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
              title={tab.label}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar (Date, Date Range, Center, Supplier) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-subtle flex flex-wrap items-center gap-4">
        {/* Date Filter */}
        {isSingleDateReport && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden"
            />
          </div>
        )}

        {/* Date Range Filter */}
        {isDateRangeReport && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden"
            />
            <span className="text-xs font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden"
            />
          </div>
        )}

        {/* Month Selector Filter */}
        {isMonthlyReport && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Month:</span>
            <input
              type="month"
              value={fromDate.slice(0, 7)}
              onChange={(e) => setFromDate(`${e.target.value}-01`)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden"
            />
          </div>
        )}

        {/* Center Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Center:</span>
          <select
            value={centerFilter}
            onChange={(e) => setCenterFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden"
          >
            <option value="all">All Centers</option>
            {centersList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.center_name || c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Supplier Filter */}
        {(reportType === 'supplier-wise' ||
          reportType === 'daily-sales' ||
          reportType === 'payments' ||
          reportType === 'pending-due' ||
          reportType === 'advance-balance') && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Supplier:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-hidden max-w-[200px]"
            >
              <option value="all">All Suppliers</option>
              {suppliersList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.customer_code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary KPI Cards for the Current Report */}
      {reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {reportType === 'daily-milk' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Morning Milk</span>
                <div className="text-xl font-black text-amber-950 font-mono mt-1">
                  {formatLitres(reportData.total_morning || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Evening Milk</span>
                <div className="text-xl font-black text-indigo-950 font-mono mt-1">
                  {formatLitres(reportData.total_evening || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Milk</span>
                <div className="text-xl font-black text-brand-900 font-mono mt-1">
                  {formatLitres(reportData.total_milk || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Supplier Count</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {reportData.count || (reportData.rows ? reportData.rows.length : 0)}
                </div>
              </div>
            </>
          )}

          {reportType === 'center-wise' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Milk</span>
                <div className="text-xl font-black text-brand-900 font-mono mt-1">
                  {formatLitres(reportData.overall?.daily_total || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Morning Intake</span>
                <div className="text-xl font-black text-amber-950 font-mono mt-1">
                  {formatLitres(reportData.overall?.morning_total || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Evening Intake</span>
                <div className="text-xl font-black text-indigo-950 font-mono mt-1">
                  {formatLitres(reportData.overall?.evening_total || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Hubs</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {reportData.rows ? reportData.rows.length : 0}
                </div>
              </div>
            </>
          )}

          {reportType === 'daily-sales' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Gross Sales</span>
                <div className="text-xl font-black text-emerald-950 font-mono mt-1">
                  {formatCurrency(reportData.total_sales || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Advance Deducted</span>
                <div className="text-xl font-black text-amber-950 font-mono mt-1">
                  {formatCurrency(reportData.total_advance_deducted || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Net Payable</span>
                <div className="text-xl font-black text-blue-950 font-mono mt-1">
                  {formatCurrency(reportData.total_net_payable || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Suppliers</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {reportData.rows ? reportData.rows.length : 0}
                </div>
              </div>
            </>
          )}

          {reportType === 'payments' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Disbursed</span>
                <div className="text-xl font-black text-blue-950 font-mono mt-1">
                  {formatCurrency(reportData.total_amount || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Transactions</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {reportData.count || (reportData.rows ? reportData.rows.length : 0)}
                </div>
              </div>
            </>
          )}

          {reportType === 'pending-due' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Due Balance</span>
                <div className="text-xl font-black text-rose-950 font-mono mt-1">
                  {formatCurrency(reportData.total_due || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Pending Accounts</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {reportData.count || (reportData.rows ? reportData.rows.length : 0)}
                </div>
              </div>
            </>
          )}

          {reportType === 'advance-balance' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Available Advance Credit</span>
                <div className="text-xl font-black text-amber-950 font-mono mt-1">
                  {formatCurrency(reportData.total_available_advance || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Accounts with Advance</span>
                <div className="text-xl font-black text-slate-900 font-mono mt-1">
                  {reportData.count || (reportData.rows ? reportData.rows.length : 0)}
                </div>
              </div>
            </>
          )}

          {reportType === 'monthly-summary' && (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Month Milk</span>
                <div className="text-xl font-black text-brand-900 font-mono mt-1">
                  {formatLitres(reportData.total_milk || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Month Sales</span>
                <div className="text-xl font-black text-emerald-950 font-mono mt-1">
                  {formatCurrency(reportData.total_sales || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Month Paid</span>
                <div className="text-xl font-black text-blue-950 font-mono mt-1">
                  {formatCurrency(reportData.total_paid || 0)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Month Due</span>
                <div className="text-xl font-black text-rose-950 font-mono mt-1">
                  {formatCurrency(reportData.total_due || 0)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Report Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {reportData?.report_type || 'Report Table'}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              Showing {(reportData?.rows || []).length} rows from database
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* 1. Daily Milk Report Table */}
          {reportType === 'daily-milk' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3">Center</th>
                  <th className="px-3 py-3 text-right">Morning (L)</th>
                  <th className="px-3 py-3 text-right">Evening (L)</th>
                  <th className="px-3 py-3 text-right">Total Milk (L)</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{r.customer_name}</div>
                        <span className="text-[10px] font-mono text-slate-400">{r.customer_code}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{r.center_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.morning_milk > 0 ? `${r.morning_milk} L` : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.evening_milk > 0 ? `${r.evening_milk} L` : '—'}</td>
                      <td className="px-3 py-2.5 text-right font-bold font-mono text-slate-900">{r.total_milk} L</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant={r.status === 'DELIVERED' ? 'success' : 'default'} size="sm">
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 2. Center-wise Collection Report Table */}
          {reportType === 'center-wise' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Center Name</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3 text-right">Suppliers</th>
                  <th className="px-3 py-3 text-right">Morning (L)</th>
                  <th className="px-3 py-3 text-right">Evening (L)</th>
                  <th className="px-3 py-3 text-right">Total Milk (L)</th>
                  <th className="px-4 py-3 text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-slate-900">{r.center_name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{r.location}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.active_suppliers}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.morning_milk} L</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.evening_milk} L</td>
                      <td className="px-3 py-2.5 text-right font-black font-mono text-brand-900">{r.total_milk} L</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-800">₹{r.total_sales.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. Supplier-wise Collection Report Table */}
          {reportType === 'supplier-wise' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3">Center</th>
                  <th className="px-3 py-3 text-right">Delivered Days</th>
                  <th className="px-3 py-3 text-right">Morning (L)</th>
                  <th className="px-3 py-3 text-right">Evening (L)</th>
                  <th className="px-3 py-3 text-right">Total Milk (L)</th>
                  <th className="px-3 py-3 text-right">Avg Daily</th>
                  <th className="px-4 py-3 text-right">Total Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{r.customer_name}</div>
                        <span className="text-[10px] font-mono text-slate-400">{r.customer_code}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{r.center_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.delivered_days}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.morning_milk} L</td>
                      <td className="px-3 py-2.5 text-right font-mono">{r.evening_milk} L</td>
                      <td className="px-3 py-2.5 text-right font-bold font-mono text-brand-900">{r.total_milk} L</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-500">{r.average_daily_milk} L</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-800">₹{r.total_sales.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 4. Daily Sales Report Table */}
          {reportType === 'daily-sales' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3">Center</th>
                  <th className="px-3 py-3 text-right">Milk (L)</th>
                  <th className="px-3 py-3 text-right">Rate</th>
                  <th className="px-3 py-3 text-right">Gross Sale</th>
                  <th className="px-3 py-3 text-right">Adv Deducted</th>
                  <th className="px-3 py-3 text-right">Net Payable</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans">No records found.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-sans">
                        <div className="font-semibold text-slate-900">{r.customer_name}</div>
                        <span className="text-[10px] text-slate-400">{r.customer_code}</span>
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-600">{r.center_name}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{r.total_milk} L</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">₹{r.rate.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹{r.gross_sale.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700">-₹{r.advance_deducted.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-900">₹{r.net_payable.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700">₹{r.paid.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-rose-700">₹{r.due.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 5. Payment Report Table */}
          {reportType === 'payments' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3">Payment Type</th>
                  <th className="px-3 py-3">Mode</th>
                  <th className="px-4 py-3">Reference / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No records found.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-600">{r.date}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">{r.customer_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">₹{r.amount.toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            r.payment_type === 'ADVANCE'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-300'
                          }`}
                        >
                          {r.payment_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 font-medium">{r.payment_mode}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{r.reference_id || r.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 6. Pending / Due Report Table */}
          {reportType === 'pending-due' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3">Center</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3 text-right">Sale</th>
                  <th className="px-3 py-3 text-right">Advance Used</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">No pending dues found!</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-sans">
                        <div className="font-semibold text-slate-900">{r.customer_name}</div>
                        <span className="text-[10px] text-slate-400">{r.customer_code}</span>
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-600">{r.center_name}</td>
                      <td className="px-3 py-2.5 text-slate-500 font-sans">{r.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-800">₹{r.sale.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700">₹{r.advance_used.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700">₹{r.paid.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-rose-700">₹{r.outstanding_due.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 7. Advance Balance Report Table */}
          {reportType === 'advance-balance' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3">Center</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3 text-right">Total Added</th>
                  <th className="px-3 py-3 text-right">Total Used</th>
                  <th className="px-4 py-3 text-right">Available Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">No advance accounts found.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-sans">
                        <div className="font-semibold text-slate-900">{r.customer_name}</div>
                        <span className="text-[10px] text-slate-400">{r.customer_code}</span>
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-600">{r.center_name}</td>
                      <td className="px-3 py-2.5 text-slate-500 font-sans">{r.phone || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-800">₹{r.total_advance_added.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">₹{r.total_advance_used.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-black text-amber-800">₹{r.available_balance.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 8. Monthly Summary Report Table */}
          {reportType === 'monthly-summary' && (
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Total Milk</th>
                  <th className="px-3 py-3 text-right">Gross Sales</th>
                  <th className="px-3 py-3 text-right">Advance Used</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {(!reportData?.rows || reportData.rows.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-sans">No monthly activity recorded.</td>
                  </tr>
                ) : (
                  reportData.rows.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-sans text-slate-800 font-medium">{r.date}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">{r.total_milk} L</td>
                      <td className="px-3 py-2.5 text-right text-emerald-900 font-bold">₹{r.sales.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700">₹{r.advance_used.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700">₹{r.paid.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-rose-700">₹{r.due.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
