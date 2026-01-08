# Backend Configuration

## Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/padre_pump
DB_HOST=localhost
DB_PORT=5432
DB_NAME=padre_pump
DB_USER=postgres
DB_PASSWORD=password

# Helius RPC
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=14649a76-7c70-443c-b6da-41cffe2543fd

# Pump.fun API
PUMPFUN_API_URL=https://frontend-api-v3.pump.fun

# Server Configuration
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Scanning Configuration
HISTORICAL_SCAN_ENABLED=true
HISTORICAL_SCAN_LIMIT=10000
REALTIME_MONITOR_ENABLED=true
SCAN_INTERVAL_MS=10000
MIGRATION_SCAN_INTERVAL_MS=60000

# API Configuration
API_RATE_LIMIT=100
CORS_ORIGIN=*

# Cache Configuration
CACHE_TTL_SECONDS=300
```

## Configuration Files

- `config.js` - Main configuration loader
- `.env` - Environment-specific variables (not committed to git)
