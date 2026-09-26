export type UserRole = 'admin' | 'staff';

export interface User {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: UserRole;
  collection_center_id: string;
  collection_center_name?: string;
  status: 'active' | 'inactive';
  password?: string;
  last_login?: string;
}

export type SupplierType = 'REGISTERED' | 'DIRECT';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface CollectionCenter {
  id: string;
  center_name?: string;
  name?: string; // alias for center_name
  location: string;
  code?: string;
  phone?: string;
  status?: 'active' | 'inactive';
  is_active?: boolean;
  supplier_count?: number;
  today_morning_milk?: number;
  today_evening_milk?: number;
  today_total_milk?: number;
  today_amount?: number;
  monthly_total_milk?: number;
  monthly_amount?: number;
  pending_amount?: number;
  direct_suppliers_today?: number;
  today_milk?: number;
  total_collections_amount?: number;
  total_paid?: number;
  created_at: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  customer_code: string; // e.g. SUP001
  name: string;
  phone: string;
  mobile?: string; // alias for phone
  address?: string;
  area: string;
  village?: string; // alias for area
  center_id: string;
  collection_center_id?: string; // alias for center_id
  center_name?: string;
  cow_count: number;
  buffalo_count: number;
  default_morning_qty: number;
  default_evening_qty: number;
  default_session?: 'morning' | 'evening' | 'both';
  rate: number;
  start_date: string;
  status: 'active' | 'inactive';
  notes?: string;
  total_milk?: number;
  total_amount?: number;
  total_paid?: number;
  pending_amount?: number;
  created_at: string;
  updated_at?: string;
}

export type PricingType = 'fixed' | 'fat_snf';

export interface MilkRate {
  id: string;
  pricing_type: PricingType;
  base_rate: number;
  standard_fat: number;
  standard_snf: number;
  fat_rate: number;
  snf_rate: number;
  effective_date: string;
  updated_by: string;
  is_active: boolean;
  notes?: string;
}

export type DeliverySession = 'MORNING' | 'EVENING';
export type DeliveryStatus = 'DELIVERED' | 'NO_MILK';

export interface Delivery {
  id: string;
  customer_id: string;
  center_id: string;
  date: string; // YYYY-MM-DD
  session: DeliverySession;
  actual_qty: number;
  status: DeliveryStatus;
  created_at: string;
  updated_at?: string;
  // Presentation fields for daily entry table
  customer_name?: string;
  customer_code?: string;
  phone?: string;
  center_name?: string;
  default_qty?: number;
  rate?: number;
  total_amount?: number;
  is_saved?: boolean;
}

export interface MilkCollection {
  id: string;
  customer_id?: string | null;
  supplier_id?: string | null;
  supplier_type: SupplierType;
  walk_in_name?: string | null;
  walk_in_mobile?: string | null;
  customer_name?: string;
  customer_code?: string;
  customer_mobile?: string;
  village?: string;
  collection_center_id: string;
  center_name?: string;
  date: string;
  session: 'morning' | 'evening';
  animal_type: 'cow' | 'buffalo';
  quantity: number;
  fat_percentage: number;
  snf_percentage: number;
  calculated_rate: number;
  total_amount: number;
  payment_status: PaymentStatus;
  status: 'collected' | 'verified' | 'cancelled';
  collected_by: string;
  notes?: string;
  created_at: string;
}

export type PaymentType = 'DAILY_PAYMENT' | 'ADVANCE';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER';
export type AdvanceLedgerType = 'ADVANCE_ADDED' | 'ADVANCE_USED';

export interface PaymentRecord {
  id: string;
  customer_id: string;
  date: string;
  amount: number;
  payment_type: PaymentType;
  payment_mode: PaymentMode;
  reference_id?: string;
  notes?: string;
  created_at: string;
  customer_name?: string;
  customer_code?: string;
  center_id?: string;
  center_name?: string;
}

export interface AdvanceLedgerEntry {
  id: string;
  customer_id: string;
  date: string;
  type: AdvanceLedgerType;
  amount: number;
  reference_id?: string;
  notes?: string;
  created_at: string;
  customer_name?: string;
  customer_code?: string;
}

export interface CustomerHistoryEntry {
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
  total_milk: number;
  total_sales: number;
  total_paid: number;
  total_due: number;
  advance_balance: number;
}

export interface CustomerHistoryResponse {
  customer: Customer | null;
  history: CustomerHistoryEntry[];
  monthly_summary: CustomerMonthlySummary;
}

export interface DailyPaymentSummary {
  date: string;
  customer_id: string;
  customer_name: string;
  customer_code: string;
  center_id: string;
  center_name: string;
  phone?: string;
  rate: number;
  total_qty: number;
  sale: number;
  available_advance: number;
  advance_used: number;
  remaining_advance: number;
  remaining_sale: number;
  paid: number;
  due: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERPAID';
}

export interface Payment {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_code?: string;
  customer_mobile?: string;
  village?: string;
  collection_center_id: string;
  center_name?: string;
  date: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer';
  reference_no?: string;
  status: 'completed' | 'pending' | 'failed';
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface Settlement {
  id: string;
  settlement_code: string;
  customer_id: string;
  customer_name?: string;
  customer_code?: string;
  customer_mobile?: string;
  collection_center_id: string;
  center_name?: string;
  month_year: string;
  from_date: string;
  to_date: string;
  total_milk: number;
  total_amount: number;
  previous_paid: number;
  pending_amount: number;
  settled_amount: number;
  status: 'settled' | 'partial';
  confirmed_at: string;
  confirmed_by: string;
}

export interface LedgerEntry {
  id: string;
  customer_id: string;
  date: string;
  description: string;
  milk_quantity?: number;
  debit: number;
  credit: number;
  running_balance: number;
  reference_type: 'collection' | 'payment' | 'settlement' | 'opening';
  reference_id?: string;
  created_at: string;
}

export type ExpenseCategory =
  | 'transport'
  | 'salary'
  | 'maintenance'
  | 'electricity'
  | 'equipment'
  | 'other';

export interface Expense {
  id: string;
  collection_center_id: string;
  center_name?: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer';
  notes?: string;
  added_by: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'payment' | 'settlement' | 'supplier' | 'rate' | 'collection' | 'system';
  read: boolean;
  timestamp: string;
  target_user_id?: string;
}

export interface BusinessSettings {
  business_name: string;
  tagline: string;
  brand_code: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  state: string;
  default_pricing_mode: PricingType;
  base_cow_rate: number;
  base_buffalo_rate: number;
  default_language: 'en' | 'ta';
  whatsapp_enabled: boolean;
  currency_symbol: string;
}
