-- Create public schema
CREATE SCHEMA IF NOT EXISTS public;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create songs table in public schema
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    release_date DATE NOT NULL,
    popularity INTEGER CHECK (popularity >= 0 AND popularity <= 100),
    cover_url TEXT,
    description TEXT,
    audio_url TEXT,
    lyrics TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_songs_release_date ON public.songs(release_date);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON public.songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_title ON public.songs(title);

-- Enable Row Level Security
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access" ON public.songs
    FOR SELECT
    USING (true);

-- Create policy for public insert access
CREATE POLICY "Allow public insert access" ON public.songs
    FOR INSERT
    WITH CHECK (true);

-- Create policy for public update access
CREATE POLICY "Allow public update access" ON public.songs
    FOR UPDATE
    USING (true);

-- Create policy for public delete access
CREATE POLICY "Allow public delete access" ON public.songs
    FOR DELETE
    USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant permissions on songs table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO anon, authenticated;
