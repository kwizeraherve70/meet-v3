/**
 * WebSocket/Socket.IO Service
 * Handles real-time communication with backend
 * 
 * FIXED: Better error handling, no auto-reconnect without token
 */

import io, { Socket } from 'socket.io-client';
import { apiClient } from './api';

const SOCKET_URL = 'http://localhost:3001';

export interface SocketEvents {
  // Room events
  'join-room': { roomId: string | number; username: string };
  'leave-room': { roomId: string | number };
  'room-joined': { participants: any[]; isHost: boolean; roomId: string | number };
  'sync-peers': { peers: any[]; message?: string };
  'send-message': { roomId: string | number; content: string };
  'request-chat-history': { roomId: string | number; limit?: number; offset?: number };
  'search-messages': { roomId: string | number; query: string; limit?: number; offset?: number };
  'update-media-state': { roomId: string | number; mediaState: { isVideoEnabled: boolean; isAudioEnabled: boolean } };
  
  // Signaling events
  'offer': { to: string | number; roomId: string | number; offer: any };
  'answer': { to: string | number; roomId: string | number; answer: any };
  'icecandidate': { to: string | number; roomId: string | number; candidate: any };
  
  // Server events
  'user-joined': { userId: string | number; userName: string; isHost?: boolean };
  'user-left': { userId: string | number; userName: string };
  'message-received': { id: string | number; userId: string | number; userName: string; content: string; timestamp: string };
  'message-history': { roomId: string | number; messages: any[]; count: number };
  'user-media-state': { userId: string | number; mediaState: { isVideoEnabled: boolean; isAudioEnabled: boolean } };
  'error': { message: string };
  'connected': {};
  'disconnected': {};
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private connectionPromise: Promise<void> | null = null;

  /**
   * Get authentication token from various sources
   * Priority: 1. API Client, 2. localStorage authToken, 3. localStorage guestToken
   */
  private getAuthToken(): string | null {
    // Try API client first (for authenticated users)
    let token = apiClient.getAccessToken();
    if (token) {
      console.log('Socket: Using auth token from API client');
      return token;
    }

    // Try localStorage authToken (backup)
    token = localStorage.getItem('authToken');
    if (token) {
      console.log('Socket: Using auth token from localStorage');
      return token;
    }

    // Try guest token
    token = localStorage.getItem('guestToken');
    if (token) {
      console.log('Socket: Using guest token from localStorage');
      return token;
    }

    console.warn('Socket: No authentication token found');
    return null;
  }

  /**
   * Initialize socket connection with JWT authentication
   * Supports both authenticated users and guests
   */
  connect(): Promise<void> {
    // If already connecting, return existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If already connected, resolve immediately
    if (this.isConnected && this.socket) {
      return Promise.resolve();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      // Get token from available sources
      const token = this.getAuthToken();

      // ✅ CRITICAL FIX: Require token before connecting
      if (!token) {
        const error = new Error('No authentication token available. Please login or join as guest first.');
        console.error('Socket connection failed:', error.message);
        this.connectionPromise = null;
        reject(error);
        return;
      }

      console.log('Socket: Connecting with authentication token...');

      const socketOptions: any = {
        reconnection: false, // ✅ DISABLE auto-reconnection to prevent token issues
        transports: ['websocket', 'polling'],
        auth: { 
          token: token 
        },
      };

      this.socket = io(SOCKET_URL, socketOptions);

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionPromise = null;
        console.log('✅ Socket connected:', this.socket?.id);
        this.emitToListeners('connected', {});
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.connectionPromise = null;
        console.log('❌ Socket disconnected. Reason:', reason);
        this.emitToListeners('disconnected', {});
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Socket connection error:', error.message);
        this.connectionPromise = null;
        
        // Check if it's an authentication error
        if (error.message && error.message.includes('Authentication')) {
          console.error('Authentication failed - token may be invalid or expired');
          reject(new Error('Authentication failed: ' + error.message));
          return;
        }

        reject(new Error('Socket connection error: ' + error.message));
      });

      this.socket.on('error', (error: any) => {
        console.error('❌ Socket error:', error);
        this.emitToListeners('socket-error', error);
      });

      // Setup timeout for connection
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          this.connectionPromise = null;
          reject(new Error('Socket connection timeout'));
        }
      }, 10000);

      // Clear timeout on successful connection
      const originalResolve = resolve;
      resolve = () => {
        clearTimeout(timeout);
        originalResolve();
      };
    });

    return this.connectionPromise;
  }

  /**
   * Reconnect with fresh token
   * Only call this if you have a valid token
   */
  async reconnectWithNewToken(): Promise<void> {
    console.log('Socket: Reconnecting with fresh token...');
    
    // Disconnect first
    this.disconnect();
    
    // Small delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Reconnect
    return this.connect();
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectionPromise = null;
      console.log('Socket: Disconnected');
    }
  }

  /**
   * Check if socket is connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && !!this.socket;
  }

  /**
   * Emit an event to the server
   */
  emit<T extends keyof SocketEvents>(
    event: T,
    data: SocketEvents[T],
    callback?: (response: any) => void
  ): void {
    if (!this.socket || !this.isConnected) {
      console.error(`Cannot emit ${event}: Socket not connected`);
      return;
    }
    this.socket.emit(event, data, callback);
  }

  /**
   * Listen to a socket event from the server
   */
  on<T extends keyof SocketEvents>(
    event: T,
    handler: (data: SocketEvents[T]) => void
  ): () => void {
    if (!this.socket) {
      console.error(`Cannot listen to ${event}: Socket not initialized`);
      return () => {};
    }

    this.socket.on(event, handler as any);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        this.socket.off(event, handler as any);
      }
    };
  }

  /**
   * Listen to a socket event once
   */
  once<T extends keyof SocketEvents>(
    event: T,
    handler: (data: SocketEvents[T]) => void
  ): void {
    if (!this.socket) {
      console.error(`Cannot listen to ${event}: Socket not initialized`);
      return;
    }
    this.socket.once(event, handler as any);
  }

  /**
   * Register a custom event listener for internal events
   */
  onCustom(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  /**
   * Unregister a custom event listener
   */
  offCustom(event: string, handler: Function): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(handler);
    }
  }

  /**
   * Emit to custom event listeners
   */
  private emitToListeners(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Join a room
   */
  joinRoom(roomId: string | number, username: string): void {
    this.emit('join-room', { 
      roomId,
      username 
    });
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string | number): void {
    this.emit('leave-room', { 
      roomId
    });
  }

  /**
   * Send a chat message
   */
  sendMessage(roomId: string | number, content: string): void {
    this.emit('send-message', {
      roomId,
      content
    });
  }

  /**
   * Request chat history
   */
  requestChatHistory(roomId: string | number, limit?: number, offset?: number): void {
    this.emit('request-chat-history', {
      roomId,
      limit,
      offset
    });
  }

  /**
   * Send WebRTC offer
   */
  sendOffer(to: string | number, roomId: string | number, offer: any): void {
    this.emit('offer', {
      to,
      roomId,
      offer
    });
  }

  /**
   * Send WebRTC answer
   */
  sendAnswer(to: string | number, roomId: string | number, answer: any): void {
    this.emit('answer', {
      to,
      roomId,
      answer
    });
  }

  /**
   * Send ICE candidate
   */
  sendIceCandidate(to: string | number, roomId: string | number, candidate: any): void {
    this.emit('icecandidate', {
      to,
      roomId,
      candidate
    });
  }

  /**
   * Update media state (video/audio on/off)
   */
  updateMediaState(roomId: string | number, isVideoEnabled: boolean, isAudioEnabled: boolean): void {
    this.emit('update-media-state', {
      roomId,
      mediaState: {
        isVideoEnabled,
        isAudioEnabled
      }
    });
  }
}

// Export singleton instance
export const socketService = new SocketService();