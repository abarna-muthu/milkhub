/**
 * Milk Business CRM - Frontend Core Types
 * Strictly adhering to PDF Blueprint (React + Node.js + TiDB)
 * Phase 1: Foundation, TiDB Users Table & Owner Authentication
 * Rule: Customer has NO LOGIN • Owner is the primary system user
 */

export interface User {
  id: string;
  email: string;
  role: 'owner';
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DBStatus {
  connected: boolean;
  type: 'tidb' | 'local_fallback';
  host: string;
  port: number;
  database: string;
  usersTableExists: boolean;
  usersCount: number;
  lastChecked: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  phase: string;
  architecture: string;
  timestamp: string;
  uptime: number;
}

/**
 * Phase 2: Customer Types
 * Strict fields: id, name, phone, address, area, default_morning_qty, default_evening_qty, rate, start_date, status
 */
export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  area: string;
  default_morning_qty: number;
  default_evening_qty: number;
  rate: number;
  start_date: string;
  status: CustomerStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CreateCustomerDTO {
  name: string;
  phone: string;
  address: string;
  area: string;
  default_morning_qty: number;
  default_evening_qty: number;
  rate: number;
  start_date: string;
  status?: CustomerStatus;
}

export interface UpdateCustomerDTO {
  name?: string;
  phone?: string;
  address?: string;
  area?: string;
  default_morning_qty?: number;
  default_evening_qty?: number;
  rate?: number;
  start_date?: string;
  status?: CustomerStatus;
}

export interface CustomerFilter {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
}

/**
 * Phase 3: Delivery Workflow Types (Morning & Evening)
 * Strict fields: id, customer_id, date, session, actual_qty, status
 */
export type DeliverySession = 'morning' | 'evening';
export type DeliveryStatus = 'delivered' | 'no_milk';

export interface DeliveryItem {
  id?: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_area: string;
  customer_address: string;
  date: string;
  session: DeliverySession;
  default_qty: number;
  actual_qty: number;
  status: DeliveryStatus;
  is_saved: boolean;
  rate: number;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveriesResponse {
  deliveries: DeliveryItem[];
  total: number;
  date: string;
  session: DeliverySession;
  summary: {
    total_qty: number;
    delivered_count: number;
    no_milk_count: number;
  };
}

export interface SaveDeliveryPayload {
  customer_id: string;
  date: string;
  session: string;
  actual_qty: number;
  status: string;
}

/**
 * Phase 4: Automatic Sales Calculation Types
 * Strict fields: id, customer_id, date, morning_qty, evening_qty, total_litres, rate, sale_amount
 * Day-wise sales columns: Date, Customer, Morning, Evening, Total, Rate, Sale, Advance Used, Paid, Due
 */
export interface Sale {
  id: string;
  customer_id: string;
  date: string;
  morning_qty: number;
  evening_qty: number;
  total_litres: number;
  rate: number;
  sale_amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface DayWiseSaleItem {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_area: string;
  date: string;
  morning_qty: number;
  evening_qty: number;
  total_litres: number;
  rate: number;
  sale_amount: number;
  advance_used: number;
  paid: number;
  due: number;
  created_at?: string;
  updated_at?: string;
}

export interface SalesSummary {
  total_morning_litres: number;
  total_evening_litres: number;
  total_litres: number;
  total_sales_amount: number;
  total_advance_used: number;
  total_paid: number;
  total_due: number;
}

export interface SalesResponse {
  sales: DayWiseSaleItem[];
  total: number;
  date: string;
  summary: SalesSummary;
}

/**
 * Phase 5: Daily Payment & Advance Ledger Types
 * Strict tables:
 * - payments: id, customer_id, date, amount, payment_type, payment_mode
 * - advance_ledger: id, customer_id, date, type, amount, reference_id
 */
export type PaymentType = 'daily' | 'advance';
export type AdvanceLedgerType = 'credit' | 'adjustment';

export interface Payment {
  id: string;
  customer_id: string;
  customer_name?: string;
  date: string;
  amount: number;
  payment_type: PaymentType;
  payment_mode: string;
  created_at?: string;
  updated_at?: string;
}

export interface AdvanceLedgerEntry {
  id: string;
  customer_id: string;
  date: string;
  type: AdvanceLedgerType;
  amount: number;
  reference_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePaymentDTO {
  customer_id: string;
  date: string;
  amount: number;
  payment_type: PaymentType;
  payment_mode?: string;
}

export interface CustomerAdvanceInfo {
  customer_id: string;
  customer_name: string;
  advance_balance: number;
  total_advance_credited: number;
  total_advance_used: number;
  ledger: AdvanceLedgerEntry[];
}

/**
 * Phase 6: Customer History & Monthly Summary
 * History: Date, Morning, Evening, Total, Sale, Advance Used, Paid, Due
 * Monthly Summary: Total Milk, Total Sales, Total Paid, Total Due, Advance Balance
 */
export interface CustomerHistoryItem {
  date: string;
  morning: number;
  evening: number;
  total: number;
  rate: number;
  sale: number;
  advance_used: number;
  paid: number;
  due: number;
}

export interface CustomerMonthlySummary {
  month: string;
  total_milk: number;
  total_sales: number;
  total_paid: number;
  total_due: number;
  advance_balance: number;
}

export interface CustomerHistoryResponse {
  customer: Customer;
  items: CustomerHistoryItem[];
  monthly_summary: CustomerMonthlySummary;
}



