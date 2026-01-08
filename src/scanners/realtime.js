import { fetchRecentCoins } from '../utils/pumpfun-api.js';
import { getDeveloperByAddress, upsertCoin, insertAlert, getCoinByMint } from '../db/queries.js';
import config from '../../config/config.js';

// Track seen coins to avoid duplicate alerts
const seenCoins = new Set();

/**
 * Monitor for new coins from developers with migration history
 * Triggers alerts when detected
 */
export async function monitorNewCoins() {
  try {
    // Fetch recent coins
    const recentCoins = await fetchRecentCoins(100);

    const stats = {
      coinsChecked: recentCoins.length,
      alertsTriggered: 0,
      newCoins: 0,
    };

    for (const coin of recentCoins) {
      try {
        // Skip if already seen
        if (seenCoins.has(coin.mint)) {
          continue;
        }

        // Check if coin exists in database
        const existingCoin = await getCoinByMint(coin.mint);
        if (existingCoin) {
          seenCoins.add(coin.mint);
          continue;
        }

        // Mark as seen
        seenCoins.add(coin.mint);
        stats.newCoins++;

        // Store coin in database
        await upsertCoin(coin);

        // Check if creator has migration history
        const developer = await getDeveloperByAddress(coin.creator);

        if (developer && developer.migration_count > 0) {
          // 🚨 ALERT! Developer with migration history launched new coin
          console.log('');
          console.log('🚨 ═══════════════════════════════════════════════════════');
          console.log('🚨 ALERT: New coin from tracked developer!');
          console.log('🚨 ═══════════════════════════════════════════════════════');
          console.log(`  Token: ${coin.symbol} (${coin.name})`);
          console.log(`  Mint: ${coin.mint}`);
          console.log(`  Creator: ${coin.creator}`);
          console.log(`  Developer Stats:`);
          console.log(`    • Total Coins: ${developer.total_coins}`);
          console.log(`    • Migrations: ${developer.migration_count}`);
          console.log(`    • Success Rate: ${developer.migration_rate}%`);
          console.log(`    • Last Migration: ${developer.last_migrated_coin_symbol || 'N/A'}`);
          console.log('🚨 ═══════════════════════════════════════════════════════');
          console.log('');

          // Create alert in database
          const alertData = {
            coinSymbol: coin.symbol,
            coinName: coin.name,
            coinMint: coin.mint,
            coinImage: coin.image_uri,
            coinCreatedAt: coin.created_timestamp,
            developerAddress: coin.creator,
            developerMigrations: developer.migration_count,
            developerMigrationRate: developer.migration_rate,
            developerTotalCoins: developer.total_coins,
            developerLastMigrated: developer.last_migrated_coin_symbol,
            developerLastMigratedAt: developer.last_migrated_timestamp,
          };

          await insertAlert(coin.mint, coin.creator, alertData);
          stats.alertsTriggered++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing coin ${coin.symbol}:`, error.message);
      }
    }

    if (stats.newCoins > 0) {
      console.log(`✅ Monitored ${stats.coinsChecked} coins, found ${stats.newCoins} new, triggered ${stats.alertsTriggered} alerts`);
    }

    return stats;
  } catch (error) {
    console.error('❌ Real-time monitoring error:', error);
    throw error;
  }
}

/**
 * Start real-time monitoring loop
 * Runs continuously at configured interval
 */
export function startRealtimeMonitor() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('👁️  STARTING REAL-TIME MONITOR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Interval: ${config.scanning.scanInterval}ms (${config.scanning.scanInterval / 1000}s)`);
  console.log('  Monitoring for new coins from tracked developers...');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Initial scan
  monitorNewCoins().catch(error => {
    console.error('Initial monitoring scan failed:', error);
  });

  // Set up interval
  const intervalId = setInterval(async () => {
    try {
      await monitorNewCoins();
    } catch (error) {
      console.error('Monitoring interval error:', error);
    }
  }, config.scanning.scanInterval);

  // Return stop function
  return () => {
    clearInterval(intervalId);
    console.log('🛑 Real-time monitor stopped');
  };
}

/**
 * Monitor for recently migrated coins
 * Updates developer statistics when new migrations detected
 */
export async function monitorMigrations() {
  try {
    const { fetchRecentMigratedCoins } = await import('../utils/pumpfun-api.js');
    const { updateDeveloper } = await import('../services/developer.js');
    const { insertMigration } = await import('../db/queries.js');

    const recentMigrated = await fetchRecentMigratedCoins(50);

    const stats = {
      migrationsChecked: recentMigrated.length,
      developersUpdated: new Set(),
    };

    for (const coin of recentMigrated) {
      try {
        // Store coin
        await upsertCoin(coin);

        // Check if migration already recorded
        const existingCoin = await getCoinByMint(coin.mint);
        if (existingCoin && existingCoin.is_migrated) {
          continue; // Already recorded
        }

        // Record migration
        await insertMigration(
          coin.mint,
          coin.creator,
          coin.created_timestamp
        );

        // Update developer statistics
        await updateDeveloper(coin.creator);
        stats.developersUpdated.add(coin.creator);

        console.log(`  ✅ New migration detected: ${coin.symbol} by ${coin.creator.slice(0, 8)}...`);
      } catch (error) {
        console.error(`  ❌ Error processing migration ${coin.symbol}:`, error.message);
      }
    }

    if (stats.developersUpdated.size > 0) {
      console.log(`✅ Migration scan: checked ${stats.migrationsChecked}, updated ${stats.developersUpdated.size} developers`);
    }

    return stats;
  } catch (error) {
    console.error('❌ Migration monitoring error:', error);
    throw error;
  }
}

/**
 * Start migration monitoring loop
 * Runs continuously at configured interval
 */
export function startMigrationMonitor() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 STARTING MIGRATION MONITOR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Interval: ${config.scanning.migrationScanInterval}ms (${config.scanning.migrationScanInterval / 1000}s)`);
  console.log('  Monitoring for new migrations to update developer stats...');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Initial scan
  monitorMigrations().catch(error => {
    console.error('Initial migration scan failed:', error);
  });

  // Set up interval
  const intervalId = setInterval(async () => {
    try {
      await monitorMigrations();
    } catch (error) {
      console.error('Migration monitoring interval error:', error);
    }
  }, config.scanning.migrationScanInterval);

  // Return stop function
  return () => {
    clearInterval(intervalId);
    console.log('🛑 Migration monitor stopped');
  };
}

/**
 * Clear seen coins cache (useful for testing)
 */
export function clearSeenCoins() {
  seenCoins.clear();
  console.log('🧹 Cleared seen coins cache');
}

export default {
  monitorNewCoins,
  startRealtimeMonitor,
  monitorMigrations,
  startMigrationMonitor,
  clearSeenCoins,
};
