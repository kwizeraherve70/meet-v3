/**
 * API Contract Definitions
 * Defines request/response types for REST API endpoints
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// POST /auth/register
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

// POST /auth/login
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

// POST /auth/refresh
export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// GET /auth/me
export interface GetMeResponse {
  user: UserDto;
}

// ============================================================================
// USER DTO
// ============================================================================

export interface UserDto {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

// ============================================================================
// ROOM ENDPOINTS
// ============================================================================

// POST /api/rooms
export interface CreateRoomRequest {
  title?: string;
}

export interface CreateRoomResponse {
  room: RoomDto;
}

// GET /api/rooms/:code
export interface GetRoomResponse {
  room: RoomDto;
  participant_count: number;
}

// POST /api/rooms/:code/join
export interface JoinRoomRequest {
  username?: string;
}

export interface JoinRoomResponse {
  room: RoomDto;
  token?: string; // Optional WebSocket auth token
}

// GET /api/rooms
export interface GetUserRoomsResponse {
  rooms: RoomDto[];
}

// DELETE /api/rooms/:id
export interface DeleteRoomResponse {
  success: boolean;
}

// ============================================================================
// ROOM DTO
// ============================================================================

export interface RoomDto {
  id: number;
  room_code: string;
  title: string;
  created_by: number;
  created_at: string;
  ended_at: string | null;
}

// ============================================================================
// PARTICIPANT ENDPOINTS
// ============================================================================

// GET /api/rooms/:code/participants
export interface GetParticipantsResponse {
  participants: ParticipantDto[];
}

export interface ParticipantDto {
  id: number;
  user_id: number;
  username: string;
  joined_at: string;
  is_host: boolean;
  media_state: {
    audio: boolean;
    video: boolean;
  };
}

// ============================================================================
// HEALTH ENDPOINTS
// ============================================================================

// GET /health
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  environment: string;
}

// GET /api/health/db
export interface DbHealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  message?: string;
  timestamp: string;
}

// ============================================================================
// ICE CONFIGURATION ENDPOINT
// ============================================================================

// GET /api/webrtc/ice-servers
export interface IceServersResponse {
  iceServers: IceServerDto[];
}

export interface IceServerDto {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export default {
  // Type-only module
};
