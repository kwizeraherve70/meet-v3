/**
 * Participant State Management
 * Tracks participant state within rooms including media state and presence
 */

export interface MediaState {
  audio: boolean;
  video: boolean;
  screenShare: boolean;
}

export interface ParticipantState {
  username: string;
  socketId: string;
  roomId: string;
  userId: number | null;
  joinedAt: Date;
  mediaState: MediaState;
  isHost: boolean;
  isHandRaised: boolean;
  lastSeen: Date;
}

/**
 * In-memory participant state store
 * Structure: { roomId: { username: ParticipantState } }
 */
const participants: Map<string, Map<string, ParticipantState>> = new Map();

/**
 * Get or create room participant map
 */
function getOrCreateRoomParticipants(roomId: string): Map<string, ParticipantState> {
  if (!participants.has(roomId)) {
    participants.set(roomId, new Map());
  }
  return participants.get(roomId)!;
}

/**
 * Add participant to room
 */
export function addParticipant(
  roomId: string,
  username: string,
  socketId: string,
  isHost: boolean = false,
  userId: number | null = null
): ParticipantState {
  const roomParticipants = getOrCreateRoomParticipants(roomId);

  const participant: ParticipantState = {
    username,
    socketId,
    roomId,
    userId,
    joinedAt: new Date(),
    mediaState: {
      audio: true,
      video: true,
      screenShare: false,
    },
    isHost,
    isHandRaised: false,
    lastSeen: new Date(),
  };

  roomParticipants.set(username, participant);
  console.log(`👤 Participant added: ${username} to room ${roomId}`);
  return participant;
}

/**
 * Get participant by username in room
 */
export function getParticipant(roomId: string, username: string): ParticipantState | undefined {
  return participants.get(roomId)?.get(username);
}

/**
 * Get all participants in room
 */
export function getRoomParticipants(roomId: string): ParticipantState[] {
  const roomParticipants = participants.get(roomId);
  return roomParticipants ? Array.from(roomParticipants.values()) : [];
}

/**
 * Get participant by socket ID
 */
export function getParticipantBySocketId(socketId: string): ParticipantState | undefined {
  for (const roomParticipants of participants.values()) {
    for (const participant of roomParticipants.values()) {
      if (participant.socketId === socketId) {
        return participant;
      }
    }
  }
  return undefined;
}

/**
 * Update participant media state
 */
export function updateMediaState(
  roomId: string,
  username: string,
  mediaState: Partial<MediaState>
): void {
  const participant = getParticipant(roomId, username);
  if (participant) {
    participant.mediaState = { ...participant.mediaState, ...mediaState };
    participant.lastSeen = new Date();
  }
}

/**
 * Toggle hand raise
 */
export function toggleHandRaise(roomId: string, username: string): boolean {
  const participant = getParticipant(roomId, username);
  if (participant) {
    participant.isHandRaised = !participant.isHandRaised;
    participant.lastSeen = new Date();
    return participant.isHandRaised;
  }
  return false;
}

/**
 * Update participant socket ID (for reconnection)
 */
export function updateParticipantSocketId(
  roomId: string,
  username: string,
  newSocketId: string
): void {
  const participant = getParticipant(roomId, username);
  if (participant) {
    participant.socketId = newSocketId;
    participant.lastSeen = new Date();
  }
}

/**
 * Remove participant from room
 */
export function removeParticipant(roomId: string, username: string): ParticipantState | undefined {
  const roomParticipants = participants.get(roomId);
  if (roomParticipants) {
    const participant = roomParticipants.get(username);
    roomParticipants.delete(username);
    
    // Cleanup empty rooms
    if (roomParticipants.size === 0) {
      participants.delete(roomId);
    }
    
    console.log(`👤 Participant removed: ${username} from room ${roomId}`);
    return participant;
  }
  return undefined;
}

/**
 * Remove participant by socket ID
 */
export function removeParticipantBySocketId(socketId: string): ParticipantState | undefined {
  const participant = getParticipantBySocketId(socketId);
  if (participant) {
    return removeParticipant(participant.roomId, participant.username);
  }
  return undefined;
}

/**
 * Get participant count in room
 */
export function getParticipantCount(roomId: string): number {
  return participants.get(roomId)?.size || 0;
}

/**
 * Check if user is host
 */
export function isHost(roomId: string, username: string): boolean {
  const participant = getParticipant(roomId, username);
  return participant?.isHost ?? false;
}

export default {
  addParticipant,
  getParticipant,
  getRoomParticipants,
  getParticipantBySocketId,
  updateMediaState,
  toggleHandRaise,
  updateParticipantSocketId,
  removeParticipant,
  removeParticipantBySocketId,
  getParticipantCount,
  isHost,
};
