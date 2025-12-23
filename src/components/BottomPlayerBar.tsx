import React, { useState, useRef, useCallback } from 'react';
import { Play, Pause, ChevronUp, Download, Check, Loader2, SkipForward } from 'lucide-react';
import type { Song } from '../types';

interface BottomPlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onOpenLyrics: () => void;
  onNextSong?: () => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
}

// Format seconds to mm:ss
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentSong,
  isPlaying,
  onPlayToggle,
  onOpenLyrics,
  onNextSong,
  currentTime = 0,
  duration = 0,
  onSeek
}) => {
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'success'>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // Calculate time position from mouse/touch event - MUST be before any early returns
  const calculateSeekTime = useCallback((clientX: number): number => {
    if (!progressRef.current || !duration) return 0;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return percent * duration;
  }, [duration]);

  // Early return AFTER all hooks
  if (!currentSong) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle click on progress bar
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (onSeek && duration > 0) {
      const seekTime = calculateSeekTime(e.clientX);
      onSeek(seekTime);
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    if (onSeek && duration > 0) {
      onSeek(calculateSeekTime(clientX));
    }

    // Add global listeners
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const moveClientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      if (onSeek && duration > 0) {
        onSeek(calculateSeekTime(moveClientX));
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleUp);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentSong.audioUrl || downloadState !== 'idle') return;

    try {
      setDownloadState('downloading');

      // Fetch the audio file
      const response = await fetch(currentSong.audioUrl);
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentSong.artist} - ${currentSong.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success state
      setDownloadState('success');

      // Reset after 2 seconds
      setTimeout(() => {
        setDownloadState('idle');
      }, 2000);
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadState('idle');
    }
  };

  const getDownloadIcon = () => {
    switch (downloadState) {
      case 'downloading':
        return <Loader2 size={18} className="animate-spin" />;
      case 'success':
        return <Check size={18} />;
      default:
        return <Download size={18} />;
    }
  };

  const getDownloadButtonClasses = () => {
    const base = "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 relative group/download";

    switch (downloadState) {
      case 'downloading':
        return `${base} bg-slate-700 text-neon-accent animate-pulse`;
      case 'success':
        return `${base} bg-green-500/20 text-green-400 scale-110`;
      default:
        return `${base} bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-neon-accent hover:scale-105 active:scale-95`;
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 w-full z-[60] px-4 pb-4 pt-2"
    >
      <div className="max-w-3xl mx-auto">
        {/* Progress Bar - Above the player bar */}
        <div
          ref={progressRef}
          className={`relative h-1.5 bg-slate-700/50 rounded-full mb-2 cursor-pointer group ${isDragging ? 'h-2' : 'hover:h-2'} transition-all`}
          onClick={handleProgressClick}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          {/* Progress Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-neon-accent to-sky-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          {/* Drag Handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg shadow-black/30 transition-all ${isDragging ? 'scale-125' : 'opacity-0 group-hover:opacity-100 scale-100'}`}
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        {/* Time Display */}
        <div className="flex justify-between text-xs text-slate-400 mb-2 px-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Main Player Bar */}
        <div
          className="bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex items-center justify-between p-3 cursor-pointer group hover:bg-slate-800/80 transition-colors"
          onClick={onOpenLyrics}
        >
          {/* Left: Info */}
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`relative w-10 h-10 rounded-full overflow-hidden border border-slate-600 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
              <img src={currentSong.coverUrl} alt="cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronUp size={16} className="text-white" />
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <h4 className="text-white text-sm font-bold truncate pr-4">{currentSong.title}</h4>
              <p className="text-slate-400 text-xs truncate">{currentSong.artist}</p>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 sm:gap-3 pr-2">
            {/* Download Button - Only show if song has audio */}
            {currentSong.audioUrl && (
              <button
                onClick={handleDownload}
                disabled={downloadState !== 'idle'}
                className={getDownloadButtonClasses()}
                title={downloadState === 'downloading' ? '下载中...' : downloadState === 'success' ? '下载完成!' : '下载歌曲'}
              >
                {getDownloadIcon()}

                {/* Tooltip */}
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-xs text-white rounded opacity-0 group-hover/download:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {downloadState === 'downloading' ? '下载中...' : downloadState === 'success' ? '完成!' : '下载'}
                </span>

                {/* Success ripple effect */}
                {downloadState === 'success' && (
                  <span className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" />
                )}
              </button>
            )}

            {/* Play/Pause Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayToggle();
              }}
              className="w-10 h-10 rounded-full bg-neon-accent hover:bg-sky-400 text-slate-900 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-neon-accent/20"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
            </button>

            {/* Next Song Button */}
            {onNextSong && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNextSong();
                }}
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-neon-accent flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                title="下一首"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};