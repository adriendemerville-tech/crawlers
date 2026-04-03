import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const HEADERS = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(handleRequest(async (req) => {
try {
    const { url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL required' }), { status: 400, headers: HEADERS });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const resp = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Crawlers.fr/1.0 SEO Audit Bot' },
    });
    clearTimeout(timeout);

    const html = await resp.text();

    // ── Extract JSON-LD blocks ──
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    const jsonLdBlocks: any[] = [];
    const jsonLdErrors: string[] = [];
    const schemaTypes: string[] = [];

    for (const block of jsonLdMatches) {
      const content = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        const parsed = JSON.parse(content);
        jsonLdBlocks.push(parsed);
        // Extract types
        const extractTypes = (obj: any) => {
          if (obj['@type']) {
            const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
            schemaTypes.push(...types);
          }
          if (obj['@graph'] && Array.isArray(obj['@graph'])) {
            obj['@graph'].forEach(extractTypes);
          }
        };
        extractTypes(parsed);
      } catch (e) {
        jsonLdErrors.push(`Parse error: ${e.message}`);
      }
    }

    // ── Check microdata ──
    const hasMicrodata = /itemscope/i.test(html);
    const microdataTypes = (html.match(/itemtype=["'](.*?)["']/gi) || [])
      .map(m => m.match(/itemtype=["'](.*?)["']/i)?.[1])
      .filter(Boolean) as string[];

    // ── Check RDFa ──
    const hasRdfa = /typeof=["']/i.test(html);

    // ── Validation checks ──
    const validationIssues: string[] = [];

    // Check for essential types
    const hasOrganization = schemaTypes.some(t => /organization/i.test(t));
    const hasWebSite = schemaTypes.some(t => /website/i.test(t));
    const hasBreadcrumb = schemaTypes.some(t => /breadcrumb/i.test(t));
    const hasFAQPage = schemaTypes.some(t => /faqpage/i.test(t));
    const hasArticle = schemaTypes.some(t => /article/i.test(t));
    const hasProduct = schemaTypes.some(t => /product/i.test(t));
    const hasLocalBusiness = schemaTypes.some(t => /localbusiness/i.test(t));

    if (jsonLdBlocks.length === 0 && !hasMicrodata && !hasRdfa) {
      validationIssues.push('No structured data found (JSON-LD, Microdata, or RDFa)');
    }
    if (!hasOrganization && !hasLocalBusiness) {
      validationIssues.push('Missing Organization or LocalBusiness schema');
    }
    if (!hasWebSite) {
      validationIssues.push('Missing WebSite schema (affects sitelinks)');
    }
    if (jsonLdErrors.length > 0) {
      validationIssues.push(`${jsonLdErrors.length} JSON-LD parse error(s)`);
    }

    // ── Score ──
    let score = 100;
    if (jsonLdBlocks.length === 0 && !hasMicrodata) score -= 30;
    if (!hasOrganization && !hasLocalBusiness) score -= 15;
    if (!hasWebSite) score -= 10;
    if (!hasBreadcrumb) score -= 5;
    if (jsonLdErrors.length > 0) score -= 10 * jsonLdErrors.length;

    return new Response(JSON.stringify({
      success: true,
      score: Math.max(0, score),
      jsonLd: {
        count: jsonLdBlocks.length,
        types: schemaTypes,
        blocks: jsonLdBlocks,
        errors: jsonLdErrors,
      },
      microdata: { present: hasMicrodata, types: microdataTypes },
      rdfa: { present: hasRdfa },
      detectedTypes: {
        organization: hasOrganization,
        webSite: hasWebSite,
        breadcrumb: hasBreadcrumb,
        faqPage: hasFAQPage,
        article: hasArticle,
        product: hasProduct,
        localBusiness: hasLocalBusiness,
      },
      validationIssues,
    }), { headers: HEADERS });

  } catch (e) {
    console.error('[check-structured-data]', e);
    return new Response(JSON.stringify({ success: false, error: e.message, score: 0 }), { status: 500, headers: HEADERS });
  }
}));