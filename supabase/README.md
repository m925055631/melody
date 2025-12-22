# Supabase Database Setup

This file contains the SQL schema for the Melody Timeline music database.

## Setup Instructions

### 1. Run the Schema

1. Go to your Supabase Dashboard: https://sbp-2o0ycwcbagexxjpc.supabase.opentrust.net
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `schema.sql`
5. Click **Run** or press `Ctrl/Cmd + Enter`

### 2. Verify Setup

After running the schema, verify that:

1. **Schema Created**: The `music` schema exists
2. **Table Created**: The `music.songs` table exists with all columns
3. **Indexes Created**: Check that indexes on `release_date`, `artist`, and `title` exist
4. **RLS Enabled**: Row Level Security is enabled with public access policies

You can verify by running:

```sql
-- Check if schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'music';

-- Check if table exists
SELECT table_name FROM information_schema.tables WHERE table_schema = 'music' AND table_name = 'songs';

-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'music' AND table_name = 'songs';
```

### 3. Initial Data Migration

The application will automatically migrate the initial songs from `constants.tsx` to the database on first load. You don't need to do anything manually.

## Database Schema

The `music.songs` table contains:

- `id` (UUID): Primary key, auto-generated
- `title` (TEXT): Song title
- `artist` (TEXT): Artist name
- `release_date` (DATE): Release date in YYYY-MM-DD format
- `popularity` (INTEGER): Popularity score (0-100)
- `cover_url` (TEXT): URL to cover image
- `description` (TEXT): Optional description
- `audio_url` (TEXT): Optional URL to audio file (from CTFile)
- `lyrics` (TEXT): Optional song lyrics (from AI)
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp (auto-updated)

## Permissions

The schema grants public read/write access to anonymous and authenticated users through Row Level Security (RLS) policies. This allows the application to:

- Read all songs
- Insert new songs (from AI search or user uploads)
- Update songs (add lyrics, audio URLs, etc.)
- Delete songs (if needed in the future)

## Maintenance

### Backup

To backup your data:

```sql
-- Export all songs
SELECT * FROM music.songs ORDER BY release_date;
```

### Reset Database

To clear all songs and start fresh:

```sql
-- WARNING: This will delete all songs!
TRUNCATE music.songs;
```

The application will re-migrate the initial songs on next load.
