import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../database/prisma.js';
import { User, CreateUserRequest, AuthResponse } from '../types/index.js';
import { cache } from '../lib/cache.js';

// Cache key constants
const CACHE_KEYS = {
  USER_ID: (id: number) => `user:id:${id}`,
  USER_EMAIL: (email: string) => `user:email:${email}`,
  USER_SESSION: (userId: number) => `session:user:${userId}`,
};

const CACHE_TTL = {
  USER: 3600, // 1 hour
  SESSION: 1800, // 30 minutes
};

export class UserService {
  /**
   * Register a new user
   * @param userData User registration data
   * @throws Error if user already exists or database error
   */
  async registerUser(userData: CreateUserRequest): Promise<User> {
    const { name, email, password } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const userObj = {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };

    // Cache new user
    await cache.set(CACHE_KEYS.USER_ID(user.id), userObj, CACHE_TTL.USER);
    await cache.set(CACHE_KEYS.USER_EMAIL(email), userObj, CACHE_TTL.USER);

    return userObj;
  }

  /**
   * Authenticate user and return JWT tokens
   * @param email User email
   * @param password User password
   * @throws Error if credentials are invalid
   */
  async loginUser(email: string, password: string): Promise<AuthResponse> {
    // Always fetch from database for login to get passwordHash
    // (passwordHash is not cached for security reasons)
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!dbUser) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, dbUser.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT tokens
    const secret = (process.env.JWT_SECRET || 'dev_secret_key_12345') as string;
    const accessToken = jwt.sign(
      { userId: dbUser.id, email: dbUser.email },
      secret,
      { expiresIn: process.env.JWT_EXPIRY || '15m' } as any
    );

    const refreshToken = jwt.sign(
      { userId: dbUser.id },
      secret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' } as any
    );

    // Cache user session (without passwordHash for security)
    const userSession = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      created_at: dbUser.createdAt,
      updated_at: dbUser.updatedAt,
    };
    await cache.set(CACHE_KEYS.USER_SESSION(dbUser.id), userSession, CACHE_TTL.SESSION);
    await cache.set(CACHE_KEYS.USER_ID(dbUser.id), userSession, CACHE_TTL.USER);

    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: userSession,
    };
  }

  /**
   * Get user by ID
   * @param userId User ID
   */
  async getUserById(userId: number): Promise<User> {
    // Try to get from cache first
    const cached = await cache.get<User>(CACHE_KEYS.USER_ID(userId));
    if (cached) {
      return cached;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const userObj = {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };

    // Cache the user
    await cache.set(CACHE_KEYS.USER_ID(userId), userObj, CACHE_TTL.USER);

    return userObj;
  }

  /**
   * Verify JWT token
   * @param token JWT access token
   */
  verifyToken(token: string): { userId: number; email: string } {
    try {
      const secret = (process.env.JWT_SECRET || 'dev_secret_key_12345') as string;
      const decoded = jwt.verify(token, secret);

      // ADD THIS:
  console.log('🔍 Token:', JSON.stringify(decoded, null, 2));
  console.log('🔍 Fields:', Object.keys(decoded));
  
      return decoded as { userId: number; email: string };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken Refresh token
   */
  refreshAccessToken(refreshToken: string): string {
    try {
      const secret = (process.env.JWT_SECRET || 'dev_secret_key_12345') as string;
      const decoded = jwt.verify(refreshToken, secret);
      const userId = (decoded as any).userId;

      const newAccessToken = jwt.sign(
        { userId },
        secret,
        { expiresIn: process.env.JWT_EXPIRY || '15m' } as any
      );

      return newAccessToken;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Create a guest token for unauthenticated users joining meetings
   * @param guestName Display name for the guest
   */
  createGuestToken(guestName: string): { token: string; guestId: string } {
    const secret = (process.env.JWT_SECRET || 'dev_secret_key_12345') as string;
    // Generate a unique guest ID
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    const token = jwt.sign(
      { 
        guestId,
        guestName,
        isGuest: true 
      },
      secret,
      { expiresIn: '24h' } as any // Guest tokens valid for 24 hours
    );

    return { token, guestId };
  }

  /**
   * Verify a guest token
   * @param token Guest JWT token
   */
  verifyGuestToken(token: string): { guestId: string; guestName: string; isGuest: boolean } {
    try {
      const secret = (process.env.JWT_SECRET || 'dev_secret_key_12345') as string;
      const decoded = jwt.verify(token, secret);
      const payload = decoded as { guestId: string; guestName: string; isGuest: boolean };
      
      if (!payload.isGuest) {
        throw new Error('Not a guest token');
      }
      
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired guest token');
    }
  }

  /**
   * Invalidate user cache on update
   * @param userId User ID
   * @param email User email
   */
  async invalidateUserCache(userId: number, email?: string): Promise<void> {
    const keys = [CACHE_KEYS.USER_ID(userId), CACHE_KEYS.USER_SESSION(userId)];
    if (email) {
      keys.push(CACHE_KEYS.USER_EMAIL(email));
    }
    await cache.deleteMany(keys);
  }
}
