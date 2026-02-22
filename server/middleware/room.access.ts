import { Socket } from 'socket.io';
import prisma from '../database/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Room access validation middleware
 * 
 * Validates that authenticated users have access to join a room
 * Checks:
 * - Room exists
 * - Room is active
 * - User can join (no restrictions in MVP)
 */
export async function validateRoomAccess(
  socket: Socket,
  roomId: number | string,
  roomCode?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const user = socket.data.user;
    
    if (!user) {
      logger.warn('RoomAccess', 'Unauthenticated socket attempting room access', {
        socketId: socket.id,
        roomId,
      });
      return { valid: false, error: 'User not authenticated' };
    }

    // Determine query condition based on roomId type
    const whereCondition = typeof roomId === 'number' || !isNaN(Number(roomId)) 
      ? { id: Number(roomId) } 
      : { roomCode: String(roomId) };

    // Check if room exists
    const room = await prisma.room.findUnique({
      where: whereCondition,
      select: {
        id: true,
        roomCode: true,
        isActive: true,
        createdAt: true,
        createdById: true,
      },
    });

    if (!room) {
      logger.warn('RoomAccess', 'Room not found', {
        userId: user.id || user.guestId,
        roomId,
        whereCondition
      });
      return { valid: false, error: 'Room not found' };
    }

    // Check if room is active
    if (!room.isActive) {
      logger.warn('RoomAccess', 'Room is not active', {
        userId: user.id || user.guestId,
        roomId,
      });
      return { valid: false, error: 'Room is not active' };
    }

    // Verify room code matches if provided
    if (roomCode && room.roomCode !== roomCode) {
      logger.warn('RoomAccess', 'Invalid room code', {
        userId: user.id || user.guestId,
        roomId,
        providedCode: roomCode,
        actualCode: room.roomCode,
      });
      return { valid: false, error: 'Invalid room code' };
    }

    logger.info('RoomAccess', 'Room access validated', {
      userId: user.id || user.guestId,
      userName: user.name,
      roomId,
      roomCode: room.roomCode,
    });

    return { valid: true };
  } catch (error) {
    logger.error('RoomAccess', 'Validation error', {
      socketId: socket.id,
      roomId,
      error: (error as Error).message,
    });
    return { valid: false, error: 'Validation failed' };
  }
}

export async function getRoomInfo(roomId: number | string) {
  try {
    const whereCondition = typeof roomId === 'number' || !isNaN(Number(roomId)) 
      ? { id: Number(roomId) } 
      : { roomCode: String(roomId) };

    const room = await prisma.room.findUnique({
      where: whereCondition,
      select: {
        id: true,
        roomCode: true,
        title: true,
        isActive: true,
        createdById: true,
        createdAt: true,
      },
    });

    if (room) {
      return {
        ...room,
        participants: 0, // Will be calculated separately
      };
    }

    return room;
  } catch (error) {
    logger.error('RoomInfo', 'Error fetching room info', {
      roomId,
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Check if user is room host
 */
export async function isRoomHost(roomId: number | string, userId: number | null): Promise<boolean> {
  if (!userId) return false;

  try {
    const whereCondition = typeof roomId === 'number' || !isNaN(Number(roomId)) 
      ? { id: Number(roomId) } 
      : { roomCode: String(roomId) };

    const room = await prisma.room.findUnique({
      where: whereCondition,
      select: { createdById: true },
    });

    return room?.createdById === userId;
  } catch (error) {
    logger.error('RoomAccess', 'Error checking host status', {
      roomId,
      userId,
      error: (error as Error).message,
    });
    return false;
  }
}
