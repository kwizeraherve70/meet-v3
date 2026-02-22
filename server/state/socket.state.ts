import { logger } from '../lib/logger.js';

/**
 * Socket State Management
 * Tracks active socket connections, authenticated users, and room memberships
 */

export interface SocketState {
  socketId: string;
  userId: number | null;
  guestId: string | null;
  userName: string | null;
  email: string | null;
  roomId: number | string | null;
  isHost: boolean;
  isGuest: boolean;
  connectedAt: Date;
  joinedRoomAt: Date | null;
  lastActivity: Date;
  isAuthenticated: boolean;
  mediaState?: {
    isVideoEnabled: boolean;
    isAudioEnabled: boolean;
  };
}

/**
 * In-memory socket state store
 * Key: socketId
 */
const sockets: Map<string, SocketState> = new Map();

/**
 * User ID to socketIds mapping (supports multi-tab)
 * Key: userId, Value: array of socketIds
 */
const userToSockets: Map<number | string, string[]> = new Map();

/**
 * Room to socketIds mapping
 * Key: roomId, Value: array of socketIds
 */
const roomToSockets: Map<number | string, string[]> = new Map();

/**
 * Register a new socket connection (before authentication)
 */
export function registerSocket(socketId: string): SocketState {
  const state: SocketState = {
    socketId,
    userId: null,
    guestId: null,
    userName: null,
    email: null,
    roomId: null,
    isHost: false,
    isGuest: false,
    connectedAt: new Date(),
    joinedRoomAt: null,
    lastActivity: new Date(),
    isAuthenticated: false,
  };

  sockets.set(socketId, state);
  logger.debug('SocketState', 'Socket registered', { socketId });
  return state;
}

/**
 * Authenticate a socket with user info
 */
export function authenticateSocket(
  socketId: string,
  userId: number | null,
  userName: string,
  email: string | null,
  isGuest = false,
  guestId: string | null = null
): void {
  const state = sockets.get(socketId);
  if (!state) {
    logger.warn('SocketState', 'Socket not found for auth', { socketId });
    return;
  }

  state.userId = userId;
  state.guestId = guestId;
  state.userName = userName;
  state.email = email;
  state.isAuthenticated = true;
  state.isGuest = isGuest;
  state.lastActivity = new Date();

  // Map user to socket (for multi-tab support)
  const identifier = userId || guestId;
  if (identifier) {
    if (!userToSockets.has(identifier)) {
      userToSockets.set(identifier, []);
    }
    userToSockets.get(identifier)!.push(socketId);
  }

  logger.info('SocketState', 'Socket authenticated', { socketId, userId, guestId, userName });
}

/**
 * Authenticate a socket as a guest
 */
export function authenticateGuestSocket(
  socketId: string,
  guestId: string,
  guestName: string
): void {
  const state = sockets.get(socketId);
  if (!state) {
    logger.warn('SocketState', 'Socket not found for guest auth', { socketId });
    return;
  }

  state.guestId = guestId;
  state.userName = guestName;
  state.isAuthenticated = true;
  state.isGuest = true;
  state.lastActivity = new Date();

  logger.info('SocketState', 'Guest socket authenticated', { socketId, guestId, guestName });
}

/**
 * Add socket to room
 */
export function addSocketToRoom(
  socketId: string,
  roomId: number | string,
  isHost: boolean = false
): void {
  const state = sockets.get(socketId);
  if (!state) {
    logger.warn('SocketState', 'Socket not found for room join', { socketId, roomId });
    return;
  }

  // Remove from previous room if any
  if (state.roomId !== null) {
    removeSocketFromRoom(socketId, state.roomId);
  }

  state.roomId = roomId;
  state.isHost = isHost;
  state.joinedRoomAt = new Date();
  state.lastActivity = new Date();

  // Map room to socket
  if (!roomToSockets.has(roomId)) {
    roomToSockets.set(roomId, []);
  }
  roomToSockets.get(roomId)!.push(socketId);

  logger.info('SocketState', 'Socket joined room', { socketId, roomId, isHost });
}

/**
 * Remove socket from room
 */
export function removeSocketFromRoom(socketId: string, roomId: number | string): void {
  const state = sockets.get(socketId);
  if (!state || state.roomId === null) {
    return;
  }

  // Ensure the socket is actually in the room we're trying to remove it from
  if (state.roomId !== roomId) {
    logger.warn('SocketState', 'Socket not in specified room for removal', { socketId, currentRoomId: state.roomId, targetRoomId: roomId });
    return;
  }

  const sockets_in_room = roomToSockets.get(roomId);
  if (sockets_in_room) {
    const index = sockets_in_room.indexOf(socketId);
    if (index > -1) {
      sockets_in_room.splice(index, 1);
    }
    if (sockets_in_room.length === 0) {
      roomToSockets.delete(roomId);
    }
  }

  state.roomId = null;
  state.isHost = false;
  state.joinedRoomAt = null;
  state.lastActivity = new Date();

  logger.info('SocketState', 'Socket left room', { socketId, roomId });
}

/**
 * Get socket state by ID
 */
export function getSocket(socketId: string): SocketState | undefined {
  return sockets.get(socketId);
}

/**
 * Get all sockets for a user
 */
export function getSocketsByUserId(userId: number | string): SocketState[] {
  const socketIds = userToSockets.get(userId) || [];
  return socketIds.map(sid => sockets.get(sid)).filter((s) => s !== undefined) as SocketState[];
}

/**
 * Get user ID from socket ID
 */
export function getUserIdBySocket(socketId: string): number | null {
  const state = sockets.get(socketId);
  return state?.userId || null;
}

/**
 * Get all sockets in a specific room
 */
export function getSocketsInRoom(roomId: number | string): SocketState[] {
  const socketIds = roomToSockets.get(roomId) || [];
  return socketIds.map(sid => sockets.get(sid)).filter((s) => s !== undefined) as SocketState[];
}

/**
 * Remove socket from store (on disconnect)
 */
export function removeSocket(socketId: string): SocketState | undefined {
  const state = sockets.get(socketId);
  if (!state) {
    return undefined;
  }

  // Remove from user mapping
  if (state.userId !== null) {
    const userSockets = userToSockets.get(state.userId);
    if (userSockets) {
      const index = userSockets.indexOf(socketId);
      if (index > -1) {
        userSockets.splice(index, 1);
      }
      if (userSockets.length === 0) {
        userToSockets.delete(state.userId);
      }
    }
  }

  // Remove from room mapping
  if (state.roomId) {
    removeSocketFromRoom(socketId, state.roomId);
  }

  sockets.delete(socketId);
  logger.info('SocketState', 'Socket removed', { socketId, userId: state.userId });
  return state;
}

/**
 * Get all connected sockets count
 */
export function getConnectedSocketsCount(): number {
  return sockets.size;
}

/**
 * Get all active rooms count
 */
export function getActiveRoomsCount(): number {
  return roomToSockets.size;
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(socketId: string): void {
  const state = sockets.get(socketId);
  if (state) {
    state.lastActivity = new Date();
  }
}

/**
 * Get debug info for monitoring
 */
export function getDebugInfo() {
  return {
    totalSockets: sockets.size,
    totalUsers: userToSockets.size,
    totalRooms: roomToSockets.size,
    rooms: Array.from(roomToSockets.entries()).map(([roomId, socketIds]) => ({
      roomId,
      participants: socketIds.length,
    })),
  };
}
export default {
  registerSocket,
  authenticateSocket,
  authenticateGuestSocket,
  addSocketToRoom,
  removeSocketFromRoom,
  getSocket,
  getSocketsByUserId,
  getUserIdBySocket,
  getSocketsInRoom,
  removeSocket,
  getConnectedSocketsCount,
  getActiveRoomsCount,
  updateLastActivity,
  getDebugInfo,
};