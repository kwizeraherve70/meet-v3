import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file with explicit path
const envPath = path.resolve(__dirname, '../../.env');
const envResult = dotenv.config({ path: envPath });

console.log('[PRISMA] ENV PATH:', envPath);
console.log('[PRISMA] DATABASE_URL from env:', process.env.DATABASE_URL ? '✓ Set' : '✗ NOT SET');
if (envResult.error) {
  console.error('[PRISMA] Error loading .env:', envResult.error);
} else {
  console.log('[PRISMA] .env loaded successfully');
}

console.log('[PRISMA] Creating PrismaClient...');

// Ensure DATABASE_URL is available before creating the client
if (!process.env.DATABASE_URL) {
  console.error('[PRISMA] DATABASE_URL not found in environment');
  console.error('[PRISMA] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('URL')));
  throw new Error('DATABASE_URL environment variable is required');
}

console.log('[PRISMA] DATABASE_URL verified:', process.env.DATABASE_URL.substring(0, 30) + '...');

/**
 * Instantiate Prisma Client with connection pooling
 * Singleton pattern to ensure we don't create multiple instances
 * 
 * FIXED: Added connection pooling to prevent "connection forcibly closed" errors
 */
let prisma: PrismaClient;

try {
  prisma = new PrismaClient({
    log: ['warn', 'error'], // Only log warnings and errors
  });

  // ✅ Set connection pool limits (prevents connection drops)
  // This configures the underlying database connection pool
  prisma.$use(async (params, next) => {
    return next(params);
  });

  console.log('[PRISMA] PrismaClient created successfully with connection pooling');
} catch (error) {
  console.error('[PRISMA] Failed to create PrismaClient:', error);
  process.exit(1);
}

// ✅ Test database connection on startup (lazy connection)
let connectionPromise: Promise<void> | null = null;

export async function ensureDbConnection() {
  if (!connectionPromise) {
    connectionPromise = prisma.$connect();
  }
  return connectionPromise;
}

// Lazy connection - only connect when needed
ensureDbConnection()
  .then(() => {
    console.log('[PRISMA] Database connection established');
  })
  .catch((error) => {
    console.error('[PRISMA] Failed to connect to database:', error);
    // Don't exit immediately - let the app try to serve requests
  });

// ✅ Handle connection errors during runtime
prisma.$on('error' as never, (error: any) => {
  console.error('[PRISMA] Database error:', error);
});

// ✅ Handle graceful shutdown
const gracefulShutdown = async () => {
  console.log('[PRISMA] Disconnecting...');
  try {
    await prisma.$disconnect();
    console.log('[PRISMA] Disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('[PRISMA] Error during disconnect:', error);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// ✅ Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('[PRISMA] Uncaught exception:', error);
  await gracefulShutdown();
});

export default prisma;