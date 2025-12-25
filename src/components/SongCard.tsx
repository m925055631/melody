

import React, { useState } from 'react';
import type { Song } from '../types';
import { Play, Pause, Music, Download } from 'lucide-react';

interface SongCardProps {
  song: Song;
  isPlaying: boolean;
  onPlayToggle: () => void;
  isHovered: boolean;
  position?: 'up' | 'down';
  onRefreshUrl?: () => Promise<string | null>; // For refreshing expired URLs
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  isPlaying,
  onPlayToggle,
  isHovered,
  position = 'up',
  onRefreshUrl
}) => {
  const isUp = position === 'up';
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!song.audioUrl || isDownloading) return;

    setIsDownloading(true);
    let audioUrl = song.audioUrl;

    try {
      // Check if URL might be expired (CTFile URLs expire after 24 hours)
      // If we have a refresh function and the song has audioUrlUpdatedAt, check expiration
      if (onRefreshUrl && song.audioUrlUpdatedAt) {
        const updatedAt = new Date(song.audioUrlUpdatedAt).getTime();
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        if (now - updatedAt >= TWENTY_FOUR_HOURS) {
          console.log('[Download] URL expired, refreshing...');
          const newUrl = await onRefreshUrl();
          if (newUrl) {
            audioUrl = newUrl;
            console.log('[Download] URL refreshed successfully');
          } else {
            throw new Error('无法刷新下载链接');
          }
        }
      }

      // Fetch the audio file
      const response = await fetch(audioUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.artist} - ${song.title}.flac`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download song:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      alert(`下载失败：${errorMessage}\n\n请检查网络连接或稍后重试。`);
    } finally {
      setIsDownloading(false);
    }
  };

  // Dynamic styles for the card expansion effect
  // Card positioned closer to dot with padding for smooth hover transition
  const containerClasses = `
    absolute left-1/2 -translate-x-1/2 
    transition-all duration-300 ease-out
    flex flex-col items-center
    ${isUp ? 'bottom-2 origin-bottom pb-2' : 'top-2 origin-top pt-2'}
    ${isHovered ? 'w-60 h-auto scale-100 opacity-100 pointer-events-auto' : 'w-0 h-0 scale-0 opacity-0 pointer-events-none'}
  `;

  // Triangle styles - adjusted for closer positioning
  const triangleUpStyle = "w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-slate-900/95 translate-y-[1px]";
  const triangleDownStyle = "w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/95 translate-y-[-1px]";

  return (
    <div className={containerClasses}>
      {/* If pointing DOWN (card is below), Triangle comes first */}
      {!isUp && <div className={triangleUpStyle}></div>}

      {/* The Card - Simplified for performance */}
      <div className="bg-slate-900/95 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg w-full p-3 flex flex-col gap-2 relative">

        {/* Album Art with Play Button Overlay - Reduced height from aspect-square to h-32 */}
        <div className="relative group w-full h-32 rounded-lg overflow-hidden bg-slate-800 shadow-inner shrink-0">
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayToggle();
              }}
              className="w-12 h-12 rounded-full bg-neon-accent/90 hover:bg-neon-accent text-white flex items-center justify-center transform hover:scale-110 transition-all shadow-lg"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
          </div>

          {/* Download Button (Top Right) - Only show if audioUrl exists */}
          {song.audioUrl && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={handleDownload}
                title={isDownloading ? "下载中..." : "下载歌曲"}
                disabled={isDownloading}
                className="p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors border border-white/20 relative disabled:opacity-75 disabled:cursor-wait"
              >
                {isDownloading ? (
                  <div className="w-[14px] h-[14px] relative">
                    <div className="absolute inset-0 border-2 border-white/20 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-t-white rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <Download size={14} />
                )}
              </button>
            </div>
          )}

        </div>

        {/* Info */}
        <div className="text-left relative z-10">
          <h3 className="text-white font-bold text-base truncate leading-tight tracking-wide">{song.title}</h3>
          <p className="text-neon-accent text-xs font-medium truncate mt-0.5">{song.artist}</p>

          <div className="w-full h-[1px] bg-slate-700/50 my-1.5"></div>

          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>{song.releaseDate}</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Music size={8} />
              {song.popularity} 热度
            </span>
          </div>

          {song.description && (
            <p className="mt-1.5 text-[10px] text-slate-500 line-clamp-2 leading-relaxed tracking-wide">
              {song.description}
            </p>
          )}


        </div>
      </div>

      {/* If pointing UP (card is above), Triangle comes last */}
      {isUp && <div className={triangleDownStyle}></div>}
    </div>
  );
};
