import config from '../config/config.js';
import { pool } from './db/connection.js';
import { createServer, startServer } from './api/server.js';
import { performHistoricalScan } from './scanners/historical.js';
import { startRealtimeMonitor, startMigrationMonitor } from './scanners/realtime.js';
// import { walletTracker } from './scanners/wallet-tracker.js'; // Temporarily disabled

/**
 * Main application entry point
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 PADRE PUMP.FUN BACKEND SERVICE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚙️  Configuration:');
  console.log(`  Environment: ${config.server.env}`);
  console.log(`  Port: ${config.server.port}`);
  console.log(`  Database: ${config.database.name}`);
  console.log(`  Historical Scan: ${config.scanning.historicalEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(`  Real-time Monitor: ${config.scanning.realtimeEnabled ? 'Enabled' : 'Disabled'}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Step 1: Test database connection
    console.log('📊 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log('');

    // Step 2: Create and start Express server
    console.log('🌐 Starting API server...');
    const app = createServer();
    await startServer(app);

    // Step 3: Historical scan (if enabled)
    if (config.scanning.historicalEnabled) {
      console.log('📚 Historical scan enabled, starting...');
      await performHistoricalScan();
    } else {
      console.log('⏭️  Historical scan disabled, skipping...');
      console.log('');
    }

    // Step 4: Start real-time monitoring (if enabled)
    if (config.scanning.realtimeEnabled) {
      console.log('👁️  Starting real-time monitors...');
      const stopRealtimeMonitor = startRealtimeMonitor();
      const stopMigrationMonitor = startMigrationMonitor();

      // Store stop functions for graceful shutdown
      process.stopMonitors = () => {
        stopRealtimeMonitor();
        stopMigrationMonitor();
        // walletTracker.stop(); // Temporarily disabled
      };
    } else {
      console.log('⏭️  Real-time monitoring disabled, skipping...');
      console.log('');
    }

    // Step 5: Start WebSocket wallet tracker for INSTANT alerts
    // console.log('⚡ Starting instant wallet tracker...');
    // await walletTracker.start(); // Temporarily disabled

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ALL SYSTEMS OPERATIONAL');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎯 Backend service is now running 24/7');
    console.log('📡 API available at: http://localhost:' + config.server.port);
    console.log('👁️  Monitoring for new coins from tracked developers...');
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
    // Stop monitors
    if (process.stopMonitors) {
      console.log('🛑 Stopping monitors...');
      process.stopMonitors();
    }

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
