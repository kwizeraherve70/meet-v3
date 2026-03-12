import React, { createContext, useState, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import { socketService } from '@/lib/socket';


export interface User {
  id?: number;
  name: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: (guestName: string, guestToken: string, guestId: string) => void;
  logoutAsGuest: () => void;
  isAuthenticated: boolean;
  isGuest: boolean;
  guestToken: string | null;
  guestId: string | null;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🚀 RESTORE SESSION ON APP START
  useEffect(() => {
    const checkAuth = async () => {
      const savedGuestToken = localStorage.getItem('guestToken');
      const savedGuestId = localStorage.getItem('guestId');
      const savedGuestUser = localStorage.getItem('webrtc_guest_user');

      // ===== RESTORE GUEST =====
      if (savedGuestToken && savedGuestId && savedGuestUser) {
        setGuestToken(savedGuestToken);
        setGuestId(savedGuestId);
        setUser(JSON.parse(savedGuestUser));
        setIsGuest(true);
        setIsLoading(false);

        // ✅ Socket will auto-connect when needed (no manual connect here)
        return;
      }

      // ===== RESTORE AUTH USER =====
      const token = apiClient.getAccessToken();
      if (token) {
        const savedUser = localStorage.getItem('webrtc_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        setIsLoading(false);
        // ✅ Socket will auto-connect when needed (no manual connect here)
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // ================= LOGIN =================
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await apiClient.login(email, password);

      setUser(response.user);
      setIsGuest(false);

      localStorage.setItem('webrtc_user', JSON.stringify(response.user));
      localStorage.removeItem('guestToken');
      localStorage.removeItem('guestId');
      localStorage.removeItem('webrtc_guest_user');

      // ✅ REMOVED: No manual socket connection
      // Socket will auto-connect when joining a meeting room

    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Login failed');
      throw err;
    }
  };

  // ================= REGISTER =================
  const register = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      const response = await apiClient.register(name, email, password);

      setUser(response.user);
      setIsGuest(false);
      localStorage.setItem('webrtc_user', JSON.stringify(response.user));

      // ✅ REMOVED: No manual socket connection
      // Socket will auto-connect when joining a meeting room

    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Registration failed');
      throw err;
    }
  };

  // ================= GUEST LOGIN =================
  const loginAsGuest = (guestName: string, token: string, id: string) => {
    const guestUser: User = { name: guestName };

    setUser(guestUser);
    setGuestToken(token);
    setGuestId(id);
    setIsGuest(true);

    // Update apiClient in-memory token immediately so the socket uses the
    // new token rather than any stale token loaded at construction time.
    apiClient.setGuestToken(token);

    localStorage.setItem('guestId', id);
    localStorage.setItem('webrtc_guest_user', JSON.stringify(guestUser));
  };

  // ================= LOGOUT GUEST =================
  const logoutAsGuest = () => {
    socketService.disconnect();

    setUser(null);
    setGuestToken(null);
    setGuestId(null);
    setIsGuest(false);

    localStorage.removeItem('guestToken');
    localStorage.removeItem('guestId');
    localStorage.removeItem('webrtc_guest_user');
  };

  // ================= LOGOUT USER =================
  const logout = async () => {
    try {
      socketService.disconnect();

      if (isGuest) {
        logoutAsGuest();
      } else {
        await apiClient.logout();
        apiClient.clearTokens();
        localStorage.removeItem('webrtc_user');
        setUser(null);
      }
    } catch {
      socketService.disconnect();
      apiClient.clearTokens();
      setUser(null);
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    loginAsGuest,
    logoutAsGuest,
    isAuthenticated: !!user && !isGuest,
    isGuest,
    guestToken,
    guestId,
    isLoading,
    error,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};