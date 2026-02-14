import express, { Router, Request, Response } from 'express';
import { UserService } from '../services/user.service.js';
import { ajAuth, handleArcjetDecision } from '../config/arcjet.config.js';

const router: Router = express.Router();
console.log('[AUTH-ROUTES] Initializing UserService...');
const userService = new UserService();
console.log('[AUTH-ROUTES] UserService initialized successfully');

/**
 * @route POST /auth/register
 * @description Register a new user
 * @body { name: string, email: string, password: string }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Arcjet rate limiting - prevent brute force registration
    const decision = await ajAuth.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(
      decision,
      res,
      'Too many registration attempts. Please try again later.'
    );
    if (denialResponse) return;

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const user = await userService.registerUser({ name, email, password });
    const authResponse = await userService.loginUser(email, password);

    res.status(201).json(authResponse);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
  }
});

/**
 * @route POST /auth/login
 * @description Authenticate user and return JWT tokens
 * @body { email: string, password: string }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Arcjet rate limiting - prevent brute force attacks
    const decision = await ajAuth.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(
      decision,
      res,
      'Too many login attempts. Please try again later.'
    );
    if (denialResponse) return;

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const authResponse = await userService.loginUser(email, password);
    res.json(authResponse);
  } catch (error) {
    res.status(401).json({ message: (error as Error).message });
  }
});

/**
 * @route POST /auth/refresh
 * @description Refresh access token using refresh token
 * @body { refresh_token: string }
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Arcjet rate limiting - prevent token refresh abuse
    const decision = await ajAuth.protect(req, { requested: 1 });
    const denialResponse = await handleArcjetDecision(decision, res);
    if (denialResponse) return;

    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const accessToken = userService.refreshAccessToken(refreshToken);
    res.json({ accessToken: accessToken });
  } catch (error) {
    res.status(401).json({ message: (error as Error).message });
  }
});

/**
 * @route POST /auth/logout
 * @description Logout user (client-side token cleanup)
 */
router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;

