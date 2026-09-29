import axios from 'axios';
import {
  User,
  LoginCredentials,
  AuthResponse,
  DBStatus,
  HealthResponse,
  Customer,
  CustomerStatus,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  DeliveriesResponse,
  DeliveryItem,
  DeliveryStatus,
  SaveDeliveryPayload,
  DeliveryHistoryItem,
  SalesResponse,
  DayWiseSaleItem,
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
    const token = localStorage.getItem('milk_crm_token');
    if (token?.startsWith('token_local_owner_session')) {
      return Promise.reject(error);
    }
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
    const cleanEmail = credentials.email.trim();
    const res = await api.post<AuthResponse>('/auth/login', {
      email: cleanEmail,
      identifier: cleanEmail,
      mobile: cleanEmail,
      username: cleanEmail,
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

      const res = await api.get<any>('/customers', {
        params: queryParams,
      });

      let backendCustomers: Customer[] = [];
      if (Array.isArray(res.data)) {
        backendCustomers = res.data;
      } else if (res.data?.customers && Array.isArray(res.data.customers)) {
        backendCustomers = res.data.customers;
      }

      // Map and normalize legacy and current backend customer shapes
      const normalizedBackend = backendCustomers.map((c: any) => ({
        id: String(c.id || c.customer_code || `cust_${Date.now()}`),
        name: c.name || '',
        phone: c.phone || c.mobile || '',
        address: c.address || '',
        area: c.area || c.village || '',
        default_morning_qty: Number(c.default_morning_qty ?? 1.0) || 0,
        default_evening_qty: Number(c.default_evening_qty ?? 1.0) || 0,
        rate: Number(c.rate ?? 60.0) || 0,
        start_date: c.start_date || new Date().toISOString().split('T')[0],
        status: (c.status as CustomerStatus) || 'active',
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

      // Merge backend and local customers
      const mergedMap = new Map<string, Customer>();
      local.forEach((c) => mergedMap.set(c.id, c));
      normalizedBackend.forEach((c) => {
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
      const c = res.data.customer || res.data;
      if (c) {
        const cust: Customer = {
          id: String(c.id || id),
          name: c.name || '',
          phone: c.phone || c.mobile || '',
          address: c.address || '',
          area: c.area || c.village || '',
          default_morning_qty: Number(c.default_morning_qty ?? 1.0) || 0,
          default_evening_qty: Number(c.default_evening_qty ?? 1.0) || 0,
          rate: Number(c.rate ?? 60.0) || 0,
          start_date: c.start_date || new Date().toISOString().split('T')[0],
          status: (c.status as CustomerStatus) || 'active',
          created_at: c.created_at,
          updated_at: c.updated_at,
        };
        saveLocalCustomer(cust);
        return cust;
      }
    } catch {
      const found = getLocalCustomers().find((c) => c.id === id);
      if (found) return found;
      throw new Error(`Customer with ID '${id}' not found`);
    }
    const found = getLocalCustomers().find((c) => c.id === id);
    if (found) return found;
    throw new Error(`Customer with ID '${id}' not found`);
  },

  create: async (data: CreateCustomerDTO): Promise<Customer> => {
    // Send dual-compatible payload containing both phone/mobile and area/village
    const payload = {
      ...data,
      name: data.name.trim(),
      phone: data.phone.trim(),
      mobile: data.phone.trim(),
      address: data.address.trim(),
      area: data.area.trim(),
      village: data.area.trim(),
      cow_count: 0,
      buffalo_count: 0,
      default_session: 'both',
      collection_center_id: 'c1',
    };

    try {
      const res = await api.post<any>('/customers', payload);
      const created = res.data.customer || res.data;
      if (created) {
        const normalizedCust: Customer = {
          id: String(created.id || `cust_${Date.now()}`),
          name: created.name || data.name,
          phone: created.phone || created.mobile || data.phone,
          address: created.address || data.address,
          area: created.area || created.village || data.area,
          default_morning_qty: Number(created.default_morning_qty ?? data.default_morning_qty) || 0,
          default_evening_qty: Number(created.default_evening_qty ?? data.default_evening_qty) || 0,
          rate: Number(created.rate ?? data.rate) || 0,
          start_date: created.start_date || data.start_date,
          status: created.status || data.status || 'active',
          created_at: created.created_at || new Date().toISOString(),
          updated_at: created.updated_at || new Date().toISOString(),
        };
        saveLocalCustomer(normalizedCust);
        return normalizedCust;
      }
    } catch (err: any) {
      // If 405 (static host/Vercel with no backend proxy) or network unreachable or schema reject
      if (
        err.response?.status === 405 ||
        !err.response ||
        err.response?.data?.error?.includes('Village') ||
        err.response?.data?.error?.includes('Mobile')
      ) {
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
    const payload: any = {
      ...data,
    };
    if (data.phone !== undefined) {
      payload.phone = data.phone;
      payload.mobile = data.phone;
    }
    if (data.area !== undefined) {
      payload.area = data.area;
      payload.village = data.area;
    }

    try {
      let res: any;
      try {
        res = await api.patch<any>(`/customers/${id}`, payload);
      } catch (patchErr: any) {
        if (patchErr.response?.status === 404 || patchErr.response?.status === 405) {
          res = await api.put<any>(`/customers/${id}`, payload);
        } else {
          throw patchErr;
        }
      }
      const updated = res.data?.customer || res.data;
      if (updated) {
        const normalized: Customer = {
          id: String(updated.id || id),
          name: updated.name || data.name || '',
          phone: updated.phone || updated.mobile || data.phone || '',
          address: updated.address || data.address || '',
          area: updated.area || updated.village || data.area || '',
          default_morning_qty: Number(updated.default_morning_qty ?? data.default_morning_qty) || 0,
          default_evening_qty: Number(updated.default_evening_qty ?? data.default_evening_qty) || 0,
          rate: Number(updated.rate ?? data.rate) || 0,
          start_date: updated.start_date || data.start_date || '',
          status: updated.status || data.status || 'active',
          created_at: updated.created_at,
          updated_at: updated.updated_at || new Date().toISOString(),
        };
        saveLocalCustomer(normalized);
        return normalized;
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
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
          }),
          ...data,
          updated_at: new Date().toISOString(),
        };
        saveLocalCustomer(updatedCust);
        return updatedCust;
      }
      throw err;
    }
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
        start_date: new Date().toISOString().split('T')[0],
        status: 'active',
      }),
      ...data,
      updated_at: new Date().toISOString(),
    };
    saveLocalCustomer(updatedCust);
    return updatedCust;
  },

  getHistory: async (id: string, month?: string): Promise<CustomerHistoryResponse> => {
    const res = await api.get<CustomerHistoryResponse>(`/customers/${id}/history`, {
      params: { month },
    });
    return res.data;
  },
};

const LOCAL_DELIVERIES_KEY = 'milkhub_stored_deliveries';
const LOCAL_PAYMENTS_KEY = 'milkhub_stored_payments';

interface LocalDeliveryRecord {
  id: string;
  customer_id: string;
  date: string;
  session: 'morning' | 'evening';
  actual_qty: number;
  status: DeliveryStatus;
  updated_at: string;
}

function getLocalDeliveries(): LocalDeliveryRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELIVERIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDeliveryRecord(dto: SaveDeliveryPayload): LocalDeliveryRecord {
  const session = dto.session.toLowerCase().includes('eve') ? 'evening' : 'morning';
  const status: DeliveryStatus =
    dto.status === 'no_milk' || Number(dto.actual_qty) === 0 ? 'no_milk' : 'delivered';
  const actual_qty = status === 'no_milk' ? 0 : Math.max(0, Number(dto.actual_qty) || 0);

  const existing = getLocalDeliveries();
  const filtered = existing.filter(
    (d) => !(d.customer_id === dto.customer_id && d.date === dto.date && d.session === session)
  );

  const record: LocalDeliveryRecord = {
    id: `del_${dto.customer_id}_${dto.date}_${session}`,
    customer_id: dto.customer_id,
    date: dto.date,
    session,
    actual_qty,
    status,
    updated_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_DELIVERIES_KEY, JSON.stringify([record, ...filtered]));
  } catch (err) {
    console.warn('Failed to save delivery to localStorage:', err);
  }
  return record;
}

function getLocalPayments(): Payment[] {
  try {
    const raw = localStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPayment(payment: Payment) {
  try {
    const existing = getLocalPayments();
    localStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify([payment, ...existing]));
  } catch (err) {
    console.warn('Failed to save payment to localStorage:', err);
  }
}

// Delivery Service: Phase 3 Morning & Evening Workflow with Local Customer & Storage Fallback
export const deliveryApi = {
  getDeliveries: async (
    date: string,
    session: 'morning' | 'evening'
  ): Promise<DeliveriesResponse> => {
    // 1. Always load all active customers (both backend and local storage)
    let activeCustomers: Customer[] = [];
    try {
      const custRes = await customerApi.getAll({ status: 'active' });
      activeCustomers = Array.isArray(custRes?.customers) ? custRes.customers : [];
    } catch {
      activeCustomers = getLocalCustomers().filter((c) => c.status === 'active');
    }

    // 2. Try fetching from backend if available
    let backendDeliveries: DeliveryItem[] = [];
    try {
      const res = await api.get<DeliveriesResponse>('/deliveries', {
        params: { date, session },
      });
      if (res.data?.deliveries && Array.isArray(res.data.deliveries)) {
        backendDeliveries = res.data.deliveries;
      }
    } catch {
      // Backend offline or error; seamlessly use local storage
    }

    const localDeliveries = getLocalDeliveries();
    const deliveriesMap = new Map<string, DeliveryItem>();

    // Seed from backend deliveries
    backendDeliveries.forEach((d) => deliveriesMap.set(d.customer_id, d));

    // Ensure EVERY active customer is present and has proper defaults
    activeCustomers.forEach((cust) => {
      const defaultQty =
        session === 'morning'
          ? Number(cust.default_morning_qty ?? 1.0) || 0
          : Number(cust.default_evening_qty ?? 1.0) || 0;

      const existingBackend = deliveriesMap.get(cust.id);
      const existingLocal = localDeliveries.find(
        (l) => l.customer_id === cust.id && l.date === date && l.session === session
      );

      if (existingLocal) {
        deliveriesMap.set(cust.id, {
          id: existingLocal.id,
          customer_id: cust.id,
          customer_name: cust.name,
          customer_phone: cust.phone,
          customer_area: cust.area,
          customer_address: cust.address,
          date,
          session,
          default_qty: defaultQty,
          actual_qty: existingLocal.actual_qty,
          status: existingLocal.status,
          is_saved: true,
          rate: Number(cust.rate ?? 60.0) || 0,
          updated_at: existingLocal.updated_at,
        });
      } else if (existingBackend) {
        deliveriesMap.set(cust.id, {
          ...existingBackend,
          customer_name: cust.name,
          customer_phone: cust.phone,
          customer_area: cust.area,
          customer_address: cust.address,
          default_qty: defaultQty,
          rate: Number(cust.rate ?? 60.0) || 0,
        });
      } else {
        deliveriesMap.set(cust.id, {
          id: `del_${cust.id}_${date}_${session}`,
          customer_id: cust.id,
          customer_name: cust.name,
          customer_phone: cust.phone,
          customer_area: cust.area,
          customer_address: cust.address,
          date,
          session,
          default_qty: defaultQty,
          actual_qty: defaultQty,
          status: defaultQty > 0 ? 'delivered' : 'no_milk',
          is_saved: false,
          rate: Number(cust.rate ?? 60.0) || 0,
        });
      }
    });

    const deliveries = Array.from(deliveriesMap.values());
    const totalQty = deliveries.reduce((sum, d) => sum + (Number(d.actual_qty) || 0), 0);
    const deliveredCount = deliveries.filter((d) => d.status === 'delivered').length;
    const noMilkCount = deliveries.filter((d) => d.status === 'no_milk').length;

    return {
      deliveries,
      total: deliveries.length,
      date,
      session,
      summary: {
        total_qty: Math.round(totalQty * 100) / 100,
        delivered_count: deliveredCount,
        no_milk_count: noMilkCount,
      },
    };
  },

  saveDelivery: async (payload: SaveDeliveryPayload): Promise<any> => {
    saveLocalDeliveryRecord(payload);
    try {
      const res = await api.post<any>('/deliveries', payload);
      return res.data;
    } catch {
      return { message: 'Delivery recorded successfully', success: true };
    }
  },

  saveBulk: async (deliveries: SaveDeliveryPayload[]): Promise<any> => {
    deliveries.forEach((d) => saveLocalDeliveryRecord(d));
    try {
      const res = await api.post<any>('/deliveries/bulk', { deliveries });
      return res.data;
    } catch {
      return { message: 'Deliveries saved successfully', count: deliveries.length };
    }
  },

  getHistory: async (params?: {
    startDate?: string;
    endDate?: string;
    session?: 'morning' | 'evening' | 'all';
  }): Promise<DeliveryHistoryItem[]> => {
    // 1. Get all customers to enrich details
    let customers: Customer[] = [];
    try {
      const custRes = await customerApi.getAll();
      customers = Array.isArray(custRes?.customers) ? custRes.customers : [];
    } catch {
      customers = getLocalCustomers();
    }
    const customerMap = new Map<string, Customer>();
    customers.forEach((c) => customerMap.set(c.id, c));

    // 2. Get all saved local deliveries
    const localRecords = getLocalDeliveries();

    // 3. Transform to DeliveryHistoryItem
    let items: DeliveryHistoryItem[] = localRecords.map((rec) => {
      const cust = customerMap.get(rec.customer_id);
      const rate = Number(cust?.rate ?? 60.0) || 0;
      const actual_qty = Number(rec.actual_qty) || 0;
      const defaultQty =
        rec.session === 'morning'
          ? Number(cust?.default_morning_qty ?? 1.0) || 0
          : Number(cust?.default_evening_qty ?? 1.0) || 0;

      return {
        id: rec.id,
        customer_id: rec.customer_id,
        customer_name: cust?.name || 'Customer ' + rec.customer_id.slice(-4),
        customer_phone: cust?.phone || '-',
        customer_area: cust?.area || (cust as any)?.village || '-',
        date: rec.date,
        session: rec.session,
        default_qty: defaultQty,
        actual_qty,
        status: rec.status,
        rate,
        amount: Math.round(actual_qty * rate * 100) / 100,
        updated_at: rec.updated_at,
      };
    });

    // 4. Filter by session if requested
    if (params?.session && params.session !== 'all') {
      items = items.filter((i) => i.session === params.session);
    }

    // 5. Filter by date range if requested
    if (params?.startDate) {
      items = items.filter((i) => i.date >= params.startDate!);
    }
    if (params?.endDate) {
      items = items.filter((i) => i.date <= params.endDate!);
    }

    // 6. Sort date descending, session morning first then evening
    items.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.session.localeCompare(b.session);
    });

    return items;
  },
};

// Sales Service: Phase 4 Automatic Day-wise Sales Calculation with Local Fallback
export const salesApi = {
  getDayWiseSales: async (date: string, customerId?: string): Promise<SalesResponse> => {
    let backendSales: DayWiseSaleItem[] = [];
    try {
      const res = await api.get<SalesResponse>('/sales', {
        params: { date, customer_id: customerId },
      });
      if (res.data?.sales && Array.isArray(res.data.sales)) {
        backendSales = res.data.sales;
      }
    } catch {
      // Backend offline; calculate locally
    }

    let activeCustomers: Customer[] = [];
    try {
      const custRes = await customerApi.getAll({ status: 'active' });
      activeCustomers = Array.isArray(custRes?.customers) ? custRes.customers : [];
    } catch {
      activeCustomers = getLocalCustomers().filter((c) => c.status === 'active');
    }

    if (customerId) {
      activeCustomers = activeCustomers.filter((c) => c.id === customerId);
    }

    const localDeliveries = getLocalDeliveries();
    const salesMap = new Map<string, DayWiseSaleItem>();

    backendSales.forEach((s) => salesMap.set(s.customer_id, s));

    activeCustomers.forEach((cust) => {
      const existing = salesMap.get(cust.id);
      if (existing) return;

      const morningRecord = localDeliveries.find(
        (d) => d.customer_id === cust.id && d.date === date && d.session === 'morning'
      );
      const eveningRecord = localDeliveries.find(
        (d) => d.customer_id === cust.id && d.date === date && d.session === 'evening'
      );

      const morning_qty = morningRecord ? morningRecord.actual_qty : Number(cust.default_morning_qty) || 0;
      const evening_qty = eveningRecord ? eveningRecord.actual_qty : Number(cust.default_evening_qty) || 0;
      const total_litres = Math.round((morning_qty + evening_qty) * 100) / 100;
      const rate = Number(cust.rate) || 0;
      const sale_amount = Math.round(total_litres * rate * 100) / 100;

      salesMap.set(cust.id, {
        id: `sale_${cust.id}_${date}`,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        customer_area: cust.area,
        date,
        morning_qty,
        evening_qty,
        total_litres,
        rate,
        sale_amount,
        advance_used: 0,
        paid: 0,
        due: sale_amount,
      });
    });

    const sales = Array.from(salesMap.values());
    const total_morning_litres = sales.reduce((s, it) => s + (it.morning_qty || 0), 0);
    const total_evening_litres = sales.reduce((s, it) => s + (it.evening_qty || 0), 0);
    const total_litres = sales.reduce((s, it) => s + (it.total_litres || 0), 0);
    const total_sales_amount = sales.reduce((s, it) => s + (it.sale_amount || 0), 0);
    const total_advance_used = sales.reduce((s, it) => s + (it.advance_used || 0), 0);
    const total_paid = sales.reduce((s, it) => s + (it.paid || 0), 0);
    const total_due = sales.reduce((s, it) => s + (it.due || 0), 0);

    return {
      sales,
      total: sales.length,
      date,
      summary: {
        total_morning_litres: Math.round(total_morning_litres * 100) / 100,
        total_evening_litres: Math.round(total_evening_litres * 100) / 100,
        total_litres: Math.round(total_litres * 100) / 100,
        total_sales_amount: Math.round(total_sales_amount * 100) / 100,
        total_advance_used: Math.round(total_advance_used * 100) / 100,
        total_paid: Math.round(total_paid * 100) / 100,
        total_due: Math.round(total_due * 100) / 100,
      },
    };
  },
};

// Payment & Advance Ledger Service: Phase 5 with Local Fallback
export const paymentApi = {
  recordPayment: async (
    data: CreatePaymentDTO
  ): Promise<{ payment: Payment; advance_balance: number; message: string }> => {
    try {
      const res = await api.post<any>('/payments', data);
      return res.data;
    } catch {
      const localPayment: Payment = {
        id: `pay_${Date.now()}`,
        customer_id: data.customer_id,
        amount: Number(data.amount) || 0,
        payment_type: data.payment_type,
        payment_mode: data.payment_mode || 'cash',
        date: data.date,
        created_at: new Date().toISOString(),
      };
      saveLocalPayment(localPayment);
      return {
        payment: localPayment,
        advance_balance: data.payment_type === 'advance' ? Number(data.amount) || 0 : 0,
        message: 'Payment recorded successfully',
      };
    }
  },

  getPayments: async (params?: {
    customer_id?: string;
    date?: string;
    payment_type?: PaymentType;
  }): Promise<{ payments: Payment[]; total: number; total_amount: number }> => {
    try {
      const res = await api.get<any>('/payments', { params });
      return res.data;
    } catch {
      let list = getLocalPayments();
      if (params?.customer_id) {
        list = list.filter((p) => p.customer_id === params.customer_id);
      }
      if (params?.date) {
        list = list.filter((p) => p.date === params.date);
      }
      if (params?.payment_type) {
        list = list.filter((p) => p.payment_type === params.payment_type);
      }
      const total_amount = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return { payments: list, total: list.length, total_amount };
    }
  },

  getCustomerAdvance: async (customerId: string): Promise<CustomerAdvanceInfo> => {
    try {
      const res = await api.get<CustomerAdvanceInfo>(`/customers/${customerId}/advance`);
      return res.data;
    } catch {
      const cust = getLocalCustomers().find((c) => c.id === customerId);
      const payments = getLocalPayments().filter(
        (p) => p.customer_id === customerId && p.payment_type === 'advance'
      );
      const totalAdvance = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      return {
        customer_id: customerId,
        customer_name: cust?.name || '',
        advance_balance: totalAdvance,
        total_advance_credited: totalAdvance,
        total_advance_used: 0,
        ledger: [],
      };
    }
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

