import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import dotenv from 'dotenv';
import { hashPassword } from '../utils/security.js';
import {
  CollectionCenter,
  Customer,
  Delivery,
  DeliverySession,
  DeliveryStatus,
  PaymentRecord,
  PaymentType,
  PaymentMode,
  AdvanceLedgerEntry,
  AdvanceLedgerType,
  DailyPaymentSummary,
} from '../types/index.js';

dotenv.config();

export interface TiDBUser {
  id: string;
  email: string;
  password_hash: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface DBStatus {
  connected: boolean;
  type: 'tidb' | 'local_fallback';
  host: string;
  port: number;
  database: string;
  usersCount: number;
  centersCount: number;
  customersCount: number;
  error?: string;
  lastChecked: string;
}

class TiDBService {
  private pool: Pool | null = null;
  private isConnected: boolean = false;
  private connectionError: string | null = null;

  // Local fallback storage for users
  private fallbackUsers: TiDBUser[] = [
    {
      id: 'u_admin_001',
      email: (process.env.DEFAULT_OWNER_EMAIL || 'milkhub@admin.com').toLowerCase(),
      password_hash: hashPassword(process.env.DEFAULT_OWNER_PASSWORD || 'Admin@123'),
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Local fallback storage for Collection Centers
  private fallbackCenters: CollectionCenter[] = [
    {
      id: 'c1',
      center_name: 'Srivilliputtur Center',
      name: 'Srivilliputtur Center',
      location: 'Madurai Road, Srivilliputtur',
      code: 'SVPR',
      phone: '+91 98421 11220',
      status: 'active',
      is_active: true,
      created_at: '2026-01-10T08:00:00Z',
      updated_at: '2026-01-10T08:00:00Z',
    },
    {
      id: 'c2',
      center_name: 'RJPLM Center',
      name: 'RJPLM Center',
      location: 'Tenkasi Highway, Rajapalayam',
      code: 'RJPM',
      phone: '+91 98421 11221',
      status: 'active',
      is_active: true,
      created_at: '2026-01-15T08:00:00Z',
      updated_at: '2026-01-15T08:00:00Z',
    },
  ];

  // Local fallback storage for Customers / Milk Suppliers
  private fallbackCustomers: Customer[] = [
    {
      id: 'cust_1',
      customer_code: 'SUP001',
      name: 'Ramesh',
      phone: '9876543210',
      mobile: '9876543210',
      address: '14 Tenkasi Main Road',
      area: 'Srivilliputtur',
      village: 'Srivilliputtur',
      center_id: 'c1',
      collection_center_id: 'c1',
      center_name: 'Srivilliputtur Center',
      cow_count: 2,
      buffalo_count: 1,
      default_morning_qty: 1.0,
      default_evening_qty: 1.0,
      rate: 60.0,
      start_date: '2026-01-01',
      status: 'active',
      notes: 'Reliable supplier, morning delivery priority',
      created_at: '2026-01-01T08:00:00Z',
      updated_at: '2026-01-01T08:00:00Z',
    },
    {
      id: 'cust_2',
      customer_code: 'SUP002',
      name: 'Murugan',
      phone: '9876543211',
      mobile: '9876543211',
      address: '22 Station Road',
      area: 'Rajapalayam',
      village: 'Rajapalayam',
      center_id: 'c2',
      collection_center_id: 'c2',
      center_name: 'RJPLM Center',
      cow_count: 3,
      buffalo_count: 0,
      default_morning_qty: 1.5,
      default_evening_qty: 1.0,
      rate: 60.0,
      start_date: '2026-01-15',
      status: 'active',
      notes: 'Cow milk supplier',
      created_at: '2026-01-15T08:00:00Z',
      updated_at: '2026-01-15T08:00:00Z',
    },
    {
      id: 'cust_3',
      customer_code: 'SUP003',
      name: 'Selvaraj',
      phone: '9876543212',
      mobile: '9876543212',
      address: '5 West Car Street',
      area: 'Srivilliputtur',
      village: 'Srivilliputtur',
      center_id: 'c1',
      collection_center_id: 'c1',
      center_name: 'Srivilliputtur Center',
      cow_count: 1,
      buffalo_count: 2,
      default_morning_qty: 2.0,
      default_evening_qty: 1.5,
      rate: 62.0,
      start_date: '2026-02-01',
      status: 'active',
      notes: 'Buffalo milk specialist',
      created_at: '2026-02-01T08:00:00Z',
      updated_at: '2026-02-01T08:00:00Z',
    },
  ];

  // Local fallback storage for Deliveries (Phase 3)
  private fallbackDeliveries: Delivery[] = [];

  // Local fallback storage for Payments & Advance Ledger (Phase 5)
  private fallbackPayments: PaymentRecord[] = [];
  private fallbackAdvanceLedger: AdvanceLedgerEntry[] = [];

  constructor() {
    this.createPool();
  }

  private createPool() {
    try {
      const databaseUrl = process.env.DATABASE_URL;

      if (databaseUrl) {
        console.log('[TiDB] Initializing connection pool from DATABASE_URL...');
        this.pool = mysql.createPool({
          uri: databaseUrl,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          ssl: process.env.DB_SSL === 'false' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        });
        return;
      }

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
        ssl: useSSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
      };

      console.log(`[TiDB] Initializing connection pool to ${user}@${host}:${port}/${database} (SSL: ${useSSL})...`);
      this.pool = mysql.createPool(config);
    } catch (err: any) {
      console.warn('[TiDB] Failed to construct connection pool:', err.message);
      this.pool = null;
    }
  }

  /**
   * Initialize TiDB database:
   * 1. Check connection
   * 2. Create users, collection_centers, and customers tables
   * 3. Seed initial owner, centers, and suppliers if empty
   */
  public async initDatabase(): Promise<boolean> {
    if (!this.pool) {
      this.isConnected = false;
      this.connectionError = 'Database pool not initialized';
      return false;
    }

    try {
      const connection = await this.pool.getConnection();
      console.log('[TiDB] Connection established successfully.');

      // 1. Users table (Phase 1)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      // 2. Collection Centers table (Phase 2)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS collection_centers (
          id VARCHAR(64) PRIMARY KEY,
          center_name VARCHAR(255) NOT NULL,
          location VARCHAR(255) NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      // 3. Customers / Milk Suppliers table (Phase 2)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(64) PRIMARY KEY,
          customer_code VARCHAR(32) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(32) NOT NULL,
          address TEXT,
          area VARCHAR(255) NOT NULL,
          center_id VARCHAR(64) NOT NULL,
          cow_count INT NOT NULL DEFAULT 0,
          buffalo_count INT NOT NULL DEFAULT 0,
          default_morning_qty DECIMAL(8,2) NOT NULL DEFAULT 1.0,
          default_evening_qty DECIMAL(8,2) NOT NULL DEFAULT 1.0,
          rate DECIMAL(8,2) NOT NULL DEFAULT 60.00,
          start_date DATE NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'active',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_customer_center FOREIGN KEY (center_id) REFERENCES collection_centers(id) ON UPDATE CASCADE
        );
      `);

      // 4. Deliveries table (Phase 3)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          center_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          session ENUM('MORNING', 'EVENING') NOT NULL,
          actual_qty DECIMAL(8,2) NOT NULL DEFAULT 0.0,
          status ENUM('DELIVERED', 'NO_MILK') NOT NULL DEFAULT 'DELIVERED',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_customer_date_session (customer_id, date, session),
          CONSTRAINT fk_delivery_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
          CONSTRAINT fk_delivery_center FOREIGN KEY (center_id) REFERENCES collection_centers(id) ON DELETE CASCADE
        );
      `);

      // 5. Payments table (Phase 5)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          payment_type ENUM('DAILY_PAYMENT', 'ADVANCE') NOT NULL,
          payment_mode ENUM('CASH', 'UPI', 'BANK_TRANSFER') NOT NULL DEFAULT 'CASH',
          reference_id VARCHAR(128),
          notes TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );
      `);

      // 6. Advance Ledger table (Phase 5)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS advance_ledger (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          type ENUM('ADVANCE_ADDED', 'ADVANCE_USED') NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          reference_id VARCHAR(128),
          notes TEXT,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_advance_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        );
      `);

      // Seed or update default owner
      const defaultEmail = (process.env.DEFAULT_OWNER_EMAIL || 'milkhub@admin.com').toLowerCase();
      const defaultPassword = process.env.DEFAULT_OWNER_PASSWORD || 'Admin@123';
      const defaultHash = hashPassword(defaultPassword);

      const [userRows]: any = await connection.query('SELECT id FROM users WHERE LOWER(email) = ? OR id = ? OR LOWER(email) = ?', [defaultEmail, 'u_admin_001', 'admin@milkhub.com']);
      if (!userRows || userRows.length === 0) {
        await connection.query(
          `INSERT INTO users (id, email, password_hash, status, created_at, updated_at) 
           VALUES (?, ?, ?, 'active', NOW(), NOW())`,
          ['u_admin_001', defaultEmail, defaultHash]
        );
        console.log(`[TiDB] Default Owner seeded: ${defaultEmail}`);
      } else {
        await connection.query(
          'UPDATE users SET email = ?, password_hash = ?, status = ? WHERE id = ?',
          [defaultEmail, defaultHash, 'active', userRows[0].id]
        );
        console.log(`[TiDB] Owner user synchronized: ${defaultEmail}`);
      }

      // Seed default centers if empty
      const [centerRows]: any = await connection.query('SELECT COUNT(*) as count FROM collection_centers');
      if ((centerRows[0]?.count || 0) === 0) {
        await connection.query(`
          INSERT INTO collection_centers (id, center_name, location, status, created_at, updated_at) VALUES 
          ('c1', 'Srivilliputtur Center', 'Madurai Road, Srivilliputtur', 'active', NOW(), NOW()),
          ('c2', 'RJPLM Center', 'Tenkasi Highway, Rajapalayam', 'active', NOW(), NOW())
        `);
        console.log('[TiDB] Default Collection Centers seeded: Srivilliputtur Center, RJPLM Center');
      }

      // Seed default suppliers if empty
      const [custRows]: any = await connection.query('SELECT COUNT(*) as count FROM customers');
      if ((custRows[0]?.count || 0) === 0) {
        await connection.query(`
          INSERT INTO customers (id, customer_code, name, phone, address, area, center_id, cow_count, buffalo_count, default_morning_qty, default_evening_qty, rate, start_date, status, created_at, updated_at) VALUES 
          ('cust_1', 'SUP001', 'Ramesh', '9876543210', '14 Tenkasi Main Road', 'Srivilliputtur', 'c1', 2, 1, 1.0, 1.0, 60.00, '2026-01-01', 'active', NOW(), NOW()),
          ('cust_2', 'SUP002', 'Murugan', '9876543211', '22 Station Road', 'Rajapalayam', 'c2', 3, 0, 1.5, 1.0, 60.00, '2026-01-15', 'active', NOW(), NOW())
        `);
        console.log('[TiDB] Default Customers/Suppliers seeded: SUP001 (Ramesh), SUP002 (Murugan)');
      }

      connection.release();
      this.isConnected = true;
      this.connectionError = null;
      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || 'Failed to connect to TiDB';
      console.warn(`[TiDB] Unable to connect: ${this.connectionError}. Operating in synchronized fallback mode.`);
      return false;
    }
  }

  // ==========================================
  // USERS REPOSITORY (Phase 1)
  // ==========================================

  public async findUserByEmail(email: string): Promise<TiDBUser | null> {
    const cleanEmail = email.trim().toLowerCase();

    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
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
            created_at: new Date(r.created_at).toISOString(),
            updated_at: new Date(r.updated_at).toISOString(),
          };
        }
        return null;
      } catch (err) {
        console.error('[TiDB] Error querying user by email:', err);
      }
    }

    const found = this.fallbackUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail
    );
    return found || null;
  }

  public async findUserById(id: string): Promise<TiDBUser | null> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
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
            created_at: new Date(r.created_at).toISOString(),
            updated_at: new Date(r.updated_at).toISOString(),
          };
        }
        return null;
      } catch (err) {
        console.error('[TiDB] Error querying user by ID:', err);
      }
    }

    return this.fallbackUsers.find((u) => u.id === id) || null;
  }

  public async touchUserLogin(id: string): Promise<void> {
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query('UPDATE users SET updated_at = NOW() WHERE id = ?', [id]);
        return;
      } catch (err) {
        console.error('[TiDB] Error updating user timestamp:', err);
      }
    }

    const u = this.fallbackUsers.find((u) => u.id === id);
    if (u) {
      u.updated_at = new Date().toISOString();
    }
  }

  // ==========================================
  // COLLECTION CENTERS REPOSITORY (Phase 2)
  // ==========================================

  public async getCenters(): Promise<CollectionCenter[]> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(`
          SELECT c.id, c.center_name, c.location, c.status, c.created_at, c.updated_at,
                 COUNT(cust.id) AS supplier_count
          FROM collection_centers c
          LEFT JOIN customers cust ON cust.center_id = c.id
          GROUP BY c.id, c.center_name, c.location, c.status, c.created_at, c.updated_at
          ORDER BY c.created_at ASC
        `);

        return rows.map((r: any) => ({
          id: r.id,
          center_name: r.center_name,
          name: r.center_name,
          location: r.location,
          status: r.status,
          is_active: r.status === 'active',
          supplier_count: Number(r.supplier_count || 0),
          created_at: new Date(r.created_at).toISOString(),
          updated_at: new Date(r.updated_at).toISOString(),
        }));
      } catch (err) {
        console.error('[TiDB] Error fetching collection centers:', err);
      }
    }

    // Fallback mode
    return this.fallbackCenters.map((c) => {
      const count = this.fallbackCustomers.filter((cust) => cust.center_id === c.id || cust.collection_center_id === c.id).length;
      return {
        ...c,
        supplier_count: count,
      };
    });
  }

  public async getCenterById(id: string): Promise<CollectionCenter | null> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
          `SELECT c.id, c.center_name, c.location, c.status, c.created_at, c.updated_at,
                  COUNT(cust.id) AS supplier_count
           FROM collection_centers c
           LEFT JOIN customers cust ON cust.center_id = c.id
           WHERE c.id = ?
           GROUP BY c.id, c.center_name, c.location, c.status, c.created_at, c.updated_at`,
          [id]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            center_name: r.center_name,
            name: r.center_name,
            location: r.location,
            status: r.status,
            is_active: r.status === 'active',
            supplier_count: Number(r.supplier_count || 0),
            created_at: new Date(r.created_at).toISOString(),
            updated_at: new Date(r.updated_at).toISOString(),
          };
        }
        return null;
      } catch (err) {
        console.error('[TiDB] Error fetching center by ID:', err);
      }
    }

    const c = this.fallbackCenters.find((item) => item.id === id);
    if (!c) return null;
    const count = this.fallbackCustomers.filter((cust) => cust.center_id === c.id || cust.collection_center_id === c.id).length;
    return { ...c, supplier_count: count };
  }

  public async createCenter(data: { center_name: string; location: string; status?: 'active' | 'inactive'; code?: string; phone?: string }): Promise<CollectionCenter> {
    const id = `c_${Date.now()}`;
    const center_name = data.center_name.trim();
    const location = data.location.trim();
    const status = data.status || 'active';
    const now = new Date().toISOString();

    const newCenter: CollectionCenter = {
      id,
      center_name,
      name: center_name,
      location,
      status,
      is_active: status === 'active',
      code: data.code || `C${Date.now().toString().slice(-3)}`,
      phone: data.phone || '',
      supplier_count: 0,
      created_at: now,
      updated_at: now,
    };

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO collection_centers (id, center_name, location, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, NOW(), NOW())`,
          [id, center_name, location, status]
        );
        return newCenter;
      } catch (err) {
        console.error('[TiDB] Error creating center:', err);
      }
    }

    this.fallbackCenters.push(newCenter);
    return newCenter;
  }

  public async updateCenter(id: string, updates: Partial<CollectionCenter>): Promise<CollectionCenter | null> {
    const now = new Date().toISOString();

    if (this.isConnected && this.pool) {
      try {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.center_name !== undefined || updates.name !== undefined) {
          fields.push('center_name = ?');
          values.push(updates.center_name || updates.name);
        }
        if (updates.location !== undefined) {
          fields.push('location = ?');
          values.push(updates.location);
        }
        if (updates.status !== undefined) {
          fields.push('status = ?');
          values.push(updates.status);
        } else if (updates.is_active !== undefined) {
          fields.push('status = ?');
          values.push(updates.is_active ? 'active' : 'inactive');
        }

        if (fields.length > 0) {
          fields.push('updated_at = NOW()');
          values.push(id);
          await this.pool.query(
            `UPDATE collection_centers SET ${fields.join(', ')} WHERE id = ?`,
            values
          );
        }
        return await this.getCenterById(id);
      } catch (err) {
        console.error('[TiDB] Error updating center:', err);
      }
    }

    const idx = this.fallbackCenters.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const current = this.fallbackCenters[idx];
    const center_name = updates.center_name || updates.name || current.center_name;
    const status = updates.status || (updates.is_active !== undefined ? (updates.is_active ? 'active' : 'inactive') : current.status);

    this.fallbackCenters[idx] = {
      ...current,
      ...updates,
      center_name,
      name: center_name,
      status,
      is_active: status === 'active',
      updated_at: now,
    };

    return this.fallbackCenters[idx];
  }

  // ==========================================
  // CUSTOMERS / MILK SUPPLIERS REPOSITORY (Phase 2)
  // ==========================================

  public async getCustomers(filters?: {
    search?: string;
    center_id?: string;
    status?: string;
    area?: string;
    page?: number;
    limit?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const search = filters?.search?.trim().toLowerCase();
    const center_id = filters?.center_id && filters.center_id !== 'all' ? filters.center_id : undefined;
    const status = filters?.status && filters.status !== 'all' ? filters.status.toLowerCase() : undefined;
    const area = filters?.area && filters.area !== 'all' ? filters.area.trim().toLowerCase() : undefined;

    if (this.isConnected && this.pool) {
      try {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (search) {
          whereClauses.push('(LOWER(cust.name) LIKE ? OR cust.phone LIKE ? OR LOWER(cust.customer_code) LIKE ? OR LOWER(cust.area) LIKE ?)');
          const sParam = `%${search}%`;
          params.push(sParam, sParam, sParam, sParam);
        }

        if (center_id) {
          whereClauses.push('cust.center_id = ?');
          params.push(center_id);
        }

        if (status) {
          whereClauses.push('LOWER(cust.status) = ?');
          params.push(status);
        }

        if (area) {
          whereClauses.push('LOWER(cust.area) = ?');
          params.push(area);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Count query
        const [countRows]: any = await this.pool.query(
          `SELECT COUNT(*) as total FROM customers cust ${whereSQL}`,
          params
        );
        const total = countRows[0]?.total || 0;

        // Fetch query with joined center
        const querySQL = `
          SELECT cust.id, cust.customer_code, cust.name, cust.phone, cust.address, cust.area,
                 cust.center_id, c.center_name, cust.cow_count, cust.buffalo_count,
                 cust.default_morning_qty, cust.default_evening_qty, cust.rate, cust.start_date,
                 cust.status, cust.created_at, cust.updated_at
          FROM customers cust
          LEFT JOIN collection_centers c ON c.id = cust.center_id
          ${whereSQL}
          ORDER BY cust.created_at DESC
        `;

        const [rows]: any = await this.pool.query(querySQL, params);

        const customers: Customer[] = rows.map((r: any) => ({
          id: r.id,
          customer_code: r.customer_code,
          name: r.name,
          phone: r.phone,
          mobile: r.phone,
          address: r.address || '',
          area: r.area,
          village: r.area,
          center_id: r.center_id,
          collection_center_id: r.center_id,
          center_name: r.center_name || 'All Centers',
          cow_count: Number(r.cow_count || 0),
          buffalo_count: Number(r.buffalo_count || 0),
          default_morning_qty: Number(r.default_morning_qty || 1.0),
          default_evening_qty: Number(r.default_evening_qty || 1.0),
          rate: Number(r.rate || 60.0),
          start_date: typeof r.start_date === 'string' ? r.start_date : new Date(r.start_date).toISOString().split('T')[0],
          status: r.status,
          created_at: new Date(r.created_at).toISOString(),
          updated_at: new Date(r.updated_at).toISOString(),
        }));

        return { customers, total };
      } catch (err) {
        console.error('[TiDB] Error querying customers:', err);
      }
    }

    // Fallback in-memory filter
    let list = [...this.fallbackCustomers];

    if (search) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          (c.phone && c.phone.includes(search)) ||
          (c.mobile && c.mobile.includes(search)) ||
          c.customer_code.toLowerCase().includes(search) ||
          (c.area && c.area.toLowerCase().includes(search)) ||
          (c.village && c.village.toLowerCase().includes(search))
      );
    }

    if (center_id) {
      list = list.filter((c) => c.center_id === center_id || c.collection_center_id === center_id);
    }

    if (status) {
      list = list.filter((c) => c.status.toLowerCase() === status);
    }

    if (area) {
      list = list.filter((c) => (c.area && c.area.toLowerCase() === area) || (c.village && c.village.toLowerCase() === area));
    }

    return {
      customers: list,
      total: list.length,
    };
  }

  public async getCustomerById(id: string): Promise<Customer | null> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
          `SELECT cust.id, cust.customer_code, cust.name, cust.phone, cust.address, cust.area,
                  cust.center_id, c.center_name, cust.cow_count, cust.buffalo_count,
                  cust.default_morning_qty, cust.default_evening_qty, cust.rate, cust.start_date,
                  cust.status, cust.created_at, cust.updated_at
           FROM customers cust
           LEFT JOIN collection_centers c ON c.id = cust.center_id
           WHERE cust.id = ? LIMIT 1`,
          [id]
        );
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            customer_code: r.customer_code,
            name: r.name,
            phone: r.phone,
            mobile: r.phone,
            address: r.address || '',
            area: r.area,
            village: r.area,
            center_id: r.center_id,
            collection_center_id: r.center_id,
            center_name: r.center_name || 'All Centers',
            cow_count: Number(r.cow_count || 0),
            buffalo_count: Number(r.buffalo_count || 0),
            default_morning_qty: Number(r.default_morning_qty || 1.0),
            default_evening_qty: Number(r.default_evening_qty || 1.0),
            rate: Number(r.rate || 60.0),
            start_date: typeof r.start_date === 'string' ? r.start_date : new Date(r.start_date).toISOString().split('T')[0],
            status: r.status,
            created_at: new Date(r.created_at).toISOString(),
            updated_at: new Date(r.updated_at).toISOString(),
          };
        }
        return null;
      } catch (err) {
        console.error('[TiDB] Error fetching customer by ID:', err);
      }
    }

    const found = this.fallbackCustomers.find((c) => c.id === id);
    if (!found) return null;

    const center = this.fallbackCenters.find((c) => c.id === found.center_id || c.id === found.collection_center_id);
    return {
      ...found,
      center_name: center?.center_name || center?.name || 'All Centers',
    };
  }

  public async createCustomer(data: {
    customer_code?: string;
    name: string;
    phone?: string;
    mobile?: string;
    address?: string;
    area?: string;
    village?: string;
    center_id?: string;
    collection_center_id?: string;
    cow_count?: number;
    buffalo_count?: number;
    default_morning_qty?: number;
    default_evening_qty?: number;
    rate?: number;
    start_date?: string;
    status?: 'active' | 'inactive';
    notes?: string;
  }): Promise<Customer> {
    const id = `cust_${Date.now()}`;
    const name = data.name.trim();
    const phone = (data.phone || data.mobile || '').trim();
    const address = data.address?.trim() || '';
    const area = (data.area || data.village || 'Srivilliputtur').trim();
    const center_id = data.center_id || data.collection_center_id || 'c1';
    const cow_count = Number(data.cow_count) || 0;
    const buffalo_count = Number(data.buffalo_count) || 0;
    const default_morning_qty = Number(data.default_morning_qty !== undefined ? data.default_morning_qty : 1.0);
    const default_evening_qty = Number(data.default_evening_qty !== undefined ? data.default_evening_qty : 1.0);
    const rate = Number(data.rate !== undefined ? data.rate : 60.0);
    const start_date = data.start_date || new Date().toISOString().split('T')[0];
    const status = data.status || 'active';
    const now = new Date().toISOString();

    // Auto-generate customer_code if missing
    let customer_code = data.customer_code?.trim().toUpperCase();
    if (!customer_code) {
      customer_code = `SUP${String(Date.now()).slice(-4)}`;
    }

    // Resolve center name
    const center = await this.getCenterById(center_id);
    const center_name = center?.center_name || center?.name || 'All Centers';

    const newCustomer: Customer = {
      id,
      customer_code,
      name,
      phone,
      mobile: phone,
      address,
      area,
      village: area,
      center_id,
      collection_center_id: center_id,
      center_name,
      cow_count,
      buffalo_count,
      default_morning_qty,
      default_evening_qty,
      rate,
      start_date,
      status,
      notes: data.notes || '',
      created_at: now,
      updated_at: now,
    };

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO customers (id, customer_code, name, phone, address, area, center_id, cow_count, buffalo_count, default_morning_qty, default_evening_qty, rate, start_date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            customer_code,
            name,
            phone,
            address,
            area,
            center_id,
            cow_count,
            buffalo_count,
            default_morning_qty,
            default_evening_qty,
            rate,
            start_date,
            status,
          ]
        );
        return newCustomer;
      } catch (err) {
        console.error('[TiDB] Error inserting customer:', err);
      }
    }

    this.fallbackCustomers.unshift(newCustomer);
    return newCustomer;
  }

  public async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const now = new Date().toISOString();

    if (this.isConnected && this.pool) {
      try {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.name !== undefined) {
          fields.push('name = ?');
          values.push(updates.name.trim());
        }
        if (updates.customer_code !== undefined) {
          fields.push('customer_code = ?');
          values.push(updates.customer_code.trim().toUpperCase());
        }
        if (updates.phone !== undefined || updates.mobile !== undefined) {
          fields.push('phone = ?');
          values.push((updates.phone || updates.mobile || '').trim());
        }
        if (updates.address !== undefined) {
          fields.push('address = ?');
          values.push(updates.address.trim());
        }
        if (updates.area !== undefined || updates.village !== undefined) {
          fields.push('area = ?');
          values.push((updates.area || updates.village || '').trim());
        }
        if (updates.center_id !== undefined || updates.collection_center_id !== undefined) {
          fields.push('center_id = ?');
          values.push(updates.center_id || updates.collection_center_id);
        }
        if (updates.cow_count !== undefined) {
          fields.push('cow_count = ?');
          values.push(Number(updates.cow_count));
        }
        if (updates.buffalo_count !== undefined) {
          fields.push('buffalo_count = ?');
          values.push(Number(updates.buffalo_count));
        }
        if (updates.default_morning_qty !== undefined) {
          fields.push('default_morning_qty = ?');
          values.push(Number(updates.default_morning_qty));
        }
        if (updates.default_evening_qty !== undefined) {
          fields.push('default_evening_qty = ?');
          values.push(Number(updates.default_evening_qty));
        }
        if (updates.rate !== undefined) {
          fields.push('rate = ?');
          values.push(Number(updates.rate));
        }
        if (updates.start_date !== undefined) {
          fields.push('start_date = ?');
          values.push(updates.start_date);
        }
        if (updates.status !== undefined) {
          fields.push('status = ?');
          values.push(updates.status);
        }

        if (fields.length > 0) {
          fields.push('updated_at = NOW()');
          values.push(id);
          await this.pool.query(
            `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
            values
          );
        }
        return await this.getCustomerById(id);
      } catch (err) {
        console.error('[TiDB] Error updating customer:', err);
      }
    }

    const idx = this.fallbackCustomers.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    const current = this.fallbackCustomers[idx];
    const phone = updates.phone || updates.mobile || current.phone;
    const area = updates.area || updates.village || current.area;
    const center_id = updates.center_id || updates.collection_center_id || current.center_id;

    const center = this.fallbackCenters.find((c) => c.id === center_id);

    this.fallbackCustomers[idx] = {
      ...current,
      ...updates,
      phone,
      mobile: phone,
      area,
      village: area,
      center_id,
      collection_center_id: center_id,
      center_name: center?.center_name || center?.name || current.center_name,
      updated_at: now,
    };

    return this.fallbackCustomers[idx];
  }

  /**
   * Soft-delete / Deactivate Customer
   * Preserves historical delivery/sales/payment records!
   */
  public async deactivateCustomer(id: string): Promise<boolean> {
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query('UPDATE customers SET status = "inactive", updated_at = NOW() WHERE id = ?', [id]);
        return true;
      } catch (err) {
        console.error('[TiDB] Error deactivating customer:', err);
        return false;
      }
    }

    const customer = this.fallbackCustomers.find((c) => c.id === id);
    if (customer) {
      customer.status = 'inactive';
      customer.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  // ==========================================
  // DELIVERIES REPOSITORY (Phase 3)
  // ==========================================

  /**
   * Get deliveries for a date and session (MORNING / EVENING).
   * Loads all ACTIVE suppliers, showing their saved actual delivery OR pre-filled default quantity!
   */
  public async getDeliveries(options: {
    date: string;
    session: DeliverySession;
    center_id?: string;
    search?: string;
  }): Promise<Delivery[]> {
    const { date, session, center_id, search } = options;
    const cleanSearch = search?.trim().toLowerCase();

    if (this.isConnected && this.pool) {
      try {
        let whereClauses: string[] = ['cust.status = "active"'];
        let params: any[] = [session, date, session];

        if (center_id && center_id !== 'all') {
          whereClauses.push('cust.center_id = ?');
          params.push(center_id);
        }

        if (cleanSearch) {
          whereClauses.push('(LOWER(cust.name) LIKE ? OR cust.phone LIKE ? OR LOWER(cust.customer_code) LIKE ? OR LOWER(cust.area) LIKE ?)');
          const sParam = `%${cleanSearch}%`;
          params.push(sParam, sParam, sParam, sParam);
        }

        const querySQL = `
          SELECT 
            cust.id AS customer_id,
            cust.customer_code,
            cust.name AS customer_name,
            cust.phone,
            cust.rate,
            cust.center_id,
            c.center_name,
            CASE WHEN ? = 'MORNING' THEN cust.default_morning_qty ELSE cust.default_evening_qty END AS default_qty,
            del.id AS id,
            del.actual_qty,
            del.status AS delivery_status,
            del.created_at AS delivery_created_at,
            del.updated_at AS delivery_updated_at
          FROM customers cust
          JOIN collection_centers c ON c.id = cust.center_id
          LEFT JOIN deliveries del ON del.customer_id = cust.id AND del.date = ? AND del.session = ?
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY cust.customer_code ASC;
        `;

        const [rows]: any = await this.pool.query(querySQL, params);

        return rows.map((r: any) => {
          const defaultQty = Number(r.default_qty !== undefined ? r.default_qty : 1.0);
          const hasSaved = r.id !== null && r.id !== undefined;
          const actualQty = hasSaved ? Number(r.actual_qty) : defaultQty;
          const status: DeliveryStatus = hasSaved ? r.delivery_status : 'DELIVERED';
          const rate = Number(r.rate || 60.0);

          return {
            id: r.id || `temp_${r.customer_id}_${date}_${session}`,
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            customer_code: r.customer_code,
            phone: r.phone,
            center_id: r.center_id,
            center_name: r.center_name,
            date,
            session,
            default_qty: defaultQty,
            actual_qty: actualQty,
            status,
            rate,
            total_amount: Number((actualQty * rate).toFixed(2)),
            is_saved: hasSaved,
            created_at: r.delivery_created_at ? new Date(r.delivery_created_at).toISOString() : new Date().toISOString(),
            updated_at: r.delivery_updated_at ? new Date(r.delivery_updated_at).toISOString() : new Date().toISOString(),
          };
        });
      } catch (err) {
        console.error('[TiDB] Error querying deliveries:', err);
      }
    }

    // Fallback mode
    const activeCustomers = this.fallbackCustomers.filter((c) => {
      if (c.status !== 'active') return false;
      if (center_id && center_id !== 'all' && c.center_id !== center_id && c.collection_center_id !== center_id) {
        return false;
      }
      if (cleanSearch) {
        const matchesName = c.name.toLowerCase().includes(cleanSearch);
        const matchesPhone = (c.phone && c.phone.includes(cleanSearch)) || (c.mobile && c.mobile.includes(cleanSearch));
        const matchesCode = c.customer_code.toLowerCase().includes(cleanSearch);
        const matchesArea = (c.area && c.area.toLowerCase().includes(cleanSearch)) || (c.village && c.village.toLowerCase().includes(cleanSearch));
        if (!matchesName && !matchesPhone && !matchesCode && !matchesArea) return false;
      }
      return true;
    });

    return activeCustomers.map((cust) => {
      const defaultQty = session === 'MORNING'
        ? Number(cust.default_morning_qty !== undefined ? cust.default_morning_qty : 1.0)
        : Number(cust.default_evening_qty !== undefined ? cust.default_evening_qty : 1.0);

      const saved = this.fallbackDeliveries.find(
        (d) => d.customer_id === cust.id && d.date === date && d.session === session
      );

      const center = this.fallbackCenters.find((c) => c.id === cust.center_id || c.id === cust.collection_center_id);
      const actualQty = saved ? Number(saved.actual_qty) : defaultQty;
      const status: DeliveryStatus = saved ? saved.status : 'DELIVERED';
      const rate = Number(cust.rate || 60.0);

      return {
        id: saved ? saved.id : `temp_${cust.id}_${date}_${session}`,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_code: cust.customer_code,
        phone: cust.phone || cust.mobile,
        center_id: cust.center_id || cust.collection_center_id || 'c1',
        center_name: center?.center_name || center?.name || cust.center_name || 'All Centers',
        date,
        session,
        default_qty: defaultQty,
        actual_qty: actualQty,
        status,
        rate,
        total_amount: Number((actualQty * rate).toFixed(2)),
        is_saved: !!saved,
        created_at: saved?.created_at || new Date().toISOString(),
        updated_at: saved?.updated_at || new Date().toISOString(),
      };
    });
  }

  /**
   * Save a single delivery record.
   * If record exists for same (customer_id, date, session), UPDATES it (preventing duplicates).
   * Customer default quantities are NEVER modified.
   */
  public async saveDelivery(data: {
    id?: string;
    customer_id: string;
    center_id?: string;
    date: string;
    session: DeliverySession;
    actual_qty: number;
    status: DeliveryStatus;
  }): Promise<Delivery> {
    const customer = await this.getCustomerById(data.customer_id);
    const center_id = data.center_id || customer?.center_id || 'c1';
    const status: DeliveryStatus = data.status === 'NO_MILK' ? 'NO_MILK' : 'DELIVERED';
    const actual_qty = status === 'NO_MILK' ? 0.0 : Math.max(0, Number(data.actual_qty) || 0.0);
    const date = data.date;
    const session = data.session;
    const now = new Date().toISOString();
    const id = data.id && !data.id.startsWith('temp_') ? data.id : `del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO deliveries (id, customer_id, center_id, date, session, actual_qty, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             actual_qty = VALUES(actual_qty),
             status = VALUES(status),
             center_id = VALUES(center_id),
             updated_at = NOW()`,
          [id, data.customer_id, center_id, date, session, actual_qty, status]
        );

        // Fetch back saved record with center name
        const [rows]: any = await this.pool.query(
          `SELECT del.*, cust.name AS customer_name, cust.customer_code, c.center_name, cust.rate,
                  CASE WHEN del.session = 'MORNING' THEN cust.default_morning_qty ELSE cust.default_evening_qty END AS default_qty
           FROM deliveries del
           JOIN customers cust ON cust.id = del.customer_id
           JOIN collection_centers c ON c.id = del.center_id
           WHERE del.customer_id = ? AND del.date = ? AND del.session = ? LIMIT 1`,
          [data.customer_id, date, session]
        );

        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            customer_id: r.customer_id,
            customer_name: r.customer_name,
            customer_code: r.customer_code,
            center_id: r.center_id,
            center_name: r.center_name,
            date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
            session: r.session,
            default_qty: Number(r.default_qty || 1.0),
            actual_qty: Number(r.actual_qty),
            status: r.status,
            rate: Number(r.rate || 60.0),
            total_amount: Number((Number(r.actual_qty) * Number(r.rate || 60.0)).toFixed(2)),
            is_saved: true,
            created_at: new Date(r.created_at).toISOString(),
            updated_at: new Date(r.updated_at).toISOString(),
          };
        }
      } catch (err) {
        console.error('[TiDB] Error saving delivery:', err);
      }
    }

    // Fallback in-memory
    const existingIndex = this.fallbackDeliveries.findIndex(
      (d) => d.customer_id === data.customer_id && d.date === date && d.session === session
    );

    const savedRecord: Delivery = {
      id: existingIndex !== -1 ? this.fallbackDeliveries[existingIndex].id : id,
      customer_id: data.customer_id,
      customer_name: customer?.name || '',
      customer_code: customer?.customer_code || '',
      center_id,
      center_name: customer?.center_name || 'All Centers',
      date,
      session,
      default_qty: session === 'MORNING'
        ? Number(customer?.default_morning_qty !== undefined ? customer.default_morning_qty : 1.0)
        : Number(customer?.default_evening_qty !== undefined ? customer.default_evening_qty : 1.0),
      actual_qty,
      status,
      rate: Number(customer?.rate || 60.0),
      total_amount: Number((actual_qty * Number(customer?.rate || 60.0)).toFixed(2)),
      is_saved: true,
      created_at: existingIndex !== -1 ? this.fallbackDeliveries[existingIndex].created_at : now,
      updated_at: now,
    };

    if (existingIndex !== -1) {
      this.fallbackDeliveries[existingIndex] = savedRecord;
    } else {
      this.fallbackDeliveries.push(savedRecord);
    }

    return savedRecord;
  }

  /**
   * Save bulk deliveries for multiple rows in one operation
   */
  public async saveBulkDeliveries(deliveries: Array<{
    id?: string;
    customer_id: string;
    center_id?: string;
    date: string;
    session: DeliverySession;
    actual_qty: number;
    status: DeliveryStatus;
  }>): Promise<Delivery[]> {
    const results: Delivery[] = [];
    for (const item of deliveries) {
      const saved = await this.saveDelivery(item);
      results.push(saved);
    }
    return results;
  }

  /**
   * Center-wise Daily Milk Collection Calculations:
   * Calculates center-wise Morning total, Evening total, and Combined Daily total directly from actual delivery records.
   */
  public async getCenterTotals(date: string): Promise<{
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
  }> {
    if (this.isConnected && this.pool) {
      try {
        const querySQL = `
          SELECT 
            c.id AS center_id,
            c.center_name,
            COALESCE(SUM(CASE WHEN del.session = 'MORNING' AND del.status = 'DELIVERED' THEN del.actual_qty ELSE 0 END), 0) AS morning_total,
            COALESCE(SUM(CASE WHEN del.session = 'EVENING' AND del.status = 'DELIVERED' THEN del.actual_qty ELSE 0 END), 0) AS evening_total,
            COALESCE(SUM(CASE WHEN del.status = 'DELIVERED' THEN del.actual_qty ELSE 0 END), 0) AS daily_total
          FROM collection_centers c
          LEFT JOIN deliveries del ON del.center_id = c.id AND del.date = ?
          GROUP BY c.id, c.center_name
          ORDER BY c.center_name ASC;
        `;

        const [rows]: any = await this.pool.query(querySQL, [date]);

        let overallMorning = 0;
        let overallEvening = 0;
        let overallDaily = 0;

        const centers = rows.map((r: any) => {
          const m = Number(r.morning_total || 0);
          const e = Number(r.evening_total || 0);
          const d = Number(r.daily_total || 0);

          overallMorning += m;
          overallEvening += e;
          overallDaily += d;

          return {
            center_id: r.center_id,
            center_name: r.center_name,
            morning_total: Number(m.toFixed(2)),
            evening_total: Number(e.toFixed(2)),
            daily_total: Number(d.toFixed(2)),
          };
        });

        return {
          date,
          centers,
          overall: {
            morning_total: Number(overallMorning.toFixed(2)),
            evening_total: Number(overallEvening.toFixed(2)),
            daily_total: Number(overallDaily.toFixed(2)),
          },
        };
      } catch (err) {
        console.error('[TiDB] Error calculating center totals:', err);
      }
    }

    // Fallback mode calculation
    const allCenters = await this.getCenters();
    let overallMorning = 0;
    let overallEvening = 0;
    let overallDaily = 0;

    const centers = allCenters.map((c) => {
      const centerDeliveries = this.fallbackDeliveries.filter(
        (d) => d.center_id === c.id && d.date === date && d.status === 'DELIVERED'
      );

      const m = centerDeliveries
        .filter((d) => d.session === 'MORNING')
        .reduce((sum, d) => sum + Number(d.actual_qty || 0), 0);

      const e = centerDeliveries
        .filter((d) => d.session === 'EVENING')
        .reduce((sum, d) => sum + Number(d.actual_qty || 0), 0);

      const d = m + e;

      overallMorning += m;
      overallEvening += e;
      overallDaily += d;

      return {
        center_id: c.id,
        center_name: c.center_name || c.name || 'Center',
        morning_total: Number(m.toFixed(2)),
        evening_total: Number(e.toFixed(2)),
        daily_total: Number(d.toFixed(2)),
      };
    });

    return {
      date,
      centers,
      overall: {
        morning_total: Number(overallMorning.toFixed(2)),
        evening_total: Number(overallEvening.toFixed(2)),
        daily_total: Number(overallDaily.toFixed(2)),
      },
    };
  }

  // ==========================================
  // PAYMENTS & ADVANCE REPOSITORY (Phase 5)
  // ==========================================

  /**
   * Record a payment (DAILY_PAYMENT or ADVANCE).
   * Automatically updates advance_ledger if payment_type is ADVANCE.
   * Transactionally safe.
   */
  public async recordPayment(data: {
    customer_id: string;
    date?: string;
    amount: number;
    payment_type: PaymentType;
    payment_mode: PaymentMode;
    reference_id?: string;
    notes?: string;
  }): Promise<PaymentRecord> {
    const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const customer_id = data.customer_id;
    const date = data.date || new Date().toISOString().split('T')[0];
    const amount = Number(Math.max(0, Number(data.amount) || 0).toFixed(2));
    const payment_type: PaymentType = data.payment_type === 'ADVANCE' ? 'ADVANCE' : 'DAILY_PAYMENT';
    const payment_mode: PaymentMode = data.payment_mode || 'CASH';
    const reference_id = data.reference_id?.trim() || '';
    const notes = data.notes?.trim() || '';
    const now = new Date().toISOString();

    const customer = await this.getCustomerById(customer_id);

    if (this.isConnected && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();

        // 1. Insert into payments
        await conn.query(
          `INSERT INTO payments (id, customer_id, date, amount, payment_type, payment_mode, reference_id, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [id, customer_id, date, amount, payment_type, payment_mode, reference_id, notes]
        );

        // 2. If ADVANCE, record into advance_ledger as ADVANCE_ADDED
        if (payment_type === 'ADVANCE') {
          const advId = `adv_add_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await conn.query(
            `INSERT INTO advance_ledger (id, customer_id, date, type, amount, reference_id, notes, created_at)
             VALUES (?, ?, ?, 'ADVANCE_ADDED', ?, ?, ?, NOW())`,
            [advId, customer_id, date, amount, reference_id || id, notes || `Advance payment received via ${payment_mode}`]
          );
        }

        await conn.commit();

        return {
          id,
          customer_id,
          date,
          amount,
          payment_type,
          payment_mode,
          reference_id,
          notes,
          created_at: now,
          customer_name: customer?.name || 'Customer',
          customer_code: customer?.customer_code || '',
          center_id: customer?.center_id || 'c1',
          center_name: customer?.center_name || 'All Centers',
        };
      } catch (err) {
        await conn.rollback();
        console.error('[TiDB] Transaction failed in recordPayment:', err);
        throw err;
      } finally {
        conn.release();
      }
    }

    // Fallback mode
    const newRecord: PaymentRecord = {
      id,
      customer_id,
      date,
      amount,
      payment_type,
      payment_mode,
      reference_id,
      notes,
      created_at: now,
      customer_name: customer?.name || 'Customer',
      customer_code: customer?.customer_code || '',
      center_id: customer?.center_id || 'c1',
      center_name: customer?.center_name || 'All Centers',
    };

    this.fallbackPayments.unshift(newRecord);

    if (payment_type === 'ADVANCE') {
      const advId = `adv_add_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.fallbackAdvanceLedger.push({
        id: advId,
        customer_id,
        date,
        type: 'ADVANCE_ADDED',
        amount,
        reference_id: reference_id || id,
        notes: notes || `Advance payment received via ${payment_mode}`,
        created_at: now,
        customer_name: customer?.name,
        customer_code: customer?.customer_code,
      });
    }

    return newRecord;
  }

  /**
   * Get payments list with filters
   */
  public async getPayments(filters?: {
    customer_id?: string;
    date?: string;
    from_date?: string;
    to_date?: string;
    payment_type?: string;
    payment_mode?: string;
  }): Promise<PaymentRecord[]> {
    const { customer_id, date, from_date, to_date, payment_type, payment_mode } = filters || {};

    if (this.isConnected && this.pool) {
      try {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (customer_id) {
          whereClauses.push('p.customer_id = ?');
          params.push(customer_id);
        }
        if (date) {
          whereClauses.push('p.date = ?');
          params.push(date);
        }
        if (from_date) {
          whereClauses.push('p.date >= ?');
          params.push(from_date);
        }
        if (to_date) {
          whereClauses.push('p.date <= ?');
          params.push(to_date);
        }
        if (payment_type) {
          whereClauses.push('p.payment_type = ?');
          params.push(payment_type);
        }
        if (payment_mode) {
          whereClauses.push('p.payment_mode = ?');
          params.push(payment_mode);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const [rows]: any = await this.pool.query(
          `SELECT p.*, cust.name AS customer_name, cust.customer_code, c.id AS center_id, c.center_name
           FROM payments p
           JOIN customers cust ON cust.id = p.customer_id
           LEFT JOIN collection_centers c ON c.id = cust.center_id
           ${whereSQL}
           ORDER BY p.created_at DESC`,
          params
        );

        return rows.map((r: any) => ({
          id: r.id,
          customer_id: r.customer_id,
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
          amount: Number(r.amount),
          payment_type: r.payment_type,
          payment_mode: r.payment_mode,
          reference_id: r.reference_id || '',
          notes: r.notes || '',
          created_at: new Date(r.created_at).toISOString(),
          customer_name: r.customer_name,
          customer_code: r.customer_code,
          center_id: r.center_id,
          center_name: r.center_name,
        }));
      } catch (err) {
        console.error('[TiDB] Error fetching payments:', err);
      }
    }

    // Fallback mode
    return this.fallbackPayments.filter((p) => {
      if (customer_id && p.customer_id !== customer_id) return false;
      if (date && p.date !== date) return false;
      if (from_date && p.date < from_date) return false;
      if (to_date && p.date > to_date) return false;
      if (payment_type && p.payment_type !== payment_type) return false;
      if (payment_mode && p.payment_mode !== payment_mode) return false;
      return true;
    });
  }

  /**
   * Get available Advance Balance for a customer
   */
  public async getCustomerAdvanceBalance(customerId: string): Promise<{
    total_added: number;
    total_used: number;
    available_balance: number;
  }> {
    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN type = 'ADVANCE_ADDED' THEN amount ELSE 0 END), 0) AS total_added,
             COALESCE(SUM(CASE WHEN type = 'ADVANCE_USED' THEN amount ELSE 0 END), 0) AS total_used
           FROM advance_ledger
           WHERE customer_id = ?`,
          [customerId]
        );

        const total_added = Number(rows[0]?.total_added || 0);
        const total_used = Number(rows[0]?.total_used || 0);
        const available_balance = Number(Math.max(0, total_added - total_used).toFixed(2));

        return { total_added, total_used, available_balance };
      } catch (err) {
        console.error('[TiDB] Error calculating customer advance balance:', err);
      }
    }

    // Fallback mode
    const custLedger = this.fallbackAdvanceLedger.filter((l) => l.customer_id === customerId);
    const total_added = custLedger
      .filter((l) => l.type === 'ADVANCE_ADDED')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const total_used = custLedger
      .filter((l) => l.type === 'ADVANCE_USED')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const available_balance = Number(Math.max(0, total_added - total_used).toFixed(2));

    return {
      total_added: Number(total_added.toFixed(2)),
      total_used: Number(total_used.toFixed(2)),
      available_balance,
    };
  }

  /**
   * Traceable Advance Ledger audit trail
   */
  public async getAdvanceLedger(filters?: {
    customer_id?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<AdvanceLedgerEntry[]> {
    const { customer_id, from_date, to_date } = filters || {};

    if (this.isConnected && this.pool) {
      try {
        let whereClauses: string[] = [];
        let params: any[] = [];

        if (customer_id) {
          whereClauses.push('al.customer_id = ?');
          params.push(customer_id);
        }
        if (from_date) {
          whereClauses.push('al.date >= ?');
          params.push(from_date);
        }
        if (to_date) {
          whereClauses.push('al.date <= ?');
          params.push(to_date);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const [rows]: any = await this.pool.query(
          `SELECT al.*, cust.name AS customer_name, cust.customer_code
           FROM advance_ledger al
           JOIN customers cust ON cust.id = al.customer_id
           ${whereSQL}
           ORDER BY al.created_at DESC`,
          params
        );

        return rows.map((r: any) => ({
          id: r.id,
          customer_id: r.customer_id,
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
          type: r.type,
          amount: Number(r.amount),
          reference_id: r.reference_id || '',
          notes: r.notes || '',
          created_at: new Date(r.created_at).toISOString(),
          customer_name: r.customer_name,
          customer_code: r.customer_code,
        }));
      } catch (err) {
        console.error('[TiDB] Error fetching advance ledger:', err);
      }
    }

    return this.fallbackAdvanceLedger.filter((l) => {
      if (customer_id && l.customer_id !== customer_id) return false;
      if (from_date && l.date < from_date) return false;
      if (to_date && l.date > to_date) return false;
      return true;
    });
  }

  /**
   * Automatic Advance Adjustment (Rule 5 & 6)
   * The backend automatically computes:
   * advance_to_use = min(available_advance, sale)
   * Uses database transaction, prevents duplicates and prevents negative advance balance.
   */
  public async autoAdjustAdvanceForCustomer(
    customerId: string,
    date: string,
    explicitSale?: number
  ): Promise<{
    customer_id: string;
    date: string;
    sale: number;
    available_advance: number;
    advance_used: number;
    remaining_advance: number;
    remaining_sale: number;
  }> {
    const customer = await this.getCustomerById(customerId);
    const rate = Number(customer?.rate || 60.0);

    let sale = 0;
    if (explicitSale !== undefined) {
      sale = Number(Math.max(0, explicitSale).toFixed(2));
    } else {
      // Sum actual confirmed deliveries for today
      if (this.isConnected && this.pool) {
        const [delRows]: any = await this.pool.query(
          `SELECT COALESCE(SUM(actual_qty), 0) AS total_qty
           FROM deliveries
           WHERE customer_id = ? AND date = ? AND status = 'DELIVERED'`,
          [customerId, date]
        );
        const totalQty = Number(delRows[0]?.total_qty || 0);
        sale = Number((totalQty * rate).toFixed(2));
      } else {
        const totalQty = this.fallbackDeliveries
          .filter((d) => d.customer_id === customerId && d.date === date && d.status === 'DELIVERED')
          .reduce((sum, d) => sum + Number(d.actual_qty || 0), 0);
        sale = Number((totalQty * rate).toFixed(2));
      }
    }

    const refId = `AUTO_ADJUST_${customerId}_${date}`;

    if (this.isConnected && this.pool) {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();

        // Calculate available advance EXCLUDING any existing adjustment for this customer and date
        const [balRows]: any = await conn.query(
          `SELECT 
             COALESCE(SUM(CASE WHEN type = 'ADVANCE_ADDED' THEN amount ELSE 0 END), 0) AS total_added,
             COALESCE(SUM(CASE WHEN type = 'ADVANCE_USED' AND reference_id != ? THEN amount ELSE 0 END), 0) AS prior_used
           FROM advance_ledger
           WHERE customer_id = ?`,
          [refId, customerId]
        );

        const totalAdded = Number(balRows[0]?.total_added || 0);
        const priorUsed = Number(balRows[0]?.prior_used || 0);
        const availableAdvance = Number(Math.max(0, totalAdded - priorUsed).toFixed(2));

        const advanceToUse = Number(Math.min(availableAdvance, sale).toFixed(2));

        // Check if an adjustment entry already exists for this customer + date
        const [existingRows]: any = await conn.query(
          `SELECT id FROM advance_ledger WHERE customer_id = ? AND reference_id = ? LIMIT 1`,
          [customerId, refId]
        );

        if (existingRows && existingRows.length > 0) {
          if (advanceToUse > 0) {
            await conn.query(
              `UPDATE advance_ledger SET amount = ?, notes = ? WHERE id = ?`,
              [advanceToUse, `Auto-adjusted advance against daily sale of ₹${sale}`, existingRows[0].id]
            );
          } else {
            await conn.query(`DELETE FROM advance_ledger WHERE id = ?`, [existingRows[0].id]);
          }
        } else if (advanceToUse > 0) {
          const advId = `adv_used_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await conn.query(
            `INSERT INTO advance_ledger (id, customer_id, date, type, amount, reference_id, notes, created_at)
             VALUES (?, ?, ?, 'ADVANCE_USED', ?, ?, ?, NOW())`,
            [advId, customerId, date, advanceToUse, refId, `Auto-adjusted advance against daily sale of ₹${sale}`]
          );
        }

        await conn.commit();

        const remainingAdvance = Number(Math.max(0, availableAdvance - advanceToUse).toFixed(2));
        const remainingSale = Number(Math.max(0, sale - advanceToUse).toFixed(2));

        return {
          customer_id: customerId,
          date,
          sale,
          available_advance: availableAdvance,
          advance_used: advanceToUse,
          remaining_advance: remainingAdvance,
          remaining_sale: remainingSale,
        };
      } catch (err) {
        await conn.rollback();
        console.error('[TiDB] Auto advance adjustment error:', err);
        throw err;
      } finally {
        conn.release();
      }
    }

    // Fallback mode
    const custLedger = this.fallbackAdvanceLedger.filter((l) => l.customer_id === customerId);
    const totalAdded = custLedger
      .filter((l) => l.type === 'ADVANCE_ADDED')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const priorUsed = custLedger
      .filter((l) => l.type === 'ADVANCE_USED' && l.reference_id !== refId)
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    const availableAdvance = Number(Math.max(0, totalAdded - priorUsed).toFixed(2));
    const advanceToUse = Number(Math.min(availableAdvance, sale).toFixed(2));

    const existingIdx = this.fallbackAdvanceLedger.findIndex(
      (l) => l.customer_id === customerId && l.reference_id === refId
    );

    if (existingIdx !== -1) {
      if (advanceToUse > 0) {
        this.fallbackAdvanceLedger[existingIdx].amount = advanceToUse;
      } else {
        this.fallbackAdvanceLedger.splice(existingIdx, 1);
      }
    } else if (advanceToUse > 0) {
      this.fallbackAdvanceLedger.push({
        id: `adv_used_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        customer_id: customerId,
        date,
        type: 'ADVANCE_USED',
        amount: advanceToUse,
        reference_id: refId,
        notes: `Auto-adjusted advance against daily sale of ₹${sale}`,
        created_at: new Date().toISOString(),
        customer_name: customer?.name,
        customer_code: customer?.customer_code,
      });
    }

    const remainingAdvance = Number(Math.max(0, availableAdvance - advanceToUse).toFixed(2));
    const remainingSale = Number(Math.max(0, sale - advanceToUse).toFixed(2));

    return {
      customer_id: customerId,
      date,
      sale,
      available_advance: availableAdvance,
      advance_used: advanceToUse,
      remaining_advance: remainingAdvance,
      remaining_sale: remainingSale,
    };
  }

  /**
   * Get complete daily payment summaries with Sale, Advance, Paid, Due calculation
   */
  public async getDailyPaymentSummaries(options: {
    date: string;
    center_id?: string;
    search?: string;
  }): Promise<DailyPaymentSummary[]> {
    const { date, center_id, search } = options;
    const { customers } = await this.getCustomers({ center_id, search, status: 'active' });

    // Fetch morning & evening deliveries for accurate daily sale calculation
    const morningDeliveries = await this.getDeliveries({ date, session: 'MORNING', center_id });
    const eveningDeliveries = await this.getDeliveries({ date, session: 'EVENING', center_id });

    // Fetch all daily payments made on this date
    const dailyPayments = await this.getPayments({ date, payment_type: 'DAILY_PAYMENT' });

    const summaries: DailyPaymentSummary[] = [];

    for (const cust of customers) {
      let totalQty = 0;
      if (this.isConnected && this.pool) {
        const [delRows]: any = await this.pool.query(
          `SELECT COALESCE(SUM(actual_qty), 0) AS total_qty
           FROM deliveries
           WHERE customer_id = ? AND date = ? AND status = 'DELIVERED'`,
          [cust.id, date]
        );
        totalQty = Number(delRows[0]?.total_qty || 0);
      } else {
        totalQty = this.fallbackDeliveries
          .filter((d) => d.customer_id === cust.id && d.date === date && d.status === 'DELIVERED')
          .reduce((sum, d) => sum + Number(d.actual_qty || 0), 0);
      }
      const rate = Number(cust.rate || 60.0);
      const sale = Number((totalQty * rate).toFixed(2));

      // Calculate Advance & Auto Adjust
      const adj = await this.autoAdjustAdvanceForCustomer(cust.id, date, sale);

      // Calculate Paid on this date
      const custPayments = dailyPayments.filter((p) => p.customer_id === cust.id);
      const paid = Number(custPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2));

      // Due calculation
      const due = Number(Math.max(0, adj.remaining_sale - paid).toFixed(2));

      // Payment Status
      let status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERPAID' = 'PENDING';
      if (sale === 0 && paid === 0) {
        status = 'PAID';
      } else if (due === 0 && (sale > 0 || paid > 0)) {
        status = 'PAID';
      } else if (paid > adj.remaining_sale) {
        status = 'OVERPAID';
      } else if (paid > 0 || adj.advance_used > 0) {
        status = 'PARTIAL';
      } else {
        status = 'PENDING';
      }

      summaries.push({
        date,
        customer_id: cust.id,
        customer_name: cust.name,
        customer_code: cust.customer_code,
        center_id: cust.center_id || cust.collection_center_id || 'c1',
        center_name: cust.center_name || 'Center',
        phone: cust.phone || cust.mobile,
        rate,
        total_qty: totalQty,
        sale,
        available_advance: adj.available_advance,
        advance_used: adj.advance_used,
        remaining_advance: adj.remaining_advance,
        remaining_sale: adj.remaining_sale,
        paid,
        due,
        status,
      });
    }

    return summaries;
  }

  // ==========================================
  // CUSTOMER HISTORY & ANALYTICS (Phase 6)
  // ==========================================

  /**
   * Get complete customer detail & history for a given month or date range
   */
  public async getCustomerHistory(
    customerId: string,
    options?: { month_year?: string; from_date?: string; to_date?: string }
  ): Promise<{
    customer: Customer | null;
    history: Array<{
      date: string;
      morning: number;
      evening: number;
      total: number;
      rate: number;
      sale: number;
      advance_used: number;
      paid: number;
      due: number;
    }>;
    monthly_summary: {
      total_milk: number;
      total_sales: number;
      total_paid: number;
      total_due: number;
      advance_balance: number;
    };
  }> {
    const customer = await this.getCustomerById(customerId);
    const rate = Number(customer?.rate || 60.0);

    let fromDate = options?.from_date;
    let toDate = options?.to_date;

    if (options?.month_year) {
      fromDate = `${options.month_year}-01`;
      toDate = `${options.month_year}-31`;
    }

    if (!fromDate) {
      const now = new Date();
      fromDate = `${now.toISOString().slice(0, 7)}-01`;
      toDate = now.toISOString().split('T')[0];
    }
    if (!toDate) {
      toDate = new Date().toISOString().split('T')[0];
    }

    let customerDeliveries: any[] = [];
    let customerPayments: any[] = [];
    let customerAdvanceUsed: any[] = [];

    if (this.isConnected && this.pool) {
      try {
        const [dRows]: any = await this.pool.query(
          `SELECT date, session, actual_qty, status
           FROM deliveries
           WHERE customer_id = ? AND date >= ? AND date <= ?`,
          [customerId, fromDate, toDate]
        );
        customerDeliveries = dRows.map((r: any) => ({
          ...r,
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
          actual_qty: Number(r.actual_qty),
        }));

        const [pRows]: any = await this.pool.query(
          `SELECT date, amount
           FROM payments
           WHERE customer_id = ? AND date >= ? AND date <= ? AND payment_type = 'DAILY_PAYMENT'`,
          [customerId, fromDate, toDate]
        );
        customerPayments = pRows.map((r: any) => ({
          ...r,
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
          amount: Number(r.amount),
        }));

        const [advRows]: any = await this.pool.query(
          `SELECT date, amount
           FROM advance_ledger
           WHERE customer_id = ? AND date >= ? AND date <= ? AND type = 'ADVANCE_USED'`,
          [customerId, fromDate, toDate]
        );
        customerAdvanceUsed = advRows.map((r: any) => ({
          ...r,
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
          amount: Number(r.amount),
        }));
      } catch (err) {
        console.error('[TiDB] Error fetching customer history:', err);
      }
    } else {
      customerDeliveries = this.fallbackDeliveries.filter(
        (d) => d.customer_id === customerId && d.date >= fromDate! && d.date <= toDate!
      );
      customerPayments = this.fallbackPayments.filter(
        (p) =>
          p.customer_id === customerId &&
          p.date >= fromDate! &&
          p.date <= toDate! &&
          p.payment_type === 'DAILY_PAYMENT'
      );
      customerAdvanceUsed = this.fallbackAdvanceLedger.filter(
        (l) =>
          l.customer_id === customerId &&
          l.date >= fromDate! &&
          l.date <= toDate! &&
          l.type === 'ADVANCE_USED'
      );
    }

    // Collect all dates with activity
    const datesSet = new Set<string>();
    customerDeliveries.forEach((d) => datesSet.add(d.date));
    customerPayments.forEach((p) => datesSet.add(p.date));
    customerAdvanceUsed.forEach((a) => datesSet.add(a.date));

    // Sort dates descending
    const sortedDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));

    const history = sortedDates.map((dStr) => {
      const mDel = customerDeliveries.find((d) => d.date === dStr && d.session === 'MORNING');
      const eDel = customerDeliveries.find((d) => d.date === dStr && d.session === 'EVENING');

      const morning = mDel && mDel.status === 'DELIVERED' ? Number(mDel.actual_qty || 0) : 0;
      const evening = eDel && eDel.status === 'DELIVERED' ? Number(eDel.actual_qty || 0) : 0;
      const total = Number((morning + evening).toFixed(2));
      const sale = Number((total * rate).toFixed(2));

      const advUsed = customerAdvanceUsed
        .filter((a) => a.date === dStr)
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

      const paid = customerPayments
        .filter((p) => p.date === dStr)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const remainingSale = Math.max(0, sale - advUsed);
      const due = Number(Math.max(0, remainingSale - paid).toFixed(2));

      return {
        date: dStr,
        morning: Number(morning.toFixed(2)),
        evening: Number(evening.toFixed(2)),
        total,
        rate,
        sale,
        advance_used: Number(advUsed.toFixed(2)),
        paid: Number(paid.toFixed(2)),
        due,
      };
    });

    const totalMilk = Number(history.reduce((sum, h) => sum + h.total, 0).toFixed(2));
    const totalSales = Number(history.reduce((sum, h) => sum + h.sale, 0).toFixed(2));
    const totalPaid = Number(history.reduce((sum, h) => sum + h.paid, 0).toFixed(2));
    const totalDue = Number(history.reduce((sum, h) => sum + h.due, 0).toFixed(2));

    const advBal = await this.getCustomerAdvanceBalance(customerId);

    return {
      customer,
      history,
      monthly_summary: {
        total_milk: totalMilk,
        total_sales: totalSales,
        total_paid: totalPaid,
        total_due: totalDue,
        advance_balance: advBal.available_balance,
      },
    };
  }

  /**
   * Get 100% database-driven dashboard metrics (Phase 6)
   */
  public async getDashboardStats(date: string, centerId?: string): Promise<{
    date: string;
    today_milk: number;
    morning_milk: number;
    evening_milk: number;
    today_sales: number;
    today_paid: number;
    today_due: number;
    active_suppliers: number;
    collection_centers: number;
    center_breakdown: Array<{
      center_id: string;
      center_name: string;
      morning_milk: number;
      evening_milk: number;
      today_total: number;
      today_sales: number;
      today_paid: number;
      today_due: number;
      registered_suppliers: number;
    }>;
    recent_deliveries: Array<{
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
    recent_payments: Array<{
      id: string;
      customer_name: string;
      customer_code: string;
      amount: number;
      payment_type: string;
      payment_mode: string;
      reference_id: string;
      date: string;
    }>;
    pending_balances: Array<{
      customer_id: string;
      customer_name: string;
      customer_code: string;
      center_name: string;
      sale: number;
      paid: number;
      due: number;
    }>;
    weekly_collection: Array<{
      date: string;
      day: string;
      morning: number;
      evening: number;
      total: number;
    }>;
  }> {
    const centerFilter = centerId && centerId !== 'all' ? centerId : undefined;

    // 1. Center Totals
    const centerTotalsData = await this.getCenterTotals(date);

    // 2. Daily Payment & Sales Summaries
    const dailySummaries = await this.getDailyPaymentSummaries({
      date,
      center_id: centerFilter,
    });

    const todayMilk = centerTotalsData.overall.daily_total;
    const morningMilk = centerTotalsData.overall.morning_total;
    const eveningMilk = centerTotalsData.overall.evening_total;

    const todaySales = Number(dailySummaries.reduce((sum, s) => sum + s.sale, 0).toFixed(2));
    const todayPaid = Number(dailySummaries.reduce((sum, s) => sum + s.paid, 0).toFixed(2));
    const todayDue = Number(dailySummaries.reduce((sum, s) => sum + s.due, 0).toFixed(2));

    const { customers } = await this.getCustomers({ center_id: centerFilter, status: 'active' });
    const allCenters = await this.getCenters();

    // 3. Center breakdown
    const centerBreakdown = allCenters
      .filter((c) => !centerFilter || c.id === centerFilter)
      .map((c) => {
        const ct = centerTotalsData.centers.find((item) => item.center_id === c.id);
        const centerSummaries = dailySummaries.filter((s) => s.center_id === c.id);
        const centerSuppliers = customers.filter((cust) => cust.center_id === c.id || cust.collection_center_id === c.id);

        return {
          center_id: c.id,
          center_name: c.center_name || c.name || 'Center',
          morning_milk: ct?.morning_total || 0,
          evening_milk: ct?.evening_total || 0,
          today_total: ct?.daily_total || 0,
          today_sales: Number(centerSummaries.reduce((sum, s) => sum + s.sale, 0).toFixed(2)),
          today_paid: Number(centerSummaries.reduce((sum, s) => sum + s.paid, 0).toFixed(2)),
          today_due: Number(centerSummaries.reduce((sum, s) => sum + s.due, 0).toFixed(2)),
          registered_suppliers: centerSuppliers.length,
        };
      });

    // 4. Recent Deliveries (10 latest)
    let recentDeliveries: any[] = [];
    if (this.isConnected && this.pool) {
      try {
        const [rows]: any = await this.pool.query(
          `SELECT del.*, cust.name AS customer_name, cust.customer_code, c.center_name, cust.rate
           FROM deliveries del
           JOIN customers cust ON cust.id = del.customer_id
           JOIN collection_centers c ON c.id = del.center_id
           ORDER BY del.date DESC, del.created_at DESC LIMIT 8`
        );
        recentDeliveries = rows.map((r: any) => ({
          id: r.id,
          customer_name: r.customer_name,
          customer_code: r.customer_code,
          center_name: r.center_name,
          session: r.session,
          actual_qty: Number(r.actual_qty),
          status: r.status,
          total_amount: Number((Number(r.actual_qty) * Number(r.rate || 60.0)).toFixed(2)),
          date: typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().split('T')[0],
        }));
      } catch (err) {
        console.error('[TiDB] Error fetching recent deliveries:', err);
      }
    } else {
      recentDeliveries = [...this.fallbackDeliveries]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8)
        .map((d) => ({
          id: d.id,
          customer_name: d.customer_name || 'Customer',
          customer_code: d.customer_code || 'SUP',
          center_name: d.center_name || 'Center',
          session: d.session,
          actual_qty: Number(d.actual_qty),
          status: d.status,
          total_amount: Number(d.total_amount || 0),
          date: d.date,
        }));
    }

    // 5. Recent Payments (8 latest)
    const recentPaymentsRaw = await this.getPayments({});
    const recentPayments = recentPaymentsRaw.slice(0, 8).map((p) => ({
      id: p.id,
      customer_name: p.customer_name || 'Customer',
      customer_code: p.customer_code || 'SUP',
      amount: p.amount,
      payment_type: p.payment_type,
      payment_mode: p.payment_mode,
      reference_id: p.reference_id || '---',
      date: p.date,
    }));

    // 6. Pending Balances (Top suppliers with due > 0)
    const pendingBalances = dailySummaries
      .filter((s) => s.due > 0)
      .sort((a, b) => b.due - a.due)
      .slice(0, 6)
      .map((s) => ({
        customer_id: s.customer_id,
        customer_name: s.customer_name,
        customer_code: s.customer_code,
        center_name: s.center_name,
        sale: s.sale,
        paid: s.paid,
        due: s.due,
      }));

    // 7. Weekly collection trend (last 7 days)
    const weeklyCollection = [];
    const baseDate = new Date(date);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayTotals = await this.getCenterTotals(dStr);
      weeklyCollection.push({
        date: dStr,
        day: dayName,
        morning: dayTotals.overall.morning_total,
        evening: dayTotals.overall.evening_total,
        total: dayTotals.overall.daily_total,
      });
    }

    return {
      date,
      today_milk: todayMilk,
      morning_milk: morningMilk,
      evening_milk: eveningMilk,
      today_sales: todaySales,
      today_paid: todayPaid,
      today_due: todayDue,
      active_suppliers: customers.length,
      collection_centers: allCenters.length,
      center_breakdown: centerBreakdown,
      recent_deliveries: recentDeliveries,
      recent_payments: recentPayments,
      pending_balances: pendingBalances,
      weekly_collection: weeklyCollection,
    };
  }

  // ==========================================
  // STATUS & DIAGNOSTICS
  // ==========================================

  public async getStatus(): Promise<DBStatus> {
    let usersCount = this.fallbackUsers.length;
    let centersCount = this.fallbackCenters.length;
    let customersCount = this.fallbackCustomers.length;

    if (this.isConnected && this.pool) {
      try {
        const [uRows]: any = await this.pool.query('SELECT COUNT(*) as count FROM users');
        usersCount = uRows[0]?.count || 0;

        const [cRows]: any = await this.pool.query('SELECT COUNT(*) as count FROM collection_centers');
        centersCount = cRows[0]?.count || 0;

        const [custRows]: any = await this.pool.query('SELECT COUNT(*) as count FROM customers');
        customersCount = custRows[0]?.count || 0;
      } catch (e) {
        // query error
      }
    }

    return {
      connected: this.isConnected,
      type: this.isConnected ? 'tidb' : 'local_fallback',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 4000,
      database: process.env.DB_NAME || 'milkhub',
      usersCount,
      centersCount,
      customersCount,
      error: this.connectionError || undefined,
      lastChecked: new Date().toISOString(),
    };
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  public hasConnection(): boolean {
    return this.isConnected;
  }
}

export const tidb = new TiDBService();
