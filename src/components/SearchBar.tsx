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
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <form onSubmit={handleSubmit} className="relative group">
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
    </div>
  );
};
