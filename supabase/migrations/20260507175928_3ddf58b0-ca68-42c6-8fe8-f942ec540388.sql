ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS bewertet_von text;

CREATE TABLE IF NOT EXISTS public.tim_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('yes','no')),
  price_chf numeric,
  price_per_sqm numeric,
  area_sqm numeric,
  rooms numeric,
  building_year integer,
  parcel_area_sqm numeric,
  municipality text,
  canton text,
  usage_zone text,
  portal text,
  floor_count integer,
  swiped_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tim_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read tim_preferences" ON public.tim_preferences FOR SELECT USING (true);
CREATE POLICY "public write tim_preferences" ON public.tim_preferences FOR INSERT WITH CHECK (true);
CREATE POLICY "public update tim_preferences" ON public.tim_preferences FOR UPDATE USING (true);
CREATE POLICY "public delete tim_preferences" ON public.tim_preferences FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tim_preferences;
ALTER TABLE public.tim_preferences REPLICA IDENTITY FULL;