CREATE TABLE public.listing_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_images_listing_id ON public.listing_images(listing_id, sort_order);

ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read listing_images" ON public.listing_images FOR SELECT USING (true);
CREATE POLICY "public write listing_images" ON public.listing_images FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_images" ON public.listing_images FOR UPDATE USING (true);
CREATE POLICY "public delete listing_images" ON public.listing_images FOR DELETE USING (true);