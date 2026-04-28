ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS heating_type text,
  ADD COLUMN IF NOT EXISTS energy_source text,
  ADD COLUMN IF NOT EXISTS canton text,
  ADD COLUMN IF NOT EXISTS usage_zone text,
  ADD COLUMN IF NOT EXISTS geo_researched boolean NOT NULL DEFAULT false;

UPDATE public.listings
SET geo_researched = true
WHERE gwr_enriched_at IS NOT NULL AND geo_researched = false;