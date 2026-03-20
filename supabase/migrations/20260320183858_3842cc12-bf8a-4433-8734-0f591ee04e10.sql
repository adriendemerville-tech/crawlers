UPDATE bundle_api_catalog SET is_active = false WHERE api_name IN (
  'DataForSEO',
  'Google Search Console',
  'Google PageSpeed',
  'Google Analytics (GA4)'
);