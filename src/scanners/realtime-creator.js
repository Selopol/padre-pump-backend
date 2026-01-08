/**
 * Real-time Creator Scanner
 * Monitors new Pump.fun coins and tracks creators via Twitter
 */

const { fetchRecentCoins } = require('../utils/pumpfun-api');
const { processAndSaveCoin } = require('../services/creator-tracker');

const SCAN_INTERVAL = 10000; // 10 seconds
const BATCH_SIZE = 50; // Process 50 coins at a time

let isRunning = false;
let lastScannedTimestamp = Date.now() / 1000; // Unix timestamp in seconds
let processedMints = new Set();
let scanInterval = null;

/**
 * Start real-time scanning
 */
async function startRealtimeScanning() {
  if (isRunning) {
    console.log('⚠️  Real-time scanner already running');
    return;
  }

  isRunning = true;
  console.log('🚀 Starting real-time creator scanner...');
  console.log(`📡 Scanning every ${SCAN_INTERVAL / 1000} seconds`);

  // Initial scan
  await scanNewCoins();

  // Set up interval
  scanInterval = setInterval(async () => {
    if (isRunning) {
      await scanNewCoins();
    }
  }, SCAN_INTERVAL);
}

/**
 * Stop real-time scanning
 */
function stopRealtimeScanning() {
  isRunning = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  console.log('🛑 Stopped real-time creator scanner');
}

/**
 * Scan for new coins
 */
async function scanNewCoins() {
  try {
    console.log(`\n🔍 Scanning for new coins (${new Date().toISOString()})...`);

    // Fetch recent coins
    const coins = await fetchRecentCoins(BATCH_SIZE);
    
    if (!coins || coins.length === 0) {
      console.log('📭 No new coins found');
      return;
    }

    console.log(`📦 Found ${coins.length} recent coins`);

    // Filter out already processed coins
    const newCoins = coins.filter(coin => {
      const isNew = !processedMints.has(coin.mint);
      if (isNew) {
        processedMints.add(coin.mint);
      }
      return isNew;
    });

    if (newCoins.length === 0) {
      console.log('✅ All coins already processed');
      return;
    }

    console.log(`🆕 Processing ${newCoins.length} new coins...`);

    // Process coins sequentially to avoid rate limiting
    let successCount = 0;
    let failCount = 0;

    for (const coin of newCoins) {
      try {
        const result = await processAndSaveCoin(coin);
        
        if (result.success) {
          successCount++;
          
          // Log creator info
          if (result.creator) {
            console.log(`  ✅ ${coin.symbol} by @${result.creator.twitter_handle} (${result.creator.total_coins} coins, ${result.creator.success_rate}% success)`);
          }
        } else {
          failCount++;
          console.log(`  ⚠️  ${coin.symbol}: ${result.reason || result.error || 'Unknown error'}`);
        }

        // Small delay to avoid rate limiting
        await sleep(500);
      } catch (error) {
        failCount++;
        console.error(`  ❌ Error processing ${coin.symbol}:`, error.message);
      }
    }

    console.log(`\n📊 Scan complete: ${successCount} success, ${failCount} failed`);

    // Update last scanned timestamp
    lastScannedTimestamp = Date.now() / 1000;

    // Clean up old processed mints (keep last 1000)
    if (processedMints.size > 1000) {
      const mints = Array.from(processedMints);
      processedMints = new Set(mints.slice(-1000));
    }
  } catch (error) {
    console.error('❌ Error in scanNewCoins:', error);
  }
}

/**
 * Get scanner status
 */
function getScannerStatus() {
  return {
    isRunning,
    lastScannedTimestamp,
    processedCount: processedMints.size,
    scanInterval: SCAN_INTERVAL
  };
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  startRealtimeScanning,
  stopRealtimeScanning,
  getScannerStatus
};
