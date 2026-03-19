-- =============================================
-- SCALABILITY: Composite indexes for hot queries
-- =============================================

-- serp_snapshots: SERP tracking queries by site + date
CREATE INDEX IF NOT EXISTS idx_serp_snapshots_site_measured
ON public.serp_snapshots (tracked_site_id, measured_at DESC);

-- revenue_events: ROI calculation queries by site + date range
CREATE INDEX IF NOT EXISTS idx_revenue_events_site_date
ON public.revenue_events (tracked_site_id, transaction_date DESC);

-- gsc_history_log: GSC trend queries
CREATE INDEX IF NOT EXISTS idx_gsc_history_site_week
ON public.gsc_history_log (tracked_site_id, week_start_date DESC);

-- ga4_history_log: GA4 trend queries
CREATE INDEX IF NOT EXISTS idx_ga4_history_site_week
ON public.ga4_history_log (tracked_site_id, week_start_date DESC);

-- backlink_snapshots: backlink trend queries
CREATE INDEX IF NOT EXISTS idx_backlink_snapshots_site_week
ON public.backlink_snapshots (tracked_site_id, week_start_date DESC);

-- audit_cache: cache lookups by key + expiry
CREATE INDEX IF NOT EXISTS idx_audit_cache_key_expires
ON public.audit_cache (cache_key, expires_at DESC);

-- domain_data_cache: cache lookups by domain + type + expiry
CREATE INDEX IF NOT EXISTS idx_domain_cache_lookup
ON public.domain_data_cache (domain, data_type, expires_at DESC);

-- crawl_pages: pages by crawl_id for crawl result views
CREATE INDEX IF NOT EXISTS idx_crawl_pages_crawl_score
ON public.crawl_pages (crawl_id, seo_score DESC NULLS LAST);

-- analytics_events: fair_use check queries (user + type + date)
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type_date
ON public.analytics_events (user_id, event_type, created_at DESC);

-- Drop redundant single-column index (covered by composite above)
DROP INDEX IF EXISTS idx_analytics_events_event_type;

-- Deduplicate audit_recommendations_registry before adding unique constraint
DELETE FROM public.audit_recommendations_registry a
USING public.audit_recommendations_registry b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.url = b.url
  AND a.recommendation_id = b.recommendation_id;

-- Now add unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_reco_per_audit
ON public.audit_recommendations_registry (user_id, url, recommendation_id);