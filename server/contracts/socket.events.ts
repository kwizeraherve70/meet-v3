/**
 * Socket Event Type Definitions
 * Defines all socket event names as constants for type safety
 */

// ============================================================================
// CLIENT -> SERVER EVENTS (events the server listens for)
// ============================================================================

export const ClientEvents = {
  // Room events
  JOIN_USER: 'join-user',
  LEAVE_ROOM: 'leave-room',
  
  // Chat events
  SEND_MESSAGE: 'send-message',
  
  // Media events
  UPDATE_MEDIA_STATE: 'update-media-state',
  
  // WebRTC signaling events
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'icecandidate',
  
  // Participant events
  RAISE_HAND: 'raise-hand',
  LOWER_HAND: 'lower-hand',
  
  // Emoji reactions
  SEND_EMOJI_REACTION: 'send-emoji-reaction',
  
  // Connection events
  PING: 'ping',
  RECONNECT: 'reconnect',
} as const;

// ============================================================================
// SERVER -> CLIENT EVENTS (events the server emits)
// ============================================================================

export const ServerEvents = {
  // Room events
  JOINED: 'joined',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  USER_RECONNECTED: 'user-reconnected',
  ROOM_ENDED: 'room-ended',
  
  // Chat events
  RECEIVE_MESSAGE: 'receive-message',
  
  // Media events
  USER_MEDIA_STATE: 'user-media-state',
  
  // WebRTC signaling events
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'icecandidate',
  
  // Participant events
  HAND_RAISED: 'hand-raised',
  HAND_LOWERED: 'hand-lowered',
  
  // Emoji reactions
  EMOJI_REACTION_RECEIVED: 'emoji-reaction-received',
  
  // Connection events
  PONG: 'pong',
  
  // Error events
  ERROR: 'error',
  ROOM_FULL: 'room-full',
  ROOM_NOT_FOUND: 'room-not-found',
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ClientEventName = typeof ClientEvents[keyof typeof ClientEvents];
export type ServerEventName = typeof ServerEvents[keyof typeof ServerEvents];

export default {
  Client: ClientEvents,
  Server: ServerEvents,
};
