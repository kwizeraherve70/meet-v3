import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';

/**
 * Extended Express Request with optional user data
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

const userService = new UserService();

/**
 * Middleware to extract and verify JWT token from Authorization header
 * Attaches user data to req.user if token is valid
 * Does NOT reject requests without token (optional auth)
 *
 * Usage: app.use(authMiddleware);
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      // No token provided - continue without auth
      return next();
    }

    // Verify token
    const decoded = userService.verifyToken(token);
    req.user = decoded;
  } catch (error) {
    // Invalid token - continue without auth
    // Routes that need auth will check req.user
  }

  next();
};

/**
 * Middleware to require authentication
 * Should be used on routes that need auth
 * Returns 401 if user is not authenticated
 *
 * Usage: router.post('/', requireAuth, handler);
 */
export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized - token required' });
    return;
  }

  next();
};

/**
 * Middleware to handle validation errors
 * Catches errors from body validation
 */
export const handleValidationError = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check for required fields in request body
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body || Object.keys(req.body).length === 0) {
      res.status(400).json({ message: 'Request body is required' });
      return;
    }
  }

  next();
};
