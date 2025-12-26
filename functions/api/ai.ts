// Cloudflare Worker API Proxy for All Backend Services
// This runs on the edge and keeps ALL API keys secure

interface Env {
    OPENROUTER_API_KEY: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    CTFILE_FOLDER_ID: string;
    CTFILE_TOKEN: string;
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-3-flash-preview";

// CORS headers for frontend access
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// ============================================================================
// OpenRouter AI Functions
// ============================================================================

async function callOpenRouter(
    apiKey: string,
    prompt: string,
    systemPrompt?: string
): Promise<any> {
    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://melody-timeline.pages.dev",
                "X-Title": "Melody Timeline"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return null;
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("OpenRouter API call failed:", error);
        throw error;
    }
}

async function handleSearchSong(apiKey: string, query: string) {
    const prompt = `Search for the song "${query}". If it exists and was released between 1950 and 2026, return its details in JSON format with this structure:
{
  "found": true/false,
  "song": {
    "title": "string",
    "artist": "string",
    "releaseDate": "YYYY-MM-DD",
    "popularity": 0-100,
    "description": "Short interesting fact about the song"
  }
}
If not found or outside the year range, set found to false and song to null.`;

    return await callOpenRouter(
        apiKey,
        prompt,
        "You are a music information expert specializing in popular music."
    );
}

async function handleFetchLyrics(apiKey: string, title: string, artist: string) {
    // First, try to fetch synced LRC lyrics from LrcLib (free LRC lyrics API)
    try {
        const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        console.log('[LrcLib] Searching for:', title, '-', artist);

        const lrcResponse = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'MelodyTimeline/1.0 (https://melody-timeline.pages.dev)'
            }
        });

        if (lrcResponse.ok) {
            const results = await lrcResponse.json();

            if (results && results.length > 0) {
                // Find the best match (prefer synced lyrics)
                const bestMatch = results.find((r: any) => r.syncedLyrics) || results[0];

                if (bestMatch) {
                    const lyrics = bestMatch.syncedLyrics || bestMatch.plainLyrics;

                    if (lyrics) {
                        console.log('[LrcLib] Found lyrics for:', title);

                        // Generate visual prompt with AI since we got lyrics from LrcLib
                        let visualPrompt = `${title}_${artist}`.replace(/\s+/g, '_');
                        try {
                            const aiResult = await callOpenRouter(
                                apiKey,
                                `For the song "${title}" by "${artist}", provide a short, vivid English visual description (under 5 words) of the song's mood/vibe for an image generator. Return JSON: {"visualPrompt": "keywords"}`,
                                "You are a music visualization expert."
                            );
                            if (aiResult?.visualPrompt) {
                                visualPrompt = aiResult.visualPrompt;
                            }
                        } catch (e) {
                            console.log('[LrcLib] Could not get visual prompt from AI, using default');
                        }

                        return {
                            lyrics: lyrics,
                            visualPrompt: visualPrompt,
                            source: 'lrclib'
                        };
                    }
                }
            }
        }

        console.log('[LrcLib] No synced lyrics found, falling back to AI');
    } catch (error) {
        console.error('[LrcLib] Error fetching lyrics:', error);
    }

    // Fallback to AI-generated lyrics (without timestamps)
    const prompt = `Provide the full lyrics (in original language) for the song "${title}" by "${artist}". 
Also provide a short, vivid, English visual description of the album cover or the song's vibe (under 5 words) to be used as a seed for an image generator.
Return JSON in this format:
{
  "lyrics": "Full lyrics with line breaks",
  "visualPrompt": "short_visual_keywords"
}`;

    const result = await callOpenRouter(
        apiKey,
        prompt,
        "You are a music lyrics expert."
    );

    if (result) {
        result.source = 'ai';
    }

    return result;
}

async function handleEnrichMetadata(apiKey: string, title: string, artist: string) {
    const prompt = `Find information about the song "${title}" by "${artist}". Return JSON in this format:
{
  "found": true/false,
  "metadata": {
    "releaseDate": "YYYY-MM-DD",
    "popularity": 0-100,
    "description": "Short interesting fact about the song",
    "visualPrompt": "short_visual_keywords"
  }
}
If song not found or outside 1950-2026 range, set found to false.`;

    return await callOpenRouter(
        apiKey,
        prompt,
        "You are a music information expert specializing in popular music."
    );
}

// ============================================================================
// Supabase Functions
// ============================================================================

async function callSupabase(env: Env, endpoint: string, options: RequestInit = {}) {
    const url = `${env.SUPABASE_URL}/rest/v1/${endpoint}`;
    const timeoutMs = 100000; // Match current setting
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`Supabase request timed out after ${timeoutMs / 1000}s: ${url}`);
        controller.abort();
    }, timeoutMs);

    const startTime = Date.now();
    try {
        console.log(`Supabase Request: ${options.method || 'GET'} ${url}`);
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                "apikey": env.SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
                "Prefer": "return=representation",
                ...options.headers,
            }
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.log(`Supabase Response: ${response.status} (${duration}ms)`);

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Supabase error: ${response.status} - ${error}`);
        }

        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                console.error(`Supabase request ABORTED after ${duration}ms: ${url}`);
                throw new Error(`Supabase request timed out after ${timeoutMs / 1000}s: ${url}`);
            }
            console.error(`Supabase request FAILED after ${duration}ms: ${error.message}`);
        }
        throw error;
    }
}

async function handleGetAllSongs(env: Env) {
    return await callSupabase(env, "songs?select=*&order=release_date.asc");
}

// Get random songs with limit for initial page load
async function handleGetRandomSongs(env: Env, limit: number = 300) {
    // Supabase doesn't have built-in random, but we can use a workaround:
    // Get total count, then fetch with random offset chunks
    // For simplicity, we'll fetch all IDs first, shuffle in worker, then fetch details
    // But for performance, we'll use Supabase's random() function if available via RPC
    // Fallback: just get latest songs ordered randomly-ish by combining with popularity

    // Efficient approach: Use PostgreSQL's TABLESAMPLE or ORDER BY random()
    // Supabase REST API doesn't support random() directly, so we'll use a creative approach:
    // Order by a hash of id + current hour (changes every hour for variety)
    const hourSeed = Math.floor(Date.now() / 3600000); // Changes every hour

    // Get songs with limit, ordered by a pseudo-random factor
    // We'll use order by popularity desc, release_date desc to get a good mix
    // and limit the results
    const songs = await callSupabase(
        env,
        `songs?select=*&order=popularity.desc,release_date.desc&limit=${limit}`
    );

    // Shuffle the results for randomness (since Supabase doesn't support ORDER BY random())
    for (let i = songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songs[i], songs[j]] = [songs[j], songs[i]];
    }

    return songs;
}

// Search songs in database by title or artist
async function handleSearchSongsInDB(env: Env, query: string, limit: number = 50) {
    // Use ilike for case-insensitive search
    const encodedQuery = encodeURIComponent(`%${query}%`);
    return await callSupabase(
        env,
        `songs?select=*&or=(title.ilike.${encodedQuery},artist.ilike.${encodedQuery})&limit=${limit}`
    );
}

// Get a specific song by ID
async function handleGetSongById(env: Env, songId: string) {
    const results = await callSupabase(env, `songs?select=*&id=eq.${songId}`);
    return results?.[0] || null;
}

// Get songs by multiple IDs
async function handleGetSongsByIds(env: Env, songIds: string[]) {
    if (songIds.length === 0) return [];
    const idsParam = songIds.map(id => `"${id}"`).join(',');
    return await callSupabase(env, `songs?select=*&id=in.(${idsParam})`);
}

async function handleCreateSong(env: Env, song: any) {
    return await callSupabase(env, "songs", {
        method: "POST",
        body: JSON.stringify(song)
    });
}

async function handleUpdateSong(env: Env, id: string, updates: any) {
    return await callSupabase(env, `songs?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
    });
}

async function handleDeleteSong(env: Env, id: string) {
    return await callSupabase(env, `songs?id=eq.${id}`, {
        method: "DELETE"
    });
}

// ============================================================================
// Visitor Statistics Functions
// ============================================================================

async function handleTrackVisit(env: Env, ip: string, userAgent: string) {
    // Upsert: if IP exists, update last_seen; otherwise create new record
    try {
        const now = new Date().toISOString();

        // Check if IP exists
        const existing = await callSupabase(env, `visits?select=id&ip_address=eq.${encodeURIComponent(ip)}`);

        if (existing && existing.length > 0) {
            // Update existing record
            return await callSupabase(env, `visits?ip_address=eq.${encodeURIComponent(ip)}`, {
                method: "PATCH",
                body: JSON.stringify({ last_seen: now })
            });
        } else {
            // Create new record
            return await callSupabase(env, "visits", {
                method: "POST",
                body: JSON.stringify({
                    ip_address: ip,
                    user_agent: userAgent,
                    last_seen: now
                })
            });
        }
    } catch (error) {
        console.error('Error tracking visit:', error);
        throw error;
    }
}

async function handleGetStats(env: Env) {
    try {
        // Get total visits count
        const totalResult = await callSupabase(env, "visits?select=count");
        const totalVisits = totalResult?.[0]?.count || 0;

        // Get active users (last seen within 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const activeResult = await callSupabase(env, `visits?select=count&last_seen=gte.${fiveMinutesAgo}`);
        const activeUsers = activeResult?.[0]?.count || 0;

        return {
            totalVisits,
            activeUsers
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return { totalVisits: 0, activeUsers: 0 };
    }
}

// ============================================================================
// Song Like Functions
// ============================================================================

async function handleLikeSong(env: Env, songId: string, ip: string) {
    try {
        // Check if this IP has already liked this song
        const existing = await callSupabase(
            env,
            `song_likes?select=id&song_id=eq.${songId}&ip_address=eq.${encodeURIComponent(ip)}`
        );

        if (existing && existing.length > 0) {
            // Already liked - get current popularity
            const song = await callSupabase(env, `songs?select=popularity&id=eq.${songId}`);
            return {
                success: true,
                liked: false, // Already liked before
                alreadyLiked: true,
                newPopularity: song?.[0]?.popularity || 0
            };
        }

        // Insert like record
        await callSupabase(env, "song_likes", {
            method: "POST",
            body: JSON.stringify({
                song_id: songId,
                ip_address: ip
            })
        });

        // Increment popularity
        const song = await callSupabase(env, `songs?select=popularity&id=eq.${songId}`);
        const currentPopularity = song?.[0]?.popularity || 0;
        const newPopularity = currentPopularity + 1;

        await callSupabase(env, `songs?id=eq.${songId}`, {
            method: "PATCH",
            body: JSON.stringify({ popularity: newPopularity })
        });

        return {
            success: true,
            liked: true,
            alreadyLiked: false,
            newPopularity: newPopularity
        };
    } catch (error) {
        console.error('Error liking song:', error);
        throw error;
    }
}

async function handleCheckLiked(env: Env, songId: string, ip: string) {
    try {
        const existing = await callSupabase(
            env,
            `song_likes?select=id&song_id=eq.${songId}&ip_address=eq.${encodeURIComponent(ip)}`
        );
        return { liked: existing && existing.length > 0 };
    } catch (error) {
        console.error('Error checking like status:', error);
        return { liked: false };
    }
}

// ============================================================================
// CTFile Functions
// ============================================================================

async function handleListMusicFiles(env: Env) {
    const response = await fetch("https://rest.ctfile.com/v1/public/file/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session: env.CTFILE_TOKEN,
            folder_id: env.CTFILE_FOLDER_ID,
            filter: "music",
            orderby: "name"
        })
    });

    const data: any = await response.json();

    if (data.code !== 200) {
        throw new Error(`CTFile API error: ${data.message || data.code}`);
    }

    // Filter for audio files
    return data.results.filter((item: any) =>
        ["mp3", "flac", "wav", "wma", "audio"].includes(item.icon)
    );
}

async function handleGetPlayableUrl(env: Env, fileKey: string) {
    const fileId = fileKey.startsWith("f") ? fileKey.slice(1) : fileKey;

    const response = await fetch("https://rest.ctfile.com/v1/public/file/fetch_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session: env.CTFILE_TOKEN,
            file_id: fileId
        })
    });

    const data: any = await response.json();

    if (data.code !== 200) {
        throw new Error(`Failed to get download URL: ${data.message}`);
    }

    return data.download_url || null;
}

// Refresh an expired audio URL and update the database
async function handleRefreshAudioUrl(env: Env, songId: string, fileId: string) {
    // Get new download URL from CTFile
    const newAudioUrl = await handleGetPlayableUrl(env, fileId);

    if (!newAudioUrl) {
        throw new Error("Failed to get new audio URL from CTFile");
    }

    const now = new Date().toISOString();

    // Update the song in Supabase with new URL and timestamp
    await callSupabase(env, `songs?id=eq.${songId}`, {
        method: "PATCH",
        body: JSON.stringify({
            audio_url: newAudioUrl,
            audio_url_updated_at: now
        })
    });

    return {
        audioUrl: newAudioUrl,
        audioUrlUpdatedAt: now
    };
}

// ============================================================================
// Cloudflare Pages Functions Handler
// ============================================================================

// Handler function for incoming requests
async function handleRequest(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
        return new Response("Method not allowed", {
            status: 405,
            headers: corsHeaders
        });
    }

    try {
        const { action, data } = await request.json();
        let result;

        switch (action) {
            // AI Operations
            case "searchSong":
                result = await handleSearchSong(env.OPENROUTER_API_KEY, data.query);
                break;

            case "fetchLyrics":
                result = await handleFetchLyrics(env.OPENROUTER_API_KEY, data.title, data.artist);
                break;

            case "enrichMetadata":
                result = await handleEnrichMetadata(env.OPENROUTER_API_KEY, data.title, data.artist);
                break;

            // Supabase Operations
            case "getAllSongs":
                result = await handleGetAllSongs(env);
                break;

            case "getRandomSongs":
                result = await handleGetRandomSongs(env, data.limit || 300);
                break;

            case "searchSongsInDB":
                result = await handleSearchSongsInDB(env, data.query, data.limit || 50);
                break;

            case "getSongById":
                result = await handleGetSongById(env, data.songId);
                break;

            case "getSongsByIds":
                result = await handleGetSongsByIds(env, data.songIds);
                break;

            case "createSong":
                result = await handleCreateSong(env, data.song);
                break;

            case "updateSong":
                result = await handleUpdateSong(env, data.id, data.updates);
                break;

            case "deleteSong":
                result = await handleDeleteSong(env, data.id);
                break;

            // CTFile Operations
            case "listMusicFiles":
                result = await handleListMusicFiles(env);
                break;

            case "getPlayableUrl":
                result = await handleGetPlayableUrl(env, data.fileKey);
                break;

            // Refresh expired audio URL
            case "refreshAudioUrl":
                result = await handleRefreshAudioUrl(env, data.songId, data.fileId);
                break;

            // Visitor Statistics Operations
            case "trackVisit":
                const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
                const userAgent = request.headers.get('user-agent') || '';
                result = await handleTrackVisit(env, ip, userAgent);
                break;

            case "getStats":
                result = await handleGetStats(env);
                break;

            // Song Like Operations
            case "likeSong": {
                const likeIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
                result = await handleLikeSong(env, data.songId, likeIp);
                break;
            }

            case "checkLiked": {
                const checkIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
                result = await handleCheckLiked(env, data.songId, checkIp);
                break;
            }

            default:
                return new Response(
                    JSON.stringify({ error: "Invalid action" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    } catch (error) {
        console.error("Worker error:", error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
}

// Cloudflare Pages Functions exports
// PagesFunction type for Cloudflare Pages
interface PagesContext {
    request: Request;
    env: Env;
    params: Record<string, string>;
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException: () => void;
    next: () => Promise<Response>;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
    return handleRequest(context.request, context.env);
};

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
    return handleRequest(context.request, context.env);
};

export const onRequestOptions = async (_context: PagesContext): Promise<Response> => {
    return new Response(null, { headers: corsHeaders });
};
