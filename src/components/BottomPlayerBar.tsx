import React from 'react';
import { Play, Pause, ChevronUp } from 'lucide-react';
import type { Song } from '../types';

interface BottomPlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onOpenLyrics: () => void;
}

export const BottomPlayerBar: React.FC<BottomPlayerBarProps> = ({
  currentSong,
  isPlaying,
  onPlayToggle,
  onOpenLyrics
}) => {
  if (!currentSong) return null;

  return (
    <div 
      className="fixed bottom-0 left-0 w-full z-[60] px-4 pb-4 pt-2"
    >
      <div 
        className="max-w-3xl mx-auto bg-slate-900/70 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex items-center justify-between p-3 cursor-pointer group hover:bg-slate-800/80 transition-colors"
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
        <div className="flex items-center gap-4 pr-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onPlayToggle();
            }}
            className="w-10 h-10 rounded-full bg-neon-accent hover:bg-sky-400 text-slate-900 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-neon-accent/20"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};