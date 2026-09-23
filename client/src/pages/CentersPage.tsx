import React, { useState, useEffect } from 'react';
import { Building2, Plus, Phone, MapPin, Users, Milk, DollarSign, Check, Edit2, ArrowRight } from 'lucide-react';
import { CollectionCenter } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { centersApi } from '../services/api';
import { formatCurrency, formatLitres } from '../utils/formatters';

interface CentersPageProps {
  onNavigate: (path: string, param?: string) => void;
}

export const CentersPage: React.FC<CentersPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { centers, refreshCenters, selectedCenterId, setSelectedCenterId } = useCenter();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [centerList, setCenterList] = useState<CollectionCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CollectionCenter | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCentersWithMetrics = async () => {
    setIsLoading(true);
    try {
      const data = await centersApi.getAll();
      setCenterList(data);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCentersWithMetrics();
  }, []);

  const handleOpenAdd = () => {
    setEditingCenter(null);
    setName('');
    setLocation('');
    setCode('');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (center: CollectionCenter) => {
    setEditingCenter(center);
    setName(center.name);
    setLocation(center.location);
    setCode(center.code);
    setPhone(center.phone);
    setIsModalOpen(true);
  };

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !code.trim()) {
      showToast('Name, Location, and Code are required', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCenter) {
        await centersApi.update(editingCenter.id, { name, location, code, phone });
        showToast('Center updated successfully', 'success');
      } else {
        await centersApi.create({ name, location, code, phone });
        showToast('New collection center added', 'success');
      }

      setIsModalOpen(false);
      loadCentersWithMetrics();
      refreshCenters();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save center', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (center: CollectionCenter) => {
    if (!isAdmin) {
      showToast('Only Administrators can modify centers', 'warning');
      return;
    }
    const newStatus = !center.is_active;
    try {
      await centersApi.update(center.id, { is_active: newStatus });
      showToast(`Center ${newStatus ? 'activated' : 'deactivated'}`, 'info');
      loadCentersWithMetrics();
      refreshCenters();
    } catch (err) {
      showToast('Failed to change status', 'error');
    }
  };

  const handleSelectCenterFilter = (id: string) => {
    setSelectedCenterId(id);
    showToast(`CRM filter set to ${centerList.find((c) => c.id === id)?.name}`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('collection_centers')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('centers_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              icon={<Plus className="w-4 h-4" />}
            >
              {t('add_center')}
            </Button>
          )}
        </div>
      </div>

      {/* Centers Business Dashboard Cards (Requirement 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {centerList.map((center) => {
          const isSelected = selectedCenterId === center.id;
          const morningMilk = center.today_morning_milk ?? 0;
          const eveningMilk = center.today_evening_milk ?? 0;
          const todayTotal = center.today_total_milk ?? (morningMilk + eveningMilk);
          const supplierCount = center.supplier_count ?? 0;
          const todayAmount = center.today_amount ?? 0;
          const monthlyMilk = center.monthly_total_milk ?? 0;
          const monthlyAmount = center.monthly_amount ?? 0;
          const pendingPayments = center.pending_amount ?? 0;

          return (
            <div
              key={center.id}
              className={`bg-white border rounded-lg p-5 shadow-subtle flex flex-col justify-between transition-all ${
                isSelected
                  ? 'border-brand-800 ring-2 ring-brand-800/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Center Title & Badges */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded bg-brand-50 border border-brand-200 text-brand-900 flex items-center justify-center font-bold text-sm">
                      {center.code}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{center.name}</h2>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {center.location}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={center.is_active ? 'success' : 'default'} size="sm">
                      {center.is_active ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                </div>

                {/* Real Business Statistics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 text-xs">
                  {/* Morning Milk */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t('morning')}
                    </span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      {morningMilk} L
                    </span>
                  </div>

                  {/* Evening Milk */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t('evening')}
                    </span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">
                      {eveningMilk} L
                    </span>
                  </div>

                  {/* Today's Total */}
                  <div className="p-2.5 bg-emerald-50/60 rounded border border-emerald-200">
                    <span className="text-[11px] text-brand-900 font-bold block">
                      {t('today_total')}
                    </span>
                    <span className="text-base font-extrabold text-brand-900 tabular-nums">
                      {todayTotal} L
                    </span>
                  </div>

                  {/* Registered Suppliers */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t('customers_suppliers')}
                    </span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {supplierCount}
                    </span>
                  </div>

                  {/* Today's Amount */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t('today_amount')}
                    </span>
                    <span className="text-sm font-bold text-emerald-800 tabular-nums">
                      {formatCurrency(todayAmount)}
                    </span>
                  </div>

                  {/* Monthly Milk */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t('monthly_milk_report')}
                    </span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatLitres(monthlyMilk)}
                    </span>
                  </div>

                  {/* Monthly Amount */}
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-semibold block">
                      {t('total_amount_calc')}
                    </span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatCurrency(monthlyAmount)}
                    </span>
                  </div>

                  {/* Pending Payments */}
                  <div className="p-2.5 bg-amber-50/60 rounded border border-amber-200 col-span-2 sm:col-span-2">
                    <span className="text-[11px] text-amber-900 font-semibold block">
                      Pending Payments
                    </span>
                    <span className="text-base font-bold text-amber-800 tabular-nums">
                      {formatCurrency(pendingPayments)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCenterFilter(center.id)}
                    className={`px-3 py-1.5 rounded font-semibold transition-colors ${
                      isSelected
                        ? 'bg-brand-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? '✓ Current Center Filter' : 'Select this Center'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCenterId(center.id);
                      onNavigate('collection');
                    }}
                    className="px-2.5 py-1.5 text-brand-900 hover:underline font-semibold flex items-center gap-1"
                  >
                    Intake Dock <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(center)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                      title="Edit Center"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(center)}
                      className={`text-[11px] font-medium px-2 py-1 rounded ${
                        center.is_active
                          ? 'text-rose-700 hover:bg-rose-50'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {center.is_active ? t('deactivate') : t('activate')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Center Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCenter ? 'Edit Collection Center' : t('add_center')}
      >
        <form onSubmit={handleSaveCenter} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {t('center_name')} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Srivilliputtur Center"
              className="w-full h-9 px-3 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {t('code')} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SVPR"
              className="w-full h-9 px-3 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900 uppercase font-mono"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {t('location')} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Madurai Road, Srivilliputtur"
              className="w-full h-9 px-3 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Contact Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98421 11220"
              className="w-full h-9 px-3 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Save Center
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
