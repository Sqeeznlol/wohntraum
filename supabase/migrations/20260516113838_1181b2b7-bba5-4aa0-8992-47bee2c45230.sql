
-- Auto-detect apartments and archive them on insert/update
CREATE OR REPLACE FUNCTION public.auto_archive_apartments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  hay text;
  is_apartment boolean := false;
  is_house_or_land boolean := false;
BEGIN
  -- Only act on inserts where not already archived
  IF NEW.archived_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  hay := lower(coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));

  -- House / Grundstueck keywords win
  IF hay ~ '(einfamilienhaus|\mefh\m|villa|chalet|reihenhaus|doppelhaus|mehrfamilienhaus|\mmfh\m|liegenschaft|bauernhaus|landhaus|grundst(ü|ue)ck|parzelle|bauland|bauparzelle|bauliegenschaft|baugrundst(ü|ue)ck|bauplatz|\mhaus\m)' THEN
    is_house_or_land := true;
  END IF;

  IF hay ~ '(wohnung|appartement|studio|loft|dachwohnung|attikawohnung|maisonette|apartment|mietwohnung|eigentumswohnung|stockwerkeigentum|\mstwe\m|wohneinheit)' THEN
    is_apartment := true;
  END IF;

  -- Building category from GWR - apartment buildings considered ok (Mehrfamilienhaus = house)
  -- Only archive if apartment keyword found and no house/land keyword
  IF is_apartment AND NOT is_house_or_land THEN
    NEW.archived_at := now();
    NEW.status := 'archived';
    NEW.extra_notes := coalesce(NEW.extra_notes || E'\n', '') || 'Auto-archiviert: Wohnung erkannt';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_archive_apartments ON public.listings;
CREATE TRIGGER trg_auto_archive_apartments
BEFORE INSERT ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.auto_archive_apartments();
