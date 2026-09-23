import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Phone,
  Building2,
  Milk,
  Download,
  UserCheck,
  Zap,
} from 'lucide-react';
import { Customer, MilkCollection } from '../types';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { AddCustomerDrawer } from '../components/customers/AddCustomerDrawer';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { customersApi, collectionsApi } from '../services/api';
import { formatCurrency, formatLitres, formatPercent } from '../utils/formatters';
import { exportToExcel } from '../utils/exportUtils';

interface CustomersPageProps {
  onNavigate: (path: string, param?: string) => void;
  selectedCustomerId?: string;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { centers, selectedCenterId, setSelectedCenterId, selectedCenterName } = useCenter();
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'registered' | 'direct'>('registered');

  // Registered Suppliers State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters for Registered Suppliers
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');

  // Direct Walk-ins State
  const [directCollections, setDirectCollections] = useState<MilkCollection[]>([]);
  const [isDirectLoading, setIsDirectLoading] = useState(false);
  const [directSearch, setDirectSearch] = useState('');

  // Add/Edit Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await customersApi.getAll({
        center_id: selectedCenterId,
        search,
        status: statusFilter,
        village: areaFilter,
        page,
        limit: 50,
      });
      setCustomers(res.customers || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.warn('Failed to load customers', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDirectCollections = async () => {
    setIsDirectLoading(true);
    try {
      const data = await collectionsApi.getAll({
        center_id: selectedCenterId,
        supplier_type: 'DIRECT',
      });
      setDirectCollections(data);
    } catch (err) {
      console.warn('Failed to load direct collections', err);
    } finally {
      setIsDirectLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'registered') {
      loadCustomers();
    } else {
      loadDirectCollections();
    }
  }, [activeTab, selectedCenterId, statusFilter, areaFilter, page]);

  // Debounced search for registered
  useEffect(() => {
    if (activeTab !== 'registered') return;
    const timer = setTimeout(() => {
      setPage(1);
      loadCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) {
      showToast('Only Administrators can delete supplier records', 'warning');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete supplier ${name}?`)) return;

    try {
      await customersApi.delete(id);
      showToast(`Supplier ${name} removed`, 'info');
      loadCustomers();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete customer', 'error');
    }
  };

  const handleExportExcel = () => {
    if (activeTab === 'registered') {
      const data = customers.map((c) => ({
        'Supplier ID': c.customer_code,
        Name: c.name,
        Mobile: c.mobile,
        Area: c.village,
        'Collection Center': c.center_name || 'Center',
        'Cow Count': c.cow_count,
        'Buffalo Count': c.buffalo_count,
        Status: c.status,
      }));
      exportToExcel(data, `Registered_Suppliers_${selectedCenterName.replace(/\s+/g, '_')}`);
      showToast('Registered suppliers directory exported to Excel', 'success');
    } else {
      const data = directCollections.map((col) => ({
        Date: col.date,
        Center: col.center_name,
        'Supplier Name': col.customer_name,
        Mobile: col.customer_mobile,
        Session: col.session,
        'Milk (L)': col.quantity,
        'Fat %': col.fat_percentage,
        'SNF %': col.snf_percentage,
        Rate: col.calculated_rate,
        Amount: col.total_amount,
        'Payment Status': col.payment_status,
      }));
      exportToExcel(data, `Direct_Collections_${selectedCenterName.replace(/\s+/g, '_')}`);
      showToast('Direct walk-in collections exported to Excel', 'success');
    }
  };

  const filteredDirect = directCollections.filter((col) => {
    if (!directSearch.trim()) return true;
    const q = directSearch.toLowerCase();
    const name = col.customer_name?.toLowerCase() || '';
    const mobile = col.customer_mobile?.toLowerCase() || '';
    const center = col.center_name?.toLowerCase() || '';
    return name.includes(q) || mobile.includes(q) || center.includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('suppliers_directory_title')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('suppliers_directory_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            {t('export_excel')}
          </Button>

          {activeTab === 'registered' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingCustomer(null);
                setIsDrawerOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              {t('add_customer')}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Selection (Requirement 7) */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('registered')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'registered'
              ? 'border-brand-900 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          {t('tab_registered_suppliers')} ({totalCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('direct')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'direct'
              ? 'border-brand-900 text-brand-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-600" />
          {t('tab_direct_collections')} ({directCollections.length})
        </button>
      </div>

      {/* TAB 1: REGISTERED SUPPLIERS */}
      {activeTab === 'registered' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-subtle flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('select_registered_hint')}
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
              />
            </div>

            {/* Dropdown Filters (Collection Center, Status, Area) */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Center Filter */}
              <select
                value={selectedCenterId}
                onChange={(e) => setSelectedCenterId(e.target.value)}
                aria-label="Filter by Collection Center"
                className="h-9 px-2.5 bg-white border border-slate-300 rounded text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800"
              >
                <option value="all">{t('all_centers')}</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label={t('filter_by_status')}
                className="h-9 px-2.5 bg-white border border-slate-300 rounded text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-800"
              >
                <option value="all">{t('all_status')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>

              {/* Area / Village Filter */}
              <select
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by Area"
                className="h-9 px-2.5 bg-white border border-slate-300 rounded text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-800"
              >
                <option value="all">{t('all_areas')}</option>
                <option value="Srivilliputtur">Srivilliputtur</option>
                <option value="Rajapalayam">Rajapalayam</option>
                <option value="Sivakasi">Sivakasi</option>
                <option value="Virudhunagar">Virudhunagar</option>
              </select>
            </div>
          </div>

          {/* Registered Suppliers Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">{t('customer_id')}</th>
                    <th className="px-4 py-2.5">{t('name')}</th>
                    <th className="px-3 py-2.5">{t('mobile')}</th>
                    <th className="px-3 py-2.5">{t('area_village')}</th>
                    <th className="px-3 py-2.5">{t('collection_center_label')}</th>
                    <th className="px-2.5 py-2.5 text-center">{t('cows')}</th>
                    <th className="px-2.5 py-2.5 text-center">{t('buffaloes')}</th>
                    <th className="px-3 py-2.5 text-center">{t('status')}</th>
                    <th className="px-3 py-2.5 text-right">{t('total_milk_supplied')}</th>
                    <th className="px-3 py-2.5 text-right">{t('balance_due')}</th>
                    <th className="px-4 py-2.5 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        {t('loading_suppliers')}
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        {t('no_suppliers_found')}
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono font-bold text-brand-900 whitespace-nowrap">
                          {c.customer_code}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => onNavigate('customer-profile', c.id)}
                            className="font-bold text-slate-900 hover:text-brand-900 text-left block hover:underline"
                          >
                            {c.name}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 tabular-nums font-mono text-slate-600 whitespace-nowrap">
                          {c.mobile}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">
                          {c.village || c.area}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {c.center_name || 'Center'}
                        </td>
                        <td className="px-2.5 py-2.5 text-center tabular-nums font-bold text-slate-900">
                          {c.cow_count}
                        </td>
                        <td className="px-2.5 py-2.5 text-center tabular-nums font-bold text-slate-900">
                          {c.buffalo_count}
                        </td>
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <Badge variant={c.status === 'active' ? 'success' : 'default'} size="sm">
                            {c.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatLitres(c.total_milk || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-amber-800 tabular-nums whitespace-nowrap">
                          {formatCurrency(c.pending_amount || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNavigate('customer-profile', c.id)}
                              className="p-1 text-slate-400 hover:text-brand-900 rounded hover:bg-slate-100"
                              title="View Ledger & Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCustomer(c);
                                setIsDrawerOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                              title="Edit Supplier"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id, c.name)}
                                className="p-1 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DIRECT / WALK-IN COLLECTIONS */}
      {activeTab === 'direct' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-subtle flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={directSearch}
                onChange={(e) => setDirectSearch(e.target.value)}
                placeholder="Search direct walk-in by Name, Mobile, or Center..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-800 text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Center:</span>
              <select
                value={selectedCenterId}
                onChange={(e) => setSelectedCenterId(e.target.value)}
                className="h-9 px-2.5 bg-white border border-slate-300 rounded text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-800"
              >
                <option value="all">All Collection Centers</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">{t('table_date')}</th>
                    <th className="px-3 py-2.5">{t('table_center')}</th>
                    <th className="px-4 py-2.5">{t('table_farmer_name')}</th>
                    <th className="px-3 py-2.5">{t('table_mobile')}</th>
                    <th className="px-3 py-2.5">{t('table_session')}</th>
                    <th className="px-3 py-2.5 text-right">{t('table_milk_l')}</th>
                    <th className="px-3 py-2.5 text-right">{t('table_fat')}</th>
                    <th className="px-3 py-2.5 text-right">{t('table_snf')}</th>
                    <th className="px-3 py-2.5 text-right">{t('table_rate')}</th>
                    <th className="px-4 py-2.5 text-right">{t('table_amount')}</th>
                    <th className="px-3 py-2.5 text-center">{t('table_payment_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isDirectLoading ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        {t('loading_suppliers')}
                      </td>
                    </tr>
                  ) : filteredDirect.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                        {t('no_direct_collections')}
                      </td>
                    </tr>
                  ) : (
                    filteredDirect.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          {item.date}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-900">
                          {item.center_name || 'Center'}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          {item.customer_name}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600">
                          {item.customer_mobile || '---'}
                        </td>
                        <td className="px-3 py-2.5">
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
                        <td className="px-3 py-2.5 text-right font-medium text-slate-700 tabular-nums">
                          ₹{item.calculated_rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-brand-900 tabular-nums">
                          {formatCurrency(item.total_amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.payment_status === 'PAID' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                              ✓ Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              ⌛ Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Add/Edit Customer Drawer */}
      <AddCustomerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={loadCustomers}
        initialCustomer={editingCustomer}
      />
    </div>
  );
};
