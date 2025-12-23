
import React, { useState, memo } from 'react';
import type { Song } from '../types';
import { SongCard } from './SongCard';

interface TimelineNodeProps {
  song: Song;
  currentlyPlayingId: string | null;
  onPlayToggle: (id: string) => void;
  x: number;
  y: number;
  isSearched: boolean;
  zoomLevel: number;
}

// Memoized component to prevent unnecessary re-renders
export const TimelineNode: React.FC<TimelineNodeProps> = memo(({
  song,
  currentlyPlayingId,
  onPlayToggle,
  x,
  y,
  isSearched,
  zoomLevel
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const isPlaying = currentlyPlayingId === song.id;
  const bottomPercent = y;

  // Scale compensation: nodes and cards always stay same size
  const nodeInverseScale = 1 / zoomLevel;
  const cardInverseScale = 1 / zoomLevel;

  // Decide card direction based on vertical position
  const cardPosition = bottomPercent > 40 ? 'down' : 'up';

  const handlePlayToggle = () => {
    if (!song.audioUrl) return;
    onPlayToggle(song.id);
  };

  return (
    <div
      className={`absolute ${isHovered ? 'z-[100]' : 'z-10'}`}
      style={{
        left: `${x}px`,
        bottom: `${bottomPercent}%`,
        // Smaller padding for hover area - just enough to reach the card
        padding: '20px',
        margin: '-20px'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* The Visual Node (Dot & Line) - Capped at 300% zoom */}
      <div
        className="flex flex-col items-center cursor-pointer group"
        style={{ transform: `scale(${nodeInverseScale})` }}
      >
        {/* Title - Hidden by default, shows when zoomed in enough (zoomLevel > 1.5) or when searched */}
        <span
          className={`
            mb-3 text-sm font-medium tracking-wide whitespace-nowrap 
            transition-all duration-300 select-none pointer-events-none drop-shadow-lg
            ${isHovered && !isSearched ? 'opacity-0 -translate-y-2' : ''}
            ${isPlaying && !isHovered ? 'text-cyan-300 font-bold' : ''}
            ${isSearched ? 'text-cyan-300 font-bold' : 'text-white'}
          `}
          style={{
            // Always show title when searched, otherwise based on zoom level
            opacity: isHovered && !isSearched ? 0 : (isSearched ? 1 : (zoomLevel > 1.5 ? Math.min(0.95, (zoomLevel - 1.5) / 1) : 0))
          }}
        >
          {song.title}
        </span>

        {/* The Beautified Dot - Simplified for performance */}
        <div className="relative flex items-center justify-center">
          {/* Search Highlight - Simple ring instead of blur */}
          {isSearched && (
            <div className="absolute w-12 h-12 rounded-full border-2 border-cyan-400/50 animate-ping" />
          )}

          {/* Outer Glow Ring - No blur */}
          <div className={`
             absolute rounded-full transition-all duration-300
             ${isHovered || isPlaying ? 'w-8 h-8 bg-neon-accent/20' : 'w-0 h-0 opacity-0'}
             ${isSearched ? 'w-10 h-10 bg-cyan-400/30' : ''}
             ${!song.audioUrl ? 'opacity-30' : ''}
          `} />

          {/* Inner Halo - Simplified */}
          <div className={`
             absolute rounded-full transition-all duration-200 border
             ${isSearched ? 'w-6 h-6 border-cyan-400' : ''}
             ${!isSearched && (isHovered || isPlaying) ? 'w-5 h-5 border-neon-accent/50' : ''}
             ${!isSearched && !isHovered && !isPlaying ? 'w-0 h-0 opacity-0' : ''}
             ${!song.audioUrl ? 'opacity-30' : ''}
          `} />

          {/* Core Dot - Reduced shadow size */}
          <div
            className={`
              relative w-3 h-3 rounded-full transition-all duration-200
              ${isSearched ? 'w-4 h-4 bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : ''}
              ${!isSearched && isHovered ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : ''}
              ${!isSearched && !isHovered ? 'bg-cyan-200 shadow-[0_0_6px_rgba(165,243,252,0.6)]' : ''}
              ${isPlaying ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : ''}
              ${!song.audioUrl ? 'opacity-40' : 'opacity-100'}
            `}
          />
        </div>
      </div>

      {/* Expanded Details Card - Always show when searched or hovered */}
      <div style={{ transform: `scale(${cardInverseScale})`, transformOrigin: 'top center' }}>
        <SongCard
          song={song}
          isPlaying={isPlaying}
          onPlayToggle={handlePlayToggle}
          isHovered={isHovered || isSearched}
          position={cardPosition}
        />
      </div>
    </div>
  );
});
