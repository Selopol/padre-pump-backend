/**
 * API Routes for Creator Tracking
 * Endpoints for accessing creator statistics and coin data
 */

const express = require('express');
const { getCreatorStatsByMint } = require('../services/creator-tracker');
const db = require('../db/connection');

const router = express.Router();

// ============================================
// CREATORS
// ============================================

/**
 * GET /api/creators
 * Get all creators with statistics
 * Query params: limit, offset, sort
 */
router.get('/creators', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;
    const sort = req.query.sort || 'success_rate'; // success_rate, total_coins, migrated_coins

    let orderBy = 'success_rate DESC';
    if (sort === 'total_coins') {
      orderBy = 'total_coins DESC';
    } else if (sort === 'migrated_coins') {
      orderBy = 'migrated_coins DESC';
    }

    const query = `
      SELECT * FROM creators
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching creators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creators',
      message: error.message
    });
  }
});

/**
 * GET /api/creators/:handle
 * Get specific creator details with all their coins
 */
router.get('/creators/:handle', async (req, res) => {
  try {
    const { handle } = req.params;
    const cleanHandle = handle.replace('@', '');

    // Get creator
    const creatorQuery = 'SELECT * FROM creators WHERE twitter_handle = $1';
    const creatorResult = await db.query(creatorQuery, [cleanHandle]);

    if (creatorResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }

    // Get their coins
    const coinsQuery = `
      SELECT * FROM coins
      WHERE creator_twitter_handle = $1
      ORDER BY created_timestamp DESC
    `;
    const coinsResult = await db.query(coinsQuery, [cleanHandle]);

    res.json({
      success: true,
      data: {
        creator: creatorResult.rows[0],
        coins: coinsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching creator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch creator',
      message: error.message
    });
  }
});

// ============================================
// COINS
// ============================================

/**
 * GET /api/coins/recent
 * Get recent coins with creator info
 * Query params: limit
 */
router.get('/coins/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const query = `
      SELECT 
        c.*,
        cr.twitter_handle,
        cr.twitter_name,
        cr.twitter_profile_url,
        cr.total_coins,
        cr.migrated_coins,
        cr.success_rate
      FROM coins c
      LEFT JOIN creators cr ON c.creator_twitter_handle = cr.twitter_handle
      ORDER BY c.created_timestamp DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching recent coins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent coins',
      message: error.message
    });
  }
});

/**
 * GET /api/coins/:mint
 * Get coin details with creator stats
 */
router.get('/coins/:mint', async (req, res) => {
  try {
    const { mint } = req.params;

    const stats = await getCreatorStatsByMint(mint);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Coin not found'
      });
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching coin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coin stats',
      message: error.message
    });
  }
});

/**
 * POST /api/coins/batch
 * Get creator stats for multiple coins by mint addresses
 * Body: { mints: ["mint1", "mint2", ...] }
 */
router.post('/coins/batch', async (req, res) => {
  try {
    const { mints } = req.body;

    if (!Array.isArray(mints) || mints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: mints array required'
      });
    }

    // Limit to 100 mints per request
    const limitedMints = mints.slice(0, 100);

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
      WHERE c.mint = ANY($1)
    `;

    const result = await db.query(query, [limitedMints]);

    // Create a map for easy lookup
    const statsMap = {};
    result.rows.forEach(row => {
      statsMap[row.mint] = row;
    });

    res.json({
      success: true,
      data: statsMap,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching batch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch stats',
      message: error.message
    });
  }
});

// ============================================
// SEARCH
// ============================================

/**
 * GET /api/search
 * Search for creator by Twitter handle or coin by mint
 * Query params: q (query), type (creator|coin)
 */
router.get('/search', async (req, res) => {
  try {
    const { q, type } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter required'
      });
    }

    if (type === 'creator') {
      const cleanHandle = q.replace('@', '');
      const query = 'SELECT * FROM creators WHERE twitter_handle ILIKE $1';
      const result = await db.query(query, [`%${cleanHandle}%`]);

      return res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    } else if (type === 'coin') {
      const query = `
        SELECT 
          c.*,
          cr.twitter_handle,
          cr.twitter_name,
          cr.total_coins,
          cr.migrated_coins,
          cr.success_rate
        FROM coins c
        LEFT JOIN creators cr ON c.creator_twitter_handle = cr.twitter_handle
        WHERE c.mint = $1 OR c.symbol ILIKE $2
      `;
      const result = await db.query(query, [q, `%${q}%`]);

      return res.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type parameter (must be creator or coin)'
      });
    }
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

// ============================================
// STATISTICS
// ============================================

/**
 * GET /api/stats
 * Get system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM creators) as total_creators,
        (SELECT COUNT(*) FROM coins) as total_coins,
        (SELECT COUNT(*) FROM coins WHERE is_migrated = true) as total_migrations,
        (SELECT AVG(success_rate) FROM creators WHERE total_coins > 0) as avg_success_rate,
        (SELECT COUNT(*) FROM creators WHERE total_coins >= 5) as active_creators
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    // Get top creators
    const topCreatorsQuery = `
      SELECT * FROM creators
      WHERE total_coins > 0
      ORDER BY success_rate DESC, total_coins DESC
      LIMIT 10
    `;
    const topCreators = await db.query(topCreatorsQuery);

    res.json({
      success: true,
      data: {
        ...stats,
        top_creators: topCreators.rows
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');

    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM creators) as total_creators,
        (SELECT COUNT(*) FROM coins) as total_coins
    `;
    const result = await db.query(statsQuery);

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      stats: result.rows[0]
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

module.exports = router;
