import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Music, RefreshCw, Download, Check } from 'lucide-react';
import type { Song } from '../types';
import { fetchSongDetailsWithAI } from '../services/backendProxy';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onUpdateLyrics?: (songId: string, lyrics: string) => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({ isOpen, onClose, song, onUpdateLyrics }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadState, setDownloadState] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    // Reset scroll when song changes or opens
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isOpen, song?.id]);

  if (!isOpen || !song) return null;

  // Formatting lyrics
  const lyricsLines = song.lyrics
    ? song.lyrics.split('\n').filter(line => line.trim() !== '')
    : null;

  // Re-search lyrics with AI
  const handleResearchLyrics = async () => {
    if (isSearching || !song) return;

    setIsSearching(true);
    try {
      const result = await fetchSongDetailsWithAI(song.title, song.artist);
      if (result?.lyrics && onUpdateLyrics) {
        onUpdateLyrics(song.id, result.lyrics);
      }
    } catch (error) {
      console.error('Failed to re-search lyrics:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Download lyrics as text file
  const handleDownloadLyrics = () => {
    if (!song.lyrics) return;

    const content = `${song.title} - ${song.artist}\n\n${song.lyrics}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${song.artist} - ${song.title} 歌词.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    // Show success feedback
    setDownloadState('success');
    setTimeout(() => setDownloadState('idle'), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900 md:bg-slate-900/95 transition-opacity duration-300">
      {/* Background Ambience - Optimized for mobile to prevent flickering */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none bg-cover bg-center blur-xl md:blur-3xl scale-110 md:scale-125"
        style={{
          backgroundImage: `url(${song.coverUrl})`,
          transform: 'translateZ(0)',
          willChange: 'auto',
          backfaceVisibility: 'hidden'
        }}
      />

      {/* Header - Compact on mobile */}
      <div className="relative z-10 flex items-center justify-between p-4 md:p-6">
        <div className="flex flex-col min-w-0 flex-1 mr-3">
          <h2 className="text-lg md:text-2xl font-bold text-white tracking-tight truncate">{song.title}</h2>
          <p className="text-neon-accent/80 font-medium text-sm md:text-base truncate">{song.artist}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Re-search Button */}
          <button
            onClick={handleResearchLyrics}
            disabled={isSearching}
            className={`p-2 md:p-2.5 rounded-full transition-all duration-300 flex items-center gap-2 ${isSearching
              ? 'bg-neon-accent/20 text-neon-accent'
              : 'bg-white/10 hover:bg-white/20 text-white hover:text-neon-accent'
              }`}
            title="重新搜索歌词"
          >
            <RefreshCw size={18} className={isSearching ? 'animate-spin' : ''} />
            <span className="text-sm hidden sm:inline">
              {isSearching ? '搜索中...' : '重新搜索'}
            </span>
          </button>

          {/* Download Button */}
          {lyricsLines && (
            <button
              onClick={handleDownloadLyrics}
              className={`p-2 md:p-2.5 rounded-full transition-all duration-300 flex items-center gap-2 ${downloadState === 'success'
                ? 'bg-green-500/20 text-green-400 scale-105'
                : 'bg-white/10 hover:bg-white/20 text-white hover:text-neon-accent'
                }`}
              title="下载歌词"
            >
              {downloadState === 'success' ? <Check size={18} /> : <Download size={18} />}
              <span className="text-sm hidden sm:inline">
                {downloadState === 'success' ? '已下载' : '下载歌词'}
              </span>
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Content - Larger lyrics area */}
      <div className="flex-1 overflow-hidden relative z-10 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 px-4 md:p-6">

        {/* Left: Album Art (Hidden on small screens if needed, but good for aesthetics) */}
        <div className="hidden md:block w-72 lg:w-80 h-72 lg:h-80 shrink-0 shadow-2xl rounded-2xl overflow-hidden border border-white/10 relative group">
          <img src={song.coverUrl} alt="Album Art" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 text-white/80 text-sm">
            {song.releaseDate.split('-')[0]}
          </div>
        </div>

        {/* Right: Lyrics - Expanded height for better reading */}
        <div
          ref={scrollRef}
          className="w-full max-w-lg h-[calc(100vh-140px)] md:h-[75vh] overflow-y-auto no-scrollbar text-center space-y-5 md:space-y-6 px-4"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)',
            transform: 'translateZ(0)',
            willChange: 'scroll-position'
          }}
        >
          {!lyricsLines ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="animate-spin text-neon-accent" size={32} />
              <p>AI 正在搜索歌词...</p>
              <p className="text-xs text-slate-600">Powered by Gemini</p>
            </div>
          ) : (
            lyricsLines.map((line, idx) => (
              <p
                key={idx}
                className="text-lg md:text-xl text-slate-300 hover:text-white transition-colors duration-300 leading-relaxed font-light"
              >
                {line}
              </p>
            ))
          )}

          {lyricsLines && (
            <div className="pt-12 pb-24 text-slate-600 text-xs flex flex-col items-center gap-2">
              <Music size={12} />
              <span>End of Lyrics</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};