import { Server as SocketIOServer, Socket } from 'socket.io';
import { roomConfig } from '../config/socket.config.js';
import roomState from '../state/room.state.js';
import participantState from '../state/participant.state.js';

/**
 * Room Lifecycle Management
 * Handles room creation, participant management, and cleanup
 */

/**
 * Initialize a room when first participant joins
 */
export function initializeRoom(
  roomId: string,
  title: string,
  createdBy: string
): void {
  if (!roomState.roomExists(roomId)) {
    roomState.createRoom(roomId, title, createdBy);
    console.log(`🏠 Room lifecycle: Initialized room ${roomId}`);
  }
}

/**
 * Handle participant joining a room
 * Returns false if room is full or doesn't exist
 */
export function handleParticipantJoin(
  roomId: string,
  username: string,
  socketId: string,
  isHost: boolean = false,
  userId: number | null = null
): boolean {
  // Check if room exists, create if needed
  if (!roomState.roomExists(roomId)) {
    roomState.createRoom(roomId, 'Meeting', username);
  }

  // Check room capacity
  if (roomState.getRoomParticipantCount(roomId) >= roomConfig.maxParticipants) {
    console.warn(`⚠️ Room ${roomId} is at capacity`);
    return false;
  }

  // Add to room state
  roomState.addParticipantToRoom(roomId, username);

  // Add participant state
  participantState.addParticipant(roomId, username, socketId, isHost, userId);

  console.log(`👤 Room lifecycle: ${username} joined room ${roomId}`);
  return true;
}

/**
 * Handle participant leaving a room
 */
export function handleParticipantLeave(
  roomId: string,
  username: string,
  io: SocketIOServer
): void {
  // Remove from participant state
  participantState.removeParticipant(roomId, username);

  // Remove from room state
  roomState.removeParticipantFromRoom(roomId, username);

  // Notify others
  io.to(`room-${roomId}`).emit('user-left', { username });

  console.log(`👤 Room lifecycle: ${username} left room ${roomId}`);

  // Check if room should be cleaned up
  checkAndCleanupRoom(roomId, io);
}

/**
 * Handle participant disconnect (implicit leave)
 */
export function handleParticipantDisconnect(
  socketId: string,
  io: SocketIOServer
): void {
  const participant = participantState.getParticipantBySocketId(socketId);
  
  if (participant) {
    handleParticipantLeave(participant.roomId, participant.username, io);
  }
}

/**
 * Check if room should be cleaned up and do so
 */
export function checkAndCleanupRoom(roomId: string, io: SocketIOServer): void {
  const room = roomState.getRoom(roomId);
  
  if (!room) return;

  if (room.participants.size === 0) {
    // Schedule cleanup after delay
    setTimeout(() => {
      const currentRoom = roomState.getRoom(roomId);
      if (currentRoom && currentRoom.participants.size === 0) {
        endRoom(roomId, io);
      }
    }, roomConfig.cleanupDelay);
  }
}

/**
 * End a room and notify all participants
 */
export function endRoom(roomId: string, io: SocketIOServer): void {
  const room = roomState.getRoom(roomId);
  
  if (!room) return;

  // Notify all participants
  io.to(`room-${roomId}`).emit('room-ended', { roomId });

  // Close room
  roomState.closeRoom(roomId);
  roomState.deleteRoom(roomId);

  console.log(`🏠 Room lifecycle: Room ${roomId} ended`);
}

/**
 * Get room summary for API responses
 */
export function getRoomSummary(roomId: string): {
  id: string;
  participantCount: number;
  isActive: boolean;
} | null {
  const room = roomState.getRoom(roomId);
  
  if (!room) return null;

  return {
    id: room.id,
    participantCount: room.participants.size,
    isActive: room.isActive,
  };
}

export default {
  initializeRoom,
  handleParticipantJoin,
  handleParticipantLeave,
  handleParticipantDisconnect,
  checkAndCleanupRoom,
  endRoom,
  getRoomSummary,
};
