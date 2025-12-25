import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Music, RefreshCw, Download, Check, Heart } from 'lucide-react';
import type { Song } from '../types';
import { fetchSongDetailsWithAI, likeSong, checkLiked } from '../services/backendProxy';
import { parseLRC, getCurrentLyricIndex, isLRCFormat, convertPlainToLyrics, type LyricLine } from '../utils/lrcParser';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  currentTime?: number; // 当前播放时间（秒）
  onUpdateLyrics?: (songId: string, lyrics: string) => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  song,
  currentTime = 0,
  onUpdateLyrics
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadState, setDownloadState] = useState<'idle' | 'success'>('idle');
  const currentLineRef = useRef<HTMLParagraphElement>(null);

  // Like button state
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  // Parse lyrics into structured format
  const parsedLyrics: LyricLine[] | null = song?.lyrics
    ? (isLRCFormat(song.lyrics)
      ? parseLRC(song.lyrics)
      : convertPlainToLyrics(song.lyrics))
    : null;

  // Get current lyric index based on play time
  const currentIndex = parsedLyrics ? getCurrentLyricIndex(parsedLyrics, currentTime) : -1;

  // Auto-scroll to current lyric line
  useEffect(() => {
    if (currentLineRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = currentLineRef.current;

      // Calculate scroll position to center the current line
      const containerHeight = container.clientHeight;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;

      const scrollTo = elementTop - containerHeight / 2 + elementHeight / 2;

      container.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      });
    }
  }, [currentIndex]);

  // Reset scroll when song changes or opens
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isOpen, song?.id]);

  // Check if user has already liked this song and get current like count
  useEffect(() => {
    if (isOpen && song) {
      setLikeCount(song.popularity);
      checkLiked(song.id).then(liked => {
        setIsLiked(liked);
      });
    }
  }, [isOpen, song]);

  // Handle like button click
  const handleLike = async () => {
    if (!song || isLiking || isLiked) return;

    setIsLiking(true);
    try {
      const result = await likeSong(song.id);
      if (result.liked) {
        setIsLiked(true);
        setLikeCount(result.newPopularity);
      } else if (result.alreadyLiked) {
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Failed to like song:', error);
    } finally {
      setIsLiking(false);
    }
  };

  if (!isOpen || !song) return null;

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

    setDownloadState('success');
    setTimeout(() => setDownloadState('idle'), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/95 backdrop-blur-2xl transition-opacity duration-300">
      {/* Background Ambience */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none bg-cover bg-center blur-3xl scale-125"
        style={{ backgroundImage: `url(${song.coverUrl})` }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-6">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-white tracking-tight">{song.title}</h2>
          <div className="flex items-center gap-3">
            <p className="text-neon-accent/80 font-medium">{song.artist}</p>
            <span className="text-slate-400 text-sm">•</span>
            <button
              onClick={handleLike}
              disabled={isLiking || isLiked}
              className={`flex items-center gap-1.5 text-sm transition-all duration-300 group ${isLiked
                ? 'text-rose-400 cursor-default'
                : 'text-slate-400 hover:text-rose-400'
                }`}
              title={isLiked ? '已喜欢' : '点击喜欢'}
            >
              <Heart
                size={16}
                className={`transition-all duration-300 ${isLiked ? 'fill-rose-400' : 'group-hover:scale-110'} ${isLiking ? 'animate-pulse' : ''}`}
              />
              <span className="font-medium">{likeCount}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Re-search Button */}
          <button
            onClick={handleResearchLyrics}
            disabled={isSearching}
            className={`p-2.5 rounded-full transition-all duration-300 flex items-center gap-2 ${isSearching
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
          {parsedLyrics && (
            <button
              onClick={handleDownloadLyrics}
              className={`p-2.5 rounded-full transition-all duration-300 flex items-center gap-2 ${downloadState === 'success'
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

      {/* Content */}
      <div className="flex-1 overflow-hidden relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 p-6">

        {/* Left: Album Art */}
        <div className="hidden md:block w-80 h-80 shrink-0 shadow-2xl rounded-2xl overflow-hidden border border-white/10 relative group">
          <img src={song.coverUrl} alt="Album Art" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 text-white/80 text-sm">
            {song.releaseDate.split('-')[0]}
          </div>
        </div>

        {/* Right: Lyrics with Dynamic Highlighting */}
        <div
          ref={scrollRef}
          className="w-full max-w-lg h-[60vh] overflow-y-auto no-scrollbar mask-image-gradient text-center space-y-6 px-4 pt-16"
          style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent)' }}
        >
          {!parsedLyrics ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="animate-spin text-neon-accent" size={32} />
              <p>AI 正在搜索歌词...</p>
              <p className="text-xs text-slate-600">Powered by Gemini</p>
            </div>
          ) : (
            <>
              {parsedLyrics.map((line, idx) => {
                const isCurrent = idx === currentIndex;
                const isPast = idx < currentIndex;
                const isUpcoming = idx > currentIndex && idx <= currentIndex + 2;

                return (
                  <p
                    key={idx}
                    ref={isCurrent ? currentLineRef : null}
                    className={`
                      text-lg md:text-xl leading-relaxed font-light transition-all duration-500
                      ${isCurrent
                        ? 'text-white font-medium scale-110 text-shadow-glow'
                        : isPast
                          ? 'text-slate-500'
                          : isUpcoming
                            ? 'text-slate-400'
                            : 'text-slate-600'
                      }
                    `}
                    style={{
                      textShadow: isCurrent ? '0 0 20px rgba(56, 189, 248, 0.5)' : 'none'
                    }}
                  >
                    {line.text}
                  </p>
                );
              })}

              <div className="pt-12 pb-24 text-slate-600 text-xs flex flex-col items-center gap-2">
                <Music size={12} />
                <span>End of Lyrics</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};