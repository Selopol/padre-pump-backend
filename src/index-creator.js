/**
 * Main Entry Point - Creator Tracking System
 * Monitors Pump.fun tokens and tracks creators via Twitter
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

/**
 * Main application entry point
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 PADRE PUMP.FUN CREATOR TRACKER');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Dynamic imports for ES modules
    const config = (await import('../config/config.js')).default;
    const { pool } = await import('./db/connection.js');
    const { startRealtimeScanning, stopRealtimeScanning } = require('./scanners/realtime-creator');
    const { testConnection } = require('./services/twitter-api');
    const creatorRoutes = require('./api/routes-creator');

    console.log('⚙️  Configuration:');
    console.log(`  Environment: ${config.server.env}`);
    console.log(`  Port: ${config.server.port}`);
    console.log(`  Database: ${config.database.name}`);
    console.log(`  Twitter API: Enabled`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Step 1: Test database connection
    console.log('📊 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log('');

    // Step 2: Run database migration for creator schema
    const { runMigration } = require('./db/migrate-creator');
    const migrationSuccess = await runMigration(pool);
    
    if (!migrationSuccess) {
      console.error('❌ Migration failed, but continuing...');
    }
    console.log('');

    // Step 3: Test Twitter API connection
    console.log('🐦 Testing Twitter API connection...');
    const twitterOk = await testConnection();
    
    if (twitterOk) {
      console.log('✅ Twitter API connected successfully');
    } else {
      console.warn('⚠️  Twitter API connection failed, but continuing...');
    }
    console.log('');

    // Step 4: Create Express server
    console.log('🌐 Starting API server...');
    const app = express();
    
    // Middleware
    // Simple CORS middleware
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', config.api.corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
    
    // Add creator routes
    app.use('/api', creatorRoutes);
    
    // Root endpoint
    app.get('/', (req, res) => {
      res.json({
        name: 'Padre Pump.fun Creator Tracker API',
        version: '2.0.0',
        status: 'running',
        endpoints: {
          health: '/api/health',
          stats: '/api/stats',
          creators: '/api/creators',
          coins: '/api/coins/recent',
          coinByMint: '/api/coins/:mint',
          batch: '/api/coins/batch',
          search: '/api/search'
        }
      });
    });
    
    // Error handler
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
      });
    });
    
    // Start server
    const PORT = config.server.port;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ API server listening on port ${PORT}`);
    });
    
    console.log('');

    // Step 5: Start real-time creator scanning
    console.log('👁️  Starting real-time creator scanner...');
    await startRealtimeScanning();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL SYSTEMS OPERATIONAL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎯 Creator tracking service is now running 24/7');
    console.log('📡 API available at: http://localhost:' + PORT);
    console.log('👁️  Monitoring for new coins and identifying creators...');
    console.log('🐦 Tracking creator statistics via Twitter');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

    // Store references for shutdown
    global.appShutdown = async () => {
      console.log('🛑 Stopping creator scanner...');
      stopRealtimeScanning();
      console.log('🛑 Closing database connection...');
      await pool.end();
    };

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ STARTUP FAILED');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function shutdown(signal) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    if (global.appShutdown) {
      await global.appShutdown();
    }

    console.log('');
    console.log('✅ Shutdown complete');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ UNCAUGHT EXCEPTION');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('');
  console.error(error);
  console.error('');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('❌ UNHANDLED REJECTION');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('');
  process.exit(1);
});

// Start the application
main();
