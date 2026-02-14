import { Server as SocketIOServer } from 'socket.io';
import { roomConfig } from '../config/socket.config.js';

/**
 * Room State Management
 * Handles in-memory room state for active meetings
 */

export interface RoomState {
  id: string;
  title: string;
  createdAt: Date;
  createdBy: string;
  participants: Set<string>;
  isActive: boolean;
  lastActivity: Date;
}

/**
 * In-memory room state store
 * Key: roomId (room code like "abc-def-ghi")
 */
const rooms: Map<string, RoomState> = new Map();

/**
 * Create or get a room
 */
export function createRoom(roomId: string, title: string, createdBy: string): RoomState {
  if (rooms.has(roomId)) {
    return rooms.get(roomId)!;
  }

  const room: RoomState = {
    id: roomId,
    title,
    createdAt: new Date(),
    createdBy,
    participants: new Set(),
    isActive: true,
    lastActivity: new Date(),
  };

  rooms.set(roomId, room);
  console.log(`🏠 Room created: ${roomId}`);
  return room;
}

/**
 * Get room by ID
 */
export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

/**
 * Check if room exists
 */
export function roomExists(roomId: string): boolean {
  return rooms.has(roomId);
}

/**
 * Get all active rooms
 */
export function getActiveRooms(): RoomState[] {
  return Array.from(rooms.values()).filter((room) => room.isActive);
}

/**
 * Update room activity timestamp
 */
export function touchRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.lastActivity = new Date();
  }
}

/**
 * Add participant to room
 */
export function addParticipantToRoom(roomId: string, username: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  if (room.participants.size >= roomConfig.maxParticipants) {
    console.warn(`⚠️ Room ${roomId} is full`);
    return false;
  }

  room.participants.add(username);
  room.lastActivity = new Date();
  return true;
}

/**
 * Remove participant from room
 */
export function removeParticipantFromRoom(roomId: string, username: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.participants.delete(username);
    room.lastActivity = new Date();
  }
}

/**
 * Get participant count in room
 */
export function getRoomParticipantCount(roomId: string): number {
  const room = rooms.get(roomId);
  return room ? room.participants.size : 0;
}

/**
 * Close a room
 */
export function closeRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.isActive = false;
    console.log(`🔒 Room closed: ${roomId}`);
  }
}

/**
 * Delete a room from memory
 */
export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  console.log(`🗑️ Room deleted: ${roomId}`);
}

/**
 * Cleanup empty rooms
 */
export function cleanupEmptyRooms(): void {
  for (const [roomId, room] of rooms) {
    if (room.participants.size === 0 && !room.isActive) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up empty room: ${roomId}`);
    }
  }
}

export default {
  createRoom,
  getRoom,
  roomExists,
  getActiveRooms,
  touchRoom,
  addParticipantToRoom,
  removeParticipantFromRoom,
  getRoomParticipantCount,
  closeRoom,
  deleteRoom,
  cleanupEmptyRooms,
};
