import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse } from '../_shared/fairUse.ts';
import { logSilentError, fireAndLog } from '../_shared/silentErrorLogger.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

/**
 * crawl-site v3 — Lightweight launcher with advanced options
 * Supports: maxDepth, urlFilter (regex), customSelectors (CSS extraction)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── IP Rate Limit (anti-bot) ──
  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'crawl-site', 5, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ success: false, error: 'Firecrawl non configuré' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = getServiceClient();

  try {
    const { 
      url, 
      maxPages = 50, 
      userId, 
      maxDepth = 0, 
      urlFilter = '', 
      customSelectors = [] 
    } = await req.json();
    
    if (!url || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'URL et userId requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;
    const domain = new URL(normalizedUrl).hostname;
    let pageLimit = Math.min(maxPages, 20);

    // ── Step 1: Count pages from sitemap ──
    let sitemapPageCount: number | null = null;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const controller1 = new AbortController();
      const timeout1 = setTimeout(() => controller1.abort(), 15000);
      const sitemapRes = await fetch(`${supabaseUrl}/functions/v1/fetch-sitemap-tree`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
        signal: controller1.signal,
      });
      clearTimeout(timeout1);
      if (sitemapRes.ok) {
        const sitemapData = await sitemapRes.json();
        if (sitemapData.totalUrls > 0) {
          sitemapPageCount = sitemapData.totalUrls;
          console.log(`[${domain}] Sitemap: ${sitemapPageCount} pages found`);
        }
      }
    } catch (e) {
      console.warn(`[${domain}] Sitemap pre-scan failed (non-blocking):`, e);
    }

    // ── Step 2: Check GSC for indexed pages (if user connected) ──
    let gscIndexedCount: number | null = null;
    try {
      const { data: googleConn } = await supabase
        .from('google_connections')
        .select('access_token, refresh_token, token_expiry')
        .eq('user_id', userId)
        .maybeSingle();

      if (googleConn?.access_token) {
        // Try GSC site:domain query via search analytics
        const cleanDomain = domain.replace(/^www\./, '');
        const siteUrl = `sc-domain:${cleanDomain}`;
        const gscController = new AbortController();
        const gscTimeout = setTimeout(() => gscController.abort(), 10000);
        
        const gscRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${googleConn.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
              endDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
              dimensions: ['page'],
              rowLimit: 1,
            }),
            signal: gscController.signal,
          }
        );
        clearTimeout(gscTimeout);
        
        if (gscRes.ok) {
          // The responseAggregationType gives us indexed page count indirectly
          // Use a simpler approach: count distinct pages via sitemaps API
          const gscSitemapRes = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
            { headers: { 'Authorization': `Bearer ${googleConn.access_token}` } }
          );
          if (gscSitemapRes.ok) {
            const gscSitemapData = await gscSitemapRes.json();
            const sitemaps = gscSitemapData.sitemap || [];
            let totalIndexed = 0;
            for (const sm of sitemaps) {
              totalIndexed += sm.contents?.reduce((sum: number, c: any) => sum + (c.indexed || 0), 0) || 0;
            }
            if (totalIndexed > 0) {
              gscIndexedCount = totalIndexed;
              console.log(`[${domain}] GSC indexed: ${gscIndexedCount} pages`);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[${domain}] GSC indexed pages check failed (non-blocking):`, e);
    }

    // ── Step 3: Fall back to DataForSEO if no GSC data ──
    let dataforseoIndexedCount: number | null = null;
    if (gscIndexedCount === null) {
      try {
        const dataforseoUser = Deno.env.get('DATAFORSEO_LOGIN');
        const dataforseoPass = Deno.env.get('DATAFORSEO_PASSWORD');
        if (dataforseoUser && dataforseoPass) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          const serpRes = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${dataforseoUser}:${dataforseoPass}`),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([{
              keyword: `site:${domain.replace(/^www\./, '')}`,
              language_code: 'fr',
              location_code: 2250,
              device: 'desktop',
              depth: 1,
            }]),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const serpData = await serpRes.json();
          const indexedPages = serpData?.tasks?.[0]?.result?.[0]?.se_results_count;
          if (indexedPages && indexedPages > 0) {
            dataforseoIndexedCount = indexedPages;
            console.log(`[${domain}] DataForSEO indexed: ${dataforseoIndexedCount} pages`);
          }
        }
      } catch (e) {
        console.warn(`[${domain}] DataForSEO pre-scan failed (non-blocking):`, e);
      }
    }

    // Use best available indexed count to cap page limit
    const bestIndexedCount = gscIndexedCount || dataforseoIndexedCount;
    if (bestIndexedCount && bestIndexedCount > 0) {
      const cappedLimit = Math.min(pageLimit, bestIndexedCount);
      if (cappedLimit < pageLimit) {
        console.log(`[${domain}] Indexed pages cap: ${bestIndexedCount} → limiting from ${pageLimit} to ${cappedLimit}`);
        pageLimit = cappedLimit;
      }
    }

    // ── Fetch profile + admin role in parallel (single round-trip) ──
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase
        .from('profiles')
        .select('plan_type, subscription_status, crawl_pages_this_month, crawl_month_reset')
        .eq('user_id', userId)
        .single(),
      supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
    ]);

    // ── Fair Use check (single call with real plan type) ──
    const isProAgencyPlan = profile?.plan_type === 'agency_pro' && profile?.subscription_status === 'active';
    if (!isAdmin) {
      const fairUse = await checkFairUse(userId, 'crawl_site', isProAgencyPlan ? 'agency_pro' : 'free');
      if (!fairUse.allowed) {
        return new Response(JSON.stringify({ success: false, error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const isProAgency = profile?.plan_type === 'agency_pro' && profile?.subscription_status === 'active';
    const isUnlimited = isAdmin === true;

    // Admins: no page cap
    if (isUnlimited) {
      pageLimit = Math.min(maxPages, 500);
    }

    // ── Fair Use Policy ──────────────────────────────────────
    // Pro Agency: 5 000 pages/month included, then pay-as-you-go
    // Free users: always pay credits
    const FAIR_USE_LIMIT = 5000;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Reset monthly counter if new month
    let usedThisMonth = profile?.crawl_pages_this_month || 0;
    if (profile?.crawl_month_reset !== currentMonth) {
      usedThisMonth = 0;
      await supabase
        .from('profiles')
        .update({ crawl_pages_this_month: 0, crawl_month_reset: currentMonth } as any)
        .eq('user_id', userId);
    }

    const pagesRemaining = isProAgency ? Math.max(0, FAIR_USE_LIMIT - usedThisMonth) : 0;
    const freePages = isProAgency ? Math.min(pageLimit, pagesRemaining) : 0;
    const paidPages = pageLimit - freePages;

    // Credit cost: only for pages beyond fair use (or all pages for free users)
    const creditCost = isUnlimited ? 0 : (
      paidPages <= 0 ? 0 : 1
    );

    if (!isUnlimited && creditCost > 0) {
      const { data: creditResult } = await supabase.rpc('use_credit', {
        p_user_id: userId,
        p_amount: creditCost,
        p_description: `Crawl multi-pages: ${domain} (${paidPages} pages payantes sur ${pageLimit})`,
      });

      if (!creditResult?.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Crédits insuffisants',
          required: creditCost,
          balance: creditResult?.balance || 0,
          fair_use_remaining: pagesRemaining,
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Note: monthly page counter is updated AFTER mapping, using actual urls.length
    // (moved below the map step for accuracy)

    if (isUnlimited) {
      console.log(`[${domain}] Crawl illimité (Admin)`);
    } else if (isProAgency && freePages > 0) {
      console.log(`[${domain}] Fair Use: ${freePages}/${pageLimit} pages incluses (${usedThisMonth + pageLimit}/${FAIR_USE_LIMIT} ce mois)`);
    }

    // Validate urlFilter regex
    if (urlFilter) {
      try {
        new RegExp(urlFilter);
      } catch {
        return new Response(JSON.stringify({ success: false, error: 'Regex de filtre URL invalide' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Create site_crawls row
    const { data: crawl, error: crawlError } = await supabase
      .from('site_crawls')
      .insert({
        user_id: userId,
        domain,
        url: normalizedUrl,
        status: 'mapping',
        total_pages: pageLimit,
        credits_used: creditCost,
        max_depth: maxDepth,
        url_filter: urlFilter || null,
      })
      .select('id')
      .single();

    if (crawlError || !crawl) {
      console.error('Erreur création crawl:', crawlError);
      return new Response(JSON.stringify({ success: false, error: 'Erreur création crawl' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const crawlId = crawl.id;
    console.log(`[${crawlId}] Mapping démarré: ${domain} (max ${pageLimit} pages, depth: ${maxDepth || '∞'}, filter: ${urlFilter || 'none'})`);

    // Map URLs via Firecrawl
    const mapResponse = await fetch(`${FIRECRAWL_API}/map`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl, limit: pageLimit, includeSubdomains: false }),
    });

    const mapData = await mapResponse.json();
    await trackPaidApiCall('crawl-site', 'firecrawl', '/map', normalizedUrl).catch((e) => logSilentError('crawl-site', 'track-map-api-call', e, { severity: 'low', impact: 'tracking_miss' }));
    if (!mapResponse.ok || !mapData.links?.length) {
      await supabase.from('site_crawls').update({ status: 'error', error_message: 'Impossible de mapper le site' }).eq('id', crawlId);
      return new Response(JSON.stringify({ success: false, error: 'Map échoué', crawlId }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let urls: string[] = mapData.links.slice(0, pageLimit);

    // Pre-filter URLs by regex if provided
    if (urlFilter) {
      try {
        const regex = new RegExp(urlFilter);
        urls = urls.filter(u => regex.test(u));
      } catch {}
    }
    
    // Update site_crawls with actual URL count
    await supabase.from('site_crawls').update({
      total_pages: urls.length,
      status: 'queued',
    }).eq('id', crawlId);

    // Update monthly page counter with ACTUAL urls discovered (not the max limit)
    if (!isUnlimited) {
      await supabase
        .from('profiles')
        .update({ crawl_pages_this_month: usedThisMonth + urls.length } as any)
        .eq('user_id', userId);
    }

    // Create the crawl job with advanced options
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .insert({
        crawl_id: crawlId,
        user_id: userId,
        domain,
        url: normalizedUrl,
        urls_to_process: urls,
        total_count: urls.length,
        status: 'pending',
        max_depth: maxDepth,
        url_filter: urlFilter || null,
        custom_selectors: customSelectors,
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Erreur création job:', jobError);
      await supabase.from('site_crawls').update({ status: 'error', error_message: 'Erreur file d\'attente' }).eq('id', crawlId);
      return new Response(JSON.stringify({ success: false, error: 'Erreur file d\'attente' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${crawlId}] ✅ Job ${job.id} créé avec ${urls.length} URLs — en attente du worker`);

    // Trigger the worker immediately (fire-and-forget with logging)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    fireAndLog(
      fetch(`${supabaseUrl}/functions/v1/process-crawl-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'immediate' }),
      }),
      'crawl-site', 'trigger-worker', { severity: 'critical', impact: 'crawl_stuck', crawlId, domain }
    );

    return new Response(JSON.stringify({
      success: true,
      crawlId,
      jobId: job.id,
      totalPages: urls.length,
      status: 'queued',
      message: `${urls.length} pages découvertes — audit en file d'attente`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erreur crawl-site:', error);
    await trackEdgeFunctionError('crawl-site', error instanceof Error ? error.message : 'Erreur interne').catch((e) => logSilentError('crawl-site', 'track-error', e, { severity: 'medium', impact: 'tracking_miss' }));
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
