import express, { Router, Response } from 'express';
import { RoomService } from '../services/room.service.js';
import { UserService } from '../services/user.service.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware.js';
import { ajRoom, handleArcjetDecision } from '../config/arcjet.config.js';

const router: Router = express.Router();
const roomService = new RoomService();
const userService = new UserService();

/**
 * @route POST /api/rooms
 * @description Create a new meeting room
 * @auth Required
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting - prevent room spam
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(
      decision,
      res,
      'Too many room creation requests. Please try again later.'
    );
    if (denialResponse) return;

    const { title } = req.body;
    const room = await roomService.createRoom(req.user!.userId, { title });

    // Transform snake_case to camelCase for frontend
    const transformedRoom = {
      id: room.id,
      roomCode: room.room_id,
      title: room.title,
      createdById: room.created_by,
      isActive: false,
      createdAt: room.created_at,
      updatedAt: room.created_at,
    };

    res.status(201).json(transformedRoom);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route GET /api/rooms
 * @description Get all rooms created by authenticated user
 * @auth Required
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(decision, res);
    if (denialResponse) return;

    const rooms = await roomService.getUserRooms(req.user!.userId);
    
    // Transform snake_case to camelCase for frontend
    const transformedRooms = rooms.map(room => ({
      id: room.id,
      roomCode: room.room_id,
      title: room.title,
      createdById: room.created_by,
      isActive: false, // Default value
      createdAt: room.created_at,
      updatedAt: room.created_at,
    }));
    
    res.json(transformedRooms);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route GET /api/rooms/:roomCode
 * @description Get room details by room code
 */
router.get('/:roomCode', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(decision, res);
    if (denialResponse) return;

    const roomCode = req.params.roomCode as string;
    const room = await roomService.getRoomByCode(roomCode);
    const participants = await roomService.getRoomParticipants(room.id);

    res.json({
      ...room,
      participants,
    });
  } catch (error) {
    res.status(404).json({ message: (error as Error).message });
  }
});

/**
 * @route POST /api/rooms/:roomCode/join
 * @description Join a room
 * @auth Required
 */
router.post('/:roomCode/join', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting - prevent join spam
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(
      decision,
      res,
      'Too many join requests. Please try again later.'
    );
    if (denialResponse) return;

    const roomCode = req.params.roomCode as string;
    const room = await roomService.getRoomByCode(roomCode);
    await roomService.addParticipant(req.user!.userId, room.id);

    res.json(room);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route POST /api/rooms/:roomCode/guest-join
 * @description Join a room as a guest (no authentication required)
 * @body { guestName: string }
 * @returns Room details + guestToken + guestId
 */
router.post('/:roomCode/guest-join', async (req, res) => {
  try {
    const { guestName } = req.body;

    // Validate guest name
    if (!guestName || typeof guestName !== 'string' || guestName.trim().length === 0) {
      return res.status(400).json({ message: 'Guest name is required and must be a non-empty string' });
    }

    if (guestName.trim().length > 100) {
      return res.status(400).json({ message: 'Guest name must be less than 100 characters' });
    }

    // Arcjet rate limiting for guest join
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(
      decision,
      res,
      'Too many join requests. Please try again later.'
    );
    if (denialResponse) return;

    // Get room by code
    const room = await roomService.getRoomByCode(req.params.roomCode as string);

    // Add guest participant to room
    await roomService.addGuestParticipant(guestName.trim(), room.id);

    // Create guest token
    const { token, guestId } = userService.createGuestToken(guestName.trim());

    res.status(200).json({
      id: room.id,
      roomCode: room.room_id,
      title: room.title,
      description: undefined,
      createdById: room.created_by,
      isActive: true,
      createdAt: undefined,
      updatedAt: undefined,
      guestToken: token,
      guestId: guestId,
      isGuest: true,
    });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route POST /api/rooms/:roomCode/leave
 * @description Leave a room
 * @auth Required
 */
router.post('/:roomCode/leave', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(decision, res);
    if (denialResponse) return;

    const roomCode = req.params.roomCode as string;
    const room = await roomService.getRoomByCode(roomCode);
    await roomService.removeParticipant(req.user!.userId, room.id);

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route DELETE /api/rooms/:roomCode
 * @description Delete a room (only creator)
 * @auth Required
 */
router.delete('/:roomCode', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting - prevent delete spam
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(
      decision,
      res,
      'Too many delete requests. Please try again later.'
    );
    if (denialResponse) return;

    const roomCode = req.params.roomCode as string;
    const room = await roomService.getRoomByCode(roomCode);
    await roomService.deleteRoom(room.id, req.user!.userId);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route GET /api/rooms/:roomId/messages
 * @description Get chat messages for a room
 * @auth Required
 * @query limit - Number of messages to return (default: 50, max: 100)
 * @query offset - Number of messages to skip (default: 0)
 * @query order - Sort order: 'asc' or 'desc' (default: 'asc')
 */
router.get('/:roomId/messages', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Arcjet rate limiting
    const decision = await ajRoom.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(decision, res);
    if (denialResponse) return;

    const roomId = parseInt(Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId, 10);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const order = (req.query.order as string) === 'desc' ? 'desc' : 'asc';

    if (isNaN(roomId)) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    // Verify user has access to this room
    const room = await roomService.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Fetch messages with user info
    const messages = await roomService.getRoomMessages(roomId, limit, offset, order);

    // Get total message count
    const totalMessages = await roomService.getRoomMessageCount(roomId);

    res.json({
      messages,
      pagination: {
        total: totalMessages,
        limit,
        offset,
        hasMore: offset + messages.length < totalMessages,
      },
    });
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

export default router;
