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

// Customer Service: Phase 2 Customer CRUD, Search & Filter
export const customerApi = {
  getAll: async (params?: { search?: string; status?: 'active' | 'inactive' }): Promise<{ customers: Customer[]; total: number }> => {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.status) queryParams.status = params.status;

    const res = await api.get<{ customers: Customer[]; total: number }>('/customers', {
      params: queryParams,
    });

    if (Array.isArray(res.data)) {
      return { customers: res.data, total: res.data.length };
    }
    return {
      customers: res.data.customers || [],
      total: res.data.total ?? (res.data.customers?.length || 0),
    };
  },

  getById: async (id: string): Promise<Customer> => {
    const res = await api.get<any>(`/customers/${id}`);
    return res.data.customer || res.data;
  },

  create: async (data: CreateCustomerDTO): Promise<Customer> => {
    const res = await api.post<any>('/customers', data);
    return res.data.customer || res.data;
  },

  update: async (id: string, data: UpdateCustomerDTO): Promise<Customer> => {
    const res = await api.patch<any>(`/customers/${id}`, data);
    return res.data.customer || res.data;
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

