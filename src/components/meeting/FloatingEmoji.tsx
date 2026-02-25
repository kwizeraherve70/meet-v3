import { useEffect, useRef } from 'react';
import { FloatingReaction } from './FloatingEmojis';

interface FloatingEmojiProps {
  reaction: FloatingReaction;
  onAnimationComplete: () => void;
  animationVariant?: 'bounce' | 'float' | 'spin'; // Animation style options
}

/**
 * Individual floating emoji component (Google Meet style)
 * 
 * Animation traits (inspired by Google Meet):
 * - Duration: 3 seconds (smooth and visible)
 * - bounce: Pop effect with scale 1.4 → 1, smooth upward motion, fade out
 * - float: Simple upward float without bounce
 * - spin: Bouncy upward motion with slight rotation
 * 
 * Features:
 * - Scale animation: Starts large (pop), settles to normal size
 * - Fade animation: Becomes transparent as it floats up
 * - Horizontal drift: Slight sideways movement for natural feel
 * - Enhanced shadow: Drop shadow for depth and visibility
 * - Performance: Uses will-change for GPU acceleration
 */
const FloatingEmoji = ({ 
  reaction, 
  onAnimationComplete,
  animationVariant = 'bounce'
}: FloatingEmojiProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const duration = 3000; // 3 seconds for smooth animation

    const timer = setTimeout(() => {
      onAnimationComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  // Random horizontal position with slight drift (10-90% of viewport width)
  const startX = Math.random() * 80 + 10;
  // Random horizontal drift direction (-30 to 30 pixels for natural movement)
  const drift = (Math.random() - 0.5) * 60;
  // Random rotation for personality (only for spin variant)
  const randomRotation = Math.random() * 20 - 10; // -10 to 10 degrees

  const animationMap = {
    bounce: 'emoji-bounce 3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
    float: 'float-up 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
    spin: 'emoji-bounce 3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  };

  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={containerRef}
      className="fixed pointer-events-none select-none"
      style={{
        left: `${startX}%`,
        bottom: '15%', // Start from lower portion of screen
        animation: prefersReducedMotion ? 'none' : animationMap[animationVariant],
        fontSize: '3rem', // Larger emoji for better visibility
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
        transform: `translateX(${drift}px) ${animationVariant === 'spin' ? `rotate(${randomRotation}deg)` : ''}`,
        transformOrigin: 'center center', // CRITICAL: Scale pops from center, not corner
        willChange: 'transform, opacity', // GPU acceleration
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)', // Add subtle text shadow
      }}
    >
      <span className="inline-block leading-none">{reaction.emoji}</span>
    </div>
  );
};

export default FloatingEmoji;
