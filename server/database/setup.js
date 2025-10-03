const { pool, run, get, query } = require('./connection');
const bcrypt = require('bcryptjs');

async function setupDatabase() {
  try {

    // Create admin users table (no client role in Store-POS)
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        password_hash VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'services')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique 
      ON users (email) 
      WHERE email IS NOT NULL
    `);

    // Create products table
    await run(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure barcode column exists on products (unique identifier from scans)
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS barcode VARCHAR(255) UNIQUE
    `);

    // Add category and subcategory columns if they don't exist
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'accessories'
    `);
    
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50)
    `);

    // Add color and storage_gb columns if they don't exist
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS model VARCHAR(100)
    `);
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS color VARCHAR(50)
    `);
    
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS storage_gb VARCHAR(50)
    `);

    // Migrate storage_gb to VARCHAR if it was previously numeric
    try {
      await run(`
        ALTER TABLE products
        ALTER COLUMN storage_gb TYPE VARCHAR(50) USING storage_gb::text
      `);
    } catch (e) {
      // Column may already be VARCHAR; ignore
    }

    // Add imei column if it doesn't exist
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS imei VARCHAR(255)
    `);

    // Add battery column if it doesn't exist
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS battery INTEGER
    `);

    // Add client-related columns if they don't exist
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS fromClient BOOLEAN DEFAULT false
    `);
    
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS clientName VARCHAR(255)
    `);
    
    await run(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS contact VARCHAR(255)
    `);

    // Remove image column if it exists (this will fail if column doesn't exist, but that's okay)
    try {
      await run(`
        ALTER TABLE products
        DROP COLUMN IF EXISTS image
      `);
    } catch (error) {
    }

    // Create shop_managers table
    await run(`
      CREATE TABLE IF NOT EXISTS shop_managers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create orders table for POS (no client functionality, required shop_manager_id)
    await run(`
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
      )
    `);

    // Add guest EMBG and ID card columns if they don't exist
    await run(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS guest_embg VARCHAR(50)
    `);
    await run(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS guest_id_card VARCHAR(50)
    `);

    // Create order_items table
    await run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      )
    `);

    // Ensure reporting columns exist on orders table
    await run(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00
    `);
    await run(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS discount_currency VARCHAR(10) DEFAULT 'EUR'
    `);
    await run(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS original_total DECIMAL(10,2) DEFAULT 0.00
    `);

    // Migration: Replace guest_email with guest_note
    await run(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS guest_note TEXT
    `);
    await run(`
      ALTER TABLE orders
      DROP COLUMN IF EXISTS guest_email
    `);

    // Migration: Remove email column from shop_managers
    await run(`
      ALTER TABLE shop_managers
      DROP COLUMN IF EXISTS email
    `);

    // Create settings table
    await run(`
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
      )
    `);

    // Ensure subcategory arrays exist with defaults
    await run(`
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS smartphone_subcategories JSONB
    `);
    await run(`
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS accessory_subcategories JSONB
    `);

    // Add exchange_rate column for existing databases
    await run(`
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,2) DEFAULT 61.50
    `);
    await run(`
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS smartphone_models JSONB
    `);

    // Backfill defaults for existing settings rows where new columns are NULL
    await run(`
      UPDATE settings
      SET smartphone_subcategories = '["iPhone","Samsung","Xiaomi"]'::jsonb
      WHERE smartphone_subcategories IS NULL
    `);
    await run(`
      UPDATE settings
      SET accessory_subcategories = '["telephone","smart_watch","headphones","tablet"]'::jsonb
      WHERE accessory_subcategories IS NULL
    `);
    await run(`
      UPDATE settings
      SET smartphone_models = '[]'::jsonb
      WHERE smartphone_models IS NULL
    `);

    // Create models table for managing smartphone models
    await run(`
      CREATE TABLE IF NOT EXISTS models (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        price DECIMAL(10,2),
        warranty INTEGER,
        storages JSONB DEFAULT '[]'::jsonb,
        colors JSONB DEFAULT '[]'::jsonb,
        condition VARCHAR(100),
        subcategory VARCHAR(100),
        storage_prices JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for models table
    await run(`CREATE INDEX IF NOT EXISTS idx_models_name ON models(name)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_models_subcategory ON models(subcategory)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_models_condition ON models(condition)`);


    // Create services table
    await run(`
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
      )
    `);

    // ------------------------
    // Performance indexes
    // ------------------------
    try {
      // Orders
      await run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`);

      // Order items
      await run(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)`);

      // Products
      await run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory)`);
      await run(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);


      // Enable trigram extension for fast ILIKE search (optional; ignore if lacking permission)
      try {
        await run(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await run(`CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING gin (description gin_trgm_ops)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_products_imei_trgm ON products USING gin (imei gin_trgm_ops)`);
        await run(`CREATE INDEX IF NOT EXISTS idx_products_color_trgm ON products USING gin (color gin_trgm_ops)`);
      } catch (e) {
      }
    } catch (e) {
    }

    // Insert default settings if table is empty
    const settingsResult = await query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsResult.rows[0].count) === 0) {
      await run(`
        INSERT INTO settings (company_name, company_address, company_city_state, company_phone, company_email, smartphone_subcategories, accessory_subcategories)
        VALUES (
          'POS CRM System',
          '123 Business Street',
          'City, State 12345',
          '(555) 123-4567',
          'info@poscrm.com',
          '["iPhone","Samsung","Xiaomi"]'::jsonb,
          '["telephone","smart_watch","headphones","tablet"]'::jsonb
        )
      `);
    }


    // Check if admin user already exists
    const adminExists = await get('SELECT id FROM users WHERE email = $1', ['admin@storepos.com']);
    
    if (!adminExists) {
      // Create admin user
      const adminPasswordHash = await bcrypt.hash('Admin@2024Secure!', 10);
      await run(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Store Admin', 'admin@storepos.com', adminPasswordHash, 'admin']
      );
    } else {
    }

    // Update role constraint to allow manager and services roles
    await run(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_role_check
    `);
    await run(`
      ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'services'))
    `);

    // Check if manager user already exists
    const managerExists = await get('SELECT id FROM users WHERE email = $1', ['manager@storepos.com']);
    
    if (!managerExists) {
      // Create manager user
      const managerPasswordHash = await bcrypt.hash('Manager@2024!', 10);
      await run(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Store Manager', 'manager@storepos.com', managerPasswordHash, 'manager']
      );
    } else {
    }

    // Check if services user already exists
    const servicesUserExists = await get('SELECT id FROM users WHERE email = $1', ['adem@storepos.com']);
    
    if (!servicesUserExists) {
      // Create services user
      const servicesPasswordHash = await bcrypt.hash('Adem1!', 10);
      await run(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Adem Services', 'adem@storepos.com', servicesPasswordHash, 'services']
      );
    } else {
    }

    // No client seeding for Store-POS

    // Check if sample products exist
    const productCount = await get('SELECT COUNT(*) as count FROM products');
    
    if (productCount.count === 0) {
      // Create sample products with categories
      const sampleProducts = [
        {
          name: 'iPhone 15 Pro',
          description: 'Latest iPhone with advanced features',
          price: 999.99,
          stock_quantity: 50,
          stock_status: 'enabled',
          category: 'smartphones',
          subcategory: null
        },
        {
          name: 'Samsung Galaxy S24',
          description: 'Premium Android smartphone',
          price: 899.99,
          stock_quantity: 45,
          stock_status: 'enabled',
          category: 'smartphones',
          subcategory: null
        },
        {
          name: 'AirPods Pro',
          description: 'Wireless earbuds with noise cancellation',
          price: 249.99,
          stock_quantity: 100,
          stock_status: 'enabled',
          category: 'accessories',
          subcategory: 'headphones'
        },
        {
          name: 'MacBook Pro 16"',
          description: 'Professional laptop for power users',
          price: 2499.99,
          stock_quantity: 20,
          stock_status: 'enabled',
          category: 'accessories',
          subcategory: 'tablet'
        },
        {
          name: 'iPad Air',
          description: 'Versatile tablet for work and play',
          price: 599.99,
          stock_quantity: 75,
          stock_status: 'enabled',
          category: 'accessories',
          subcategory: 'tablet'
        },
        {
          name: 'Apple Watch Series 9',
          description: 'Advanced smartwatch with health features',
          price: 399.99,
          stock_quantity: 60,
          stock_status: 'enabled',
          category: 'accessories',
          subcategory: 'smart_watch'
        },
        {
          name: 'USB-C Cable',
          description: 'High-quality charging cable',
          price: 19.99,
          stock_quantity: 200,
          stock_status: 'enabled',
          category: 'accessories',
          subcategory: 'telephone'
        },
        {
          name: 'Wireless Charger',
          description: 'Fast wireless charging pad',
          price: 49.99,
          stock_quantity: 80,
          stock_status: 'enabled',
          category: 'accessories',
          subcategory: 'telephone'
        }
      ];

      for (const product of sampleProducts) {
        await run(
          'INSERT INTO products (name, description, price, stock_quantity, stock_status, category, subcategory) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [product.name, product.description, product.price, product.stock_quantity, product.stock_status, product.category, product.subcategory]
        );
      }
    } else {
    }

    // Check if sample services exist
    const serviceCount = await get('SELECT COUNT(*) as count FROM services');
    
    if (serviceCount.count === 0) {
      // Create sample services
      const sampleServices = [
        {
          full_name: 'John Smith',
          contact: '+389 70 123 456',
          phone_model: 'iPhone 14 Pro',
          imei: '123456789012345',
          description: 'Screen replacement and battery service',
          price: 150.00,
          status: 'in_service',
          profit: 50.00
        },
        {
          full_name: 'Maria Johnson',
          contact: '+389 71 234 567',
          phone_model: 'Samsung Galaxy S23',
          imei: '987654321098765',
          description: 'Water damage repair and charging port replacement',
          price: 200.00,
          status: 'completed',
          profit: 80.00
        },
        {
          full_name: 'David Wilson',
          contact: '+389 72 345 678',
          phone_model: 'iPhone 13',
          imei: '555666777888999',
          description: 'Camera module replacement',
          price: 120.00,
          status: 'in_service',
          profit: 45.00
        }
      ];

      for (const service of sampleServices) {
        await run(
          'INSERT INTO services (full_name, contact, phone_model, imei, description, price, status, profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [service.full_name, service.contact, service.phone_model, service.imei, service.description, service.price, service.status, service.profit]
        );
      }
    } else {
    }

    // Backfill: regenerate smartphone product names to include subcategory + model + storage + color
    try {
      await run(`
        UPDATE products
        SET name = TRIM(BOTH ' ' FROM CONCAT_WS(' ', subcategory, model, storage_gb, color))
        WHERE category = 'smartphones'
      `);
    } catch (e) {
    }


  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase(); 
