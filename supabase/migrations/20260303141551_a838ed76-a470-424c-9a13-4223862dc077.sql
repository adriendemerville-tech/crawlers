
ALTER TABLE public.profiles
ADD COLUMN agency_logo_url text DEFAULT NULL,
ADD COLUMN agency_primary_color text DEFAULT NULL;
