-- Add extra notes field to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS extra_notes TEXT;

-- Create listing_documents table for PDF uploads
CREATE TABLE IF NOT EXISTS public.listing_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_documents_listing_id ON public.listing_documents(listing_id);

ALTER TABLE public.listing_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read listing_documents" ON public.listing_documents FOR SELECT USING (true);
CREATE POLICY "public write listing_documents" ON public.listing_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_documents" ON public.listing_documents FOR UPDATE USING (true);
CREATE POLICY "public delete listing_documents" ON public.listing_documents FOR DELETE USING (true);

-- Create storage bucket for listing documents (public so we can preview PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-documents', 'listing-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read listing-documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-documents');

CREATE POLICY "Public upload listing-documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'listing-documents');

CREATE POLICY "Public update listing-documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'listing-documents');

CREATE POLICY "Public delete listing-documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'listing-documents');
