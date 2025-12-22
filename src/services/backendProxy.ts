// Backend Proxy Service
// All backend operations go through Cloudflare Worker API

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
                id: `ai-${Date.now()}`,
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
    lyrics?: string;
    created_at?: string;
    updated_at?: string;
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
    try {
        return await callWorkerAPI("getPlayableUrl", { fileKey });
    } catch (error) {
        console.error(`Failed to get playable URL for ${fileKey}:`, error);
        return null;
    }
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
