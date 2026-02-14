/**
 * Socket Payload Type Definitions
 * Defines the shape of data sent/received through socket events
 */

// ============================================================================
// ROOM PAYLOADS
// ============================================================================

export interface JoinUserPayload {
  username: string;
  roomId: string;
  userId?: number;
}

export interface LeaveRoomPayload {
  username: string;
  roomId: string;
}

export interface JoinedPayload {
  [username: string]: {
    username: string;
    id: string;
    socketId: string;
    roomId: string;
  };
}

export interface UserJoinedPayload {
  username: string;
  id: string;
  socketId: string;
  roomId: string;
}

export interface UserLeftPayload {
  username: string;
  reason?: 'explicit' | 'disconnect' | 'reconnect_timeout';
}

export interface RoomEndedPayload {
  roomId: string;
}

// ============================================================================
// CHAT PAYLOADS
// ============================================================================

export interface SendMessagePayload {
  roomId: string;
  username: string;
  message: string;
}

export interface ReceiveMessagePayload {
  username: string;
  message: string;
  timestamp: string;
}

// ============================================================================
// MEDIA PAYLOADS
// ============================================================================

export interface MediaState {
  audio: boolean;
  video: boolean;
  screenShare?: boolean;
}

export interface UpdateMediaStatePayload {
  roomId: string;
  username: string;
  mediaState: MediaState;
}

export interface UserMediaStatePayload {
  username: string;
  mediaState: MediaState;
}

// ============================================================================
// WEBRTC SIGNALING PAYLOADS
// ============================================================================

export interface OfferPayload {
  from: string;
  to: string;
  offer: any; // RTCSessionDescriptionInit
}

export interface AnswerPayload {
  from: string;
  to: string;
  answer: any; // RTCSessionDescriptionInit
}

export interface IceCandidatePayload {
  from: string;
  to: string;
  candidate: any; // RTCIceCandidateInit
}

// ============================================================================
// PARTICIPANT PAYLOADS
// ============================================================================

export interface HandRaisePayload {
  roomId: string;
  username: string;
}

export interface HandRaisedPayload {
  username: string;
  isRaised: boolean;
}

// ============================================================================
// ERROR PAYLOADS
// ============================================================================

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface RoomFullPayload {
  roomId: string;
  maxParticipants: number;
}

export interface RoomNotFoundPayload {
  roomId: string;
}

// ============================================================================
// RECONNECTION PAYLOADS
// ============================================================================

export interface ReconnectPayload {
  roomId: string;
  username: string;
  previousSocketId?: string;
}

export interface UserReconnectedPayload {
  username: string;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  // Re-export for convenience
};
