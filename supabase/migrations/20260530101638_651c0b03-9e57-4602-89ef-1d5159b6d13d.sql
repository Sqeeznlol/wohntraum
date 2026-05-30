
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS source_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_source_available ON public.listings(source_available) WHERE archived_at IS NULL;
