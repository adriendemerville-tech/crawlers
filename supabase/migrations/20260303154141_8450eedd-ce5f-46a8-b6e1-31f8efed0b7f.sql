
ALTER TABLE public.profiles
ADD COLUMN agency_report_header_text text DEFAULT NULL,
ADD COLUMN agency_report_footer_text text DEFAULT NULL;
