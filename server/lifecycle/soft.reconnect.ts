import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../lib/logger.js';
import {
  getSocket,
  removeSocket,
  getSocketsByUserId,
  addSocketToRoom,
  getSocketsInRoom,
} from '../state/socket.state.js';

/**
 * Soft reconnection handling
 * Allows users to rejoin a room within a grace period after disconnection
 */

interface PendingReconnection {
  userId: number | string;
  userName: string;
  email: string | null;
  roomId: number | string;
  disconnectedAt: Date;
  timeoutId: NodeJS.Timeout;
}

// In-memory store of pending reconnections (in production, use Redis)
const pendingReconnections: Map<string, PendingReconnection> = new Map();

// Grace period for reconnection (in milliseconds)
const RECONNECT_GRACE_PERIOD = 30 * 1000; // 30 seconds

/**
 * Mark a user for soft reconnection
 * Called when a user in a room disconnects
 */
export function markForReconnect(
  userId: number | string,
  userName: string,
  email: string | null,
  roomId: number | string,
  io: SocketIOServer
): void {
  const key = `${roomId}:${userId}`;

  // Clear any existing pending reconnect for this user
  const existing = pendingReconnections.get(key);
  if (existing) {
    clearTimeout(existing.timeoutId);
  }

  // Set timeout to clear pending reconnection after grace period
  const timeoutId = setTimeout(() => {
    handleReconnectTimeout(key, roomId, io);
  }, RECONNECT_GRACE_PERIOD);

  pendingReconnections.set(key, {
    userId,
    userName,
    email,
    roomId,
    disconnectedAt: new Date(),
    timeoutId,
  });

  logger.info('SoftReconnect', 'User marked for reconnection', {
    userId,
    userName,
    roomId,
    graceSeconds: RECONNECT_GRACE_PERIOD / 1000,
  });

  // Notify other users that someone disconnected but can still rejoin
  io.to(`room-${roomId}`).emit('user-reconnect-grace', {
    userId,
    userName,
    graceSeconds: RECONNECT_GRACE_PERIOD / 1000,
    message: `${userName} disconnected. They can rejoin within ${RECONNECT_GRACE_PERIOD / 1000}s.`,
  });
}

/**
 * Attempt to reconnect a user
 * Called when a user with existing reconnection window rejoins
 */
export function attemptReconnect(
  socket: Socket,
  userId: number | string,
  roomId: number | string,
  userName: string
): boolean {
  const key = `${roomId}:${userId}`;
  const pending = pendingReconnections.get(key);

  if (!pending) {
    return false; // No pending reconnection
  }

  // Clear pending reconnection
  clearTimeout(pending.timeoutId);
  pendingReconnections.delete(key);

  // Re-add socket to room
  addSocketToRoom(socket.id, roomId, false); // Preserve host status in state
  socket.join(`room-${roomId}`);

  logger.info('SoftReconnect', 'User successfully reconnected', {
    userId,
    userName,
    roomId,
    socketId: socket.id,
  });

  // Notify room of reconnection
  const roomSockets = getSocketsInRoom(roomId);
  const participants = roomSockets.map((s) => ({
    userId: s.userId,
    userName: s.userName,
    isHost: s.isHost,
  }));

  socket.emit('room-rejoined', {
    roomId,
    participants,
    message: 'Successfully reconnected to the room',
  });

  socket.broadcast.to(`room-${roomId}`).emit('user-reconnected', {
    userId,
    userName,
  });

  return true;
}

/**
 * Handle reconnection timeout (user didn't rejoin in time)
 */
function handleReconnectTimeout(
  key: string,
  roomId: number | string,
  io: SocketIOServer
): void {
  const pending = pendingReconnections.get(key);
  if (!pending) return;

  pendingReconnections.delete(key);

  logger.info('SoftReconnect', 'Reconnection grace period expired', {
    userId: pending.userId,
    userName: pending.userName,
    roomId,
  });

  // Notify room that user won't be rejoining
  io.to(`room-${roomId}`).emit('user-left', {
    userId: pending.userId,
    userName: pending.userName,
  });
}

/**
 * Check if user has a pending reconnection
 */
export function hasPendingReconnection(userId: number | string, roomId: number | string): boolean {
  const key = `${roomId}:${userId}`;
  return pendingReconnections.has(key);
}

/**
 * Get pending reconnection info
 */
export function getPendingReconnection(userId: number | string, roomId: number | string) {
  const key = `${roomId}:${userId}`;
  return pendingReconnections.get(key);
}

/**
 * Clear all pending reconnections (for testing or cleanup)
 */
export function clearAllPendingReconnections(): void {
  for (const [, pending] of pendingReconnections) {
    clearTimeout(pending.timeoutId);
  }
  pendingReconnections.clear();
  logger.info('SoftReconnect', 'All pending reconnections cleared');
}

export default {
  markForReconnect,
  attemptReconnect,
  hasPendingReconnection,
  getPendingReconnection,
  clearAllPendingReconnections,
};
