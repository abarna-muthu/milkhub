import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Milk,
  CreditCard,
  Printer,
  Send,
  Building2,
  Phone,
  MapPin,
  Calendar,
  CheckCircle2,
  FileText,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Customer, MilkCollection, Payment, LedgerEntry, CustomerHistoryResponse } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { WhatsAppModal } from '../components/whatsapp/WhatsAppModal';
import { useLanguage } from '../context/LanguageContext';
import { customersApi, ledgerApi } from '../services/api';
import { formatCurrency, formatLitres, formatPercent, formatDate } from '../utils/formatters';
import { exportTableToPDF } from '../utils/exportUtils';

interface CustomerProfilePageProps {
  customerId: string;
  onNavigate: (path: string, param?: string) => void;
}

export const CustomerProfilePage: React.FC<CustomerProfilePageProps> = ({
  customerId,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'history' | 'overview' | 'collection' | 'payments' | 'ledger'>('history');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState({
    total_milk: 0,
    total_amount: 0,
    total_paid: 0,
    pending_amount: 0,
    collection_count: 0,
    payment_count: 0,
  });
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Phase 6 Customer History state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [historyData, setHistoryData] = useState<CustomerHistoryResponse | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  const loadCustomerDetails = async () => {
    setIsLoading(true);
    try {
      const data = await customersApi.getById(customerId);
      setCustomer(data.customer);
      setSummary(data.summary);
      setCollections(data.recent_collections || []);
      setPayments(data.recent_payments || []);

      // Load full ledger
      const ledData = await ledgerApi.getByCustomerId(customerId);
      setLedgerEntries(ledData.entries || []);
    } catch (err) {
      console.warn('Failed to load profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const data = await customersApi.getHistory(customerId, { month_year: selectedMonth });
      setHistoryData(data);
    } catch (err) {
      console.warn('Failed to load customer history', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerDetails();
  }, [customerId]);

  useEffect(() => {
    loadCustomerHistory();
  }, [customerId, selectedMonth]);

  const handlePrintStatement = () => {
    if (!customer) return;
    const headers = ['Date', 'Description', 'Milk (L)', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'];
    const rows = ledgerEntries.map((e) => [
      e.date,
      e.description,
      e.milk_quantity ? `${e.milk_quantity} L` : '—',
      e.debit > 0 ? `₹${e.debit.toFixed(2)}` : '—',
      e.credit > 0 ? `₹${e.credit.toFixed(2)}` : '—',
      `₹${e.running_balance.toFixed(2)}`,
    ]);

    exportTableToPDF(
      `Statement of Account — ${customer.name} (${customer.customer_code})`,
      headers,
      rows,
      `Statement_${customer.customer_code}`,
      {
        'Customer Name': customer.name,
        'Mobile Number': customer.phone || customer.mobile || '',
        'Area / Village': customer.area || customer.village || '',
        'Total Milk Supplied': `${summary.total_milk} L`,
        'Total Earnings': `₹${summary.total_amount}`,
        'Total Paid': `₹${summary.total_paid}`,
        'Pending Balance': `₹${summary.pending_amount}`,
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Loading customer profile...
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-xs text-slate-500">
        Customer not found.{' '}
        <button onClick={() => onNavigate('customers')} className="text-brand-800 underline">
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('customers')}
            className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {customer.name}
              </h1>
              <span className="font-mono text-xs font-bold bg-brand-100 text-brand-900 border border-brand-300 px-2 py-0.5 rounded">
                {customer.customer_code}
              </span>
              <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
                {customer.status === 'active' ? t('active') : t('inactive')}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-slate-400" /> {customer.mobile}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> {customer.village}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" /> {customer.center_name}
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintStatement}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            {t('print_statement')}
          </Button>

          <Button
            variant="success"
            size="sm"
            onClick={() => setIsWhatsAppModalOpen(true)}
            icon={<Send className="w-3.5 h-3.5" />}
          >
            {t('send_whatsapp')}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsPaymentModalOpen(true)}
            icon={<CreditCard className="w-3.5 h-3.5" />}
          >
            {t('record_payment')}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('total_milk_supplied')}
          value={formatLitres(summary.total_milk)}
          subtitle="Cumulative delivery"
          highlightColor="green"
        />
        <StatCard
          title={t('total_earnings')}
          value={formatCurrency(summary.total_amount)}
          subtitle="Gross milk value"
          highlightColor="green"
        />
        <StatCard
          title={t('total_paid')}
          value={formatCurrency(summary.total_paid)}
          subtitle="Total disbursed"
          highlightColor="blue"
        />
        <StatCard
          title={t('balance_due')}
          value={formatCurrency(summary.pending_amount)}
          subtitle="Net pending settlement"
          highlightColor="amber"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 text-xs font-semibold">
          {[
            { key: 'history', label: 'Customer History & Daily Deliveries' },
            { key: 'overview', label: t('tab_overview') },
            { key: 'collection', label: `${t('tab_collection')} (${collections.length})` },
            { key: 'payments', label: `${t('tab_payments')} (${payments.length})` },
            { key: 'ledger', label: `${t('tab_ledger')} (${ledgerEntries.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`pb-3 px-1 border-b-2 font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-900 text-brand-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 0: Customer Detail / History (Phase 6) */}
      {activeTab === 'history' && (
        <div className="space-y-5">
          {/* Month Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Monthly Breakdown & Daily Intake History
              </h2>
              <p className="text-[11px] text-slate-500">
                Daily deliveries, rate, gross sales, advance adjustments, and net balance due.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Select Month:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-1 focus:ring-brand-900 focus:outline-hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadCustomerHistory}
                isLoading={isHistoryLoading}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Monthly Summary Cards (Phase 6 Requirement) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Total Milk */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Milk
              </span>
              <div className="mt-1 text-xl font-extrabold text-slate-900 font-mono">
                {formatLitres(historyData?.monthly_summary.total_milk || 0)}
              </div>
              <span className="text-[10px] text-slate-400">Monthly cumulative</span>
            </div>

            {/* 2. Total Sales */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                Total Sales
              </span>
              <div className="mt-1 text-xl font-extrabold text-emerald-950 font-mono">
                {formatCurrency(historyData?.monthly_summary.total_sales || 0)}
              </div>
              <span className="text-[10px] text-emerald-600/70">Gross earnings</span>
            </div>

            {/* 3. Total Paid */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                Total Paid
              </span>
              <div className="mt-1 text-xl font-extrabold text-blue-950 font-mono">
                {formatCurrency(historyData?.monthly_summary.total_paid || 0)}
              </div>
              <span className="text-[10px] text-blue-600/70">Disbursed</span>
            </div>

            {/* 4. Total Due */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
                Total Due
              </span>
              <div className="mt-1 text-xl font-extrabold text-rose-950 font-mono">
                {formatCurrency(historyData?.monthly_summary.total_due || 0)}
              </div>
              <span className="text-[10px] text-rose-600/70">Pending balance</span>
            </div>

            {/* 5. Advance Balance */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-subtle">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                Advance Balance
              </span>
              <div className="mt-1 text-xl font-extrabold text-amber-950 font-mono">
                {formatCurrency(historyData?.monthly_summary.advance_balance || 0)}
              </div>
              <span className="text-[10px] text-amber-600/70">Available credit</span>
            </div>
          </div>

          {/* Daily Customer Detail / History Table (Phase 6 Requirement) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-subtle overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Daily History Sheet ({selectedMonth})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Date • Morning • Evening • Total • Rate • Sale • Advance Used • Paid • Due
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-3 py-3 text-right">Morning</th>
                    <th className="px-3 py-3 text-right">Evening</th>
                    <th className="px-3 py-3 text-right">Total Milk</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Sale</th>
                    <th className="px-4 py-3 text-right">Advance Used</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(!historyData?.history || historyData.history.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-slate-400 font-sans">
                        No delivery or payment history recorded for {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    historyData.history.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-sans font-medium text-slate-900">
                          {row.date}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {row.morning > 0 ? `${row.morning} L` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {row.evening > 0 ? `${row.evening} L` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900">
                          {row.total > 0 ? `${row.total} L` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          ₹{row.rate.toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">
                          {row.sale > 0 ? `₹${row.sale.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 font-semibold">
                          {row.advance_used > 0 ? `-₹${row.advance_used.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-blue-700 font-semibold">
                          {row.paid > 0 ? `₹${row.paid.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-extrabold text-rose-700">
                          {row.due > 0 ? `₹${row.due.toFixed(2)}` : '₹0.00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-subtle space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {t('section1_supplier_profile')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Default Morning</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {formatLitres(customer.default_morning_qty !== undefined ? customer.default_morning_qty : 1.0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Default Evening</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {formatLitres(customer.default_evening_qty !== undefined ? customer.default_evening_qty : 1.0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Milk Rate</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  ₹{Number(customer.rate !== undefined ? customer.rate : 60).toFixed(2)}/L
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Status</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${customer.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {customer.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">{t('cows_count_label')}</span>
                <span className="text-lg font-bold text-slate-900">{customer.cow_count}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">{t('buffaloes_count_label')}</span>
                <span className="text-lg font-bold text-slate-900">{customer.buffalo_count}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Collection Center</span>
                <span className="text-xs font-semibold text-slate-800">
                  {customer.center_name || 'All Centers'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Start Date</span>
                <span className="text-xs font-semibold text-slate-800">{customer.start_date || formatDate(customer.created_at)}</span>
              </div>
            </div>

            {customer.notes && (
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded text-xs text-amber-950">
                <span className="font-semibold block mb-0.5">{t('notes_label')}:</span>
                {customer.notes}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                {t('actions')}
              </h2>
              <div className="space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => setIsPaymentModalOpen(true)}
                  icon={<CreditCard className="w-3.5 h-3.5" />}
                >
                  {t('record_payment')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => onNavigate('collection')}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  {t('daily_collection')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={handlePrintStatement}
                  icon={<FileText className="w-3.5 h-3.5" />}
                >
                  {t('export_pdf')}
                </Button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              {t('center')}: {customer.center_name}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Milk Collection */}
      {activeTab === 'collection' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t('table_date')}</th>
                  <th className="px-3 py-2.5">{t('table_session')}</th>
                  <th className="px-3 py-2.5">{t('animal_type')}</th>
                  <th className="px-3 py-2.5 text-right">{t('table_milk_l')}</th>
                  <th className="px-3 py-2.5 text-right">{t('table_fat')}</th>
                  <th className="px-3 py-2.5 text-right">{t('table_snf')}</th>
                  <th className="px-3 py-2.5 text-right">{t('table_rate')}</th>
                  <th className="px-4 py-2.5 text-right">{t('table_amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collections.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                      ...
                    </td>
                  </tr>
                ) : (
                  collections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{formatDate(c.date)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={c.session === 'morning' ? 'morning' : 'evening'} size="sm">
                          {c.session === 'morning' ? t('morning') : t('evening')}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 capitalize">{c.animal_type === 'cow' ? t('cow') : t('buffalo')}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                        {formatLitres(c.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatPercent(c.fat_percentage)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatPercent(c.snf_percentage)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-700">
                        ₹{c.calculated_rate.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-900 tabular-nums">
                        {formatCurrency(c.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Payments */}
      {activeTab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t('date')}</th>
                  <th className="px-4 py-2.5 text-right">{t('amount')}</th>
                  <th className="px-3 py-2.5">{t('payment_method')}</th>
                  <th className="px-3 py-2.5">{t('reference')}</th>
                  <th className="px-3 py-2.5">{t('status')}</th>
                  <th className="px-4 py-2.5">{t('added_by')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                      ...
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{formatDate(p.date)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-800 tabular-nums">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-3 py-2.5 uppercase font-semibold text-slate-700">
                        {t(p.payment_method as any) || p.payment_method}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-500">{p.reference_no || '---'}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="success" size="sm">{t('completed')}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{p.created_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Accounting Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t('date')}</th>
                  <th className="px-4 py-2.5">{t('description')}</th>
                  <th className="px-3 py-2.5 text-right">{t('milk')}</th>
                  <th className="px-3 py-2.5 text-right">{t('debit')}</th>
                  <th className="px-3 py-2.5 text-right">{t('credit')}</th>
                  <th className="px-4 py-2.5 text-right">{t('balance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {ledgerEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400 font-sans">
                      No ledger transactions found.
                    </td>
                  </tr>
                ) : (
                  ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-sans font-medium text-slate-900">{formatDate(e.date)}</td>
                      <td className="px-4 py-2.5 font-sans text-slate-700">{e.description}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {e.milk_quantity ? formatLitres(e.milk_quantity) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-900 font-semibold">
                        {e.debit > 0 ? formatCurrency(e.debit) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-800 font-semibold">
                        {e.credit > 0 ? formatCurrency(e.credit) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">
                        {formatCurrency(e.running_balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={loadCustomerDetails}
        defaultCustomer={customer}
      />

      {/* WhatsApp Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        customerName={customer.name}
        mobile={customer.phone || customer.mobile || ''}
        defaultTemplate="statement"
        data={{
          totalMilk: summary.total_milk,
          totalAmount: summary.total_amount,
          paidAmount: summary.total_paid,
          pendingAmount: summary.pending_amount,
        }}
      />
    </div>
  );
};
