-- Portale als Enum
CREATE TYPE public.portal AS ENUM (
  'immoscout24',
  'homegate',
  'flatfox',
  'casasoft',
  'immostreet',
  'home_ch',
  'newhome',
  'other'
);

CREATE TYPE public.listing_status AS ENUM (
  'new',
  'interested',
  'contacted',
  'visited',
  'rejected'
);

CREATE TYPE public.email_status AS ENUM (
  'received',
  'processing',
  'processed',
  'failed'
);

-- Roh-Mails
CREATE TABLE public.raw_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  html_body TEXT,
  text_body TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.email_status NOT NULL DEFAULT 'received',
  error_message TEXT,
  listings_extracted INT NOT NULL DEFAULT 0,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserate
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price_chf NUMERIC(12,2),
  area_sqm NUMERIC(10,2),
  price_per_sqm NUMERIC(12,2) GENERATED ALWAYS AS (
    CASE WHEN area_sqm > 0 AND price_chf IS NOT NULL THEN price_chf / area_sqm ELSE NULL END
  ) STORED,
  rooms NUMERIC(4,1),
  city TEXT,
  postal_code TEXT,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  primary_portal public.portal NOT NULL DEFAULT 'other',
  primary_url TEXT,
  image_url TEXT,
  status public.listing_status NOT NULL DEFAULT 'new',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  fingerprint TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_fingerprint ON public.listings(fingerprint);
CREATE INDEX idx_listings_price_per_sqm ON public.listings(price_per_sqm);
CREATE INDEX idx_listings_city ON public.listings(city);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_created_at ON public.listings(created_at DESC);

-- Quellen je Inserat (für Duplikate)
CREATE TABLE public.listing_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  raw_email_id UUID REFERENCES public.raw_emails(id) ON DELETE SET NULL,
  portal public.portal NOT NULL,
  url TEXT,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_listing_sources_listing ON public.listing_sources(listing_id);

-- Alert-Regeln
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  max_price_per_sqm NUMERIC(12,2),
  city_filter TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated-At Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_listings_updated_at
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS aktivieren (Single-User: öffentlich erlaubt)
ALTER TABLE public.raw_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

-- Policies (Single-User App ohne Login: alles offen)
CREATE POLICY "public read raw_emails" ON public.raw_emails FOR SELECT USING (true);
CREATE POLICY "public write raw_emails" ON public.raw_emails FOR INSERT WITH CHECK (true);
CREATE POLICY "public update raw_emails" ON public.raw_emails FOR UPDATE USING (true);
CREATE POLICY "public delete raw_emails" ON public.raw_emails FOR DELETE USING (true);

CREATE POLICY "public read listings" ON public.listings FOR SELECT USING (true);
CREATE POLICY "public write listings" ON public.listings FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listings" ON public.listings FOR UPDATE USING (true);
CREATE POLICY "public delete listings" ON public.listings FOR DELETE USING (true);

CREATE POLICY "public read listing_sources" ON public.listing_sources FOR SELECT USING (true);
CREATE POLICY "public write listing_sources" ON public.listing_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "public update listing_sources" ON public.listing_sources FOR UPDATE USING (true);
CREATE POLICY "public delete listing_sources" ON public.listing_sources FOR DELETE USING (true);

CREATE POLICY "public read alert_rules" ON public.alert_rules FOR SELECT USING (true);
CREATE POLICY "public write alert_rules" ON public.alert_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "public update alert_rules" ON public.alert_rules FOR UPDATE USING (true);
CREATE POLICY "public delete alert_rules" ON public.alert_rules FOR DELETE USING (true);