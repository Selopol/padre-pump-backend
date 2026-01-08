/**
 * Solana RPC Client
 * Fetches token metadata URI from Solana blockchain
 */

const https = require('https');

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * Make JSON-RPC request to Solana
 */
function makeRpcRequest(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    });

    const options = {
      hostname: new URL(SOLANA_RPC_URL).hostname,
      path: new URL(SOLANA_RPC_URL).pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (json.error) {
            reject(new Error(json.error.message || 'RPC error'));
          } else {
            resolve(json.result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('RPC request timeout'));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Get token metadata URI from Solana blockchain
 * @param {string} mint - Token mint address
 * @returns {Promise<string|null>} - Metadata URI or null
 */
async function getTokenMetadataUri(mint) {
  try {
    // Get account info with parsed data
    const accountInfo = await makeRpcRequest('getAccountInfo', [
      mint,
      {
        encoding: 'jsonParsed'
      }
    ]);

    if (!accountInfo || !accountInfo.value) {
      console.log(`[Solana RPC] No account info for ${mint}`);
      return null;
    }

    const data = accountInfo.value.data;
    
    // Check if it's parsed data
    if (data.parsed && data.parsed.info && data.parsed.info.extensions) {
      const extensions = data.parsed.info.extensions;
      
      // Find tokenMetadata extension
      const metadataExt = extensions.find(ext => ext.extension === 'tokenMetadata');
      
      if (metadataExt && metadataExt.state && metadataExt.state.uri) {
        console.log(`[Solana RPC] Found URI: ${metadataExt.state.uri}`);
        return metadataExt.state.uri;
      }
    }

    console.log(`[Solana RPC] No tokenMetadata extension found for ${mint}`);
    return null;
  } catch (error) {
    console.error(`[Solana RPC] Error fetching metadata URI for ${mint}:`, error.message);
    return null;
  }
}

/**
 * Get multiple token metadata URIs in batch
 * @param {string[]} mints - Array of token mint addresses
 * @returns {Promise<Object>} - Map of mint -> URI
 */
async function getBatchTokenMetadataUris(mints) {
  const results = {};
  
  // Process in parallel but with rate limiting
  const batchSize = 10;
  for (let i = 0; i < mints.length; i += batchSize) {
    const batch = mints.slice(i, i + batchSize);
    const promises = batch.map(async (mint) => {
      const uri = await getTokenMetadataUri(mint);
      results[mint] = uri;
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < mints.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

module.exports = {
  getTokenMetadataUri,
  getBatchTokenMetadataUris
};
