ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_listings_archived_at ON public.listings(archived_at);