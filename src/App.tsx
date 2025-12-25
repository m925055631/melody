
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Timeline } from './components/Timeline';
import { SearchBar } from './components/SearchBar';
import { AudioPlayer } from './components/AudioPlayer';

import { BottomPlayerBar } from './components/BottomPlayerBar';
import { LyricsModal } from './components/LyricsModal';
import { VisitorStats } from './components/VisitorStats';
import { MobileSongList } from './components/MobileSongList';
import type { Song } from './types';
// All backend operations go through secure Worker proxy (no secrets exposed in browser)
import {
  getAllSongs,
  createSong,
  updateSong as updateSongInDB,
  searchSongWithAI,
  fetchSongDetailsWithAI,
  enrichSongMetadata,
  trackVisit,
  getVisitorStats,
  listMusicFiles,
  getPlayableUrl,
  isAudioUrlExpired
} from './services/backendProxy';
import { ctfileRateLimiter } from './utils/rateLimiter';
import { Volume2, VolumeX, Shuffle, Repeat, Repeat1, Loader2 } from 'lucide-react';

// ============================================================================
// Standalone Repair Function - Call from browser console: window.repairMissingFileIds()
// ============================================================================
const extractSongInfoFromFilename = (filename: string): { artist: string; title: string } | null => {
  const cleanName = filename.replace(/\.(flac|mp3|wav|m4a|ogg|wma)$/i, '');

  // Try " - " first (standard format: Title - Artist)
  let parts = cleanName.split(' - ');
  if (parts.length >= 2) {
    return { title: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() };
  }

  // Try "-" without spaces (Format: Title-Artist)
  parts = cleanName.split('-');
  if (parts.length >= 2) {
    return { title: parts[0].trim(), artist: parts.slice(1).join('-').trim() };
  }

  return null;
};

// One-time repair function to fix all songs missing fileId
async function repairMissingFileIds(): Promise<void> {
  console.log('🔧 Starting fileId repair...');

  try {
    // Step 1: Get all songs from database
    const allSongs = await getAllSongs();
    console.log(`📊 Total songs in database: ${allSongs.length}`);

    // Step 2: Filter songs that need repair (have audioUrl but no fileId)
    const songsNeedingRepair = allSongs.filter(s => s.audioUrl && !s.fileId);
    console.log(`🔍 Songs needing fileId repair: ${songsNeedingRepair.length}`);

    if (songsNeedingRepair.length === 0) {
      console.log('✅ No songs need repair!');
      return;
    }

    // Step 3: Get all files from CTFile
    console.log('📁 Fetching files from CTFile...');
    const files = await listMusicFiles();
    console.log(`📁 Files in CTFile: ${files.length}`);

    if (files.length === 0) {
      console.log('❌ No files found in CTFile. Check CTFILE_TOKEN.');
      return;
    }

    // Step 4: Match and repair
    let repairedCount = 0;
    let notFoundCount = 0;

    for (const song of songsNeedingRepair) {
      // Find matching file by exact title + artist
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
          // Get new playable URL
          const audioUrl = await getPlayableUrl(matchingFile.key);
          if (audioUrl) {
            const audioUrlUpdatedAt = new Date().toISOString();

            // Update database
            await updateSongInDB(song.id, {
              audioUrl,
              fileId: matchingFile.key,
              audioUrlUpdatedAt
            });

            repairedCount++;
            console.log(`✅ Repaired: "${song.title}" - "${song.artist}" → fileId: ${matchingFile.key}`);
          }
        } catch (error) {
          console.error(`❌ Failed to repair "${song.title}":`, error);
        }
      } else {
        notFoundCount++;
        console.log(`⚠️ No matching file for: "${song.title}" - "${song.artist}"`);
      }
    }

    console.log('');
    console.log('🎵 Repair Complete!');
    console.log(`   ✅ Repaired: ${repairedCount}`);
    console.log(`   ⚠️ No match found: ${notFoundCount}`);
    console.log('');
    console.log('💡 Refresh the page to see changes.');

  } catch (error) {
    console.error('❌ Repair failed:', error);
  }
}

// Expose to window for console access
(window as any).repairMissingFileIds = repairMissingFileIds;


const App: React.FC = () => {
  // All songs from database
  const [songs, setSongs] = useState<Song[]>([]);
  // Visible songs (max 200 random + searched songs)
  const [visibleSongs, setVisibleSongs] = useState<Song[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [searchedSongId, setSearchedSongId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [isLyricsModalOpen, setIsLyricsModalOpen] = useState(false);
  const [playMode, setPlayMode] = useState<'sequential' | 'shuffle' | 'single'>('sequential');
  const [visitorStats, setVisitorStats] = useState({ totalVisits: 0, activeUsers: 0 });

  // Audio playback time tracking
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // 640px = Tailwind 'sm' breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Deduplicate songs by title + artist
  // Priority: 1) Keep version with audioUrl if only one has it
  //           2) If both have audioUrl, keep the one with latest audioUrlUpdatedAt
  const deduplicateSongs = useCallback((songs: Song[]): Song[] => {
    const seen = new Map<string, Song>();

    songs.forEach(song => {
      const key = `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;
      const existing = seen.get(key);

      if (!existing) {
        // First time seeing this song
        seen.set(key, song);
      } else if (song.audioUrl && !existing.audioUrl) {
        // Current song has audio, existing doesn't - use current
        seen.set(key, song);
      } else if (!song.audioUrl && existing.audioUrl) {
        // Existing has audio, current doesn't - keep existing (do nothing)
      } else if (song.audioUrl && existing.audioUrl) {
        // Both have audioUrl - compare audioUrlUpdatedAt, keep newer
        const existingTime = new Date(existing.audioUrlUpdatedAt || '1970-01-01').getTime();
        const songTime = new Date(song.audioUrlUpdatedAt || '1970-01-01').getTime();
        if (songTime > existingTime) {
          seen.set(key, song);
        }
      }
      // If neither has audioUrl, keep existing (first occurrence)
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
          // No songs in database - start with empty state
          console.log('No songs in database. Starting with empty library.');
          setSongs([]);
        }
      } catch (error) {
        console.error('Error loading songs from Supabase:', error);
        // Start with empty array on error - user can add songs manually
        setSongs([]);
      } finally {
        setIsDataLoaded(true);
      }
    };
    initData();
  }, [deduplicateSongs]);

  // Sample random 200 songs for display when songs change
  useEffect(() => {
    if (songs.length === 0) {
      setVisibleSongs([]);
      return;
    }

    const MAX_VISIBLE = 200;

    if (songs.length <= MAX_VISIBLE) {
      // Show all if less than limit
      setVisibleSongs(songs);
    } else {
      // Smart sampling: preserve existing to avoid re-shuffling
      setVisibleSongs(prev => {
        // Keep existing visible songs, just update their data
        if (prev.length >= MAX_VISIBLE) {
          const updated = prev
            .map(v => songs.find(s => s.id === v.id))
            .filter((s): s is Song => s !== undefined);

          // Ensure currently playing is always visible
          if (currentlyPlayingId && !updated.some(s => s.id === currentlyPlayingId)) {
            const playing = songs.find(s => s.id === currentlyPlayingId);
            if (playing && updated.length > 0) {
              updated[0] = playing;
            }
          }

          return updated.length > 0 ? updated : prev;
        }

        // Initial sampling
        const shuffled = [...songs].sort(() => Math.random() - 0.5);
        const sampled = shuffled.slice(0, MAX_VISIBLE);
        console.log(`Displaying ${MAX_VISIBLE} random songs out of ${songs.length} total`);
        return sampled;
      });
    }
  }, [songs, currentlyPlayingId]);

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

    // Update stats every 600 seconds
    const interval = setInterval(async () => {
      try {
        const stats = await getVisitorStats();
        setVisitorStats(stats);
      } catch (error) {
        // Silently fail
        console.debug('Failed to get stats');
      }
    }, 600000);

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
    const SYNC_COOLDOWN_MS = 1800000; // 0.5 hour
    const LAST_SYNC_KEY = 'ctfile_last_sync';
    const MAX_NEW_SONGS_PER_SYNC = 50; // Limit new songs per sync to avoid overload

    const shouldSync = () => {
      const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
      if (!lastSyncStr) return true;

      // Force sync if any song has audioUrl but missing fileId (repair needed)
      const needsRepair = songs.some(s => s.audioUrl && !s.fileId);
      if (needsRepair) {
        console.log('Force sync triggered: some songs are missing fileId');
        return true;
      }

      const lastSync = new Date(lastSyncStr);
      const now = new Date();
      const elapsed = now.getTime() - lastSync.getTime();

      return elapsed >= SYNC_COOLDOWN_MS;
    };

    // Helper to extract song info from filename like "歌曲名-作者.flac" (Title-Artist format)
    // Also supports "Title - Artist.flac" format (with spaces)
    const extractSongInfoFromFilename = (filename: string): { artist: string; title: string } | null => {
      const cleanName = filename.replace(/\.(flac|mp3|wav|m4a|ogg|wma)$/i, '');

      // Try " - " first (standard format: Title - Artist)
      let parts = cleanName.split(' - ');
      if (parts.length >= 2) {
        // Format: Title - Artist
        return { title: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() };
      }

      // Try "-" without spaces (Format: Title-Artist)
      parts = cleanName.split('-');
      if (parts.length >= 2) {
        // Format: Title-Artist
        return { title: parts[0].trim(), artist: parts.slice(1).join('-').trim() };
      }

      return null;
    };

    // Check if song already exists in database (by title + artist match)
    const songExistsInDB = (title: string, artist: string, existingSongs: Song[]): boolean => {
      return existingSongs.some(s =>
        s.title.toLowerCase() === title.toLowerCase() &&
        s.artist.toLowerCase() === artist.toLowerCase()
      );
    };

    const performSync = async () => {
      // Check if we should sync
      if (!shouldSync()) {
        const lastSyncStr = localStorage.getItem(LAST_SYNC_KEY);
        console.log(`Skipping CTFile sync (last synced: ${lastSyncStr})`);
        return;
      }

      try {
        console.log('Starting CTFile sync via Worker API...');
        console.log(`[Sync Debug] Songs needing repair: ${songs.filter(s => s.audioUrl && !s.fileId).length}`);

        // Get files from CTFile via Worker
        let files;
        try {
          files = await listMusicFiles();
          console.log(`[Sync Debug] listMusicFiles returned: ${JSON.stringify(files?.length ?? 'undefined')}`);
        } catch (listError) {
          console.error('[Sync Debug] listMusicFiles threw error:', listError);
          return;
        }

        if (!files || files.length === 0) {
          console.log('No music files found in CTFile (check CTFILE_TOKEN expiration)');
          return;
        }

        console.log(`Found ${files.length} files in CTFile`);

        // Get current songs snapshot
        let currentSongs = [...songs];

        // Phase 1: Match files to existing songs and update audioUrl
        // Limit to MAX_NEW_SONGS_PER_SYNC (50) API calls per sync to avoid rate limiting
        let updatedCount = 0;
        let apiCallCount = 0;
        const updatedSongs: Song[] = [];
        let songsNeedingUpdate = 0;

        for (const song of currentSongs) {
          // Skip ONLY IF we have a valid audioUrl, a fileId, AND it's not expired
          if (song.audioUrl && song.fileId && !isAudioUrlExpired(song)) {
            updatedSongs.push(song);
            continue;
          }

          // This song needs update - log it for debugging
          songsNeedingUpdate++;
          const needsRepair = song.audioUrl && !song.fileId;
          const isExpired = song.audioUrl && song.fileId && isAudioUrlExpired(song);
          const hasNoAudio = !song.audioUrl;

          if (needsRepair) {
            console.log(`[Sync Debug] Song needs fileId repair: "${song.title}" - "${song.artist}"`);
          }

          // Find matching file
          const matchingFile = files.find(file => {
            const info = extractSongInfoFromFilename(file.name);
            if (!info) return false;
            return (
              info.title.toLowerCase() === song.title.toLowerCase() &&
              info.artist.toLowerCase() === song.artist.toLowerCase()
            );
          });

          if (!matchingFile && needsRepair) {
            // Log why no match was found
            console.log(`[Sync Debug] No matching file found for: "${song.title}" - "${song.artist}"`);
            // Try to find partial matches for debugging
            const partialMatches = files.filter(file => {
              const info = extractSongInfoFromFilename(file.name);
              if (!info) return false;
              return info.title.toLowerCase().includes(song.title.toLowerCase().substring(0, 3)) ||
                info.artist.toLowerCase().includes(song.artist.toLowerCase().substring(0, 3));
            }).slice(0, 3);
            if (partialMatches.length > 0) {
              console.log(`[Sync Debug] Possible partial matches:`, partialMatches.map(f => f.name));
            }
          }

          if (matchingFile && apiCallCount < MAX_NEW_SONGS_PER_SYNC) {
            try {
              const queueLength = ctfileRateLimiter.getQueueLength();
              if (queueLength > 0) {
                console.log(`[Sync] Queue: ${queueLength} requests pending...`);
              }

              const audioUrl = await getPlayableUrl(matchingFile.key);
              apiCallCount++;
              if (audioUrl) {
                updatedCount++;
                console.log(`✓ Matched existing (${apiCallCount}/${MAX_NEW_SONGS_PER_SYNC}): ${song.title} - ${song.artist}`);

                // Update in database
                const audioUrlUpdatedAt = new Date().toISOString();
                await updateSongInDB(song.id, {
                  audioUrl,
                  fileId: matchingFile.key,
                  audioUrlUpdatedAt
                });

                updatedSongs.push({ ...song, audioUrl, fileId: matchingFile.key, audioUrlUpdatedAt });
              } else {
                updatedSongs.push(song);
              }
            } catch (error) {
              console.error(`Failed to get URL for ${song.title}:`, error);
              updatedSongs.push(song);
            }
          } else {
            updatedSongs.push(song);
          }
        }

        console.log(`[Sync Debug] Phase 1 summary: ${songsNeedingUpdate} songs needed update, ${updatedCount} matched`);
        currentSongs = updatedSongs;

        // Phase 2: Import NEW songs from CTFile that don't exist in database
        console.log('Phase 2: Checking for new songs to import...');

        // Find files that don't match any existing song
        const newFiles = files.filter(file => {
          const info = extractSongInfoFromFilename(file.name);
          if (!info) return false;
          return !songExistsInDB(info.title, info.artist, currentSongs);
        });

        // Calculate remaining API calls budget after Phase 1
        const remainingBudget = MAX_NEW_SONGS_PER_SYNC - apiCallCount;
        console.log(`Found ${newFiles.length} new songs to import (budget: ${remainingBudget} remaining)`);

        // Process new songs (limited by remaining budget)
        const filesToProcess = newFiles.slice(0, Math.max(0, remainingBudget));
        let importedCount = 0;

        for (const file of filesToProcess) {
          const info = extractSongInfoFromFilename(file.name);
          if (!info) continue;

          try {
            const queueLength = ctfileRateLimiter.getQueueLength();
            if (queueLength > 0) {
              console.log(`[Import] Queue: ${queueLength} requests pending...`);
            }

            // Get playable URL first (rate limited automatically)
            const audioUrl = await getPlayableUrl(file.key);
            if (!audioUrl) continue;

            // Try to enrich metadata with AI (non-blocking, use defaults if fails)
            let metadata = await enrichSongMetadata(info.title, info.artist);

            if (!metadata) {
              // Use defaults if AI enrichment fails
              metadata = {
                title: info.title,
                artist: info.artist,
                releaseDate: new Date().toISOString().split('T')[0],
                popularity: 50,
                description: `由${info.artist}演唱的歌曲`,
                coverUrl: `https://picsum.photos/seed/${info.title}_${info.artist}/300/300`
              };
            }

            // Create new song object with proper UUID
            const newSong: Song = {
              id: crypto.randomUUID(),
              title: info.title,
              artist: info.artist,
              releaseDate: metadata.releaseDate,
              popularity: metadata.popularity,
              description: metadata.description,
              coverUrl: metadata.coverUrl,
              audioUrl: audioUrl,
              fileId: file.key,
              audioUrlUpdatedAt: new Date().toISOString()
            };

            // Save to database
            const createdSong = await createSong(newSong);
            currentSongs.push(createdSong);
            importedCount++;

            console.log(`✓ Imported new (${importedCount}/${filesToProcess.length}): ${info.title} - ${info.artist}`);
          } catch (error) {
            console.error(`Failed to import ${info.title} - ${info.artist}:`, error);
          }
        }

        // Deduplicate and update state
        const uniqueSongs = deduplicateSongs(currentSongs);
        setSongs(uniqueSongs);

        const now = new Date();
        localStorage.setItem(LAST_SYNC_KEY, now.toISOString());

        // Count matched songs (those with audioUrl)
        const matched = uniqueSongs.filter(s => s.audioUrl).length;

        console.log(`🎵 CTFile sync complete: ${matched}/${uniqueSongs.length} songs with audio`);
        console.log(`   - ${updatedCount} existing songs matched`);
        console.log(`   - ${importedCount} new songs imported`);
        if (newFiles.length > MAX_NEW_SONGS_PER_SYNC) {
          console.log(`   - ${newFiles.length - MAX_NEW_SONGS_PER_SYNC} more songs pending (will import on next sync)`);
        }
      } catch (error) {
        console.error('CTFile sync failed:', error);
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

  // Helper to refresh a single song's audio URL if expired
  const refreshSongUrl = useCallback(async (songId: string): Promise<string | null> => {
    const song = songs.find(s => s.id === songId);
    if (!song) return null;

    if (!song.fileId) {
      if (song.audioUrl && isAudioUrlExpired(song)) {
        console.warn(`[Refresh] Cannot refresh "${song.title}" - fileId is missing. Sync may be in progress.`);
      }
      return song.audioUrl || null;
    }

    if (!isAudioUrlExpired(song)) {
      return song.audioUrl || null;
    }

    console.log(`Refreshing expired audio URL for: ${song.title}`);
    try {
      const newUrl = await getPlayableUrl(song.fileId);
      if (newUrl) {
        const audioUrlUpdatedAt = new Date().toISOString();

        // Update database
        await updateSongInDB(song.id, {
          audioUrl: newUrl,
          audioUrlUpdatedAt
        });

        // Update local state
        setSongs(prev => prev.map(s =>
          s.id === song.id ? { ...s, audioUrl: newUrl, audioUrlUpdatedAt } : s
        ));

        return newUrl;
      }
    } catch (error) {
      console.error(`Failed to refresh URL for ${song.title}:`, error);
    }
    return song.audioUrl || null;
  }, [songs]);

  // Centralized play handler that checks for expiration
  const playSongWithRefresh = useCallback(async (id: string | null) => {
    if (!id) {
      setCurrentlyPlayingId(null);
      return;
    }

    // Attempt to refresh if needed before playing
    await refreshSongUrl(id);
    setCurrentlyPlayingId(id);
  }, [refreshSongUrl]);

  // Helper to add song to visible list if not already there
  const addToVisibleSongs = useCallback((song: Song) => {
    setVisibleSongs(prev => {
      // Check if already visible
      if (prev.some(s => s.id === song.id)) {
        return prev;
      }
      // Add to visible songs
      console.log(`Adding searched song to visible: ${song.title}`);
      return [...prev, song].sort((a, b) =>
        new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
      );
    });
  }, []);

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

    const normalizedQuery = query.toLowerCase().trim();

    // 1. Exact match - highest priority
    const exactMatch = songs.find(s =>
      s.title.toLowerCase() === normalizedQuery ||
      s.artist.toLowerCase() === normalizedQuery
    );

    if (exactMatch) {
      setSearchedSongId(exactMatch.id);
      addToVisibleSongs(exactMatch);
      setIsSearching(false);
      return;
    }

    // 2. Multi-keyword match (e.g., "夜曲 周杰伦" -> title:"夜曲" + artist:"周杰伦")
    const keywords = normalizedQuery.split(/\s+/).filter(k => k.length > 0);

    if (keywords.length > 1) {
      // Try to find a song where different keywords match title and artist
      const multiKeywordMatch = songs.find(s => {
        const titleLower = s.title.toLowerCase();
        const artistLower = s.artist.toLowerCase();

        // Check if at least one keyword matches title and another matches artist
        const titleMatches = keywords.filter(k => titleLower.includes(k));
        const artistMatches = keywords.filter(k => artistLower.includes(k));

        // Match if we have keywords matching both title and artist
        return titleMatches.length > 0 && artistMatches.length > 0;
      });

      if (multiKeywordMatch) {
        setSearchedSongId(multiKeywordMatch.id);
        addToVisibleSongs(multiKeywordMatch);
        setIsSearching(false);
        return;
      }

      // Alternative: all keywords match either title or artist
      const allKeywordsMatch = songs.find(s => {
        const combined = `${s.title} ${s.artist}`.toLowerCase();
        return keywords.every(k => combined.includes(k));
      });

      if (allKeywordsMatch) {
        setSearchedSongId(allKeywordsMatch.id);
        addToVisibleSongs(allKeywordsMatch);
        setIsSearching(false);
        return;
      }
    }

    // 3. Single keyword or substring match
    const localMatch = songs.find(s =>
      s.title.toLowerCase().includes(normalizedQuery) ||
      s.artist.toLowerCase().includes(normalizedQuery)
    );

    if (localMatch) {
      setSearchedSongId(localMatch.id);
      addToVisibleSongs(localMatch);
      setIsSearching(false);
      return;
    }

    // 4. AI search as last resort
    const aiResult = await searchSongWithAI(query);

    if (aiResult) {
      const exists = songs.some(s => s.title === aiResult.title && s.artist === aiResult.artist);
      if (!exists) {
        try {
          const createdSong = await createSong(aiResult);
          setSongs(prev => [...prev, createdSong].sort((a, b) =>
            new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
          ));
          setSearchedSongId(createdSong.id);
          addToVisibleSongs(createdSong);
        } catch (error) {
          console.error('Error saving AI-generated song to Supabase:', error);
          setSongs(prev => [...prev, aiResult].sort((a, b) =>
            new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()
          ));
          setSearchedSongId(aiResult.id);
        }
      } else {
        const existing = songs.find(s => s.title === aiResult.title && s.artist === aiResult.artist);
        if (existing) {
          setSearchedSongId(existing.id);
          addToVisibleSongs(existing);
        }
      }
    } else {
      alert("暂未找到或收录此歌曲。\nSong not found.");
    }

    setIsSearching(false);
  }, [songs, addToVisibleSongs]);



  const handleSongEnded = useCallback(() => {
    if (!currentlyPlayingId) return;

    if (playMode === 'single') {
      // Logic handled by loop={true} in AudioPlayer mostly, but fallback:
      const audioEl = document.querySelector('audio');
      if (audioEl) {
        audioEl.currentTime = 0;
        audioEl.play().catch(console.error);
      }
      return;
    }

    // Filter songs to only include those with audioUrl
    const playableSongs = songs.filter(s => s.audioUrl);

    if (playableSongs.length === 0) {
      setCurrentlyPlayingId(null);
      return;
    }

    if (playMode === 'shuffle') {
      // Pick random song from playable songs
      const randomIndex = Math.floor(Math.random() * playableSongs.length);
      playSongWithRefresh(playableSongs[randomIndex].id);
    } else {
      // Sequential - find next playable song
      const currentIndex = playableSongs.findIndex(s => s.id === currentlyPlayingId);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % playableSongs.length;
        playSongWithRefresh(playableSongs[nextIndex].id);
      } else {
        // Current song not in playable list, start from first playable
        playSongWithRefresh(playableSongs[0].id);
      }
    }
  }, [currentlyPlayingId, playMode, songs, playSongWithRefresh]);

  const togglePlayMode = () => {
    setPlayMode(prev => {
      if (prev === 'sequential') return 'shuffle';
      if (prev === 'shuffle') return 'single';
      return 'sequential';
    });
  };

  const togglePlayPause = () => {
    if (currentlyPlayingId) {
      setCurrentlyPlayingId(null);
    } else if (songs.length > 0) {
      playSongWithRefresh(songs[0].id);
    }
  };

  // Handle seek in audio player
  const handleSeek = useCallback((time: number) => {
    // Seek will be handled via audio element directly in AudioPlayer
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      audioElement.currentTime = time;
    }
  }, []);

  // Handle next track
  const handleNext = useCallback(() => {
    if (!currentlyPlayingId) return;

    // Filter to only playable songs
    const playableSongs = songs.filter(s => s.audioUrl);
    if (playableSongs.length === 0) return;

    if (playMode === 'shuffle') {
      // Pick random song different from current
      const otherSongs = playableSongs.filter(s => s.id !== currentlyPlayingId);
      if (otherSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * otherSongs.length);
        playSongWithRefresh(otherSongs[randomIndex].id);
      }
    } else {
      // Sequential - find next song
      const currentIndex = playableSongs.findIndex(s => s.id === currentlyPlayingId);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % playableSongs.length;
        playSongWithRefresh(playableSongs[nextIndex].id);
      }
    }
  }, [currentlyPlayingId, playMode, songs, playSongWithRefresh]);

  // Handle time updates from AudioPlayer
  const handleTimeUpdate = useCallback((current: number, dur: number) => {
    setCurrentTime(current);
    setDuration(dur);
  }, []);

  return (
    // 3D Cosmic Space Background
    <div className="w-screen h-screen bg-slate-950 relative overflow-hidden font-sans text-slate-200">

      {/* Fixed Cosmic Background Layer */}
      <div className="cosmic-bg">
        {/* Nebula Glow Effects */}
        <div className="nebula nebula-1" />
        <div className="nebula nebula-2" />
        <div className="nebula nebula-3" />

        {/* Star Layers for Parallax Depth */}
        <div className="stars stars-small" />
        <div className="stars stars-medium" />
        <div className="stars stars-large" />

        {/* Shooting Stars */}
        <div className="shooting-star" />
        <div className="shooting-star" />
        <div className="shooting-star" />
      </div>

      <div className="relative w-screen h-screen overflow-hidden">
        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-indigo-950/20 pointer-events-none" />



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

        {/* Data Loading Status - Bottom Right */}
        {!isDataLoaded && (
          <div className="fixed bottom-28 right-6 z-50 bg-slate-800/95 backdrop-blur-md px-4 py-3 rounded-lg border border-slate-700 shadow-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-neon-accent" size={20} />
              <div>
                <div className="text-sm font-medium text-slate-200">Loading Music Library</div>

              </div>
            </div>
          </div>
        )}



        {/* Main Content - Timeline on Desktop, Song List on Mobile */}
        <div className={`absolute inset-0 z-10 ${isMobile ? 'pt-28 pb-24 overflow-y-auto' : 'pt-20 pb-24'}`}>
          {isMobile ? (
            <MobileSongList
              songs={visibleSongs}
              currentlyPlayingId={currentlyPlayingId}
              onSongClick={(id) => {
                setSearchedSongId(id);
                const song = songs.find(s => s.id === id);
                if (song) {
                  addToVisibleSongs(song);
                  // If song has audio, also play it
                  if (song.audioUrl) {
                    playSongWithRefresh(id);
                  }
                }
              }}
              onPlayToggle={(id) => {
                if (currentlyPlayingId === id) {
                  setCurrentlyPlayingId(null);
                } else {
                  playSongWithRefresh(id);
                }
              }}
              searchedSongId={searchedSongId}
            />
          ) : (
            <Timeline
              songs={visibleSongs}
              currentlyPlayingId={currentlyPlayingId}
              setCurrentlyPlayingId={playSongWithRefresh}
              searchedSongId={searchedSongId}
            />
          )}
        </div>

        {/* Bottom Right Controls (Volume & Mode) - Hidden on Mobile */}
        <div className="hidden sm:flex fixed bottom-24 right-6 z-50 flex-col gap-3">
          {/* Play Mode Toggle */}
          <button
            onClick={togglePlayMode}
            title={
              playMode === 'sequential' ? '顺序播放' :
                playMode === 'shuffle' ? '随机播放' : '单曲循环'
            }
            className="p-3 bg-slate-800/80 backdrop-blur text-slate-300 rounded-full hover:bg-slate-700 transition-colors shadow-lg border border-slate-700 group relative"
          >
            {playMode === 'sequential' && <Repeat size={20} />}
            {playMode === 'shuffle' && <Shuffle size={20} />}
            {playMode === 'single' && <Repeat1 size={20} />}
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
          onNext={handleNext}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />

        {/* Audio Controller Logic (Hidden) */}
        <AudioPlayer
          isPlaying={!!currentlyPlayingId}
          volume={isMuted ? 0 : 0.5}
          src={currentSong?.audioUrl}
          loop={playMode === 'single'}
          onEnded={handleSongEnded}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Modals */}
        <LyricsModal
          isOpen={isLyricsModalOpen}
          onClose={() => setIsLyricsModalOpen(false)}
          song={currentSong}
          currentTime={currentTime}
          onUpdateLyrics={async (songId, lyrics) => {
            // Update local state
            setSongs(prev => prev.map(s =>
              s.id === songId ? { ...s, lyrics } : s
            ));
            // Sync to database
            try {
              await updateSongInDB(songId, { lyrics });
            } catch (error) {
              console.error('Failed to update lyrics in database:', error);
            }
          }}
        />

      </div>
    </div>
  );
};

export default App;