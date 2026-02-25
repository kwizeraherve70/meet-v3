/**
 * Emoji Reaction Rate Limiter
 * Prevents spam by limiting emoji reactions per user
 * 
 * Strategy: Sliding window (max 3 emojis per 10 seconds per user per room)
 */

interface ReactionRecord {
  timestamp: number;
}

interface UserReactionHistory {
  [roomId: number]: ReactionRecord[];
}

class EmojiRateLimiter {
  private userHistory: Map<string, UserReactionHistory> = new Map();
  private readonly MAX_REACTIONS = 3;
  private readonly WINDOW_MS = 10000; // 10 seconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if user can send emoji reaction in this room
   * Returns true if allowed, false if rate limited
   */
  canReact(userId: string, roomId: number): boolean {
    // Get or create user history
    if (!this.userHistory.has(userId)) {
      this.userHistory.set(userId, {});
    }

    const userHistory = this.userHistory.get(userId)!;

    // Get or create room reactions list
    if (!userHistory[roomId]) {
      userHistory[roomId] = [];
    }

    const reactions = userHistory[roomId];
    const now = Date.now();

    // Remove reactions outside the sliding window
    const validReactions = reactions.filter(
      (record) => now - record.timestamp < this.WINDOW_MS
    );

    // Check if under limit
    const canReact = validReactions.length < this.MAX_REACTIONS;

    if (canReact) {
      // Add new reaction record
      validReactions.push({ timestamp: now });
      userHistory[roomId] = validReactions;
    }

    return canReact;
  }

  /**
   * Get remaining reactions available for user in room
   */
  getRemainingReactions(userId: string, roomId: number): number {
    const userHistory = this.userHistory.get(userId);
    if (!userHistory || !userHistory[roomId]) {
      return this.MAX_REACTIONS;
    }

    const reactions = userHistory[roomId];
    const now = Date.now();

    const validReactions = reactions.filter(
      (record) => now - record.timestamp < this.WINDOW_MS
    );

    return Math.max(0, this.MAX_REACTIONS - validReactions.length);
  }

  /**
   * Clean up old user entries (older than 15 minutes of inactivity)
   */
  private cleanup(): void {
    const INACTIVITY_THRESHOLD = 15 * 60 * 1000;
    const now = Date.now();

    for (const [userId, userHistory] of this.userHistory.entries()) {
      let hasValidRooms = false;

      for (const [roomId, reactions] of Object.entries(userHistory)) {
        const validReactions = reactions.filter(
          (record: ReactionRecord) => now - record.timestamp < INACTIVITY_THRESHOLD
        );

        if (validReactions.length > 0) {
          userHistory[parseInt(roomId)] = validReactions;
          hasValidRooms = true;
        } else {
          delete userHistory[parseInt(roomId)];
        }
      }

      // Remove user if no rooms have activity
      if (!hasValidRooms) {
        this.userHistory.delete(userId);
      }
    }
  }

  /**
   * Destroy limiter and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.userHistory.clear();
  }
}

// Export singleton instance
export const emojiRateLimiter = new EmojiRateLimiter();
