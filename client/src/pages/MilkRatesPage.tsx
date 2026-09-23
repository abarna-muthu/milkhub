import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Check, Calculator, History, AlertCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { RoleGuard } from '../components/layout/RoleGuard';
import { MilkRate, PricingType } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { ratesApi } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

interface MilkRatesPageProps {
  onNavigate: (path: string) => void;
}

export const MilkRatesPage: React.FC<MilkRatesPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [rates, setRates] = useState<MilkRate[]>([]);
  const [activeRate, setActiveRate] = useState<MilkRate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Form Fields
  const [pricingType, setPricingType] = useState<PricingType>('fat_snf');
  const [baseRate, setBaseRate] = useState<string>('42.0');
  const [standardFat, setStandardFat] = useState<string>('4.2');
  const [standardSnf, setStandardSnf] = useState<string>('8.5');
  const [fatRate, setFatRate] = useState<string>('3.5');
  const [snfRate, setSnfRate] = useState<string>('2.0');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Live Preview Simulation Inputs
  const [testQty, setTestQty] = useState<string>('5.5');
  const [testFat, setTestFat] = useState<string>('4.2');
  const [testSnf, setTestSnf] = useState<string>('8.5');

  const loadRates = async () => {
    setIsLoading(true);
    try {
      const allRates = await ratesApi.getAll();
      setRates(allRates);
      const active = allRates.find((r) => r.is_active) || allRates[0];
      if (active) {
        setActiveRate(active);
        setPricingType(active.pricing_type);
        setBaseRate(String(active.base_rate));
        setStandardFat(String(active.standard_fat));
        setStandardSnf(String(active.standard_snf));
        setFatRate(String(active.fat_rate));
        setSnfRate(String(active.snf_rate));
      }
    } catch (err) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  // Compute Live Calculation Preview
  const q = parseFloat(testQty) || 0;
  const f = parseFloat(testFat) || 4.2;
  const s = parseFloat(testSnf) || 8.5;

  const base = parseFloat(baseRate) || 42.0;
  const stdF = parseFloat(standardFat) || 4.2;
  const stdS = parseFloat(standardSnf) || 8.5;
  const fRate = parseFloat(fatRate) || 3.5;
  const sRate = parseFloat(snfRate) || 2.0;

  let previewRatePerLitre = base;
  if (pricingType === 'fat_snf') {
    previewRatePerLitre = base + (f - stdF) * fRate + (s - stdS) * sRate;
    previewRatePerLitre = Math.max(previewRatePerLitre, 28.0);
  }
  const previewTotal = Number((q * previewRatePerLitre).toFixed(2));

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numBase = parseFloat(baseRate);
    if (!numBase || numBase <= 0) {
      showToast('Please enter a valid base rate', 'warning');
      return;
    }

    setIsUpdating(true);
    try {
      await ratesApi.create({
        pricing_type: pricingType,
        base_rate: numBase,
        standard_fat: parseFloat(standardFat) || 4.2,
        standard_snf: parseFloat(standardSnf) || 8.5,
        fat_rate: parseFloat(fatRate) || 3.5,
        snf_rate: parseFloat(snfRate) || 2.0,
        effective_date: effectiveDate,
        notes,
      });

      showToast('Milk pricing formula updated successfully and applied across all centers', 'success');
      loadRates();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update rate', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <RoleGuard onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('milk_rates')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('milk_rates_subtitle')}
          </p>
        </div>

        {/* Pricing Mode Config Form & Live Interactive Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Rate Configuration Form (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 shadow-subtle">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t('rate_config_formula')}
              </h2>
              <Badge variant="success" size="sm">{t('active_policy')}</Badge>
            </div>

            <form onSubmit={handleSaveRate} className="space-y-4 text-xs">
              {/* Pricing Type Toggle */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  {t('pricing_method')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingType('fat_snf')}
                    className={`py-2.5 px-3 border rounded text-xs font-semibold text-left transition-colors ${
                      pricingType === 'fat_snf'
                        ? 'border-brand-800 bg-brand-50 text-brand-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold">{t('fat_snf_based_rate')}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {t('fat_snf_desc')}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('fixed')}
                    className={`py-2.5 px-3 border rounded text-xs font-semibold text-left transition-colors ${
                      pricingType === 'fixed'
                        ? 'border-brand-800 bg-brand-50 text-brand-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold">{t('fixed_rate_per_litre')}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {t('fixed_rate_desc')}
                    </div>
                  </button>
                </div>
              </div>

              {/* Base Rate & Effective Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('base_rate')} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded font-bold text-slate-900 focus:ring-1 focus:ring-brand-800 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t('effective_date')}
                  </label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full h-9 px-2 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                  />
                </div>
              </div>

              {/* Fat & SNF Standards (Visible if Fat/SNF mode is active) */}
              {pricingType === 'fat_snf' && (
                <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-3">
                  <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider">
                    {t('fat_snf_settings')}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">{t('standard_fat')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={standardFat}
                        onChange={(e) => setStandardFat(e.target.value)}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">{t('fat_increment_rate')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={fatRate}
                        onChange={(e) => setFatRate(e.target.value)}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">{t('standard_snf')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={standardSnf}
                        onChange={(e) => setStandardSnf(e.target.value)}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">{t('snf_increment_rate')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={snfRate}
                        onChange={(e) => setSnfRate(e.target.value)}
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-slate-900 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {t('notes_label')}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Revised benchmark formula"
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-brand-800"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isUpdating}
                  icon={<Check className="w-4 h-4" />}
                >
                  {t('update_rate')}
                </Button>
              </div>
            </form>
          </div>

          {/* Live Calculation Preview Card (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Calculator className="w-4 h-4 text-brand-800" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {t('live_preview')}
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">
                    {t('sample_quantity')}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={testQty}
                    onChange={(e) => setTestQty(e.target.value)}
                    className="w-full h-8 px-3 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900 tabular-nums"
                  />
                </div>

                {pricingType === 'fat_snf' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">{t('fat_level')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={testFat}
                        onChange={(e) => setTestFat(e.target.value)}
                        className="w-full h-8 px-3 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">{t('snf_level')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={testSnf}
                        onChange={(e) => setTestSnf(e.target.value)}
                        className="w-full h-8 px-3 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-900 tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {/* Calculation Result Display */}
                <div className="mt-4 p-4 rounded-lg bg-brand-50/70 border border-brand-200 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-medium">{t('calculated_rate_title')}:</span>
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      ₹{previewRatePerLitre.toFixed(2)} / L
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-brand-200">
                    <span className="text-brand-900 font-bold">{t('auto_fixed_amount')}:</span>
                    <span className="text-xl font-black text-brand-900 tabular-nums">
                      {formatCurrency(previewTotal)}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-500 pt-1">
                    Formula: ₹{base.toFixed(2)} + (Fat - {stdF})×₹{fRate} + (SNF - {stdS})×₹{sRate}
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 mt-4">
              * Live preview helps verify milk pricing accuracy before broadcasting to all dock collection counters.
            </div>
          </div>
        </div>

        {/* Rate History Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                {t('rate_history')}
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t('effective_date')}</th>
                  <th className="px-3 py-2.5">{t('pricing_type')}</th>
                  <th className="px-3 py-2.5 text-right">{t('base_rate')}</th>
                  <th className="px-3 py-2.5 text-right">{t('fat_snf_settings')}</th>
                  <th className="px-3 py-2.5 text-right">{t('fat_increment_rate')}</th>
                  <th className="px-3 py-2.5 text-right">{t('snf_increment_rate')}</th>
                  <th className="px-4 py-2.5">{t('updated_by')}</th>
                  <th className="px-3 py-2.5 text-center">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rates.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{formatDate(r.effective_date)}</td>
                    <td className="px-3 py-2.5 uppercase font-semibold text-[10px] text-slate-600">
                      {r.pricing_type === 'fat_snf' ? t('fat_snf_based_rate') : t('fixed_rate')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">
                      ₹{r.base_rate.toFixed(2)}/L
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {r.standard_fat}% / {r.standard_snf}%
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      ₹{r.fat_rate.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      ₹{r.snf_rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.updated_by}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={r.is_active ? 'success' : 'default'} size="sm">
                        {r.is_active ? t('active') : t('inactive')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
};
