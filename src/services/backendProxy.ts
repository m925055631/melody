// Backend Proxy Service
// All backend operations go through Cloudflare Worker API

import { ctfileRateLimiter } from '../utils/rateLimiter';

const API_URL = import.meta.env.VITE_API_URL || "/api/ai";

// Helper function to call Worker API
async function callWorkerAPI(action: string, data: any = {}): Promise<any> {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ action, data })
        });

        if (!response.ok) {
            throw new Error(`Worker API error: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        return result;
    } catch (error) {
        console.error(`Backend API call failed (${action}):`, error);
        throw error;
    }
}

// ============================================================================
// AI Service Exports
// ============================================================================

import type { Song } from "../types";

export const searchSongWithAI = async (query: string): Promise<Song | null> => {
    try {
        const result = await callWorkerAPI("searchSong", { query });

        if (result?.found && result?.song) {
            return {
                id: crypto.randomUUID(),
                title: result.song.title,
                artist: result.song.artist,
                releaseDate: result.song.releaseDate,
                popularity: result.song.popularity,
                description: result.song.description,
                coverUrl: `https://picsum.photos/seed/${result.song.title}/300/300`
            };
        }

        return null;
    } catch (error) {
        console.error("AI search failed:", error);
        return null;
    }
};

export const fetchSongDetailsWithAI = async (title: string, artist: string): Promise<{ lyrics: string; visualPrompt?: string } | null> => {
    try {
        const result = await callWorkerAPI("fetchLyrics", { title, artist });

        if (result?.lyrics) {
            return {
                lyrics: result.lyrics,
                visualPrompt: result.visualPrompt
            };
        }

        return null;
    } catch (error) {
        console.error("AI details fetch failed:", error);
        return null;
    }
};

export const enrichSongMetadata = async (
    title: string,
    artist: string
): Promise<Omit<Song, 'id' | 'audioUrl'> | null> => {
    try {
        const result = await callWorkerAPI("enrichMetadata", { title, artist });

        if (result?.found && result?.metadata) {
            const visualSeed = result.metadata.visualPrompt
                ? result.metadata.visualPrompt.replace(/\s+/g, '_')
                : `${title}_${artist}`.replace(/\s+/g, '_');

            return {
                title,
                artist,
                releaseDate: result.metadata.releaseDate || new Date().toISOString().split('T')[0],
                popularity: result.metadata.popularity || 50,
                description: result.metadata.description || `由${artist}演唱的歌曲`,
                coverUrl: `https://picsum.photos/seed/${visualSeed}/300/300`
            };
        }

        // Return defaults if AI fails
        return {
            title,
            artist,
            releaseDate: new Date().toISOString().split('T')[0],
            popularity: 50,
            description: `由${artist}演唱的歌曲`,
            coverUrl: `https://picsum.photos/seed/${title}_${artist}/300/300`
        };
    } catch (error) {
        console.error("Metadata enrichment failed:", error);
        // Return defaults on error
        return {
            title,
            artist,
            releaseDate: new Date().toISOString().split('T')[0],
            popularity: 50,
            description: `由${artist}演唱的歌曲`,
            coverUrl: `https://picsum.photos/seed/${title}_${artist}/300/300`
        };
    }
};

// ============================================================================
// Supabase Service Exports
// ============================================================================

interface SongRecord {
    id: string;
    title: string;
    artist: string;
    release_date: string;
    popularity: number;
    cover_url: string;
    description?: string;
    audio_url?: string;
    file_id?: string;
    audio_url_updated_at?: string;
    lyrics?: string;
    created_at?: string;
    updated_at?: string;
}

export function isAudioUrlExpired(song: Song): boolean {
    if (!song.audioUrl || !song.audioUrlUpdatedAt) return true;

    const updatedAt = new Date(song.audioUrlUpdatedAt).getTime();
    const now = new Date().getTime();
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    return (now - updatedAt) >= SIX_HOURS;
}

// Test if audio URL is valid by sending a HEAD request
export async function testAudioUrl(url: string): Promise<boolean> {
    if (!url) return false;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok; // 2xx status codes
    } catch (error) {
        console.warn('[testAudioUrl] URL test failed:', error);
        return false;
    }
}

function recordToSong(record: SongRecord): Song {
    return {
        id: record.id,
        title: record.title,
        artist: record.artist,
        releaseDate: record.release_date,
        popularity: record.popularity,
        coverUrl: record.cover_url,
        description: record.description,
        audioUrl: record.audio_url,
        fileId: record.file_id,
        audioUrlUpdatedAt: record.audio_url_updated_at,
        lyrics: record.lyrics
    };
}

function songToRecord(song: Partial<Song>): Partial<SongRecord> {
    const record: Partial<SongRecord> = {};

    if (song.id) record.id = song.id;
    if (song.title) record.title = song.title;
    if (song.artist) record.artist = song.artist;
    if (song.releaseDate) record.release_date = song.releaseDate;
    if (song.popularity !== undefined) record.popularity = song.popularity;
    if (song.coverUrl) record.cover_url = song.coverUrl;
    if (song.description !== undefined) record.description = song.description;
    if (song.audioUrl !== undefined) record.audio_url = song.audioUrl;
    if (song.fileId !== undefined) record.file_id = song.fileId;
    if (song.audioUrlUpdatedAt !== undefined) record.audio_url_updated_at = song.audioUrlUpdatedAt;
    if (song.lyrics !== undefined) record.lyrics = song.lyrics;

    return record;
}

export async function getAllSongs(): Promise<Song[]> {
    try {
        const records = await callWorkerAPI("getAllSongs");
        return records.map(recordToSong);
    } catch (error) {
        console.error("Failed to get songs:", error);
        return [];
    }
}

// Get random songs with limit for initial page load (lazy loading)
export async function getRandomSongs(limit: number = 300): Promise<Song[]> {
    try {
        const records = await callWorkerAPI("getRandomSongs", { limit });
        return records.map(recordToSong);
    } catch (error) {
        console.error("Failed to get random songs:", error);
        return [];
    }
}

// Search songs in database by title or artist
export async function searchSongsInDB(query: string, limit: number = 50): Promise<Song[]> {
    try {
        const records = await callWorkerAPI("searchSongsInDB", { query, limit });
        return records.map(recordToSong);
    } catch (error) {
        console.error("Failed to search songs:", error);
        return [];
    }
}

// Get a specific song by ID
export async function getSongById(songId: string): Promise<Song | null> {
    try {
        const record = await callWorkerAPI("getSongById", { songId });
        return record ? recordToSong(record) : null;
    } catch (error) {
        console.error("Failed to get song by ID:", error);
        return null;
    }
}

// Get songs by multiple IDs
export async function getSongsByIds(songIds: string[]): Promise<Song[]> {
    try {
        if (songIds.length === 0) return [];
        const records = await callWorkerAPI("getSongsByIds", { songIds });
        return records.map(recordToSong);
    } catch (error) {
        console.error("Failed to get songs by IDs:", error);
        return [];
    }
}


export async function createSong(song: Song): Promise<Song> {
    const record = songToRecord(song);
    const result = await callWorkerAPI("createSong", { song: record });
    return recordToSong(result[0]);
}

export async function updateSong(id: string, updates: Partial<Song>): Promise<Song> {
    const record = songToRecord(updates);
    const result = await callWorkerAPI("updateSong", { id, updates: record });
    return recordToSong(result[0]);
}

export async function deleteSong(id: string): Promise<void> {
    await callWorkerAPI("deleteSong", { id });
}

// ============================================================================
// CTFile Service Exports
// ============================================================================

interface CTFileItem {
    key: string;
    icon: string;
    name: string;
    size?: number;
    date: string;
}

export async function listMusicFiles(): Promise<CTFileItem[]> {
    try {
        return await callWorkerAPI("listMusicFiles");
    } catch (error) {
        console.error("Failed to list music files:", error);
        return [];
    }
}

export async function getPlayableUrl(fileKey: string): Promise<string | null> {
    // Use rate limiter to prevent "请求过于频繁" errors
    return ctfileRateLimiter.enqueue(async () => {
        try {
            return await callWorkerAPI("getPlayableUrl", { fileKey });
        } catch (error) {
            console.error(`Failed to get playable URL for ${fileKey}:`, error);
            return null;
        }
    });
}

// ============================================================================
// Visitor Statistics Exports
// ============================================================================

export async function trackVisit(): Promise<void> {
    try {
        await callWorkerAPI("trackVisit", {});
    } catch (error) {
        console.error("Failed to track visit:", error);
    }
}

export async function getVisitorStats(): Promise<{ totalVisits: number; activeUsers: number }> {
    try {
        return await callWorkerAPI("getStats", {});
    } catch (error) {
        console.error("Failed to get visitor stats:", error);
        return { totalVisits: 0, activeUsers: 0 };
    }
}

// ============================================================================
// Song Like Exports
// ============================================================================

export async function likeSong(songId: string): Promise<{ liked: boolean; alreadyLiked: boolean; newPopularity: number }> {
    try {
        const result = await callWorkerAPI("likeSong", { songId });
        return {
            liked: result.liked ?? false,
            alreadyLiked: result.alreadyLiked ?? false,
            newPopularity: result.newPopularity ?? 0
        };
    } catch (error) {
        console.error("Failed to like song:", error);
        return { liked: false, alreadyLiked: false, newPopularity: 0 };
    }
}

export async function checkLiked(songId: string): Promise<boolean> {
    try {
        const result = await callWorkerAPI("checkLiked", { songId });
        return result.liked ?? false;
    } catch (error) {
        console.error("Failed to check like status:", error);
        return false;
    }
}

// ============================================================================
// Release Date Update Exports
// ============================================================================

interface ReleaseDateSearchResult {
    found: boolean;
    releaseDate?: string;
    source?: string;
}

interface UpdateReleaseDatesResult {
    processed: number;
    updated: number;
    unchanged: number;
    notFound: number;
    results: Array<{
        id: string;
        title: string;
        artist: string;
        oldDate: string;
        newDate?: string;
        status: string;
    }>;
}

interface UpdateSingleReleaseDateResult {
    success: boolean;
    updated?: boolean;
    oldDate?: string;
    newDate?: string;
    source?: string;
    message?: string;
    currentDate?: string;
    error?: string;
}

// Search for release date using AI
export async function searchReleaseDate(title: string, artist: string): Promise<ReleaseDateSearchResult> {
    try {
        return await callWorkerAPI("searchReleaseDate", { title, artist });
    } catch (error) {
        console.error("Failed to search release date:", error);
        return { found: false };
    }
}

// Update release dates for multiple songs
export async function updateReleaseDates(options: { limit?: number; onlyMissing?: boolean } = {}): Promise<UpdateReleaseDatesResult> {
    try {
        return await callWorkerAPI("updateReleaseDates", options);
    } catch (error) {
        console.error("Failed to update release dates:", error);
        return { processed: 0, updated: 0, unchanged: 0, notFound: 0, results: [] };
    }
}

// Update release date for a single song
export async function updateSingleReleaseDate(songId: string): Promise<UpdateSingleReleaseDateResult> {
    try {
        return await callWorkerAPI("updateSingleReleaseDate", { songId });
    } catch (error) {
        console.error("Failed to update single release date:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
