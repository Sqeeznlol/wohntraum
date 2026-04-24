CREATE TABLE IF NOT EXISTS public.listing_viewings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL,
  viewing_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attendees TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_viewings_listing_id ON public.listing_viewings(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_viewings_viewing_at ON public.listing_viewings(viewing_at);

ALTER TABLE public.listing_viewings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read listing_viewings" ON public.listing_viewings FOR SELECT USING (true);
CREATE POLICY "public write listing_viewings" ON public.listing_viewings FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_viewings" ON public.listing_viewings FOR UPDATE USING (true);
CREATE POLICY "public delete listing_viewings" ON public.listing_viewings FOR DELETE USING (true);

CREATE TRIGGER update_listing_viewings_updated_at
BEFORE UPDATE ON public.listing_viewings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
