import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Customer } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { paymentsApi } from '../../services/api';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCustomer?: Customer | null;
  customersList?: Customer[];
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCustomer,
  customersList = [],
}) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('cash');
  const [refNo, setRefNo] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultCustomer) {
      setCustomerId(defaultCustomer.id);
      if (defaultCustomer.pending_amount && defaultCustomer.pending_amount > 0) {
        setAmount(String(defaultCustomer.pending_amount));
      }
    } else if (customersList.length > 0 && !customerId) {
      setCustomerId(customersList[0].id);
    }
  }, [defaultCustomer, customersList, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      showToast('Please select a customer', 'warning');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showToast('Please enter a valid payment amount', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCust = customersList.find((c) => c.id === customerId) || defaultCustomer;
      await paymentsApi.create({
        customer_id: customerId,
        collection_center_id: selectedCust?.collection_center_id || 'c1',
        date,
        amount: numAmount,
        payment_method: method,
        reference_no: refNo,
        notes,
      });

      showToast(`Payment of ₹${numAmount} recorded successfully and credited to ledger`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to record payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('record_payment')}
      subtitle={t('record_payment_subtitle')}
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            {t('record_payment')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Customer Select */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {t('supplier')} <span className="text-rose-600">*</span>
          </label>
          {defaultCustomer ? (
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900">
              {defaultCustomer.name} ({defaultCustomer.customer_code}) • {defaultCustomer.village}
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

        {/* Date & Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {t('payment_date')}
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {t('amount_rs')} <span className="text-rose-600">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 4000"
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded font-bold text-slate-900 text-sm focus:ring-1 focus:ring-brand-800 tabular-nums"
            />
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {t('payment_method')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'upi', 'bank_transfer'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`py-2 px-3 border rounded text-xs font-semibold capitalize transition-colors ${
                  method === m
                    ? 'border-brand-800 bg-brand-50 text-brand-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Reference / UTR Number */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {t('reference_utr')}
          </label>
          <input
            type="text"
            value={refNo}
            onChange={(e) => setRefNo(e.target.value)}
            placeholder="e.g. UPI/458921/IMPS or Cash Voucher No"
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            {t('disbursement_remarks')}
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Mid-month cycle payout"
            className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
          />
        </div>
      </form>
    </Modal>
  );
};
