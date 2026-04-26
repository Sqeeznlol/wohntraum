CREATE TABLE IF NOT EXISTS public.visitor_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  session_id text,
  event_type text NOT NULL,
  event_label text,
  path text,
  listing_id uuid,
  target_id text,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visitor_activity_ip ON public.visitor_activity (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_activity_listing ON public.visitor_activity (listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_activity_type ON public.visitor_activity (event_type);

ALTER TABLE public.visitor_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read visitor_activity" ON public.visitor_activity FOR SELECT USING (true);
CREATE POLICY "public write visitor_activity" ON public.visitor_activity FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete visitor_activity" ON public.visitor_activity FOR DELETE USING (true);