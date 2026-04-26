
CREATE TABLE public.visitor_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  os TEXT,
  browser TEXT,
  device_type TEXT,
  hostname TEXT,
  country TEXT,
  city TEXT,
  language TEXT,
  referrer TEXT,
  path TEXT,
  visit_count INTEGER NOT NULL DEFAULT 1,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  custom_label TEXT,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX visitor_log_ip_unique ON public.visitor_log(ip_address);
CREATE INDEX visitor_log_last_seen_idx ON public.visitor_log(last_seen_at DESC);

ALTER TABLE public.visitor_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read visitor_log" ON public.visitor_log FOR SELECT USING (true);
CREATE POLICY "public write visitor_log" ON public.visitor_log FOR INSERT WITH CHECK (true);
CREATE POLICY "public update visitor_log" ON public.visitor_log FOR UPDATE USING (true);
CREATE POLICY "public delete visitor_log" ON public.visitor_log FOR DELETE USING (true);

CREATE TRIGGER update_visitor_log_updated_at
BEFORE UPDATE ON public.visitor_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
