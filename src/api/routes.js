import express from 'express';
import {
  getAllDevelopers,
  getDeveloperByAddress,
  getCoinsByCreator,
  getRecentCoins,
  getRecentAlerts,
  markAlertAsRead,
  getUnreadAlertCount,
  getSystemStats,
} from '../db/queries.js';

const router = express.Router();

// ============================================
// DEVELOPERS
// ============================================

/**
 * GET /api/developers
 * Get all developers with migration history
 * Query params: limit, offset, sort
 */
router.get('/developers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;

    const developers = await getAllDevelopers(limit, offset);

    res.json({
      success: true,
      data: developers,
      count: developers.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching developers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch developers',
      message: error.message,
    });
  }
});

/**
 * GET /api/developers/:address
 * Get specific developer details with all their coins
 */
router.get('/developers/:address', async (req, res) => {
  try {
    const { address } = req.params;

    const developer = await getDeveloperByAddress(address);
    if (!developer) {
      return res.status(404).json({
        success: false,
        error: 'Developer not found',
      });
    }

    const coins = await getCoinsByCreator(address);

    res.json({
      success: true,
      data: {
        developer,
        coins,
      },
    });
  } catch (error) {
    console.error('Error fetching developer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch developer',
      message: error.message,
    });
  }
});

// ============================================
// COINS
// ============================================

/**
 * GET /api/coins/recent
 * Get recent coins from tracked developers
 * Query params: limit
 */
router.get('/coins/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;

    const coins = await getRecentCoins(limit);

    res.json({
      success: true,
      data: coins,
      count: coins.length,
    });
  } catch (error) {
    console.error('Error fetching recent coins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent coins',
      message: error.message,
    });
  }
});

// ============================================
// ALERTS
// ============================================

/**
 * GET /api/alerts
 * Get recent alerts
 * Query params: limit, unread_only
 */
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unread_only === 'true';

    const alerts = await getRecentAlerts(limit, unreadOnly);
    const unreadCount = await getUnreadAlertCount();

    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      message: error.message,
    });
  }
});

/**
 * POST /api/alerts/:id/read
 * Mark alert as read
 */
router.post('/alerts/:id/read', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);

    const alert = await markAlertAsRead(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as read',
      message: error.message,
    });
  }
});

/**
 * GET /api/alerts/unread/count
 * Get count of unread alerts
 */
router.get('/alerts/unread/count', async (req, res) => {
  try {
    const count = await getUnreadAlertCount();

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count',
      message: error.message,
    });
  }
});

// ============================================
// SEARCH
// ============================================

/**
 * GET /api/search
 * Search for developer by wallet address
 * Query params: wallet
 */
router.get('/search', async (req, res) => {
  try {
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address is required',
      });
    }

    const developer = await getDeveloperByAddress(wallet);
    if (!developer) {
      return res.status(404).json({
        success: false,
        error: 'Developer not found',
        message: 'No developer found with this wallet address',
      });
    }

    const coins = await getCoinsByCreator(wallet);

    res.json({
      success: true,
      data: {
        developer,
        coins,
      },
    });
  } catch (error) {
    console.error('Error searching developer:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message,
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
    const stats = await getSystemStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message,
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
    const { pool } = await import('../db/connection.js');
    
    // Test database connection
    await pool.query('SELECT 1');

    const stats = await getSystemStats();

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      stats,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
    });
  }
});

export default router;
