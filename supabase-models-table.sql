-- Create models table for Supabase
CREATE TABLE IF NOT EXISTS models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  price DECIMAL(10,2),
  warranty INTEGER, -- warranty in months, NULL means no warranty
  storages JSONB DEFAULT '[]'::jsonb, -- array of storage options
  colors JSONB DEFAULT '[]'::jsonb, -- array of color options
  condition VARCHAR(100),
  subcategory VARCHAR(100),
  storage_prices JSONB DEFAULT '{}'::jsonb, -- object with storage as key and price as value
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_models_name ON models(name);
CREATE INDEX IF NOT EXISTS idx_models_subcategory ON models(subcategory);
CREATE INDEX IF NOT EXISTS idx_models_condition ON models(condition);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_models_updated_at
  BEFORE UPDATE ON models
  FOR EACH ROW
  EXECUTE FUNCTION update_models_updated_at();

