import axios from 'axios';
import {
  User,
  LoginCredentials,
  AuthResponse,
  DBStatus,
  HealthResponse,
  Customer,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  DeliveriesResponse,
  SaveDeliveryPayload,
  SalesResponse,
  Payment,
  PaymentType,
  CreatePaymentDTO,
  CustomerAdvanceInfo,
  CustomerHistoryResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Interceptor: Attach Bearer token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('milk_crm_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('milk_crm_token');
      localStorage.removeItem('milk_crm_user');
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Auth Service: Strictly Phase 1 Owner Authentication
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', {
      email: credentials.email.trim(),
      password: credentials.password,
    });
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await api.get<User>('/auth/me');
    return res.data;
  },

  logout: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await api.post<{ success: boolean; message: string }>('/auth/logout');
      return res.data;
    } catch {
      return { success: true, message: 'Logged out locally' };
    }
  },
};

const LOCAL_CUSTOMERS_KEY = 'milkhub_stored_customers';

function getLocalCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomer(cust: Customer) {
  try {
    const existing = getLocalCustomers();
    const filtered = existing.filter((c) => c.id !== cust.id);
    localStorage.setItem(LOCAL_CUSTOMERS_KEY, JSON.stringify([cust, ...filtered]));
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
}

// Customer Service: Phase 2 Customer CRUD, Search & Filter with offline & 405 resilience
export const customerApi = {
  getAll: async (params?: { search?: string; status?: 'active' | 'inactive' }): Promise<{ customers: Customer[]; total: number }> => {
    const local = getLocalCustomers();
    try {
      const queryParams: any = {};
      if (params?.search) queryParams.search = params.search;
      if (params?.status) queryParams.status = params.status;

      const res = await api.get<{ customers: Customer[]; total: number }>('/customers', {
        params: queryParams,
      });

      let backendCustomers: Customer[] = [];
      if (Array.isArray(res.data)) {
        backendCustomers = res.data;
      } else if (res.data?.customers) {
        backendCustomers = res.data.customers;
      }

      // Merge backend and local customers
      const mergedMap = new Map<string, Customer>();
      local.forEach((c) => mergedMap.set(c.id, c));
      backendCustomers.forEach((c) => {
        if (!mergedMap.has(c.id)) {
          mergedMap.set(c.id, c);
        }
      });
      let all = Array.from(mergedMap.values());

      if (params?.status) {
        all = all.filter((c) => c.status === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        all = all.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.area.toLowerCase().includes(q)
        );
      }
      return { customers: all, total: all.length };
    } catch {
      // If 405 (e.g. Vercel static rewrites) or offline, serve local customers
      let filtered = [...local];
      if (params?.status) {
        filtered = filtered.filter((c) => c.status === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q) ||
            c.area.toLowerCase().includes(q)
        );
      }
      return { customers: filtered, total: filtered.length };
    }
  },

  getById: async (id: string): Promise<Customer> => {
    try {
      const res = await api.get<any>(`/customers/${id}`);
      const cust = res.data.customer || res.data;
      if (cust) saveLocalCustomer(cust);
      return cust;
    } catch {
      const found = getLocalCustomers().find((c) => c.id === id);
      if (found) return found;
      throw new Error(`Customer with ID '${id}' not found`);
    }
  },

  create: async (data: CreateCustomerDTO): Promise<Customer> => {
    try {
      const res = await api.post<any>('/customers', data);
      const created = res.data.customer || res.data;
      if (created && created.id) {
        saveLocalCustomer(created);
        return created;
      }
    } catch (err: any) {
      // If 405 (static host/Vercel with no backend proxy) or network unreachable, persist locally
      if (err.response?.status === 405 || !err.response) {
        const fallbackId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const localCustomer: Customer = {
          id: fallbackId,
          name: data.name,
          phone: data.phone,
          address: data.address,
          area: data.area,
          default_morning_qty: Number(data.default_morning_qty) || 0,
          default_evening_qty: Number(data.default_evening_qty) || 0,
          rate: Number(data.rate) || 0,
          start_date: data.start_date,
          status: data.status || 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveLocalCustomer(localCustomer);
        return localCustomer;
      }
      throw err;
    }
    const fallbackId = `cust_${Date.now()}`;
    const localCust: Customer = {
      id: fallbackId,
      name: data.name,
      phone: data.phone,
      address: data.address,
      area: data.area,
      default_morning_qty: Number(data.default_morning_qty) || 0,
      default_evening_qty: Number(data.default_evening_qty) || 0,
      rate: Number(data.rate) || 0,
      start_date: data.start_date,
      status: data.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveLocalCustomer(localCust);
    return localCust;
  },

  update: async (id: string, data: UpdateCustomerDTO): Promise<Customer> => {
    try {
      const res = await api.patch<any>(`/customers/${id}`, data);
      const updated = res.data.customer || res.data;
      if (updated) {
        saveLocalCustomer(updated);
        return updated;
      }
    } catch (err: any) {
      if (err.response?.status === 405 || !err.response) {
        const existing = getLocalCustomers().find((c) => c.id === id);
        const updatedCust: Customer = {
          ...(existing || {
            id,
            name: '',
            phone: '',
            address: '',
            area: '',
            default_morning_qty: 0,
            default_evening_qty: 0,
            rate: 0,
            start_date: '',
            status: 'active',
            created_at: '',
            updated_at: '',
          }),
          ...data,
          updated_at: new Date().toISOString(),
        };
        saveLocalCustomer(updatedCust);
        return updatedCust;
      }
      throw err;
    }
    return { id, ...data } as Customer;
  },

  getHistory: async (id: string, month?: string): Promise<CustomerHistoryResponse> => {
    const res = await api.get<CustomerHistoryResponse>(`/customers/${id}/history`, {
      params: { month },
    });
    return res.data;
  },
};

// Delivery Service: Phase 3 Morning & Evening Workflow
export const deliveryApi = {
  getDeliveries: async (
    date: string,
    session: 'morning' | 'evening'
  ): Promise<DeliveriesResponse> => {
    const res = await api.get<DeliveriesResponse>('/deliveries', {
      params: { date, session },
    });
    return res.data;
  },

  saveDelivery: async (payload: SaveDeliveryPayload): Promise<any> => {
    const res = await api.post<any>('/deliveries', payload);
    return res.data;
  },

  saveBulk: async (deliveries: SaveDeliveryPayload[]): Promise<any> => {
    const res = await api.post<any>('/deliveries/bulk', { deliveries });
    return res.data;
  },
};

// Sales Service: Phase 4 Automatic Day-wise Sales Calculation
export const salesApi = {
  getDayWiseSales: async (date: string, customerId?: string): Promise<SalesResponse> => {
    const res = await api.get<SalesResponse>('/sales', {
      params: { date, customer_id: customerId },
    });
    return res.data;
  },
};

// Payment & Advance Ledger Service: Phase 5
export const paymentApi = {
  recordPayment: async (
    data: CreatePaymentDTO
  ): Promise<{ payment: Payment; advance_balance: number; message: string }> => {
    const res = await api.post<any>('/payments', data);
    return res.data;
  },

  getPayments: async (params?: {
    customer_id?: string;
    date?: string;
    payment_type?: PaymentType;
  }): Promise<{ payments: Payment[]; total: number; total_amount: number }> => {
    const res = await api.get<any>('/payments', { params });
    return res.data;
  },

  getCustomerAdvance: async (customerId: string): Promise<CustomerAdvanceInfo> => {
    const res = await api.get<CustomerAdvanceInfo>(`/customers/${customerId}/advance`);
    return res.data;
  },
};

// System & TiDB Diagnostic API
export const systemApi = {
  getHealth: async (): Promise<HealthResponse> => {
    const res = await api.get<HealthResponse>('/health');
    return res.data;
  },

  getDbStatus: async (): Promise<DBStatus> => {
    const res = await api.get<DBStatus>('/db/status');
    return res.data;
  },
};

