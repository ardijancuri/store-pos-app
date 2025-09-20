-- Create models table
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

-- Migrate existing models from settings to the new models table
DO $$
DECLARE
  settings_record RECORD;
  model_item JSONB;
BEGIN
  -- Get the smartphone_models from settings
  SELECT smartphone_models INTO settings_record FROM settings LIMIT 1;
  
  -- If smartphone_models exists and is not null
  IF settings_record.smartphone_models IS NOT NULL THEN
    -- Loop through each model in the array
    FOR model_item IN SELECT jsonb_array_elements(settings_record.smartphone_models)
    LOOP
      -- Insert each model into the new models table
      INSERT INTO models (
        name,
        price,
        warranty,
        storages,
        colors,
        condition,
        subcategory,
        storage_prices
      ) VALUES (
        model_item->>'name',
        CASE 
          WHEN model_item->>'price' IS NOT NULL AND model_item->>'price' != '' 
          THEN (model_item->>'price')::DECIMAL(10,2)
          ELSE NULL
        END,
        CASE 
          WHEN model_item->>'warranty' IS NOT NULL AND model_item->>'warranty' != '' 
          THEN (model_item->>'warranty')::INTEGER
          ELSE NULL
        END,
        COALESCE(model_item->'storages', '[]'::jsonb),
        COALESCE(model_item->'colors', '[]'::jsonb),
        model_item->>'condition',
        model_item->>'subcategory',
        COALESCE(model_item->'storage_prices', '{}'::jsonb)
      )
      ON CONFLICT (name) DO NOTHING; -- Don't insert if model name already exists
    END LOOP;
  END IF;
END $$;

-- Add some sample models if the table is empty
INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'iPhone 15 Pro', 999.99, 12, '["128GB", "256GB", "512GB"]'::jsonb, '["Black", "White", "Blue"]'::jsonb, 'New', 'iPhone', '{"128GB": 999.99, "256GB": 1099.99, "512GB": 1299.99}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'iPhone 15 Pro');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'Samsung Galaxy S24', 899.99, 12, '["128GB", "256GB"]'::jsonb, '["Black", "White"]'::jsonb, 'New', 'Samsung', '{"128GB": 899.99, "256GB": 999.99}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'Samsung Galaxy S24');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'AirPods Pro', 249.99, 12, '[]'::jsonb, '["White"]'::jsonb, 'New', 'headphones', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'AirPods Pro');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'MacBook Pro 16"', 2499.99, 12, '["512GB", "1TB"]'::jsonb, '["Silver", "Space Gray"]'::jsonb, 'New', 'tablet', '{"512GB": 2499.99, "1TB": 2799.99}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'MacBook Pro 16"');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'iPad Air', 599.99, 12, '["64GB", "256GB"]'::jsonb, '["Blue", "Pink", "Purple"]'::jsonb, 'New', 'tablet', '{"64GB": 599.99, "256GB": 749.99}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'iPad Air');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'Apple Watch Series 9', 399.99, 12, '[]'::jsonb, '["Black", "Silver", "Gold"]'::jsonb, 'New', 'smart_watch', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'Apple Watch Series 9');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'USB-C Cable', 19.99, NULL, '[]'::jsonb, '["Black", "White"]'::jsonb, 'New', 'telephone', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'USB-C Cable');

INSERT INTO models (name, price, warranty, storages, colors, condition, subcategory, storage_prices)
SELECT 'Wireless Charger', 49.99, NULL, '[]'::jsonb, '["Black", "White"]'::jsonb, 'New', 'telephone', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM models WHERE name = 'Wireless Charger');
