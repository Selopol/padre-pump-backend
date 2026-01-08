import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/padre_pump',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'padre_pump',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  },

  // Helius RPC
  helius: {
    rpcUrl: process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=14649a76-7c70-443c-b6da-41cffe2543fd',
  },

  // Pump.fun API
  pumpfun: {
    apiUrl: process.env.PUMPFUN_API_URL || 'https://frontend-api-v3.pump.fun',
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3001'),
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Scanning
  scanning: {
    historicalEnabled: process.env.HISTORICAL_SCAN_ENABLED !== 'false', // Default true
    historicalLimit: parseInt(process.env.HISTORICAL_SCAN_LIMIT || '10000'),
    realtimeEnabled: process.env.REALTIME_MONITOR_ENABLED !== 'false', // Default true
    scanInterval: parseInt(process.env.SCAN_INTERVAL_MS || '10000'),
    migrationScanInterval: parseInt(process.env.MIGRATION_SCAN_INTERVAL_MS || '60000'),
  },

  // API
  api: {
    rateLimit: parseInt(process.env.API_RATE_LIMIT || '100'),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  // Cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
  },
};

export default config;
