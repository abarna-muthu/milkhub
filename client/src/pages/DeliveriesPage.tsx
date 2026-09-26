import React, { useState, useEffect, useMemo } from 'react';
import {
  Sun,
  Moon,
  Search,
  Building2,
  Calendar,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Plus,
  Minus,
  Milk,
  Filter,
  Check,
  TrendingUp,
} from 'lucide-react';
import { deliveriesApi, centersApi } from '../services/api';
import { Delivery, DeliverySession, DeliveryStatus, CollectionCenter } from '../types';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button';

interface DeliveriesPageProps {
  initialSession?: DeliverySession;
  onNavigate?: (path: string, param?: string) => void;
}

interface RowState {
  actual_qty: number;
  status: DeliveryStatus;
  isModified: boolean;
  isSaving: boolean;
}

export const DeliveriesPage: React.FC<DeliveriesPageProps> = ({
  initialSession = 'MORNING',
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  // Filters & State
  const [selectedSession, setSelectedSession] = useState<DeliverySession>(initialSession);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'DELIVERED' | 'NO_MILK'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [centerTotals, setCenterTotals] = useState<{
    date: string;
    centers: Array<{
      center_id: string;
      center_name: string;
      morning_total: number;
      evening_total: number;
      daily_total: number;
    }>;
    overall: {
      morning_total: number;
      evening_total: number;
      daily_total: number;
    };
  } | null>(null);

  // Row Edit States: map of customer_id -> RowState
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  // Loading flags
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Sync session prop changes
  useEffect(() => {
    if (initialSession) {
      setSelectedSession(initialSession);
    }
  }, [initialSession]);

  // Load centers once
  useEffect(() => {
    loadCenters();
  }, []);

  // Reload deliveries and totals whenever date, session, or center filter changes
  useEffect(() => {
    loadData();
  }, [selectedDate, selectedSession, selectedCenterId]);

  const loadCenters = async () => {
    try {
      const data = await centersApi.getAll();
      setCenters(data);
    } catch (err) {
      console.warn('Failed to load centers:', err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Deliveries
      const res = await deliveriesApi.getAll({
        date: selectedDate,
        session: selectedSession,
        center_id: selectedCenterId !== 'all' ? selectedCenterId : undefined,
      });

      setDeliveries(res.deliveries);

      // Initialize row editing state for each row
      const initialRowStates: Record<string, RowState> = {};
      res.deliveries.forEach((d: Delivery) => {
        initialRowStates[d.customer_id] = {
          actual_qty: Number(d.actual_qty),
          status: d.status,
          isModified: false,
          isSaving: false,
        };
      });
      setRowStates(initialRowStates);

      // 2. Fetch Center Totals
      const totals = await deliveriesApi.getCenterTotals(selectedDate);
      setCenterTotals(totals);
    } catch (err: any) {
      console.error('Failed to load deliveries data:', err);
      showToast('Failed to load deliveries data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Actual Qty change for a row
  const handleQtyChange = (customerId: string, newQty: number) => {
    const safeQty = Math.max(0, Number(newQty.toFixed(2)));
    setRowStates((prev) => {
      const current = prev[customerId];
      if (!current) return prev;

      const newStatus: DeliveryStatus = safeQty === 0 ? 'NO_MILK' : 'DELIVERED';

      return {
        ...prev,
        [customerId]: {
          ...current,
          actual_qty: safeQty,
          status: newStatus,
          isModified: true,
        },
      };
    });
  };

  // Step quantity by delta (e.g. +0.5, -0.5, +1.0)
  const handleStepQty = (customerId: string, delta: number) => {
    const current = rowStates[customerId];
    if (!current) return;
    const updated = Math.max(0, current.actual_qty + delta);
    handleQtyChange(customerId, updated);
  };

  // Handle Status change for a row
  const handleStatusChange = (customerId: string, status: DeliveryStatus) => {
    setRowStates((prev) => {
      const current = prev[customerId];
      if (!current) return prev;

      let qty = current.actual_qty;
      if (status === 'NO_MILK') {
        qty = 0;
      } else if (qty === 0) {
        // Find default qty if switching back to DELIVERED
        const original = deliveries.find((d) => d.customer_id === customerId);
        qty = Number(original?.default_qty || 1.0);
      }

      return {
        ...prev,
        [customerId]: {
          ...current,
          status,
          actual_qty: qty,
          isModified: true,
        },
      };
    });
  };

  // Reset row to original pre-filled default
  const handleResetToDefault = (customerId: string) => {
    const original = deliveries.find((d) => d.customer_id === customerId);
    if (!original) return;

    setRowStates((prev) => ({
      ...prev,
      [customerId]: {
        actual_qty: Number(original.default_qty || 1.0),
        status: 'DELIVERED',
        isModified: true,
        isSaving: false,
      },
    }));
  };

  // Save single delivery row
  const handleSaveRow = async (delivery: Delivery) => {
    const rowState = rowStates[delivery.customer_id];
    if (!rowState) return;

    setRowStates((prev) => ({
      ...prev,
      [delivery.customer_id]: { ...prev[delivery.customer_id], isSaving: true },
    }));

    try {
      await deliveriesApi.save({
        id: delivery.is_saved ? delivery.id : undefined,
        customer_id: delivery.customer_id,
        center_id: delivery.center_id,
        date: selectedDate,
        session: selectedSession,
        actual_qty: rowState.actual_qty,
        status: rowState.status,
      });

      showToast(
        `Recorded ${rowState.status === 'NO_MILK' ? 'No Milk' : `${rowState.actual_qty}L`} for ${delivery.customer_name} (Default remains ${delivery.default_qty}L)`,
        'success'
      );

      // Refresh totals and mark row as not modified
      const totals = await deliveriesApi.getCenterTotals(selectedDate);
      setCenterTotals(totals);

      setDeliveries((prev) =>
        prev.map((d) =>
          d.customer_id === delivery.customer_id
            ? {
                ...d,
                actual_qty: rowState.actual_qty,
                status: rowState.status,
                total_amount: Number((rowState.actual_qty * Number(d.rate || 60.0)).toFixed(2)),
                is_saved: true,
              }
            : d
        )
      );

      setRowStates((prev) => ({
        ...prev,
        [delivery.customer_id]: { ...prev[delivery.customer_id], isModified: false, isSaving: false },
      }));
    } catch (err: any) {
      console.error('Failed to save delivery:', err);
      showToast('Failed to save delivery record', 'error');
      setRowStates((prev) => ({
        ...prev,
        [delivery.customer_id]: { ...prev[delivery.customer_id], isSaving: false },
      }));
    }
  };

  // Bulk save all modified or unsaved rows
  const handleSaveAll = async () => {
    // Collect rows to save
    const toSaveList: Array<{
      id?: string;
      customer_id: string;
      center_id: string;
      date: string;
      session: DeliverySession;
      actual_qty: number;
      status: DeliveryStatus;
    }> = [];

    deliveries.forEach((d) => {
      const state = rowStates[d.customer_id];
      if (state && (state.isModified || !d.is_saved)) {
        toSaveList.push({
          id: d.is_saved ? d.id : undefined,
          customer_id: d.customer_id,
          center_id: d.center_id,
          date: selectedDate,
          session: selectedSession,
          actual_qty: state.actual_qty,
          status: state.status,
        });
      }
    });

    if (toSaveList.length === 0) {
      showToast('All deliveries are already saved and up to date.', 'info');
      return;
    }

    setIsBulkSaving(true);
    try {
      const res = await deliveriesApi.saveBulk(toSaveList);
      showToast(`Saved ${res.saved.length} deliveries successfully!`, 'success');
      // Reload completely to update totals and table
      await loadData();
    } catch (err: any) {
      console.error('Failed to bulk save deliveries:', err);
      showToast('Failed to save all deliveries', 'error');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Filter deliveries by search query & status
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        const state = rowStates[d.customer_id];
        const status = state ? state.status : d.status;
        if (status !== statusFilter) return false;
      }

      // 2. Search Query (Supplier Name, Code, Phone, Center)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          d.customer_name?.toLowerCase().includes(q) ||
          d.customer_code?.toLowerCase().includes(q) ||
          d.phone?.includes(q) ||
          d.center_name?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [deliveries, searchQuery, statusFilter, rowStates]);

  // Count modified or unsaved rows
  const pendingSaveCount = useMemo(() => {
    return deliveries.filter((d) => {
      const state = rowStates[d.customer_id];
      return state && (state.isModified || !d.is_saved);
    }).length;
  }, [deliveries, rowStates]);

  // Current session actual total litres in table
  const currentTableTotalLitres = useMemo(() => {
    return filteredDeliveries.reduce((sum, d) => {
      const state = rowStates[d.customer_id];
      const qty = state ? state.actual_qty : d.actual_qty;
      const status = state ? state.status : d.status;
      return sum + (status === 'DELIVERED' ? Number(qty || 0) : 0);
    }, 0);
  }, [filteredDeliveries, rowStates]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {selectedSession === 'MORNING' ? 'Morning Delivery' : 'Evening Delivery'}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selectedSession === 'MORNING'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
              }`}
            >
              {selectedSession === 'MORNING' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  Morning Session
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  Evening Session
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fast daily quantity entry. Default quantities appear automatically. Modifying today's actual quantity{' '}
            <span className="font-semibold text-slate-700">never</span> changes the customer's permanent default.
          </p>
        </div>

        {/* Action Buttons: Session Switcher & Save All */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Morning / Evening Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSelectedSession('MORNING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                selectedSession === 'MORNING'
                  ? 'bg-white text-amber-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              Morning
            </button>
            <button
              type="button"
              onClick={() => setSelectedSession('EVENING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                selectedSession === 'EVENING'
                  ? 'bg-white text-indigo-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              Evening
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveAll}
            isLoading={isBulkSaving}
            icon={<Save className="w-4 h-4" />}
            className={pendingSaveCount > 0 ? 'bg-brand-900 hover:bg-brand-950 ring-2 ring-brand-700/50' : ''}
          >
            {pendingSaveCount > 0 ? `Save All (${pendingSaveCount})` : 'Save All'}
          </Button>
        </div>
      </div>

      {/* Center-Wise Real-time Totals Banner */}
      {centerTotals && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-700" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Center-Wise Daily Collection Summary ({centerTotals.date})
              </h2>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Calculated live from actual delivery records
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Overall Card */}
            <div className="bg-slate-900 text-white rounded-lg p-3.5 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  All Centers Combined
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  Overall
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black tracking-tight">
                    {centerTotals.overall.daily_total.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">L Total</span>
                </div>
                <div className="text-right text-[11px] text-slate-300 font-medium">
                  <div>M: <span className="font-mono text-amber-300 font-bold">{centerTotals.overall.morning_total.toFixed(1)}L</span></div>
                  <div>E: <span className="font-mono text-indigo-300 font-bold">{centerTotals.overall.evening_total.toFixed(1)}L</span></div>
                </div>
              </div>
            </div>

            {/* Individual Centers */}
            {centerTotals.centers.map((c) => (
              <div
                key={c.center_id}
                className="bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200/80 rounded-lg p-3.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-brand-700 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 truncate">{c.center_name}</span>
                  </div>
                  <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                    Center
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {c.daily_total.toFixed(2)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 ml-1">L</span>
                  </div>
                  <div className="text-right text-[11px] text-slate-600 font-medium space-y-0.5">
                    <div>
                      Morning: <span className="font-mono font-bold text-amber-700">{c.morning_total.toFixed(1)}L</span>
                    </div>
                    <div>
                      Evening: <span className="font-mono font-bold text-indigo-700">{c.evening_total.toFixed(1)}L</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Date Picker with Quick Selectors */}
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-800"
              />
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded border transition-colors ${
                selectedDate === new Date().toISOString().split('T')[0]
                  ? 'bg-brand-900 text-white border-brand-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y.toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1.5 text-[11px] font-semibold rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Yesterday
            </button>
          </div>

          {/* Center Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCenterId}
              onChange={(e) => setSelectedCenterId(e.target.value)}
              className="py-1.5 px-2.5 text-xs font-medium border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-800"
            >
              <option value="all">All Collection Centers</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.center_name || c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-2.5 text-xs font-medium border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-800"
            >
              <option value="all">All Status</option>
              <option value="DELIVERED">Delivered Only</option>
              <option value="NO_MILK">No Milk Only</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search supplier, code, phone..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-800"
            />
          </div>
        </div>

        {/* Live Filter Summary */}
        <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
          <span className="bg-slate-100 px-2.5 py-1 rounded text-slate-700">
            Suppliers: <strong className="text-slate-900">{filteredDeliveries.length}</strong>
          </span>
          <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded font-semibold">
            {selectedSession === 'MORNING' ? 'Morning' : 'Evening'} Litres:{' '}
            <strong className="text-emerald-950 font-bold">{currentTableTotalLitres.toFixed(2)}L</strong>
          </span>
        </div>
      </div>

      {/* Fast Daily Delivery Entry Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-subtle">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Center</th>
                <th className="py-3 px-4 text-center">Default Qty</th>
                <th className="py-3 px-4 text-center min-w-[210px]">Today's Actual Qty</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Rate</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Milk className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No active suppliers found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((delivery, index) => {
                  const state = rowStates[delivery.customer_id] || {
                    actual_qty: Number(delivery.actual_qty),
                    status: delivery.status,
                    isModified: false,
                    isSaving: false,
                  };

                  const isModified = state.isModified;
                  const isNoMilk = state.status === 'NO_MILK';
                  const rate = Number(delivery.rate || 60.0);
                  const rowAmount = (state.actual_qty * rate).toFixed(2);

                  return (
                    <tr
                      key={delivery.customer_id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isModified ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Supplier Information */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {delivery.customer_name?.charAt(0) || 'S'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">
                              {delivery.customer_name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono font-medium text-brand-900 bg-brand-50 px-1 rounded">
                                {delivery.customer_code}
                              </span>
                              {delivery.phone && <span>• {delivery.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Center */}
                      <td className="py-3 px-4 text-slate-600">
                        <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {delivery.center_name || 'All Centers'}
                        </span>
                      </td>

                      {/* Default Qty (from Customer master) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 font-mono text-slate-500 font-semibold bg-slate-100/70 px-2.5 py-1 rounded text-xs">
                          <span>{Number(delivery.default_qty || 1.0).toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400">L</span>
                        </div>
                      </td>

                      {/* Today's Actual Qty (Editable) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Stepper Down (-0.5L) */}
                          <button
                            type="button"
                            onClick={() => handleStepQty(delivery.customer_id, -0.5)}
                            disabled={isNoMilk || state.actual_qty <= 0}
                            title="Decrease 0.5L"
                            className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          {/* Direct Input */}
                          <div className="relative w-20">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="999"
                              value={isNoMilk ? 0 : state.actual_qty}
                              disabled={isNoMilk}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleQtyChange(delivery.customer_id, isNaN(val) ? 0 : val);
                              }}
                              className={`w-full text-center py-1 font-mono font-bold text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-800 transition-all ${
                                isNoMilk
                                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                                  : isModified
                                  ? 'bg-amber-50 text-slate-900 border-amber-400 ring-1 ring-amber-300'
                                  : 'bg-white text-slate-900 border-slate-300'
                              }`}
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                              L
                            </span>
                          </div>

                          {/* Stepper Up (+0.5L) */}
                          <button
                            type="button"
                            onClick={() => handleStepQty(delivery.customer_id, 0.5)}
                            disabled={isNoMilk}
                            title="Increase 0.5L"
                            className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick shortcuts */}
                          <div className="flex items-center gap-1 pl-1">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(delivery.customer_id, 1.0)}
                              className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Set 1.0L"
                            >
                              1L
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(delivery.customer_id, 1.5)}
                              className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                              title="Set 1.5L"
                            >
                              1.5L
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetToDefault(delivery.customer_id)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="Reset to default"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Status: Delivered vs No Milk */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-100">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(delivery.customer_id, 'DELIVERED')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight transition-colors ${
                              !isNoMilk
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            DELIVERED
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(delivery.customer_id, 'NO_MILK')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight transition-colors ${
                              isNoMilk
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-500 hover:text-rose-700'
                            }`}
                          >
                            NO MILK
                          </button>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{rate.toFixed(2)}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{rowAmount}
                      </td>

                      {/* Action / Save Status */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {state.isSaving ? (
                            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                          ) : isModified ? (
                            <button
                              type="button"
                              onClick={() => handleSaveRow(delivery)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand-900 hover:bg-brand-950 text-white text-[11px] font-semibold shadow-xs transition-colors"
                            >
                              <Save className="w-3 h-3" />
                              Save
                            </button>
                          ) : delivery.is_saved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Saved
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveRow(delivery)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition-colors"
                            >
                              <Save className="w-3 h-3 text-slate-500" />
                              Confirm
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>
              <strong>Rule 5:</strong> Modifying today's actual quantity saves today's delivery record without modifying the customer's permanent default quantity.
            </span>
          </div>
          <div>
            Showing <strong>{filteredDeliveries.length}</strong> suppliers • {pendingSaveCount} pending changes
          </div>
        </div>
      </div>
    </div>
  );
};
