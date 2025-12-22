
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Timeline } from './components/Timeline';
import { SearchBar } from './components/SearchBar';
import { AudioPlayer } from './components/AudioPlayer';

import { BottomPlayerBar } from './components/BottomPlayerBar';
import { LyricsModal } from './components/LyricsModal';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { VisitorStats } from './components/VisitorStats';
import { MOCK_DATABASE } from './constants';
import type { Song } from './types';
// All backend operations go through secure Worker proxy (no secrets exposed in browser)
import {
  getAllSongs,
  createSong,
  updateSong as updateSongInDB,
  searchSongWithAI,
  fetchSongDetailsWithAI,
  trackVisit,
  getVisitorStats,
  listMusicFiles,
  getPlayableUrl
} from './services/backendProxy';
import { Volume2, VolumeX, Shuffle, Repeat, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // Start with empty, we will load from Supabase
  const [songs, setSongs] = useState<Song[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [searchedSongId, setSearchedSongId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);
  const [playMode, setPlayMode] = useState<'sequential' | 'shuffle'>('sequential');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [matchedSongsCount, setMatchedSongsCount] = useState(0);
  const [visitorStats, setVisitorStats] = useState({ totalVisits: 0, activeUsers: 0 });

  // Deduplicate songs by title + artist (keep the first occurrence with audioUrl if possible)
  const deduplicateSongs = useCallback((songs: Song[]): Song[] => {
    const seen = new Map<string, Song>();

    songs.forEach(song => {
      const key = `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing) {
        // First time seeing this song
        seen.set(key, song);
      } else if (song.audioUrl && !existing.audioUrl) {
        // Replace with version that has audio
        seen.set(key, song);
      }
      // Otherwise keep the existing one
    });

    return Array.from(seen.values()).sort((a, b) =>
      new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
    );
  }, []);

  // Load data from Supabase on mount
  useEffect(() => {
    const initData = async () => {
      try {
        // Fetch songs from Supabase
        const supabaseSongs = await getAllSongs();

        if (supabaseSongs.length > 0) {
          // Data exists in Supabase - deduplicate before setting
          const uniqueSongs = deduplicateSongs(supabaseSongs);
          if (uniqueSongs.length < supabaseSongs.length) {
            console.log(`Removed ${supabaseSongs.length - uniqueSongs.length} duplicate songs`);
          }
          setSongs(uniqueSongs);
        } else {
          // First visit: Migrate mock data to Supabase
          console.log('No songs in database. Migrating initial data...');

          // Create each song via Worker API
          const createdSongs: Song[] = [];
          for (const song of MOCK_DATABASE) {
            try {
              const created = await createSong(song);
              createdSongs.push(created);
            } catch (error) {
              console.error(`Failed to create song ${song.title}:`, error);
            }
          }

          // Fetch all songs after migration
          const migratedSongs = await getAllSongs();
          const uniqueSongs = deduplicateSongs(migratedSongs);
          setSongs(uniqueSongs);
        }
      } catch (error) {
        console.error('Error loading songs from Supabase:', error);
        // Fallback to mock data if Supabase fails
        setSongs(MOCK_DATABASE);
      } finally {
        setIsDataLoaded(true);
      }
    };
    initData();
  }, [deduplicateSongs]);

  // Track visitor and get statistics (non-blocking)
  useEffect(() => {
    const trackAndGetStats = async () => {
      try {
        // Track current visit
        await trackVisit();

        // Get statistics
        const stats = await getVisitorStats();
        setVisitorStats(stats);
      } catch (error) {
        console.warn('Visitor tracking unavailable (visits table may not exist):', error);
        // Silently fail - visitor stats are optional
      }
    };

    // Don't block - run asynchronously
    trackAndGetStats();

    // Update stats every 30 seconds
    const interval = setInterval(async () => {
      try {
        const stats = await getVisitorStats();
        setVisitorStats(stats);
      } catch (error) {
        // Silently fail
        console.debug('Failed to get stats');
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Sync updated songs to Supabase when they change
  useEffect(() => {
    const syncToSupabase = async () => {
      if (!isDataLoaded || songs.length === 0) return;

      // We don't need to save all songs every time - the service layer handles individual updates
      // This is just a placeholder for future sync logic if needed
    };

    syncToSupabase();
  }, [songs, isDataLoaded]);

  // CTFile Music Sync - Smart throttling to avoid redundant syncs
  // Uses Worker API (no secrets exposed in browser)
  useEffect(() => {
    const SYNC_COOLDOWN_MS = 3600000; // 1 hour
    const LAST_SYNC_KEY = 'ctfile_last_sync';

    const shouldSync = () => {
      const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
      if (!lastSyncStr) return true;

      const lastSync = new Date(lastSyncStr);
      const now = new Date();
      const elapsed = now.getTime() - lastSync.getTime();

      return elapsed >= SYNC_COOLDOWN_MS;
    };

    // Helper to extract song info from filename like "Artist - Title.flac"
    const extractSongInfoFromFilename = (filename: string): { artist: string; title: string } | null => {
      const cleanName = filename.replace(/\.(flac|mp3|wav|m4a|ogg)$/i, '');
      const parts = cleanName.split(' - ');
      if (parts.length >= 2) {
        return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
      }
      return null;
    };

    const performSync = async () => {
      // Check if we should sync
      if (!shouldSync()) {
        const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
        console.log(`Skipping CTFile sync (last synced: ${lastSyncStr})`);
        return;
      }

      try {
        setIsSyncing(true);
        console.log('Starting CTFile sync via Worker API...');

        // Get files from CTFile via Worker
        const files = await listMusicFiles();
        if (files.length === 0) {
          console.log('No music files found in CTFile');
          setIsSyncing(false);
          return;
        }

        console.log(`Found ${files.length} files in CTFile`);

        // Match files to existing songs and update audioUrl
        let updatedCount = 0;
        const updatedSongs = await Promise.all(
          songs.map(async (song) => {
            // Skip if already has audio
            if (song.audioUrl) return song;

            // Find matching file
            const matchingFile = files.find(file => {
              const info = extractSongInfoFromFilename(file.name);
              if (!info) return false;
              return (
                info.title.toLowerCase() === song.title.toLowerCase() &&
                info.artist.toLowerCase() === song.artist.toLowerCase()
              );
            });

            if (matchingFile) {
              try {
                const audioUrl = await getPlayableUrl(matchingFile.key);
                if (audioUrl) {
                  updatedCount++;
                  console.log(`✓ Matched: ${song.title} - ${song.artist}`);

                  // Update in database
                  await updateSongInDB(song.id, { audioUrl });

                  return { ...song, audioUrl };
                }
              } catch (error) {
                console.error(`Failed to get URL for ${song.title}:`, error);
              }
            }
            return song;
          })
        );

        // Deduplicate
        const uniqueSongs = deduplicateSongs(updatedSongs);
        setSongs(uniqueSongs);

        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem(LAST_SYNC_KEY, now.toISOString());

        // Count matched songs (those with audioUrl)
        const matched = uniqueSongs.filter(s => s.audioUrl).length;
        setMatchedSongsCount(matched);

        console.log(`🎵 CTFile sync complete: ${matched}/${uniqueSongs.length} songs with audio, ${updatedCount} newly matched`);
      } catch (error) {
        console.error('CTFile sync failed:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    // Only sync once when data is loaded
    if (isDataLoaded && songs.length > 0) {
      performSync();
    }
  }, [isDataLoaded, songs.length, deduplicateSongs]); // Only re-run if data loaded or song count changes

  const currentSong = useMemo(() =>
    songs.find(s => s.id === currentlyPlayingId) || null,
    [songs, currentlyPlayingId]
  );

  // AI Fetch Effect for Lyrics & Better Cover
  useEffect(() => {
    const fetchMissingDetails = async () => {
      if (currentSong && !currentSong.lyrics) {
        console.log("Fetching details for:", currentSong.title);
        const details = await fetchSongDetailsWithAI(currentSong.title, currentSong.artist);

        if (details) {
          // Update local state
          setSongs(prev => prev.map(s => {
            if (s.id === currentSong.id) {
              let newCoverUrl = s.coverUrl;
              if (details.visualPrompt) {
                newCoverUrl = `https://picsum.photos/seed/${details.visualPrompt.replace(/\s+/g, '_')}/300/300`;
              }
              return { ...s, lyrics: details.lyrics, coverUrl: newCoverUrl };
            }
            return s;
          }));

          // Sync to Supabase
          try {
            await updateSongInDB(currentSong.id, {
              lyrics: details.lyrics,
              coverUrl: details.visualPrompt ? `https://picsum.photos/seed/${details.visualPrompt.replace(/\s+/g, '_')}/300/300` : currentSong.coverUrl
            });
          } catch (error) {
            console.error('Error updating song in Supabase:', error);
          }
        }
      }
    };

    fetchMissingDetails();
  }, [currentSong]);

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    setSearchedSongId(null); // Reset highlight

    // 1. Search local mock database first (case insensitive)
    const localMatch = songs.find(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.artist.toLowerCase().includes(query.toLowerCase())
    );

    if (localMatch) {
      setSearchedSongId(localMatch.id);
      setIsSearching(false);
      return;
    }

    // 2. If not found, use Gemini AI to find/generate it
    const aiResult = await searchSongWithAI(query);

    if (aiResult) {
      // Check if we already added it (avoid dupes by ID logic or title)
      const exists = songs.some(s => s.title === aiResult.title && s.artist === aiResult.artist);
      if (!exists) {
        try {
          // Save to Supabase
          const createdSong = await createSong(aiResult);

          // Update local state
          setSongs(prev => [...prev, createdSong].sort((a, b) =>
            new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
          ));
          setSearchedSongId(createdSong.id);
        } catch (error) {
          console.error('Error saving AI-generated song to Supabase:', error);
          // Fallback: just add to local state
          setSongs(prev => [...prev, aiResult].sort((a, b) =>
            new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
          ));
          setSearchedSongId(aiResult.id);
        }
      } else {
        const existing = songs.find(s => s.title === aiResult.title && s.artist === aiResult.artist);
        if (existing) setSearchedSongId(existing.id);
      }
    } else {
      alert("未找到歌曲,或者歌曲不在2000-2024范围内。\nSong not found or out of range.");
    }

    setIsSearching(false);
  }, [songs]);



  const handleSongEnded = useCallback(() => {
    if (!currentlyPlayingId) return;

    // Filter songs to only include those with audioUrl
    const playableSongs = songs.filter(s => s.audioUrl);

    if (playableSongs.length === 0) {
      setCurrentlyPlayingId(null);
      return;
    }

    if (playMode === 'shuffle') {
      // Pick random song from playable songs
      const randomIndex = Math.floor(Math.random() * playableSongs.length);
      setCurrentlyPlayingId(playableSongs[randomIndex].id);
    } else {
      // Sequential - find next playable song
      const currentIndex = playableSongs.findIndex(s => s.id === currentlyPlayingId);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % playableSongs.length;
        setCurrentlyPlayingId(playableSongs[nextIndex].id);
      } else {
        // Current song not in playable list, start from first playable
        setCurrentlyPlayingId(playableSongs[0].id);
      }
    }
  }, [currentlyPlayingId, playMode, songs]);

  const togglePlayMode = () => {
    setPlayMode(prev => prev === 'sequential' ? 'shuffle' : 'sequential');
  };

  const togglePlayPause = () => {
    if (currentlyPlayingId) {
      setCurrentlyPlayingId(null);
    } else if (songs.length > 0) {
      // Resume last played or start first
      setCurrentlyPlayingId(songs[0].id);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="w-screen h-screen bg-slate-900 flex flex-col items-center justify-center text-neon-accent">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p>Loading History...</p>
      </div>
    );
  }

  return (
    // Apple-style fluid gradient background with glassmorphism
    <div className="w-screen h-screen bg-slate-950 relative overflow-hidden font-sans text-slate-200">

      <div className="relative w-screen h-screen overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950">
        {/* Floating Orbs for depth */}
        <div
          className="absolute top-[10%] left-[20%] w-96 h-96 rounded-full bg-blue-500/10 blur-3xl animate-fluid-1"
        />
        <div
          className="absolute bottom-[15%] right-[25%] w-80 h-80 rounded-full bg-purple-500/10 blur-3xl animate-fluid-2"
        />
        <div
          className="absolute inset-0 bg-gradient-to-bl from-sky-600/20 via-emerald-600/10 to-transparent animate-fluid-3"
        />

        {/* Glassmorphism overlay - frosted glass effect */}
        <div className="absolute inset-0 backdrop-blur-[1px] bg-white/[0.02]" />

        {/* CTFile Sync Status */}
        <SyncStatusBadge
          isSyncing={isSyncing}
          lastSyncTime={lastSyncTime}
          matchedCount={matchedSongsCount}
          totalCount={songs.length}
        />

        {/* Dynamic Blurred Cover Background (When playing) */}
        <div
          className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 blur-3xl scale-110 pointer-events-none z-0`}
          style={{
            backgroundImage: currentSong ? `url(${currentSong.coverUrl})` : 'none',
            opacity: currentSong ? 0.2 : 0,
          }}
        />

        {/* Header / Search */}
        <SearchBar onSearch={handleSearch} isSearching={isSearching} />

        {/* Visitor Stats */}
        <VisitorStats totalVisits={visitorStats.totalVisits} activeUsers={visitorStats.activeUsers} />

        {/* Main Timeline Canvas */}
        <div className="absolute inset-0 pt-20 pb-24 z-10">
          <Timeline
            songs={songs}
            currentlyPlayingId={currentlyPlayingId}
            setCurrentlyPlayingId={setCurrentlyPlayingId}
            searchedSongId={searchedSongId}
          />
        </div>

        {/* Bottom Right Controls (Volume & Mode) - Positioned above the bottom bar */}
        <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-3">
          {/* Play Mode Toggle */}
          <button
            onClick={togglePlayMode}
            title={playMode === 'sequential' ? '顺序播放' : '随机播放'}
            className="p-3 bg-slate-800/80 backdrop-blur text-slate-300 rounded-full hover:bg-slate-700 transition-colors shadow-lg border border-slate-700 group relative"
          >
            {playMode === 'sequential' ? <Repeat size={20} /> : <Shuffle size={20} />}
          </button>

          {/* Mute Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-3 bg-slate-800/80 backdrop-blur text-slate-300 rounded-full hover:bg-slate-700 transition-colors shadow-lg border border-slate-700"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>

        {/* Bottom Player Bar */}
        <BottomPlayerBar
          currentSong={currentSong}
          isPlaying={!!currentlyPlayingId}
          onPlayToggle={togglePlayPause}
          onOpenLyrics={() => setIsLyricsModalOpen(true)}
        />

        {/* Audio Controller Logic (Hidden) */}
        <AudioPlayer
          isPlaying={!!currentlyPlayingId}
          volume={isMuted ? 0 : 0.5}
          src={currentSong?.audioUrl}
          onEnded={handleSongEnded}
        />

        {/* Modals */}
        <LyricsModal
          isOpen={isLyricsModalOpen}
          onClose={() => setIsLyricsModalOpen(false)}
          song={currentSong}
        />

      </div>
    </div>
  );
};

export default App;