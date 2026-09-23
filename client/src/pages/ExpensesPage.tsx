import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Filter,
  DollarSign,
  Fuel,
  Zap,
  Wrench,
  Users as UsersIcon,
  Package,
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { expensesApi } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

export const ExpensesPage: React.FC = () => {
  const { t } = useLanguage();
  const { selectedCenterId, selectedCenterName } = useCenter();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState({
    today_expenses: 0,
    this_month_expenses: 0,
    total_expenses: 0,
    category_totals: {} as Record<string, number>,
  });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('transport');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'bank_transfer'>('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const data = await expensesApi.getAll({
        center_id: selectedCenterId,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setExpenses(data.expenses);
      setSummary(data.summary);
    } catch (err) {
      console.warn('Expenses load fallback', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [selectedCenterId, categoryFilter]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!description.trim() || !numAmt || numAmt <= 0) {
      showToast('Description and valid Amount are required', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await expensesApi.create({
        collection_center_id: selectedCenterId !== 'all' ? selectedCenterId : 'c1',
        date,
        category,
        description,
        amount: numAmt,
        payment_method: paymentMethod,
        notes,
      });

      showToast(`Expense of ₹${numAmt} recorded successfully`, 'success');
      setIsModalOpen(false);
      setDescription('');
      setAmount('');
      setNotes('');
      loadExpenses();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to record expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, desc: string) => {
    if (!isAdmin) {
      showToast('Only Administrators can delete expenses', 'warning');
      return;
    }
    if (!window.confirm(`Delete expense record: "${desc}"?`)) return;

    try {
      await expensesApi.delete(id);
      showToast('Expense record deleted', 'info');
      loadExpenses();
    } catch (err: any) {
      showToast('Failed to delete expense', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('expenses')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('expenses_subtitle')} • <span className="font-semibold text-brand-900">{selectedCenterName}</span>
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          {t('add_expense')}
        </Button>
      </div>

      {/* Summary KPI Cards: Today's Expenses, This Month, Total Expenses */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={t('todays_expenses')}
          value={formatCurrency(summary.today_expenses)}
          subtitle="Dock operations today"
          highlightColor="amber"
        />
        <StatCard
          title={t('this_month_expenses')}
          value={formatCurrency(summary.this_month_expenses)}
          subtitle="Current calendar month"
          highlightColor="amber"
        />
        <StatCard
          title={t('total_expenses')}
          value={formatCurrency(summary.total_expenses)}
          subtitle="Total operational costs"
          highlightColor="blue"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-subtle flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">{t('category')}:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
          >
            <option value="all">{t('all_categories')}</option>
            <option value="transport">{t('category_transport')}</option>
            <option value="salary">{t('category_salary')}</option>
            <option value="maintenance">{t('category_maintenance')}</option>
            <option value="electricity">{t('category_electricity')}</option>
            <option value="equipment">{t('category_equipment')}</option>
            <option value="other">{t('category_other')}</option>
          </select>
        </div>

        <span className="text-slate-500 text-xs">
          {expenses.length}
        </span>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">{t('date')}</th>
                <th className="px-3 py-2.5">{t('category')}</th>
                <th className="px-4 py-2.5">{t('description')}</th>
                <th className="px-3 py-2.5 text-right">{t('amount')}</th>
                <th className="px-3 py-2.5">{t('payment_method')}</th>
                <th className="px-4 py-2.5">{t('added_by')}</th>
                <th className="px-3 py-2.5 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    ...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {t('no_expenses_recorded')}
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{exp.description}</div>
                      {exp.notes && (
                        <span className="text-[11px] text-slate-500 block">{exp.notes}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-800 tabular-nums text-sm">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-3 py-2.5 uppercase font-semibold text-[11px] text-slate-700">
                      {exp.payment_method}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-[11px]">
                      {exp.added_by}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id, exp.description)}
                          className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('add_expense')}
        subtitle="Log operational expenditures for milk collection"
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              onClick={handleAddExpense}
            >
              Save Expense
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Expense Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-9 px-2 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
              >
                <option value="transport">Transport / Van Fuel</option>
                <option value="salary">Staff Salary / Advance</option>
                <option value="maintenance">Maintenance / Lab chemicals</option>
                <option value="electricity">Electricity / Generator</option>
                <option value="equipment">Equipment &amp; Cans</option>
                <option value="other">Other Operational</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Description <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Milk collection van diesel - Route 2"
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1850"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded font-bold text-slate-900 text-sm focus:ring-1 focus:ring-brand-800 tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full h-9 px-2 bg-white border border-slate-300 rounded font-medium focus:ring-1 focus:ring-brand-800"
              >
                <option value="cash">Cash Voucher</option>
                <option value="upi">UPI / Online</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Receipt / Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Petrol bunk receipt #4402"
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
