/**
 * API Client for WebRTC Meeting Backend
 * Handles authentication, guest sessions, room management and API calls
 */

const API_BASE_URL = 'http://localhost:3001';

export interface ApiError {
  message: string;
  status: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface RegisterResponse extends LoginResponse {}

export interface RoomResponse {
  id: number;
  roomCode: string;
  title: string;
  description?: string;
  createdById: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  participants?: Array<{
    id: number;
    userId: number;
    userName: string;
    isHost: boolean;
    joinedAt: string;
    leftAt?: string;
  }>;
}

export interface MessageResponse {
  id: number;
  userId: number;
  userName: string;
  content: string;
  created_at: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private isRefreshing: boolean = false;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  /**
   * 🔥 Load BOTH user + guest token on app start
   */
  private loadToken(): void {
    this.accessToken =
      localStorage.getItem('accessToken') ||
      localStorage.getItem('guestToken');
  }

  /**
   * Save user tokens
   */
  private saveTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  /**
   * Clear user tokens (does NOT remove guest token)
   */
  clearTokens(): void {
    this.accessToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /**
   * 🔥 Get current token (user OR guest)
   */
  getAccessToken(): string | null {
    return (
      this.accessToken ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('guestToken')
    );
  }

  /**
   * Core HTTP request helper
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // 🔥 Attach user OR guest token automatically
    const token = this.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      /**
       * 🔁 Auto refresh ONLY for real users (not guests)
       */
      const hasRefreshToken = localStorage.getItem('refreshToken');

      if (
        response.status === 401 &&
        hasRefreshToken &&
        !isRetry &&
        !this.isRefreshing
      ) {
        try {
          this.isRefreshing = true;
          await this.refreshToken();
          this.isRefreshing = false;
          return this.request<T>(endpoint, options, true);
        } catch {
          this.isRefreshing = false;
          this.clearTokens();
          localStorage.removeItem('webrtc_user');
          window.location.href = '/login';
          throw { message: 'Session expired. Please login again.', status: 401 } as ApiError;
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: response.statusText,
        }));
        throw {
          message: error.message || 'An error occurred',
          status: response.status,
        } as ApiError;
      }

      if (response.status === 204) return {} as T;

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError) {
        throw {
          message: 'Network error. Please check your connection.',
          status: 0,
        } as ApiError;
      }
      throw error;
    }
  }

  // ================= AUTH =================

  async register(name: string, email: string, password: string): Promise<RegisterResponse> {
    const res = await this.request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.saveTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.saveTokens(res.accessToken, res.refreshToken);
    return res;
  }

  async refreshToken(): Promise<{ accessToken: string }> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw { message: 'No refresh token', status: 401 };

    const res = await this.request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    this.accessToken = res.accessToken;
    localStorage.setItem('accessToken', res.accessToken);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  // ================= ROOMS =================

  async createRoom(title: string, description?: string): Promise<RoomResponse> {
    return this.request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
  }

  async getUserRooms(): Promise<RoomResponse[]> {
    return this.request('/api/rooms', { method: 'GET' });
  }

  async getRoomByCode(roomCode: string): Promise<RoomResponse> {
    return this.request(`/api/rooms/${roomCode}`, { method: 'GET' });
  }

  async joinRoom(roomCode: string): Promise<RoomResponse> {
    return this.request(`/api/rooms/${roomCode}/join`, { method: 'POST' });
  }

  async leaveRoom(roomCode: string) {
    return this.request(`/api/rooms/${roomCode}/leave`, { method: 'POST' });
  }

  async deleteRoom(roomCode: string) {
    return this.request(`/api/rooms/${roomCode}`, { method: 'DELETE' });
  }

  // ================= GUEST =================

  async guestJoinRoom(roomCode: string, guestName: string) {
    return this.request(`/api/rooms/${roomCode}/guest-join`, {
      method: 'POST',
      body: JSON.stringify({ guestName }),
    });
  }

  // ================= MESSAGES =================

  async getRoomMessages(roomId: number, limit = 50, offset = 0, order: 'asc' | 'desc' = 'asc') {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      order,
    });
    return this.request(`/api/rooms/${roomId}/messages?${params}`);
  }
}

export const apiClient = new ApiClient();
