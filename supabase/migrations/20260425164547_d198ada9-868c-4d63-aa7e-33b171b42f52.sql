-- Sendgrid/Mailchimp/Hubspot Tracking-Wrapper aus image_url entfernen.
-- Diese URLs sind keine echten Bilder, sondern Click-Tracker; das Frontend
-- fällt dann automatisch auf listing_images zurück.
UPDATE public.listings
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url ~* '(sendgrid\.net|mailchimp|hubspot|/ls/click|click\.[a-z0-9]+\.)';