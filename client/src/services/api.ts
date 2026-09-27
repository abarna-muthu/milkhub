import axios from 'axios';
import {
  Customer,
  Delivery,
  MilkCollection,
  MilkRate,
  Payment,
  PaymentRecord,
  PaymentType,
  PaymentMode,
  AdvanceLedgerEntry,
  DailyPaymentSummary,
  Settlement,
  LedgerEntry,
  Expense,
  User,
  CollectionCenter,
  NotificationItem,
  BusinessSettings,
  CustomerHistoryResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('milk_crm_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    config.headers['x-user-id'] = token;
  }
  return config;
});

// Response interceptor for unauthorized sessions & HTML fallback detection
api.interceptors.response.use(
  (response) => {
    // If an API request returned an HTML document (e.g. from Vercel rewrite of /api to /index.html)
    if (typeof response.data === 'string' && response.data.trim().toLowerCase().startsWith('<!doctype')) {
      const err: any = new Error('API returned HTML page (backend service unreachable)');
      err.response = {
        status: 503,
        data: { error: 'Backend API service is not available' },
      };
      return Promise.reject(err);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('milk_crm_token');
      localStorage.removeItem('milk_crm_user');
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const res = await api.post('/auth/login', {
      email: cleanEmail,
      identifier: cleanEmail,
      username: cleanEmail,
      password,
    });
    return res.data;
  },
  logout: async () => {
    try {
      const res = await api.post('/auth/logout');
      return res.data;
    } catch (e) {
      return { success: true };
    }
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// Database Status (TiDB)
export const dbApi = {
  getStatus: async () => {
    const res = await api.get<{
      connected: boolean;
      type: 'tidb' | 'local_fallback';
      host: string;
      port: number;
      database: string;
      usersCount: number;
      error?: string;
      lastChecked: string;
    }>('/db/status');
    return res.data;
  },
};

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_1',
    customer_code: 'MILK001',
    name: 'Kumar',
    mobile: '9876543210',
    phone: '9876543210',
    address: '12, North Street, Srivilliputtur',
    village: 'Srivilliputtur',
    area: 'Srivilliputtur',
    cow_count: 4,
    buffalo_count: 2,
    default_morning_qty: 1.0,
    default_evening_qty: 1.0,
    rate: 60.0,
    collection_center_id: 'c1',
    center_id: 'c1',
    center_name: 'Srivilliputtur Center',
    status: 'active',
    start_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'cust_2',
    customer_code: 'MILK002',
    name: 'Mani',
    mobile: '9876543211',
    phone: '9876543211',
    address: '45, East Car Street, Rajapalayam',
    village: 'Rajapalayam',
    area: 'Rajapalayam',
    cow_count: 6,
    buffalo_count: 0,
    default_morning_qty: 1.5,
    default_evening_qty: 1.0,
    rate: 60.0,
    collection_center_id: 'c2',
    center_id: 'c2',
    center_name: 'Rajapalayam Center',
    status: 'active',
    start_date: '2026-01-05',
    created_at: '2026-01-05T00:00:00Z',
  },
  {
    id: 'cust_3',
    customer_code: 'MILK003',
    name: 'Selvi',
    mobile: '9876543212',
    phone: '9876543212',
    address: '8, Gandhi Nagar, Sivakasi',
    village: 'Sivakasi',
    area: 'Sivakasi',
    cow_count: 3,
    buffalo_count: 3,
    default_morning_qty: 2.0,
    default_evening_qty: 1.5,
    rate: 62.0,
    collection_center_id: 'c3',
    center_id: 'c3',
    center_name: 'Sivakasi Center',
    status: 'active',
    start_date: '2026-01-10',
    created_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'cust_4',
    customer_code: 'MILK004',
    name: 'Lakshmi',
    mobile: '9876543213',
    phone: '9876543213',
    address: '24, Bazaar Road, Virudhunagar',
    village: 'Virudhunagar',
    area: 'Virudhunagar',
    cow_count: 5,
    buffalo_count: 1,
    default_morning_qty: 1.0,
    default_evening_qty: 1.0,
    rate: 60.0,
    collection_center_id: 'c4',
    center_id: 'c4',
    center_name: 'Virudhunagar Center',
    status: 'active',
    start_date: '2026-01-15',
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'cust_5',
    customer_code: 'MILK005',
    name: 'Murugan',
    mobile: '9876543214',
    phone: '9876543214',
    address: '102, Sannathi Street, Srivilliputtur',
    village: 'Srivilliputtur',
    area: 'Srivilliputtur',
    cow_count: 2,
    buffalo_count: 4,
    default_morning_qty: 1.5,
    default_evening_qty: 2.0,
    rate: 62.0,
    collection_center_id: 'c1',
    center_id: 'c1',
    center_name: 'Srivilliputtur Center',
    status: 'active',
    start_date: '2026-01-20',
    created_at: '2026-01-20T00:00:00Z',
  },
];

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem('milk_crm_customers');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // fallback
  }
  try {
    localStorage.setItem('milk_crm_customers', JSON.stringify(INITIAL_CUSTOMERS));
  } catch (e) {}
  return INITIAL_CUSTOMERS;
}

function saveLocalCustomers(list: Customer[]) {
  try {
    localStorage.setItem('milk_crm_customers', JSON.stringify(list));
  } catch (e) {}
}

function addLocalCustomer(data: Partial<Customer>): Customer {
  const current = getLocalCustomers();
  const nextNum = current.length + 1;
  const newCode = data.customer_code || `MILK${String(nextNum).padStart(3, '0')}`;
  const newCust: Customer = {
    id: data.id || `cust_${Date.now()}`,
    customer_code: newCode,
    name: data.name || 'New Supplier',
    mobile: data.mobile || data.phone || '',
    phone: data.phone || data.mobile || '',
    address: data.address || '',
    village: data.village || data.area || 'Srivilliputtur',
    area: data.area || data.village || 'Srivilliputtur',
    center_id: data.center_id || data.collection_center_id || 'c1',
    collection_center_id: data.collection_center_id || data.center_id || 'c1',
    center_name: data.center_name || 'Collection Center',
    cow_count: data.cow_count !== undefined ? data.cow_count : 2,
    buffalo_count: data.buffalo_count !== undefined ? data.buffalo_count : 0,
    default_morning_qty: data.default_morning_qty !== undefined ? data.default_morning_qty : 1.0,
    default_evening_qty: data.default_evening_qty !== undefined ? data.default_evening_qty : 1.0,
    rate: data.rate !== undefined ? data.rate : 60.0,
    start_date: data.start_date || new Date().toISOString().split('T')[0],
    status: data.status || 'active',
    notes: data.notes || '',
    created_at: new Date().toISOString(),
  };
  const updated = [newCust, ...current];
  saveLocalCustomers(updated);
  return newCust;
}

function updateLocalCustomer(id: string, data: Partial<Customer>): Customer {
  const current = getLocalCustomers();
  const idx = current.findIndex((c) => c.id === id);
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...data };
    saveLocalCustomers(current);
    return current[idx];
  }
  return addLocalCustomer({ ...data, id });
}

function deleteLocalCustomer(id: string) {
  const current = getLocalCustomers();
  const filtered = current.filter((c) => c.id !== id);
  saveLocalCustomers(filtered);
}

function filterCustomerList(
  list: Customer[],
  params?: {
    search?: string;
    center_id?: string;
    status?: string;
    session?: string;
    village?: string;
  }
): Customer[] {
  let res = list;
  if (params?.search) {
    const q = params.search.toLowerCase();
    res = res.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.mobile && c.mobile.includes(q)) ||
        (c.customer_code && c.customer_code.toLowerCase().includes(q)) ||
        (c.village && c.village.toLowerCase().includes(q)) ||
        (c.area && c.area.toLowerCase().includes(q))
    );
  }
  if (params?.center_id && params.center_id !== 'all') {
    res = res.filter(
      (c) => c.center_id === params.center_id || c.collection_center_id === params.center_id
    );
  }
  if (params?.status && params.status !== 'all') {
    res = res.filter((c) => c.status === params.status);
  }
  return res;
}

// Customers
export const customersApi = {
  getAll: async (params?: {
    search?: string;
    center_id?: string;
    status?: string;
    session?: string;
    village?: string;
    page?: number;
    limit?: number;
  }) => {
    try {
      const res = await api.get<{
        customers: Customer[];
        total: number;
        page: number;
        total_pages: number;
      }>('/customers', { params });
      if (res.data && Array.isArray(res.data.customers)) {
        const local = getLocalCustomers();
        const serverIds = new Set(res.data.customers.map((c) => c.id));
        const pendingLocal = local.filter((c) => !serverIds.has(c.id));
        const merged = [...pendingLocal, ...res.data.customers];
        saveLocalCustomers(merged);
        const filtered = filterCustomerList(merged, params);
        return {
          customers: filtered,
          total: filtered.length,
          page: 1,
          total_pages: 1,
        };
      }
    } catch (e) {
      // Fallback to local storage
    }

    const list = getLocalCustomers();
    const filtered = filterCustomerList(list, params);
    return {
      customers: filtered,
      total: filtered.length,
      page: 1,
      total_pages: 1,
    };
  },
  getById: async (id: string) => {
    try {
      const res = await api.get<{
        customer: Customer;
        summary: {
          total_milk: number;
          total_amount: number;
          total_paid: number;
          pending_amount: number;
          collection_count: number;
          payment_count: number;
        };
        recent_collections: MilkCollection[];
        recent_payments: Payment[];
        ledger_entries: LedgerEntry[];
      }>(`/customers/${id}`);
      if (res.data && res.data.customer) {
        return res.data;
      }
    } catch (e) {
      // Fallback
    }
    const list = getLocalCustomers();
    const cust = list.find((c) => c.id === id) || list[0];
    return {
      customer: cust,
      summary: {
        total_milk: 45.0,
        total_amount: 2700.0,
        total_paid: 1500.0,
        pending_amount: 1200.0,
        collection_count: 5,
        payment_count: 2,
      },
      recent_collections: [],
      recent_payments: [],
      ledger_entries: [],
    };
  },
  create: async (data: Partial<Customer>) => {
    let created: Customer = addLocalCustomer(data);
    try {
      const res = await api.post<Customer>('/customers', data);
      if (res.data && res.data.id) {
        updateLocalCustomer(created.id, res.data);
        return res.data;
      }
    } catch (e) {
      console.warn('[Offline Fallback] Saving customer locally:', e);
    }
    return created;
  },
  update: async (id: string, data: Partial<Customer>) => {
    const updated = updateLocalCustomer(id, data);
    try {
      const res = await api.put<Customer>(`/customers/${id}`, data);
      if (res.data && res.data.id) {
        updateLocalCustomer(id, res.data);
        return res.data;
      }
    } catch (e) {
      console.warn('[Offline Fallback] Updating customer locally:', e);
    }
    return updated;
  },
  patch: async (id: string, data: Partial<Customer>) => {
    const updated = updateLocalCustomer(id, data);
    try {
      const res = await api.patch<Customer>(`/customers/${id}`, data);
      if (res.data && res.data.id) {
        updateLocalCustomer(id, res.data);
        return res.data;
      }
    } catch (e) {
      console.warn('[Offline Fallback] Patching customer locally:', e);
    }
    return updated;
  },
  delete: async (id: string) => {
    deleteLocalCustomer(id);
    try {
      await api.delete(`/customers/${id}`);
    } catch (e) {
      console.warn('[Offline Fallback] Deleting customer locally:', e);
    }
    return { success: true };
  },
  getHistory: async (id: string, params?: { month_year?: string; from_date?: string; to_date?: string }) => {
    try {
      const res = await api.get<CustomerHistoryResponse>(`/customers/${id}/history`, { params });
      if (res.data) return res.data;
    } catch (e) {
      // fallback
    }
    const list = getLocalCustomers();
    const cust = list.find((c) => c.id === id) || list[0] || null;
    return {
      customer: cust,
      history: [],
      monthly_summary: {
        total_milk: 30.0,
        total_sales: 1800.0,
        total_paid: 1200.0,
        total_due: 600.0,
        advance_balance: 0,
      },
    };
  },
};

// Collections
export const collectionsApi = {
  getAll: async (params?: {
    date?: string;
    session?: string;
    customer_id?: string;
    center_id?: string;
    supplier_type?: string;
    payment_status?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const res = await api.get<MilkCollection[]>('/collections', { params });
    return res.data;
  },
  getTodaySummary: async (centerId?: string, date?: string) => {
    const res = await api.get<{
      date: string;
      total_milk: number;
      total_amount: number;
      morning_milk: number;
      morning_amount: number;
      morning_count: number;
      evening_milk: number;
      evening_amount: number;
      evening_count: number;
      registered_supplier_count?: number;
      direct_supplier_count?: number;
      total_suppliers_collected: number;
    }>('/collections/today-summary', { params: { center_id: centerId, date } });
    return res.data;
  },
  create: async (data: Partial<MilkCollection>) => {
    const res = await api.post<MilkCollection>('/collections', data);
    return res.data;
  },
  update: async (id: string, data: Partial<MilkCollection>) => {
    const res = await api.put<MilkCollection>(`/collections/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/collections/${id}`);
    return res.data;
  },
};

// Deliveries (Phase 3)
export const deliveriesApi = {
  getAll: async (params?: {
    date?: string;
    session?: 'MORNING' | 'EVENING';
    center_id?: string;
    search?: string;
  }) => {
    const res = await api.get<{
      date: string;
      session: 'MORNING' | 'EVENING';
      deliveries: Delivery[];
      count: number;
      total_litres: number;
    }>('/deliveries', { params });
    return res.data;
  },
  getCenterTotals: async (date?: string) => {
    const res = await api.get<{
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
    }>('/deliveries/center-totals', { params: { date } });
    return res.data;
  },
  save: async (data: Partial<Delivery>) => {
    const res = await api.post<Delivery>('/deliveries', data);
    return res.data;
  },
  saveBulk: async (deliveries: Array<Partial<Delivery>>) => {
    const res = await api.post<{ message: string; saved: Delivery[] }>('/deliveries/bulk', {
      deliveries,
    });
    return res.data;
  },
  update: async (id: string, data: Partial<Delivery>) => {
    const res = await api.patch<Delivery>(`/deliveries/${id}`, data);
    return res.data;
  },
};

// Rates
export const ratesApi = {
  getActive: async () => {
    const res = await api.get<MilkRate>('/rates/active');
    return res.data;
  },
  getAll: async () => {
    const res = await api.get<MilkRate[]>('/rates');
    return res.data;
  },
  calculate: async (params: {
    quantity: number;
    fat_percentage: number;
    snf_percentage: number;
    animal_type?: string;
  }) => {
    const res = await api.post<{
      quantity: number;
      fat_percentage: number;
      snf_percentage: number;
      calculated_rate: number;
      total_amount: number;
      pricing_type: string;
      base_rate: number;
      formula: string;
    }>('/rates/calculate', params);
    return res.data;
  },
  create: async (data: Partial<MilkRate>) => {
    const res = await api.post<MilkRate>('/rates', data);
    return res.data;
  },
  update: async (id: string, data: Partial<MilkRate>) => {
    const res = await api.put<MilkRate>(`/rates/${id}`, data);
    return res.data;
  },
};

// Payments (Phase 5)
export const paymentsApi = {
  getDailySummary: async (params?: { date?: string; center_id?: string; search?: string }) => {
    const res = await api.get<{
      date: string;
      summaries: DailyPaymentSummary[];
      count: number;
      metrics: {
        total_sale: number;
        total_advance_used: number;
        total_paid: number;
        total_due: number;
      };
    }>('/payments/daily-summary', { params });
    return res.data;
  },
  getAdvanceBalance: async (customerId: string) => {
    const res = await api.get<{
      total_added: number;
      total_used: number;
      available_balance: number;
    }>(`/payments/advance-balance/${customerId}`);
    return res.data;
  },
  getAdvanceLedger: async (params?: { customer_id?: string; from_date?: string; to_date?: string }) => {
    const res = await api.get<AdvanceLedgerEntry[]>('/payments/advance-ledger', { params });
    return res.data;
  },
  autoAdjust: async (data: { customer_id: string; date: string; sale?: number }) => {
    const res = await api.post<{
      customer_id: string;
      date: string;
      sale: number;
      available_advance: number;
      advance_used: number;
      remaining_advance: number;
      remaining_sale: number;
    }>('/payments/auto-adjust', data);
    return res.data;
  },
  recordPayment: async (data: {
    customer_id: string;
    date?: string;
    amount: number;
    payment_type: PaymentType;
    payment_mode: PaymentMode;
    reference_id?: string;
    notes?: string;
  }) => {
    const res = await api.post<PaymentRecord>('/payments', data);
    return res.data;
  },
  getAll: async (params?: {
    customer_id?: string;
    center_id?: string;
    date?: string;
    from_date?: string;
    to_date?: string;
    payment_type?: string;
    payment_method?: string;
  }) => {
    const res = await api.get<PaymentRecord[]>('/payments', { params });
    return res.data;
  },
  getSummary: async (centerId?: string) => {
    const res = await api.get<{
      total_payable: number;
      total_paid: number;
      total_pending: number;
      payment_count: number;
    }>('/payments/summary', { params: { center_id: centerId } });
    return res.data;
  },
  create: async (data: any) => {
    const res = await api.post('/payments', data);
    return res.data;
  },
};

// Settlements
export const settlementsApi = {
  getAll: async (params?: { customer_id?: string; month_year?: string }) => {
    const res = await api.get<Settlement[]>('/settlements', { params });
    return res.data;
  },
  calculate: async (data: {
    customer_id: string;
    month_year?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const res = await api.post<{
      customer: Partial<Customer>;
      month_year: string;
      from_date: string;
      to_date: string;
      total_milk: number;
      total_amount: number;
      previous_paid: number;
      pending_amount: number;
      settlement_amount_suggested: number;
      collection_count: number;
      payment_count: number;
    }>('/settlements/calculate', data);
    return res.data;
  },
  confirm: async (data: {
    customer_id: string;
    month_year?: string;
    settled_amount?: number;
    from_date?: string;
    to_date?: string;
  }) => {
    const res = await api.post<Settlement>('/settlements/confirm', data);
    return res.data;
  },
};

// Ledger
export const ledgerApi = {
  getByCustomerId: async (customerId: string) => {
    const res = await api.get<{
      customer: {
        id: string;
        name: string;
        customer_code: string;
        mobile: string;
        village: string;
        center_name: string;
      };
      opening_balance: number;
      closing_balance: number;
      total_milk_litres: number;
      total_debit: number;
      total_credit: number;
      entries: LedgerEntry[];
    }>(`/ledger/${customerId}`);
    return res.data;
  },
};

// Expenses
export const expensesApi = {
  getAll: async (params?: {
    center_id?: string;
    category?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const res = await api.get<{
      expenses: Expense[];
      summary: {
        today_expenses: number;
        this_month_expenses: number;
        total_expenses: number;
        category_totals: Record<string, number>;
      };
    }>('/expenses', { params });
    return res.data;
  },
  create: async (data: Partial<Expense>) => {
    const res = await api.post<Expense>('/expenses', data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/expenses/${id}`);
    return res.data;
  },
};

// Staff
export const staffApi = {
  getAll: async () => {
    const res = await api.get<User[]>('/staff');
    return res.data;
  },
  create: async (data: Partial<User>) => {
    const res = await api.post<User>('/staff', data);
    return res.data;
  },
  update: async (id: string, data: Partial<User>) => {
    const res = await api.put<User>(`/staff/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/staff/${id}`);
    return res.data;
  },
};

// Centers
export const centersApi = {
  getAll: async () => {
    const res = await api.get<CollectionCenter[]>('/centers');
    return res.data;
  },
  getById: async (id: string) => {
    const res = await api.get<CollectionCenter>(`/centers/${id}`);
    return res.data;
  },
  create: async (data: Partial<CollectionCenter>) => {
    const res = await api.post<CollectionCenter>('/centers', data);
    return res.data;
  },
  update: async (id: string, data: Partial<CollectionCenter>) => {
    const res = await api.put<CollectionCenter>(`/centers/${id}`, data);
    return res.data;
  },
  patch: async (id: string, data: Partial<CollectionCenter>) => {
    const res = await api.patch<CollectionCenter>(`/centers/${id}`, data);
    return res.data;
  },
};

// Dashboard
export const dashboardApi = {
  getStats: async (centerId?: string, date?: string) => {
    const res = await api.get<{
      kpis: {
        today_milk: number;
        morning_milk?: number;
        evening_milk?: number;
        today_amount: number;
        today_sales?: number;
        today_paid?: number;
        today_due?: number;
        total_centers?: number;
        total_suppliers: number;
        total_registered_suppliers?: number;
        direct_collections_today?: number;
        pending_payments: number;
      };
      center_breakdown?: Array<{
        center_id: string;
        center_name: string;
        code?: string;
        location?: string;
        morning_milk: number;
        evening_milk: number;
        today_total: number;
        today_amount?: number;
        today_sales?: number;
        today_paid?: number;
        today_due?: number;
        registered_suppliers: number;
        direct_collections?: number;
        pending_payments?: number;
      }>;
      morning_vs_evening: {
        morning: number;
        evening: number;
        total: number;
      };
      weekly_collection: Array<{
        date: string;
        day: string;
        morning: number;
        evening: number;
        total: number;
      }>;
      recent_deliveries?: Array<{
        id: string;
        customer_name: string;
        customer_code: string;
        center_name: string;
        session: string;
        actual_qty: number;
        status: string;
        total_amount: number;
        date: string;
      }>;
      recent_collections: Array<{
        id: string;
        customer_id: string;
        customer_name: string;
        customer_code: string;
        supplier_type?: string;
        center_name?: string;
        session: 'morning' | 'evening';
        milk: number;
        fat: number;
        snf: number;
        rate: number;
        amount: number;
        payment_status?: string;
        status: string;
        date: string;
      }>;
      recent_payments?: Array<{
        id: string;
        customer_name: string;
        customer_code: string;
        amount: number;
        payment_type: string;
        payment_mode: string;
        reference_id: string;
        date: string;
      }>;
      pending_payments: Array<any>;
      pending_balances?: Array<{
        customer_id: string;
        customer_name: string;
        customer_code: string;
        center_name: string;
        sale: number;
        paid: number;
        due: number;
      }>;
    }>('/dashboard/stats', { params: { center_id: centerId, date } });
    return res.data;
  },
};

// Reports (Phase 6 Complete Suite)
export const reportsApi = {
  // 1. Daily Milk Report
  getDailyMilk: async (params?: { date?: string; center_id?: string }) => {
    const res = await api.get('/reports/daily-milk', { params });
    return res.data;
  },
  // 2. Center-wise Collection Report
  getCenterWise: async (params?: { date?: string; center_id?: string }) => {
    const res = await api.get('/reports/center-wise', { params });
    return res.data;
  },
  // 3. Supplier-wise Collection Report
  getSupplierWise: async (params?: { from_date?: string; to_date?: string; center_id?: string; customer_id?: string }) => {
    const res = await api.get('/reports/supplier-wise', { params });
    return res.data;
  },
  // 4. Daily Sales Report
  getDailySales: async (params?: { date?: string; center_id?: string; customer_id?: string }) => {
    const res = await api.get('/reports/daily-sales', { params });
    return res.data;
  },
  // 5. Payment Report
  getPayments: async (params?: { from_date?: string; to_date?: string; customer_id?: string; payment_type?: string }) => {
    const res = await api.get('/reports/payments', { params });
    return res.data;
  },
  // 6. Pending / Due Report
  getPendingDue: async (params?: { date?: string; center_id?: string; customer_id?: string }) => {
    const res = await api.get('/reports/pending-due', { params });
    return res.data;
  },
  // 7. Advance Balance Report
  getAdvanceBalance: async (params?: { center_id?: string; customer_id?: string }) => {
    const res = await api.get('/reports/advance-balance', { params });
    return res.data;
  },
  // 8. Monthly Summary Report
  getMonthlySummary: async (params?: { month_year?: string; center_id?: string }) => {
    const res = await api.get('/reports/monthly-summary', { params });
    return res.data;
  },

  // Backwards compatibility aliases
  getDaily: async (params?: { date?: string; center_id?: string; session?: string }) => {
    const res = await api.get('/reports/daily', { params });
    return res.data;
  },
  getCustomerWise: async (params?: { from_date?: string; to_date?: string; center_id?: string }) => {
    const res = await api.get('/reports/customer-wise', { params });
    return res.data;
  },
  getMonthly: async (params?: { month_year?: string; center_id?: string }) => {
    const res = await api.get('/reports/monthly', { params });
    return res.data;
  },
  getPending: async (params?: { center_id?: string }) => {
    const res = await api.get('/reports/pending', { params });
    return res.data;
  },
  getCollectionSummary: async (params?: { from_date?: string; to_date?: string; center_id?: string }) => {
    const res = await api.get('/reports/collection-summary', { params });
    return res.data;
  },
  getProfitLoss: async (params?: { from_date?: string; to_date?: string; center_id?: string }) => {
    const res = await api.get('/reports/profit-loss', { params });
    return res.data;
  },
  getDirectCollection: async (params?: { from_date?: string; to_date?: string; center_id?: string }) => {
    const res = await api.get('/reports/direct-collection', { params });
    return res.data;
  },
};

// Notifications
export const notificationsApi = {
  getAll: async () => {
    const res = await api.get<{
      unread_count: number;
      notifications: NotificationItem[];
    }>('/notifications');
    return res.data;
  },
  markRead: async (id: string) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.post('/notifications/mark-all-read');
    return res.data;
  },
};

// Settings
export const settingsApi = {
  get: async () => {
    const res = await api.get<BusinessSettings>('/settings');
    return res.data;
  },
  update: async (data: Partial<BusinessSettings>) => {
    const res = await api.put<BusinessSettings>('/settings', data);
    return res.data;
  },
};

export default api;
