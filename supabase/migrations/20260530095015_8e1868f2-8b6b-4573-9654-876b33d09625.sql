-- Schedule enrich-listing cron job (idempotent)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'enrich-incomplete-listings') then
    perform cron.unschedule('enrich-incomplete-listings');
  end if;
end$$;

select cron.schedule(
  'enrich-incomplete-listings',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://rkodrceircqqzanwzpsb.supabase.co/functions/v1/enrich-listing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
    ),
    body := '{"all_incomplete": true, "limit": 25}'::jsonb
  );
  $$
);