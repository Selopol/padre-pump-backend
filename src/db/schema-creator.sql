-- Padre Pump.fun Backend Database Schema - Creator Tracking
-- PostgreSQL 16+
-- Tracks token creators via Twitter (tweet authors or community creators)

-- Drop tables if they exist (for clean migration)
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;
DROP TABLE IF EXISTS coins CASCADE;
DROP TABLE IF EXISTS creators CASCADE;

-- Table: creators
-- Stores Twitter accounts and their token creation statistics
CREATE TABLE creators (
  id SERIAL PRIMARY KEY,
  twitter_handle VARCHAR(100) UNIQUE NOT NULL,
  twitter_id VARCHAR(50) UNIQUE,
  twitter_name VARCHAR(200),
  twitter_profile_url TEXT,
  total_coins INTEGER DEFAULT 0,
  migrated_coins INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00,
  last_coin_mint VARCHAR(44),
  last_coin_symbol VARCHAR(50),
  last_coin_created_at BIGINT,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for creators table
CREATE INDEX idx_creators_twitter_handle ON creators(twitter_handle);
CREATE INDEX idx_creators_twitter_id ON creators(twitter_id);
CREATE INDEX idx_creators_success_rate ON creators(success_rate DESC);
CREATE INDEX idx_creators_total_coins ON creators(total_coins DESC);
CREATE INDEX idx_creators_last_updated ON creators(last_updated_at DESC);

-- Table: coins
-- Stores all tokens created on Pump.fun with Twitter association
CREATE TABLE coins (
  id SERIAL PRIMARY KEY,
  mint VARCHAR(44) UNIQUE NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  name VARCHAR(200),
  description TEXT,
  image_uri TEXT,
  creator_twitter_handle VARCHAR(100),
  twitter_url TEXT,
  twitter_type VARCHAR(20), -- 'tweet' or 'community'
  created_timestamp BIGINT NOT NULL,
  is_migrated BOOLEAN DEFAULT FALSE,
  migrated_at BIGINT,
  market_cap DECIMAL(20,2),
  bonding_curve VARCHAR(44),
  metadata JSONB,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (creator_twitter_handle) REFERENCES creators(twitter_handle) ON DELETE SET NULL
);

-- Indexes for coins table
CREATE INDEX idx_coins_mint ON coins(mint);
CREATE INDEX idx_coins_creator_twitter ON coins(creator_twitter_handle);
CREATE INDEX idx_coins_created_timestamp ON coins(created_timestamp DESC);
CREATE INDEX idx_coins_is_migrated ON coins(is_migrated);
CREATE INDEX idx_coins_migrated_at ON coins(migrated_at DESC);
CREATE INDEX idx_coins_symbol ON coins(symbol);
CREATE INDEX idx_coins_twitter_type ON coins(twitter_type);

-- Table: migrations
-- Tracks migration events for analytics
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  coin_mint VARCHAR(44) NOT NULL,
  creator_twitter_handle VARCHAR(100),
  migrated_at BIGINT NOT NULL,
  detected_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (coin_mint) REFERENCES coins(mint) ON DELETE CASCADE,
  FOREIGN KEY (creator_twitter_handle) REFERENCES creators(twitter_handle) ON DELETE SET NULL
);

-- Indexes for migrations table
CREATE INDEX idx_migrations_creator ON migrations(creator_twitter_handle);
CREATE INDEX idx_migrations_migrated_at ON migrations(migrated_at DESC);
CREATE INDEX idx_migrations_detected_at ON migrations(detected_at DESC);

-- Table: alerts
-- Stores alerts for new coins from tracked creators
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  coin_mint VARCHAR(44) NOT NULL,
  creator_twitter_handle VARCHAR(100),
  triggered_at TIMESTAMP DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  alert_data JSONB,
  FOREIGN KEY (coin_mint) REFERENCES coins(mint) ON DELETE CASCADE,
  FOREIGN KEY (creator_twitter_handle) REFERENCES creators(twitter_handle) ON DELETE SET NULL
);

-- Indexes for alerts table
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX idx_alerts_is_read ON alerts(is_read);
CREATE INDEX idx_alerts_creator ON alerts(creator_twitter_handle);

-- Function to update last_updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update last_updated_at
CREATE TRIGGER update_creators_updated_at BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coins_updated_at BEFORE UPDATE ON coins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: creator_stats
-- Aggregated statistics for quick queries
CREATE OR REPLACE VIEW creator_stats AS
SELECT 
  cr.id,
  cr.twitter_handle,
  cr.twitter_id,
  cr.twitter_name,
  cr.total_coins,
  cr.migrated_coins,
  cr.success_rate,
  cr.last_coin_symbol,
  cr.last_coin_created_at,
  COUNT(DISTINCT c.id) as actual_coin_count,
  COUNT(DISTINCT CASE WHEN c.is_migrated THEN c.id END) as actual_migration_count,
  cr.last_updated_at
FROM creators cr
LEFT JOIN coins c ON c.creator_twitter_handle = cr.twitter_handle
GROUP BY cr.id, cr.twitter_handle, cr.twitter_id, cr.twitter_name, cr.total_coins, 
         cr.migrated_coins, cr.success_rate, cr.last_coin_symbol, cr.last_coin_created_at, 
         cr.last_updated_at;

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
  c.twitter_url as coin_twitter_url,
  c.created_timestamp as coin_created_at,
  cr.twitter_handle as creator_handle,
  cr.twitter_name as creator_name,
  cr.migrated_coins as creator_migrations,
  cr.success_rate as creator_success_rate,
  cr.total_coins as creator_total_coins,
  cr.last_coin_symbol as creator_last_coin_symbol,
  cr.last_coin_created_at as creator_last_coin_at
FROM alerts a
JOIN coins c ON a.coin_mint = c.mint
LEFT JOIN creators cr ON a.creator_twitter_handle = cr.twitter_handle
ORDER BY a.triggered_at DESC;

-- Initial data validation
COMMENT ON TABLE creators IS 'Twitter accounts (tweet authors or community creators) with token creation history';
COMMENT ON TABLE coins IS 'All tokens created on Pump.fun with Twitter association';
COMMENT ON TABLE migrations IS 'Historical migration events';
COMMENT ON TABLE alerts IS 'Alerts for new coins from tracked creators';
