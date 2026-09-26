import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseState, getInitialSeedData } from './seedData.js';
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
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'dairy_crm.json');

class DataStore {
  private state: DatabaseState;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.state = this.loadData();
  }

  private loadData(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure all keys exist
        const seed = getInitialSeedData();
        return {
          ...seed,
          ...parsed,
        };
      }
    } catch (err) {
      console.warn('Failed to load existing dairy_crm.json, initializing fresh seed data.', err);
    }

    const initial = getInitialSeedData();
    this.persist(initial);
    return initial;
  }

  private persist(data: DatabaseState) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database state to disk:', err);
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persist(this.state);
      this.saveTimeout = null;
    }, 150);
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public resetToFreshSeed(): DatabaseState {
    const seed = getInitialSeedData();
    this.state = seed;
    this.persist(seed);
    return this.state;
  }

  public reloadFromDisk(): DatabaseState {
    this.state = this.loadData();
    return this.state;
  }

  // --- Collection Centers ---
  public getCenters(): CollectionCenter[] {
    return this.state.collection_centers;
  }
  public getCenterById(id: string): CollectionCenter | undefined {
    return this.state.collection_centers.find((c) => c.id === id);
  }
  public addCenter(center: CollectionCenter): CollectionCenter {
    this.state.collection_centers.push(center);
    this.scheduleSave();
    return center;
  }
  public updateCenter(id: string, updates: Partial<CollectionCenter>): CollectionCenter | null {
    const idx = this.state.collection_centers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.state.collection_centers[idx] = { ...this.state.collection_centers[idx], ...updates };
    this.scheduleSave();
    return this.state.collection_centers[idx];
  }

  // --- Users & Staff ---
  public getUsers(): User[] {
    return this.state.users;
  }
  public getUserById(id: string): User | undefined {
    return this.state.users.find((u) => u.id === id);
  }
  public getUserByEmail(email: string): User | undefined {
    return this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  public getUserByMobile(mobile: string): User | undefined {
    return this.state.users.find((u) => u.mobile === mobile);
  }
  public addUser(user: User): User {
    this.state.users.push(user);
    this.scheduleSave();
    return user;
  }
  public updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.state.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.state.users[idx] = { ...this.state.users[idx], ...updates };
    this.scheduleSave();
    return this.state.users[idx];
  }
  public deleteUser(id: string): boolean {
    const initialLen = this.state.users.length;
    this.state.users = this.state.users.filter((u) => u.id !== id);
    if (this.state.users.length !== initialLen) {
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // --- Customers ---
  public getCustomers(filters?: {
    search?: string;
    center_id?: string;
    status?: string;
    session?: string;
    village?: string;
  }): Customer[] {
    let list = this.state.customers;
    if (!filters) return list;

    if (filters.center_id && filters.center_id !== 'all') {
      list = list.filter((c) => c.collection_center_id === filters.center_id);
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((c) => c.status === filters.status);
    }
    if (filters.session && filters.session !== 'all') {
      list = list.filter((c) => c.default_session === filters.session || c.default_session === 'both');
    }
    if (filters.village && filters.village !== 'all') {
      list = list.filter((c) => (c.area || c.village || '').toLowerCase() === filters.village?.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.customer_code.toLowerCase().includes(q) ||
          (c.phone || c.mobile || '').includes(q) ||
          (c.area || c.village || '').toLowerCase().includes(q)
      );
    }
    return list;
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.state.customers.find((c) => c.id === id || c.customer_code.toUpperCase() === id.toUpperCase());
  }

  public addCustomer(cust: Customer): Customer {
    this.state.customers.unshift(cust);
    // Auto-create initial opening ledger entry
    this.state.ledger_entries.push({
      id: `led_init_${cust.id}`,
      customer_id: cust.id,
      date: new Date().toISOString().split('T')[0],
      description: 'Account Created - Opening Balance',
      debit: 0,
      credit: 0,
      running_balance: 0,
      reference_type: 'opening',
      created_at: new Date().toISOString(),
    });
    this.scheduleSave();
    return cust;
  }

  public updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
    const idx = this.state.customers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.state.customers[idx] = { ...this.state.customers[idx], ...updates };
    this.scheduleSave();
    return this.state.customers[idx];
  }

  public deleteCustomer(id: string): boolean {
    const idx = this.state.customers.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.state.customers.splice(idx, 1);
    this.scheduleSave();
    return true;
  }

  // --- Milk Rates ---
  public getRates(): MilkRate[] {
    return this.state.milk_rates;
  }
  public getActiveRate(): MilkRate {
    const active = this.state.milk_rates.find((r) => r.is_active);
    if (active) return active;
    return this.state.milk_rates[0];
  }
  public addRate(rate: MilkRate): MilkRate {
    // If new rate is active, deactivate others
    if (rate.is_active) {
      this.state.milk_rates.forEach((r) => (r.is_active = false));
    }
    this.state.milk_rates.unshift(rate);
    this.scheduleSave();
    return rate;
  }
  public updateRate(id: string, updates: Partial<MilkRate>): MilkRate | null {
    const idx = this.state.milk_rates.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    if (updates.is_active) {
      this.state.milk_rates.forEach((r) => (r.is_active = false));
    }
    this.state.milk_rates[idx] = { ...this.state.milk_rates[idx], ...updates };
    this.scheduleSave();
    return this.state.milk_rates[idx];
  }

  // --- Milk Collections ---
  public getCollections(filters?: {
    date?: string;
    session?: string;
    customer_id?: string;
    center_id?: string;
    supplier_type?: string;
    payment_status?: string;
    from_date?: string;
    to_date?: string;
  }): MilkCollection[] {
    let list = this.state.milk_collections;
    if (!filters) return list;

    if (filters.center_id && filters.center_id !== 'all') {
      list = list.filter((c) => c.collection_center_id === filters.center_id);
    }
    if (filters.date) {
      list = list.filter((c) => c.date === filters.date);
    }
    if (filters.from_date) {
      list = list.filter((c) => c.date >= filters.from_date!);
    }
    if (filters.to_date) {
      list = list.filter((c) => c.date <= filters.to_date!);
    }
    if (filters.session && filters.session !== 'all') {
      list = list.filter((c) => c.session === filters.session);
    }
    if (filters.customer_id) {
      list = list.filter((c) => c.customer_id === filters.customer_id || c.supplier_id === filters.customer_id);
    }
    if (filters.supplier_type && filters.supplier_type !== 'all') {
      list = list.filter((c) => c.supplier_type === filters.supplier_type);
    }
    if (filters.payment_status && filters.payment_status !== 'all') {
      list = list.filter((c) => c.payment_status === filters.payment_status);
    }
    return list;
  }

  public addCollection(collection: MilkCollection): MilkCollection {
    this.state.milk_collections.unshift(collection);

    // Auto-create ledger entry for permanent registered customer
    if (collection.customer_id && collection.supplier_type === 'REGISTERED') {
      const custLedger = this.getLedgerByCustomerId(collection.customer_id);
      const lastBalance = custLedger.length > 0 ? custLedger[custLedger.length - 1].running_balance : 0;
      const newBalance = Number((lastBalance + collection.total_amount).toFixed(2));

      const ledgerEntry: LedgerEntry = {
        id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        customer_id: collection.customer_id,
        date: collection.date,
        description: `Milk Collection (${collection.session === 'morning' ? 'Morning' : 'Evening'} ${collection.quantity}L @ ₹${collection.calculated_rate})`,
        milk_quantity: collection.quantity,
        debit: collection.total_amount,
        credit: 0,
        running_balance: newBalance,
        reference_type: 'collection',
        reference_id: collection.id,
        created_at: new Date().toISOString(),
      };
      this.state.ledger_entries.push(ledgerEntry);
    }

    this.scheduleSave();
    return collection;
  }

  // Live single-source-of-truth calculated stats for collection centers
  public getCenterBusinessStats(centerId: string, targetDate?: string) {
    const today = targetDate || new Date().toISOString().split('T')[0];
    const currentMonth = today.slice(0, 7); // YYYY-MM

    // 1. Center's registered suppliers
    const suppliers = this.getCustomers({ center_id: centerId });
    const registeredCount = suppliers.length;

    // 2. Today's collections for this center
    const todayCols = this.state.milk_collections.filter(
      (c) => c.collection_center_id === centerId && c.date === today
    );

    // Dynamic session sums strictly from milk_collections
    const morningCols = todayCols.filter((c) => c.session === 'morning');
    const eveningCols = todayCols.filter((c) => c.session === 'evening');

    const morningMilk = Number(morningCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
    const eveningMilk = Number(eveningCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
    const todayTotalMilk = Number((morningMilk + eveningMilk).toFixed(1));
    const todayAmount = Number(todayCols.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));

    // Direct walk-in suppliers count today
    const directColsToday = todayCols.filter((c) => c.supplier_type === 'DIRECT');
    const directSuppliersToday = directColsToday.length;

    // 3. Monthly totals for this center
    const monthCols = this.state.milk_collections.filter(
      (c) => c.collection_center_id === centerId && c.date.startsWith(currentMonth)
    );
    const monthlyTotalMilk = Number(monthCols.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
    const monthlyAmount = Number(monthCols.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));

    // 4. Pending payments: total payable minus total paid for this center
    const allCenterCols = this.state.milk_collections.filter((c) => c.collection_center_id === centerId);
    const allCenterPays = this.state.payments.filter((p) => p.collection_center_id === centerId);
    const totalPayable = allCenterCols.reduce((sum, c) => sum + c.total_amount, 0);
    const totalPaid = allCenterPays.reduce((sum, p) => sum + p.amount, 0);
    const pendingPayments = Number(Math.max(0, totalPayable - totalPaid).toFixed(2));

    return {
      today_morning_milk: morningMilk,
      today_evening_milk: eveningMilk,
      today_total_milk: todayTotalMilk,
      registered_suppliers_count: registeredCount,
      today_amount: todayAmount,
      monthly_total_milk: monthlyTotalMilk,
      monthly_amount: monthlyAmount,
      pending_payments: pendingPayments,
      direct_suppliers_today: directSuppliersToday,
      today_collection_count: todayCols.length,
      morning_count: morningCols.length,
      evening_count: eveningCols.length,
    };
  }

  public updateCollection(id: string, updates: Partial<MilkCollection>): MilkCollection | null {
    const idx = this.state.milk_collections.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.state.milk_collections[idx] = { ...this.state.milk_collections[idx], ...updates };
    this.scheduleSave();
    return this.state.milk_collections[idx];
  }

  public deleteCollection(id: string): boolean {
    const idx = this.state.milk_collections.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.state.milk_collections.splice(idx, 1);
    this.scheduleSave();
    return true;
  }

  // --- Payments ---
  public getPayments(filters?: {
    customer_id?: string;
    center_id?: string;
    from_date?: string;
    to_date?: string;
    payment_method?: string;
  }): Payment[] {
    let list = this.state.payments;
    if (!filters) return list;

    if (filters.center_id && filters.center_id !== 'all') {
      list = list.filter((p) => p.collection_center_id === filters.center_id);
    }
    if (filters.customer_id) {
      list = list.filter((p) => p.customer_id === filters.customer_id);
    }
    if (filters.payment_method && filters.payment_method !== 'all') {
      list = list.filter((p) => p.payment_method === filters.payment_method);
    }
    if (filters.from_date) {
      list = list.filter((p) => p.date >= filters.from_date!);
    }
    if (filters.to_date) {
      list = list.filter((p) => p.date <= filters.to_date!);
    }
    return list;
  }

  public addPayment(payment: Payment): Payment {
    this.state.payments.unshift(payment);

    // Auto-create credit in customer ledger
    const custLedger = this.getLedgerByCustomerId(payment.customer_id);
    const lastBalance = custLedger.length > 0 ? custLedger[custLedger.length - 1].running_balance : 0;
    const newBalance = Number((lastBalance - payment.amount).toFixed(2));

    const ledgerEntry: LedgerEntry = {
      id: `led_pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customer_id: payment.customer_id,
      date: payment.date,
      description: `Payment (${payment.payment_method.toUpperCase()} ${payment.reference_no ? 'Ref: ' + payment.reference_no : ''})`,
      debit: 0,
      credit: payment.amount,
      running_balance: newBalance,
      reference_type: 'payment',
      reference_id: payment.id,
      created_at: new Date().toISOString(),
    };
    this.state.ledger_entries.push(ledgerEntry);

    this.scheduleSave();
    return payment;
  }

  // --- Settlements ---
  public getSettlements(filters?: { customer_id?: string; month_year?: string }): Settlement[] {
    let list = this.state.settlements;
    if (!filters) return list;
    if (filters.customer_id) {
      list = list.filter((s) => s.customer_id === filters.customer_id);
    }
    if (filters.month_year) {
      list = list.filter((s) => s.month_year === filters.month_year);
    }
    return list;
  }

  public addSettlement(settlement: Settlement): Settlement {
    this.state.settlements.unshift(settlement);
    // If settled_amount > 0, also record a payment and post to ledger
    if (settlement.settled_amount > 0) {
      const pay: Payment = {
        id: `pay_stl_${settlement.id}`,
        customer_id: settlement.customer_id,
        collection_center_id: settlement.collection_center_id,
        date: settlement.confirmed_at.split('T')[0],
        amount: settlement.settled_amount,
        payment_method: 'bank_transfer',
        reference_no: settlement.settlement_code,
        status: 'completed',
        notes: `Monthly Settlement for ${settlement.month_year}`,
        created_by: settlement.confirmed_by,
        created_at: settlement.confirmed_at,
      };
      this.addPayment(pay);
    }
    this.scheduleSave();
    return settlement;
  }

  // --- Ledger ---
  public getLedgerByCustomerId(customerId: string): LedgerEntry[] {
    return this.state.ledger_entries
      .filter((e) => e.customer_id === customerId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  public addLedgerEntry(entry: LedgerEntry): LedgerEntry {
    this.state.ledger_entries.push(entry);
    this.scheduleSave();
    return entry;
  }

  // --- Expenses ---
  public getExpenses(filters?: {
    center_id?: string;
    category?: string;
    from_date?: string;
    to_date?: string;
  }): Expense[] {
    let list = this.state.expenses;
    if (!filters) return list;
    if (filters.center_id && filters.center_id !== 'all') {
      list = list.filter((e) => e.collection_center_id === filters.center_id);
    }
    if (filters.category && filters.category !== 'all') {
      list = list.filter((e) => e.category === filters.category);
    }
    if (filters.from_date) {
      list = list.filter((e) => e.date >= filters.from_date!);
    }
    if (filters.to_date) {
      list = list.filter((e) => e.date <= filters.to_date!);
    }
    return list;
  }

  public addExpense(expense: Expense): Expense {
    this.state.expenses.unshift(expense);
    this.scheduleSave();
    return expense;
  }

  public deleteExpense(id: string): boolean {
    const idx = this.state.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.state.expenses.splice(idx, 1);
    this.scheduleSave();
    return true;
  }

  // --- Notifications ---
  public getNotifications(): NotificationItem[] {
    return this.state.notifications;
  }
  public markNotificationAsRead(id: string): boolean {
    const notif = this.state.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.scheduleSave();
      return true;
    }
    return false;
  }
  public markAllNotificationsAsRead(): void {
    this.state.notifications.forEach((n) => (n.read = true));
    this.scheduleSave();
  }

  // --- Settings ---
  public getSettings(): BusinessSettings {
    return this.state.settings;
  }
  public updateSettings(updates: Partial<BusinessSettings>): BusinessSettings {
    this.state.settings = { ...this.state.settings, ...updates };
    this.scheduleSave();
    return this.state.settings;
  }
}

export const store = new DataStore();
