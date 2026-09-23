import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Filter,
  Eye,
  Send,
  Printer,
  Calendar,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';
import { Payment, Customer } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { RecordPaymentModal } from '../components/payments/RecordPaymentModal';
import { MonthlySettlementModal } from '../components/payments/MonthlySettlementModal';
import { WhatsAppModal } from '../components/whatsapp/WhatsAppModal';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { paymentsApi, customersApi } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

interface PaymentsPageProps {
  onNavigate: (path: string, param?: string) => void;
}

export const PaymentsPage: React.FC<PaymentsPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { selectedCenterId, selectedCenterName } = useCenter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState({
    total_payable: 52416.0,
    total_paid: 33666.0,
    total_pending: 18750.0,
  });

  // Filters
  const [customerFilter, setCustomerFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [selectedWhatsAppTarget, setSelectedWhatsAppTarget] = useState<{
    customerName: string;
    mobile: string;
    amount: number;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pays, sumData, custsData] = await Promise.all([
        paymentsApi.getAll({
          center_id: selectedCenterId,
          customer_id: customerFilter !== 'all' ? customerFilter : undefined,
          payment_method: methodFilter !== 'all' ? methodFilter : undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        }),
        paymentsApi.getSummary(selectedCenterId),
        customersApi.getAll({ center_id: selectedCenterId, limit: 100 }),
      ]);

      setPayments(pays);
      setSummary(sumData);
      setCustomers(custsData.customers || []);
    } catch (err) {
      console.warn('Payments load fallback', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCenterId, customerFilter, methodFilter, fromDate, toDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('payments_settlement')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('payments_subtitle')} • <span className="font-semibold text-brand-900">{selectedCenterName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettlementModalOpen(true)}
            icon={<FileCheck className="w-3.5 h-3.5 text-brand-800" />}
          >
            {t('monthly_settlement')}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('record_payment')}
          </Button>
        </div>
      </div>

      {/* Summary Cards: Total Payable, Total Paid, Total Pending */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('total_payable')}
          value={formatCurrency(summary.total_payable)}
          subtitle={t('milk_gross_value_sub')}
          highlightColor="green"
        />
        <StatCard
          title={t('total_paid')}
          value={formatCurrency(summary.total_paid)}
          subtitle={t('disbursed_to_suppliers_sub')}
          highlightColor="blue"
        />
        <StatCard
          title={t('pending_payments')}
          value={formatCurrency(summary.total_pending)}
          subtitle={t('outstanding_due_sub')}
          highlightColor="amber"
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Customer Filter */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="h-9 px-2.5 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
          >
            <option value="all">{t('all_suppliers')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.customer_code})
              </option>
            ))}
          </select>

          {/* Payment Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-9 px-2.5 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
          >
            <option value="all">{t('all_payment_methods')}</option>
            <option value="cash">{t('cash')}</option>
            <option value="upi">{t('upi')}</option>
            <option value="bank_transfer">{t('bank_transfer')}</option>
          </select>
        </div>

        {/* Date Bounds */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">{t('period')}:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
          />
          <span className="text-slate-400">{t('to_text')}</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
          />
        </div>
      </div>

      {/* Payments History Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">{t('date')}</th>
                <th className="px-4 py-2.5">{t('supplier')}</th>
                <th className="px-3 py-2.5 text-right">{t('amount_rs')}</th>
                <th className="px-3 py-2.5">{t('method')}</th>
                <th className="px-3 py-2.5">{t('reference')}</th>
                <th className="px-3 py-2.5 text-center">{t('status')}</th>
                <th className="px-4 py-2.5">{t('added_by')}</th>
                <th className="px-4 py-2.5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    {t('no_payments_criteria')}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {formatDate(p.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{p.customer_name}</div>
                      <span className="text-[11px] text-slate-400 font-mono">{p.customer_code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-800 tabular-nums text-sm">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-3 py-2.5 uppercase font-semibold text-[11px] text-slate-700">
                      {t(p.payment_method as any) || p.payment_method}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-500">
                      {p.reference_no || '---'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant="success" size="sm">{t('completed')}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-[11px]">{p.created_by}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onNavigate('ledger', p.customer_id)}
                          className="p-1 text-slate-400 hover:text-brand-900 rounded hover:bg-slate-100"
                          title="View Ledger"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedWhatsAppTarget({
                              customerName: p.customer_name || 'Farmer',
                              mobile: p.customer_mobile || '9876543210',
                              amount: p.amount,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-emerald-700 rounded hover:bg-emerald-50"
                          title="Send WhatsApp Confirmation"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={loadData}
        customersList={customers}
      />

      {/* Monthly Settlement Modal */}
      <MonthlySettlementModal
        isOpen={isSettlementModalOpen}
        onClose={() => setIsSettlementModalOpen(false)}
        onSuccess={loadData}
        customersList={customers}
      />

      {/* WhatsApp Modal */}
      {selectedWhatsAppTarget && (
        <WhatsAppModal
          isOpen={!!selectedWhatsAppTarget}
          onClose={() => setSelectedWhatsAppTarget(null)}
          customerName={selectedWhatsAppTarget.customerName}
          mobile={selectedWhatsAppTarget.mobile}
          defaultTemplate="payment_reminder"
          data={{
            pendingAmount: selectedWhatsAppTarget.amount,
          }}
        />
      )}
    </div>
  );
};
