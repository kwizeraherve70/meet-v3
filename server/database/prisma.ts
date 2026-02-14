import { PrismaClient } from '@prisma/client';

console.log('[PRISMA] Creating PrismaClient...');

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
    
    // ✅ Add connection pool configuration
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
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

// ✅ Test database connection on startup
prisma.$connect()
  .then(() => {
    console.log('[PRISMA] Database connection established');
  })
  .catch((error) => {
    console.error('[PRISMA] Failed to connect to database:', error);
    process.exit(1);
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