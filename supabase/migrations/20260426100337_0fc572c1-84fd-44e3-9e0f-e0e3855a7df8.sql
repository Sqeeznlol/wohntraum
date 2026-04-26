
-- Track progress of contacted listings
CREATE TABLE public.listing_contact_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL UNIQUE,
  current_step TEXT NOT NULL DEFAULT 'message_sent',
  steps JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_contact_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read listing_contact_progress" ON public.listing_contact_progress FOR SELECT USING (true);
CREATE POLICY "public write listing_contact_progress" ON public.listing_contact_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_contact_progress" ON public.listing_contact_progress FOR UPDATE USING (true);
CREATE POLICY "public delete listing_contact_progress" ON public.listing_contact_progress FOR DELETE USING (true);

CREATE TRIGGER update_listing_contact_progress_updated_at
BEFORE UPDATE ON public.listing_contact_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_listing_contact_progress_listing ON public.listing_contact_progress(listing_id);
