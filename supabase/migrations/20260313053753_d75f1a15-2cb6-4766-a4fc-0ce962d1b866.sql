-- Delete duplicate crawl_pages, keeping only the first entry per URL per crawl
DELETE FROM crawl_pages
WHERE id NOT IN (
  SELECT DISTINCT ON (crawl_id, url) id
  FROM crawl_pages
  WHERE crawl_id = '4d01a7b7-0e85-4c73-a0ae-61a11e628c07'
  ORDER BY crawl_id, url, created_at ASC
)
AND crawl_id = '4d01a7b7-0e85-4c73-a0ae-61a11e628c07';