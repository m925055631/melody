
import React, { useState, useRef } from 'react';
import type { Song } from '../types';
import { SongCard } from './SongCard';

interface TimelineNodeProps {
  song: Song;
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  x: number;
  y: number;
  mousePos: { x: number, y: number } | null;
  containerHeight: number;
  isSearched: boolean;
  onRefreshUrl?: () => Promise<string | null>;
}

const TimelineNodeComponent: React.FC<TimelineNodeProps> = ({
  song,
  currentlyPlayingId,
  setCurrentlyPlayingId,
  x,
  y,
  mousePos,
  containerHeight,
  isSearched,
  onRefreshUrl
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Freeze mechanism for stable node selection
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenOffset, setFrozenOffset] = useState(0);
  const freezeTimeoutRef = useRef<number | null>(null);

  const isPlaying = currentlyPlayingId === song.id;

  // Use the passed-in Y percentage directly
  const bottomPercent = y;

  // Decide card direction based on vertical position
  // If node is high up (> 55%), show card downwards to avoid clipping
  const cardPosition = bottomPercent > 55 ? 'down' : 'up';

  // Magnetic repulsion effect with freeze for stable clicking
  let yOffset = 0;
  // Disable repulsion when hovering over this node to prevent jittering
  if (mousePos && containerHeight > 0 && !isHovered) {
    if (isFrozen) {
      // Use frozen offset when locked
      yOffset = frozenOffset;
    } else {
      // Convert node's bottom percentage to absolute Y position
      const nodeY = containerHeight * (1 - bottomPercent / 100);
      const nodeX = x;

      // Calculate distance from cursor to node
      const dx = mousePos.x - nodeX;
      const dy = mousePos.y - nodeY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const REPULSION_RADIUS = 120; // Reduced from 200 to 120 for less aggressive repulsion
      const MAX_DISPLACEMENT = 25; // Reduced from 50 to 25 to prevent excessive movement

      if (distance < REPULSION_RADIUS && distance > 0) {
        // Calculate repulsion intensity (1 at center, 0 at edge)
        const intensity = 1 - (distance / REPULSION_RADIUS);

        // Calculate direction (positive = push down, negative = push up)
        const direction = dy > 0 ? 1 : -1;

        // Apply displacement (exponential curve for smoother feel)
        yOffset = direction * intensity * intensity * MAX_DISPLACEMENT;

        // Freeze the position to allow clicking - increased timeout for more stability
        setFrozenOffset(yOffset);
        setIsFrozen(true);

        // Clear any existing timeout
        if (freezeTimeoutRef.current) {
          clearTimeout(freezeTimeoutRef.current);
        }

        // Unfreeze after 5 seconds (increased from 3s for better stability)
        freezeTimeoutRef.current = setTimeout(() => {
          setIsFrozen(false);
          setFrozenOffset(0);
        }, 5000);
      }
    }
  }

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (freezeTimeoutRef.current) {
        clearTimeout(freezeTimeoutRef.current);
      }
    };
  }, []);

  const handlePlayToggle = () => {
    // Prevent playback if no audio URL
    if (!song.audioUrl) {
      return;
    }

    if (isPlaying) {
      setCurrentlyPlayingId(null);
    } else {
      setCurrentlyPlayingId(song.id);
    }
  };

  return (
    <div
      ref={nodeRef}
      // Critical change: z-index must be very high on hover to overlay neighbors
      className={`absolute transition-all ease-out ${isHovered ? 'z-[100]' : 'z-10'}`}
      style={{
        left: `${x}px`,
        bottom: `${bottomPercent}%`,
        transform: `translateY(${-yOffset}px)`,
        transitionDuration: '0.3s',
        transitionProperty: 'transform, z-index'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The Visual Node (Dot & Line) */}
      <div className="flex flex-col items-center cursor-pointer group">
        {/* Title (Small, initially visible) - Hide if card is open to avoid clutter */}
        <span
          className={`
            mb-3 text-sm font-medium tracking-wide whitespace-nowrap 
            transition-all duration-300 select-none pointer-events-none drop-shadow-lg
            ${isHovered ? 'opacity-0 -translate-y-2' : 'opacity-95 text-white'}
            ${isPlaying ? 'text-cyan-300 opacity-100 font-bold' : ''}
          `}
        >
          {song.title}
        </span>

        {/* The Beautified Dot - Star/Orb effect */}
        <div className="relative flex items-center justify-center">
          {/* Search Highlight - Large Pulsing Glow */}
          {isSearched && (
            <div className="absolute w-20 h-20 rounded-full bg-cyan-400/30 blur-xl animate-pulse" />
          )}

          {/* Outer Glow Ring */}
          <div className={`
             absolute rounded-full transition-all duration-500
             ${isHovered || isPlaying ? 'w-12 h-12 bg-neon-accent/20 blur-md' : 'w-0 h-0 opacity-0'}
             ${isSearched ? 'w-16 h-16 bg-cyan-400/40 blur-lg' : ''}
             ${!song.audioUrl ? 'opacity-30' : ''}
          `} />

          {/* Inner Halo */}
          <div className={`
             absolute rounded-full transition-all duration-300 border
             ${isSearched ? 'w-10 h-10 scale-100 opacity-100 border-cyan-400 animate-pulse' : ''}
             ${!isSearched && (isHovered || isPlaying) ? 'w-8 h-8 scale-100 opacity-100 border-neon-accent/50' : ''}
             ${!isSearched && !isHovered && !isPlaying ? 'w-4 h-4 scale-0 opacity-0' : ''}
             ${!song.audioUrl ? 'opacity-30' : ''}
          `} />

          {/* Core Dot */}
          <div
            className={`
              relative w-3 h-3 rounded-full 
              transition-all duration-300 
              ${isSearched ? 'w-4 h-4 bg-cyan-400 scale-125 shadow-[0_0_40px_rgba(34,211,238,1)] animate-pulse' : ''}
              ${!isSearched && isHovered ? 'bg-white scale-125 shadow-[0_0_30px_rgba(255,255,255,1)]' : ''}
              ${!isSearched && !isHovered ? 'bg-cyan-200 shadow-[0_0_20px_rgba(165,243,252,0.8)]' : ''}
              ${isPlaying ? 'bg-cyan-400 animate-pulse shadow-[0_0_35px_rgba(34,211,238,1)]' : ''}
              ${!song.audioUrl ? 'opacity-40' : 'opacity-100'}
            `}
          />
        </div>
      </div>

      {/* Expanded Details Card */}
      <SongCard
        song={song}
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        isHovered={isHovered}
        position={cardPosition}
        onRefreshUrl={onRefreshUrl}
      />
    </div>
  );
};
// Memoize component
export const TimelineNode = React.memo(TimelineNodeComponent, (prevProps, nextProps) => {
  return (
    prevProps.song.id === nextProps.song.id &&
    prevProps.currentlyPlayingId === nextProps.currentlyPlayingId &&
    prevProps.isSearched === nextProps.isSearched &&
    prevProps.x === nextProps.x &&
    prevProps.y === nextProps.y
  );
});
