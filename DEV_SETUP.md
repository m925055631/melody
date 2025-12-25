# Development Setup

## Fixed Approach - Vite Proxies to Wrangler

The `--proxy` flag in Wrangler Pages is deprecated, so we use Vite's proxy instead.

## Running the Development Servers

### Terminal 1: Start API Server (Wrangler)

```bash
npm run dev:api
```

This starts the Cloudflare Functions on port 8787 to handle `/api/*` requests.

### Terminal 2: Start Frontend (Vite)

```bash
npm run dev
```

This starts Vite on port 5174, which proxies `/api/*` requests to Wrangler on 8787.

**Access the app at:** `http://localhost:5174`

## How It Works

- **Frontend**: Vite dev server on port 5174 (with HMR)
- **API**: Wrangler Functions on port 8787
- **Proxy**: Vite proxies `/api/*` → `http://localhost:8787/api/*`

All your API calls will work seamlessly through Vite's proxy!

## Environment Variables

Ensure your `.dev.vars` file contains:

- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CTFILE_FOLDER_ID`
- `CTFILE_TOKEN`
