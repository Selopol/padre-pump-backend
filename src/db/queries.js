import { pool } from './connection.js';

// ============================================
// DEVELOPERS
// ============================================

export async function upsertDeveloper(developer) {
  const query = `
    INSERT INTO developers (
      address, 
      total_coins, 
      migration_count, 
      migration_rate,
      last_migrated_coin_symbol,
      last_migrated_coin_mint,
      last_migrated_timestamp
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (address) 
    DO UPDATE SET
      total_coins = EXCLUDED.total_coins,
      migration_count = EXCLUDED.migration_count,
      migration_rate = EXCLUDED.migration_rate,
      last_migrated_coin_symbol = EXCLUDED.last_migrated_coin_symbol,
      last_migrated_coin_mint = EXCLUDED.last_migrated_coin_mint,
      last_migrated_timestamp = EXCLUDED.last_migrated_timestamp,
      last_updated_at = NOW()
    RETURNING *
  `;

  const values = [
    developer.address,
    developer.totalCoins || 0,
    developer.migrationCount || 0,
    developer.migrationRate || 0,
    developer.lastMigratedCoin?.symbol || null,
    developer.lastMigratedCoin?.mint || null,
    developer.lastMigratedCoin?.createdTimestamp || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function getDeveloperByAddress(address) {
  const query = 'SELECT * FROM developers WHERE address = $1';
  const result = await pool.query(query, [address]);
  return result.rows[0];
}

export async function getAllDevelopers(limit = 1000, offset = 0) {
  const query = `
    SELECT * FROM developers 
    WHERE migration_count > 0
    ORDER BY migration_rate DESC, migration_count DESC
    LIMIT $1 OFFSET $2
  `;
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

export async function getDeveloperCount() {
  const query = 'SELECT COUNT(*) as count FROM developers WHERE migration_count > 0';
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

// ============================================
// COINS
// ============================================

export async function upsertCoin(coin) {
  const query = `
    INSERT INTO coins (
      mint,
      symbol,
      name,
      description,
      image_uri,
      creator_address,
      created_timestamp,
      is_migrated,
      migrated_at,
      market_cap,
      bonding_curve,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (mint)
    DO UPDATE SET
      is_migrated = EXCLUDED.is_migrated,
      migrated_at = EXCLUDED.migrated_at,
      market_cap = EXCLUDED.market_cap,
      last_updated_at = NOW()
    RETURNING *
  `;

  const values = [
    coin.mint,
    coin.symbol,
    coin.name || null,
    coin.description || null,
    coin.image_uri || null,
    coin.creator,
    coin.created_timestamp,
    coin.complete || false,
    coin.complete ? coin.created_timestamp : null,
    coin.usd_market_cap || null,
    coin.bonding_curve || null,
    JSON.stringify(coin),
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

export async function getCoinByMint(mint) {
  const query = 'SELECT * FROM coins WHERE mint = $1';
  const result = await pool.query(query, [mint]);
  return result.rows[0];
}

export async function getCoinsByCreator(creatorAddress, limit = 1000) {
  const query = `
    SELECT * FROM coins 
    WHERE creator_address = $1 
    ORDER BY created_timestamp DESC
    LIMIT $2
  `;
  const result = await pool.query(query, [creatorAddress, limit]);
  return result.rows;
}

export async function getRecentCoins(limit = 100) {
  const query = `
    SELECT c.*, d.migration_count, d.migration_rate
    FROM coins c
    JOIN developers d ON c.creator_address = d.address
    WHERE d.migration_count > 0
    ORDER BY c.created_timestamp DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

export async function getTotalCoinsCount() {
  const query = 'SELECT COUNT(*) as count FROM coins';
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

export async function getMigratedCoinsCount() {
  const query = 'SELECT COUNT(*) as count FROM coins WHERE is_migrated = true';
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

// ============================================
// MIGRATIONS
// ============================================

export async function insertMigration(coinMint, developerAddress, migratedAt) {
  const query = `
    INSERT INTO migrations (coin_mint, developer_address, migrated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  const result = await pool.query(query, [coinMint, developerAddress, migratedAt]);
  return result.rows[0];
}

export async function getMigrationsByDeveloper(developerAddress) {
  const query = `
    SELECT m.*, c.symbol, c.name
    FROM migrations m
    JOIN coins c ON m.coin_mint = c.mint
    WHERE m.developer_address = $1
    ORDER BY m.migrated_at DESC
  `;
  const result = await pool.query(query, [developerAddress]);
  return result.rows;
}

export async function getTotalMigrationsCount() {
  const query = 'SELECT COUNT(*) as count FROM migrations';
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

// ============================================
// ALERTS
// ============================================

export async function insertAlert(coinMint, developerAddress, alertData = {}) {
  const query = `
    INSERT INTO alerts (coin_mint, developer_address, alert_data)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await pool.query(query, [coinMint, developerAddress, JSON.stringify(alertData)]);
  return result.rows[0];
}

export async function getRecentAlerts(limit = 50, onlyUnread = false) {
  let query = `
    SELECT * FROM recent_alerts
  `;
  
  if (onlyUnread) {
    query += ' WHERE is_read = false';
  }
  
  query += ' ORDER BY triggered_at DESC LIMIT $1';
  
  const result = await pool.query(query, [limit]);
  return result.rows;
}

export async function markAlertAsRead(alertId) {
  const query = 'UPDATE alerts SET is_read = true WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [alertId]);
  return result.rows[0];
}

export async function getUnreadAlertCount() {
  const query = 'SELECT COUNT(*) as count FROM alerts WHERE is_read = false';
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

// ============================================
// STATISTICS
// ============================================

export async function getSystemStats() {
  const [
    totalDevelopers,
    totalCoins,
    totalMigrations,
    migratedCoins,
    unreadAlerts,
  ] = await Promise.all([
    getDeveloperCount(),
    getTotalCoinsCount(),
    getTotalMigrationsCount(),
    getMigratedCoinsCount(),
    getUnreadAlertCount(),
  ]);

  return {
    totalDevelopers,
    totalCoins,
    totalMigrations,
    migratedCoins,
    unreadAlerts,
    migrationRate: totalCoins > 0 ? ((migratedCoins / totalCoins) * 100).toFixed(2) : 0,
  };
}

// ============================================
// BULK OPERATIONS
// ============================================

export async function bulkUpsertCoins(coins) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results = [];
    for (const coin of coins) {
      const query = `
        INSERT INTO coins (
          mint, symbol, name, description, image_uri, creator_address,
          created_timestamp, is_migrated, migrated_at, market_cap, 
          bonding_curve, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (mint) DO UPDATE SET
          is_migrated = EXCLUDED.is_migrated,
          migrated_at = EXCLUDED.migrated_at,
          market_cap = EXCLUDED.market_cap,
          last_updated_at = NOW()
        RETURNING *
      `;
      
      const values = [
        coin.mint,
        coin.symbol,
        coin.name || null,
        coin.description || null,
        coin.image_uri || null,
        coin.creator,
        coin.created_timestamp,
        coin.complete || false,
        coin.complete ? coin.created_timestamp : null,
        coin.usd_market_cap || null,
        coin.bonding_curve || null,
        JSON.stringify(coin),
      ];
      
      const result = await client.query(query, values);
      results.push(result.rows[0]);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default {
  // Developers
  upsertDeveloper,
  getDeveloperByAddress,
  getAllDevelopers,
  getDeveloperCount,
  
  // Coins
  upsertCoin,
  getCoinByMint,
  getCoinsByCreator,
  getRecentCoins,
  getTotalCoinsCount,
  getMigratedCoinsCount,
  
  // Migrations
  insertMigration,
  getMigrationsByDeveloper,
  getTotalMigrationsCount,
  
  // Alerts
  insertAlert,
  getRecentAlerts,
  markAlertAsRead,
  getUnreadAlertCount,
  
  // Statistics
  getSystemStats,
  
  // Bulk
  bulkUpsertCoins,
};
