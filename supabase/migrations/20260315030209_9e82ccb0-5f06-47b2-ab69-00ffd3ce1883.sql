-- Remove duplicate rows keeping only the latest one per (tracked_site_id, week_start_date)
DELETE FROM public.ias_history a
USING public.ias_history b
WHERE a.tracked_site_id = b.tracked_site_id
  AND a.week_start_date = b.week_start_date
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE public.ias_history 
ADD CONSTRAINT ias_history_tracked_site_id_week_start_date_key 
UNIQUE (tracked_site_id, week_start_date);