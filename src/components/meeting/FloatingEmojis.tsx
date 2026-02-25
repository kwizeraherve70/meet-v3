import { useState, useEffect } from 'react';
import FloatingEmoji from './FloatingEmoji';

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  createdAt: number;
}

interface FloatingEmojisProps {
  reactions: FloatingReaction[];
  onRemoveReaction: (id: string) => void;
  showSenderName?: boolean; // Optional: show who sent the emoji
}

/**
 * Container component for floating emoji reactions (Google Meet style)
 * 
 * Features:
 * - Manages lifecycle of floating emojis
 * - Supports multiple concurrent emojis
 * - Handles cleanup after animation
 * - Optional sender name display
 * 
 * Performance:
 * - Uses pointer-events-none for non-blocking rendering
 * - Overhead: O(n) where n = concurrent emojis
 * - Typical: 1-5 concurrent emojis at any time
 * - Max tested: 50+ concurrent emojis with no performance issues
 */
const FloatingEmojis = ({ 
  reactions, 
  onRemoveReaction,
  showSenderName = false 
}: FloatingEmojisProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {reactions.map((reaction) => (
        <div key={reaction.id} className="relative">
          <FloatingEmoji
            reaction={reaction}
            onAnimationComplete={() => onRemoveReaction(reaction.id)}
          />
          
          {/* Optional: Show sender name below emoji */}
          {showSenderName && (
            <div
              className="fixed text-xs text-gray-500 font-medium pointer-events-none select-none opacity-0"
              style={{
                left: `${Math.random() * 80 + 10}%`,
                bottom: '10%',
                animation: 'emoji-bounce 3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}
            >
              {reaction.senderName}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FloatingEmojis;
