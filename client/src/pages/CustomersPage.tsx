import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  X,
  Phone,
  MapPin,
  Calendar,
  Sun,
  Moon,
  IndianRupee,
  Edit2,
  Eye,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Building,
  Save,
  History,
} from 'lucide-react';
import { Customer, CreateCustomerDTO, UpdateCustomerDTO, CustomerStatus, CustomerHistoryResponse } from '../types';
import { customerApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export const CustomersPage: React.FC = () => {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Customer History state (Phase 6)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyData, setHistoryData] = useState<CustomerHistoryResponse | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [historyMonth, setHistoryMonth] = useState<string>(new Date().toISOString().substring(0, 7));

  // Form states for Add
  const [addForm, setAddForm] = useState<CreateCustomerDTO>({
    name: '',
    phone: '',
    address: '',
    area: '',
    default_morning_qty: 1.0,
    default_evening_qty: 1.0,
    rate: 60.0,
    start_date: new Date().toISOString().split('T')[0],
    status: 'active',
  });
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  // Form states for Edit
  const [editForm, setEditForm] = useState<UpdateCustomerDTO>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Load customers
  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await customerApi.getAll({
        search: searchQuery || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setCustomers(res.customers);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      showToast(err.response?.data?.error || 'Failed to load customers', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  // Statistics
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === 'active').length;
    const inactive = total - active;
    const morningDemand = customers
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => sum + (Number(c.default_morning_qty) || 0), 0);
    const eveningDemand = customers
      .filter((c) => c.status === 'active')
      .reduce((sum, c) => sum + (Number(c.default_evening_qty) || 0), 0);
    const avgRate =
      customers.length > 0
        ? customers.reduce((sum, c) => sum + (Number(c.rate) || 0), 0) / customers.length
        : 0;

    return {
      total,
      active,
      inactive,
      morningDemand: morningDemand.toFixed(1),
      eveningDemand: eveningDemand.toFixed(1),
      avgRate: avgRate.toFixed(2),
    };
  }, [customers]);

  // Unique areas for area filter (Phase 6)
  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(customers.map((c) => c.area?.trim()).filter(Boolean)));
  }, [customers]);

  // Filtered customers by selected area
  const displayedCustomers = useMemo(() => {
    if (selectedArea === 'all') return customers;
    return customers.filter((c) => c.area?.trim().toLowerCase() === selectedArea.trim().toLowerCase());
  }, [customers, selectedArea]);

  // Open customer history (Phase 6)
  const handleOpenHistory = async (customer: Customer, month?: string) => {
    setHistoryCustomer(customer);
    const m = month || historyMonth;
    setHistoryMonth(m);
    setIsHistoryLoading(true);
    try {
      const data = await customerApi.getHistory(customer.id, m);
      setHistoryData(data);
    } catch (err: any) {
      showToast('Failed to load customer history', 'error');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Change month in customer history
  const handleHistoryMonthChange = async (newMonth: string) => {
    setHistoryMonth(newMonth);
    if (historyCustomer) {
      setIsHistoryLoading(true);
      try {
        const data = await customerApi.getHistory(historyCustomer.id, newMonth);
        setHistoryData(data);
      } catch (err: any) {
        showToast('Failed to load history for month', 'error');
      } finally {
        setIsHistoryLoading(false);
      }
    }
  };

  // Validation function
  const validateForm = (data: CreateCustomerDTO | UpdateCustomerDTO): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!data.name || data.name.trim().length < 2) {
      errors.name = 'Full name is required (min 2 characters)';
    }

    if (!data.phone || data.phone.trim().replace(/\D/g, '').length < 7) {
      errors.phone = 'Valid phone number is required (min 7 digits)';
    }

    if (!data.address || data.address.trim().length < 2) {
      errors.address = 'Street address is required';
    }

    if (!data.area || data.area.trim().length < 2) {
      errors.area = 'Delivery area/locality is required';
    }

    if (data.default_morning_qty === undefined || Number(data.default_morning_qty) < 0) {
      errors.default_morning_qty = 'Morning quantity cannot be negative';
    }

    if (data.default_evening_qty === undefined || Number(data.default_evening_qty) < 0) {
      errors.default_evening_qty = 'Evening quantity cannot be negative';
    }

    if (data.rate === undefined || Number(data.rate) <= 0) {
      errors.rate = 'Milk rate per litre must be greater than 0';
    }

    if (!data.start_date || isNaN(Date.parse(data.start_date))) {
      errors.start_date = 'Valid start date is required';
    }

    return errors;
  };

  // Handle Add Customer Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm(addForm);
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }
    setAddErrors({});
    setIsSubmitting(true);

    try {
      await customerApi.create(addForm);
      showToast(`Customer '${addForm.name}' added successfully!`, 'success');
      setIsAddModalOpen(false);
      // Reset form
      setAddForm({
        name: '',
        phone: '',
        address: '',
        area: '',
        default_morning_qty: 1.0,
        default_evening_qty: 1.0,
        rate: 60.0,
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      });
      loadCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Customer Modal
  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setEditForm({
      name: cust.name,
      phone: cust.phone,
      address: cust.address,
      area: cust.area,
      default_morning_qty: cust.default_morning_qty,
      default_evening_qty: cust.default_evening_qty,
      rate: cust.rate,
      start_date: cust.start_date,
      status: cust.status,
    });
    setEditErrors({});
  };

  // Handle Edit Customer Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const errors = validateForm(editForm as CreateCustomerDTO);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    setIsSubmitting(true);

    try {
      const updated = await customerApi.update(editingCustomer.id, editForm);
      showToast(`Customer '${updated.name}' updated successfully!`, 'success');
      setEditingCustomer(null);
      if (viewingCustomer && viewingCustomer.id === editingCustomer.id) {
        setViewingCustomer(updated);
      }
      loadCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update customer', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Toggle Status
  const handleToggleStatus = async (cust: Customer) => {
    const nextStatus: CustomerStatus = cust.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await customerApi.update(cust.id, { status: nextStatus });
      showToast(`Customer '${cust.name}' status set to ${nextStatus}`, 'success');
      if (viewingCustomer && viewingCustomer.id === cust.id) {
        setViewingCustomer(updated);
      }
      loadCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete Customer CRUD, real-time search by Name, Phone & Area, with Active/Inactive filters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadCustomers}
            title="Reload customers list"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setAddErrors({});
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Customers
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-emerald-50/40">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Active
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Inactive
          </span>
          <div className="text-2xl font-black text-slate-500 mt-1">{stats.inactive}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-amber-50/40">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-500" /> Morning Demand
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {stats.morningDemand} <span className="text-xs font-normal text-slate-500">L</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-indigo-50/40">
          <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <Moon className="w-3 h-3 text-indigo-500" /> Evening Demand
          </span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {stats.eveningDemand} <span className="text-xs font-normal text-slate-500">L</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-teal-200/80 shadow-sm flex flex-col justify-between bg-gradient-to-br from-white to-teal-50/40">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider flex items-center gap-1">
            <IndianRupee className="w-3 h-3 text-teal-500" /> Avg Rate
          </span>
          <div className="text-2xl font-black text-teal-700 mt-1">
            ₹{stats.avgRate} <span className="text-xs font-normal text-slate-500">/L</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input (Name, Phone, Area) */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by Name, Phone, or Area..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Area Dropdown Filter (Phase 6) */}
        {uniqueAreas.length > 0 && (
          <div className="flex items-center gap-1.5 self-start md:self-auto">
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Area:</span>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All Areas ({uniqueAreas.length})</option>
              {uniqueAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filter Pills (All / Active / Inactive) */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            Active
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              statusFilter === 'inactive'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Inactive
          </button>
        </div>
      </div>

      {/* Customer List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs font-medium">Fetching customer records...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Customers Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'No customer records match your active search or filter criteria.'
                : 'Start by adding your first milk customer to the database.'}
            </p>
            {searchQuery || statusFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
              >
                Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact & Area</th>
                  <th className="py-3 px-4 text-center">Morning (L)</th>
                  <th className="py-3 px-4 text-center">Evening (L)</th>
                  <th className="py-3 px-4 text-right">Rate / Litre</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedCustomers.map((cust) => {
                  const isActive = cust.status === 'active';
                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setViewingCustomer(cust)}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition">
                              {cust.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {cust.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Area */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{cust.phone}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-600">{cust.area}</span>
                            <span className="text-slate-300">•</span>
                            <span className="truncate max-w-[140px]" title={cust.address}>
                              {cust.address}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Default Morning Qty */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                          <Sun className="w-3 h-3 text-amber-500" />
                          {Number(cust.default_morning_qty).toFixed(1)} L
                        </span>
                      </td>

                      {/* Default Evening Qty */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/60">
                          <Moon className="w-3 h-3 text-indigo-500" />
                          {Number(cust.default_evening_qty).toFixed(1)} L
                        </span>
                      </td>

                      {/* Rate */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-black text-slate-900 text-sm">
                          ₹{Number(cust.rate).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">per litre</div>
                      </td>

                      {/* Start Date */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{cust.start_date}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(cust)}
                          title={`Click to switch to ${isActive ? 'Inactive' : 'Active'}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-400" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(cust)}
                            title="Customer History & Monthly Summary"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-bold text-[11px] transition shadow-2xs"
                          >
                            <History className="w-3.5 h-3.5 text-indigo-600" />
                            <span>History</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewingCustomer(cust)}
                            title="View Customer Details"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(cust)}
                            title="Edit Customer"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* ADD CUSTOMER MODAL                                       */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Customer</h3>
                  <p className="text-[11px] text-slate-500">Customer profile and milk delivery preferences</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Karthik Subramanian"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                    addErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                />
                {addErrors.name && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{addErrors.name}</p>
                )}
              </div>

              {/* Phone & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="e.g. 9840123456"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                      addErrors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                  {addErrors.phone && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">{addErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Area / Locality <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addForm.area}
                    onChange={(e) => setAddForm({ ...addForm, area: e.target.value })}
                    placeholder="e.g. North Ward"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                      addErrors.area ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                  {addErrors.area && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">{addErrors.area}</p>
                  )}
                </div>
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Street Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  placeholder="e.g. Door No. 15, North Car Street, Opposite Perumal Temple"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                    addErrors.address ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                />
                {addErrors.address && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{addErrors.address}</p>
                )}
              </div>

              {/* Morning & Evening Quantities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Default Morning Qty (L)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={addForm.default_morning_qty}
                    onChange={(e) =>
                      setAddForm({ ...addForm, default_morning_qty: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" /> Default Evening Qty (L)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={addForm.default_evening_qty}
                    onChange={(e) =>
                      setAddForm({ ...addForm, default_evening_qty: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Rate & Start Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-teal-600" /> Milk Rate / Litre (₹){' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={addForm.rate}
                    onChange={(e) => setAddForm({ ...addForm, rate: parseFloat(e.target.value) || 0 })}
                    placeholder="60.00"
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                      addErrors.rate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                  {addErrors.rate && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">{addErrors.rate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Start Date{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={addForm.start_date}
                    onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Status Radio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Initial Status</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={addForm.status === 'active'}
                      onChange={() => setAddForm({ ...addForm, status: 'active' })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={addForm.status === 'inactive'}
                      onChange={() => setAddForm({ ...addForm, status: 'inactive' })}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span className="font-semibold text-slate-600">Inactive</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW CUSTOMER MODAL                                      */}
      {/* ======================================================== */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg">
                  {viewingCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">{viewingCustomer.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                      ID: {viewingCustomer.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        viewingCustomer.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-700 text-slate-300 border border-slate-600'
                      }`}
                    >
                      {viewingCustomer.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="p-5 space-y-4 text-xs">
              {/* Contact & Location Block */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Contact & Delivery Details
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phone Number:</span>
                  <a
                    href={`tel:${viewingCustomer.phone}`}
                    className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" /> {viewingCustomer.phone}
                  </a>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Area / Ward:</span>
                  <span className="font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                    {viewingCustomer.area}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-slate-500 shrink-0">Street Address:</span>
                  <span className="font-medium text-slate-800 text-right">
                    {viewingCustomer.address}
                  </span>
                </div>
              </div>

              {/* Milk Quotas & Rates Block */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Milk Quota & Pricing
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                    <span className="text-[10px] font-semibold text-amber-800 flex items-center gap-1">
                      <Sun className="w-3 h-3 text-amber-500" /> Morning Qty
                    </span>
                    <div className="text-lg font-black text-amber-900 mt-0.5">
                      {Number(viewingCustomer.default_morning_qty).toFixed(2)} L
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
                    <span className="text-[10px] font-semibold text-indigo-800 flex items-center gap-1">
                      <Moon className="w-3 h-3 text-indigo-500" /> Evening Qty
                    </span>
                    <div className="text-lg font-black text-indigo-900 mt-0.5">
                      {Number(viewingCustomer.default_evening_qty).toFixed(2)} L
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Daily Demand Total:</span>
                  <span className="font-bold text-slate-900">
                    {(
                      Number(viewingCustomer.default_morning_qty) +
                      Number(viewingCustomer.default_evening_qty)
                    ).toFixed(2)}{' '}
                    Litres
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Agreed Milk Rate:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    ₹{Number(viewingCustomer.rate).toFixed(2)} / Litre
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Est. Daily Milk Billing:</span>
                  <span className="font-extrabold text-slate-900">
                    ₹
                    {(
                      (Number(viewingCustomer.default_morning_qty) +
                        Number(viewingCustomer.default_evening_qty)) *
                      Number(viewingCustomer.rate)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Start Date & Info */}
              <div className="flex items-center justify-between text-slate-500 px-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Start Date:
                </span>
                <span className="font-semibold text-slate-800">{viewingCustomer.start_date}</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                type="button"
                onClick={() => handleToggleStatus(viewingCustomer)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  viewingCustomer.status === 'active'
                    ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                {viewingCustomer.status === 'active' ? 'Deactivate Customer' : 'Activate Customer'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(viewingCustomer)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Customer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT CUSTOMER MODAL                                      */}
      {/* ======================================================== */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edit Customer</h3>
                  <p className="text-[11px] text-slate-500 font-mono">ID: {editingCustomer.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                    editErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                />
                {editErrors.name && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{editErrors.name}</p>
                )}
              </div>

              {/* Phone & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                      editErrors.phone ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                  {editErrors.phone && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">{editErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Area / Locality <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.area || ''}
                    onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                      editErrors.area ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                  {editErrors.area && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">{editErrors.area}</p>
                  )}
                </div>
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Street Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={editForm.address || ''}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                    editErrors.address ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                  } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                />
                {editErrors.address && (
                  <p className="text-[10px] text-rose-500 mt-1 font-medium">{editErrors.address}</p>
                )}
              </div>

              {/* Morning & Evening Quantities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Default Morning Qty (L)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={editForm.default_morning_qty ?? 0}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        default_morning_qty: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" /> Default Evening Qty (L)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={editForm.default_evening_qty ?? 0}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        default_evening_qty: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Rate & Start Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-teal-600" /> Milk Rate / Litre (₹){' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={editForm.rate ?? 0}
                    onChange={(e) =>
                      setEditForm({ ...editForm, rate: parseFloat(e.target.value) || 0 })
                    }
                    className={`w-full px-3.5 py-2 rounded-xl text-xs border ${
                      editErrors.rate ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50'
                    } focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                  {editErrors.rate && (
                    <p className="text-[10px] text-rose-500 mt-1 font-medium">{editErrors.rate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" /> Start Date
                  </label>
                  <input
                    type="date"
                    value={editForm.start_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Status Radio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Status</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_status"
                      value="active"
                      checked={editForm.status === 'active'}
                      onChange={() => setEditForm({ ...editForm, status: 'active' })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-emerald-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="edit_status"
                      value="inactive"
                      checked={editForm.status === 'inactive'}
                      onChange={() => setEditForm({ ...editForm, status: 'inactive' })}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span className="font-semibold text-slate-600">Inactive</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CUSTOMER HISTORY & MONTHLY SUMMARY MODAL (PHASE 6)       */}
      {/* ======================================================== */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center font-bold">
                  <History className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>{historyCustomer.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-normal">
                      ₹{historyCustomer.rate}/L
                    </span>
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span>{historyCustomer.phone}</span>
                    <span>•</span>
                    <span>{historyCustomer.area}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                  <span className="text-slate-500 font-semibold">Month:</span>
                  <input
                    type="month"
                    value={historyMonth}
                    onChange={(e) => handleHistoryMonthChange(e.target.value)}
                    className="font-bold text-slate-800 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryCustomer(null);
                    setHistoryData(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {isHistoryLoading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold">Loading customer delivery & sales history...</span>
                </div>
              ) : historyData ? (
                <>
                  {/* Customer Monthly Summary Cards */}
                  <div>
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      Customer Monthly Summary ({historyData.monthly_summary.month})
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-center">
                        <div className="text-[10px] uppercase font-bold text-amber-700">Total Milk</div>
                        <div className="text-lg font-black text-amber-800 font-mono mt-0.5">
                          {(Number(historyData.monthly_summary.total_milk) || 0).toFixed(2)} L
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-center">
                        <div className="text-[10px] uppercase font-bold text-emerald-700">Total Sales</div>
                        <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
                          ₹{(Number(historyData.monthly_summary.total_sales) || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-center">
                        <div className="text-[10px] uppercase font-bold text-blue-700">Total Paid</div>
                        <div className="text-lg font-black text-blue-800 font-mono mt-0.5">
                          ₹{(Number(historyData.monthly_summary.total_paid) || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-center">
                        <div className="text-[10px] uppercase font-bold text-rose-700">Total Due</div>
                        <div className="text-lg font-black text-rose-800 font-mono mt-0.5">
                          ₹{(Number(historyData.monthly_summary.total_due) || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-center col-span-2 sm:col-span-1">
                        <div className="text-[10px] uppercase font-bold text-indigo-700">Advance Balance</div>
                        <div className="text-lg font-black text-indigo-800 font-mono mt-0.5">
                          ₹{(Number(historyData.monthly_summary.advance_balance) || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer History Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Daily Delivery, Sales & Payment History
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3 text-center">Morning</th>
                            <th className="py-2.5 px-3 text-center">Evening</th>
                            <th className="py-2.5 px-3 text-center">Total</th>
                            <th className="py-2.5 px-3 text-right">Sale</th>
                            <th className="py-2.5 px-3 text-right">Advance Used</th>
                            <th className="py-2.5 px-3 text-right">Paid</th>
                            <th className="py-2.5 px-3 text-right">Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {historyData.items.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                                No history records found for this customer.
                              </td>
                            </tr>
                          ) : (
                            historyData.items.map((row) => (
                              <tr key={row.date} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                                  {row.date}
                                </td>
                                <td className="py-2.5 px-3 text-center text-amber-700">
                                  {Number(row.morning).toFixed(2)} L
                                </td>
                                <td className="py-2.5 px-3 text-center text-indigo-700">
                                  {Number(row.evening).toFixed(2)} L
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-sans">
                                  {Number(row.total).toFixed(2)} L
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                  ₹{Number(row.sale).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right text-indigo-600">
                                  {row.advance_used > 0 ? `-₹${Number(row.advance_used).toFixed(2)}` : '₹0.00'}
                                </td>
                                <td className="py-2.5 px-3 text-right text-emerald-600">
                                  {row.paid > 0 ? `-₹${Number(row.paid).toFixed(2)}` : '₹0.00'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <span
                                    className={`font-black ${
                                      row.due > 0 ? 'text-rose-600' : 'text-emerald-700 font-sans font-medium'
                                    }`}
                                  >
                                    {row.due > 0 ? `₹${Number(row.due).toFixed(2)}` : '₹0.00'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  setHistoryCustomer(null);
                  setHistoryData(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
