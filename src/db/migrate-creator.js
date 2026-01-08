/**
 * Creator Schema Migration Script
 * Applies the creator tracking database schema
 */

const fs = require('fs');
const path = require('path');

/**
 * Run migration
 */
async function runMigration(pool) {
  try {
    console.log('🛠️  Running creator schema migration...');
    
    const schemaPath = path.join(__dirname, 'schema-creator.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the entire SQL file at once
    // PostgreSQL can handle multiple statements in one query
    await pool.query(schemaSql);
    
    console.log('✅ Creator schema migration completed');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // If it fails, try creating tables individually
    console.log('🔄 Attempting individual table creation...');
    
    try {
      // Drop old tables if they exist
      await pool.query(`DROP TABLE IF EXISTS alerts CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS migrations CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS coins CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS developers CASCADE`);
      await pool.query(`DROP TABLE IF EXISTS creators CASCADE`);
      console.log('  ✅ Dropped old tables');
      
      // Create creators table
      await pool.query(`
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
      `);
      console.log('  ✅ Created creators table');
      
      // Create coins table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coins (
          id SERIAL PRIMARY KEY,
          mint VARCHAR(44) UNIQUE NOT NULL,
          symbol VARCHAR(50) NOT NULL,
          name VARCHAR(200),
          description TEXT,
          image_uri TEXT,
          creator_twitter_handle VARCHAR(100),
          twitter_url TEXT,
          twitter_type VARCHAR(20),
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
      `);
      console.log('  ✅ Created coins table');
      
      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_creators_twitter_handle ON creators(twitter_handle);
        CREATE INDEX IF NOT EXISTS idx_creators_success_rate ON creators(success_rate DESC);
        CREATE INDEX IF NOT EXISTS idx_coins_mint ON coins(mint);
        CREATE INDEX IF NOT EXISTS idx_coins_creator_twitter ON coins(creator_twitter_handle);
        CREATE INDEX IF NOT EXISTS idx_coins_created_timestamp ON coins(created_timestamp DESC);
      `);
      console.log('  ✅ Created indexes');
      
      console.log('✅ Individual table creation completed');
      return true;
    } catch (fallbackError) {
      console.error('❌ Individual table creation also failed:', fallbackError.message);
      return false;
    }
  }
}

module.exports = {
  runMigration
};
