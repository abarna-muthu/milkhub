-- TiDB / MySQL Database Schema for MilkHub Milk Collection & Dairy CRM (Developed by Gen Z Neural-X)

CREATE TABLE IF NOT EXISTS collection_centers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  code VARCHAR(32) UNIQUE NOT NULL,
  phone VARCHAR(32),
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(32) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') DEFAULT 'staff',
  collection_center_id VARCHAR(64),
  status ENUM('active', 'inactive') DEFAULT 'active',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_center_id) REFERENCES collection_centers(id)
);

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  customer_code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(32) NOT NULL,
  address TEXT,
  village VARCHAR(255) NOT NULL,
  cow_count INT DEFAULT 0,
  buffalo_count INT DEFAULT 0,
  default_session ENUM('morning', 'evening', 'both') DEFAULT 'both',
  collection_center_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_center_id) REFERENCES collection_centers(id)
);

CREATE TABLE IF NOT EXISTS milk_rates (
  id VARCHAR(64) PRIMARY KEY,
  pricing_type ENUM('fixed', 'fat_snf') DEFAULT 'fat_snf',
  base_rate DECIMAL(10,2) NOT NULL,
  standard_fat DECIMAL(4,2) DEFAULT 4.0,
  standard_snf DECIMAL(4,2) DEFAULT 8.5,
  fat_rate DECIMAL(6,2) DEFAULT 3.0,
  snf_rate DECIMAL(6,2) DEFAULT 2.0,
  effective_date DATE NOT NULL,
  updated_by VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS milk_collections (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  collection_center_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  session ENUM('morning', 'evening') NOT NULL,
  animal_type ENUM('cow', 'buffalo') DEFAULT 'cow',
  quantity DECIMAL(8,2) NOT NULL,
  fat_percentage DECIMAL(4,2) NOT NULL,
  snf_percentage DECIMAL(4,2) NOT NULL,
  calculated_rate DECIMAL(8,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('collected', 'verified', 'cancelled') DEFAULT 'collected',
  collected_by VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (collection_center_id) REFERENCES collection_centers(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  collection_center_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'upi', 'bank_transfer') DEFAULT 'cash',
  reference_no VARCHAR(128),
  status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
  notes TEXT,
  created_by VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (collection_center_id) REFERENCES collection_centers(id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id VARCHAR(64) PRIMARY KEY,
  settlement_code VARCHAR(64) UNIQUE NOT NULL,
  customer_id VARCHAR(64) NOT NULL,
  collection_center_id VARCHAR(64) NOT NULL,
  month_year VARCHAR(16) NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  total_milk DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  previous_paid DECIMAL(10,2) NOT NULL,
  pending_amount DECIMAL(10,2) NOT NULL,
  settled_amount DECIMAL(10,2) NOT NULL,
  status ENUM('settled', 'partial') DEFAULT 'settled',
  confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_by VARCHAR(255) NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (collection_center_id) REFERENCES collection_centers(id)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  milk_quantity DECIMAL(8,2),
  debit DECIMAL(10,2) DEFAULT 0,
  credit DECIMAL(10,2) DEFAULT 0,
  running_balance DECIMAL(10,2) NOT NULL,
  reference_type ENUM('collection', 'payment', 'settlement', 'opening') NOT NULL,
  reference_id VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(64) PRIMARY KEY,
  collection_center_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  category ENUM('transport', 'salary', 'maintenance', 'electricity', 'equipment', 'other') NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'upi', 'bank_transfer') DEFAULT 'cash',
  notes TEXT,
  added_by VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_center_id) REFERENCES collection_centers(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('payment', 'settlement', 'supplier', 'rate', 'collection', 'system') NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  target_user_id VARCHAR(64)
);
