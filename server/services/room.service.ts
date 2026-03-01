import prisma from '../database/prisma.js';
import { Room, CreateRoomRequest } from '../types/index.js';
import { cache } from '../lib/cache.js';

// Cache key constants
const CACHE_KEYS = {
  ROOM_ID: (id: number) => `room:id:${id}`,
  ROOM_CODE: (code: string) => `room:code:${code}`,
  USER_ROOMS: (userId: number) => `user:rooms:${userId}`,
  ROOM_PARTICIPANTS: (roomId: number) => `room:participants:${roomId}`,
};

const CACHE_TTL = {
  ROOM: 1800, // 30 minutes
  USER_ROOMS: 600, // 10 minutes
  PARTICIPANTS: 300, // 5 minutes
};

/**
 * Generates a random room code in format: xxx-xxx-xxx
 */
function generateRoomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    if (i > 0) code += '-';
    for (let j = 0; j < 3; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return code;
}

export class RoomService {
  /**
   * Create a new meeting room
   * @param createdBy User ID of room creator
   * @param roomData Room creation data
   * @throws Error if database error
   */
  async createRoom(createdBy: number, roomData: CreateRoomRequest): Promise<Room> {
    const roomCode = generateRoomCode();
    const title = roomData.title || 'Untitled Meeting';

    const room = await prisma.room.create({
      data: {
        roomCode,
        createdById: createdBy,
        title,
      },
      select: {
        id: true,
        roomCode: true,
        createdById: true,
        title: true,
        createdAt: true,
        endTime: true,
      },
    });

    const roomObj = {
      id: room.id,
      room_id: room.roomCode,
      created_by: room.createdById,
      title: room.title,
      created_at: room.createdAt,
      ended_at: room.endTime,
    } as Room;

    // Cache new room
    await cache.set(CACHE_KEYS.ROOM_ID(room.id), roomObj, CACHE_TTL.ROOM);
    await cache.set(CACHE_KEYS.ROOM_CODE(roomCode), roomObj, CACHE_TTL.ROOM);
    
    // Invalidate user rooms cache
    await cache.delete(CACHE_KEYS.USER_ROOMS(createdBy));

    return roomObj;
  }

  /**
   * Get room details by ID
   * @param roomId Room database ID
   */
  async getRoomById(roomId: number): Promise<Room> {
    // Try cache first
    const cached = await cache.get<Room>(CACHE_KEYS.ROOM_ID(roomId));
    if (cached) {
      return cached;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomCode: true,
        createdById: true,
        title: true,
        createdAt: true,
        endTime: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    const roomObj = {
      id: room.id,
      room_id: room.roomCode,
      created_by: room.createdById,
      title: room.title,
      created_at: room.createdAt,
      ended_at: room.endTime,
    } as Room;

    // Cache the room
    await cache.set(CACHE_KEYS.ROOM_ID(roomId), roomObj, CACHE_TTL.ROOM);

    return roomObj;
  }

  /**
   * Get room details by room code
   * @param roomCode Room code (xxx-xxx-xxx)
   */
  async getRoomByCode(roomCode: string): Promise<Room> {
    // Try cache first
    const cached = await cache.get<Room>(CACHE_KEYS.ROOM_CODE(roomCode));
    if (cached) {
      return cached;
    }

    const room = await prisma.room.findUnique({
      where: { roomCode },
      select: {
        id: true,
        roomCode: true,
        createdById: true,
        title: true,
        createdAt: true,
        endTime: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    const roomObj = {
      id: room.id,
      room_id: room.roomCode,
      created_by: room.createdById,
      title: room.title,
      created_at: room.createdAt,
      ended_at: room.endTime,
    } as Room;

    // Cache the room
    await cache.set(CACHE_KEYS.ROOM_CODE(roomCode), roomObj, CACHE_TTL.ROOM);

    return roomObj;
  }

  /**
   * Get all rooms created by a user
   * @param userId User ID
   */
  async getUserRooms(userId: number): Promise<Room[]> {
    // Note: skip cache so participant counts are always fresh
    const rooms = await prisma.room.findMany({
      where: { createdById: userId },
      select: {
        id: true,
        roomCode: true,
        createdById: true,
        title: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r.id);

    // Count distinct registered users per room (deduplicated by userId)
    const registeredGroups = await prisma.participant.groupBy({
      by: ['roomId', 'userId'],
      where: { roomId: { in: roomIds }, userId: { not: null } },
    });
    // registeredGroups has one entry per unique (roomId, userId) pair
    const registeredCountMap: Record<number, number> = {};
    for (const row of registeredGroups) {
      registeredCountMap[row.roomId] = (registeredCountMap[row.roomId] || 0) + 1;
    }

    // Count guest rows per room (each session is a unique attendee)
    const guestGroups = await prisma.participant.groupBy({
      by: ['roomId'],
      where: { roomId: { in: roomIds }, isGuest: true },
      _count: { id: true },
    });
    const guestCountMap: Record<number, number> = {};
    for (const row of guestGroups) {
      guestCountMap[row.roomId] = row._count.id;
    }

    const roomList = rooms.map((room) => ({
      id: room.id,
      room_id: room.roomCode,
      created_by: room.createdById,
      title: room.title,
      created_at: room.createdAt,
      ended_at: room.updatedAt,
      participant_count: (registeredCountMap[room.id] || 0) + (guestCountMap[room.id] || 0),
    })) as Room[];

    return roomList;
  }

  /**
   * Get active participants in a room
   * @param roomId Room database ID
   */
  async getRoomParticipants(roomId: number): Promise<number> {
    // Try cache first
    const cached = await cache.get<number>(CACHE_KEYS.ROOM_PARTICIPANTS(roomId));
    if (cached !== null) {
      return cached;
    }

    const count = await prisma.participant.count({
      where: {
        roomId,
        leftAt: null,
      },
    });

    // Cache the count
    await cache.set(CACHE_KEYS.ROOM_PARTICIPANTS(roomId), count, CACHE_TTL.PARTICIPANTS);

    return count;
  }

  /**
   * Add participant to room
   * @param userId User ID
   * @param roomId Room database ID
   */
  async addParticipant(userId: number, roomId: number): Promise<void> {
    await prisma.participant.create({
      data: {
        userId,
        roomId,
      },
    });

    // Invalidate participant count cache
    await cache.delete(CACHE_KEYS.ROOM_PARTICIPANTS(roomId));
  }

  /**
   * Remove participant from room
   * @param userId User ID
   * @param roomId Room database ID
   */
  async removeParticipant(userId: number, roomId: number): Promise<void> {
    await prisma.participant.updateMany({
      where: {
        userId,
        roomId,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // Invalidate participant count cache
    await cache.delete(CACHE_KEYS.ROOM_PARTICIPANTS(roomId));
  }

  /**
   * Add guest participant to room
   * @param guestName Guest display name
   * @param roomId Room database ID
   */
  async addGuestParticipant(guestName: string, roomId: number): Promise<void> {
    await prisma.participant.create({
      data: {
        roomId,
        guestName,
        isGuest: true,
        // userId is optional and will default to null in DB
      },
    });

    // Invalidate participant count cache
    await cache.delete(CACHE_KEYS.ROOM_PARTICIPANTS(roomId));
  }

  /**
   * End a meeting room
   * @param roomId Room database ID
   */
  async endRoom(roomId: number): Promise<void> {
    // Get room first to get code and creator
    const room = await this.getRoomById(roomId);

    await prisma.room.update({
      where: { id: roomId },
      data: {
        isActive: false,
        endTime: new Date(),
      },
    });

    // Invalidate all room caches
    await cache.deleteMany([
      CACHE_KEYS.ROOM_ID(roomId),
      CACHE_KEYS.ROOM_CODE(room.room_id),
      CACHE_KEYS.ROOM_PARTICIPANTS(roomId),
      CACHE_KEYS.USER_ROOMS(room.created_by),
    ]);
  }
  /**
   * Get room summary (for cleanup/analytics)
   * @param roomId Room database ID
   */
  async getRoomSummary(roomId: number) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomCode: true,
        title: true,
        createdAt: true,
        endTime: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    // Get participant and message counts separately
    const participantCount = await prisma.participant.count({
      where: { roomId },
    });

    const messageCount = await prisma.message.count({
      where: { roomId },
    });

    return {
      id: room.id,
      roomCode: room.roomCode,
      title: room.title,
      duration: room.endTime
        ? Math.round((room.endTime.getTime() - room.createdAt.getTime()) / 1000)
        : null,
      participantCount,
      messageCount,
    };
  }

  /**
   * Clean up and end a room (called when last participant leaves or host leaves)
   * @param roomId Room database ID
   */
  async cleanupRoom(roomId: number | string): Promise<void> {
    // Resolve numeric ID if it's a string code
    let numericId: number;
    if (typeof roomId === 'string' && isNaN(Number(roomId))) {
      const room = await this.getRoomByCode(roomId);
      numericId = room.id;
    } else {
      numericId = Number(roomId);
    }

    // Mark all participants as left if not already
    await prisma.participant.updateMany({
      where: {
        roomId: numericId,
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    // End the room
    await this.endRoom(numericId);
  }

  /**
   * Delete a room (only by creator)
   * @param roomId Room database ID
   * @param userId User ID (must be creator)
   */
  async deleteRoom(roomId: number, userId: number): Promise<void> {
    const room = await this.getRoomById(roomId);

    if (room.created_by !== userId) {
      throw new Error('Only room creator can delete the room');
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    // Invalidate all room caches
    await cache.deleteMany([
      CACHE_KEYS.ROOM_ID(roomId),
      CACHE_KEYS.ROOM_CODE(room.room_id),
      CACHE_KEYS.ROOM_PARTICIPANTS(roomId),
      CACHE_KEYS.USER_ROOMS(room.created_by),
    ]);
  }

  /**
   * Get chat messages for a room with pagination
   * Supports both registered users and guests
   * @param roomId Room database ID
   * @param limit Maximum number of messages to return
   * @param offset Number of messages to skip
   * @param order Sort order ('asc' or 'desc')
   */
  async getRoomMessages(
    roomId: number,
    limit: number = 50,
    offset: number = 0,
    order: 'asc' | 'desc' = 'asc'
  ) {
    const messages = await prisma.message.findMany({
      where: { roomId },
      select: {
        id: true,
        content: true,
        userId: true,
        guestName: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: order,
      },
      take: limit,
      skip: offset,
    });

    // Map to response format - support both authenticated users and guests
    return messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      userId: msg.userId,
      guestName: msg.guestName,
      userName: msg.guestName || msg.user?.name || 'Unknown',
      userEmail: msg.user?.email || null,
      isGuest: !!msg.guestName,
      timestamp: msg.createdAt,
    }));
  }

  /**
   * Get total message count for a room
   * @param roomId Room database ID
   */
  async getRoomMessageCount(roomId: number): Promise<number> {
    return prisma.message.count({
      where: { roomId },
    });
  }

  /**
   * Get last N messages for a room (for history on join)
   * Supports both registered users and guests
   * @param roomId Room database ID
   * @param limit Number of messages to return (default: 20)
   */
  async getRecentRoomMessages(roomId: number, limit: number = 20) {
    const messages = await prisma.message.findMany({
      where: { roomId },
      select: {
        id: true,
        content: true,
        userId: true,
        guestName: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    // Reverse to get chronological order
    return messages.reverse().map((msg) => ({
      id: msg.id,
      content: msg.content,
      userId: msg.userId,
      guestName: msg.guestName,
      userName: msg.guestName || msg.user?.name || 'Unknown',
      isGuest: !!msg.guestName,
      timestamp: msg.createdAt,
    }));
  }

  /**
   * Search messages in a room
   * Supports both registered users and guests
   * @param roomId Room database ID
   * @param searchQuery Text to search for
   */
  async searchRoomMessages(roomId: number, searchQuery: string) {
    const messages = await prisma.message.findMany({
      where: {
        roomId,
        content: {
          contains: searchQuery,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        content: true,
        userId: true,
        guestName: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      userId: msg.userId,
      guestName: msg.guestName,
      userName: msg.guestName || msg.user?.name || 'Unknown',
      isGuest: !!msg.guestName,
      timestamp: msg.createdAt,
    }));
  }
}
