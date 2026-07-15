
CREATE TABLE IF NOT EXISTS public.suchabo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kontakt TEXT NOT NULL,
  kanal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (kanal IN ('web','whatsapp')),
  filter_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  zuletzt_geaendert TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.suchabo TO service_role;
ALTER TABLE public.suchabo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access suchabo" ON public.suchabo FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lead (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inserat_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  suchabo_id UUID REFERENCES public.suchabo(id) ON DELETE SET NULL,
  kanal TEXT NOT NULL CHECK (kanal IN ('web','whatsapp')),
  status TEXT NOT NULL DEFAULT 'neu' CHECK (status IN ('neu','kontaktiert','abgeschlossen')),
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead TO service_role;
ALTER TABLE public.lead ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access lead" ON public.lead FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.whatsapp_nachricht (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefon TEXT NOT NULL,
  richtung TEXT NOT NULL CHECK (richtung IN ('ein','aus')),
  inhalt TEXT NOT NULL,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_nachricht TO service_role;
ALTER TABLE public.whatsapp_nachricht ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access whatsapp_nachricht" ON public.whatsapp_nachricht FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_suchabo_aktiv ON public.suchabo(aktiv) WHERE aktiv = true;
CREATE INDEX IF NOT EXISTS idx_suchabo_kontakt ON public.suchabo(kontakt);
CREATE INDEX IF NOT EXISTS idx_whatsapp_telefon ON public.whatsapp_nachricht(telefon);
CREATE INDEX IF NOT EXISTS idx_lead_suchabo ON public.lead(suchabo_id);
