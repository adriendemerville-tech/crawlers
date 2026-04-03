import { corsHeaders } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * cocoon-diag-subdomains: Analyse cross-subdomain
 * 
 * 1. Découverte des sous-domaines via Firecrawl Map (includeSubdomains: true)
 * 2. Regroupement et comptage par sous-domaine
 * 3. Analyse IA (Gemini) : cannibalization, cohérence, recommandations d'architecture
 * 
 * Input: { tracked_site_id, domain }
 * Output: { subdomains, analysis, recommendations }
 */

Deno.serve(handleRequest(async (req) => {
try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return jsonError('Unauthorized', 401);
    }

    const { tracked_site_id, domain } = await req.json();
    if (!domain) {
      return jsonError('domain required', 400);
    }

    const supabase = getServiceClient();
    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      return jsonError('Firecrawl not configured', 500);
    }
    if (!LOVABLE_API_KEY) {
      return jsonError('AI not configured', 500);
    }

    // ═══ Step 1: Discover subdomains via Firecrawl Map ═══
    const rootDomain = domain.replace(/^www\./, '');
    console.log(`[cocoon-diag-subdomains] Mapping ${rootDomain} with subdomains...`);

    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://${rootDomain}`,
        limit: 5000,
        includeSubdomains: true,
      }),
    });

    if (!mapResponse.ok) {
      const err = await mapResponse.text();
      console.error('[cocoon-diag-subdomains] Firecrawl map failed:', err);
      return jsonError('Map failed', details: err, 502);
    }

    const mapData = await mapResponse.json();
    const allUrls: string[] = mapData.links || mapData.data?.links || [];
    console.log(`[cocoon-diag-subdomains] Found ${allUrls.length} URLs`);

    // ═══ Step 2: Group by subdomain ═══
    const subdomainMap: Record<string, string[]> = {};
    for (const url of allUrls) {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (!subdomainMap[host]) subdomainMap[host] = [];
        subdomainMap[host].push(parsed.pathname);
      } catch { /* skip invalid URLs */ }
    }

    const subdomains = Object.entries(subdomainMap)
      .map(([host, paths]) => ({
        host,
        isRoot: host === rootDomain || host === `www.${rootDomain}`,
        pageCount: paths.length,
        samplePaths: paths.slice(0, 10),
        pathPatterns: extractPathPatterns(paths),
      }))
      .sort((a, b) => b.pageCount - a.pageCount);

    const nonRootSubdomains = subdomains.filter(s => !s.isRoot);

    if (nonRootSubdomains.length === 0) {
      return new Response(JSON.stringify({
        subdomains,
        analysis: null,
        recommendations: null,
        message: `Aucun sous-domaine détecté pour ${rootDomain}. Le site utilise une architecture mono-domaine.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══ Step 3: AI Analysis ═══
    const subdomainSummary = subdomains.map(s =>
      `${s.host}: ${s.pageCount} pages | Patterns: ${s.pathPatterns.join(', ')} | Exemples: ${s.samplePaths.slice(0, 5).join(', ')}`
    ).join('\n');

    const aiPrompt = `Tu es un expert SEO technique senior. Analyse l'architecture cross-subdomain suivante et fournis un diagnostic complet.

DOMAINE RACINE: ${rootDomain}
SOUS-DOMAINES DÉCOUVERTS: ${subdomains.length} (dont ${nonRootSubdomains.length} non-racine)
TOTAL URLS: ${allUrls.length}

DÉTAIL:
${subdomainSummary}

ANALYSE DEMANDÉE (format JSON strict):
{
  "architecture_type": "monolithique|distribué|hybride",
  "architecture_score": 0-100,
  "cannibalization_risks": [
    { "subdomain1": "...", "subdomain2": "...", "overlap_description": "...", "severity": "critical|warning|info" }
  ],
  "coherence_issues": [
    { "subdomain": "...", "issue": "...", "severity": "critical|warning|info" }
  ],
  "recommendations": [
    { "action": "merge|separate|redirect|create|restructure", "target": "...", "description": "...", "impact": "high|medium|low", "priority": 1-5 }
  ],
  "summary": "Résumé exécutif en 2-3 phrases"
}

Réponds UNIQUEMENT avec le JSON, sans commentaire.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu es un expert SEO. Réponds uniquement en JSON valide.' },
          { role: 'user', content: aiPrompt },
        ],
      }),
    });

    let analysis = null;
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[cocoon-diag-subdomains] Failed to parse AI response:', e);
        analysis = { raw: content };
      }
    }

    // ═══ Step 4: Persist diagnostic ═══
    if (tracked_site_id) {
      await supabase.from('cocoon_diagnostic_results').insert({
        tracked_site_id,
        user_id: auth.userId,
        domain: rootDomain,
        diagnostic_type: 'subdomains',
        findings: analysis?.cannibalization_risks || [],
        scores: {
          architecture_score: analysis?.architecture_score || 0,
          architecture_type: analysis?.architecture_type || 'unknown',
          subdomain_count: nonRootSubdomains.length,
          total_urls: allUrls.length,
        },
        metadata: { subdomains, recommendations: analysis?.recommendations },
      });
    }

    console.log(`[cocoon-diag-subdomains] Complete: ${nonRootSubdomains.length} subdomains, score: ${analysis?.architecture_score}`);

    return jsonOk({
      subdomains,
      analysis,
      total_urls: allUrls.length,
      subdomain_count: nonRootSubdomains.length,
    });

  } catch (e) {
    console.error('[cocoon-diag-subdomains] Error:', e);
    return jsonError(e instanceof Error ? e.message : 'Unknown error', 500);
  }
}));

/** Extract common path patterns from a list of paths */
function extractPathPatterns(paths: string[]): string[] {
  const firstSegments: Record<string, number> = {};
  for (const path of paths) {
    const seg = path.split('/').filter(Boolean)[0];
    if (seg) {
      firstSegments[seg] = (firstSegments[seg] || 0) + 1;
    }
  }
  return Object.entries(firstSegments)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([seg, count]) => `/${seg}/ (${count})`);
}