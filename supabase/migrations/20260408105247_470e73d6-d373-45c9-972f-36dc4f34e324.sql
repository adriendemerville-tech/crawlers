
CREATE OR REPLACE FUNCTION public.increment_short_link_clicks(link_code TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.short_links
  SET click_count = click_count + 1
  WHERE code = link_code;
$$;
