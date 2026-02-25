import { useState, useEffect } from 'react';
import FloatingHand, { FloatingHandReaction } from './FloatingHand';

export type { FloatingHandReaction };

interface FloatingHandsProps {
  hands: FloatingHandReaction[];
  onRemoveHand: (id: string) => void;
}

/**
 * Container component for floating hand reactions (Google Meet style)
 * 
 * Features:
 * - Manages lifecycle of floating hands
 * - Supports multiple concurrent hands
 * - Handles cleanup after animation
 * - Shows sender name for each hand
 * 
 * Performance:
 * - Uses pointer-events-none for non-blocking rendering
 * - Overhead: O(n) where n = concurrent hands
 * - Typical: 1-3 concurrent hands at any time
 */
const FloatingHands = ({ 
  hands, 
  onRemoveHand,
}: FloatingHandsProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
      {hands.map((hand) => (
        <div key={hand.id}>
          <FloatingHand
            reaction={hand}
            onAnimationComplete={() => onRemoveHand(hand.id)}
          />
        </div>
      ))}
    </div>
  );
};

export default FloatingHands;
