/**
 * Token Metadata Parser
 * Extracts Twitter information from token metadata URI
 */

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

    const response = await fetch(uri);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    let data;

    // Handle both JSON and JavaScript responses
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      // Some metadata URIs return JavaScript, need to parse it
      const text = await response.text();
      
      // Try to extract JSON from JavaScript
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse metadata');
      }
    }

    return data;
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

    // Check if it's a community/profile URL
    if (field.match(/(?:twitter\.com|x\.com)\/\w+\/?$/)) {
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
