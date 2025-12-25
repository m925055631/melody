import React, { useState } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
  searchResultCount?: number;
  currentSearchIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isSearching,
  searchResultCount = 0,
  currentSearchIndex = 0,
  onNavigate
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const showNavigation = searchResultCount > 1 && onNavigate;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/50">
      {/* Mobile: Vertical Stack / Desktop: Horizontal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 gap-3">

        {/* Logo & Title */}
        <div className="flex items-center gap-3 group shrink-0">
          <img
            src="/vite.svg"
            alt="米乐迪音乐"
            className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] group-hover:drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] transition-all duration-300"
          />
          <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent drop-shadow-lg select-none">
            米乐迪音乐
          </h1>
        </div>

        {/* Search Bar with Navigation */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-lg">
          <form onSubmit={handleSubmit} className="relative group flex-1">
            <div className="absolute inset-0 bg-neon-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索歌曲或歌手..."
              className="w-full bg-slate-800/80 backdrop-blur-md border border-slate-700 text-white pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 rounded-full text-sm sm:text-base focus:outline-none focus:border-neon-accent focus:ring-1 focus:ring-neon-accent transition-all shadow-xl placeholder-slate-500"
              disabled={isSearching}
            />
            <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400">
              {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            </div>
          </form>

          {/* Navigation Arrows - Only show when multiple results */}
          {showNavigation && (
            <div className="flex items-center gap-1 bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-full px-2 py-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => onNavigate('prev')}
                className="p-1 text-slate-400 hover:text-neon-accent transition-colors rounded-full hover:bg-white/10"
                title="上一首"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs text-slate-300 font-mono min-w-[40px] text-center">
                {currentSearchIndex + 1}/{searchResultCount}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('next')}
                className="p-1 text-slate-400 hover:text-neon-accent transition-colors rounded-full hover:bg-white/10"
                title="下一首"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Spacer for symmetry - Desktop only */}
        <div className="hidden sm:block w-32"></div>
      </div>
    </div>
  );
};

