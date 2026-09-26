import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Customer, PaymentType, PaymentMode } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { paymentsApi } from '../../services/api';
import { Banknote, Landmark, Smartphone, Wallet, Sparkles } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCustomer?: Customer | null;
  defaultAmount?: number;
  defaultType?: PaymentType;
  customersList?: Customer[];
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCustomer,
  defaultAmount,
  defaultType = 'DAILY_PAYMENT',
  customersList = [],
}) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('DAILY_PAYMENT');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advanceBalance, setAdvanceBalance] = useState<{
    total_added: number;
    total_used: number;
    available_balance: number;
  } | null>(null);

  useEffect(() => {
    if (defaultCustomer) {
      setCustomerId(defaultCustomer.id);
    } else if (customersList.length > 0 && !customerId) {
      setCustomerId(customersList[0].id);
    }

    if (defaultAmount !== undefined && defaultAmount > 0) {
      setAmount(String(defaultAmount));
    } else {
      setAmount('');
    }

    if (defaultType) {
      setPaymentType(defaultType);
    }
  }, [defaultCustomer, defaultAmount, defaultType, customersList, isOpen]);

  // Load customer's live advance balance
  useEffect(() => {
    if (customerId) {
      loadAdvanceBalance(customerId);
    } else {
      setAdvanceBalance(null);
    }
  }, [customerId, isOpen]);

  const loadAdvanceBalance = async (id: string) => {
    try {
      const bal = await paymentsApi.getAdvanceBalance(id);
      setAdvanceBalance(bal);
    } catch (err) {
      console.warn('Failed to load advance balance:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      showToast('Please select a supplier', 'warning');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast('Please enter a valid payment amount greater than 0', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await paymentsApi.recordPayment({
        customer_id: customerId,
        date,
        amount: numAmount,
        payment_type: paymentType,
        payment_mode: paymentMode,
        reference_id: referenceId,
        notes,
      });

      if (paymentType === 'ADVANCE') {
        showToast(
          `Recorded ₹${numAmount} Advance credit! Available for future sales adjustment.`,
          'success'
        );
      } else {
        showToast(`Recorded ₹${numAmount} Daily Payment successfully!`, 'success');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to record payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCust = customersList.find((c) => c.id === customerId) || defaultCustomer;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={paymentType === 'ADVANCE' ? 'Record Customer Advance' : 'Record Daily Payment'}
      subtitle="Financial entries are tracked with strict transactional safety & auto-adjustment."
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            {paymentType === 'ADVANCE' ? 'Confirm Advance Credit' : 'Confirm Payment'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Payment Type Selection */}
        <div>
          <label className="block font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[11px]">
            Payment Type <span className="text-rose-600">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentType('DAILY_PAYMENT')}
              className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                paymentType === 'DAILY_PAYMENT'
                  ? 'bg-brand-50 border-brand-800 text-brand-950 ring-1 ring-brand-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="font-bold text-xs">Daily Payment</span>
              <span className="text-[10px] text-slate-500">Pays against today's delivery due</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentType('ADVANCE')}
              className={`p-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
                paymentType === 'ADVANCE'
                  ? 'bg-amber-50 border-amber-600 text-amber-950 ring-1 ring-amber-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="font-bold text-xs">Advance Credit</span>
                <span className="bg-amber-200 text-amber-900 text-[9px] px-1 rounded font-bold">Credit</span>
              </div>
              <span className="text-[10px] text-slate-500">Customer credit for future sales</span>
            </button>
          </div>
        </div>

        {/* Customer Select */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block font-semibold text-slate-700">
              Supplier <span className="text-rose-600">*</span>
            </label>
            {advanceBalance !== null && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                <Wallet className="w-3 h-3 text-amber-600" />
                Available Advance: <strong>₹{advanceBalance.available_balance.toFixed(2)}</strong>
              </span>
            )}
          </div>
          {defaultCustomer ? (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900 flex items-center justify-between">
              <div>
                {defaultCustomer.name} ({defaultCustomer.customer_code})
              </div>
              <span className="text-[11px] text-slate-500 font-normal">
                {defaultCustomer.center_name || 'Center'}
              </span>
            </div>
          ) : (
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
            >
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customer_code}) — {c.center_name || 'Center'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date & Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Date <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Amount (₹) <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full h-9 pl-7 pr-3 bg-white border border-slate-300 rounded font-bold text-slate-900 text-sm focus:ring-1 focus:ring-brand-800 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Payment Mode */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Payment Mode <span className="text-rose-600">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode('CASH')}
              className={`py-2 px-2.5 border rounded-lg flex items-center justify-center gap-1.5 font-semibold transition-colors ${
                paymentMode === 'CASH'
                  ? 'border-brand-900 bg-brand-900 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              Cash
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('UPI')}
              className={`py-2 px-2.5 border rounded-lg flex items-center justify-center gap-1.5 font-semibold transition-colors ${
                paymentMode === 'UPI'
                  ? 'border-brand-900 bg-brand-900 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              UPI
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('BANK_TRANSFER')}
              className={`py-2 px-2.5 border rounded-lg flex items-center justify-center gap-1.5 font-semibold transition-colors ${
                paymentMode === 'BANK_TRANSFER'
                  ? 'border-brand-900 bg-brand-900 text-white shadow-xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              Bank Transfer
            </button>
          </div>
        </div>

        {/* Reference ID / Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Reference ID / UTR No
            </label>
            <input
              type="text"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="e.g. UPI/2026/8921"
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800 text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Notes / Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Advance given for cattle feed"
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800 text-xs"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};
