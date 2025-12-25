
import React, { useState } from 'react';
import type { Song } from '../types';
import { SongCard } from './SongCard';

interface TimelineNodeProps {
  song: Song;
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  x: number;
  y: number;
  isSearched: boolean;
  onRefreshUrl?: () => Promise<string | null>;
}

const TimelineNodeComponent: React.FC<TimelineNodeProps> = ({
  song,
  currentlyPlayingId,
  setCurrentlyPlayingId,
  x,
  y,
  isSearched,
  onRefreshUrl
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const isPlaying = currentlyPlayingId === song.id;

  // Use the passed-in Y percentage directly
  const bottomPercent = y;

  // Decide card direction based on vertical position
  // If node is high up (> 55%), show card downwards to avoid clipping
  const cardPosition = bottomPercent > 55 ? 'down' : 'up';

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
      // Critical change: z-index must be very high on hover to overlay neighbors
      className={`absolute transition-all ease-out ${isHovered ? 'z-[100]' : 'z-10'}`}
      style={{
        left: `${x}px`,
        bottom: `${bottomPercent}%`,
        transitionDuration: '0.3s',
        transitionProperty: 'z-index'
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

        {/* The Simplified Dot - Optimized for performance */}
        <div className="relative flex items-center justify-center">
          {/* Search Highlight - Simpler glow without blur */}
          {isSearched && (
            <div className="absolute w-12 h-12 rounded-full bg-cyan-400/40 animate-pulse" />
          )}

          {/* Outer Ring - Only on hover/playing, no blur */}
          <div className={`
             absolute rounded-full transition-all duration-300
             ${isHovered || isPlaying ? 'w-8 h-8 bg-neon-accent/30' : 'w-0 h-0 opacity-0'}
             ${isSearched ? 'w-10 h-10 bg-cyan-400/50' : ''}
             ${!song.audioUrl ? 'opacity-30' : ''}
          `} />

          {/* Core Dot - Simplified shadows */}
          <div
            className={`
              relative w-3 h-3 rounded-full 
              transition-all duration-200 
              ${isSearched ? 'w-4 h-4 bg-cyan-400 scale-125' : ''}
              ${!isSearched && isHovered ? 'bg-white scale-125' : ''}
              ${!isSearched && !isHovered ? 'bg-cyan-200' : ''}
              ${isPlaying ? 'bg-cyan-400 scale-110' : ''}
              ${!song.audioUrl ? 'opacity-40' : 'opacity-100'}
            `}
            style={{
              boxShadow: isSearched || isPlaying
                ? '0 0 12px rgba(34, 211, 238, 0.8)'
                : isHovered
                  ? '0 0 10px rgba(255, 255, 255, 0.6)'
                  : '0 0 6px rgba(165, 243, 252, 0.5)'
            }}
          />
        </div>
      </div>

      {/* Expanded Details Card - Only render when hovered or playing for performance */}
      {(isHovered || isPlaying) && (
        <SongCard
          song={song}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          isHovered={isHovered}
          position={cardPosition}
          onRefreshUrl={onRefreshUrl}
        />
      )}
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
