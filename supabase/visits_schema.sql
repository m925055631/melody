-- Create visits table for tracking unique visitors
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visits_ip ON public.visits(ip_address);
CREATE INDEX IF NOT EXISTS idx_visits_last_seen ON public.visits(last_seen);

-- Create unique constraint (one record per IP)
CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_ip_unique ON public.visits(ip_address);

-- Enable Row Level Security
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access" ON public.visits
    FOR SELECT
    USING (true);

-- Create policy for public insert/update access (for upsert)
CREATE POLICY "Allow public upsert access" ON public.visits
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.visits
    FOR UPDATE
    USING (true);
