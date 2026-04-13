
-- Create profiles_safe view excluding OAuth tokens
CREATE VIEW public.profiles_safe
WITH (security_invoker = on) AS
  SELECT id, user_id, first_name, last_name, email, avatar_url,
         plan_type, subscription_status, subscription_expires_at, credits_balance,
         persona_type, api_key, referral_code, referred_by, affiliate_code_used,
         agency_brand_name, agency_logo_url, agency_primary_color,
         agency_contact_email, agency_contact_first_name, agency_contact_last_name,
         agency_contact_phone, agency_brand_font, agency_brand_font_size,
         agency_brand_bold, agency_brand_italic, agency_brand_underline,
         agency_report_font, agency_report_footer_text, agency_report_header_text,
         stripe_subscription_id, ga4_property_id, gsc_site_url,
         autonomy_level, autonomy_score, autonomy_raw,
         crawl_pages_this_month, crawl_month_reset,
         social_posts_this_month,
         marina_brand_enabled, marina_full_whitelabel, marina_hide_crawlers_badge,
         marina_custom_intro, marina_custom_cta_text, marina_custom_cta_url,
         created_at, updated_at
  FROM public.profiles;
