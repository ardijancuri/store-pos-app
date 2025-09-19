-- Store POS Database Setup for Supabase
-- Run this script in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for email
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique 
ON users (email) 
WHERE email IS NOT NULL;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  imei VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  stock_status VARCHAR(50) NOT NULL DEFAULT 'enabled' CHECK (stock_status IN ('enabled', 'disabled')),
  category VARCHAR(50) NOT NULL DEFAULT 'accessories' CHECK (category IN ('accessories', 'smartphones')),
  subcategory VARCHAR(50),
  model VARCHAR(100),
  color VARCHAR(50),
  storage_gb VARCHAR(50),
  barcode VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_managers table
CREATE TABLE IF NOT EXISTS shop_managers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  guest_name VARCHAR(255) NOT NULL,
  guest_note TEXT,
  guest_phone VARCHAR(50) NOT NULL,
  guest_embg VARCHAR(50),
  guest_id_card VARCHAR(50),
  shop_manager_id INTEGER NOT NULL REFERENCES shop_managers(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_currency VARCHAR(10) DEFAULT 'EUR',
  original_total DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL DEFAULT 'POS CRM System',
  company_address TEXT,
  company_city_state VARCHAR(255),
  company_phone VARCHAR(100),
  company_email VARCHAR(255),
  exchange_rate DECIMAL(10,2) DEFAULT 61.50,
  smartphone_subcategories JSONB,
  accessory_subcategories JSONB,
  smartphone_models JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  contact VARCHAR(255) NOT NULL,
  phone_model VARCHAR(255) NOT NULL,
  imei VARCHAR(255),
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'in_service' CHECK (status IN ('in_service', 'completed')),
  profit DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Create trigram indexes for fast search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_imei_trgm ON products USING gin (imei gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_color_trgm ON products USING gin (color gin_trgm_ops);

-- Insert default settings
INSERT INTO settings (company_name, company_address, company_city_state, company_phone, company_email, smartphone_subcategories, accessory_subcategories, smartphone_models)
VALUES (
  'POS CRM System',
  '123 Business Street',
  'City, State 12345',
  '(555) 123-4567',
  'info@poscrm.com',
  '["iPhone","Samsung","Xiaomi"]'::jsonb,
  '["telephone","smart_watch","headphones","tablet"]'::jsonb,
  '[]'::jsonb
) ON CONFLICT DO NOTHING;

-- Create admin user with your specified credentials
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Store Admin',
  'admin@storepos.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- This is 'admin123' hashed
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- Create sample shop manager
INSERT INTO shop_managers (name, phone, is_active)
VALUES (
  'John Manager',
  '+1 (555) 123-4567',
  true
) ON CONFLICT DO NOTHING;

-- Create sample products
INSERT INTO products (name, description, price, stock_quantity, stock_status, category, subcategory, barcode)
VALUES 
  ('iPhone 15 Pro', 'Latest iPhone with advanced features', 999.99, 50, 'enabled', 'smartphones', 'iPhone', 'IPHONE15PRO001'),
  ('Samsung Galaxy S24', 'Premium Android smartphone', 899.99, 45, 'enabled', 'smartphones', 'Samsung', 'SAMSUNGS24001'),
  ('AirPods Pro', 'Wireless earbuds with noise cancellation', 249.99, 100, 'enabled', 'accessories', 'headphones', 'AIRPODSPRO001'),
  ('MacBook Pro 16"', 'Professional laptop for power users', 2499.99, 20, 'enabled', 'accessories', 'tablet', 'MACBOOKPRO001'),
  ('iPad Air', 'Versatile tablet for work and play', 599.99, 75, 'enabled', 'accessories', 'tablet', 'IPADAIR001'),
  ('Apple Watch Series 9', 'Advanced smartwatch with health features', 399.99, 60, 'enabled', 'accessories', 'smart_watch', 'APPLEWATCH001'),
  ('USB-C Cable', 'High-quality charging cable', 19.99, 200, 'enabled', 'accessories', 'telephone', 'USBCABLE001'),
  ('Wireless Charger', 'Fast wireless charging pad', 49.99, 80, 'enabled', 'accessories', 'telephone', 'WIRELESSCHARGER001')
ON CONFLICT (barcode) DO NOTHING;

-- Create sample services
INSERT INTO services (full_name, contact, phone_model, imei, description, price, status, profit)
VALUES 
  ('John Smith', '+389 70 123 456', 'iPhone 14 Pro', '123456789012345', 'Screen replacement and battery service', 150.00, 'in_service', 50.00),
  ('Maria Johnson', '+389 71 234 567', 'Samsung Galaxy S23', '987654321098765', 'Water damage repair and charging port replacement', 200.00, 'completed', 80.00),
  ('David Wilson', '+389 72 345 678', 'iPhone 13', '555666777888999', 'Camera module replacement', 120.00, 'in_service', 45.00)
ON CONFLICT DO NOTHING;

-- Grant necessary permissions (if needed)
-- Note: Supabase handles most permissions automatically, but you might need to adjust based on your setup

COMMENT ON TABLE users IS 'Store POS system users (admin and managers)';
COMMENT ON TABLE products IS 'Product inventory for the store';
COMMENT ON TABLE orders IS 'Customer orders and transactions';
COMMENT ON TABLE order_items IS 'Individual items within orders';
COMMENT ON TABLE shop_managers IS 'Store managers who can process orders';
COMMENT ON TABLE settings IS 'System configuration and settings';
COMMENT ON TABLE services IS 'Repair and service orders';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Store POS database setup completed successfully!';
    RAISE NOTICE 'Admin user created: admin@storepos.com / admin123';
    RAISE NOTICE 'Sample data inserted for testing.';
END $$;
