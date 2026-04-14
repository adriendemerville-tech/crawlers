-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to trigger sitemap regeneration via HTTP call to edge function
CREATE OR REPLACE FUNCTION public.notify_sitemap_regeneration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get config from vault or env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, try direct env (edge function will handle auth)
  IF supabase_url IS NULL OR service_key IS NULL THEN
    -- Fallback: use pg_net to call the edge function
    -- The URL is constructed from the project ref
    supabase_url := 'https://tutlimtasnjabdfhpewu.supabase.co';
    service_key := coalesce(
      current_setting('supabase.service_role_key', true),
      ''
    );
  END IF;

  -- Only trigger on status changes that affect the sitemap
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR
     (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status)) OR
     (TG_OP = 'DELETE') THEN
    
    -- Schedule regeneration via pg_net (async, non-blocking)
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/regenerate-sitemap',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'domain', 'crawlers.fr',
        'trigger', 'blog_' || lower(TG_OP)
      )
    );
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

-- Add the trigger AFTER the existing sync trigger (runs second)
DROP TRIGGER IF EXISTS trg_notify_sitemap_regen ON public.blog_articles;
CREATE TRIGGER trg_notify_sitemap_regen
  AFTER INSERT OR UPDATE OR DELETE ON public.blog_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sitemap_regeneration();
