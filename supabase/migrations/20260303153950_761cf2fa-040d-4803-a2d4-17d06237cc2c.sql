
ALTER TABLE public.profiles
ADD COLUMN agency_brand_name text DEFAULT NULL,
ADD COLUMN agency_contact_first_name text DEFAULT NULL,
ADD COLUMN agency_contact_last_name text DEFAULT NULL,
ADD COLUMN agency_contact_phone text DEFAULT NULL,
ADD COLUMN agency_contact_email text DEFAULT NULL;
