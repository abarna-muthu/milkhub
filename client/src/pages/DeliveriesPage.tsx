import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sun,
  Moon,
  Calendar,
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  X,
  Phone,
  MapPin,
  Sparkles,
  Info,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { DeliverySession, DeliveryStatus, DeliveryItem, SaveDeliveryPayload } from '../types';
import { deliveryApi } from '../services/api';
import { useToast } from '../context/ToastContext';

interface DeliveriesPageProps {
  initialSession?: DeliverySession;
}

export const DeliveriesPage: React.FC<DeliveriesPageProps> = ({
  initialSession = 'morning',
}) => {
  const { showToast } = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [session, setSession] = useState<DeliverySession>(initialSession);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'delivered' | 'no_milk'>('all');

  // Local state of delivery items for quick, reactive editing
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Sync if initialSession prop changes
  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
    }
  }, [initialSession]);

  // Load deliveries from server
  const loadDeliveries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await deliveryApi.getDeliveries(selectedDate, session);
      setDeliveryItems(Array.isArray(data?.deliveries) ? data.deliveries : []);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error('Failed to load deliveries:', err);
      showToast(err.response?.data?.error || 'Failed to load deliveries', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, session, showToast]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Handle quantity edit
  const handleQtyChange = (customerId: string, newQty: number) => {
    setDeliveryItems((prev) =>
      prev.map((item) => {
        if (item.customer_id === customerId) {
          const qty = isNaN(newQty) || newQty < 0 ? 0 : Math.round(newQty * 100) / 100;
          const status: DeliveryStatus = qty === 0 ? 'no_milk' : 'delivered';
          return { ...item, actual_qty: qty, status, is_saved: false };
        }
        return item;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Handle status toggle
  const handleStatusToggle = (customerId: string, newStatus: DeliveryStatus) => {
    setDeliveryItems((prev) =>
      prev.map((item) => {
        if (item.customer_id === customerId) {
          const actual_qty = newStatus === 'no_milk' ? 0 : (item.actual_qty > 0 ? item.actual_qty : item.default_qty || 1.0);
          return { ...item, status: newStatus, actual_qty, is_saved: false };
        }
        return item;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Handle quick Delivered click and save directly
  const handleDeliveredClick = async (item: DeliveryItem) => {
    const actualQty =
      Number(item.actual_qty) > 0
        ? Number(item.actual_qty)
        : Number(item.default_qty) > 0
        ? Number(item.default_qty)
        : 1.0;

    setSavingRows((prev) => ({ ...prev, [item.customer_id]: true }));
    try {
      const payload: SaveDeliveryPayload = {
        customer_id: item.customer_id,
        date: selectedDate,
        session,
        actual_qty: actualQty,
        status: 'delivered',
      };
      await deliveryApi.saveDelivery(payload);
      showToast('Delivered Successfully!', 'success');
      setDeliveryItems((prev) =>
        prev.map((it) =>
          it.customer_id === item.customer_id
            ? { ...it, status: 'delivered', actual_qty: actualQty, is_saved: true }
            : it
        )
      );
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save delivery', 'error');
    } finally {
      setSavingRows((prev) => ({ ...prev, [item.customer_id]: false }));
    }
  };

  // Quick increment/decrement
  const handleAdjustQty = (customerId: string, delta: number) => {
    setDeliveryItems((prev) =>
      prev.map((item) => {
        if (item.customer_id === customerId) {
          const newQty = Math.max(0, Math.round(((Number(item.actual_qty) || 0) + delta) * 100) / 100);
          const status: DeliveryStatus = newQty === 0 ? 'no_milk' : 'delivered';
          return { ...item, actual_qty: newQty, status, is_saved: false };
        }
        return item;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Reset to customer default quantity
  const handleResetToDefault = (customerId: string) => {
    setDeliveryItems((prev) =>
      prev.map((item) => {
        if (item.customer_id === customerId) {
          return {
            ...item,
            actual_qty: item.default_qty,
            status: item.default_qty > 0 ? 'delivered' : 'no_milk',
            is_saved: false,
          };
        }
        return item;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Save single delivery
  const handleSaveRow = async (item: DeliveryItem) => {
    setSavingRows((prev) => ({ ...prev, [item.customer_id]: true }));
    try {
      const payload: SaveDeliveryPayload = {
        customer_id: item.customer_id,
        date: selectedDate,
        session,
        actual_qty: Number(item.actual_qty) || 0,
        status: item.status,
      };
      await deliveryApi.saveDelivery(payload);
      showToast(`Saved delivery for ${item.customer_name} (${item.actual_qty}L)`, 'success');
      setDeliveryItems((prev) =>
        prev.map((it) =>
          it.customer_id === item.customer_id ? { ...it, is_saved: true } : it
        )
      );
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save delivery', 'error');
    } finally {
      setSavingRows((prev) => ({ ...prev, [item.customer_id]: false }));
    }
  };

  // Save all deliveries in bulk
  const handleSaveAll = async () => {
    setIsSavingAll(true);
    try {
      const payload: SaveDeliveryPayload[] = deliveryItems.map((item) => ({
        customer_id: item.customer_id,
        date: selectedDate,
        session,
        actual_qty: Number(item.actual_qty) || 0,
        status: item.status,
      }));

      await deliveryApi.saveBulk(payload);
      showToast(`All ${deliveryItems.length} deliveries saved successfully!`, 'success');
      setDeliveryItems((prev) => prev.map((it) => ({ ...it, is_saved: true })));
      setHasUnsavedChanges(false);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save deliveries', 'error');
    } finally {
      setIsSavingAll(false);
    }
  };

  // Date shortcut helpers
  const setDateShortcut = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Filtered deliveries by search query and delivery status (Delivered / No Milk)
  const filteredDeliveries = useMemo(() => {
    let list = deliveryItems;
    if (statusFilter !== 'all') {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (d) =>
        d.customer_name.toLowerCase().includes(q) ||
        d.customer_phone.toLowerCase().includes(q) ||
        d.customer_area.toLowerCase().includes(q)
    );
  }, [deliveryItems, searchQuery, statusFilter]);

  // Dynamic live summary
  const summary = useMemo(() => {
    const items = deliveryItems || [];
    const totalQty = items.reduce(
      (sum, item) => sum + (Number(item?.actual_qty) || 0),
      0
    );
    const deliveredCount = items.filter((i) => i?.status === 'delivered').length;
    const noMilkCount = items.filter((i) => i?.status === 'no_milk').length;
    const defaultTotal = items.reduce(
      (sum, item) => sum + (Number(item?.default_qty) || 0),
      0
    );

    return {
      totalQty: Math.round(totalQty * 100) / 100,
      defaultTotal: Math.round(defaultTotal * 100) / 100,
      deliveredCount,
      noMilkCount,
      totalCustomers: items.length,
    };
  }, [deliveryItems]);

  const isMorning = session === 'morning';

  return (
    <div className="space-y-6">
      {/* Top Banner / Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`p-2 rounded-xl ${
                isMorning
                  ? 'bg-amber-50 text-amber-600 border border-amber-200'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
              }`}
            >
              {isMorning ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isMorning ? 'Morning Delivery' : 'Evening Delivery'} Workflow
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pre-fills customer default quantity. Edit actual delivery quantity for today without changing customer master defaults.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadDeliveries}
            title="Reload deliveries"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSavingAll || isLoading || deliveryItems.length === 0}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-95 ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
            } disabled:opacity-50`}
          >
            {isSavingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{hasUnsavedChanges ? 'Save All Changes' : 'Save All Deliveries'}</span>
          </button>
        </div>
      </div>

      {/* Critical Business Rule Callout */}
      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/90 flex items-start gap-2.5 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold text-amber-950">Strict Business Rule:</strong>{' '}
          Editing today&apos;s actual delivery quantity only updates today&apos;s delivery session. The customer&apos;s default quantity in the database{' '}
          <strong className="underline decoration-amber-500 underline-offset-2">is NEVER changed</strong>.
          0L is supported for &quot;No Milk&quot; records.
        </div>
      </div>

      {/* Date, Session & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Session Selector (Morning / Evening) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSession('morning')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              session === 'morning'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>Morning</span>
          </button>
          <button
            type="button"
            onClick={() => setSession('evening')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              session === 'evening'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Moon className="w-4 h-4" />
            <span>Evening</span>
          </button>
        </div>

        {/* Date Selector & Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setDateShortcut(-1)}
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-900 transition"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDateShortcut(0)}
              className={`px-2.5 py-1 rounded-lg transition ${
                selectedDate === todayStr ? 'bg-white font-bold text-slate-900 shadow-sm' : 'hover:bg-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDateShortcut(1)}
              className="px-2.5 py-1 rounded-lg hover:bg-white hover:text-slate-900 transition"
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search active customer..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter: Delivered / No Milk */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({deliveryItems.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('delivered')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'delivered'
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered ({summary.deliveredCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('no_milk')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              statusFilter === 'no_milk'
                ? 'bg-rose-600 text-white font-bold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>No Milk ({summary.noMilkCount})</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Active Customers
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.totalCustomers}</div>
        </div>

        <div
          className={`bg-white p-4 rounded-xl border shadow-sm ${
            isMorning ? 'border-amber-200 bg-amber-50/30' : 'border-indigo-200 bg-indigo-50/30'
          }`}
        >
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 ${
              isMorning ? 'text-amber-700' : 'text-indigo-700'
            }`}
          >
            {isMorning ? <Sun className="w-3 h-3 text-amber-500" /> : <Moon className="w-3 h-3 text-indigo-500" />}
            Actual Milk Volume
          </span>
          <div
            className={`text-2xl font-black mt-1 ${
              isMorning ? 'text-amber-800' : 'text-indigo-800'
            }`}
          >
            {(Number(summary.totalQty) || 0).toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">
              L (Default: {(Number(summary.defaultTotal) || 0).toFixed(2)}L)
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Delivered Count
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{summary.deliveredCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-500" /> No Milk Count
          </span>
          <div className="text-2xl font-black text-rose-700 mt-1">{summary.noMilkCount}</div>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs font-medium">Loading {session} deliveries for {selectedDate}...</p>
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              {isMorning ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Customers Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No customers match your search.'
                : 'There are no active customers in the system yet. Add customers in the Customers module first.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Area & Contact</th>
                  <th className="py-3 px-4 text-center">Default Qty</th>
                  <th className="py-3 px-4 text-center">Today Actual Delivery</th>
                  <th className="py-3 px-4 text-center">Delivery Status</th>
                  <th className="py-3 px-4 text-center">Save State</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDeliveries.map((item) => {
                  const isDelivered = item.status === 'delivered';
                  const isModifiedFromDefault = item.actual_qty !== item.default_qty;
                  const isSavingThisRow = !!savingRows[item.customer_id];

                  return (
                    <tr
                      key={item.customer_id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !isDelivered ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Customer Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isDelivered
                                ? isMorning
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {item.customer_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{item.customer_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {item.customer_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Area & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 font-medium text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-semibold">{item.customer_area}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span>{item.customer_phone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Default Pre-fill reference */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200" title="Permanent Customer Default Quantity">
                          {(Number(item.default_qty) || 0).toFixed(1)} L
                        </span>
                      </td>

                      {/* Actual Quantity Editor with Quick Steps */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                          {/* Minus 0.5L */}
                          <button
                            type="button"
                            onClick={() => handleAdjustQty(item.customer_id, -0.5)}
                            disabled={item.actual_qty <= 0}
                            className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg disabled:opacity-30 transition"
                            title="Decrease by 0.5L"
                          >
                            -
                          </button>

                          {/* Actual Input (0L supported) */}
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={item.actual_qty}
                            onChange={(e) =>
                              handleQtyChange(item.customer_id, parseFloat(e.target.value))
                            }
                            className={`w-16 py-1 text-center font-black text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                              isModifiedFromDefault
                                ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                                : 'bg-white border-slate-200 text-slate-900'
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-400 pr-1">L</span>

                          {/* Plus 0.5L */}
                          <button
                            type="button"
                            onClick={() => handleAdjustQty(item.customer_id, 0.5)}
                            className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:text-slate-900 rounded-lg transition"
                            title="Increase by 0.5L"
                          >
                            +
                          </button>
                        </div>

                        {/* Note when edited from default */}
                        {isModifiedFromDefault && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center justify-center gap-1">
                            <span>Adjusted from {item.default_qty}L</span>
                            <button
                              type="button"
                              onClick={() => handleResetToDefault(item.customer_id)}
                              className="text-slate-400 hover:text-slate-600 underline text-[9px]"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Delivery Status Selector */}
                      <td className="py-3.5 px-4 text-center">
                        {isDelivered && item.is_saved ? (
                          <div className="flex items-center justify-center">
                            <span
                              title="Delivered Successfully"
                              className="inline-flex items-center justify-center text-emerald-600"
                            >
                              <Check className="w-7 h-7 stroke-[3]" />
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleDeliveredClick(item)}
                              disabled={isSavingThisRow}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                            >
                              {isSavingThisRow ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Delivered</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStatusToggle(item.customer_id, 'no_milk')}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                                !isDelivered
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>No Milk (0L)</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Save State Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {item.is_saved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-3 h-3" /> Saved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <AlertTriangle className="w-3 h-3" /> Unsaved
                          </span>
                        )}
                      </td>

                      {/* Action: Single Save */}
                      <td className="py-3.5 px-4 text-right">
                        {item.is_saved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs pr-2">
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>Saved</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSaveRow(item)}
                            disabled={isSavingThisRow}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition disabled:opacity-50"
                          >
                            {isSavingThisRow ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            <span>Save</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Save All Bar if unsaved changes exist */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-slideUp">
          <div className="text-xs">
            <span className="font-bold text-amber-400">Unsaved deliveries detected.</span>
            <div className="text-[10px] text-slate-400">
              Click to persist all modified delivery quantities for today.
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSavingAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
          >
            {isSavingAll ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save All Now</span>
          </button>
        </div>
      )}
    </div>
  );
};
