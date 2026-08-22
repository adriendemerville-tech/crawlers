INSERT INTO public.marketplace_pricing_constants (version, key, value, active)
VALUES
  (1, 'vat_rate_fr', '0.20'::jsonb, true),
  (1, 'invoice_series_prefix', '"CRW"'::jsonb, true),
  (1, 'link_chain_min_loop_length', '3'::jsonb, true),
  (1, 'studio_max_output_chars', '1800'::jsonb, true)
ON CONFLICT DO NOTHING;