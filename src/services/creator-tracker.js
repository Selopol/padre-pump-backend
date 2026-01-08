/**
 * Creator Tracking Service
 * Combines metadata parsing and Twitter API to track token creators
 */

const { getTwitterInfoFromUri } = require('./metadata-parser');
const { identifyCreator } = require('./twitter-api');
const { getTokenMetadataUri } = require('./solana-rpc');

// Pool will be injected
let pool = null;

/**
 * Initialize with database pool
 */
async function initialize() {
  if (!pool) {
    const connection = await import('../db/connection.js');
    pool = connection.pool;
  }
}

/**
 * Process a coin and identify its creator
 * @param {Object} coin - Coin data from Pump.fun API
 * @returns {Promise<Object>} - Creator info and coin data
 */
async function processCoin(coin) {
  try {
    console.log(`🔍 Processing coin: ${coin.symbol} (${coin.mint})`);

    // Get metadata URI from Solana blockchain
    const metadataUri = await getTokenMetadataUri(coin.mint);
    console.log(`[DEBUG] Metadata URI from Solana: ${metadataUri || 'NOT FOUND'}`);
    
    if (!metadataUri) {
      console.log(`⚠️  No metadata URI for ${coin.symbol}`);
      return null;
    }

    // Get Twitter info from metadata
    const twitterInfo = await getTwitterInfoFromUri(metadataUri);
    
    if (!twitterInfo.type) {
      console.log(`⚠️  No Twitter info found for ${coin.symbol}`);
      return null;
    }

    // Identify creator via Twitter API
    const twitterUrl = twitterInfo.tweetUrl || twitterInfo.communityUrl;
    const creator = await identifyCreator(twitterUrl, twitterInfo.type);

    console.log(`✅ Creator identified: @${creator.twitterHandle} for ${coin.symbol}`);

    return {
      coin: {
        mint: coin.mint,
        symbol: coin.symbol,
        name: coin.name,
        description: coin.description,
        imageUri: coin.image_uri,
        createdTimestamp: coin.created_timestamp,
        isMigrated: coin.complete || false,
        migratedAt: coin.raydium_pool ? coin.created_timestamp : null,
        marketCap: coin.usd_market_cap,
        bondingCurve: coin.bonding_curve,
        twitterUrl: twitterUrl,
        twitterType: twitterInfo.type,
        metadata: coin
      },
      creator: {
        twitterHandle: creator.twitterHandle,
        twitterId: creator.twitterId,
        twitterName: creator.twitterName,
        twitterProfileUrl: creator.twitterProfileUrl
      }
    };
  } catch (error) {
    console.error(`Error processing coin ${coin.symbol}:`, error);
    return null;
  }
}

/**
 * Save or update creator in database
 * @param {Object} creatorData - Creator data
 * @returns {Promise<Object>} - Saved creator
 */
async function saveCreator(creatorData) {
  await initialize();
  
  const query = `
    INSERT INTO creators (
      twitter_handle, 
      twitter_id, 
      twitter_name, 
      twitter_profile_url
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (twitter_handle) 
    DO UPDATE SET
      twitter_id = EXCLUDED.twitter_id,
      twitter_name = EXCLUDED.twitter_name,
      twitter_profile_url = EXCLUDED.twitter_profile_url,
      last_updated_at = NOW()
    RETURNING *
  `;

  const values = [
    creatorData.twitterHandle,
    creatorData.twitterId,
    creatorData.twitterName,
    creatorData.twitterProfileUrl
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Save or update coin in database
 * @param {Object} coinData - Coin data
 * @returns {Promise<Object>} - Saved coin
 */
async function saveCoin(coinData) {
  await initialize();
  
  const query = `
    INSERT INTO coins (
      mint,
      symbol,
      name,
      description,
      image_uri,
      creator_twitter_handle,
      twitter_url,
      twitter_type,
      created_timestamp,
      is_migrated,
      migrated_at,
      market_cap,
      bonding_curve,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (mint)
    DO UPDATE SET
      is_migrated = EXCLUDED.is_migrated,
      migrated_at = EXCLUDED.migrated_at,
      market_cap = EXCLUDED.market_cap,
      metadata = EXCLUDED.metadata,
      last_updated_at = NOW()
    RETURNING *
  `;

  const values = [
    coinData.mint,
    coinData.symbol,
    coinData.name,
    coinData.description,
    coinData.imageUri,
    coinData.creatorTwitterHandle,
    coinData.twitterUrl,
    coinData.twitterType,
    coinData.createdTimestamp,
    coinData.isMigrated,
    coinData.migratedAt,
    coinData.marketCap,
    coinData.bondingCurve,
    JSON.stringify(coinData.metadata)
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Update creator statistics
 * @param {string} twitterHandle - Creator's Twitter handle
 * @returns {Promise<void>}
 */
async function updateCreatorStats(twitterHandle) {
  await initialize();
  
  const query = `
    UPDATE creators
    SET
      total_coins = (
        SELECT COUNT(*) 
        FROM coins 
        WHERE creator_twitter_handle = $1
      ),
      migrated_coins = (
        SELECT COUNT(*) 
        FROM coins 
        WHERE creator_twitter_handle = $1 AND is_migrated = true
      ),
      success_rate = (
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE is_migrated = true)::DECIMAL / COUNT(*)) * 100, 2)
          END
        FROM coins 
        WHERE creator_twitter_handle = $1
      ),
      last_coin_mint = (
        SELECT mint 
        FROM coins 
        WHERE creator_twitter_handle = $1 
        ORDER BY created_timestamp DESC 
        LIMIT 1
      ),
      last_coin_symbol = (
        SELECT symbol 
        FROM coins 
        WHERE creator_twitter_handle = $1 
        ORDER BY created_timestamp DESC 
        LIMIT 1
      ),
      last_coin_created_at = (
        SELECT created_timestamp 
        FROM coins 
        WHERE creator_twitter_handle = $1 
        ORDER BY created_timestamp DESC 
        LIMIT 1
      ),
      last_updated_at = NOW()
    WHERE twitter_handle = $1
    RETURNING *
  `;

  const result = await pool.query(query, [twitterHandle]);
  return result.rows[0];
}

/**
 * Process and save coin with creator tracking
 * @param {Object} coin - Coin data from Pump.fun API
 * @returns {Promise<Object>} - Processing result
 */
async function processAndSaveCoin(coin) {
  try {
    // Process coin to identify creator
    const processed = await processCoin(coin);
    
    if (!processed) {
      return { success: false, reason: 'No Twitter info found' };
    }

    // Save creator
    await saveCreator(processed.creator);

    // Save coin
    const savedCoin = await saveCoin({
      ...processed.coin,
      creatorTwitterHandle: processed.creator.twitterHandle
    });

    // Update creator stats
    const updatedCreator = await updateCreatorStats(processed.creator.twitterHandle);

    console.log(`✅ Saved coin ${coin.symbol} by @${processed.creator.twitterHandle}`);
    console.log(`📊 Creator stats: ${updatedCreator.total_coins} coins, ${updatedCreator.success_rate}% success rate`);

    return {
      success: true,
      coin: savedCoin,
      creator: updatedCreator
    };
  } catch (error) {
    console.error('Error processing and saving coin:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get creator stats by mint address
 * @param {string} mint - Token mint address
 * @returns {Promise<Object>} - Creator stats
 */
async function getCreatorStatsByMint(mint) {
  await initialize();
  
  const query = `
    SELECT 
      c.mint,
      c.symbol,
      c.name,
      c.twitter_url,
      c.twitter_type,
      cr.twitter_handle,
      cr.twitter_name,
      cr.twitter_profile_url,
      cr.total_coins,
      cr.migrated_coins,
      cr.success_rate,
      cr.last_coin_symbol,
      cr.last_coin_created_at
    FROM coins c
    LEFT JOIN creators cr ON c.creator_twitter_handle = cr.twitter_handle
    WHERE c.mint = $1
  `;

  const result = await pool.query(query, [mint]);
  
  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

module.exports = {
  initialize,
  processCoin,
  saveCreator,
  saveCoin,
  updateCreatorStats,
  processAndSaveCoin,
  getCreatorStatsByMint
};
