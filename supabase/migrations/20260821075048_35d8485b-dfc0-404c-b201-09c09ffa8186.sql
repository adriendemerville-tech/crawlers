UPDATE public.google_connections
SET gmb_account_id = split_part(gmb_account_id, '/', 2)
WHERE gmb_account_id LIKE 'accounts/%';

UPDATE public.google_connections
SET gmb_location_id = split_part(gmb_location_id, '/', 2)
WHERE gmb_location_id LIKE 'locations/%';