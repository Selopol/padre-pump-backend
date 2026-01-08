import { fetchAllMigratedCoins } from '../utils/pumpfun-api.js';
import { updateDeveloper } from '../services/developer.js';
import { upsertCoin, insertMigration } from '../db/queries.js';
import config from '../../config/config.js';

/**
 * Perform historical scan of all migrated coins
 * Builds initial database of developers with migration history
 */
export async function performHistoricalScan() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 STARTING HISTORICAL SCAN');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const startTime = Date.now();
  const stats = {
    coinsScanned: 0,
    developersFound: new Set(),
    migrationsRecorded: 0,
    errors: 0,
  };

  try {
    // Step 1: Fetch all migrated coins
    console.log('📡 Step 1: Fetching all migrated coins from Pump.fun...');
    const migratedCoins = await fetchAllMigratedCoins(config.scanning.historicalLimit);
    stats.coinsScanned = migratedCoins.length;

    console.log(`✅ Found ${migratedCoins.length} migrated coins`);
    console.log('');

    // Step 2: Extract unique developers
    console.log('👥 Step 2: Extracting unique developer addresses...');
    const developerAddresses = [...new Set(migratedCoins.map(coin => coin.creator))];
    console.log(`✅ Found ${developerAddresses.length} unique developers`);
    console.log('');

    // Step 3: Create developer records first (required for foreign key)
    console.log('👤 Step 3: Creating developer records...');
    const { upsertDeveloper } = await import('../db/queries.js');
    for (const address of developerAddresses) {
      try {
        await upsertDeveloper({ address, totalCoins: 0, migrationCount: 0, migrationRate: 0 });
      } catch (error) {
        console.error(`  ❌ Error creating developer ${address}:`, error.message);
        stats.errors++;
      }
    }
    console.log(`✅ Created ${developerAddresses.length} developer records`);
    console.log('');

    // Step 4: Store migrated coins in database
    console.log('💾 Step 4: Storing migrated coins in database...');
    for (const coin of migratedCoins) {
      try {
        await upsertCoin(coin);
        
        // Record migration event
        if (coin.complete) {
          await insertMigration(
            coin.mint,
            coin.creator,
            coin.created_timestamp
          );
          stats.migrationsRecorded++;
        }
      } catch (error) {
        console.error(`  ❌ Error storing coin ${coin.symbol}:`, error.message);
        stats.errors++;
      }
    }
    console.log(`✅ Stored ${migratedCoins.length} coins and ${stats.migrationsRecorded} migrations`);
    console.log('');

    // Step 5: Update developer statistics
    console.log('📊 Step 5: Updating developer statistics...');
    console.log(`Processing ${developerAddresses.length} developers...`);
    console.log('');

    let processed = 0;
    for (const address of developerAddresses) {
      try {
        await updateDeveloper(address);
        stats.developersFound.add(address);
        processed++;

        // Progress indicator
        if (processed % 10 === 0) {
          const percent = ((processed / developerAddresses.length) * 100).toFixed(1);
          console.log(`  Progress: ${processed}/${developerAddresses.length} (${percent}%)`);
        }
      } catch (error) {
        console.error(`  ❌ Error updating developer ${address}:`, error.message);
        stats.errors++;
      }
    }

    console.log('');
    console.log('✅ Developer statistics updated');
    console.log('');

    // Final statistics
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ HISTORICAL SCAN COMPLETED');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Statistics:');
    console.log(`  • Coins scanned: ${stats.coinsScanned}`);
    console.log(`  • Developers found: ${stats.developersFound.size}`);
    console.log(`  • Migrations recorded: ${stats.migrationsRecorded}`);
    console.log(`  • Errors: ${stats.errors}`);
    console.log(`  • Duration: ${duration}s`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    return stats;
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ HISTORICAL SCAN FAILED');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error);
    console.error('');
    throw error;
  }
}

/**
 * Perform incremental scan of recently migrated coins
 * Updates existing developer statistics
 */
export async function performIncrementalScan(limit = 100) {
  console.log(`🔄 Performing incremental scan (${limit} coins)...`);

  try {
    const { fetchRecentMigratedCoins } = await import('../utils/pumpfun-api.js');
    const recentMigrated = await fetchRecentMigratedCoins(limit);

    const stats = {
      coinsProcessed: 0,
      developersUpdated: new Set(),
      newMigrations: 0,
    };

    for (const coin of recentMigrated) {
      try {
        // Store coin
        await upsertCoin(coin);

        // Record migration
        if (coin.complete) {
          await insertMigration(
            coin.mint,
            coin.creator,
            coin.created_timestamp
          );
          stats.newMigrations++;
        }

        // Update developer
        await updateDeveloper(coin.creator);
        stats.developersUpdated.add(coin.creator);
        stats.coinsProcessed++;
      } catch (error) {
        console.error(`  ❌ Error processing coin ${coin.symbol}:`, error.message);
      }
    }

    console.log(`  ✅ Processed ${stats.coinsProcessed} coins, updated ${stats.developersUpdated.size} developers`);
    return stats;
  } catch (error) {
    console.error('❌ Incremental scan failed:', error);
    throw error;
  }
}

export default {
  performHistoricalScan,
  performIncrementalScan,
};
