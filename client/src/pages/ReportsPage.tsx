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
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { StatCard } from '../components/common/StatCard';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useToast } from '../context/ToastContext';
import { reportsApi } from '../services/api';
import { formatCurrency, formatLitres, formatPercent, formatDate } from '../utils/formatters';
import { exportTableToPDF, exportToExcel } from '../utils/exportUtils';

export const ReportsPage: React.FC = () => {
  const { t } = useLanguage();
  const { selectedCenterId, selectedCenterName, centers } = useCenter();
  const { showToast } = useToast();

  const [reportType, setReportType] = useState<
    'daily' | 'monthly' | 'customer-wise' | 'center-wise' | 'pending' | 'direct-collection' | 'summary' | 'profit-loss'
  >('daily');

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.toISOString().slice(0, 7)}-01`;
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [centerFilter, setCenterFilter] = useState('all');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async () => {
    setIsLoading(true);
    const targetCenter = centerFilter !== 'all' ? centerFilter : selectedCenterId;

    try {
      let res;
      if (reportType === 'daily') {
        res = await reportsApi.getDaily({
          date: toDate,
          center_id: targetCenter,
          session: sessionFilter,
        });
      } else if (reportType === 'monthly') {
        res = await reportsApi.getMonthly({
          month_year: fromDate.slice(0, 7),
          center_id: targetCenter,
        });
      } else if (reportType === 'customer-wise') {
        res = await reportsApi.getCustomerWise({
          from_date: fromDate,
          to_date: toDate,
          center_id: targetCenter,
        });
      } else if (reportType === 'center-wise') {
        res = await reportsApi.getCenterWise({
          date: toDate,
          center_id: targetCenter,
        });
      } else if (reportType === 'pending') {
        res = await reportsApi.getPending({ center_id: targetCenter });
      } else if (reportType === 'direct-collection') {
        res = await reportsApi.getDirectCollection({
          from_date: fromDate,
          to_date: toDate,
          center_id: targetCenter,
        });
      } else if (reportType === 'summary') {
        res = await reportsApi.getCollectionSummary({
          from_date: fromDate,
          to_date: toDate,
          center_id: targetCenter,
        });
      } else {
        res = await reportsApi.getProfitLoss({
          from_date: fromDate,
          to_date: toDate,
          center_id: targetCenter,
        });
      }
      setReportData(res);
    } catch (err) {
      console.warn('Report generation fallback', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, centerFilter, sessionFilter]);

  const handleExportExcel = () => {
    if (!reportData) return;
    const rows = reportData.rows || reportData.expense_breakdown || reportData.centers || [];
    exportToExcel(rows, `Dairy_Report_${reportType}_${toDate}`, 'Report');
    showToast('Report downloaded as Excel (.xlsx)', 'success');
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    let headers: string[] = [];
    let rows: any[] = [];

    if (reportType === 'daily') {
      headers = ['Customer', 'Type', 'Session', 'Animal', 'Milk (L)', 'Fat %', 'SNF %', 'Rate', 'Amount'];
      rows = (reportData.rows || []).map((r: any) => [
        r.customer_name,
        r.supplier_type || 'REGISTERED',
        r.session,
        r.animal_type || 'cow',
        `${r.quantity} L`,
        `${r.fat_percentage}%`,
        `${r.snf_percentage}%`,
        `₹${r.calculated_rate}`,
        `₹${r.total_amount}`,
      ]);
    } else if (reportType === 'center-wise') {
      headers = ['Center', 'Code', 'Morning (L)', 'Evening (L)', 'Total Milk', 'Amount', 'Suppliers', 'Direct'];
      rows = (reportData.rows || []).map((r: any) => [
        r.center_name,
        r.code,
        `${r.morning_milk} L`,
        `${r.evening_milk} L`,
        `${r.total_milk} L`,
        `₹${r.amount}`,
        r.registered_suppliers,
        r.direct_collections,
      ]);
    } else if (reportType === 'direct-collection') {
      headers = ['Date', 'Center', 'Supplier', 'Mobile', 'Session', 'Milk (L)', 'Fat %', 'Rate', 'Amount', 'Payment'];
      rows = (reportData.rows || []).map((r: any) => [
        r.date,
        r.center_name,
        r.supplier_name,
        r.mobile,
        r.session,
        `${r.litres} L`,
        `${r.fat}%`,
        `₹${r.rate}`,
        `₹${r.amount}`,
        r.payment_status,
      ]);
    } else {
      headers = ['Item', 'Details', 'Value'];
      rows = (reportData.rows || []).map((r: any) => [r.name || r.date || 'Record', '', '']);
    }

    exportTableToPDF(
      `${reportData.report_type} - ${toDate}`,
      headers,
      rows,
      `Report_${reportType.toUpperCase()}`
    );
    showToast('Report generated as PDF', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('reports_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('reports_subtitle')} • <span className="font-semibold text-brand-900">{selectedCenterName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            {t('print')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            icon={<FileDown className="w-3.5 h-3.5" />}
          >
            {t('export_pdf')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
          >
            {t('export_excel')}
          </Button>
        </div>
      </div>

      {/* Filter and Report Type Selection Box */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-subtle space-y-4 text-xs">
        {/* Report Types Tabs */}
        <div>
          <label className="block font-semibold text-slate-700 mb-2">
            {t('select_report_type')}:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { id: 'daily', label: t('daily_milk_report') },
              { id: 'monthly', label: t('monthly_milk_report') },
              { id: 'customer-wise', label: t('customer_wise_report') },
              { id: 'center-wise', label: t('center') },
              { id: 'pending', label: t('payment_pending_report') },
              { id: 'direct-collection', label: t('tab_direct_collections') },
              { id: 'summary', label: t('collection_summary') },
              { id: 'profit-loss', label: t('profit_expense_report') },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setReportType(tab.id as any)}
                className={`py-2 px-2 rounded border text-center font-bold text-[11px] transition-colors ${
                  reportType === tab.id
                    ? 'bg-brand-900 text-white border-brand-950 shadow-subtle'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date and Parameter Filters (Center filter supported on every report) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('from_date')}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('to_date')}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('collection_centers')}</label>
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-semibold text-brand-900 focus:ring-1 focus:ring-brand-800"
            >
              <option value="all">{t('all_centers')}</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="primary"
              size="md"
              onClick={fetchReport}
              isLoading={isLoading}
              className="w-full"
            >
              {t('generate_report')}
            </Button>
          </div>
        </div>
      </div>

      {/* Report Data Rendering */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-lg">
          Generating report data...
        </div>
      ) : !reportData ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-lg">
          Click Generate Report to view analysis.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary KPIs bar for Report */}
          {reportType === 'daily' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard title="Total Litres" value={formatLitres(reportData.total_litres)} highlightColor="green" />
              <StatCard title="Total Amount" value={formatCurrency(reportData.total_amount)} highlightColor="green" />
              <StatCard title="Average Fat %" value={formatPercent(reportData.average_fat)} highlightColor="blue" />
              <StatCard title="Average SNF %" value={formatPercent(reportData.average_snf)} highlightColor="blue" />
            </div>
          )}

          {reportType === 'center-wise' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard title="Consolidated Milk Today" value={formatLitres(reportData.total_litres)} highlightColor="green" />
              <StatCard title="Consolidated Amount" value={formatCurrency(reportData.total_amount)} highlightColor="green" />
              <StatCard title="Centers Audited" value={(reportData.rows || []).length} highlightColor="blue" />
            </div>
          )}

          {reportType === 'direct-collection' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard title="Direct Milk Collected" value={formatLitres(reportData.total_litres)} highlightColor="green" />
              <StatCard title="Direct Payouts" value={formatCurrency(reportData.total_amount)} highlightColor="green" />
              <StatCard title="Direct Entries Count" value={reportData.count || (reportData.rows || []).length} highlightColor="amber" />
            </div>
          )}

          {reportType === 'pending' && (
            <div className="grid grid-cols-2 gap-4">
              <StatCard title="Total Outstanding Due" value={formatCurrency(reportData.total_pending)} highlightColor="amber" />
              <StatCard title="Suppliers with Pending Dues" value={reportData.count} highlightColor="blue" />
            </div>
          )}

          {reportType === 'profit-loss' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Federation Revenue" value={formatCurrency(reportData.wholesale_revenue)} highlightColor="green" />
              <StatCard title="Farmer Payout Cost" value={formatCurrency(reportData.farmer_milk_payout_cost)} highlightColor="blue" />
              <StatCard title="Operating Expenses" value={formatCurrency(reportData.operating_expenses)} highlightColor="amber" />
              <StatCard title="Net Operating Profit" value={formatCurrency(reportData.net_operating_profit)} highlightColor="green" />
            </div>
          )}

          {/* Report Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {reportData.report_type}
              </h3>
              <span className="text-[11px] text-slate-500">
                Target: {centerFilter === 'all' ? 'All Centers' : selectedCenterName} • Generated {toDate}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                {/* 1. Daily Report */}
                {reportType === 'daily' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Supplier</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5">Center</th>
                        <th className="px-3 py-2.5">Session</th>
                        <th className="px-3 py-2.5 text-right">Milk (L)</th>
                        <th className="px-3 py-2.5 text-right">Fat %</th>
                        <th className="px-3 py-2.5 text-right">SNF %</th>
                        <th className="px-3 py-2.5 text-right">Rate</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.rows || []).map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-900">{r.customer_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{r.customer_code}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.supplier_type === 'DIRECT' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                              {r.supplier_type || 'REGISTERED'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">{r.center_name || 'Center'}</td>
                          <td className="px-3 py-2.5 capitalize">{r.session}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">{formatLitres(r.quantity)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(r.fat_percentage)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(r.snf_percentage)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">₹{r.calculated_rate?.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-brand-900">{formatCurrency(r.total_amount)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-[10px] font-semibold text-slate-700">{r.payment_status || 'PAID'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 2. Center-wise Collection Report (Requirement 13) */}
                {reportType === 'center-wise' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Center</th>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-3 py-2.5 text-right">Morning Milk</th>
                        <th className="px-3 py-2.5 text-right">Evening Milk</th>
                        <th className="px-4 py-2.5 text-right font-extrabold">Total Milk</th>
                        <th className="px-4 py-2.5 text-right font-bold">Amount</th>
                        <th className="px-3 py-2.5 text-center">Registered Suppliers</th>
                        <th className="px-3 py-2.5 text-center">Direct Collections</th>
                        <th className="px-4 py-2.5 text-right">Pending Payments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.rows || []).map((c: any) => (
                        <tr key={c.center_id} className="hover:bg-slate-50 font-medium">
                          <td className="px-4 py-3 font-bold text-slate-900">{c.center_name}</td>
                          <td className="px-3 py-3 font-mono font-bold text-brand-900">{c.code}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatLitres(c.morning_milk)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatLitres(c.evening_milk)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-extrabold text-brand-900 text-sm">{formatLitres(c.total_milk)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-800 text-sm">{formatCurrency(c.amount)}</td>
                          <td className="px-3 py-3 text-center tabular-nums font-semibold">{c.registered_suppliers}</td>
                          <td className="px-3 py-3 text-center tabular-nums font-semibold text-amber-800">{c.direct_collections}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">{formatCurrency(c.pending_payments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 3. Direct Collection Report (Requirement 13) */}
                {reportType === 'direct-collection' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Center</th>
                        <th className="px-4 py-2.5">Supplier Name</th>
                        <th className="px-3 py-2.5">Mobile</th>
                        <th className="px-3 py-2.5">Session</th>
                        <th className="px-3 py-2.5 text-right">Milk (L)</th>
                        <th className="px-3 py-2.5 text-right">Fat %</th>
                        <th className="px-3 py-2.5 text-right">SNF %</th>
                        <th className="px-3 py-2.5 text-right">Rate</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5 text-center">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.rows || []).map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{r.date}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{r.center_name}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{r.supplier_name}</td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{r.mobile}</td>
                          <td className="px-3 py-2.5 capitalize">{r.session}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-extrabold text-slate-900">{formatLitres(r.litres)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(r.fat)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatPercent(r.snf)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">₹{r.rate?.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-brand-900">{formatCurrency(r.amount)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                              {r.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 4. Customer-wise Report */}
                {reportType === 'customer-wise' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-3 py-2.5">Village</th>
                        <th className="px-3 py-2.5 text-right">Morning (L)</th>
                        <th className="px-3 py-2.5 text-right">Evening (L)</th>
                        <th className="px-3 py-2.5 text-right">Total Milk</th>
                        <th className="px-4 py-2.5 text-right">Gross Earnings</th>
                        <th className="px-4 py-2.5 text-right">Paid</th>
                        <th className="px-4 py-2.5 text-right">Balance Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.rows || []).map((r: any) => (
                        <tr key={r.customer_id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-900">{r.name}</div>
                            <span className="text-[11px] font-mono text-slate-400">{r.customer_code}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{r.village}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatLitres(r.morning_litres)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatLitres(r.evening_litres)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">{formatLitres(r.total_litres)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{formatCurrency(r.total_earnings)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-800">{formatCurrency(r.total_paid)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-700">{formatCurrency(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 5. Monthly Report */}
                {reportType === 'monthly' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-right">Morning (L)</th>
                        <th className="px-3 py-2.5 text-right">Evening (L)</th>
                        <th className="px-3 py-2.5 text-right font-bold">Total Milk (L)</th>
                        <th className="px-3 py-2.5 text-right">Average Rate/L</th>
                        <th className="px-4 py-2.5 text-right font-bold">Total Gross (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.rows || []).map((r: any) => (
                        <tr key={r.date} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-900">{formatDate(r.date)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatLitres(r.morning_litres)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatLitres(r.evening_litres)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">{formatLitres(r.total_litres)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">₹{r.avg_rate.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-brand-900">{formatCurrency(r.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 6. Payment Pending Report */}
                {reportType === 'pending' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Customer</th>
                        <th className="px-3 py-2.5">Mobile</th>
                        <th className="px-3 py-2.5">Village</th>
                        <th className="px-3 py-2.5 text-right">Total Milk</th>
                        <th className="px-4 py-2.5 text-right">Gross Earnings</th>
                        <th className="px-4 py-2.5 text-right">Paid Amount</th>
                        <th className="px-4 py-2.5 text-right font-bold text-amber-700">Pending Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.rows || []).map((r: any) => (
                        <tr key={r.customer_id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-900">{r.name}</div>
                            <span className="text-[11px] font-mono text-slate-400">{r.customer_code}</span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-600">{r.mobile}</td>
                          <td className="px-3 py-2.5 text-slate-600">{r.village}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatLitres(r.total_milk)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(r.total_payable)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-emerald-800">{formatCurrency(r.total_paid)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-amber-700 text-sm">
                            {formatCurrency(r.pending_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 7. Collection Summary */}
                {reportType === 'summary' && reportData.summary && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Collection Center</th>
                        <th className="px-3 py-2.5">Code</th>
                        <th className="px-4 py-2.5 text-right">Total Litres Collected</th>
                        <th className="px-4 py-2.5 text-right">Total Farmer Valuation (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(reportData.centers || []).map((c: any) => (
                        <tr key={c.center_id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-semibold text-slate-900">{c.center_name}</td>
                          <td className="px-3 py-2.5 font-mono text-brand-900 font-bold">{c.code}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{formatLitres(c.litres)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-brand-900">{formatCurrency(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {/* 8. Profit & Loss Report */}
                {reportType === 'profit-loss' && (
                  <>
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Financial P&amp;L Line Item</th>
                        <th className="px-4 py-2.5">Operational Basis</th>
                        <th className="px-4 py-2.5 text-right">Financial Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">1. Wholesale Milk Revenue (Federation Outflow)</td>
                        <td className="px-4 py-3 text-slate-600">{formatLitres(reportData.total_milk_litres)} sold @ wholesale avg ₹47.50/L</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(reportData.wholesale_revenue)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-rose-800">2. Less: Milk Intake Procurement Cost</td>
                        <td className="px-4 py-3 text-slate-600">Disbursed to Tamil Nadu dairy farmers based on Fat/SNF index</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-rose-800">({formatCurrency(reportData.farmer_milk_payout_cost)})</td>
                      </tr>
                      <tr className="hover:bg-slate-50 bg-slate-50/50 font-bold">
                        <td className="px-4 py-3 text-slate-900">Gross Margin</td>
                        <td className="px-4 py-3 text-slate-600">Trading margin on bulk collection volume</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-900">{formatCurrency(reportData.gross_margin)}</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-amber-800">3. Less: Dairy Operating Expenses</td>
                        <td className="px-4 py-3 text-slate-600">Bulk Milk Coolers diesel, lab chemicals, salaries, transport vans</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-800">({formatCurrency(reportData.operating_expenses)})</td>
                      </tr>
                      <tr className="bg-emerald-50 text-emerald-950 font-black text-sm border-t-2 border-emerald-300">
                        <td className="px-4 py-3">Net Operating Dairy Profit</td>
                        <td className="px-4 py-3 font-normal text-xs text-emerald-800">Consolidated bottom line surplus for network</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-950">{formatCurrency(reportData.net_operating_profit)}</td>
                      </tr>
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
