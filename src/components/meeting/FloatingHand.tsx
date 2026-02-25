import { useEffect, useRef } from 'react';

export interface FloatingHandReaction {
  id: string;
  senderName: string;
  createdAt: number;
}

interface FloatingHandProps {
  reaction: FloatingHandReaction;
  onAnimationComplete: () => void;
}

/**
 * Individual floating hand component (Google Meet style)
 * 
 * Animation traits (Google Meet style):
 * - Duration: 3 seconds (smooth and visible)
 * - Pop effect with scale 1.4 → 1, smooth upward motion, fade out
 * - Enhanced shadow for depth
 * 
 * Features:
 * - Scale animation: Starts large (pop), settles to normal size
 * - Fade animation: Becomes transparent as it floats up
 * - Horizontal drift: Slight sideways movement for natural feel
 * - Shadow effect: Drop shadow for visibility
 * - Performance: Uses will-change for GPU acceleration
 */
const FloatingHand = ({ 
  reaction, 
  onAnimationComplete,
}: FloatingHandProps) => {
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

  // Check if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      ref={containerRef}
      className="fixed pointer-events-none select-none flex flex-col items-center gap-1"
      style={{
        left: `${startX}%`,
        bottom: '15%', // Start from lower portion of screen
        animation: prefersReducedMotion ? 'none' : 'emoji-bounce 3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        fontSize: '3rem', // Large hand emoji for better visibility
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
        transform: `translateX(${drift}px)`,
        transformOrigin: 'center center', // Scale pops from center
        willChange: 'transform, opacity', // GPU acceleration
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)', // Subtle text shadow
      }}
    >
      <span className="inline-block leading-none">✋</span>
      {/* Optional: Show sender name below hand */}
      <div className="text-xs text-gray-600 dark:text-gray-300 font-medium mt-1 whitespace-nowrap bg-black bg-opacity-40 px-2 py-1 rounded">
        {reaction.senderName}
      </div>
    </div>
  );
};

export default FloatingHand;
