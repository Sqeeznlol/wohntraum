
-- Create public storage bucket for listing images (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read policy
DROP POLICY IF EXISTS "Public read listing-images" ON storage.objects;
CREATE POLICY "Public read listing-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

-- Service role bypasses RLS, so no insert/update/delete policy needed for the edge function
