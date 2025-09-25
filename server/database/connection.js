const { Pool } = require('pg');
const path = require('path');

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
}

// Debug environment variables in production
if (process.env.NODE_ENV === 'production') {
  console.log('Database config:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    hasPassword: !!process.env.DB_PASSWORD
  });
}

// PostgreSQL connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pos_crm_store',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('connect', () => {
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to run queries with promises
const query = (sql, params = []) => {
  return pool.query(sql, params);
};

// Helper function to run single queries (for INSERT, UPDATE, DELETE)
const run = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return { 
    id: result.rows[0]?.id || result.rows[0]?.id, 
    changes: result.rowCount 
  };
};

// Helper function to get a single row
const get = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
};

// Helper function to get all rows
const all = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

module.exports = { pool, query, run, get, all }; 
