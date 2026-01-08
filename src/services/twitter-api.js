/**
 * Twitter API Client for twitterapi.io
 * Identifies token creators from tweet URLs or community URLs
 */

const https = require('https');

const API_KEY = process.env.TWITTER_API_KEY || 'new1_defb379335c44d58890c0e2c59ada78f';
const BASE_URL = 'https://api.twitterapi.io';

/**
 * Make HTTPS request
 */
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.twitterapi.io',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse JSON response'));
          }
        } else {
          reject(new Error(`Twitter API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Extract tweet ID from Twitter URL
 * @param {string} url - Twitter URL
 * @returns {string|null} - Tweet ID or null
 */
function extractTweetId(url) {
  if (!url) return null;
  
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
    const data = await makeRequest(`/v2/tweets/${tweetId}`);
    
    if (!data.data) {
      throw new Error('No tweet data returned');
    }

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
    const data = await makeRequest(`/v2/users/by/username/${cleanUsername}`);
    
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
      // Extract community ID from URL
      const communityId = extractCommunityId(url);
      if (!communityId) {
        throw new Error('Invalid community URL');
      }
      
      // Get community moderators (first one is the creator)
      const creator = await getCommunityModerators(communityId);
      
      return {
        type: 'community',
        twitterHandle: creator.username,
        twitterId: creator.userId,
        twitterName: creator.name,
        twitterProfileUrl: creator.profileUrl,
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
 * Get community moderators (first one is usually the creator/admin)
 * @param {string} communityId - Community ID
 * @returns {Promise<Object>} - First moderator (creator)
 */
async function getCommunityModerators(communityId) {
  try {
    const data = await makeRequest(`/twitter/community/moderators?community_id=${communityId}`);
    
    if (!data.members || data.members.length === 0) {
      throw new Error('No moderators found');
    }

    // First moderator is usually the creator/admin
    const creator = data.members[0];
    
    return {
      userId: creator.id,
      username: creator.userName,
      name: creator.name,
      profileUrl: `https://twitter.com/${creator.userName}`,
      description: creator.description,
      verified: creator.isBlueVerified || false
    };
  } catch (error) {
    console.error('Error fetching community moderators:', error);
    throw error;
  }
}

/**
 * Extract community ID from Twitter community URL
 * @param {string} url - Twitter community URL
 * @returns {string|null} - Community ID or null
 */
function extractCommunityId(url) {
  if (!url) return null;
  
  const match = url.match(/\/communities\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Test Twitter API connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection() {
  try {
    await makeRequest('/v2/tweets/20');
    return true;
  } catch (error) {
    console.error('Twitter API connection test failed:', error);
    return false;
  }
}

module.exports = {
  extractTweetId,
  extractUsername,
  extractCommunityId,
  getTweetDetails,
  getUserByUsername,
  getCommunityModerators,
  identifyCreator,
  testConnection
};
