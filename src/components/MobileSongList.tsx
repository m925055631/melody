import React from 'react';
import { Play, Pause, Music } from 'lucide-react';
import type { Song } from '../types';

interface MobileSongListProps {
    songs: Song[];
    currentlyPlayingId: string | null;
    onSongClick: (songId: string) => void;
    onPlayToggle: (songId: string) => void;
    searchedSongId: string | null;
}

export const MobileSongList: React.FC<MobileSongListProps> = ({
    songs,
    currentlyPlayingId,
    onSongClick,
    onPlayToggle,
    searchedSongId
}) => {
    // Sort songs by release date (newest first)
    const sortedSongs = [...songs].sort((a, b) =>
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );

    const scrollToRef = React.useRef<HTMLDivElement>(null);

    // Scroll to searched song
    React.useEffect(() => {
        if (searchedSongId && scrollToRef.current) {
            const element = document.getElementById(`mobile-song-${searchedSongId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [searchedSongId]);

    return (
        <div ref={scrollToRef} className="flex flex-col gap-2 pb-32 pt-4 px-4">
            {sortedSongs.map((song) => {
                const isPlaying = currentlyPlayingId === song.id;
                const isSearched = searchedSongId === song.id;
                const hasAudio = !!song.audioUrl;
                const year = song.releaseDate.split('-')[0];

                return (
                    <div
                        key={song.id}
                        id={`mobile-song-${song.id}`}
                        className={`
              flex items-center gap-3 p-3 rounded-xl transition-all duration-300
              ${isSearched ? 'bg-neon-accent/20 ring-2 ring-neon-accent shadow-lg shadow-neon-accent/20' : 'bg-slate-800/50'}
              ${isPlaying ? 'bg-slate-700/60' : ''}
              active:scale-[0.98]
            `}
                        onClick={() => onSongClick(song.id)}
                    >
                        {/* Cover */}
                        <div className={`
              relative w-14 h-14 rounded-lg overflow-hidden shrink-0
              ${isPlaying ? 'ring-2 ring-neon-accent' : ''}
            `}>
                            <img
                                src={song.coverUrl}
                                alt={song.title}
                                className="w-full h-full object-cover"
                            />
                            {isPlaying && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <Music className="text-neon-accent animate-pulse" size={20} />
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-medium truncate ${isPlaying ? 'text-neon-accent' : 'text-white'}`}>
                                {song.title}
                            </h3>
                            <p className="text-slate-400 text-sm truncate">{song.artist}</p>
                            <p className="text-slate-500 text-xs">{year}</p>
                        </div>

                        {/* Play Button */}
                        {hasAudio && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPlayToggle(song.id);
                                }}
                                className={`
                  w-10 h-10 rounded-full shrink-0 flex items-center justify-center transition-all
                  ${isPlaying
                                        ? 'bg-neon-accent text-slate-900'
                                        : 'bg-slate-700 text-white hover:bg-slate-600'
                                    }
                `}
                            >
                                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                            </button>
                        )}
                    </div>
                );
            })}

            {songs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <Music size={48} className="mb-4 opacity-50" />
                    <p>暂无歌曲</p>
                </div>
            )}
        </div>
    );
};
