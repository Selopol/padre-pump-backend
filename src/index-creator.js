/**
 * Main Entry Point - Creator Tracking System
 * Monitors Pump.fun tokens and tracks creators via Twitter
 */

import config from '../config/config.js';
import { pool } from './db/connection.js';
import { createServer, startServer } from './api/server.js';
import { startRealtimeScanning } from './scanners/realtime-creator.js';

/**
 * Main application entry point
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 PADRE PUMP.FUN CREATOR TRACKER');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚙️  Configuration:');
  console.log(`  Environment: ${config.server.env}`);
  console.log(`  Port: ${config.server.port}`);
  console.log(`  Database: ${config.database.name}`);
  console.log(`  Twitter API: Enabled`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Test database connection
    console.log('📊 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log('');

    // Step 2: Run database migration for creator schema
    console.log('🛠️  Running creator schema migration...');
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, 'db', 'schema-creator.sql');
    
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    
    console.log('✅ Creator schema migration completed');
    console.log('');

    // Step 3: Test Twitter API connection
    console.log('🐦 Testing Twitter API connection...');
    const { testConnection } = await import('./services/twitter-api.js');
    const twitterOk = await testConnection();
    
    if (twitterOk) {
      console.log('✅ Twitter API connected successfully');
    } else {
      console.warn('⚠️  Twitter API connection failed, but continuing...');
    }
    console.log('');

    // Step 4: Create and start Express server with creator routes
    console.log('🌐 Starting API server...');
    const app = createServer();
    
    // Add creator routes
    const creatorRoutes = await import('./api/routes-creator.js');
    app.use('/api', creatorRoutes.default);
    
    await startServer(app);

    // Step 5: Start real-time creator scanning
    console.log('👁️  Starting real-time creator scanner...');
    await startRealtimeScanning();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL SYSTEMS OPERATIONAL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎯 Creator tracking service is now running 24/7');
    console.log('📡 API available at: http://localhost:' + config.server.port);
    console.log('👁️  Monitoring for new coins and identifying creators...');
    console.log('🐦 Tracking creator statistics via Twitter');
    console.log('');
    console.log('Press Ctrl+C to stop');
    console.log('');

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
    // Stop scanner
    console.log('🛑 Stopping creator scanner...');
    const { stopRealtimeScanning } = await import('./scanners/realtime-creator.js');
    stopRealtimeScanning();

    // Close database connection
    console.log('🛑 Closing database connection...');
    await pool.end();

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
