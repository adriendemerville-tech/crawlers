ALTER TABLE public.tracked_sites
  ADD COLUMN company_size text DEFAULT NULL,
  ADD COLUMN address text DEFAULT NULL,
  ADD COLUMN market_sector text DEFAULT NULL,
  ADD COLUMN commercial_area text DEFAULT NULL,
  ADD COLUMN target_audience text DEFAULT NULL,
  ADD COLUMN products_services text DEFAULT NULL;