import { Server as SocketIOServer } from 'socket.io';

/**
 * Shared utilities and state for Socket.IO handlers
 */

export interface User {
  username: string;
  id: string;
  socketId: string;
  roomId: string;
}

/**
 * In-memory user tracking for active connections
 * Structure: { roomId: { username: User } }
 * 
 * NOTE: For production with multiple server instances,
 * consider migrating to Redis for shared state
 */
export const users: { [roomId: string]: { [username: string]: User } } = {};

/**
 * Helper: Find user across all rooms by username
 * @param username - Username to search for
 * @returns User object if found, null otherwise
 */
export function findUser(username: string): User | null {
  for (const roomId in users) {
    if (users[roomId][username]) {
      return users[roomId][username];
    }
  }
  return null;
}

/**
 * Helper: Remove user from all rooms on disconnect
 * @param socketId - Socket ID to search for
 * @param io - Socket.IO server instance (for broadcasting)
 */
export function removeUserFromRooms(socketId: string, io: SocketIOServer): void {
  for (const roomId in users) {
    for (const username in users[roomId]) {
      if (users[roomId][username].socketId === socketId) {
        console.log(`👤 ${username} left room: ${roomId}`);
        delete users[roomId][username];

        // Notify others in room
        io.to(`room-${roomId}`).emit('user-left', { username });

        // Cleanup empty rooms
        if (Object.keys(users[roomId]).length === 0) {
          delete users[roomId];
        }
      }
    }
  }
}
