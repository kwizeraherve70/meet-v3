import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { registerRoomHandlers } from './room.socket.js';
import { registerSignalingHandlers } from './signaling.socket.js';
import { socketAuthMiddleware } from '../middleware/socket.auth.js';

/**
 * Initialize Socket.IO server with WebRTC signaling support
 * 
 * This function:
 * 1. Creates a Socket.IO server attached to HTTP server
 * 2. Configures CORS for client connections
 * 3. Applies JWT authentication middleware
 * 4. Registers connection handlers for WebRTC signaling
 * 5. Can be extended with additional namespaces in the future
 * 
 * @param httpServer - HTTP server instance from createServer()
 * @returns Configured Socket.IO server
 */
export function initializeSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
        : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Apply JWT authentication middleware to all connections
  io.use(socketAuthMiddleware);

  // Main namespace: WebRTC signaling and real-time features
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`✅ Authenticated user connected: ${user?.name} (${socket.id})`);

    // Register room-related event handlers
    registerRoomHandlers(socket, io);

    // Register WebRTC signaling event handlers
    registerSignalingHandlers(socket, io);
  });

  // Future: Add additional namespaces as features grow
  // Example:
  // io.of('/notifications').on('connection', (socket) => {
  //   socket.on('subscribe', (topic) => { ... })
  // });
  //
  // io.of('/admin').on('connection', (socket) => {
  //   if (!isAdmin(socket)) socket.disconnect();
  //   socket.on('kick-user', (userId) => { ... })
  // });

  return io;
}

export default initializeSocketIO;
