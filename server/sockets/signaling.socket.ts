import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../lib/logger.js';
import { getSocketsInRoom, updateLastActivity, getSocket } from '../state/socket.state.js';

/**
 * WebRTC Signaling Socket.IO event handlers
 * Handles: offer, answer, icecandidate
 * Forwards SDP and ICE candidates between peers within same room
 */

/**
 * Handle WebRTC signaling events (offer, answer, ICE candidates)
 * These events are peer-to-peer forwarding through the server
 */
export function registerSignalingHandlers(socket: Socket, io: SocketIOServer): void {
  const user = socket.data.user;

  if (!user) {
    logger.warn('SignalingHandler', 'Socket missing user data', { socketId: socket.id });
    return;
  }

  /**
   * EVENT: WebRTC offer (SDP)
   * Sent by: Browser's RTCPeerConnection
   * Forwarded to: Target peer (userId in data.to)
   * Purpose: Initiate peer connection with SDP offer
   */
  
  socket.on('offer', (data: any) => {
    try {
      const { to: targetUserId, roomId, offer } = data;
      updateLastActivity(socket.id);

      const fromSocketState = getSocket(socket.id);
      if (!fromSocketState || !fromSocketState.roomId) {
        logger.warn('SignalingHandler', 'Offer sender not in room', { socketId: socket.id });
        return;
      }

      // Find target user's socket in same room
      // Support both userId and userName for robustness
      const roomSockets = getSocketsInRoom(fromSocketState.roomId);
      const targetSocket = roomSockets.find((s) => 
        s.userId === targetUserId || s.userName === targetUserId
      );

      if (!targetSocket) {
        logger.warn('SignalingHandler', 'Target user not in room', {
          fromUserId: user.id,
          toUserId: targetUserId,
          roomId: fromSocketState.roomId,
          availableSockets: roomSockets.map(s => ({ userId: s.userId, userName: s.userName })),
        });
        return;
      }

      logger.debug('SignalingHandler', 'Forwarding offer', {
        fromUserId: user.id,
        toUserId: targetUserId,
        roomId: fromSocketState.roomId,
      });

      // Forward offer to target
      io.to(targetSocket.socketId).emit('offer', {
        from: {
          userId: user.id,
          userName: user.name,
        },
        offer,
      });
    } catch (error) {
      logger.error('SignalingHandler', 'Error handling offer', {
        socketId: socket.id,
        error: (error as Error).message,
      });
    }
  });

  /**
   * EVENT: WebRTC answer (SDP)
   * Sent by: Browser's RTCPeerConnection
   * Forwarded to: Target peer (userId in data.to)
   * Purpose: Respond to offer with answer SDP
   */
  socket.on('answer', (data: any) => {
    try {
      const { to: targetUserId, roomId, answer } = data;
      updateLastActivity(socket.id);

      const fromSocketState = getSocket(socket.id);
      if (!fromSocketState || !fromSocketState.roomId) {
        logger.warn('SignalingHandler', 'Answer sender not in room', { socketId: socket.id });
        return;
      }

      // Find target user's socket in same room
      // Support both userId and userName for robustness
      const roomSockets = getSocketsInRoom(fromSocketState.roomId);
      const targetSocket = roomSockets.find((s) => 
        s.userId === targetUserId || s.userName === targetUserId
      );

      if (!targetSocket) {
        logger.warn('SignalingHandler', 'Target user not in room', {
          fromUserId: user.id,
          toUserId: targetUserId,
          roomId: fromSocketState.roomId,
          availableSockets: roomSockets.map(s => ({ userId: s.userId, userName: s.userName })),
        });
        return;
      }

      logger.debug('SignalingHandler', 'Forwarding answer', {
        fromUserId: user.id,
        toUserId: targetUserId,
        roomId: fromSocketState.roomId,
      });

      // Forward answer to target
      io.to(targetSocket.socketId).emit('answer', {
        from: {
          userId: user.id,
          userName: user.name,
        },
        answer,
      });
    } catch (error) {
      logger.error('SignalingHandler', 'Error handling answer', {
        socketId: socket.id,
        error: (error as Error).message,
      });
    }
  });

  /**
   * EVENT: ICE candidate
   * Sent by: Browser's RTCPeerConnection
   * Forwarded to: Target peer (userId in data.to)
   * Purpose: Share discovered network route (ICE candidate)
   * 
   * Note: Can be called multiple times per connection as candidates are discovered
   */
  socket.on('icecandidate', (data: any) => {
    try {
      const { to: targetUserId, candidate } = data;
      updateLastActivity(socket.id);

      const fromSocketState = getSocket(socket.id);
      if (!fromSocketState || !fromSocketState.roomId) {
        return; // Silent fail for ICE candidates (not critical)
      }

      // Find target user's socket in same room
      // Support both userId and userName for robustness
      const roomSockets = getSocketsInRoom(fromSocketState.roomId);
      const targetSocket = roomSockets.find((s) => 
        s.userId === targetUserId || s.userName === targetUserId
      );

      if (!targetSocket) {
        return; // Silent fail - target user may have left
      }

      // Forward ICE candidate to target
      io.to(targetSocket.socketId).emit('icecandidate', {
        from: {
          userId: user.id,
          userName: user.name,
        },
        candidate,
      });
    } catch (error) {
      logger.debug('SignalingHandler', 'Error handling ICE candidate', {
        error: (error as Error).message,
      });
    }
  });
}
