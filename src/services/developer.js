import { fetchAllUserCoins } from '../utils/pumpfun-api.js';
import { upsertDeveloper, upsertCoin, getDeveloperByAddress } from '../db/queries.js';

/**
 * Update developer statistics by fetching all their coins
 * @param {string} address - Developer wallet address
 * @returns {Promise<Object>} Updated developer object
 */
export async function updateDeveloper(address) {
  try {
    console.log(`🔍 Updating developer: ${address}`);

    // Fetch all coins created by this developer
    const coins = await fetchAllUserCoins(address);

    if (coins.length === 0) {
      console.log(`  ⚠️  No coins found for ${address}`);
      return null;
    }

    // Calculate statistics
    const totalCoins = coins.length;
    const migratedCoins = coins.filter(coin => coin.complete === true);
    const migrationCount = migratedCoins.length;
    const migrationRate = totalCoins > 0 ? (migrationCount / totalCoins) * 100 : 0;

    // Find last migrated coin
    let lastMigratedCoin = null;
    if (migratedCoins.length > 0) {
      // Sort by created_timestamp descending
      migratedCoins.sort((a, b) => b.created_timestamp - a.created_timestamp);
      const latest = migratedCoins[0];
      lastMigratedCoin = {
        symbol: latest.symbol,
        mint: latest.mint,
        createdTimestamp: latest.created_timestamp,
      };
    }

    // Prepare developer object
    const developer = {
      address,
      totalCoins,
      migrationCount,
      migrationRate: parseFloat(migrationRate.toFixed(2)),
      lastMigratedCoin,
    };

    // Upsert developer in database
    const savedDeveloper = await upsertDeveloper(developer);

    // Upsert all coins in database
    for (const coin of coins) {
      await upsertCoin(coin);
    }

    console.log(`  ✅ Updated ${address}: ${totalCoins} coins, ${migrationCount} migrated (${migrationRate.toFixed(2)}%)`);

    return savedDeveloper;
  } catch (error) {
    console.error(`❌ Error updating developer ${address}:`, error);
    throw error;
  }
}

/**
 * Get developer from database or fetch if not exists
 * @param {string} address - Developer wallet address
 * @returns {Promise<Object|null>} Developer object or null
 */
export async function getDeveloper(address) {
  try {
    // Try to get from database first
    let developer = await getDeveloperByAddress(address);

    // If not found, fetch and update
    if (!developer) {
      developer = await updateDeveloper(address);
    }

    return developer;
  } catch (error) {
    console.error(`Error getting developer ${address}:`, error);
    return null;
  }
}

/**
 * Check if a developer has migration history
 * @param {string} address - Developer wallet address
 * @returns {Promise<boolean>} True if developer has at least one migration
 */
export async function hasMigrationHistory(address) {
  const developer = await getDeveloperByAddress(address);
  return developer && developer.migration_count > 0;
}

/**
 * Calculate accurate migration rate for a developer
 * @param {Array} coins - Array of coin objects
 * @returns {Object} Statistics object
 */
export function calculateDeveloperStats(coins) {
  const totalCoins = coins.length;
  const migratedCoins = coins.filter(coin => coin.complete === true);
  const migrationCount = migratedCoins.length;
  const migrationRate = totalCoins > 0 ? (migrationCount / totalCoins) * 100 : 0;

  // Find last migrated coin
  let lastMigratedCoin = null;
  if (migratedCoins.length > 0) {
    migratedCoins.sort((a, b) => b.created_timestamp - a.created_timestamp);
    const latest = migratedCoins[0];
    lastMigratedCoin = {
      symbol: latest.symbol,
      mint: latest.mint,
      createdTimestamp: latest.created_timestamp,
      name: latest.name,
      imageUri: latest.image_uri,
    };
  }

  return {
    totalCoins,
    migrationCount,
    migrationRate: parseFloat(migrationRate.toFixed(2)),
    lastMigratedCoin,
  };
}

export default {
  updateDeveloper,
  getDeveloper,
  hasMigrationHistory,
  calculateDeveloperStats,
};
