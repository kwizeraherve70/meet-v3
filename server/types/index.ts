// User types
export interface User {
  id: number;
  name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'password_hash'>;
}

// Room types
export interface Room {
  id: number;
  room_id: string;
  created_by: number;
  title: string;
  created_at: Date;
  ended_at: Date | null;
  participant_count?: number;
}

export interface CreateRoomRequest {
  title?: string;
}

export interface JoinRoomRequest {
  room_code: string;
}

// Participant types
export interface Participant {
  id: number;
  user_id: number;
  room_id: number;
  joined_at: Date;
  left_at: Date | null;
}

// Message types
export interface Message {
  id: number;
  room_id: number;
  user_id: number;
  content: string;
  created_at: Date;
}

// Error response
export interface ErrorResponse {
  message: string;
  status: number;
  code?: string;
}
