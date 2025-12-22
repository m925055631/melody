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
const OPENROUTER_MODEL = "google/gemini-2.5-flash";

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
    const prompt = `Search for the Chinese song "${query}". If it exists and was released between 1950 and 2024, return its details in JSON format with this structure:
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
        "You are a music information expert specializing in Chinese popular music."
    );
}

async function handleFetchLyrics(apiKey: string, title: string, artist: string) {
    const prompt = `Provide the full lyrics (in original language) for the song "${title}" by "${artist}". 
Also provide a short, vivid, English visual description of the album cover or the song's vibe (under 5 words) to be used as a seed for an image generator.
Return JSON in this format:
{
  "lyrics": "Full lyrics with line breaks",
  "visualPrompt": "short_visual_keywords"
}`;

    return await callOpenRouter(
        apiKey,
        prompt,
        "You are a music lyrics expert."
    );
}

async function handleEnrichMetadata(apiKey: string, title: string, artist: string) {
    const prompt = `Find information about the Chinese song "${title}" by "${artist}". Return JSON in this format:
{
  "found": true/false,
  "metadata": {
    "releaseDate": "YYYY-MM-DD",
    "popularity": 0-100,
    "description": "Short interesting fact about the song",
    "visualPrompt": "short_visual_keywords"
  }
}
If song not found or outside 1950-2024 range, set found to false.`;

    return await callOpenRouter(
        apiKey,
        prompt,
        "You are a music information expert specializing in Chinese popular music."
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

// ============================================================================
// Main Handler
// ============================================================================

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
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

                // Visitor Statistics Operations
                case "trackVisit":
                    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
                    const userAgent = request.headers.get('user-agent') || '';
                    result = await handleTrackVisit(env, ip, userAgent);
                    break;

                case "getStats":
                    result = await handleGetStats(env);
                    break;

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
};
