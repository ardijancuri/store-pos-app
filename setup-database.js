const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read the environment configuration
const envContent = fs.readFileSync(path.join(__dirname, 'env.config'), 'utf8');
const envLines = envContent.split('\n');
const envConfig = {};

envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envConfig[key.trim()] = value.trim();
  }
});

// Connect to PostgreSQL as superuser to create database and user
const adminPool = new Pool({
  host: envConfig.DB_HOST || 'localhost',
  port: envConfig.DB_PORT || 5432,
  database: 'postgres', // Connect to default postgres database
  user: 'postgres', // Use postgres superuser
  password: '', // You'll need to provide the postgres password
});

async function setupDatabase() {
  try {
    console.log('🚀 Setting up PostgreSQL database and user...');
    
    // You'll need to provide the postgres password when prompted
    console.log('Please enter the postgres superuser password when prompted...');
    
    // Create database
    await adminPool.query('CREATE DATABASE pos_crm_store;');
    console.log('✅ Database pos_crm_store created successfully');
    
    // Create user
    await adminPool.query(`CREATE USER postgres_store WITH PASSWORD '${envConfig.DB_PASSWORD}';`);
    console.log('✅ User postgres_store created successfully');
    
    // Grant privileges
    await adminPool.query('GRANT ALL PRIVILEGES ON DATABASE pos_crm_store TO postgres_store;');
    console.log('✅ Privileges granted to postgres_store user');
    
    // Grant schema privileges
    await adminPool.query('GRANT ALL ON SCHEMA public TO postgres_store;');
    await adminPool.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres_store;');
    await adminPool.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres_store;');
    await adminPool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres_store;');
    await adminPool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres_store;');
    console.log('✅ Schema privileges granted to postgres_store user');
    
    console.log('🎉 Database and user setup completed successfully!');
    console.log('\n📋 Database Configuration:');
    console.log(`   Host: ${envConfig.DB_HOST}`);
    console.log(`   Port: ${envConfig.DB_PORT}`);
    console.log(`   Database: ${envConfig.DB_NAME}`);
    console.log(`   User: ${envConfig.DB_USER}`);
    console.log(`   Password: ${envConfig.DB_PASSWORD}`);
    console.log('\n🔗 You can now run: npm run setup-db');
    
  } catch (error) {
    if (error.code === '42P04') {
      console.log('ℹ️  Database pos_crm_store already exists');
    } else if (error.code === '42710') {
      console.log('ℹ️  User postgres_store already exists');
    } else {
      console.error('❌ Error setting up database:', error.message);
      console.log('\n💡 Make sure PostgreSQL is running and you have the correct postgres password.');
      console.log('   You can also manually create the database and user using pgAdmin or psql.');
    }
  } finally {
    await adminPool.end();
  }
}

setupDatabase();
