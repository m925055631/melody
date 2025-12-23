// Local development server for API functions
// This runs the same logic as Cloudflare Pages Functions but in Node.js

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .dev.vars
function loadDevVars() {
    try {
        const content = readFileSync(resolve(__dirname, '.dev.vars'), 'utf-8');
        const vars = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    let value = valueParts.join('=').trim();
                    // Remove surrounding quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    vars[key.trim()] = value;
                }
            }
        });
        return vars;
    } catch (e) {
        console.error('Failed to load .dev.vars:', e.message);
        return {};
    }
}

const env = loadDevVars();

console.log('Loaded environment variables:', Object.keys(env).map(k => `${k}=(hidden)`).join(', '));

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

// OpenRouter AI Functions
async function callOpenRouter(apiKey, prompt, systemPrompt) {
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
    return content ? JSON.parse(content) : null;
}

async function handleSearchSong(apiKey, query) {
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

    return await callOpenRouter(apiKey, prompt, "You are a music information expert specializing in popular music.");
}

async function handleFetchLyrics(apiKey, title, artist) {
    const prompt = `Provide the full lyrics (in original language) for the song "${title}" by "${artist}". 
Also provide a short, vivid, English visual description of the album cover or the song's vibe (under 5 words) to be used as a seed for an image generator.
Return JSON in this format:
{
  "lyrics": "Full lyrics with line breaks",
  "visualPrompt": "short_visual_keywords"
}`;

    return await callOpenRouter(apiKey, prompt, "You are a music lyrics expert.");
}

async function handleEnrichMetadata(apiKey, title, artist) {
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

    return await callOpenRouter(apiKey, prompt, "You are a music information expert specializing in popular music.");
}

// Supabase Functions
async function callSupabase(endpoint, options = {}) {
    const url = `${env.SUPABASE_URL}/rest/v1/${endpoint}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "apikey": env.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
            "Prefer": "return=representation",
            ...options.headers,
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supabase error: ${response.status} - ${error}`);
    }

    return await response.json();
}

async function handleGetAllSongs() {
    return await callSupabase("songs?select=*&order=release_date.asc");
}

async function handleCreateSong(song) {
    return await callSupabase("songs", {
        method: "POST",
        body: JSON.stringify(song)
    });
}

async function handleUpdateSong(id, updates) {
    return await callSupabase(`songs?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
    });
}

async function handleDeleteSong(id) {
    return await callSupabase(`songs?id=eq.${id}`, {
        method: "DELETE"
    });
}

// CTFile Functions
async function handleListMusicFiles() {
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

    const data = await response.json();
    if (data.code !== 200) {
        throw new Error(`CTFile API error: ${data.message || data.code}`);
    }

    return data.results.filter(item =>
        ["mp3", "flac", "wav", "wma", "audio"].includes(item.icon)
    );
}

async function handleGetPlayableUrl(fileKey) {
    const fileId = fileKey.startsWith("f") ? fileKey.slice(1) : fileKey;

    const response = await fetch("https://rest.ctfile.com/v1/public/file/fetch_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session: env.CTFILE_TOKEN,
            file_id: fileId
        })
    });

    const data = await response.json();
    if (data.code !== 200) {
        throw new Error(`Failed to get download URL: ${data.message}`);
    }

    return data.download_url || null;
}

// Visitor Stats
async function handleTrackVisit(ip, userAgent) {
    try {
        const now = new Date().toISOString();
        const existing = await callSupabase(`visits?select=id&ip_address=eq.${encodeURIComponent(ip)}`);

        if (existing && existing.length > 0) {
            return await callSupabase(`visits?ip_address=eq.${encodeURIComponent(ip)}`, {
                method: "PATCH",
                body: JSON.stringify({ last_seen: now })
            });
        } else {
            return await callSupabase("visits", {
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

async function handleGetStats() {
    try {
        const totalResult = await callSupabase("visits?select=count");
        const totalVisits = totalResult?.[0]?.count || 0;

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const activeResult = await callSupabase(`visits?select=count&last_seen=gte.${fiveMinutesAgo}`);
        const activeUsers = activeResult?.[0]?.count || 0;

        return { totalVisits, activeUsers };
    } catch (error) {
        console.error('Error getting stats:', error);
        return { totalVisits: 0, activeUsers: 0 };
    }
}

// Request Handler
async function handleRequest(req, body, clientIP) {
    const { action, data } = body;
    let result;

    switch (action) {
        case "searchSong":
            result = await handleSearchSong(env.OPENROUTER_API_KEY, data.query);
            break;
        case "fetchLyrics":
            result = await handleFetchLyrics(env.OPENROUTER_API_KEY, data.title, data.artist);
            break;
        case "enrichMetadata":
            result = await handleEnrichMetadata(env.OPENROUTER_API_KEY, data.title, data.artist);
            break;
        case "getAllSongs":
            result = await handleGetAllSongs();
            break;
        case "createSong":
            result = await handleCreateSong(data.song);
            break;
        case "updateSong":
            result = await handleUpdateSong(data.id, data.updates);
            break;
        case "deleteSong":
            result = await handleDeleteSong(data.id);
            break;
        case "listMusicFiles":
            result = await handleListMusicFiles();
            break;
        case "getPlayableUrl":
            result = await handleGetPlayableUrl(data.fileKey);
            break;
        case "trackVisit":
            const userAgent = req.headers['user-agent'] || '';
            result = await handleTrackVisit(clientIP, userAgent);
            break;
        case "getStats":
            result = await handleGetStats();
            break;
        default:
            throw new Error("Invalid action");
    }

    return result;
}

// HTTP Server
const server = createServer(async (req, res) => {
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Only accept POST to /api/ai
    if (req.method !== 'POST' || !req.url.startsWith('/api/ai')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
    }

    // Parse body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const parsed = JSON.parse(body);
            const clientIP = req.socket.remoteAddress || 'unknown';

            console.log(`[API] ${parsed.action}`);
            const result = await handleRequest(req, parsed, clientIP);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (error) {
            console.error('[API Error]', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
});

const PORT = 8788;
server.listen(PORT, () => {
    console.log(`\n🚀 API Server running at http://localhost:${PORT}/api/ai\n`);
    console.log('Available actions:');
    console.log('  - getAllSongs, createSong, updateSong, deleteSong');
    console.log('  - searchSong, fetchLyrics, enrichMetadata');
    console.log('  - listMusicFiles, getPlayableUrl');
    console.log('  - trackVisit, getStats\n');
});
