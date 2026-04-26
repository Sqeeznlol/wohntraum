ALTER TABLE public.visitor_log
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS postal text,
  ADD COLUMN IF NOT EXISTS isp text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS device_name text;

CREATE INDEX IF NOT EXISTS idx_visitor_log_ip ON public.visitor_log(ip_address);