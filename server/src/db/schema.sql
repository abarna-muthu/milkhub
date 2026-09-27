-- MILK BUSINESS CRM - TiDB Database Schema
-- Blueprint Reference: React + Node.js + TiDB
-- Customer has NO LOGIN • Owner is the primary system user

-- Phase 1 Table: users (Owner Authentication)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Phase 2 Table: customers (Customer CRUD, Search & Filter)
-- Strict fields: id, name, phone, address, area, default_morning_qty, default_evening_qty, rate, start_date, status
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

-- Phase 3 Table: deliveries (Morning & Evening Delivery Workflow)
-- Strict fields: id, customer_id, date, session, actual_qty, status
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

-- Phase 4 Table: sales (Automatic Sales Calculation & Day-wise Sales Display)
-- Strict fields: id, customer_id, date, morning_qty, evening_qty, total_litres, rate, sale_amount
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

-- Phase 5 Table: payments (Daily Payment & Advance Deposit)
-- Strict fields: id, customer_id, date, amount, payment_type, payment_mode
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

-- Phase 5 Table: advance_ledger (Traceable Advance Credit & Automatic Sales Adjustment)
-- Strict fields: id, customer_id, date, type, amount, reference_id
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

