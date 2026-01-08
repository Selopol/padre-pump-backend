/**
 * Twitter API Client for twitterapi.io
 * Identifies token creators from tweet URLs or community URLs
 */

const API_KEY = process.env.TWITTER_API_KEY || 'new1_defb379335c44d58890c0e2c59ada78f';
const BASE_URL = 'https://api.twitterapi.io';

/**
 * Extract tweet ID from Twitter URL
 * @param {string} url - Twitter URL
 * @returns {string|null} - Tweet ID or null
 */
function extractTweetId(url) {
  if (!url) return null;
  
  // Match patterns:
  // https://twitter.com/username/status/1234567890
  // https://x.com/username/status/1234567890
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract username from Twitter URL
 * @param {string} url - Twitter URL
 * @returns {string|null} - Username or null
 */
function extractUsername(url) {
  if (!url) return null;
  
  // Match patterns:
  // https://twitter.com/username
  // https://x.com/username
  // https://twitter.com/username/status/123
  const match = url.match(/(?:twitter\.com|x\.com)\/(@?\w+)/);
  return match ? match[1].replace('@', '') : null;
}

/**
 * Get tweet details including author information
 * @param {string} tweetId - Tweet ID
 * @returns {Promise<Object>} - Tweet data with author info
 */
async function getTweetDetails(tweetId) {
  try {
    const response = await fetch(`${BASE_URL}/v2/tweets/${tweetId}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data) {
      throw new Error('No tweet data returned');
    }

    // Extract author info from includes
    const author = data.includes?.users?.[0];
    
    return {
      tweetId: data.data.id,
      text: data.data.text,
      authorId: data.data.author_id,
      authorUsername: author?.username,
      authorName: author?.name,
      authorProfileUrl: author?.username ? `https://twitter.com/${author.username}` : null,
      createdAt: data.data.created_at
    };
  } catch (error) {
    console.error('Error fetching tweet details:', error);
    throw error;
  }
}

/**
 * Get user details by username
 * @param {string} username - Twitter username (without @)
 * @returns {Promise<Object>} - User data
 */
async function getUserByUsername(username) {
  try {
    const cleanUsername = username.replace('@', '');
    
    const response = await fetch(`${BASE_URL}/v2/users/by/username/${cleanUsername}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data) {
      throw new Error('No user data returned');
    }

    return {
      userId: data.data.id,
      username: data.data.username,
      name: data.data.name,
      profileUrl: `https://twitter.com/${data.data.username}`,
      description: data.data.description,
      verified: data.data.verified || false
    };
  } catch (error) {
    console.error('Error fetching user details:', error);
    throw error;
  }
}

/**
 * Identify creator from Twitter URL (tweet or community)
 * @param {string} url - Twitter URL
 * @param {string} type - 'tweet' or 'community'
 * @returns {Promise<Object>} - Creator info
 */
async function identifyCreator(url, type = 'tweet') {
  try {
    if (type === 'tweet') {
      // Extract tweet ID and get author
      const tweetId = extractTweetId(url);
      if (!tweetId) {
        throw new Error('Invalid tweet URL');
      }
      
      const tweetData = await getTweetDetails(tweetId);
      
      return {
        type: 'tweet',
        twitterHandle: tweetData.authorUsername,
        twitterId: tweetData.authorId,
        twitterName: tweetData.authorName,
        twitterProfileUrl: tweetData.authorProfileUrl,
        sourceUrl: url
      };
    } else if (type === 'community') {
      // Extract username from community URL
      const username = extractUsername(url);
      if (!username) {
        throw new Error('Invalid community URL');
      }
      
      const userData = await getUserByUsername(username);
      
      return {
        type: 'community',
        twitterHandle: userData.username,
        twitterId: userData.userId,
        twitterName: userData.name,
        twitterProfileUrl: userData.profileUrl,
        sourceUrl: url
      };
    } else {
      throw new Error(`Unknown type: ${type}`);
    }
  } catch (error) {
    console.error('Error identifying creator:', error);
    throw error;
  }
}

/**
 * Test Twitter API connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection() {
  try {
    // Test with a known public tweet
    const response = await fetch(`${BASE_URL}/v2/tweets/20`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Twitter API connection test failed:', error);
    return false;
  }
}

module.exports = {
  extractTweetId,
  extractUsername,
  getTweetDetails,
  getUserByUsername,
  identifyCreator,
  testConnection
};
