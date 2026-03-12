import express, { Express } from 'express';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import prisma from './database/prisma.js';
import authRoutes from './routes/auth.routes.js';
import roomRoutes from './routes/rooms.routes.js';
import recordingsRoutes from './routes/recordings.routes.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

/**
 * Create and configure Express application
 * This file handles ONLY Express configuration
 * Socket.IO initialization happens in server.ts
 */
export function createApp(): Express {
  const app = express();

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max file size
    },
  });

  // ============================================================================
  // MIDDLEWARE STACK (executed in order)
  // ============================================================================

  // 1. Core middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.static('public')); // Serve static files for recordings
  app.use('/recordings', express.static(path.join(process.cwd(), 'recordings')));

  // 2. Authentication middleware (optional - sets req.user if token valid)
  app.use(authMiddleware);

  // ============================================================================
  // HEALTH CHECKS
  // ============================================================================

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.get('/api/health/db', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        error: (error as Error).message,
      });
    }
  });

  // ============================================================================
  // ROUTES
  // ============================================================================

  app.use('/auth', authRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/recordings', upload.single('file'), recordingsRoutes);

  // ============================================================================
  // ERROR HANDLING (must be registered last)
  // ============================================================================

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
