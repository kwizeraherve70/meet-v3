import arcjet, { tokenBucket, shield } from '@arcjet/node';

/**
 * Arcjet Security Configuration
 * Provides rate limiting and bot detection for the application
 */

// Main Arcjet instance - General protection (100 req/min)
export const aj = arcjet({
  key: process.env.ARCJET_KEY || '',
  characteristics: ['ip.src'],
  rules: [
    // Bot and attack protection
    shield({
      mode: 'LIVE',
    }),

    // General rate limit: 100 requests per minute per IP
    tokenBucket({
      mode: 'LIVE',
      refillRate: 100,
      interval: 60,
      capacity: 100,
    }),
  ],
});

/**
 * Auth Arcjet instance - Stricter limits for login/register
 * Prevents brute force attacks
 * Limit: 5 attempts per 15 minutes
 */
export const ajAuth = arcjet({
  key: process.env.ARCJET_KEY || '',
  characteristics: ['ip.src'],
  rules: [
    // Auth-specific rate limit: 5 attempts per 15 minutes per IP
    tokenBucket({
      mode: 'LIVE',
      refillRate: 5,
      interval: 900, // 15 minutes
      capacity: 5,
    }),
  ],
});

/**
 * Room Arcjet instance - Moderate limits for room operations
 * Prevents room spam and DoS
 * Limit: 20 requests per minute
 */
export const ajRoom = arcjet({
  key: process.env.ARCJET_KEY || '',
  characteristics: ['ip.src'],
  rules: [
    // Room operations: 20 requests per minute per IP
    tokenBucket({
      mode: 'LIVE',
      refillRate: 20,
      interval: 60,
      capacity: 20,
    }),
  ],
});

/**
 * Chat Arcjet instance - Lenient limits for chat messages
 * Allows normal conversation while preventing spam
 * Limit: 50 messages per minute
 */
export const ajChat = arcjet({
  key: process.env.ARCJET_KEY || '',
  characteristics: ['ip.src'],
  rules: [
    // Chat: 50 messages per minute per IP
    tokenBucket({
      mode: 'LIVE',
      refillRate: 50,
      interval: 60,
      capacity: 50,
    }),
  ],
});

/**
 * Helper function to handle Arcjet decisions
 * Returns error response if request is denied
 */
export async function handleArcjetDecision(
  decision: any,
  res: any,
  defaultMessage: string = 'Too many requests. Please try again later.'
) {
  if (decision.isDenied()) {
    if (decision.reason.isRateLimit?.()) {
      console.warn('[ARCJET] Rate limit exceeded');
      return res.status(429).json({
        message: defaultMessage,
        error: 'RATE_LIMIT_EXCEEDED',
      });
    }

    if (decision.reason.isBot?.()) {
      console.warn('[ARCJET] Bot detected');
      return res.status(403).json({
        message: 'Bot activity detected. Access denied.',
        error: 'BOT_DETECTED',
      });
    }

    console.warn('[ARCJET] Request denied');
    return res.status(403).json({
      message: defaultMessage,
      error: 'FORBIDDEN',
    });
  }

  return null; // Request allowed
}
