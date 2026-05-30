select cron.unschedule('enrich-incomplete-listings');

select cron.schedule(
  'enrich-incomplete-listings',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://rkodrceircqqzanwzpsb.supabase.co/functions/v1/enrich-listing',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"all_incomplete": true, "limit": 25}'::jsonb
  );
  $$
);