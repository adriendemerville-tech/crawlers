-- Delete all duplicate crawl_pages globally, keeping only the first per (crawl_id, url)
DELETE FROM crawl_pages a
USING crawl_pages b
WHERE a.crawl_id = b.crawl_id
  AND a.url = b.url
  AND a.created_at > b.created_at;