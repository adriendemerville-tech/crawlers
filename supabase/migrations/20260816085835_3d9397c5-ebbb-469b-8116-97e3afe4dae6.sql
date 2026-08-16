UPDATE public.async_jobs
SET status='processing', error_message=NULL, completed_at=NULL, updated_at=now() - interval '10 minutes'
WHERE id = '8148a37c-2606-48b9-9dea-657f00e81f7b'
  AND function_name='marina';