UPDATE public.site_crawls
SET status = 'failed',
    error_message = 'Crawl interrompu automatiquement : aucune progression depuis plus de 2 h (nettoyage rétroactif du reaper).',
    completed_at = now()
WHERE status IN ('pending','processing','queued','crawling')
  AND created_at < now() - interval '2 hours';