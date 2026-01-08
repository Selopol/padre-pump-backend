/**
 * Token Metadata Parser
 * Extracts Twitter information from token metadata URI
 */

const https = require('https');
const http = require('http');

/**
 * Make HTTP/HTTPS request
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ data, contentType: res.headers['content-type'] });
        } else {
          reject(new Error(`HTTP error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Fetch and parse token metadata from URI
 * @param {string} uri - Metadata URI (from token extensions)
 * @returns {Promise<Object>} - Parsed metadata with Twitter info
 */
async function fetchMetadata(uri) {
  try {
    if (!uri) {
      throw new Error('No URI provided');
    }

    const { data, contentType } = await makeRequest(uri);
    
    let metadata;

    // Handle both JSON and JavaScript responses
    if (contentType && contentType.includes('application/json')) {
      metadata = JSON.parse(data);
    } else {
      // Try to extract JSON from JavaScript
      const jsonMatch = data.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse metadata');
      }
    }

    return metadata;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    throw error;
  }
}

/**
 * Extract Twitter URLs from metadata
 * @param {Object} metadata - Token metadata object
 * @returns {Object} - Twitter info { tweetUrl, communityUrl, type }
 */
function extractTwitterInfo(metadata) {
  const result = {
    tweetUrl: null,
    communityUrl: null,
    type: null
  };

  if (!metadata) {
    return result;
  }

  // Check common fields for Twitter links
  const fieldsToCheck = [
    metadata.twitter,
    metadata.social?.twitter,
    metadata.links?.twitter,
    metadata.extensions?.twitter,
    metadata.tweet,
    metadata.tweetUrl,
    metadata.community,
    metadata.communityUrl
  ];

  // Also check in properties if they exist
  if (metadata.properties) {
    fieldsToCheck.push(
      metadata.properties.twitter,
      metadata.properties.tweet,
      metadata.properties.community
    );
  }

  // Check in links array if it exists
  if (Array.isArray(metadata.links)) {
    metadata.links.forEach(link => {
      if (typeof link === 'string') {
        fieldsToCheck.push(link);
      } else if (link && link.url) {
        fieldsToCheck.push(link.url);
      }
    });
  }

  // Check in external_url
  if (metadata.external_url) {
    fieldsToCheck.push(metadata.external_url);
  }

  // Scan all fields for Twitter URLs
  for (const field of fieldsToCheck) {
    if (!field || typeof field !== 'string') continue;

    // Check if it's a tweet URL
    if (field.match(/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/)) {
      result.tweetUrl = field;
      result.type = 'tweet';
      break; // Prioritize tweet over community
    }

    // Check if it's a community URL (specific pattern)
    if (field.match(/(?:twitter\.com|x\.com)\/i\/communities\/\d+/)) {
      result.communityUrl = field;
      if (!result.type) {
        result.type = 'community';
      }
    }
    
    // Check if it's a regular profile URL (fallback)
    if (!result.communityUrl && field.match(/(?:twitter\.com|x\.com)\/\w+\/?$/)) {
      result.communityUrl = field;
      if (!result.type) {
        result.type = 'community';
      }
    }
  }

  return result;
}

/**
 * Get Twitter info from token URI
 * @param {string} uri - Token metadata URI
 * @returns {Promise<Object>} - Twitter info { tweetUrl, communityUrl, type }
 */
async function getTwitterInfoFromUri(uri) {
  try {
    const metadata = await fetchMetadata(uri);
    const twitterInfo = extractTwitterInfo(metadata);
    
    console.log(`📋 Extracted Twitter info from ${uri}:`, twitterInfo);
    
    return twitterInfo;
  } catch (error) {
    console.error('Error getting Twitter info from URI:', error);
    return {
      tweetUrl: null,
      communityUrl: null,
      type: null
    };
  }
}

/**
 * Test metadata parser with a sample URI
 * @param {string} uri - Test URI
 * @returns {Promise<void>}
 */
async function testParser(uri) {
  console.log('🧪 Testing metadata parser...');
  console.log('URI:', uri);
  
  try {
    const metadata = await fetchMetadata(uri);
    console.log('✅ Metadata fetched:', JSON.stringify(metadata, null, 2));
    
    const twitterInfo = extractTwitterInfo(metadata);
    console.log('✅ Twitter info extracted:', twitterInfo);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

module.exports = {
  fetchMetadata,
  extractTwitterInfo,
  getTwitterInfoFromUri,
  testParser
};
