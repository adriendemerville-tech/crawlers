-- Ajout détection d'intention par page (Know/Do/Buy/Navigate/Unknown)
ALTER TABLE public.crawl_pages
  ADD COLUMN IF NOT EXISTS page_intent TEXT,
  ADD COLUMN IF NOT EXISTS intent_confidence NUMERIC(3,2);

CREATE INDEX IF NOT EXISTS idx_crawl_pages_intent ON public.crawl_pages(crawl_id, page_intent);

COMMENT ON COLUMN public.crawl_pages.page_intent IS 'Intention détectée: know|do|buy|navigate|unknown';
COMMENT ON COLUMN public.crawl_pages.intent_confidence IS 'Score de confiance 0-1. unknown si < 0.7';