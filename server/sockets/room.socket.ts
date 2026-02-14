import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../lib/logger.js';
import {
  registerSocket,
  authenticateSocket,
  addSocketToRoom,
  removeSocketFromRoom,
  getSocketsInRoom,
  removeSocket,
  updateLastActivity,
} from '../state/socket.state.js';
import { validateRoomAccess, isRoomHost, getRoomInfo } from '../middleware/room.access.js';
import { RoomService } from '../services/room.service.js';
import {
  markForReconnect,
  attemptReconnect,
  hasPendingReconnection,
} from '../lifecycle/soft.reconnect.js';
import { ajChat } from '../config/arcjet.config.js';
import prisma from '../database/prisma.js';

const roomService = new RoomService();

/**
 * Room-related Socket.IO event handlers
 * Handles: join-room, leave-room, disconnect, send-message, update-media-state
 */

/**
 * Register all room-related socket event handlers
 */
export function registerRoomHandlers(socket: Socket, io: SocketIOServer): void {
  const user = socket.data.user;

  if (!user) {
    logger.warn('RoomHandler', 'Socket missing user data', { socketId: socket.id });
    socket.disconnect(true);
    return;
  }

  // Register socket in state
  registerSocket(socket.id);
  authenticateSocket(socket.id, user.id, user.name, user.email);

  logger.info('RoomHandler', 'User socket ready for room operations', {
    socketId: socket.id,
    userId: user.id,
    userName: user.name,
  });

  /**
   * EVENT: User joins a room
   * Sent by: Client on enter (useWebRTC hook)
   * Broadcasts: Current room participants, new user announcement
   * Supports: Soft reconnection within grace period
   */
  socket.on('join-room', async (data: any) => {
    try {
      // ✅ Convert roomId to number
      const roomId = typeof data.roomId === 'string'
        ? parseInt(data.roomId, 10)
        : data.roomId;

      if (!roomId || isNaN(roomId)) {
        socket.emit('error', { type: 'INVALID_ROOM_ID' });
        return;
      }

      updateLastActivity(socket.id);

      // Validate room access
      const validation = await validateRoomAccess(socket, roomId);
      if (!validation.valid) {
        socket.emit('error', {
          type: 'ROOM_ACCESS_DENIED',
          message: validation.error || 'Access denied',
        });
        return;
      }

      // Try soft reconnect first (if user was just disconnected)
      const isReconnect = hasPendingReconnection(user.id, roomId);
      if (isReconnect) {
        const reconnected = attemptReconnect(socket, user.id, roomId, user.name);
        if (reconnected) {
          logger.info('RoomHandler', 'User soft-reconnected to room', {
            userId: user.id,
            userName: user.name,
            roomId,
          });
          return;
        }
      }

      // Check if user is room host

      const isHost = await isRoomHost(roomId, user.id);

      // Add socket to room state
      addSocketToRoom(socket.id, roomId, isHost);

      // Join socket to room namespace
      socket.join(`room-${roomId}`);

      // Get current room participants
      const roomSockets = getSocketsInRoom(roomId);
      const participants = roomSockets.map((s) => ({
        userId: s.userId,
        userName: s.userName,
        isHost: s.isHost,
      }));

      logger.info('RoomHandler', 'User joined room', {
        userId: user.id,
        userName: user.name,
        roomId,
        isHost,
        totalParticipants: participants.length,
      });

      // Send current participants to joining user
      socket.emit('room-joined', {
        roomId,
        participants,
        isHost,
      });

      // Announce new user to others in room IMMEDIATELY (before sync-peers)
      // This ensures existing users know about the new participant right away
      socket.broadcast.to(`room-${roomId}`).emit('user-joined', {
        userId: user.id,
        userName: user.name,
        isHost,
      });

      // If there are existing participants, request peer setup for mid-call join
      // New user will initiate offers to existing participants
      if (participants.length > 1) {
        // Send list of peers to establish connections with
        const existingPeers = participants.filter((p) => p.userId !== user.id);
        socket.emit('sync-peers', {
          peers: existingPeers,
          message: 'Initiate peer connections with these users',
        });

        logger.debug('RoomHandler', 'Mid-call join sync', {
          userId: user.id,
          roomId,
          existingPeersCount: existingPeers.length,
        });
      }
    } catch (error) {
      logger.error('RoomHandler', 'Error joining room', {
        socketId: socket.id,
        userId: user.id,
        error: (error as Error).message,
      });
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  /**
   * EVENT: Request chat history
   * Sent by: Client when joining room or scrolling up
   * Returns: Last N messages from room
   */
  socket.on('request-message-history', async (data: any) => {
    try {
      const { roomId, limit = 20 } = data;
      updateLastActivity(socket.id);

      // Validate room access
      if (!getSocketsInRoom(roomId).some((s) => s.socketId === socket.id)) {
        socket.emit('error', { message: 'Not in room' });
        return;
      }

      const messages = await roomService.getRecentRoomMessages(roomId, limit);

      socket.emit('message-history', {
        roomId,
        messages,
        count: messages.length,
      });

      logger.debug('RoomHandler', 'Message history retrieved', {
        userId: user.id,
        roomId,
        messageCount: messages.length,
      });
    } catch (error) {
      logger.error('RoomHandler', 'Error retrieving message history', {
        socketId: socket.id,
        userId: user.id,
        error: (error as Error).message,
      });
      socket.emit('error', { message: 'Failed to load message history' });
    }
  });

  /**
   * EVENT: Chat message in room
   * Sent by: Client's ChatSidebar component
   * Persists to: Database
   * Broadcasts to: All users in room (including sender)
   * Rate Limited: 50 messages per minute via Arcjet
   */
  socket.on('send-message', async (data: any) => {
    try {
      const { roomId, content } = data;
      updateLastActivity(socket.id);

      // Create a mock request object for Arcjet compatibility
      // Arcjet needs an http.IncomingMessage-like object
      const mockReq = {
        method: 'POST',
        url: `/socket/send-message`,
        headers: {
          'x-user-id': user.id ? user.id.toString() : 'guest',
          'x-socket-id': socket.id,
        },
        socket: {
          remoteAddress: socket.handshake.address,
        },
      } as any;

      // Apply Arcjet rate limiting for chat messages
      const decision = await ajChat.protect(mockReq, { requested: 1 });

      if (decision.isDenied()) {
        logger.warn('RoomHandler', 'Message rate limit exceeded', {
          socketId: socket.id,
          userId: user.id,
          roomId,
          reason: decision.reason,
        });
        socket.emit('error', {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many messages. Please wait before sending again.',
        });
        return;
      }

      // Validate room access
      if (!getSocketsInRoom(roomId).some((s) => s.socketId === socket.id)) {
        socket.emit('error', { message: 'Not in room' });
        return;
      }

      // Validate message content
      if (!content || content.trim().length === 0) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (content.length > 5000) {
        socket.emit('error', { message: 'Message too long (max 5000 characters)' });
        return;
      }

      // Prepare message data - support both authenticated users and guests
      const messageData: any = {
        roomId,
        content: content.trim(),
      };

      if (user.isGuest) {
        // Guest message
        messageData.guestName = user.name;
        // userId is null for guests
      } else {
        // Authenticated user message
        messageData.userId = user.id;
      }

      // Save message to database
      const message = await prisma.message.create({
        data: messageData,
        select: {
          id: true,
          roomId: true,
          content: true,
          userId: true,
          guestName: true,
          createdAt: true,
          user: {
            select: { id: true, name: true },
          },
        },
      });

      const displayName = user.isGuest ? user.name : message.user?.name || 'Unknown';

      logger.info('RoomHandler', 'Message created and broadcast', {
        messageId: message.id,
        userId: user.id,
        userName: displayName,
        isGuest: user.isGuest,
        roomId,
        contentLength: message.content.length,
      });

      // Broadcast to all in room
      io.to(`room-${roomId}`).emit('message-received', {
        id: message.id,
        userId: message.userId,
        guestName: message.guestName,
        userName: displayName,
        content: message.content,
        timestamp: message.createdAt,
        isGuest: user.isGuest,
      });
    } catch (error) {
      logger.error('RoomHandler', 'Error sending message', {
        socketId: socket.id,
        userId: user.id,
        error: (error as Error).message,
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  /**
   * EVENT: Media state update (mute/unmute audio/video)
   * Sent by: Client's ControlBar component
   * Broadcasts to: All users in room
   */
  socket.on('update-media-state', (data: any) => {
    try {
      const { roomId, mediaState } = data;
      updateLastActivity(socket.id);

      logger.debug('RoomHandler', 'Media state updated', {
        userId: user.id,
        roomId,
        mediaState,
      });

      io.to(`room-${roomId}`).emit('user-media-state', {
        userId: user.id,
        mediaState,
      });
    } catch (error) {
      logger.error('RoomHandler', 'Error updating media state', {
        socketId: socket.id,
        error: (error as Error).message,
      });
    }
  });

  /**
   * EVENT: Explicit room leave (before disconnect)
   * Sent by: Client's MeetingPage component (beforeunload)
   * Broadcasts to: All users in room
   */
  socket.on('leave-room', async (data: any) => {
    try {
      const { roomId } = data;
      const socketState = getSocketsInRoom(roomId).find((s) => s.socketId === socket.id);

      if (!socketState) return;

      const wasHost = socketState.isHost;
      removeSocketFromRoom(socket.id);

      // If host left, handle room closure or host promotion
      if (wasHost) {
        const remainingParticipants = getSocketsInRoom(roomId);

        if (remainingParticipants.length === 0) {
          // Room is now empty, clean up and end the room
          await roomService.cleanupRoom(roomId);

          logger.info('RoomHandler', 'Room ended (host left, no participants)', {
            roomId,
            hostUserId: user.id,
          });

          io.to(`room-${roomId}`).emit('room-ended', {
            reason: 'Host left the room',
          });
        } else {
          // Promote first remaining participant as host
          const newHost = remainingParticipants[0];
          const updatedHost = { ...newHost, isHost: true };

          // Update Prisma to reflect new host if it's the room creator
          // For now, just notify participants
          io.to(`room-${roomId}`).emit('host-promoted', {
            newHostUserId: newHost.userId,
            newHostName: newHost.userName,
          });

          logger.info('RoomHandler', 'Host promoted', {
            oldHostUserId: user.id,
            newHostUserId: newHost.userId,
            roomId,
          });
        }
      } else {
        // Non-host user left
        io.to(`room-${roomId}`).emit('user-left', {
          userId: user.id,
          userName: user.name,
        });
      }

      socket.leave(`room-${roomId}`);

      logger.info('RoomHandler', 'User left room', {
        userId: user.id,
        userName: user.name,
        roomId,
        wasHost,
      });
    } catch (error) {
      logger.error('RoomHandler', 'Error leaving room', {
        socketId: socket.id,
        userId: user.id,
        error: (error as Error).message,
      });
    }
  });

  /**
   * EVENT: Socket disconnect (implicit)
   * Triggered: When user closes browser, loses connection, etc.
   * Behavior: Mark for soft reconnect, not immediate removal
   */
  socket.on('disconnect', async () => {
    try {
      const removedState = removeSocket(socket.id);

      if (removedState && removedState.roomId) {
        const roomId = removedState.roomId;
        const wasHost = removedState.isHost;

        // Mark user for soft reconnection (30-second grace period)
        markForReconnect(
          removedState.userId!,
          removedState.userName!,
          removedState.email!,
          roomId,
          io
        );

        logger.info('RoomHandler', 'User disconnected (marked for soft reconnect)', {
          userId: removedState.userId,
          userName: removedState.userName,
          roomId,
          wasHost,
        });

        // If host disconnected AND there are no other participants, end room immediately
        // Otherwise, wait for soft reconnect grace period
        if (wasHost) {
          const remainingParticipants = getSocketsInRoom(roomId);
          if (remainingParticipants.length === 0) {
            // Room is now empty, clean up and end the room
            await roomService.cleanupRoom(roomId);

            logger.info('RoomHandler', 'Room ended (host disconnected, no participants)', {
              roomId,
              hostUserId: removedState.userId,
            });

            io.to(`room-${roomId}`).emit('room-ended', {
              reason: 'Host left the room',
            });
          }
          // If there are other participants, host can still reconnect
        }
      }
    } catch (error) {
      logger.error('RoomHandler', 'Error handling disconnect', {
        socketId: socket.id,
        error: (error as Error).message,
      });
    }
  });

  /**
   * EVENT: Socket error
   * Triggered: When socket encounters an error
   */
  socket.on('error', (error) => {
    logger.error('RoomHandler', 'Socket error', {
      socketId: socket.id,
      userId: user.id,
      error: (error as Error).message,
    });
  });
}
