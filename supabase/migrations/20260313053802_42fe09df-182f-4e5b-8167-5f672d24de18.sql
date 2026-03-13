-- Update processed_count to match actual unique pages crawled
UPDATE crawl_jobs SET processed_count = 40 WHERE id = 'af4f2451-6956-495c-aa4f-80d1cc294eae';
UPDATE site_crawls SET crawled_pages = 40 WHERE id = '4d01a7b7-0e85-4c73-a0ae-61a11e628c07';