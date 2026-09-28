import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORE_PATH = path.join(__dirname, 'local_db.json');
import {
  User,
  DBStatus,
  Customer,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerQueryParams,
  Delivery,
  DeliverySession,
  DeliveryStatus,
  SaveDeliveryDTO,
  DeliveryItemResponse,
  DeliveriesListResponse,
  Sale,
  DayWiseSaleItem,
  SalesSummary,
  SalesResponse,
  Payment,
  PaymentType,
  AdvanceLedgerEntry,
  AdvanceLedgerType,
  CreatePaymentDTO,
  CustomerAdvanceInfo,
  CustomerHistoryItem,
  CustomerMonthlySummary,
  CustomerHistoryResponse,
} from '../types/index.js';

dotenv.config();

class TiDBService {
  private pool: Pool | null = null;
  private isConnected: boolean = false;
  private connectionError: string | null = null;
  private isInitialized: boolean = false;

  // Local fallback storage for users if TiDB connection is unavailable
  private fallbackUsers: User[] = [

    {
      id: 'u_owner_001',
      email: (process.env.DEFAULT_OWNER_EMAIL || 'milkhub@admin.com').trim().toLowerCase(),
      password_hash: hashPassword(process.env.DEFAULT_OWNER_PASSWORD || 'Admin@123'),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Local fallback storage for customers (Phase 2)
  private fallbackCustomers: Customer[] = [
    {
      id: 'cust_001',
      name: 'Muthu Kumar',
      phone: '9876543210',
      address: '12 Bazaar Street',
      area: 'North Ward',
      default_morning_qty: 2.0,
      default_evening_qty: 1.5,
      rate: 58.0,
      start_date: '2026-01-10',
      status: 'active',
      created_at: '2026-01-10T06:00:00.000Z',
      updated_at: '2026-01-10T06:00:00.000Z',
    },
    {
      id: 'cust_002',
      name: 'Priya Selvam',
      phone: '9842109876',
      address: '45 Temple Road',
      area: 'East Gate',
      default_morning_qty: 1.0,
      default_evening_qty: 1.0,
      rate: 60.0,
      start_date: '2026-02-01',
      status: 'active',
      created_at: '2026-02-01T06:00:00.000Z',
      updated_at: '2026-02-01T06:00:00.000Z',
    },
    {
      id: 'cust_003',
      name: 'Rajesh Kannan',
      phone: '9789012345',
      address: '8 Gandhi Nagar',
      area: 'North Ward',
      default_morning_qty: 3.5,
      default_evening_qty: 2.0,
      rate: 56.0,
      start_date: '2026-02-15',
      status: 'active',
      created_at: '2026-02-15T06:00:00.000Z',
      updated_at: '2026-02-15T06:00:00.000Z',
    },
    {
      id: 'cust_004',
      name: 'Anitha Ramesh',
      phone: '9944123456',
      address: '21 Lake View',
      area: 'South Extension',
      default_morning_qty: 1.5,
      default_evening_qty: 0.0,
      rate: 60.0,
      start_date: '2026-03-01',
      status: 'inactive',
      created_at: '2026-03-01T06:00:00.000Z',
      updated_at: '2026-03-01T06:00:00.000Z',
    },
    {
      id: 'cust_005',
      name: 'Senthil Nathan',
      phone: '9865123987',
      address: '77 Anna Salai',
      area: 'West End',
      default_morning_qty: 2.5,
      default_evening_qty: 2.5,
      rate: 62.0,
      start_date: '2026-03-10',
      status: 'active',
      created_at: '2026-03-10T06:00:00.000Z',
      updated_at: '2026-03-10T06:00:00.000Z',
    },
  ];

  // Local fallback storage for deliveries (Phase 3)
  private fallbackDeliveries: Delivery[] = [];

  // Local fallback storage for sales (Phase 4)
  private fallbackSales: Sale[] = [];

  // Local fallback storage for payments & advance ledger (Phase 5)
  private fallbackPayments: Payment[] = [];
  private fallbackAdvanceLedger: AdvanceLedgerEntry[] = [];

  constructor() {
    this.createPool();
    this.loadFallbackData();
  }

  private loadFallbackData() {
    try {
      if (fs.existsSync(LOCAL_STORE_PATH)) {
        const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.customers) && data.customers.length > 0) {
          this.fallbackCustomers = data.customers;
        }
        if (Array.isArray(data.deliveries) && data.deliveries.length > 0) {
          this.fallbackDeliveries = data.deliveries;
        }
        if (Array.isArray(data.sales) && data.sales.length > 0) {
          this.fallbackSales = data.sales;
        }
        if (Array.isArray(data.payments) && data.payments.length > 0) {
          this.fallbackPayments = data.payments;
        }
        if (Array.isArray(data.advanceLedger) && data.advanceLedger.length > 0) {
          this.fallbackAdvanceLedger = data.advanceLedger;
        }
      }
    } catch (err: any) {
      console.warn('[TiDB] Failed to load local fallback data:', err.message);
    }
  }

  private saveFallbackData() {
    try {
      const data = {
        customers: this.fallbackCustomers,
        deliveries: this.fallbackDeliveries,
        sales: this.fallbackSales,
        payments: this.fallbackPayments,
        advanceLedger: this.fallbackAdvanceLedger,
      };
      fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[TiDB] Failed to persist local fallback data:', err.message);
    }
  }

  private createPool() {
    try {
      const host = process.env.DB_HOST || '127.0.0.1';
      const port = Number(process.env.DB_PORT) || 4000;
      const user = process.env.DB_USER || 'root';
      const password = process.env.DB_PASSWORD || '';
      const database = process.env.DB_NAME || 'milkhub';
      const useSSL = process.env.DB_SSL === 'true' || host.includes('tidbcloud.com');

      const config: PoolOptions = {
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000,
        ssl: useSSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
      };

      this.pool = mysql.createPool(config);
    } catch (err: any) {
      this.pool = null;
      this.connectionError = err.message || 'Failed to construct TiDB pool';
    }
  }

  /**
   * Initialize TiDB database:
   * 1. Ping connection
   * 2. Ensure `users` table exists and seed owner
   * 3. Ensure `customers` table exists (Phase 2) and seed initial customers
   */
  public async initDatabase(): Promise<boolean> {
    if (!this.pool) {
      this.isConnected = false;
      this.connectionError = 'TiDB connection pool not created';
      return false;
    }

    try {
      const conn = await this.pool.getConnection();
      this.isConnected = true;
      this.connectionError = null;

      // 1. Create `users` table if not exists (Phase 1)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      // 2. Check if any user exists, seed default owner if empty
      const [userRows]: [any[], any] = await conn.query('SELECT COUNT(*) as count FROM users');
      const userCount = Number(userRows[0]?.count || 0);

      if (userCount === 0) {
        const defaultEmail = (process.env.DEFAULT_OWNER_EMAIL || 'milkhub@admin.com').trim().toLowerCase();
        const defaultPassword = process.env.DEFAULT_OWNER_PASSWORD || 'Admin@123';
        const defaultHash = hashPassword(defaultPassword);

        await conn.query(
          'INSERT INTO users (id, email, password_hash, status) VALUES (?, ?, ?, ?)',
          ['u_owner_001', defaultEmail, defaultHash, 'active']
        );
        console.log(`[TiDB] Seeded initial owner (${defaultEmail}) into users table.`);
      }

      // 3. Create `customers` table if not exists (Phase 2)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          address TEXT NOT NULL,
          area VARCHAR(100) NOT NULL,
          default_morning_qty DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
          default_evening_qty DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
          rate DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
          start_date DATE NOT NULL,
          status ENUM('active', 'inactive') DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      // 4. Check if customers table is empty, seed initial customers
      const [custRows]: [any[], any] = await conn.query('SELECT COUNT(*) as count FROM customers');
      const custCount = Number(custRows[0]?.count || 0);

      if (custCount === 0) {
        for (const c of this.fallbackCustomers) {
          await conn.query(
            `INSERT INTO customers (id, name, phone, address, area, default_morning_qty, default_evening_qty, rate, start_date, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              c.id,
              c.name,
              c.phone,
              c.address,
              c.area,
              c.default_morning_qty,
              c.default_evening_qty,
              c.rate,
              c.start_date,
              c.status,
            ]
          );
        }
        console.log(`[TiDB] Seeded ${this.fallbackCustomers.length} initial customers into customers table.`);
      }

      // 5. Create `deliveries` table if not exists (Phase 3)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          session ENUM('morning', 'evening') NOT NULL,
          actual_qty DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
          status ENUM('delivered', 'no_milk') NOT NULL DEFAULT 'delivered',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_customer_date_session (customer_id, date, session),
          INDEX idx_date_session (date, session),
          INDEX idx_customer (customer_id)
        );
      `);

      // 6. Create `sales` table if not exists (Phase 4)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS sales (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          morning_qty DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
          evening_qty DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
          total_litres DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
          rate DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
          sale_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_customer_date_sales (customer_id, date),
          INDEX idx_sales_date (date),
          INDEX idx_sales_customer (customer_id)
        );
      `);

      // 7. Create `payments` table if not exists (Phase 5)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          payment_type ENUM('daily', 'advance') NOT NULL,
          payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_payments_customer (customer_id),
          INDEX idx_payments_date (date),
          INDEX idx_payments_type (payment_type)
        );
      `);

      // 8. Create `advance_ledger` table if not exists (Phase 5)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS advance_ledger (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          type ENUM('credit', 'adjustment') NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          reference_id VARCHAR(64) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_advance_customer (customer_id),
          INDEX idx_advance_date (date),
          INDEX idx_advance_type (type),
          INDEX idx_advance_ref (reference_id)
        );
      `);

      conn.release();
      this.isInitialized = true;
      console.log('[TiDB] Database connection verified, all tables (users, customers, deliveries, sales, payments, advance_ledger) ready.');
      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || 'Connection failed';
      console.warn(`[TiDB] Connection notice: ${this.connectionError}. Using local fallback mode.`);
      return false;
    }
  }

  /**
   * Find a user by email
   */
  public async findUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (this.isConnected && this.pool) {
      try {
        const [rows]: [any[], any] = await this.pool.query(
          'SELECT id, email, password_hash, status, created_at, updated_at FROM users WHERE LOWER(email) = ? LIMIT 1',
          [cleanEmail]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            email: r.email,
            password_hash: r.password_hash,
            status: r.status,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
            updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
          };
        }
        return null;
      } catch (err: any) {
        console.error('[TiDB] findUserByEmail query error:', err.message);
      }
    }

    const found = this.fallbackUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    return found || null;
  }

  /**
   * Find a user by ID
   */
  public async findUserById(id: string): Promise<User | null> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: [any[], any] = await this.pool.query(
          'SELECT id, email, password_hash, status, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
          [id]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            email: r.email,
            password_hash: r.password_hash,
            status: r.status,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
            updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
          };
        }
        return null;
      } catch (err: any) {
        console.error('[TiDB] findUserById query error:', err.message);
      }
    }

    const found = this.fallbackUsers.find((u) => u.id === id);
    return found || null;
  }

  // ==========================================
  // PHASE 2: CUSTOMER CRUD OPERATIONS
  // ==========================================

  /**
   * List customers with search (name, phone, area) and status filter (active, inactive)
   */
  public async getCustomers(query?: CustomerQueryParams): Promise<Customer[]> {
    const search = query?.search?.trim();
    const status = query?.status;

    if (this.isConnected && this.pool) {
      try {
        let sql = 'SELECT * FROM customers WHERE 1=1';
        const params: any[] = [];

        if (status && (status === 'active' || status === 'inactive')) {
          sql += ' AND status = ?';
          params.push(status);
        }

        if (search) {
          sql += ' AND (name LIKE ? OR phone LIKE ? OR area LIKE ?)';
          const searchPattern = `%${search}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }

        sql += ' ORDER BY created_at DESC, name ASC';

        const [rows]: [any[], any] = await this.pool.query(sql, params);
        return rows.map((r) => this.mapRowToCustomer(r));
      } catch (err: any) {
        console.error('[TiDB] getCustomers error:', err.message);
      }
    }

    // Fallback in-memory search & filter
    let result = [...this.fallbackCustomers];

    if (status && (status === 'active' || status === 'inactive')) {
      result = result.filter((c) => c.status === status);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.area.toLowerCase().includes(q)
      );
    }

    return result;
  }

  /**
   * Get single customer by ID
   */
  public async getCustomerById(id: string): Promise<Customer | null> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: [any[], any] = await this.pool.query(
          'SELECT * FROM customers WHERE id = ? LIMIT 1',
          [id]
        );
        if (rows && rows.length > 0) {
          return this.mapRowToCustomer(rows[0]);
        }
        return null;
      } catch (err: any) {
        console.error('[TiDB] getCustomerById error:', err.message);
      }
    }

    const found = this.fallbackCustomers.find((c) => c.id === id);
    return found || null;
  }

  /**
   * Create a new customer
   */
  public async createCustomer(data: CreateCustomerDTO): Promise<Customer> {
    const id = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const newCustomer: Customer = {
      id,
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      area: data.area.trim(),
      default_morning_qty: Number(data.default_morning_qty) || 0,
      default_evening_qty: Number(data.default_evening_qty) || 0,
      rate: Number(data.rate) || 0,
      start_date: data.start_date,
      status: data.status || 'active',
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO customers (id, name, phone, address, area, default_morning_qty, default_evening_qty, rate, start_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCustomer.id,
            newCustomer.name,
            newCustomer.phone,
            newCustomer.address,
            newCustomer.area,
            newCustomer.default_morning_qty,
            newCustomer.default_evening_qty,
            newCustomer.rate,
            newCustomer.start_date,
            newCustomer.status,
          ]
        );
        return newCustomer;
      } catch (err: any) {
        console.error('[TiDB] createCustomer error:', err.message);
      }
    }

    this.fallbackCustomers.unshift(newCustomer);
    this.saveFallbackData();
    return newCustomer;
  }

  /**
   * Update an existing customer
   */
  public async updateCustomer(id: string, data: UpdateCustomerDTO): Promise<Customer | null> {
    const existing = await this.getCustomerById(id);
    if (!existing) return null;

    const updated: Customer = {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      phone: data.phone !== undefined ? data.phone.trim() : existing.phone,
      address: data.address !== undefined ? data.address.trim() : existing.address,
      area: data.area !== undefined ? data.area.trim() : existing.area,
      default_morning_qty:
        data.default_morning_qty !== undefined
          ? Number(data.default_morning_qty)
          : existing.default_morning_qty,
      default_evening_qty:
        data.default_evening_qty !== undefined
          ? Number(data.default_evening_qty)
          : existing.default_evening_qty,
      rate: data.rate !== undefined ? Number(data.rate) : existing.rate,
      start_date: data.start_date !== undefined ? data.start_date : existing.start_date,
      status: data.status !== undefined ? data.status : existing.status,
      updated_at: new Date().toISOString(),
    };

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `UPDATE customers
           SET name = ?, phone = ?, address = ?, area = ?, default_morning_qty = ?, default_evening_qty = ?, rate = ?, start_date = ?, status = ?
           WHERE id = ?`,
          [
            updated.name,
            updated.phone,
            updated.address,
            updated.area,
            updated.default_morning_qty,
            updated.default_evening_qty,
            updated.rate,
            updated.start_date,
            updated.status,
            id,
          ]
        );
        return updated;
      } catch (err: any) {
        console.error('[TiDB] updateCustomer error:', err.message);
      }
    }

    const idx = this.fallbackCustomers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      this.fallbackCustomers[idx] = updated;
    } else {
      this.fallbackCustomers.unshift(updated);
    }
    this.saveFallbackData();
    return updated;
  }

  private mapRowToCustomer(r: any): Customer {
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      address: r.address,
      area: r.area,
      default_morning_qty: parseFloat(r.default_morning_qty) || 0,
      default_evening_qty: parseFloat(r.default_evening_qty) || 0,
      rate: parseFloat(r.rate) || 0,
      start_date: r.start_date instanceof Date ? r.start_date.toISOString().split('T')[0] : String(r.start_date),
      status: r.status,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    };
  }

  // ==========================================
  // PHASE 3: DELIVERY WORKFLOW (MORNING & EVENING)
  // ==========================================

  /**
   * Get deliveries for a date and session (morning/evening)
   * 1. Loads active customers
   * 2. Pre-fills default quantity (morning or evening)
   * 3. Merges saved deliveries for that date/session if any
   * 4. Calculates session summary
   */
  public async getDeliveriesForSession(
    date: string,
    rawSession: string
  ): Promise<DeliveriesListResponse> {
    const session: DeliverySession = rawSession.toLowerCase().includes('eve')
      ? 'evening'
      : 'morning';

    // 1. Get all active customers
    const activeCustomers = await this.getCustomers({ status: 'active' });

    // 2. Query saved delivery records for date + session
    let savedRecords: Delivery[] = [];
    if (this.isConnected && this.pool) {
      try {
        const [rows]: [any[], any] = await this.pool.query(
          'SELECT * FROM deliveries WHERE date = ? AND LOWER(session) = ?',
          [date, session]
        );
        savedRecords = rows.map((r) => this.mapRowToDelivery(r));
      } catch (err: any) {
        console.error('[TiDB] getDeliveries query error:', err.message);
        savedRecords = this.fallbackDeliveries.filter(
          (d) => d.date === date && d.session === session
        );
      }
    } else {
      savedRecords = this.fallbackDeliveries.filter(
        (d) => d.date === date && d.session === session
      );
    }

    // 3. Map active customers with default or saved actual qty
    let totalQty = 0;
    let deliveredCount = 0;
    let noMilkCount = 0;

    const deliveries: DeliveryItemResponse[] = activeCustomers.map((cust) => {
      const defaultQty =
        session === 'morning'
          ? Number(cust.default_morning_qty) || 0
          : Number(cust.default_evening_qty) || 0;

      const existingRecord = savedRecords.find((r) => r.customer_id === cust.id);

      let actualQty: number;
      let status: DeliveryStatus;
      let isSaved = false;
      let deliveryId: string | undefined = undefined;

      if (existingRecord) {
        actualQty = Number(existingRecord.actual_qty) || 0;
        status = existingRecord.status;
        isSaved = true;
        deliveryId = existingRecord.id;
      } else {
        actualQty = defaultQty;
        status = defaultQty > 0 ? 'delivered' : 'no_milk';
        isSaved = false;
      }

      totalQty += actualQty;
      if (status === 'delivered') deliveredCount++;
      else noMilkCount++;

      return {
        id: deliveryId,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        customer_area: cust.area,
        customer_address: cust.address,
        date,
        session,
        default_qty: defaultQty,
        actual_qty: actualQty,
        status,
        is_saved: isSaved,
        rate: Number(cust.rate) || 0,
        created_at: existingRecord?.created_at,
        updated_at: existingRecord?.updated_at,
      };
    });

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
  }

  /**
   * Save a single delivery record (Upsert: update if exists, insert if new)
   * IMPORTANT BUSINESS RULE:
   * Customer default quantity must NEVER be changed when today's actual quantity is edited.
   */
  public async saveDelivery(dto: SaveDeliveryDTO): Promise<Delivery> {
    const session: DeliverySession = dto.session.toLowerCase().includes('eve')
      ? 'evening'
      : 'morning';

    const rawStatus = dto.status.toLowerCase();
    const status: DeliveryStatus =
      rawStatus.includes('no') || rawStatus === 'no_milk' ? 'no_milk' : 'delivered';

    // 0L must be supported. If status is no_milk, actual_qty is 0
    let actualQty = Number(dto.actual_qty);
    if (isNaN(actualQty) || actualQty < 0 || status === 'no_milk') {
      actualQty = 0;
    }

    const nowIso = new Date().toISOString();
    let resultDelivery: Delivery;

    if (this.isConnected && this.pool) {
      try {
        // Check if existing record for customer + date + session
        const [rows]: [any[], any] = await this.pool.query(
          'SELECT id FROM deliveries WHERE customer_id = ? AND date = ? AND session = ? LIMIT 1',
          [dto.customer_id, dto.date, session]
        );

        if (rows && rows.length > 0) {
          const id = rows[0].id;
          await this.pool.query(
            'UPDATE deliveries SET actual_qty = ?, status = ? WHERE id = ?',
            [actualQty, status, id]
          );
          resultDelivery = {
            id,
            customer_id: dto.customer_id,
            date: dto.date,
            session,
            actual_qty: actualQty,
            status,
            updated_at: nowIso,
          };
        } else {
          const id = `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await this.pool.query(
            'INSERT INTO deliveries (id, customer_id, date, session, actual_qty, status) VALUES (?, ?, ?, ?, ?, ?)',
            [id, dto.customer_id, dto.date, session, actualQty, status]
          );
          resultDelivery = {
            id,
            customer_id: dto.customer_id,
            date: dto.date,
            session,
            actual_qty: actualQty,
            status,
            created_at: nowIso,
            updated_at: nowIso,
          };
        }

        // Automatic sales calculation trigger
        await this.syncCustomerSaleForDate(dto.customer_id, dto.date);
        return resultDelivery;
      } catch (err: any) {
        console.error('[TiDB] saveDelivery error:', err.message);
      }
    }

    // Fallback store
    const existingIdx = this.fallbackDeliveries.findIndex(
      (d) => d.customer_id === dto.customer_id && d.date === dto.date && d.session === session
    );

    if (existingIdx !== -1) {
      const existing = this.fallbackDeliveries[existingIdx];
      const updated: Delivery = {
        ...existing,
        actual_qty: actualQty,
        status,
        updated_at: nowIso,
      };
      this.fallbackDeliveries[existingIdx] = updated;
      resultDelivery = updated;
    } else {
      const id = `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newDelivery: Delivery = {
        id,
        customer_id: dto.customer_id,
        date: dto.date,
        session,
        actual_qty: actualQty,
        status,
        created_at: nowIso,
        updated_at: nowIso,
      };
      this.fallbackDeliveries.push(newDelivery);
      resultDelivery = newDelivery;
    }

    // Automatic sales calculation trigger in fallback
    await this.syncCustomerSaleForDate(dto.customer_id, dto.date);
    return resultDelivery;
  }

  /**
   * Bulk save deliveries
   */
  public async saveDeliveriesBulk(dtos: SaveDeliveryDTO[]): Promise<Delivery[]> {
    const results: Delivery[] = [];
    for (const d of dtos) {
      const saved = await this.saveDelivery(d);
      results.push(saved);
    }
    return results;
  }

  private mapRowToDelivery(r: any): Delivery {
    const rawSession = String(r.session).toLowerCase();
    const session: DeliverySession = rawSession.includes('eve') ? 'evening' : 'morning';

    const rawStatus = String(r.status).toLowerCase();
    const status: DeliveryStatus = rawStatus.includes('no') ? 'no_milk' : 'delivered';

    return {
      id: r.id,
      customer_id: r.customer_id,
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      session,
      actual_qty: parseFloat(r.actual_qty) || 0,
      status,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    };
  }

  // ==========================================
  // PHASE 4: AUTOMATIC SALES CALCULATION
  // ==========================================

  /**
   * Automatically compute and synchronize daily sale for a customer on a given date.
   * Business calculation:
   *   Morning Actual Qty + Evening Actual Qty = Total Litres
   *   Total Litres × Milk Rate/Litre = Daily Sale
   * Strict fields: id, customer_id, date, morning_qty, evening_qty, total_litres, rate, sale_amount
   */
  public async syncCustomerSaleForDate(customerId: string, date: string): Promise<Sale> {
    const customer = await this.getCustomerById(customerId);
    const rate = customer ? Number(customer.rate) || 0 : 0;
    const defaultMorning = customer ? Number(customer.default_morning_qty) || 0 : 0;
    const defaultEvening = customer ? Number(customer.default_evening_qty) || 0 : 0;

    let morningQty = defaultMorning;
    let eveningQty = defaultEvening;

    if (this.isConnected && this.pool) {
      try {
        const [rows]: [any[], any] = await this.pool.query(
          'SELECT session, actual_qty, status FROM deliveries WHERE customer_id = ? AND date = ?',
          [customerId, date]
        );
        for (const row of rows) {
          const sess = String(row.session).toLowerCase();
          const stat = String(row.status).toLowerCase();
          const qty = stat.includes('no') ? 0 : parseFloat(row.actual_qty) || 0;
          if (sess.includes('morn')) {
            morningQty = qty;
          } else if (sess.includes('eve')) {
            eveningQty = qty;
          }
        }
      } catch (err: any) {
        console.error('[TiDB] syncCustomerSale query deliveries error:', err.message);
      }
    } else {
      const records = this.fallbackDeliveries.filter(
        (d) => d.customer_id === customerId && d.date === date
      );
      for (const rec of records) {
        const qty = rec.status === 'no_milk' ? 0 : Number(rec.actual_qty) || 0;
        if (rec.session === 'morning') morningQty = qty;
        if (rec.session === 'evening') eveningQty = qty;
      }
    }

    const totalLitres = Math.round((morningQty + eveningQty) * 100) / 100;
    const saleAmount = Math.round(totalLitres * rate * 100) / 100;
    const nowIso = new Date().toISOString();

    if (this.isConnected && this.pool) {
      try {
        const [existing]: [any[], any] = await this.pool.query(
          'SELECT id FROM sales WHERE customer_id = ? AND date = ? LIMIT 1',
          [customerId, date]
        );

        if (existing && existing.length > 0) {
          const id = existing[0].id;
          await this.pool.query(
            `UPDATE sales
             SET morning_qty = ?, evening_qty = ?, total_litres = ?, rate = ?, sale_amount = ?
             WHERE id = ?`,
            [morningQty, eveningQty, totalLitres, rate, saleAmount, id]
          );
          return {
            id,
            customer_id: customerId,
            date,
            morning_qty: morningQty,
            evening_qty: eveningQty,
            total_litres: totalLitres,
            rate,
            sale_amount: saleAmount,
            updated_at: nowIso,
          };
        } else {
          const id = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await this.pool.query(
            `INSERT INTO sales (id, customer_id, date, morning_qty, evening_qty, total_litres, rate, sale_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, customerId, date, morningQty, eveningQty, totalLitres, rate, saleAmount]
          );
          return {
            id,
            customer_id: customerId,
            date,
            morning_qty: morningQty,
            evening_qty: eveningQty,
            total_litres: totalLitres,
            rate,
            sale_amount: saleAmount,
            created_at: nowIso,
            updated_at: nowIso,
          };
        }
      } catch (err: any) {
        console.error('[TiDB] syncCustomerSale error:', err.message);
      }
    }

    if (this.isConnected && this.pool) {
      try {
        const [existing]: [any[], any] = await this.pool.query(
          'SELECT id FROM sales WHERE customer_id = ? AND date = ? LIMIT 1',
          [customerId, date]
        );

        if (existing && existing.length > 0) {
          const id = existing[0].id;
          await this.pool.query(
            `UPDATE sales
             SET morning_qty = ?, evening_qty = ?, total_litres = ?, rate = ?, sale_amount = ?
             WHERE id = ?`,
            [morningQty, eveningQty, totalLitres, rate, saleAmount, id]
          );
          await this.processAdvanceAdjustments(customerId);
          return {
            id,
            customer_id: customerId,
            date,
            morning_qty: morningQty,
            evening_qty: eveningQty,
            total_litres: totalLitres,
            rate,
            sale_amount: saleAmount,
            updated_at: nowIso,
          };
        } else {
          const id = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await this.pool.query(
            `INSERT INTO sales (id, customer_id, date, morning_qty, evening_qty, total_litres, rate, sale_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, customerId, date, morningQty, eveningQty, totalLitres, rate, saleAmount]
          );
          await this.processAdvanceAdjustments(customerId);
          return {
            id,
            customer_id: customerId,
            date,
            morning_qty: morningQty,
            evening_qty: eveningQty,
            total_litres: totalLitres,
            rate,
            sale_amount: saleAmount,
            created_at: nowIso,
            updated_at: nowIso,
          };
        }
      } catch (err: any) {
        console.error('[TiDB] syncCustomerSale error:', err.message);
      }
    }

    // Fallback store
    const existingIdx = this.fallbackSales.findIndex(
      (s) => s.customer_id === customerId && s.date === date
    );

    if (existingIdx !== -1) {
      const existing = this.fallbackSales[existingIdx];
      const updated: Sale = {
        ...existing,
        morning_qty: morningQty,
        evening_qty: eveningQty,
        total_litres: totalLitres,
        rate,
        sale_amount: saleAmount,
        updated_at: nowIso,
      };
      this.fallbackSales[existingIdx] = updated;
      await this.processAdvanceAdjustments(customerId);
      return updated;
    } else {
      const id = `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newSale: Sale = {
        id,
        customer_id: customerId,
        date,
        morning_qty: morningQty,
        evening_qty: eveningQty,
        total_litres: totalLitres,
        rate,
        sale_amount: saleAmount,
        created_at: nowIso,
        updated_at: nowIso,
      };
      this.fallbackSales.push(newSale);
      await this.processAdvanceAdjustments(customerId);
      return newSale;
    }
  }

  /**
   * Phase 5: Automatic Advance Adjustment
   * Allocates available advance credits in chronological order across the customer's sales.
   * Owner does NOT manually subtract advance. Backend automatically calculates the adjustment.
   * Traceable entries are preserved in `advance_ledger`.
   */
  public async processAdvanceAdjustments(customerId: string): Promise<void> {
    if (this.isConnected && this.pool) {
      try {
        // 1. Get total advance credits
        const [creditRows]: [any[], any] = await this.pool.query(
          `SELECT COALESCE(SUM(amount), 0) as total FROM advance_ledger WHERE customer_id = ? AND type = 'credit'`,
          [customerId]
        );
        let availableAdvance = Number(creditRows[0]?.total || 0);

        // 2. Get customer's sales sorted by date ASC, created_at ASC
        const [salesRows]: [any[], any] = await this.pool.query(
          `SELECT id, date, sale_amount FROM sales WHERE customer_id = ? ORDER BY date ASC, created_at ASC`,
          [customerId]
        );

        for (const s of salesRows) {
          const needed = Number(s.sale_amount) || 0;
          const toAdjust = Math.min(needed, availableAdvance);
          availableAdvance = Math.round((availableAdvance - toAdjust) * 100) / 100;

          // Check if adjustment entry exists for this sale
          const [adjRows]: [any[], any] = await this.pool.query(
            `SELECT id FROM advance_ledger WHERE customer_id = ? AND type = 'adjustment' AND reference_id = ? LIMIT 1`,
            [customerId, s.id]
          );

          if (toAdjust > 0) {
            const saleDate = typeof s.date === 'string' ? s.date.split('T')[0] : new Date(s.date).toISOString().split('T')[0];
            if (adjRows && adjRows.length > 0) {
              await this.pool.query(
                `UPDATE advance_ledger SET amount = ?, date = ? WHERE id = ?`,
                [toAdjust, saleDate, adjRows[0].id]
              );
            } else {
              const adjId = `adv_adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              await this.pool.query(
                `INSERT INTO advance_ledger (id, customer_id, date, type, amount, reference_id) VALUES (?, ?, ?, 'adjustment', ?, ?)`,
                [adjId, customerId, saleDate, toAdjust, s.id]
              );
            }
          } else {
            if (adjRows && adjRows.length > 0) {
              await this.pool.query(`DELETE FROM advance_ledger WHERE id = ?`, [adjRows[0].id]);
            }
          }
        }
        return;
      } catch (err: any) {
        console.error('[TiDB] processAdvanceAdjustments error:', err.message);
      }
    }

    // Local Fallback Mode
    const credits = this.fallbackAdvanceLedger.filter(
      (a) => a.customer_id === customerId && a.type === 'credit'
    );
    let availableAdvance = credits.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    const custSales = this.fallbackSales
      .filter((s) => s.customer_id === customerId)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Clear old adjustments for this customer and rebuild deterministically
    this.fallbackAdvanceLedger = this.fallbackAdvanceLedger.filter(
      (a) => !(a.customer_id === customerId && a.type === 'adjustment')
    );

    for (const s of custSales) {
      const needed = Number(s.sale_amount) || 0;
      const toAdjust = Math.round(Math.min(needed, availableAdvance) * 100) / 100;
      availableAdvance = Math.round((availableAdvance - toAdjust) * 100) / 100;

      if (toAdjust > 0) {
        const adjId = `adv_adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.fallbackAdvanceLedger.push({
          id: adjId,
          customer_id: customerId,
          date: s.date,
          type: 'adjustment',
          amount: toAdjust,
          reference_id: s.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Phase 5: Record a Payment (Daily sale payment or advance deposit)
   * POST /api/payments
   * Strict fields: id, customer_id, date, amount, payment_type, payment_mode
   */
  public async recordPayment(
    data: CreatePaymentDTO
  ): Promise<{ payment: Payment; advance_balance: number }> {
    const customer = await this.getCustomerById(data.customer_id);
    if (!customer) {
      throw new Error(`Customer with ID ${data.customer_id} does not exist`);
    }

    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (data.payment_type !== 'daily' && data.payment_type !== 'advance') {
      throw new Error("Payment type must be either 'daily' or 'advance'");
    }

    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const paymentMode = data.payment_mode?.trim() || 'cash';
    const nowIso = new Date().toISOString();

    const payment: Payment = {
      id: paymentId,
      customer_id: data.customer_id,
      date: data.date,
      amount: Math.round(amount * 100) / 100,
      payment_type: data.payment_type,
      payment_mode: paymentMode,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO payments (id, customer_id, date, amount, payment_type, payment_mode)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [paymentId, data.customer_id, data.date, payment.amount, data.payment_type, paymentMode]
        );

        if (data.payment_type === 'advance') {
          const advLedgerId = `adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await this.pool.query(
            `INSERT INTO advance_ledger (id, customer_id, date, type, amount, reference_id)
             VALUES (?, ?, ?, 'credit', ?, ?)`,
            [advLedgerId, data.customer_id, data.date, payment.amount, paymentId]
          );
        }
      } catch (err: any) {
        console.error('[TiDB] recordPayment error:', err.message);
      }
    } else {
      this.fallbackPayments.push(payment);
      if (data.payment_type === 'advance') {
        const advLedgerId = `adv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.fallbackAdvanceLedger.push({
          id: advLedgerId,
          customer_id: data.customer_id,
          date: data.date,
          type: 'credit',
          amount: payment.amount,
          reference_id: paymentId,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    // Automatically recalculate advance adjustments against customer sales
    await this.processAdvanceAdjustments(data.customer_id);

    const advInfo = await this.getCustomerAdvance(data.customer_id);
    return {
      payment,
      advance_balance: advInfo.advance_balance,
    };
  }

  /**
   * Phase 5: Get customer advance balance and traceable advance ledger
   * GET /api/customers/:id/advance
   */
  public async getCustomerAdvance(customerId: string): Promise<CustomerAdvanceInfo> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} does not exist`);
    }

    // Ensure adjustments are synchronized
    await this.processAdvanceAdjustments(customerId);

    let ledger: AdvanceLedgerEntry[] = [];
    if (this.isConnected && this.pool) {
      try {
        const [rows]: [any[], any] = await this.pool.query(
          `SELECT id, customer_id, date, type, amount, reference_id, created_at, updated_at
           FROM advance_ledger
           WHERE customer_id = ?
           ORDER BY date ASC, created_at ASC`,
          [customerId]
        );
        ledger = rows.map((r) => ({
          id: r.id,
          customer_id: r.customer_id,
          date: typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0],
          type: r.type,
          amount: Number(r.amount) || 0,
          reference_id: r.reference_id,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        }));
      } catch (err: any) {
        console.error('[TiDB] getCustomerAdvance error:', err.message);
      }
    } else {
      ledger = this.fallbackAdvanceLedger
        .filter((a) => a.customer_id === customerId)
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    const totalCredited = ledger
      .filter((a) => a.type === 'credit')
      .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
    const totalUsed = ledger
      .filter((a) => a.type === 'adjustment')
      .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
    const balance = Math.max(0, Math.round((totalCredited - totalUsed) * 100) / 100);

    return {
      customer_id: customer.id,
      customer_name: customer.name,
      advance_balance: balance,
      total_advance_credited: Math.round(totalCredited * 100) / 100,
      total_advance_used: Math.round(totalUsed * 100) / 100,
      ledger,
    };
  }

  /**
   * Phase 5: Get payments list with optional customer_id, date, payment_type filters
   */
  public async getPayments(filters?: {
    customer_id?: string;
    date?: string;
    payment_type?: PaymentType;
  }): Promise<Payment[]> {
    if (this.isConnected && this.pool) {
      try {
        let query =
          'SELECT id, customer_id, date, amount, payment_type, payment_mode, created_at, updated_at FROM payments WHERE 1=1';
        const params: any[] = [];

        if (filters?.customer_id) {
          query += ' AND customer_id = ?';
          params.push(filters.customer_id);
        }
        if (filters?.date) {
          query += ' AND date = ?';
          params.push(filters.date);
        }
        if (filters?.payment_type) {
          query += ' AND payment_type = ?';
          params.push(filters.payment_type);
        }

        query += ' ORDER BY created_at DESC';
        const [rows]: [any[], any] = await this.pool.query(query, params);
        return rows.map((r) => ({
          id: r.id,
          customer_id: r.customer_id,
          date: typeof r.date === 'string' ? r.date.split('T')[0] : new Date(r.date).toISOString().split('T')[0],
          amount: Number(r.amount) || 0,
          payment_type: r.payment_type,
          payment_mode: r.payment_mode,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        }));
      } catch (err: any) {
        console.error('[TiDB] getPayments error:', err.message);
      }
    }

    let results = [...this.fallbackPayments];
    if (filters?.customer_id) {
      results = results.filter((p) => p.customer_id === filters.customer_id);
    }
    if (filters?.date) {
      results = results.filter((p) => p.date === filters.date);
    }
    if (filters?.payment_type) {
      results = results.filter((p) => p.payment_type === filters.payment_type);
    }
    return results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }

  /**
   * Phase 6: Customer History & Monthly Summary
   * GET /api/customers/:id/history
   * Customer History must show:
   * - Date, Morning, Evening, Total, Sale, Advance Used, Paid, Due
   * Customer Monthly Summary:
   * - Total Milk, Total Sales, Total Paid, Total Due, Advance Balance
   */
  public async getCustomerHistory(
    customerId: string,
    month?: string
  ): Promise<CustomerHistoryResponse> {
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      throw new Error(`Customer with ID ${customerId} does not exist`);
    }

    // Ensure all advance adjustments are up to date
    await this.processAdvanceAdjustments(customerId);

    const targetMonth = month || new Date().toISOString().substring(0, 7);

    // Collect all dates with activity for this customer
    const dateSet = new Set<string>();

    if (this.isConnected && this.pool) {
      try {
        const [delDates]: [any[], any] = await this.pool.query(
          `SELECT DISTINCT date FROM deliveries WHERE customer_id = ?`,
          [customerId]
        );
        for (const r of delDates) {
          const dStr =
            typeof r.date === 'string'
              ? r.date.split('T')[0]
              : new Date(r.date).toISOString().split('T')[0];
          dateSet.add(dStr);
        }

        const [saleDates]: [any[], any] = await this.pool.query(
          `SELECT DISTINCT date FROM sales WHERE customer_id = ?`,
          [customerId]
        );
        for (const r of saleDates) {
          const dStr =
            typeof r.date === 'string'
              ? r.date.split('T')[0]
              : new Date(r.date).toISOString().split('T')[0];
          dateSet.add(dStr);
        }

        const [payDates]: [any[], any] = await this.pool.query(
          `SELECT DISTINCT date FROM payments WHERE customer_id = ?`,
          [customerId]
        );
        for (const r of payDates) {
          const dStr =
            typeof r.date === 'string'
              ? r.date.split('T')[0]
              : new Date(r.date).toISOString().split('T')[0];
          dateSet.add(dStr);
        }
      } catch (err: any) {
        console.error('[TiDB] getCustomerHistory dates query error:', err.message);
      }
    } else {
      this.fallbackDeliveries
        .filter((d) => d.customer_id === customerId)
        .forEach((d) => dateSet.add(d.date));

      this.fallbackSales
        .filter((s) => s.customer_id === customerId)
        .forEach((s) => dateSet.add(s.date));

      this.fallbackPayments
        .filter((p) => p.customer_id === customerId)
        .forEach((p) => dateSet.add(p.date));
    }

    // Sort dates in descending order (most recent first)
    const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    const items: CustomerHistoryItem[] = [];

    for (const date of sortedDates) {
      const sale = await this.syncCustomerSaleForDate(customerId, date);

      let advanceUsed = 0;
      let paid = 0;

      if (this.isConnected && this.pool) {
        try {
          const [advRows]: [any[], any] = await this.pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM advance_ledger WHERE customer_id = ? AND date = ? AND type = 'adjustment'`,
            [customerId, date]
          );
          advanceUsed = Number(advRows[0]?.total || 0);

          const [payRows]: [any[], any] = await this.pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE customer_id = ? AND date = ? AND payment_type = 'daily'`,
            [customerId, date]
          );
          paid = Number(payRows[0]?.total || 0);
        } catch (err: any) {
          console.error('[TiDB] getCustomerHistory query error:', err.message);
        }
      } else {
        advanceUsed = this.fallbackAdvanceLedger
          .filter((a) => a.customer_id === customerId && a.date === date && a.type === 'adjustment')
          .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

        paid = this.fallbackPayments
          .filter((p) => p.customer_id === customerId && p.date === date && p.payment_type === 'daily')
          .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      }

      advanceUsed = Math.round(advanceUsed * 100) / 100;
      paid = Math.round(paid * 100) / 100;
      const due = Math.max(0, Math.round((sale.sale_amount - advanceUsed - paid) * 100) / 100);

      items.push({
        date,
        morning: sale.morning_qty,
        evening: sale.evening_qty,
        total: sale.total_litres,
        rate: sale.rate,
        sale: sale.sale_amount,
        advance_used: advanceUsed,
        paid,
        due,
      });
    }

    // Monthly summary calculation
    const monthItems = items.filter((item) => item.date.startsWith(targetMonth));
    const totalMilk = monthItems.reduce((acc, it) => acc + it.total, 0);
    const totalSales = monthItems.reduce((acc, it) => acc + it.sale, 0);
    const totalPaid = monthItems.reduce((acc, it) => acc + it.paid, 0);
    const totalDue = monthItems.reduce((acc, it) => acc + it.due, 0);

    const advanceInfo = await this.getCustomerAdvance(customerId);

    return {
      customer,
      items,
      monthly_summary: {
        month: targetMonth,
        total_milk: Math.round(totalMilk * 100) / 100,
        total_sales: Math.round(totalSales * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        total_due: Math.round(totalDue * 100) / 100,
        advance_balance: advanceInfo.advance_balance,
      },
    };
  }

  /**
   * Day-wise sales display
   * Columns: Date, Customer, Morning, Evening, Total, Rate, Sale, Advance Used, Paid, Due
   * Due amount formula: Due = Daily Sale - (Advance Used + Paid)
   */
  public async getDayWiseSales(date: string, customerId?: string): Promise<SalesResponse> {
    let customers = await this.getCustomers({ status: 'active' });
    if (customerId) {
      customers = customers.filter((c) => c.id === customerId);
    }

    const sales: DayWiseSaleItem[] = [];
    let totalMorning = 0;
    let totalEvening = 0;
    let totalLitresAll = 0;
    let totalSalesAll = 0;
    let totalAdvanceUsedAll = 0;
    let totalPaidAll = 0;
    let totalDueAll = 0;

    for (const cust of customers) {
      const sale = await this.syncCustomerSaleForDate(cust.id, date);

      // Phase 5: Query real advance used and daily payments for this customer on this date
      let advanceUsed = 0;
      let paid = 0;

      if (this.isConnected && this.pool) {
        try {
          const [advRows]: [any[], any] = await this.pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM advance_ledger WHERE customer_id = ? AND date = ? AND type = 'adjustment'`,
            [cust.id, date]
          );
          advanceUsed = Number(advRows[0]?.total || 0);

          const [payRows]: [any[], any] = await this.pool.query(
            `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE customer_id = ? AND date = ? AND payment_type = 'daily'`,
            [cust.id, date]
          );
          paid = Number(payRows[0]?.total || 0);
        } catch (err: any) {
          console.error('[TiDB] getDayWiseSales payments query error:', err.message);
        }
      } else {
        advanceUsed = this.fallbackAdvanceLedger
          .filter((a) => a.customer_id === cust.id && a.date === date && a.type === 'adjustment')
          .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

        paid = this.fallbackPayments
          .filter((p) => p.customer_id === cust.id && p.date === date && p.payment_type === 'daily')
          .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      }

      advanceUsed = Math.round(advanceUsed * 100) / 100;
      paid = Math.round(paid * 100) / 100;
      const due = Math.max(0, Math.round((sale.sale_amount - advanceUsed - paid) * 100) / 100);

      totalMorning += sale.morning_qty;
      totalEvening += sale.evening_qty;
      totalLitresAll += sale.total_litres;
      totalSalesAll += sale.sale_amount;
      totalAdvanceUsedAll += advanceUsed;
      totalPaidAll += paid;
      totalDueAll += due;

      sales.push({
        id: sale.id,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        customer_area: cust.area,
        date,
        morning_qty: sale.morning_qty,
        evening_qty: sale.evening_qty,
        total_litres: sale.total_litres,
        rate: sale.rate,
        sale_amount: sale.sale_amount,
        advance_used: advanceUsed,
        paid,
        due,
        created_at: sale.created_at,
        updated_at: sale.updated_at,
      });
    }

    return {
      sales,
      total: sales.length,
      date,
      summary: {
        total_morning_litres: Math.round(totalMorning * 100) / 100,
        total_evening_litres: Math.round(totalEvening * 100) / 100,
        total_litres: Math.round(totalLitresAll * 100) / 100,
        total_sales_amount: Math.round(totalSalesAll * 100) / 100,
        total_advance_used: Math.round(totalAdvanceUsedAll * 100) / 100,
        total_paid: Math.round(totalPaidAll * 100) / 100,
        total_due: Math.round(totalDueAll * 100) / 100,
      },
    };
  }

  /**
   * Return detailed TiDB status
   */
  public async getStatus(): Promise<DBStatus> {
    let usersCount = this.fallbackUsers.length;
    let customersCount = this.fallbackCustomers.length;
    let deliveriesCount = this.fallbackDeliveries.length;
    let salesCount = this.fallbackSales.length;
    let paymentsCount = this.fallbackPayments.length;
    let advanceLedgerCount = this.fallbackAdvanceLedger.length;

    if (this.pool) {
      try {
        const [uRows]: [any[], any] = await this.pool.query('SELECT COUNT(*) as count FROM users');
        usersCount = Number(uRows[0]?.count || 0);

        const [cRows]: [any[], any] = await this.pool.query('SELECT COUNT(*) as count FROM customers');
        customersCount = Number(cRows[0]?.count || 0);

        const [dRows]: [any[], any] = await this.pool.query('SELECT COUNT(*) as count FROM deliveries');
        deliveriesCount = Number(dRows[0]?.count || 0);

        const [sRows]: [any[], any] = await this.pool.query('SELECT COUNT(*) as count FROM sales');
        salesCount = Number(sRows[0]?.count || 0);

        const [pRows]: [any[], any] = await this.pool.query('SELECT COUNT(*) as count FROM payments');
        paymentsCount = Number(pRows[0]?.count || 0);

        const [aRows]: [any[], any] = await this.pool.query('SELECT COUNT(*) as count FROM advance_ledger');
        advanceLedgerCount = Number(aRows[0]?.count || 0);

        this.isConnected = true;
        this.connectionError = null;
      } catch (err: any) {
        this.isConnected = false;
        this.connectionError = err.message;
      }
    }

    return {
      connected: this.isConnected,
      type: this.isConnected ? 'tidb' : 'local_fallback',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 4000,
      database: process.env.DB_NAME || 'milkhub',
      usersTableExists: true,
      usersCount,
      customersTableExists: true,
      customersCount,
      lastChecked: new Date().toISOString(),
      error: this.connectionError || undefined,
    };
  }
}

export const tidb = new TiDBService();



