import { ServerOptions } from 'socket.io';
import { env } from './env.js';

/**
 * Socket.IO Server Configuration
 * Centralizes all Socket.IO settings for the signaling server
 */

/**
 * CORS configuration for Socket.IO
 */
export const socketCorsConfig = {
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  credentials: true,
};

/**
 * Socket.IO connection settings
 */
export const socketConnectionConfig = {
  // Ping interval (ms) - how often to check client connectivity
  pingInterval: 25000,
  
  // Ping timeout (ms) - how long to wait for pong before disconnect
  pingTimeout: 20000,
  
  // Max reconnection attempts before giving up
  maxHttpBufferSize: 1e6, // 1MB
  
  // Allow transport upgrades (polling -> websocket)
  allowUpgrades: true,
  
  // Transports to use
  transports: ['polling', 'websocket'] as ('polling' | 'websocket')[],
};

/**
 * Room configuration
 */
export const roomConfig = {
  // Maximum participants per room
  maxParticipants: 50,
  
  // Room cleanup delay after last participant leaves (ms)
  cleanupDelay: 5 * 60 * 1000, // 5 minutes
  
  // Auto-end room after inactivity (ms)
  inactivityTimeout: 60 * 60 * 1000, // 1 hour
};

/**
 * Reconnection configuration
 */
export const reconnectConfig = {
  // How long to keep participant state after disconnect (ms)
  stateRetentionTime: 30 * 1000, // 30 seconds
  
  // How long to allow reconnection before cleanup (ms)
  reconnectWindow: 60 * 1000, // 1 minute
};

/**
 * Get complete Socket.IO server options
 */
export function getSocketServerOptions(): Partial<ServerOptions> {
  return {
    cors: socketCorsConfig,
    ...socketConnectionConfig,
  };
}

export default {
  cors: socketCorsConfig,
  connection: socketConnectionConfig,
  room: roomConfig,
  reconnect: reconnectConfig,
  getServerOptions: getSocketServerOptions,
};
