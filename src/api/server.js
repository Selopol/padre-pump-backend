import express from 'express';
import cors from 'cors';
import config from '../../config/config.js';
import routes from './routes.js';

/**
 * Create and configure Express server
 * @returns {express.Application} Configured Express app
 */
export function createServer() {
  const app = express();

  // ============================================
  // MIDDLEWARE
  // ============================================

  // CORS - Allow requests from Chrome extension
  app.use(cors({
    origin: config.api.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // JSON body parser
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    
    next();
  });

  // ============================================
  // ROUTES
  // ============================================

  // API routes
  app.use('/api', routes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Padre Pump.fun Backend API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/api/health',
        developers: '/api/developers',
        alerts: '/api/alerts',
        coins: '/api/coins/recent',
        search: '/api/search?wallet=<address>',
        stats: '/api/stats',
      },
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      message: `Route ${req.method} ${req.path} not found`,
    });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
      ...(config.server.env === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

/**
 * Start the Express server
 * @param {express.Application} app - Express app instance
 * @returns {Promise<http.Server>} HTTP server instance
 */
export function startServer(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.server.port, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🚀 SERVER STARTED');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`  Port: ${config.server.port}`);
      console.log(`  Environment: ${config.server.env}`);
      console.log(`  URL: http://localhost:${config.server.port}`);
      console.log('');
      console.log('📡 API Endpoints:');
      console.log(`  GET  /api/health`);
      console.log(`  GET  /api/stats`);
      console.log(`  GET  /api/developers`);
      console.log(`  GET  /api/developers/:address`);
      console.log(`  GET  /api/coins/recent`);
      console.log(`  GET  /api/alerts`);
      console.log(`  POST /api/alerts/:id/read`);
      console.log(`  GET  /api/search?wallet=<address>`);
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      
      resolve(server);
    });

    server.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });
  });
}

export default { createServer, startServer };
