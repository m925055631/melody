import React, { useEffect, useRef } from 'react';
import { X, Loader2, Music } from 'lucide-react';
import type { Song } from '../types';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({ isOpen, onClose, song }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
          <p className="text-neon-accent/80 font-medium">{song.artist}</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 p-6">
        
        {/* Left: Album Art (Hidden on small screens if needed, but good for aesthetics) */}
        <div className="hidden md:block w-80 h-80 shrink-0 shadow-2xl rounded-2xl overflow-hidden border border-white/10 relative group">
          <img src={song.coverUrl} alt="Album Art" className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
           <div className="absolute bottom-4 left-4 text-white/80 text-sm">
             {song.releaseDate.split('-')[0]}
           </div>
        </div>

        {/* Right: Lyrics */}
        <div 
          ref={scrollRef}
          className="w-full max-w-lg h-[60vh] overflow-y-auto no-scrollbar mask-image-gradient text-center space-y-6 px-4"
          style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
        >
          {!lyricsLines ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="animate-spin text-neon-accent" size={32} />
              <p>AI 正在搜索歌词并生成艺术封面...</p>
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