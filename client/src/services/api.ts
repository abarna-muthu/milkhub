import axios from 'axios';
import {
  Customer,
  MilkCollection,
  MilkRate,
  Payment,
  Settlement,
  LedgerEntry,
  Expense,
  User,
  CollectionCenter,
  NotificationItem,
  BusinessSettings,
} from '../types';

const api = axios.create({
  baseURL: '/api',
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

// Auth
export const authApi = {
  login: async (identifier: string, password: string) => {
    const res = await api.post('/auth/login', { identifier, password });
    return res.data;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

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
    const res = await api.get<{
      customers: Customer[];
      total: number;
      page: number;
      total_pages: number;
    }>('/customers', { params });
    return res.data;
  },
  getById: async (id: string) => {
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
    return res.data;
  },
  create: async (data: Partial<Customer>) => {
    const res = await api.post<Customer>('/customers', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Customer>) => {
    const res = await api.put<Customer>(`/customers/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/customers/${id}`);
    return res.data;
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

// Payments
export const paymentsApi = {
  getAll: async (params?: {
    customer_id?: string;
    center_id?: string;
    from_date?: string;
    to_date?: string;
    payment_method?: string;
  }) => {
    const res = await api.get<Payment[]>('/payments', { params });
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
  create: async (data: Partial<Payment>) => {
    const res = await api.post<Payment>('/payments', data);
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
  create: async (data: Partial<CollectionCenter>) => {
    const res = await api.post<CollectionCenter>('/centers', data);
    return res.data;
  },
  update: async (id: string, data: Partial<CollectionCenter>) => {
    const res = await api.put<CollectionCenter>(`/centers/${id}`, data);
    return res.data;
  },
};

// Dashboard
export const dashboardApi = {
  getStats: async (centerId?: string, date?: string) => {
    const res = await api.get<{
      kpis: {
        today_milk: number;
        today_amount: number;
        total_centers?: number;
        total_suppliers: number;
        total_registered_suppliers?: number;
        direct_collections_today?: number;
        pending_payments: number;
      };
      center_breakdown?: Array<{
        center_id: string;
        center_name: string;
        code: string;
        location: string;
        morning_milk: number;
        evening_milk: number;
        today_total: number;
        today_amount: number;
        registered_suppliers: number;
        direct_collections: number;
        pending_payments: number;
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
      pending_payments: Array<{
        customer_id: string;
        customer_name: string;
        customer_code: string;
        mobile: string;
        village: string;
        total_amount: number;
        paid: number;
        pending: number;
        due_date: string;
      }>;
    }>('/dashboard/stats', { params: { center_id: centerId, date } });
    return res.data;
  },
};

// Reports
export const reportsApi = {
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
  getCenterWise: async (params?: { date?: string; to_date?: string; center_id?: string }) => {
    const res = await api.get('/reports/center-wise', { params });
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
