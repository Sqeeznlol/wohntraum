CREATE OR REPLACE FUNCTION public.auto_archive_non_zh()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS NULL 
     AND (NEW.postal_code IS NULL OR NEW.postal_code !~ '^8[0-9]{3}$') THEN
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_archive_non_zh ON public.listings;
CREATE TRIGGER trg_auto_archive_non_zh
BEFORE INSERT OR UPDATE OF postal_code ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.auto_archive_non_zh();