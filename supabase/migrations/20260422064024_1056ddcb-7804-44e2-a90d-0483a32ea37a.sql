ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS egid bigint,
  ADD COLUMN IF NOT EXISTS building_year integer,
  ADD COLUMN IF NOT EXISTS floors integer,
  ADD COLUMN IF NOT EXISTS dwellings integer,
  ADD COLUMN IF NOT EXISTS gwr_enriched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_listings_egid ON public.listings(egid);