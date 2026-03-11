
DROP POLICY "Service can insert crawl pages" ON public.crawl_pages;
CREATE POLICY "Authenticated can insert crawl pages" ON public.crawl_pages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.site_crawls sc WHERE sc.id = crawl_pages.crawl_id AND sc.user_id = auth.uid())
);
