-- Create the database
CREATE DATABASE pos_crm_store;

-- Create the user
CREATE USER postgres_store WITH PASSWORD 'Ardijan3!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE pos_crm_store TO postgres_store;

-- Connect to the new database
\c pos_crm_store;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO postgres_store;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres_store;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres_store;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres_store;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres_store;
