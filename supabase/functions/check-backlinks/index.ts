import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(handleRequest(async (req) => {
  try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const domain = (() => {
      try {
        return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
      } catch { return url.replace('www.', ''); }
    })();

    const login = Deno.env.get('DATAFORSEO_LOGIN');
    const password = Deno.env.get('DATAFORSEO_PASSWORD');
    if (!login || !password) {
      return new Response(JSON.stringify({ success: false, error: 'DataForSEO credentials not configured', score: 0 }), { status: 500, headers: HEADERS });
    }

    const auth = btoa(`${login}:${password}`);

    // ── Call DataForSEO Backlinks Summary ──
    const resp = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: domain, internal_list_limit: 0, backlinks_filters: ['dofollow', '=', 'true'] }]),
    });

    const data = await resp.json();
    const taskStatus = data?.tasks?.[0]?.status_code;
    const taskMessage = data?.tasks?.[0]?.status_message || '';
    const result = data?.tasks?.[0]?.result?.[0];

    // Check for subscription/access issues
    if (taskStatus === 40204 && taskMessage.includes('Access denied')) {
      console.warn('[check-backlinks] DataForSEO Backlinks API subscription not active');
      return new Response(JSON.stringify({ success: false, score: 0, error: 'DataForSEO Backlinks subscription not active', domain }), { headers: HEADERS });
    }

    if (!result) {
      return new Response(JSON.stringify({ success: true, score: 0, error: 'No backlink data found', domain }), { headers: HEADERS });
    }

    const referringDomains = result.referring_domains || 0;
    const backlinksTotal = result.backlinks || 0;
    const domainRank = result.rank || 0;
    const referringIps = result.referring_ips || 0;
    const referringSubnets = result.referring_subnets || 0;

    // ── Anchor distribution ──
    let anchorDistribution: any[] = [];
    try {
      const anchorResp = await fetch('https://api.dataforseo.com/v3/backlinks/anchors/live', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: domain, limit: 10, order_by: ['backlinks,desc'] }]),
      });
      const anchorData = await anchorResp.json();
      anchorDistribution = (anchorData?.tasks?.[0]?.result?.[0]?.items || []).map((a: any) => ({
        anchor: a.anchor,
        backlinks: a.backlinks,
        domains: a.referring_domains,
      }));
    } catch { /* non-critical */ }

    // ── Score ──
    let score = 0;
    if (referringDomains >= 100) score += 30;
    else if (referringDomains >= 30) score += 20;
    else if (referringDomains >= 10) score += 15;
    else if (referringDomains >= 3) score += 10;
    else score += 5;

    if (domainRank >= 50) score += 30;
    else if (domainRank >= 30) score += 20;
    else if (domainRank >= 15) score += 15;
    else if (domainRank >= 5) score += 10;
    else score += 5;

    // Diversity bonus
    const ipDomainRatio = referringDomains > 0 ? referringIps / referringDomains : 0;
    if (ipDomainRatio > 0.8) score += 20;
    else if (ipDomainRatio > 0.5) score += 15;
    else score += 10;

    // Anchor diversity bonus
    if (anchorDistribution.length >= 5) score += 20;
    else if (anchorDistribution.length >= 3) score += 15;
    else score += 10;

    const issues: string[] = [];
    if (referringDomains < 5) issues.push('Very few referring domains');
    if (domainRank < 10) issues.push('Low domain authority');
    if (anchorDistribution.length > 0) {
      const topAnchorRatio = anchorDistribution[0].backlinks / backlinksTotal;
      if (topAnchorRatio > 0.5) issues.push('Anchor text over-optimization detected');
    }

    return new Response(JSON.stringify({
      success: true,
      score: Math.min(100, score),
      domain,
      referringDomains,
      backlinksTotal,
      domainRank,
      referringIps,
      referringSubnets,
      anchorDistribution,
      issues,
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-backlinks]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
}));