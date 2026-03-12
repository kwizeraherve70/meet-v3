import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();
const prisma = new PrismaClient();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'recordings');
await fs.mkdir(uploadsDir, { recursive: true });

/**
 * POST /api/recordings/upload
 * Upload a recorded video file
 */
router.post('/upload', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const roomId = parseInt(req.body.roomId);
    const title = req.body.title || 'Meeting Recording';
    const duration = parseInt(req.body.duration) || 0;

    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Generate unique filename
    const filename = `${roomId}-${uuidv4()}.webm`;
    const filepath = path.join(uploadsDir, filename);

    // Write file to disk
    await fs.writeFile(filepath, req.file.buffer);

    // Create recording in database
    const recording = await prisma.recording.create({
      data: {
        roomId,
        title,
        duration,
        fileUrl: `/recordings/${filename}`,
        thumbnail: null, // Could generate thumbnail later
      },
    });

    console.log('✅ Recording saved:', {
      id: recording.id,
      roomId,
      filename,
      size: req.file.size,
    });

    res.json({
      success: true,
      recording: {
        id: recording.id,
        title: recording.title,
        duration: recording.duration,
        url: recording.fileUrl,
      },
    });
  } catch (error) {
    console.error('Recording upload error:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

/**
 * GET /api/recordings/room/:roomId
 * Get all recordings for a room
 */
router.get('/room/:roomId', async (req: Request, res: Response) => {
  try {
    const roomId = parseInt(String(req.params.roomId));

    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }

    const recordings = await prisma.recording.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        duration: true,
        fileUrl: true,
        thumbnail: true,
        createdAt: true,
      },
    });

    res.json({ recordings });
  } catch (error) {
    console.error('Failed to fetch recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

/**
 * GET /api/recordings/download/:filename
 * Download a recorded video file
 */
router.get('/download/:filename', async (req: Request, res: Response) => {
  try {
    const filename = String(req.params.filename);

    // Security: validate filename to prevent path traversal
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(uploadsDir, filename);

    // Verify file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers for video streaming
    const stat = await fs.stat(filepath);
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Length', stat.size.toString());
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file
    const stream = (await import('fs')).createReadStream(filepath);
    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download recording' });
  }
});

/**
 * DELETE /api/recordings/:recordingId
 * Delete a recording
 */
router.delete('/:recordingId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const recordingId = parseInt(String(req.params.recordingId));

    if (!recordingId || isNaN(recordingId)) {
      return res.status(400).json({ error: 'Invalid recording ID' });
    }

    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      include: { room: true },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Verify user is room owner or admin
    const userId = (req as any).user?.id;
    if (
      userId &&
      recording.room.createdById !== userId
    ) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete file from disk
    const filename = recording.fileUrl.split('/').pop();
    if (filename) {
      const filepath = path.join(uploadsDir, filename);
      try {
        await fs.unlink(filepath);
      } catch {
        // File might already be deleted
      }
    }

    // Delete from database
    await prisma.recording.delete({
      where: { id: recordingId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

export default router;
