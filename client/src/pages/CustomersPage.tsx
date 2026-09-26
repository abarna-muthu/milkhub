import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  History,
  Phone,
  Building2,
  Calendar,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Customer } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { AddCustomerDrawer } from '../components/customers/AddCustomerDrawer';
import { useCenter } from '../context/CenterContext';
import { useToast } from '../context/ToastContext';
import { customersApi } from '../services/api';
import { formatCurrency, formatLitres } from '../utils/formatters';

interface CustomersPageProps {
  onNavigate: (path: string, param?: string) => void;
  selectedCustomerId?: string;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigate, selectedCustomerId }) => {
  const { centers, selectedCenterId, setSelectedCenterId } = useCenter();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [centerFilter, setCenterFilter] = useState<string>(selectedCenterId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Drawer / Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Details Modal
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  // Deactivate Confirmation Modal
  const [deactivatingCustomer, setDeactivatingCustomer] = useState<Customer | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await customersApi.getAll({
        search: search.trim() || undefined,
        center_id: centerFilter !== 'all' ? centerFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      });
      setCustomers(res.customers || []);
      setTotalCount(res.total || 0);

      // If routed with a selectedCustomerId, open detail
      if (selectedCustomerId && !viewCustomer) {
        const match = res.customers?.find((c) => c.id === selectedCustomerId);
        if (match) setViewCustomer(match);
      }
    } catch (err) {
      console.warn('Failed to load customers', err);
      showToast('Could not load supplier list', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, centerFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDrawerOpen(true);
  };

  const handleToggleStatus = async (customer: Customer) => {
    const isCurrentlyActive = customer.status === 'active';
    if (isCurrentlyActive) {
      // Prompt confirmation before deactivating
      setDeactivatingCustomer(customer);
    } else {
      // Direct activate
      try {
        await customersApi.patch(customer.id, { status: 'active' });
        showToast(`${customer.name} marked Active`, 'success');
        loadCustomers();
      } catch (err: any) {
        showToast('Failed to activate supplier', 'error');
      }
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivatingCustomer) return;
    setIsDeactivating(true);
    try {
      await customersApi.delete(deactivatingCustomer.id);
      showToast(`${deactivatingCustomer.name} deactivated. Historical records preserved.`, 'info');
      setDeactivatingCustomer(null);
      loadCustomers();
    } catch (err) {
      showToast('Failed to deactivate supplier', 'error');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Customers / Milk Suppliers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage individual suppliers, collection center assignment, and default pricing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm"
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Live Search */}
          <div className="sm:col-span-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Name, Phone, Customer ID, or Area..."
              className="w-full h-10 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Center Filter */}
          <div className="sm:col-span-3">
            <select
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900 font-medium"
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
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900 font-medium"
            >
              <option value="all">All Status (Active & Inactive)</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Quick Result Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Showing <strong className="text-slate-900">{customers.length}</strong> of{' '}
            <strong className="text-slate-900">{totalCount}</strong> suppliers
          </span>
          {(search || centerFilter !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCenterFilter('all');
                setStatusFilter('all');
              }}
              className="text-slate-600 hover:text-slate-900 underline font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Customer / Supplier List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3.5">Customer ID</th>
                <th scope="col" className="px-4 py-3.5">Name</th>
                <th scope="col" className="px-4 py-3.5">Phone</th>
                <th scope="col" className="px-4 py-3.5">Area</th>
                <th scope="col" className="px-4 py-3.5">Center</th>
                <th scope="col" className="px-4 py-3.5 text-right">Default M (L)</th>
                <th scope="col" className="px-4 py-3.5 text-right">Default E (L)</th>
                <th scope="col" className="px-4 py-3.5 text-right">Rate / L</th>
                <th scope="col" className="px-4 py-3.5 text-center">Status</th>
                <th scope="col" className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    Loading suppliers from TiDB...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No milk suppliers found matching the criteria.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const isActive = cust.status === 'active';
                  return (
                    <tr
                      key={cust.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !isActive ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Customer ID */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {cust.customer_code}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <button
                          type="button"
                          onClick={() => setViewCustomer(cust)}
                          className="hover:underline text-left text-slate-900 font-semibold"
                        >
                          {cust.name}
                        </button>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {cust.phone || cust.mobile || '—'}
                      </td>

                      {/* Area */}
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {cust.area || cust.village || '—'}
                      </td>

                      {/* Center */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-800 font-medium">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          {cust.center_name || 'All Centers'}
                        </span>
                      </td>

                      {/* Default Morning */}
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                        {formatLitres(cust.default_morning_qty !== undefined ? cust.default_morning_qty : 1.0)}
                      </td>

                      {/* Default Evening */}
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                        {formatLitres(cust.default_evening_qty !== undefined ? cust.default_evening_qty : 1.0)}
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ₹{Number(cust.rate !== undefined ? cust.rate : 60).toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <Badge variant={isActive ? 'success' : 'default'}>
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => setViewCustomer(cust)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                            title="View Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cust)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Deactivate / Activate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cust)}
                            className={`p-1.5 rounded transition ${
                              isActive
                                ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'Deactivate Supplier' : 'Activate Supplier'}
                          >
                            {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>

                          {/* History */}
                          <button
                            type="button"
                            onClick={() => onNavigate('customer-profile', cust.id)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                            title="Customer History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Drawer */}
      <AddCustomerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={loadCustomers}
        initialCustomer={editingCustomer}
      />

      {/* Customer Details Modal (Phase 2 Requirement) */}
      {viewCustomer && (
        <Modal
          isOpen={!!viewCustomer}
          onClose={() => setViewCustomer(null)}
          title={`Supplier Details • ${viewCustomer.customer_code}`}
        >
          <div className="space-y-5 p-1">
            {/* Header snippet */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewCustomer.name}</h3>
                <p className="text-xs text-slate-500">
                  {viewCustomer.phone || viewCustomer.mobile} • {viewCustomer.area || viewCustomer.village}
                </p>
              </div>
              <Badge variant={viewCustomer.status === 'active' ? 'success' : 'default'}>
                {viewCustomer.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Collection Center</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {viewCustomer.center_name || 'All Centers'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Rate / Litre</span>
                <span className="font-mono font-bold text-slate-900 mt-0.5 block text-sm">
                  ₹{Number(viewCustomer.rate || 60).toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Default Morning Qty</span>
                <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                  {formatLitres(viewCustomer.default_morning_qty !== undefined ? viewCustomer.default_morning_qty : 1.0)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Default Evening Qty</span>
                <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                  {formatLitres(viewCustomer.default_evening_qty !== undefined ? viewCustomer.default_evening_qty : 1.0)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Cattle Holding</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {viewCustomer.cow_count || 0} Cows, {viewCustomer.buffalo_count || 0} Buffaloes
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Start Date</span>
                <span className="font-medium text-slate-900 mt-0.5 block">
                  {viewCustomer.start_date || '—'}
                </span>
              </div>
            </div>

            {viewCustomer.address && (
              <div className="text-xs p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Address</span>
                <span className="text-slate-800 mt-0.5 block">{viewCustomer.address}</span>
              </div>
            )}

            {/* Modal actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                icon={<History className="w-3.5 h-3.5" />}
                onClick={() => {
                  const id = viewCustomer.id;
                  setViewCustomer(null);
                  onNavigate('customer-profile', id);
                }}
              >
                View History
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const c = viewCustomer;
                    setViewCustomer(null);
                    handleOpenEdit(c);
                  }}
                >
                  Edit Profile
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setViewCustomer(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingCustomer && (
        <Modal
          isOpen={!!deactivatingCustomer}
          onClose={() => setDeactivatingCustomer(null)}
          title="Deactivate Supplier"
        >
          <div className="space-y-4 p-1">
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Preserve historical records</p>
                <p className="mt-1">
                  Deactivating <strong>{deactivatingCustomer.name}</strong> ({deactivatingCustomer.customer_code})
                  will remove them from daily active delivery lists while safely keeping all historical deliveries,
                  sales, and payment records intact.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeactivatingCustomer(null)}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDeactivate}
                isLoading={isDeactivating}
              >
                Confirm Deactivation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
