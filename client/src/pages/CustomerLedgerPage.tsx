import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Printer,
  FileDown,
  FileSpreadsheet,
  Building2,
  Phone,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Customer, LedgerEntry } from '../types';
import { Button } from '../components/common/Button';
import { StatCard } from '../components/common/StatCard';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useToast } from '../context/ToastContext';
import { ledgerApi, customersApi } from '../services/api';
import { formatCurrency, formatLitres, formatDate } from '../utils/formatters';
import { exportTableToPDF, exportToExcel } from '../utils/exportUtils';

interface CustomerLedgerPageProps {
  initialCustomerId?: string;
  onNavigate: (path: string, param?: string) => void;
}

export const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({
  initialCustomerId,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { selectedCenterId } = useCenter();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || 'cust_1');
  const [ledgerData, setLedgerData] = useState<{
    customer: {
      id: string;
      name: string;
      customer_code: string;
      mobile: string;
      village: string;
      center_name: string;
    };
    opening_balance: number;
    closing_balance: number;
    total_milk_litres: number;
    total_debit: number;
    total_credit: number;
    entries: LedgerEntry[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Fetch customers list
  useEffect(() => {
    customersApi.getAll({ center_id: selectedCenterId, limit: 100 }).then((res) => {
      setCustomers(res.customers || []);
      if (!selectedCustomerId && res.customers && res.customers.length > 0) {
        setSelectedCustomerId(res.customers[0].id);
      }
    });
  }, [selectedCenterId]);

  // Load ledger for selected customer
  const loadLedger = async () => {
    if (!selectedCustomerId) return;
    setIsLoading(true);
    try {
      const data = await ledgerApi.getByCustomerId(selectedCustomerId);
      setLedgerData(data);
    } catch (err) {
      console.warn('Failed to load ledger', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [selectedCustomerId]);

  const handleExportPDF = () => {
    if (!ledgerData) return;
    const headers = ['Date', 'Description', 'Milk (L)', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)'];
    const rows = ledgerData.entries.map((e) => [
      e.date,
      e.description,
      e.milk_quantity ? `${e.milk_quantity} L` : '—',
      e.debit > 0 ? `₹${e.debit.toFixed(2)}` : '—',
      e.credit > 0 ? `₹${e.credit.toFixed(2)}` : '—',
      `₹${e.running_balance.toFixed(2)}`,
    ]);

    exportTableToPDF(
      `Ledger Statement — ${ledgerData.customer.name} (${ledgerData.customer.customer_code})`,
      headers,
      rows,
      `Ledger_${ledgerData.customer.customer_code}`,
      {
        'Customer Name': ledgerData.customer.name,
        'Customer ID': ledgerData.customer.customer_code,
        'Mobile': ledgerData.customer.mobile,
        'Village / Area': ledgerData.customer.village,
        'Total Milk (L)': `${ledgerData.total_milk_litres} L`,
        'Total Debit (Gross)': `₹${ledgerData.total_debit.toFixed(2)}`,
        'Total Credit (Paid)': `₹${ledgerData.total_credit.toFixed(2)}`,
        'Net Outstanding': `₹${ledgerData.closing_balance.toFixed(2)}`,
      }
    );
    showToast('Ledger PDF statement downloaded', 'success');
  };

  const handleExportExcel = () => {
    if (!ledgerData) return;
    const rows = ledgerData.entries.map((e) => ({
      Date: e.date,
      Description: e.description,
      'Milk Quantity (L)': e.milk_quantity || 0,
      'Debit / Milk Earnings (INR)': e.debit,
      'Credit / Payment Disbursed (INR)': e.credit,
      'Running Balance (INR)': e.running_balance,
    }));

    exportToExcel(rows, `Ledger_${ledgerData.customer.customer_code}`, 'Ledger');
    showToast('Ledger exported to Excel (.xlsx)', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('customer_ledger_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry ledger statement showing milk credits, payment debits, and running balance
          </p>
        </div>

        {/* Action Buttons: Print, PDF, Excel */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
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

      {/* Customer Selection Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-subtle flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5 flex-1 max-w-md">
          <span className="font-semibold text-slate-700 shrink-0">{t('select_customer')}:</span>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded font-semibold text-slate-900 focus:ring-1 focus:ring-brand-800"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.customer_code}) • {c.village}
              </option>
            ))}
          </select>
        </div>

        {ledgerData && (
          <div className="flex items-center gap-4 text-slate-600">
            <span>
              {t('customer_id')}: <strong className="font-mono text-brand-900">{ledgerData.customer.customer_code}</strong>
            </span>
            <span>
              {t('area_village')}: <strong>{ledgerData.customer.village}</strong>
            </span>
            <span>
              {t('mobile')}: <strong>{ledgerData.customer.mobile}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Ledger Summary Cards */}
      {ledgerData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('opening_balance')}
            value={formatCurrency(ledgerData.opening_balance)}
            subtitle={t('opening_balance')}
            highlightColor="blue"
          />
          <StatCard
            title={t('total_milk_supplied')}
            value={formatLitres(ledgerData.total_milk_litres)}
            subtitle={t('collected')}
            highlightColor="green"
          />
          <StatCard
            title={t('total_paid')}
            value={formatCurrency(ledgerData.total_credit)}
            subtitle={t('paid_spot')}
            highlightColor="blue"
          />
          <StatCard
            title={t('closing_balance')}
            value={formatCurrency(ledgerData.closing_balance)}
            subtitle={t('balance_due')}
            highlightColor={ledgerData.closing_balance > 0 ? 'amber' : 'green'}
          />
        </div>
      )}

      {/* Accounting Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {t('customer_ledger_title')}
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">
            {t('tab_ledger')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">{t('date')}</th>
                <th className="px-4 py-2.5">{t('description')}</th>
                <th className="px-3 py-2.5 text-right">{t('milk')}</th>
                <th className="px-4 py-2.5 text-right">{t('debit')}</th>
                <th className="px-4 py-2.5 text-right">{t('credit')}</th>
                <th className="px-4 py-2.5 text-right font-bold text-slate-900">{t('balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Loading customer ledger...
                  </td>
                </tr>
              ) : !ledgerData || ledgerData.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No transactions recorded for this customer yet.
                  </td>
                </tr>
              ) : (
                ledgerData.entries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">
                      {item.description}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 font-medium">
                      {item.milk_quantity ? formatLitres(item.milk_quantity) : '-------'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                      {item.debit > 0 ? formatCurrency(item.debit) : '----'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-800">
                      {item.credit > 0 ? formatCurrency(item.credit) : '----'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900 bg-slate-50/50">
                      {formatCurrency(item.running_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {ledgerData && ledgerData.entries.length > 0 && (
              <tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={2} className="px-4 py-3 uppercase text-[11px] tracking-wider">
                    Total Statement Summary
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatLitres(ledgerData.total_milk_litres)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrency(ledgerData.total_debit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-800">
                    {formatCurrency(ledgerData.total_credit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-900 text-sm">
                    {formatCurrency(ledgerData.closing_balance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
