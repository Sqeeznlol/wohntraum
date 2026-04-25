CREATE TABLE public.listing_prechecks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_prechecks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read listing_prechecks"
  ON public.listing_prechecks FOR SELECT USING (true);
CREATE POLICY "public write listing_prechecks"
  ON public.listing_prechecks FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_prechecks"
  ON public.listing_prechecks FOR UPDATE USING (true);
CREATE POLICY "public delete listing_prechecks"
  ON public.listing_prechecks FOR DELETE USING (true);

CREATE TRIGGER trg_listing_prechecks_updated_at
  BEFORE UPDATE ON public.listing_prechecks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_listing_prechecks_listing_id ON public.listing_prechecks(listing_id);