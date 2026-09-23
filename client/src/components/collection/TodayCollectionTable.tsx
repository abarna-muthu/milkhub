import React, { useState } from 'react';
import { Trash2, Search, Building2, UserCheck, Zap, Layers, ChevronRight } from 'lucide-react';
import { MilkCollection } from '../../types';
import { Badge } from '../common/Badge';
import { formatCurrency, formatLitres, formatPercent } from '../../utils/formatters';
import { useLanguage } from '../../context/LanguageContext';
import { useCenter } from '../../context/CenterContext';
import { useToast } from '../../context/ToastContext';
import { collectionsApi } from '../../services/api';

interface TodayCollectionTableProps {
  collections: MilkCollection[];
  onRefresh: () => void;
  onEdit?: (col: MilkCollection) => void;
}

export const TodayCollectionTable: React.FC<TodayCollectionTableProps> = ({
  collections,
  onRefresh,
}) => {
  const { t } = useLanguage();
  const { centers, selectedCenterId, setSelectedCenterId, selectedCenterName } = useCenter();
  const { showToast } = useToast();

  // Active View Mode: Show both boxes, or focus on Center box, or Direct box
  const [viewMode, setViewMode] = useState<'both' | 'center' | 'direct'>('both');

  // Box 1 (Center / Registered) Filters
  const [centerSession, setCenterSession] = useState<'all' | 'morning' | 'evening'>('all');
  const [centerSearch, setCenterSearch] = useState('');

  // Box 2 (Direct / Walk-in) Filters
  const [directSession, setDirectSession] = useState<'all' | 'morning' | 'evening'>('all');
  const [directSearch, setDirectSearch] = useState('');

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // 1. Filtered Registered / Center Collections (Box 1)
  const registeredCollections = collections.filter((c) => {
    if (c.supplier_type === 'DIRECT') return false;
    if (centerSession !== 'all' && c.session !== centerSession) return false;
    if (centerSearch.trim()) {
      const q = centerSearch.toLowerCase();
      const name = c.customer_name?.toLowerCase() || '';
      const code = c.customer_code?.toLowerCase() || '';
      const mobile = c.customer_mobile?.toLowerCase() || '';
      const village = c.village?.toLowerCase() || '';
      return name.includes(q) || code.includes(q) || mobile.includes(q) || village.includes(q);
    }
    return true;
  });

  // 2. Filtered Direct / Walk-in Collections (Box 2)
  const directCollections = collections.filter((c) => {
    if (c.supplier_type !== 'DIRECT') return false;
    if (directSession !== 'all' && c.session !== directSession) return false;
    if (directSearch.trim()) {
      const q = directSearch.toLowerCase();
      const name = c.customer_name?.toLowerCase() || '';
      const mobile = c.customer_mobile?.toLowerCase() || '';
      const center = c.center_name?.toLowerCase() || '';
      return name.includes(q) || mobile.includes(q) || center.includes(q);
    }
    return true;
  });

  // Box 1 Calculations (Center Registered)
  const regMorningCols = registeredCollections.filter((c) => c.session === 'morning');
  const regEveningCols = registeredCollections.filter((c) => c.session === 'evening');
  const regMorningTotal = Number(regMorningCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const regEveningTotal = Number(regEveningCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const regTodayTotal = Number((regMorningTotal + regEveningTotal).toFixed(1));
  const regTotalAmount = Number(registeredCollections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const regFarmersCount = new Set(registeredCollections.map((c) => c.customer_id)).size;

  // Box 2 Calculations (Direct / Walk-in)
  const dirMorningCols = directCollections.filter((c) => c.session === 'morning');
  const dirEveningCols = directCollections.filter((c) => c.session === 'evening');
  const dirMorningTotal = Number(dirMorningCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const dirEveningTotal = Number(dirEveningCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const dirTodayTotal = Number((dirMorningTotal + dirEveningTotal).toFixed(1));
  const dirTotalAmount = Number(directCollections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const dirPaidCount = directCollections.filter((c) => c.payment_status === 'PAID').length;
  const dirPendingCount = directCollections.filter((c) => c.payment_status === 'PENDING').length;

  // Combined Grand Totals
  const grandTotalMilk = Number((regTodayTotal + dirTodayTotal).toFixed(1));
  const grandTotalAmount = Number((regTotalAmount + dirTotalAmount).toFixed(2));

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete collection entry for ${name}?`)) return;
    setIsDeleting(id);
    try {
      await collectionsApi.delete(id);
      showToast('Collection entry removed', 'info');
      onRefresh();
    } catch (err: any) {
      showToast('Failed to delete entry', 'error');
    } finally {
      setIsDeleting(null);
    }
  };

  const activeCenter = centers.find((c) => c.id === selectedCenterId);

  return (
    <div className="space-y-6 mt-6">
      {/* Consolidated Master Control Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-900" />
            <h2 className="text-sm font-extrabold text-slate-900">
              {t('register_title')}
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {t('register_subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Center Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600">{t('active_center')}:</span>
            <select
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
              className="h-8 px-2.5 bg-slate-50 border border-slate-300 rounded font-bold text-brand-900 focus:outline-none focus:ring-1 focus:ring-brand-800"
            >
              <option value="all">{t('all_centers')}</option>
              {centers.map((ctr) => (
                <option key={ctr.id} value={ctr.id}>
                  {ctr.name} ({ctr.code})
                </option>
              ))}
            </select>
          </div>

          {/* Two-Box Display Mode Switcher */}
          <div className="flex items-center border border-slate-300 rounded overflow-hidden h-8 bg-white font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`px-3 h-full transition-colors ${
                viewMode === 'both'
                  ? 'bg-brand-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('show_both_boxes')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('center')}
              className={`px-3 h-full transition-colors ${
                viewMode === 'center'
                  ? 'bg-emerald-800 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('center_box_only')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('direct')}
              className={`px-3 h-full transition-colors ${
                viewMode === 'direct'
                  ? 'bg-amber-700 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('direct_box_only')}
            </button>
          </div>
        </div>
      </div>

      {/* TWO SEPARATE SUMMARY KPI BOXES (Center Box vs Direct Box) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SUMMARY BOX 1: CENTER REGISTERED */}
        <div className="bg-emerald-50/70 border-2 border-emerald-600 rounded-lg p-4 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-brand-900 text-white flex items-center justify-center text-xs font-bold">
                🏢
              </span>
              <div>
                <h3 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider">
                  {t('box1_title')}
                </h3>
                <p className="text-[10px] text-emerald-800">
                  {selectedCenterId === 'all' ? t('all_centers') : (activeCenter?.name || selectedCenterName)}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
              {t('box1_badge')}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-3 text-center">
            <div className="bg-white/80 rounded p-2 border border-emerald-100">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">{t('morning_total')}</span>
              <strong className="text-xs font-bold text-slate-900 tabular-nums">{regMorningTotal} L</strong>
            </div>
            <div className="bg-white/80 rounded p-2 border border-emerald-100">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">{t('evening_total')}</span>
              <strong className="text-xs font-bold text-slate-900 tabular-nums">{regEveningTotal} L</strong>
            </div>
            <div className="bg-white/80 rounded p-2 border border-emerald-100">
              <span className="text-[10px] text-brand-900 font-bold block uppercase">{t('center_daily_total')}</span>
              <strong className="text-sm font-extrabold text-brand-900 tabular-nums">{regTodayTotal} L</strong>
            </div>
            <div className="bg-white/80 rounded p-2 border border-emerald-100">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">{t('amount')}</span>
              <strong className="text-xs font-bold text-emerald-800 tabular-nums">{formatCurrency(regTotalAmount)}</strong>
            </div>
          </div>
          <div className="text-[11px] text-emerald-800 font-medium mt-2 flex items-center justify-between">
            <span>{t('active_farmers')}: <strong>{regFarmersCount}</strong></span>
            <span>{t('total')}: <strong>{registeredCollections.length}</strong></span>
          </div>
        </div>

        {/* SUMMARY BOX 2: DIRECT / WALK-IN */}
        <div className="bg-amber-50/70 border-2 border-amber-500 rounded-lg p-4 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                ⚡
              </span>
              <div>
                <h3 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                  {t('box2_title')}
                </h3>
                <p className="text-[10px] text-amber-800">
                  {t('box2_subtitle')}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
              {t('box2_badge')}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-3 text-center">
            <div className="bg-white/80 rounded p-2 border border-amber-100">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">{t('morning_total')}</span>
              <strong className="text-xs font-bold text-slate-900 tabular-nums">{dirMorningTotal} L</strong>
            </div>
            <div className="bg-white/80 rounded p-2 border border-amber-100">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">{t('evening_total')}</span>
              <strong className="text-xs font-bold text-slate-900 tabular-nums">{dirEveningTotal} L</strong>
            </div>
            <div className="bg-white/80 rounded p-2 border border-amber-100">
              <span className="text-[10px] text-amber-900 font-bold block uppercase">{t('direct_total_milk')}</span>
              <strong className="text-sm font-extrabold text-amber-900 tabular-nums">{dirTodayTotal} L</strong>
            </div>
            <div className="bg-white/80 rounded p-2 border border-amber-100">
              <span className="text-[10px] text-slate-500 font-semibold block uppercase">{t('amount')}</span>
              <strong className="text-xs font-bold text-emerald-800 tabular-nums">{formatCurrency(dirTotalAmount)}</strong>
            </div>
          </div>
          <div className="text-[11px] text-amber-800 font-medium mt-2 flex items-center justify-between">
            <span>{t('walk_ins_status')}: <strong className="text-emerald-700">{dirPaidCount} {t('paid_spot')}</strong>, <strong className="text-amber-700">{dirPendingCount} {t('pending')}</strong></span>
            <span>{t('total')}: <strong>{directCollections.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Combined Grand Total Strip */}
      <div className="bg-slate-900 text-white rounded-lg px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-semibold">
            {t('combined_daily_total')}:
          </span>
          <span className="font-bold text-white">
            {selectedCenterId === 'all' ? t('all_centers') : (activeCenter?.name || selectedCenterName)}
          </span>
        </div>

        <div className="flex items-center gap-5 tabular-nums">
          <div>
            <span className="text-slate-400 text-[10px] mr-1.5">{t('box1_title')}:</span>
            <span className="font-bold text-emerald-300">{regTodayTotal} L</span>
          </div>
          <span className="text-slate-500">+</span>
          <div>
            <span className="text-slate-400 text-[10px] mr-1.5">{t('box2_title')}:</span>
            <span className="font-bold text-amber-300">{dirTodayTotal} L</span>
          </div>
          <span className="text-slate-500">=</span>
          <div>
            <span className="text-slate-400 text-[10px] mr-1.5">{t('grand_total_milk')}:</span>
            <span className="font-extrabold text-white text-sm">{grandTotalMilk} L</span>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <span className="text-slate-400 text-[10px] mr-1.5">{t('combined_amount')}:</span>
            <span className="font-extrabold text-emerald-300 text-sm">{formatCurrency(grandTotalAmount)}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOX 1: CENTER MILK COLLECTION (REGISTERED SUPPLIERS)                     */}
      {/* ========================================================================= */}
      {(viewMode === 'both' || viewMode === 'center') && (
        <div className="bg-white border-2 border-emerald-600 rounded-lg shadow-subtle overflow-hidden">
          {/* Box 1 Header Bar */}
          <div className="px-5 py-3 bg-emerald-50/80 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-brand-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                🏢
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {t('box1_title')}
                  </h3>
                  <span className="text-[10px] font-bold bg-brand-100 text-brand-900 px-2 py-0.5 rounded border border-brand-200 font-mono">
                    {selectedCenterId === 'all' ? 'ALL CENTERS' : (activeCenter?.code || 'SVPR')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t('box1_subtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* Session Toggle for Box 1 */}
              <div className="flex items-center border border-slate-300 rounded overflow-hidden h-7 bg-white text-xs">
                <button
                  type="button"
                  onClick={() => setCenterSession('all')}
                  className={`px-2.5 font-semibold h-full ${
                    centerSession === 'all' ? 'bg-brand-900 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({registeredCollections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCenterSession('morning')}
                  className={`px-2.5 font-semibold h-full ${
                    centerSession === 'morning' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Morning
                </button>
                <button
                  type="button"
                  onClick={() => setCenterSession('evening')}
                  className={`px-2.5 font-semibold h-full ${
                    centerSession === 'evening' ? 'bg-indigo-700 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Evening
                </button>
              </div>

              {/* Search Box 1 */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={centerSearch}
                  onChange={(e) => setCenterSearch(e.target.value)}
                  placeholder="Search registered..."
                  className="h-7 pl-7 pr-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-800 w-40"
                />
              </div>
            </div>
          </div>

          {/* Box 1 Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-5 py-2.5 bg-emerald-50/40 border-b border-emerald-100 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Morning Total
              </span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {regMorningTotal} L
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Evening Total
              </span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {regEveningTotal} L
              </span>
            </div>

            <div>
              <span className="text-[11px] text-brand-900 font-bold block uppercase tracking-wider">
                Center Daily Total
              </span>
              <span className="font-extrabold text-brand-900 text-base tabular-nums">
                {regTodayTotal} L
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Total Amount
              </span>
              <span className="font-bold text-emerald-800 text-base tabular-nums">
                {formatCurrency(regTotalAmount)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Active Farmers
              </span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {regFarmersCount} Suppliers
              </span>
            </div>
          </div>

          {/* Box 1 Registered Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Supplier ID</th>
                  <th className="px-4 py-2.5">Farmer Name</th>
                  <th className="px-3 py-2.5">Area / Village</th>
                  <th className="px-3 py-2.5">Center</th>
                  <th className="px-3 py-2.5">Session</th>
                  <th className="px-3 py-2.5 text-right">Milk (L)</th>
                  <th className="px-3 py-2.5 text-right">Fat %</th>
                  <th className="px-3 py-2.5 text-right">SNF %</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredCollections.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-slate-400">
                      No registered supplier collections found for this session / center
                    </td>
                  </tr>
                ) : (
                  registeredCollections.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand-900 whitespace-nowrap">
                        {item.customer_code}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {item.customer_name}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {item.village || '---'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 font-medium">
                        {item.center_name || 'Center'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={item.session === 'morning' ? 'morning' : 'evening'}>
                          {item.session === 'morning' ? 'Morning' : 'Evening'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-slate-900 tabular-nums">
                        {formatLitres(item.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatPercent(item.fat_percentage)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatPercent(item.snf_percentage)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        ₹{item.calculated_rate?.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-900 tabular-nums">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                          <UserCheck className="w-2.5 h-2.5 mr-1" /> Registered
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.customer_name || 'Supplier')}
                          disabled={isDeleting === item.id}
                          className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BOX 2: DIRECT / WALK-IN MILK SUPPLIERS COLLECTION                         */}
      {/* ========================================================================= */}
      {(viewMode === 'both' || viewMode === 'direct') && (
        <div className="bg-white border-2 border-amber-500 rounded-lg shadow-subtle overflow-hidden">
          {/* Box 2 Header Bar */}
          <div className="px-5 py-3 bg-amber-50/80 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {t('box2_title')}
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                    {t('box2_badge')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {t('box2_subtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {/* Session Toggle for Box 2 */}
              <div className="flex items-center border border-slate-300 rounded overflow-hidden h-7 bg-white text-xs">
                <button
                  type="button"
                  onClick={() => setDirectSession('all')}
                  className={`px-2.5 font-semibold h-full ${
                    directSession === 'all' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  All ({directCollections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectSession('morning')}
                  className={`px-2.5 font-semibold h-full ${
                    directSession === 'morning' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Morning
                </button>
                <button
                  type="button"
                  onClick={() => setDirectSession('evening')}
                  className={`px-2.5 font-semibold h-full ${
                    directSession === 'evening' ? 'bg-indigo-700 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Evening
                </button>
              </div>

              {/* Search Box 2 */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={directSearch}
                  onChange={(e) => setDirectSearch(e.target.value)}
                  placeholder="Search walk-in..."
                  className="h-7 pl-7 pr-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-800 w-40"
                />
              </div>
            </div>
          </div>

          {/* Box 2 Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 px-5 py-2.5 bg-amber-50/40 border-b border-amber-100 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Morning Direct
              </span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {dirMorningTotal} L
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Evening Direct
              </span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {dirEveningTotal} L
              </span>
            </div>

            <div>
              <span className="text-[11px] text-amber-900 font-bold block uppercase tracking-wider">
                Direct Total Milk
              </span>
              <span className="font-extrabold text-amber-900 text-base tabular-nums">
                {dirTodayTotal} L
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Direct Amount
              </span>
              <span className="font-bold text-emerald-800 text-base tabular-nums">
                {formatCurrency(dirTotalAmount)}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 font-semibold block uppercase tracking-wider">
                Walk-ins / Payment
              </span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {directCollections.length} entries ({dirPaidCount} Paid, {dirPendingCount} Pending)
              </span>
            </div>
          </div>

          {/* Box 2 Direct Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Collection Center</th>
                  <th className="px-4 py-2.5">Farmer Name</th>
                  <th className="px-3 py-2.5">Mobile</th>
                  <th className="px-3 py-2.5">Session</th>
                  <th className="px-3 py-2.5 text-right">Milk (L)</th>
                  <th className="px-3 py-2.5 text-right">Fat %</th>
                  <th className="px-3 py-2.5 text-right">SNF %</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-center">Payment Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directCollections.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                      No direct walk-in supplier collections recorded today
                    </td>
                  </tr>
                ) : (
                  directCollections.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                        {item.center_name || 'Center'}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {item.customer_name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                        {item.customer_mobile || '---'}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant={item.session === 'morning' ? 'morning' : 'evening'}>
                          {item.session === 'morning' ? 'Morning' : 'Evening'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right font-extrabold text-slate-900 tabular-nums">
                        {formatLitres(item.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatPercent(item.fat_percentage)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {formatPercent(item.snf_percentage)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        ₹{item.calculated_rate?.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-brand-900 tabular-nums">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {item.payment_status === 'PAID' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            ✓ Paid (Spot)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            ⌛ Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.customer_name || 'Supplier')}
                          disabled={isDeleting === item.id}
                          className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
