import config from '../../config/config.js';

const API_BASE = config.pumpfun.apiUrl;

/**
 * Fetch coins from Pump.fun API with pagination
 * @param {Object} options - Query options
 * @param {number} options.offset - Pagination offset
 * @param {number} options.limit - Number of coins to fetch
 * @param {boolean} options.complete - Filter for migrated coins only
 * @param {boolean} options.includeNsfw - Include NSFW content
 * @returns {Promise<Array>} Array of coins
 */
export async function fetchCoins({ offset = 0, limit = 100, complete = false, includeNsfw = true } = {}) {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
    includeNsfw: includeNsfw.toString(),
  });

  if (complete) {
    params.append('complete', 'true');
  }

  const url = `${API_BASE}/coins?${params.toString()}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Pump.fun API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error('Error fetching coins from Pump.fun:', error);
    throw error;
  }
}

/**
 * Fetch all coins created by a specific user
 * @param {string} address - Creator wallet address
 * @param {Object} options - Query options
 * @param {number} options.offset - Pagination offset
 * @param {number} options.limit - Number of coins to fetch
 * @param {boolean} options.includeNsfw - Include NSFW content
 * @returns {Promise<Array>} Array of coins
 */
export async function fetchUserCoins(address, { offset = 0, limit = 1000, includeNsfw = true } = {}) {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
    includeNsfw: includeNsfw.toString(),
  });

  const url = `${API_BASE}/coins/user-created-coins/${address}?${params.toString()}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // No coins found for this user
      }
      throw new Error(`Pump.fun API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error(`Error fetching coins for user ${address}:`, error);
    throw error;
  }
}

/**
 * Fetch all coins from a user with automatic pagination
 * @param {string} address - Creator wallet address
 * @param {number} maxCoins - Maximum number of coins to fetch
 * @returns {Promise<Array>} Array of all coins
 */
export async function fetchAllUserCoins(address, maxCoins = 10000) {
  const allCoins = [];
  let offset = 0;
  const limit = 1000;

  while (allCoins.length < maxCoins) {
    const coins = await fetchUserCoins(address, { offset, limit });
    
    if (coins.length === 0) {
      break; // No more coins
    }

    allCoins.push(...coins);
    offset += limit;

    // If we got fewer coins than the limit, we've reached the end
    if (coins.length < limit) {
      break;
    }

    // Small delay to avoid rate limiting
    await sleep(100);
  }

  return allCoins;
}

/**
 * Fetch all migrated coins with automatic pagination
 * @param {number} maxCoins - Maximum number of coins to fetch
 * @returns {Promise<Array>} Array of all migrated coins
 */
export async function fetchAllMigratedCoins(maxCoins = 10000) {
  const allCoins = [];
  let offset = 0;
  const limit = 100;

  console.log(`📡 Fetching all migrated coins (max: ${maxCoins})...`);

  while (allCoins.length < maxCoins) {
    const coins = await fetchCoins({ offset, limit, complete: true });
    
    if (coins.length === 0) {
      break; // No more coins
    }

    allCoins.push(...coins);
    offset += limit;

    console.log(`  Fetched ${allCoins.length} migrated coins...`);

    // If we got fewer coins than the limit, we've reached the end
    if (coins.length < limit) {
      break;
    }

    // Small delay to avoid rate limiting
    await sleep(200);
  }

  console.log(`✅ Fetched total of ${allCoins.length} migrated coins`);
  return allCoins;
}

/**
 * Fetch recent new coins (not necessarily migrated)
 * @param {number} limit - Number of recent coins to fetch
 * @returns {Promise<Array>} Array of recent coins
 */
export async function fetchRecentCoins(limit = 100) {
  return fetchCoins({ offset: 0, limit, complete: false });
}

/**
 * Fetch recent migrated coins
 * @param {number} limit - Number of recent migrated coins to fetch
 * @returns {Promise<Array>} Array of recent migrated coins
 */
export async function fetchRecentMigratedCoins(limit = 50) {
  return fetchCoins({ offset: 0, limit, complete: true });
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  fetchCoins,
  fetchUserCoins,
  fetchAllUserCoins,
  fetchAllMigratedCoins,
  fetchRecentCoins,
  fetchRecentMigratedCoins,
};
