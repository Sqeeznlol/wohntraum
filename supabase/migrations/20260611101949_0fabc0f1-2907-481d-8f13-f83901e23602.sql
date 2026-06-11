
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS zone_name text,
  ADD COLUMN IF NOT EXISTS heating_generator text,
  ADD COLUMN IF NOT EXISTS heating_energy_source text,
  ADD COLUMN IF NOT EXISTS heating_updated_at text,
  ADD COLUMN IF NOT EXISTS construction_period text,
  ADD COLUMN IF NOT EXISTS apartments_in_building integer,
  ADD COLUMN IF NOT EXISTS price_per_sqm_land numeric(12,2),
  ADD COLUMN IF NOT EXISTS gis_enriched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gis_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS gis_enrich_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gis_enrich_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_company text;

CREATE INDEX IF NOT EXISTS idx_listings_gis_pending
  ON public.listings (gis_enriched, gis_enrich_failed)
  WHERE archived_at IS NULL AND gis_enriched = false AND gis_enrich_failed = false;

-- Bereits angereicherte (gwr_enriched_at gesetzt) als gis_enriched=true markieren
UPDATE public.listings
   SET gis_enriched = true,
       gis_enriched_at = gwr_enriched_at
 WHERE gwr_enriched_at IS NOT NULL AND gis_enriched = false;
