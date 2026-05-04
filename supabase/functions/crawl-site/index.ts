import { corsHeaders } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts';
import { checkIpRate, getClientIp, rateLimitResponse } from '../_shared/ipRateLimiter.ts';
import { checkFairUse } from '../_shared/fairUse.ts';
import { logSilentError, fireAndLog } from '../_shared/silentErrorLogger.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { scanCmsContent } from '../_shared/cmsContentScanner.ts';
import { isIktrackerDomain, getIktrackerApiKey, IKTRACKER_BASE_URL } from '../_shared/domainUtils.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const SPIDER_API = 'https://api.spider.cloud';

// Extensions non-HTML à exclure (sitemap XML, assets, documents…)
const NON_PAGE_EXTENSIONS = /\.(xml|xsl|xslt|pdf|zip|gz|tar|rar|7z|exe|dmg|iso|bin|css|js|json|woff|woff2|ttf|eot|otf|svg|ico|png|jpg|jpeg|gif|webp|avif|mp3|mp4|avi|mov|wmv|flv|swf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|log|bak|sql|db)$/i;

// Patterns d'URL non-page à exclure
const NON_PAGE_PATTERNS = /\/(sitemap[^/]*\.xml|feed\/?|rss\/?|atom\/?|wp-json\/?|wp-admin|wp-includes|xmlrpc\.php|robots\.txt)/i;

function filterNonPageUrls(rawUrls: string[]): string[] {
  return rawUrls.filter(u => {
    try {
      const parsed = new URL(u);
      const path = parsed.pathname;
      if (NON_PAGE_EXTENSIONS.test(path)) return false;
      if (NON_PAGE_PATTERNS.test(path)) return false;
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * crawl-site v4 — Two-phase crawl: detect (mapping) + analyze (scraping)
 * mode: 'detect' → mapping only (free, returns URL list)
 * mode: 'analyze' (default) → full crawl with scraping
 * Supports: maxDepth, urlFilter (regex), customSelectors (CSS extraction)
 */
Deno.serve(handleRequest(async (req) => {
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
      customSelectors = [],
      mode = 'analyze',
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

    // ══════════════════════════════════════════════════════════════════
    // SHARED: URL discovery (used by both detect and analyze modes)
    // ══════════════════════════════════════════════════════════════════

    // ── Step 1: Get pages from sitemap ──
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

    // ── Step 2: Check GSC for indexed pages (info only, not used for page limit) ──
    let gscIndexedCount: number | null = null;
    try {
      const { data: googleConn } = await supabase
        .from('google_connections')
        .select('access_token, refresh_token, token_expiry')
        .eq('user_id', userId)
        .maybeSingle();

      if (googleConn?.access_token) {
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

    // ── Step 3: Hybrid URL discovery (sitemap + Spider/Firecrawl + CMS) ──
    // No pageLimit cap during discovery — discover ALL, let user filter
    let urls: string[] = [];
    const logId = mode === 'detect' ? domain : 'detect';

    // Helper: discover URLs via Spider.cloud → Firecrawl map cascade
    const discoverUrlsViaMap = async (limit: number): Promise<string[]> => {
      const spiderKey = Deno.env.get('SPIDER_API_KEY');
      if (spiderKey) {
        try {
          // Use /links endpoint (URL-only, lightweight) instead of /crawl (full HTML, memory-heavy)
          const spiderRes = await fetch(`${SPIDER_API}/links`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${spiderKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, limit, depth: 2, request: 'http' }),
          });
          if (spiderRes.ok) {
            const spiderData = await spiderRes.json();
            const spiderUrls = Array.isArray(spiderData)
              ? spiderData.map((p: any) => typeof p === 'string' ? p : p.url).filter(Boolean)
              : (Array.isArray(spiderData?.links) ? spiderData.links : []);
            if (spiderUrls.length > 0) {
              await trackPaidApiCall('crawl-site', 'spider', '/links', normalizedUrl).catch((e) => logSilentError('crawl-site', 'track-spider-api-call', e, { severity: 'low', impact: 'tracking_miss' }));
              console.log(`[${logId}] Spider.cloud links: ${spiderUrls.length} URLs`);
              return filterNonPageUrls(spiderUrls);
            }
          } else {
            console.warn(`[${logId}] Spider.cloud links failed (${spiderRes.status})`);
          }
        } catch (e) {
          console.warn(`[${logId}] Spider.cloud exception:`, e);
        }
      }

      // Firecrawl fallback
      console.log(`[${logId}] Falling back to Firecrawl map`);
      const mapResponse = await fetch(`${FIRECRAWL_API}/map`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, limit, includeSubdomains: false }),
      });
      const mapData = await mapResponse.json();
      await trackPaidApiCall('crawl-site', 'firecrawl', '/map', normalizedUrl).catch((e) => logSilentError('crawl-site', 'track-map-api-call', e, { severity: 'low', impact: 'tracking_miss' }));
      if (mapResponse.ok && mapData.links?.length) {
        return filterNonPageUrls(mapData.links);
      }
      return [];
    };

    // Sitemap seed
    if (sitemapUrls.length > 0) {
      const cleanedUrls = filterNonPageUrls(sitemapUrls);
      urls = [...cleanedUrls];
      console.log(`[${logId}] Sitemap seed: ${urls.length} URLs (filtered from ${sitemapUrls.length})`);
    }

    // Spider/Firecrawl map complement
    console.log(`[${logId}] Complementing with map discovery (have ${urls.length})…`);
    try {
      const mapUrls = await discoverUrlsViaMap(500);
      const existingSet = new Set(urls.map(u => u.replace(/\/$/, '')));
      const newUrls = mapUrls.filter(u => !existingSet.has(u.replace(/\/$/, '')));
      if (newUrls.length > 0) {
        urls = [...urls, ...newUrls];
        console.log(`[${logId}] ✅ Map discovery added ${newUrls.length} URLs (total: ${urls.length})`);
      }
    } catch (e) {
      console.warn(`[${logId}] Map complement failed (non-blocking):`, e);
    }

    // CMS content discovery (tracked site match OR known domain fallback)
    try {
      const domainBase = domain.replace(/^www\./, '');
      const existingSet = new Set(urls.map(u => u.replace(/\/$/, '').toLowerCase()));
      let cmsAdded = 0;

      const { data: trackedSite } = await supabase
        .from('tracked_sites')
        .select('id')
        .or(`domain.eq.${domainBase},domain.eq.www.${domainBase}`)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (trackedSite) {
        const cmsInventory = await scanCmsContent(trackedSite.id, userId);
        for (const item of cmsInventory.items) {
          if (!item.url) continue;
          const normalizedCmsUrl = item.url.replace(/\/$/, '').toLowerCase();
          if (!existingSet.has(normalizedCmsUrl)) {
            urls.push(item.url);
            existingSet.add(normalizedCmsUrl);
            cmsAdded++;
          }
        }
        if (cmsAdded > 0) {
          console.log(`[${logId}] ✅ CMS discovery added ${cmsAdded} URLs from ${cmsInventory.scanned_platforms.join(', ')} (total: ${urls.length})`);
        }
        if (cmsInventory.errors.length > 0) {
          console.warn(`[${logId}] CMS scan warnings:`, cmsInventory.errors);
        }
      }

      // Fallback: for known domains (iktracker), directly query API even without tracked_site
      if (isIktrackerDomain(domainBase) && cmsAdded === 0) {
        const iktApiKey = getIktrackerApiKey();
        if (iktApiKey) {
          console.log(`[${logId}] IKtracker fallback: querying blog API directly`);
          try {
            const postsResp = await fetch(`${IKTRACKER_BASE_URL}/posts?all=true&limit=200`, {
              headers: { 'x-api-key': iktApiKey },
              signal: AbortSignal.timeout(15000),
            });
            if (postsResp.ok) {
              const postsData = await postsResp.json();
              const posts: any[] = Array.isArray(postsData) ? postsData : (postsData?.data?.posts || postsData?.data?.data?.posts || postsData?.posts || []);
              for (const post of posts) {
                if (!post.slug) continue;
                const postUrl = `https://iktracker.fr/blog/${post.slug}`;
                const norm = postUrl.toLowerCase();
                if (!existingSet.has(norm)) {
                  urls.push(postUrl);
                  existingSet.add(norm);
                  cmsAdded++;
                }
              }
              // Also add author pages
              const authors = new Set(posts.map((p: any) => p.author_slug).filter(Boolean));
              for (const authorSlug of authors) {
                const authorUrl = `https://iktracker.fr/blog/auteur/${authorSlug}`;
                const norm = authorUrl.toLowerCase();
                if (!existingSet.has(norm)) {
                  urls.push(authorUrl);
                  existingSet.add(norm);
                  cmsAdded++;
                }
              }
              console.log(`[${logId}] ✅ IKtracker fallback added ${cmsAdded} blog URLs (total: ${urls.length})`);
            }
          } catch (e) {
            console.warn(`[${logId}] IKtracker fallback failed:`, e);
          }

          // Add known static routes not in sitemap
          const iktStaticRoutes = ['/marina', '/offline'];
          for (const route of iktStaticRoutes) {
            const routeUrl = `https://iktracker.fr${route}`;
            const norm = routeUrl.toLowerCase();
            if (!existingSet.has(norm)) {
              urls.push(routeUrl);
              existingSet.add(norm);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[${logId}] CMS content discovery failed (non-blocking):`, e);
    }

    // ══════════════════════════════════════════════════════════════════
    // DETECT MODE: return discovered URLs without scraping
    // ══════════════════════════════════════════════════════════════════
    if (mode === 'detect') {
      console.log(`[${domain}] DETECT mode: ${urls.length} URLs discovered`);
      
      // Categorize URLs by directory for the front-end filter UI
      const directories: Record<string, number> = {};
      for (const u of urls) {
        try {
          const parsed = new URL(u);
          const segments = parsed.pathname.split('/').filter(Boolean);
          const dir = segments.length > 0 ? `/${segments[0]}` : '/';
          directories[dir] = (directories[dir] || 0) + 1;
        } catch {}
      }

      return new Response(JSON.stringify({
        success: true,
        mode: 'detect',
        totalDiscovered: urls.length,
        urls,
        directories: Object.entries(directories)
          .map(([path, count]) => ({ path, label: path.replace(/^\//, ''), count }))
          .sort((a, b) => b.count - a.count),
        sources: {
          sitemap: sitemapPageCount || 0,
          gscIndexed: gscIndexedCount,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ══════════════════════════════════════════════════════════════════
    // ANALYZE MODE: full crawl with scraping
    // ══════════════════════════════════════════════════════════════════
    let pageLimit = Math.min(maxPages, 50);

    // ── Fetch profile + admin role in parallel ──
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase
        .from('profiles')
        .select('plan_type, subscription_status, crawl_pages_this_month, crawl_month_reset')
        .eq('user_id', userId)
        .single(),
      supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
    ]);

    // ── Fair Use check ──
    const isProAgencyPlan = ['agency_pro', 'agency_premium'].includes(profile?.plan_type || '') && profile?.subscription_status === 'active';
    if (!isAdmin) {
      const fairUse = await checkFairUse(userId, 'crawl_site', isProAgencyPlan ? 'agency_pro' : 'free');
      if (!fairUse.allowed) {
        return new Response(JSON.stringify({ success: false, error: fairUse.reason }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const isProAgency = ['agency_pro', 'agency_premium'].includes(profile?.plan_type || '') && profile?.subscription_status === 'active';
    const isAgencyPlus = profile?.plan_type === 'agency_premium' && profile?.subscription_status === 'active';
    const isUnlimited = isAdmin === true;

    // Admins: no page cap
    if (isUnlimited) {
      pageLimit = Math.min(maxPages, 500);
    }

    // ── Fair Use Policy ──
    const FAIR_USE_LIMIT = isAgencyPlus ? 50000 : 5000;
    const currentMonth = new Date().toISOString().slice(0, 7);

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

    // Apply pageLimit to discovered URLs
    urls = urls.slice(0, pageLimit);

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

    // Pre-filter URLs by regex if provided
    if (urlFilter) {
      try {
        const regex = new RegExp(urlFilter);
        urls = urls.filter(u => regex.test(u));
      } catch {}
    }

    if (urls.length === 0) {
      await supabase.from('site_crawls').update({ status: 'error', error_message: 'Aucune page découverte (sitemap + map + CMS)' }).eq('id', crawlId);
      return new Response(JSON.stringify({ success: false, error: 'Aucune page découverte', crawlId }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Incremental crawl: reuse pages from last 12h crawl of same domain ──
    let reusedCount = 0;
    if (!isUnlimited) try {
      const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
      const { data: recentCrawls } = await supabase
        .from('site_crawls')
        .select('id')
        .eq('domain', domain)
        .in('status', ['completed', 'stopped'])
        .neq('id', crawlId)
        .gte('completed_at', twelveHoursAgo)
        .order('completed_at', { ascending: false })
        .limit(1);

      if (recentCrawls?.length) {
        const prevCrawlId = recentCrawls[0].id;
        const { data: prevPages } = await supabase
          .from('crawl_pages')
          .select('url, title, seo_score, word_count, internal_links, external_links, h1, h2_count, h3_count, h4_h6_count, has_noindex, has_nofollow, has_canonical, has_og, has_schema_org, has_hreflang, is_indexable, crawl_depth, page_type_override, issues, body_text_truncated, meta_description, canonical_url, http_status, response_time_ms, images_total, images_without_alt, html_size_bytes, content_hash, path, broken_links, anchor_texts, schema_org_types, schema_org_errors, redirect_url, index_source, custom_extraction')
          .eq('crawl_id', prevCrawlId);

        if (prevPages?.length) {
          const prevUrlSet = new Set(prevPages.map((p: any) => p.url));
          const urlsToSkip = urls.filter(u => prevUrlSet.has(u));
          const urlsToProcess = urls.filter(u => !prevUrlSet.has(u));

          if (urlsToSkip.length > 0) {
            const pagesToCopy = prevPages
              .filter((p: any) => urlsToSkip.includes(p.url))
              .map((p: any) => {
                const { id: _id, created_at: _ca, crawl_id: _cid, ...rest } = p as any;
                return { ...rest, crawl_id: crawlId };
              });

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

    // Update site_crawls with actual URL count
    await supabase.from('site_crawls').update({
      total_pages: totalPages,
      crawled_pages: reusedCount,
      status: urls.length > 0 ? 'queued' : 'completed',
    }).eq('id', crawlId);

    // Update monthly page counter
    if (!isUnlimited && urls.length > 0) {
      await supabase
        .from('profiles')
        .update({ crawl_pages_this_month: usedThisMonth + urls.length } as any)
        .eq('user_id', userId);
    }

    // If all pages were reused, finalize immediately
    if (urls.length === 0) {
      console.log(`[${crawlId}] ♻️ 100% incrémental — toutes les ${reusedCount} pages réutilisées`);

      // Recompute intent_distribution from reused pages
      let intentDistribution: any = null;
      try {
        const { aggregateIntents } = await import('../_shared/pageIntent.ts');
        const { data: reusedPages } = await supabase
          .from('crawl_pages')
          .select('page_intent, intent_confidence')
          .eq('crawl_id', crawlId);
        intentDistribution = aggregateIntents(reusedPages || []);
      } catch (e) { console.warn('[crawl-site] intent agg failed', e); }

      await supabase.from('site_crawls').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        crawled_pages: reusedCount,
        total_pages: reusedCount,
        intent_distribution: intentDistribution,
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
        intent_distribution: intentDistribution,
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

    // Trigger the worker immediately (fire-and-forget)
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
}));
