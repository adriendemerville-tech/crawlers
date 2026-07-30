UPDATE public.autopilot_configs ac
SET force_content_cycle = true, updated_at = now()
FROM public.tracked_sites ts
WHERE ac.tracked_site_id = ts.id
  AND ts.domain ILIKE '%dictadevi.io%';