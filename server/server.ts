import { createServer, Server as HTTPServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import createApp from './app.js';
import initializeSocketIO from './sockets/index.js';
import { initializeUpstashRedis, disconnectUpstash } from './config/upstash.config.js';
// ✅ ADD THIS IMPORT
import { cleanupCache, verifyCacheHealth } from './utils/cleanup-cache.js';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables before anything else
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Setup global error handler
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

/**
 * Bootstrap and start the server
 * 
 * This file:
 * 1. Initializes Upstash Redis cache
 * 2. Creates HTTP server
 * 3. Initializes Express app
 * 4. Initializes Socket.IO
 * 5. Starts listening on configured port
 * 6. ✅ NEW: Runs cache cleanup and health check
 */

async function bootstrap(): Promise<HTTPServer> {
  try {
    // Initialize Upstash Redis
    console.log('[0/6] Initializing Upstash Redis cache...');
    try {
      initializeUpstashRedis();
      console.log('[UPSTASH] Cache initialized successfully');
    } catch (error) {
      console.warn('[UPSTASH] Cache not available, skipping:', (error as Error).message);
    }

    console.log('[1/6] Creating Express application...');
    const app = createApp();
    console.log('[2/6] Creating HTTP server...');
    const httpServer = createServer(app);
    console.log('[3/6] Initializing Socket.IO...');
    const io = initializeSocketIO(httpServer);
    console.log('[4/6] Parsing port configuration...');
    const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);
    console.log('[5/6] Starting server...');

    // Start listening
    httpServer.listen(PORT, async () => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 WebRTC Meeting Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📍 Server: http://localhost:${PORT}
  🔌 WebSocket: ws://localhost:${PORT}
  🏥 Health: http://localhost:${PORT}/health
  🗄️  Database Health: http://localhost:${PORT}/api/health/db
  💾 Cache: Upstash Redis (Serverless)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: ${process.env.NODE_ENV || 'development'}
  Database: ${process.env.DB_NAME || 'meeting_v2_dev'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);

      // ✅ ADD THIS: Run cache cleanup and health check
      console.log('[6/6] Running cache cleanup and health check...');
      try {
        // Run cleanup ONCE to fix corrupted cache entries
        // IMPORTANT: After running successfully, comment out the next line
        await cleanupCache();
        
        // Verify cache is working correctly
        await verifyCacheHealth();
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Server initialization complete - Ready to accept connections!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } catch (error) {
        console.error('⚠️  Cache cleanup failed (server will continue):', (error as Error).message);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('[SHUTDOWN] SIGTERM signal received');
      await disconnectUpstash();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('[SHUTDOWN] SIGINT signal received');
      await disconnectUpstash();
      process.exit(0);
    });

    return httpServer;
  } catch (error) {
    console.error('BOOTSTRAP ERROR:', error);
    process.exit(1);
  }
}

// Run bootstrap immediately
bootstrap();