import { Socket } from 'socket.io';
import { UserService } from '../services/user.service.js';

console.log('[SOCKET-AUTH] Initializing UserService...');
const userService = new UserService();
console.log('[SOCKET-AUTH] UserService initialized successfully');

/**
 * Socket.IO authentication middleware
 * 
 * FIXED: Properly handles guest tokens without calling getUserById
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      console.warn(`⚠️ Socket connection attempt without token (${socket.id})`);
      return next(new Error('Authentication error: No token provided'));
    }

    // ✅ FIX: Try guest token FIRST to avoid calling getUserById with undefined
    try {
      const guestData = userService.verifyGuestToken(token as string);

      // Attach guest info to socket
      socket.data.user = {
        id: null,
        guestId: guestData.guestId,
        name: guestData.guestName,
        email: null,
        isGuest: true,
      };

      console.log(`✅ Socket authenticated (guest): ${guestData.guestName} (${socket.id})`);
      return next();
    } catch (guestError) {
      // Not a guest token, try user token
    }

    // Try to verify as a regular user token
    try {
      const decoded = userService.verifyToken(token as string);

      // ✅ IMPORTANT: Ensure userId exists before calling getUserById
      if (!decoded.userId) {
        throw new Error('No userId in token');
      }

      // Fetch user info with retry logic
      let user;
      let retryCount = 0;
      const maxRetries = 2;
      let lastError: Error | null = null;

      while (retryCount <= maxRetries) {
        try {
          user = await userService.getUserById(decoded.userId);
          break;
        } catch (userFetchError: any) {
          lastError = userFetchError;
          retryCount++;
          
          const errorMessage = userFetchError.message || 'Unknown error';
          const isCacheError = errorMessage.includes('JSON') || 
                              errorMessage.includes('parse') || 
                              errorMessage.includes('SyntaxError');
          
          if (isCacheError && retryCount <= maxRetries) {
            console.warn(
              `⚠️ Cache error for user ${decoded.userId} (attempt ${retryCount}/${maxRetries + 1})`
            );
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
          
          throw userFetchError;
        }
      }

      if (!user) {
        const errorMsg = lastError ? lastError.message : 'User not found';
        throw new Error(errorMsg);
      }

      // Attach user info to socket
      socket.data.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        isGuest: false,
      };

      console.log(`✅ Socket authenticated (user): ${user.name} (${socket.id})`);
      return next();
    } catch (userError: any) {
      const errorMessage = userError.message || 'Unknown user verification error';
      console.log(`ℹ️ User token verification failed: ${errorMessage}`);
      
      // Both user and guest verification failed
      console.error(`❌ Token verification failed for both user and guest (${socket.id})`);
      throw new Error('Invalid or expired token');
    }
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown authentication error';
    console.error(`❌ Socket authentication failed (${socket.id}):`, errorMessage);
    next(new Error(`Authentication error: ${errorMessage}`));
  }
}

/**
 * Type extension for Socket to include user data
 */
declare global {
  namespace SocketIO {
    interface Socket {
      data: {
        user?: {
          id: number | null;
          guestId?: string;
          name: string;
          email: string | null;
          isGuest: boolean;
        };
      };
    }
  }
}