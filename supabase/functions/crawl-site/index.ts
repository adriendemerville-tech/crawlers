import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse } from '../_shared/fairUse.ts';
import { logSilentError, fireAndLog } from '../_shared/silentErrorLogger.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const SPIDER_API = 'https://api.spider.cloud';

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
      userId: bodyUserId, 
      maxDepth = 0, 
      urlFilter = '', 
      customSelectors = [] 
    } = await req.json();

    // ── Extract real userId from JWT (ignore body userId for security) ──
    let userId = bodyUserId;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const { data: { user: jwtUser } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (jwtUser?.id) {
        userId = jwtUser.id;
      }
    }
    
    if (!url || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'URL et userId requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;
    const domain = new URL(normalizedUrl).hostname;
    let pageLimit = Math.min(maxPages, 50);

    // ── Step 1: Get pages from sitemap (used as primary URL source) ──
    let sitemapPageCount: number | null = null;
    let sitemapUrls: string[] = [];
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
          // Extract flat URL list from tree
          const extractUrls = (nodes: any[]): string[] => {
            const result: string[] = [];
            for (const node of nodes) {
              if (node.urls) result.push(...node.urls);
              if (node.children) result.push(...extractUrls(node.children));
            }
            return result;
          };
          if (sitemapData.tree) {
            sitemapUrls = extractUrls(sitemapData.tree);
            console.log(`[${domain}] Extracted ${sitemapUrls.length} URLs from sitemap tree`);
          }
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

    // ── Use sitemap URLs as primary source, Firecrawl map as fallback ──
    let urls: string[] = [];

    // Extensions non-HTML à exclure (sitemap XML, assets, documents…)
    const NON_PAGE_EXTENSIONS = /\.(xml|xsl|xslt|pdf|zip|gz|tar|rar|7z|exe|dmg|iso|bin|css|js|json|woff|woff2|ttf|eot|otf|svg|ico|png|jpg|jpeg|gif|webp|avif|mp3|mp4|avi|mov|wmv|flv|swf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|log|bak|sql|db)$/i;
    
    // Patterns d'URL non-page à exclure
    const NON_PAGE_PATTERNS = /\/(sitemap[^/]*\.xml|feed\/?|rss\/?|atom\/?|wp-json\/?|wp-admin|wp-includes|xmlrpc\.php|robots\.txt)/i;

    const filterNonPageUrls = (rawUrls: string[]): string[] => {
      return rawUrls.filter(u => {
        try {
          const parsed = new URL(u);
          const path = parsed.pathname;
          // Exclure les extensions non-HTML
          if (NON_PAGE_EXTENSIONS.test(path)) return false;
          // Exclure les patterns non-page
          if (NON_PAGE_PATTERNS.test(path)) return false;
          return true;
        } catch {
          return false;
        }
      });
    };

    if (sitemapUrls.length > 0) {
      // Use sitemap URLs, but filter out non-page URLs (xml, pdf, assets…)
      const cleanedUrls = filterNonPageUrls(sitemapUrls);
      urls = cleanedUrls.slice(0, pageLimit);
      console.log(`[${crawlId}] Using ${urls.length} URLs from sitemap (filtered from ${sitemapUrls.length}, primary source)`);
    } else {
      // Fallback: Spider.cloud (primary) → Firecrawl (fallback) for URL mapping
      console.log(`[${crawlId}] No sitemap URLs, trying Spider.cloud map...`);
      const spiderKey = Deno.env.get('SPIDER_API_KEY');
      let mapSuccess = false;

      if (spiderKey) {
        try {
          const spiderRes = await fetch(`${SPIDER_API}/crawl`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${spiderKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, limit: pageLimit, return_format: 'raw', depth: 0, request: 'http' }),
          });
          if (spiderRes.ok) {
            const spiderData = await spiderRes.json();
            const spiderUrls = Array.isArray(spiderData) 
              ? spiderData.map((p: any) => p.url).filter(Boolean) 
              : [];
            if (spiderUrls.length > 0) {
              urls = filterNonPageUrls(spiderUrls).slice(0, pageLimit);
              mapSuccess = true;
              await trackPaidApiCall('crawl-site', 'spider', '/crawl', normalizedUrl).catch((e) => logSilentError('crawl-site', 'track-spider-api-call', e, { severity: 'low', impact: 'tracking_miss' }));
              console.log(`[${crawlId}] ✅ Spider.cloud map: ${urls.length} URLs`);
            }
          } else {
            console.warn(`[${crawlId}] Spider.cloud map failed (${spiderRes.status}), falling back to Firecrawl`);
          }
        } catch (e) {
          console.warn(`[${crawlId}] Spider.cloud exception, falling back to Firecrawl:`, e);
        }
      }

      // Firecrawl fallback
      if (!mapSuccess) {
        console.log(`[${crawlId}] Falling back to Firecrawl map`);
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
        urls = filterNonPageUrls(mapData.links).slice(0, pageLimit);
      }
    }

    // Pre-filter URLs by regex if provided
    if (urlFilter) {
      try {
        const regex = new RegExp(urlFilter);
        urls = urls.filter(u => regex.test(u));
      } catch {}
    }

    // ── Incremental crawl: reuse pages from last 24h crawl of same domain ──
    let reusedCount = 0;
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: recentCrawls } = await supabase
        .from('site_crawls')
        .select('id')
        .eq('domain', domain)
        .eq('status', 'completed')
        .neq('id', crawlId)
        .gte('completed_at', twentyFourHoursAgo)
        .order('completed_at', { ascending: false })
        .limit(1);

      if (recentCrawls?.length) {
        const prevCrawlId = recentCrawls[0].id;
        // Fetch all pages from the previous crawl
        const { data: prevPages } = await supabase
          .from('crawl_pages')
          .select('url, title, seo_score, word_count, internal_links, external_links, h1, h2_count, h3_count, h4_h6_count, has_noindex, has_nofollow, has_canonical, has_og, has_schema_org, has_hreflang, is_indexable, crawl_depth, page_type_override, issues, body_text_truncated, meta_description, canonical_url, http_status, response_time_ms, images_total, images_without_alt, html_size_bytes, content_hash, path, broken_links, anchor_texts, schema_org_types, schema_org_errors, redirect_url, index_source, custom_extraction')
          .eq('crawl_id', prevCrawlId);

        if (prevPages?.length) {
          const prevUrlSet = new Set(prevPages.map((p: any) => p.url));
          const urlsToSkip = urls.filter(u => prevUrlSet.has(u));
          const urlsToProcess = urls.filter(u => !prevUrlSet.has(u));

          if (urlsToSkip.length > 0) {
            // Copy previous pages into new crawl (batch insert)
            const pagesToCopy = prevPages
              .filter((p: any) => urlsToSkip.includes(p.url))
              .map((p: any) => {
                const { id: _id, created_at: _ca, crawl_id: _cid, ...rest } = p as any;
                return { ...rest, crawl_id: crawlId };
              });

            // Insert in batches of 50
            for (let i = 0; i < pagesToCopy.length; i += 50) {
              const batch = pagesToCopy.slice(i, i + 50);
              await supabase.from('crawl_pages').insert(batch);
            }

            reusedCount = urlsToSkip.length;
            urls = urlsToProcess;
            console.log(`[${crawlId}] ♻️ Crawl incrémental: ${reusedCount} pages réutilisées du crawl ${prevCrawlId}, ${urls.length} nouvelles à crawler`);
          }
        }
      }
    } catch (e) {
      console.warn(`[${crawlId}] Incremental crawl check failed (non-blocking):`, e);
    }

    const totalPages = urls.length + reusedCount;

    // Update site_crawls with actual URL count (including reused)
    await supabase.from('site_crawls').update({
      total_pages: totalPages,
      crawled_pages: reusedCount,
      status: urls.length > 0 ? 'queued' : 'completed',
    }).eq('id', crawlId);

    // Update monthly page counter with ACTUAL new urls only (reused pages are free)
    if (!isUnlimited && urls.length > 0) {
      await supabase
        .from('profiles')
        .update({ crawl_pages_this_month: usedThisMonth + urls.length } as any)
        .eq('user_id', userId);
    }

    // If all pages were reused, finalize immediately without creating a job
    if (urls.length === 0) {
      console.log(`[${crawlId}] ♻️ 100% incrémental — toutes les ${reusedCount} pages réutilisées, pas de worker nécessaire`);

      // Generate summary for the crawl
      await supabase.from('site_crawls').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        crawled_pages: reusedCount,
        total_pages: reusedCount,
      }).eq('id', crawlId);

      return new Response(JSON.stringify({
        success: true,
        crawlId,
        totalPages: reusedCount,
        reusedPages: reusedCount,
        newPages: 0,
        status: 'completed',
        incremental: true,
        sitemapPageCount,
        gscIndexedCount,
        dataforseoIndexedCount,
        message: `♻️ ${reusedCount} pages réutilisées du crawl précédent — aucun re-crawl nécessaire`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create the crawl job with only NEW urls to process
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

    console.log(`[${crawlId}] ✅ Job ${job.id} créé avec ${urls.length} nouvelles URLs (${reusedCount} réutilisées) — en attente du worker`);

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
      totalPages,
      reusedPages: reusedCount,
      newPages: urls.length,
      status: 'queued',
      incremental: reusedCount > 0,
      sitemapPageCount,
      gscIndexedCount,
      dataforseoIndexedCount,
      message: reusedCount > 0
        ? `♻️ ${reusedCount} pages réutilisées + ${urls.length} nouvelles à crawler`
        : `${urls.length} pages découvertes — audit en file d'attente`,
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
