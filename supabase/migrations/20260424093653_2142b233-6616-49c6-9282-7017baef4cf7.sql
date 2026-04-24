CREATE TABLE public.listing_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read listing_notes" ON public.listing_notes FOR SELECT USING (true);
CREATE POLICY "public write listing_notes" ON public.listing_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_notes" ON public.listing_notes FOR UPDATE USING (true);
CREATE POLICY "public delete listing_notes" ON public.listing_notes FOR DELETE USING (true);

CREATE TRIGGER update_listing_notes_updated_at
BEFORE UPDATE ON public.listing_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_listing_notes_listing_id ON public.listing_notes(listing_id, created_at DESC);