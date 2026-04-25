-- Tracking-Wrapper aus listings.primary_url entfernen
UPDATE public.listings
SET primary_url = NULL
WHERE primary_url ~* '(sendgrid\.net|mailchimp|hubspot|/ls/click|click\.[a-z0-9]+\.|u[0-9]+\.ct\.sendgrid)';

-- Tracking-Wrapper aus listing_sources.url entfernen
DELETE FROM public.listing_sources
WHERE url ~* '(sendgrid\.net|mailchimp|hubspot|/ls/click|click\.[a-z0-9]+\.|u[0-9]+\.ct\.sendgrid)';