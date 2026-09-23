import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Customer } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { settlementsApi } from '../../services/api';
import { formatCurrency, formatLitres } from '../../utils/formatters';
import { Check, MessageSquare } from 'lucide-react';
import { WhatsAppModal } from '../whatsapp/WhatsAppModal';

interface MonthlySettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCustomer?: Customer | null;
  customersList?: Customer[];
}

export const MonthlySettlementModal: React.FC<MonthlySettlementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCustomer,
  customersList = [],
}) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [customerId, setCustomerId] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [calculationData, setCalculationData] = useState<{
    customer: Partial<Customer>;
    total_milk: number;
    total_amount: number;
    previous_paid: number;
    pending_amount: number;
    settlement_amount_suggested: number;
  } | null>(null);

  const [settledAmount, setSettledAmount] = useState<string>('');

  // WhatsApp post-settlement trigger
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [settledRecord, setSettledRecord] = useState<any>(null);

  useEffect(() => {
    if (defaultCustomer) {
      setCustomerId(defaultCustomer.id);
    } else if (customersList.length > 0 && !customerId) {
      setCustomerId(customersList[0].id);
    }
  }, [defaultCustomer, customersList, isOpen]);

  // Recalculate whenever customer or month changes
  useEffect(() => {
    if (!customerId || !isOpen) return;

    setIsCalculating(true);
    settlementsApi
      .calculate({ customer_id: customerId, month_year: monthYear })
      .then((res) => {
        setCalculationData(res);
        setSettledAmount(String(res.pending_amount));
      })
      .catch((err) => {
        console.warn(err);
      })
      .finally(() => {
        setIsCalculating(false);
      });
  }, [customerId, monthYear, isOpen]);

  const handleConfirm = async () => {
    if (!customerId || !calculationData) return;
    const finalAmount = parseFloat(settledAmount);
    if (isNaN(finalAmount) || finalAmount < 0) {
      showToast('Please enter a valid settlement amount', 'warning');
      return;
    }

    setIsConfirming(true);
    try {
      const res = await settlementsApi.confirm({
        customer_id: customerId,
        month_year: monthYear,
        settled_amount: finalAmount,
      });

      showToast(`Settlement ${res.settlement_code} confirmed for ₹${finalAmount}`, 'success');
      setSettledRecord({
        customerName: calculationData.customer.name || 'Farmer',
        mobile: calculationData.customer.mobile || '',
        month: monthYear,
        totalMilk: calculationData.total_milk,
        totalAmount: calculationData.total_amount,
        paidAmount: calculationData.previous_paid + finalAmount,
        pendingAmount: Math.max(0, calculationData.pending_amount - finalAmount),
      });

      onSuccess();
      setIsWhatsAppOpen(true);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to confirm settlement', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const selectedCust = customersList.find((c) => c.id === customerId) || defaultCustomer;

  return (
    <>
      <Modal
        isOpen={isOpen && !isWhatsAppOpen}
        onClose={onClose}
        title={t('monthly_settlement')}
        subtitle={t('monthly_settlement_subtitle')}
        maxWidth="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isConfirming}
              disabled={isCalculating || !calculationData}
              onClick={handleConfirm}
              icon={<Check className="w-4 h-4" />}
            >
              {t('confirm_settlement')}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Customer & Month Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {t('select_supplier')}
              </label>
              {defaultCustomer ? (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900">
                  {defaultCustomer.name} ({defaultCustomer.customer_code})
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full h-9 px-2 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
                >
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.customer_code}) — {c.village}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {t('select_month')}
              </label>
              <input
                type="month"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
                className="w-full h-9 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
              />
            </div>
          </div>

          {/* Automatic Calculation Preview Cards */}
          {isCalculating ? (
            <div className="py-8 text-center text-slate-500">{t('calculating_figures')}</div>
          ) : calculationData ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">{t('total_milk_supplied_label')}</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {formatLitres(calculationData.total_milk)}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">{t('total_gross_value')}</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {formatCurrency(calculationData.total_amount)}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">{t('previous_paid')}</span>
                  <span className="text-base font-bold text-emerald-800 tabular-nums">
                    {formatCurrency(calculationData.previous_paid)}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded border border-slate-200">
                  <span className="text-[11px] text-slate-500 block font-medium">{t('balance_due')}</span>
                  <span className="text-base font-bold text-amber-700 tabular-nums">
                    {formatCurrency(calculationData.pending_amount)}
                  </span>
                </div>
              </div>

              {/* Final Settlement Input */}
              <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      {t('final_settlement_amount')}
                    </label>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {t('settlement_balance_hint')}
                    </p>
                  </div>
                  <div className="relative w-44">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">₹</span>
                    <input
                      type="number"
                      step="1"
                      value={settledAmount}
                      onChange={(e) => setSettledAmount(e.target.value)}
                      className="w-full h-10 pl-7 pr-3 bg-white border-2 border-emerald-600 rounded font-black text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700 tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* WhatsApp Post-Settlement Prompt */}
      {settledRecord && (
        <WhatsAppModal
          isOpen={isWhatsAppOpen}
          onClose={() => {
            setIsWhatsAppOpen(false);
            onClose();
          }}
          customerName={settledRecord.customerName}
          mobile={settledRecord.mobile}
          defaultTemplate="settlement"
          data={{
            month: settledRecord.month,
            totalMilk: settledRecord.totalMilk,
            totalAmount: settledRecord.totalAmount,
            paidAmount: settledRecord.paidAmount,
            pendingAmount: settledRecord.pendingAmount,
          }}
        />
      )}
    </>
  );
};
