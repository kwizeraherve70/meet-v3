import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment configuration
 * Centralizes all environment variable access with type safety and defaults
 */
export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  SERVER_PORT: parseInt(process.env.SERVER_PORT || '3001', 10),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_NAME: process.env.DB_NAME || 'meeting_v2_dev',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // WebRTC / TURN
  TURN_SERVER_URL: process.env.TURN_SERVER_URL || '',
  TURN_USERNAME: process.env.TURN_USERNAME || '',
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || '',
} as const;

/**
 * Validate required environment variables
 * Call this at startup to ensure all required vars are set
 */
export function validateEnv(): void {
  const required: (keyof typeof env)[] = ['DATABASE_URL'];
  const missing = required.filter((key) => !env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
  }
}

export default env;
