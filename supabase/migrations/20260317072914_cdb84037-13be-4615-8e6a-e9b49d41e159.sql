
-- Index composite pour accélérer les queries fair use et analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type_created
ON public.analytics_events (user_id, event_type, created_at DESC);

-- Index pour les lookups par event_type seul (dashboard finances)
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
ON public.analytics_events (event_type, created_at DESC);
