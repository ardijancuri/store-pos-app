-- Additional Performance Indexes for Store POS Database
-- Run this script in your Supabase SQL Editor to optimize query performance

-- ==============================================
-- PRODUCTS TABLE OPTIMIZATIONS
-- ==============================================

-- Index for stock quantity filtering (used in low stock queries)
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);

-- Index for stock status filtering
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);

-- Composite index for category + subcategory filtering (common combination)
CREATE INDEX IF NOT EXISTS idx_products_category_subcategory ON products(category, subcategory);

-- Index for price filtering and sorting
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Index for model filtering
CREATE INDEX IF NOT EXISTS idx_products_model ON products(model);

-- Index for color filtering
CREATE INDEX IF NOT EXISTS idx_products_color ON products(color);

-- Index for storage filtering
CREATE INDEX IF NOT EXISTS idx_products_storage_gb ON products(storage_gb);

-- Composite index for stock status + quantity (for availability queries)
CREATE INDEX IF NOT EXISTS idx_products_status_quantity ON products(stock_status, stock_quantity);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- ==============================================
-- ORDERS TABLE OPTIMIZATIONS
-- ==============================================

-- Index for guest phone lookups (frequently searched)
CREATE INDEX IF NOT EXISTS idx_orders_guest_phone ON orders(guest_phone);

-- Index for guest name searches
CREATE INDEX IF NOT EXISTS idx_orders_guest_name ON orders(guest_name);

-- Index for shop manager lookups
CREATE INDEX IF NOT EXISTS idx_orders_shop_manager_id ON orders(shop_manager_id);

-- Composite index for status + created_at (common sorting/filtering combination)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);

-- Index for total amount filtering/sorting
CREATE INDEX IF NOT EXISTS idx_orders_total_amount ON orders(total_amount);

-- ==============================================
-- ORDER_ITEMS TABLE OPTIMIZATIONS
-- ==============================================

-- Composite index for order_id + product_id (common join pattern)
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);

-- Index for quantity filtering
CREATE INDEX IF NOT EXISTS idx_order_items_quantity ON order_items(quantity);

-- Index for price filtering
CREATE INDEX IF NOT EXISTS idx_order_items_price ON order_items(price);

-- ==============================================
-- SERVICES TABLE OPTIMIZATIONS
-- ==============================================

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at);

-- Index for updated_at sorting
CREATE INDEX IF NOT EXISTS idx_services_updated_at ON services(updated_at);

-- Index for phone model filtering
CREATE INDEX IF NOT EXISTS idx_services_phone_model ON services(phone_model);

-- Index for IMEI lookups
CREATE INDEX IF NOT EXISTS idx_services_imei ON services(imei);

-- Composite index for status + created_at
CREATE INDEX IF NOT EXISTS idx_services_status_created_at ON services(status, created_at DESC);

-- ==============================================
-- SHOP_MANAGERS TABLE OPTIMIZATIONS
-- ==============================================

-- Index for active status filtering
CREATE INDEX IF NOT EXISTS idx_shop_managers_is_active ON shop_managers(is_active);

-- Index for name searches
CREATE INDEX IF NOT EXISTS idx_shop_managers_name ON shop_managers(name);

-- ==============================================
-- USERS TABLE OPTIMIZATIONS
-- ==============================================

-- Index for role filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index for created_at sorting
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ==============================================
-- MODELS TABLE OPTIMIZATIONS (if using models table)
-- ==============================================

-- Index for condition filtering
CREATE INDEX IF NOT EXISTS idx_models_condition ON models(condition);

-- Index for price filtering
CREATE INDEX IF NOT EXISTS idx_models_price ON models(price);

-- Index for warranty filtering
CREATE INDEX IF NOT EXISTS idx_models_warranty ON models(warranty);

-- Composite index for subcategory + condition
CREATE INDEX IF NOT EXISTS idx_models_subcategory_condition ON models(subcategory, condition);

-- ==============================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ==============================================

-- Index only for enabled products (reduces index size)
CREATE INDEX IF NOT EXISTS idx_products_enabled_stock ON products(stock_quantity) 
WHERE stock_status = 'enabled';

-- Index only for completed orders (for reporting)
CREATE INDEX IF NOT EXISTS idx_orders_completed_created_at ON orders(created_at) 
WHERE status = 'completed';

-- Index only for in-service services
CREATE INDEX IF NOT EXISTS idx_services_in_service_created_at ON services(created_at) 
WHERE status = 'in_service';

-- ==============================================
-- ANALYZE TABLES FOR OPTIMIZER STATISTICS
-- ==============================================

-- Update table statistics for better query planning
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE services;
ANALYZE shop_managers;
ANALYZE users;
ANALYZE models;

-- ==============================================
-- SUCCESS MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE 'Database optimization indexes created successfully!';
    RAISE NOTICE 'Query performance should be significantly improved.';
    RAISE NOTICE 'Consider monitoring query performance and adjusting indexes based on actual usage patterns.';
END $$;
