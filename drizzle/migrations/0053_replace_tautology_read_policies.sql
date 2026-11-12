-- Shared reference tables: reads restricted to signed-in users with an explicit predicate.
DROP POLICY IF EXISTS "Authenticated users can read injection catalog" ON public.injection_catalog;
CREATE POLICY "Signed-in users can read injection catalog" ON public.injection_catalog FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can read the shared volume pool" ON public.keyword_volume_pool;
CREATE POLICY "Signed-in users can read the shared volume pool" ON public.keyword_volume_pool FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "constants readable by authenticated" ON public.marketplace_pricing_constants;
CREATE POLICY "constants readable by signed-in users" ON public.marketplace_pricing_constants FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Réglages MCP lisibles" ON public.mcp_billing_settings;
CREATE POLICY "Réglages MCP lisibles par les connectés" ON public.mcp_billing_settings FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Tarifs MCP lisibles par tous" ON public.mcp_tool_pricing;
CREATE POLICY "Tarifs MCP lisibles par les connectés" ON public.mcp_tool_pricing FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "cache_authenticated_read" ON public.netlinking_catalog_cache;
CREATE POLICY "cache_signed_in_read" ON public.netlinking_catalog_cache FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "providers_public_read" ON public.netlinking_providers;
CREATE POLICY "providers_signed_in_read" ON public.netlinking_providers FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can read permissions" ON public.role_permissions;
CREATE POLICY "Signed-in users can read permissions" ON public.role_permissions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can read the shared SERP pool" ON public.serp_pool;
CREATE POLICY "Signed-in users can read the shared SERP pool" ON public.serp_pool FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
-- Server-only tables (read with the service role): remove client read access.
DROP POLICY IF EXISTS "Anyone can read market_trends" ON public.market_trends;
DROP POLICY IF EXISTS "Public read access for prerender cache" ON public.prerender_cache;
-- Private buckets: drop unbound public reads (files are served via signed URLs).
DROP POLICY IF EXISTS "public read linkedin-media tests" ON storage.objects;
DROP POLICY IF EXISTS "Public read parmenion images" ON storage.objects;