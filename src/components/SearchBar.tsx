import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isSearching }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4">
      {/* Logo & Title - Left */}
      <div className="flex items-center gap-3 group">
        <img
          src="/vite.svg"
          alt="米乐迪音乐"
          className="w-8 h-8 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] group-hover:drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] transition-all duration-300"
        />
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent drop-shadow-lg select-none">
          米乐迪音乐
        </h1>
      </div>

      {/* Search Bar - Center */}
      <form onSubmit={handleSubmit} className="relative group flex-1 max-w-md mx-auto">
        <div className="absolute inset-0 bg-neon-accent/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索歌曲 / Search Songs..."
          className="w-full bg-slate-900/80 backdrop-blur-md border border-slate-700 text-white pl-12 pr-4 py-3 rounded-full focus:outline-none focus:border-neon-accent focus:ring-1 focus:ring-neon-accent transition-all shadow-xl placeholder-slate-500"
          disabled={isSearching}
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
        </div>
      </form>

      {/* Spacer for symmetry - Right */}
      <div className="w-32"></div>
    </div>
  );
};
