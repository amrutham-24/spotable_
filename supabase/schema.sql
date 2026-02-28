-- Create workers table
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    rating NUMERIC DEFAULT 0,
    reviews INT DEFAULT 0,
    image_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    phone TEXT,
    color_code TEXT,
    status TEXT DEFAULT 'Available',
    next_available_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Worker Reviews/Ratings Table
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Assuming basic access for now)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Allow public insert reviews" ON reviews FOR INSERT WITH CHECK (true);

-- Saved Workers Table
CREATE TABLE IF NOT EXISTS saved_workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL DEFAULT 'user',
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, worker_id)
);

ALTER TABLE saved_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all saved_workers" ON saved_workers FOR ALL USING (true);

-- Enable Row Level Security (RLS)
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON public.workers
    FOR SELECT USING (true);

-- Allow public insert (for 'Add Worker' feature)
CREATE POLICY "Allow public insert" ON public.workers
    FOR INSERT WITH CHECK (true);

-- Storage bucket for worker images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('worker-images', 'worker-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING ( bucket_id = 'worker-images' );

CREATE POLICY "Public Upload" ON storage.objects
    FOR INSERT WITH CHECK ( bucket_id = 'worker-images' );
