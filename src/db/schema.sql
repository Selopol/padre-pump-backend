-- Padre Pump.fun Backend Database Schema
-- PostgreSQL 16+

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;
DROP TABLE IF EXISTS coins CASCADE;
DROP TABLE IF EXISTS developers CASCADE;

-- Table: developers
-- Stores wallet addresses and their migration statistics
CREATE TABLE developers (
  id SERIAL PRIMARY KEY,
  address VARCHAR(44) UNIQUE NOT NULL,
  total_coins INTEGER DEFAULT 0,
  migration_count INTEGER DEFAULT 0,
  migration_rate DECIMAL(5,2) DEFAULT 0.00,
  last_migrated_coin_symbol VARCHAR(50),
  last_migrated_coin_mint VARCHAR(44),
  last_migrated_timestamp BIGINT,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for developers table
CREATE INDEX idx_developers_address ON developers(address);
CREATE INDEX idx_developers_migration_count ON developers(migration_count);
CREATE INDEX idx_developers_migration_rate ON developers(migration_rate);
CREATE INDEX idx_developers_last_updated ON developers(last_updated_at);

-- Table: coins
-- Stores all tokens created on Pump.fun
CREATE TABLE coins (
  id SERIAL PRIMARY KEY,
  mint VARCHAR(44) UNIQUE NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  name VARCHAR(200),
  description TEXT,
  image_uri TEXT,
  creator_address VARCHAR(44) NOT NULL,
  created_timestamp BIGINT NOT NULL,
  is_migrated BOOLEAN DEFAULT FALSE,
  migrated_at BIGINT,
  market_cap DECIMAL(20,2),
  bonding_curve VARCHAR(44),
  metadata JSONB,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (creator_address) REFERENCES developers(address) ON DELETE CASCADE
);

-- Indexes for coins table
CREATE INDEX idx_coins_mint ON coins(mint);
CREATE INDEX idx_coins_creator ON coins(creator_address);
CREATE INDEX idx_coins_created_timestamp ON coins(created_timestamp DESC);
CREATE INDEX idx_coins_is_migrated ON coins(is_migrated);
CREATE INDEX idx_coins_migrated_at ON coins(migrated_at DESC);
CREATE INDEX idx_coins_symbol ON coins(symbol);

-- Table: migrations
-- Tracks migration events for analytics
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  coin_mint VARCHAR(44) NOT NULL,
  developer_address VARCHAR(44) NOT NULL,
  migrated_at BIGINT NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (coin_mint) REFERENCES coins(mint) ON DELETE CASCADE,
  FOREIGN KEY (developer_address) REFERENCES developers(address) ON DELETE CASCADE
);

-- Indexes for migrations table
CREATE INDEX idx_migrations_developer ON migrations(developer_address);
CREATE INDEX idx_migrations_migrated_at ON migrations(migrated_at DESC);
CREATE INDEX idx_migrations_detected_at ON migrations(detected_at DESC);

-- Table: alerts
-- Stores alerts for new coins from tracked developers
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  coin_mint VARCHAR(44) NOT NULL,
  developer_address VARCHAR(44) NOT NULL,
  triggered_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  alert_data JSONB,
  FOREIGN KEY (coin_mint) REFERENCES coins(mint) ON DELETE CASCADE,
  FOREIGN KEY (developer_address) REFERENCES developers(address) ON DELETE CASCADE
);

-- Indexes for alerts table
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_is_read ON alerts(is_read);
CREATE INDEX idx_alerts_developer ON alerts(developer_address);

-- Function to update last_updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update last_updated_at
CREATE TRIGGER update_developers_updated_at BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coins_updated_at BEFORE UPDATE ON coins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: developer_stats
-- Aggregated statistics for quick queries
CREATE OR REPLACE VIEW developer_stats AS
SELECT 
  d.id,
  d.address,
  d.total_coins,
  d.migration_count,
  d.migration_rate,
  d.last_migrated_coin_symbol,
  d.last_migrated_timestamp,
  COUNT(DISTINCT c.id) as actual_coin_count,
  COUNT(DISTINCT CASE WHEN c.is_migrated THEN c.id END) as actual_migration_count,
  d.last_updated_at
FROM developers d
LEFT JOIN coins c ON c.creator_address = d.address
GROUP BY d.id, d.address, d.total_coins, d.migration_count, d.migration_rate, 
         d.last_migrated_coin_symbol, d.last_migrated_timestamp, d.last_updated_at;

-- View: recent_alerts
-- Recent unread alerts with full details
CREATE OR REPLACE VIEW recent_alerts AS
SELECT 
  a.id,
  a.triggered_at,
  a.is_read,
  c.mint as coin_mint,
  c.symbol as coin_symbol,
  c.name as coin_name,
  c.image_uri as coin_image,
  c.created_timestamp as coin_created_at,
  d.address as developer_address,
  d.migration_count as developer_migrations,
  d.migration_rate as developer_migration_rate,
  d.total_coins as developer_total_coins,
  d.last_migrated_coin_symbol as developer_last_migrated_symbol,
  d.last_migrated_timestamp as developer_last_migrated_at
FROM alerts a
JOIN coins c ON a.coin_mint = c.mint
JOIN developers d ON a.developer_address = d.address
ORDER BY a.triggered_at DESC;

-- Initial data validation
COMMENT ON TABLE developers IS 'Wallet addresses with migration history';
COMMENT ON TABLE coins IS 'All tokens created on Pump.fun';
COMMENT ON TABLE migrations IS 'Historical migration events';
COMMENT ON TABLE alerts IS 'Alerts for new coins from tracked developers';
