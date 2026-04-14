UPDATE public.async_jobs 
SET status = 'error', 
    error_message = 'Stuck at 55% — timeout silencieux, relancé manuellement',
    completed_at = now()
WHERE id = '0ef79741-8487-40f1-a519-c69d922607f6' 
AND status = 'processing';