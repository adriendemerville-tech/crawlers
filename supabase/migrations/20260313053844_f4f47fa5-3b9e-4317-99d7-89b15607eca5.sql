-- Now add the unique index after dedup
CREATE UNIQUE INDEX IF NOT EXISTS crawl_pages_crawl_id_url_unique ON crawl_pages (crawl_id, url);