/**
 * analyze-serp-intents
 *
 * Décompose une requête Google en multi-intentions, identifie ce que la page
 * client couvre vs ce qui manque, et propose des actions priorisées (quick win
 * vs long terme) routées vers Workbench / Plan d'action / Content Architect.
 *
 * Pipeline :
 *  1. Cache lookup sur `serp_intent_analyses` (TTL 7j)
 *  2. SERP DataForSEO (depth=30) — fallback Serper si erreur
 *  3. Position GSC : keyword_universe.current_position OU DataForSEO Labs proxy
 *  4. Sélection adaptative concurrents : top 5 + voisins (positions N-5..N-1)
 *  5. Crawl render-page parallèle (timeout 8s/url)
 *  6. LLM Gemini 2.5 Pro : détection intents + matrice de couverture + recommandations
 *  7. Persistance dans serp_intent_analyses (upsert sur user_id, domain, keyword, page_url)
 */

// Validation manuelle légère (pas de zod ailleurs dans le projet)
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { fetchAndRenderPage } from '../_shared/renderPage.ts';
import { callLovableAIJson } from '../_shared/lovableAI.ts';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';

// ───────────────────────────────────────────────────────────────
// Schémas
// ───────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  keyword: string;
  domain: string;
  page_url?: string | null;
  tracked_site_id?: string | null;
  location_name?: string;
  language_code?: string;
  force_refresh?: boolean;
}

function validateRequest(body: unknown): { ok: true; data: Required<Pick<AnalyzeRequest, 'keyword' | 'domain' | 'location_name' | 'language_code' | 'force_refresh'>> & Pick<AnalyzeRequest, 'page_url' | 'tracked_site_id'> } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
  const b = body as Record<string, unknown>;
  if (typeof b.keyword !== 'string' || b.keyword.length < 2 || b.keyword.length > 200) {
    return { ok: false, error: 'keyword must be a string (2-200 chars)' };
  }
  if (typeof b.domain !== 'string' || b.domain.length < 3 || b.domain.length > 253) {
    return { ok: false, error: 'domain must be a string (3-253 chars)' };
  }
  if (b.page_url !== undefined && b.page_url !== null) {
    if (typeof b.page_url !== 'string') return { ok: false, error: 'page_url must be a string or null' };
    try { new URL(b.page_url); } catch { return { ok: false, error: 'page_url must be a valid URL' }; }
  }
  if (b.tracked_site_id !== undefined && b.tracked_site_id !== null && typeof b.tracked_site_id !== 'string') {
    return { ok: false, error: 'tracked_site_id must be a string or null' };
  }
  return {
    ok: true,
    data: {
      keyword: b.keyword,
      domain: b.domain,
      page_url: (b.page_url as string | null | undefined) ?? null,
      tracked_site_id: (b.tracked_site_id as string | null | undefined) ?? null,
      location_name: typeof b.location_name === 'string' ? b.location_name : 'France',
      language_code: typeof b.language_code === 'string' ? b.language_code : 'fr',
      force_refresh: b.force_refresh === true,
    },
  };
}

interface SerpItem {
  type: string;
  url?: string;
  title?: string;
  description?: string;
  rank_absolute?: number;
  domain?: string;
}

interface CompetitorInput {
  tier: 'top' | 'neighbor';
  url: string;
  position: number;
  title: string;
  domain: string;
  rendered_text?: string;
  rendered_h1?: string | null;
}

// ───────────────────────────────────────────────────────────────
// SERP — DataForSEO (mode incognito-like, fallback Serper)
// ───────────────────────────────────────────────────────────────

interface SerpResponse {
  items: SerpItem[];
  serp_features: string[];
  paa_questions: string[];
  related_searches: string[];
  provider: 'dataforseo' | 'serper';
  cost_usd: number;
}

async function fetchSerpDataForSEO(
  keyword: string,
  location: string,
  language: string,
): Promise<SerpResponse | null> {
  const login = Deno.env.get('DATAFORSEO_LOGIN');
  const password = Deno.env.get('DATAFORSEO_PASSWORD');
  if (!login || !password) return null;

  try {
    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${login}:${password}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keyword,
        location_name: location,
        language_code: language,
        device: 'desktop',
        depth: 30,
        // Mode "incognito-like" : pas de user_data, SERP non personnalisée
      }]),
    });
    if (!resp.ok) {
      console.warn('[analyze-serp-intents] DataForSEO HTTP', resp.status);
      return null;
    }
    const data = await resp.json();
    const items: SerpItem[] = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    const serp_features = new Set<string>();
    const paa_questions: string[] = [];
    const related_searches: string[] = [];

    for (const it of items) {
      if (it.type !== 'organic') serp_features.add(it.type);
      const anyIt = it as unknown as Record<string, unknown>;
      if (it.type === 'people_also_ask' && Array.isArray(anyIt.items)) {
        for (const q of anyIt.items as Array<{ title?: string }>) {
          if (q.title) paa_questions.push(q.title);
        }
      }
      if (it.type === 'related_searches' && Array.isArray(anyIt.items)) {
        for (const r of anyIt.items as Array<string | { title?: string }>) {
          const text = typeof r === 'string' ? r : r.title;
          if (text) related_searches.push(text);
        }
      }
    }

    await trackPaidApiCall('analyze-serp-intents', 'dataforseo', 'serp/google/organic/advanced').catch(() => {});

    return {
      items,
      serp_features: Array.from(serp_features),
      paa_questions,
      related_searches,
      provider: 'dataforseo',
      cost_usd: 0.002,
    };
  } catch (e) {
    console.error('[analyze-serp-intents] DataForSEO error:', e);
    return null;
  }
}

async function fetchSerpSerperFallback(
  keyword: string,
  location: string,
  language: string,
): Promise<SerpResponse | null> {
  const key = Deno.env.get('SERPER_API_KEY');
  if (!key) return null;

  try {
    const resp = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, gl: language === 'fr' ? 'fr' : 'us', hl: language, num: 30 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const organic: Array<Record<string, unknown>> = data.organic ?? [];
    const items: SerpItem[] = organic.map((o, idx) => ({
      type: 'organic',
      url: String(o.link ?? ''),
      title: String(o.title ?? ''),
      description: String(o.snippet ?? ''),
      rank_absolute: Number(o.position ?? idx + 1),
      domain: (() => { try { return new URL(String(o.link)).hostname; } catch { return ''; } })(),
    }));
    const paa_questions: string[] = (data.peopleAlsoAsk ?? []).map((p: { question: string }) => p.question).filter(Boolean);
    const related_searches: string[] = (data.relatedSearches ?? []).map((r: { query: string }) => r.query).filter(Boolean);

    await trackPaidApiCall('analyze-serp-intents', 'serper', 'search').catch(() => {});

    return {
      items,
      serp_features: data.peopleAlsoAsk ? ['people_also_ask'] : [],
      paa_questions,
      related_searches,
      provider: 'serper',
      cost_usd: 0.001,
    };
  } catch (e) {
    console.error('[analyze-serp-intents] Serper fallback error:', e);
    return null;
  }
}

// ───────────────────────────────────────────────────────────────
// Position : GSC d'abord, sinon DataForSEO Labs proxy
// ───────────────────────────────────────────────────────────────

async function findOurPosition(
  userId: string,
  domain: string,
  keyword: string,
  serpItems: SerpItem[],
): Promise<{ position: number | null; source: 'gsc' | 'dataforseo_labs' | 'unknown' }> {
  // 1) GSC via keyword_universe
  const sb = getServiceClient();
  const { data: kw } = await sb
    .from('keyword_universe')
    .select('current_position')
    .eq('user_id', userId)
    .eq('domain', domain)
    .eq('keyword', keyword)
    .maybeSingle();
  if (kw?.current_position) return { position: kw.current_position, source: 'gsc' };

  // 2) DataForSEO Labs proxy : si notre domaine apparaît dans la SERP top 30
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  for (const item of serpItems) {
    if (item.type !== 'organic') continue;
    const itemDomain = (item.domain ?? '').toLowerCase().replace(/^www\./, '');
    if (itemDomain === cleanDomain && item.rank_absolute) {
      return { position: item.rank_absolute, source: 'dataforseo_labs' };
    }
  }

  return { position: null, source: 'unknown' };
}

// ───────────────────────────────────────────────────────────────
// Sélection adaptative top 5 + voisins
// ───────────────────────────────────────────────────────────────

function selectCompetitors(serpItems: SerpItem[], ourPosition: number | null): CompetitorInput[] {
  const organic = serpItems
    .filter((i) => i.type === 'organic' && i.url && i.rank_absolute)
    .sort((a, b) => (a.rank_absolute ?? 99) - (b.rank_absolute ?? 99));

  const picked = new Map<string, CompetitorInput>();

  // Toujours top 5
  for (const item of organic.slice(0, 5)) {
    if (!item.url) continue;
    picked.set(item.url, {
      tier: 'top',
      url: item.url,
      position: item.rank_absolute ?? 0,
      title: item.title ?? '',
      domain: item.domain ?? '',
    });
  }

  // Voisins selon position
  if (ourPosition !== null && ourPosition > 5 && ourPosition <= 30) {
    // Positions N-5 à N-1
    const start = Math.max(6, ourPosition - 5);
    const end = ourPosition - 1;
    for (const item of organic) {
      const pos = item.rank_absolute ?? 0;
      if (pos >= start && pos <= end && item.url && !picked.has(item.url)) {
        picked.set(item.url, {
          tier: 'neighbor',
          url: item.url,
          position: pos,
          title: item.title ?? '',
          domain: item.domain ?? '',
        });
      }
    }
  }

  return Array.from(picked.values()).slice(0, 10);
}

// ───────────────────────────────────────────────────────────────
// Crawl parallèle (timeout 8s, max 10 pages)
// ───────────────────────────────────────────────────────────────

async function crawlCompetitors(competitors: CompetitorInput[]): Promise<CompetitorInput[]> {
  const results = await Promise.allSettled(
    competitors.map(async (c) => {
      try {
        const rendered = await fetchAndRenderPage(c.url, { timeout: 8000 });
        const text = rendered.html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000); // limite tokens LLM
        const h1Match = rendered.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        return { ...c, rendered_text: text, rendered_h1: h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null };
      } catch {
        return { ...c, rendered_text: '', rendered_h1: null };
      }
    }),
  );
  return results.map((r, i) => (r.status === 'fulfilled' ? r.value : competitors[i]));
}

async function crawlOurPage(pageUrl: string | null | undefined): Promise<string> {
  if (!pageUrl) return '';
  try {
    const rendered = await fetchAndRenderPage(pageUrl, { timeout: 8000 });
    return rendered.html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
  } catch {
    return '';
  }
}

// ───────────────────────────────────────────────────────────────
// LLM — décomposition intents + matrice de couverture
// ───────────────────────────────────────────────────────────────

interface LLMResult {
  detected_intents: Array<{
    id: string;
    label: string;
    type: 'transactional' | 'informational' | 'comparison' | 'local' | 'navigational';
    description: string;
    weight: number;
    evidence: { paa: string[]; related: string[]; features: string[] };
  }>;
  competitors_analysis: Array<{
    url: string;
    intents_covered: string[];
    sections: Array<{ heading: string; intent_id: string }>;
    strengths: string[];
    coverage_score: number;
  }>;
  coverage_matrix: {
    intents: Array<{
      intent_id: string;
      covered: boolean;
      depth: 'none' | 'partial' | 'full';
      evidence: string;
      gap_score: number;
    }>;
    global_coverage_score: number;
    gap_vs_top5: number;
    gap_vs_neighbors: number;
  };
  recommendations: Array<{
    priority: 'quick_win' | 'long_term';
    target_intent: string;
    action_type: string;
    description: string;
    target_module: 'workbench' | 'action_plan' | 'content_architect';
    estimated_impact: string;
  }>;
}

async function analyzeWithLLM(
  keyword: string,
  serpFeatures: string[],
  paa: string[],
  related: string[],
  competitors: CompetitorInput[],
  ourPageText: string,
  ourPosition: number | null,
): Promise<LLMResult> {
  const competitorsBlock = competitors.map((c, i) => (
    `### Concurrent ${i + 1} [${c.tier === 'top' ? 'TOP' : 'VOISIN'}] position ${c.position}\n` +
    `URL: ${c.url}\nTitle: ${c.title}\nH1: ${c.rendered_h1 ?? '(absent)'}\n` +
    `Contenu (extrait): ${(c.rendered_text ?? '').slice(0, 1500)}`
  )).join('\n\n');

  const ourBlock = ourPageText
    ? `## Notre page (position ${ourPosition ?? 'inconnue'})\n${ourPageText.slice(0, 3000)}`
    : '## Notre page\n(non fournie ou crawl échoué)';

  const system = `Tu es un analyste SERP expert. Tu décomposes une requête Google en 3 à 5 intentions distinctes ` +
    `(achat, info, comparatif, local, navigationnel) en t'appuyant sur les SERP features (PAA, related, ` +
    `featured snippet, shopping, video, local pack) et le contenu réel des concurrents. Tu produis une matrice ` +
    `de couverture stricte et factuelle. JAMAIS d'invention : si une intention n'a aucune preuve, ne la mets pas. ` +
    `Réponds STRICTEMENT en JSON valide, sans markdown, sans commentaire.`;

  const user = `# Requête analysée\n"${keyword}"\n\n` +
    `# SERP features détectées\n${serpFeatures.join(', ') || '(aucune)'}\n\n` +
    `# People Also Ask (top 6)\n${paa.slice(0, 6).map((q) => `- ${q}`).join('\n') || '(aucune)'}\n\n` +
    `# Related searches (top 6)\n${related.slice(0, 6).map((q) => `- ${q}`).join('\n') || '(aucune)'}\n\n` +
    `# Concurrents analysés (${competitors.length})\n${competitorsBlock}\n\n` +
    `${ourBlock}\n\n` +
    `# Tâche\nProduis un objet JSON avec les clés EXACTES suivantes :\n` +
    `{
  "detected_intents": [{ "id": "kebab-case", "label": "FR", "type": "transactional|informational|comparison|local|navigational", "description": "1 phrase", "weight": 0..1, "evidence": { "paa": [], "related": [], "features": [] } }],
  "competitors_analysis": [{ "url": "...", "intents_covered": ["intent_id"], "sections": [{ "heading": "...", "intent_id": "..." }], "strengths": ["..."], "coverage_score": 0..100 }],
  "coverage_matrix": {
    "intents": [{ "intent_id": "...", "covered": true|false, "depth": "none|partial|full", "evidence": "citation courte de notre page ou 'absent'", "gap_score": 0..100 }],
    "global_coverage_score": 0..100,
    "gap_vs_top5": 0..100,
    "gap_vs_neighbors": 0..100
  },
  "recommendations": [{ "priority": "quick_win|long_term", "target_intent": "intent_id", "action_type": "add_section|enrich_section|add_faq|add_comparison|add_schema|...", "description": "1 phrase actionnable", "target_module": "workbench|action_plan|content_architect", "estimated_impact": "courte estimation" }]
}\n\n` +
    `Règles :\n` +
    `- 3 à 5 intentions max\n` +
    `- gap_vs_neighbors = écart vs concurrents tier "neighbor" uniquement (quick wins)\n` +
    `- gap_vs_top5 = écart vs concurrents tier "top" uniquement (long terme)\n` +
    `- recommendations : priorité "quick_win" pour fermer gap_vs_neighbors, "long_term" pour gap_vs_top5\n` +
    `- target_module : "content_architect" pour création/refonte, "workbench" pour patch ciblé, "action_plan" pour suivi/SEO technique`;

  return await callLovableAIJson<LLMResult>({
    system,
    user,
    model: 'google/gemini-2.5-pro',
    temperature: 0.2,
    maxTokens: 4000,
    callerFunction: 'analyze-serp-intents',
    responseFormat: { type: 'json_object' },
  });
}

// ───────────────────────────────────────────────────────────────
// Handler
// ───────────────────────────────────────────────────────────────

export default handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);

  const parsed = validateRequest(await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return jsonError(`Invalid request: ${parsed.error}`, 400);
  }
  const { keyword, domain, page_url, tracked_site_id, location_name, language_code, force_refresh } = parsed.data;

  const sb = getServiceClient();

  // 1) Cache lookup
  if (!force_refresh) {
    const { data: cached } = await sb
      .from('serp_intent_analyses')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('domain', domain)
      .eq('keyword', keyword)
      .eq('page_url', page_url ?? '')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return jsonOk({ cached: true, analysis: cached });
    }
  }

  // 2) SERP fetch
  let serp = await fetchSerpDataForSEO(keyword, location_name, language_code);
  if (!serp) {
    serp = await fetchSerpSerperFallback(keyword, location_name, language_code);
  }
  if (!serp) return jsonError('SERP providers unavailable (DataForSEO + Serper failed)', 502);

  // 3) Position
  const { position: ourPosition, source: positionSource } = await findOurPosition(
    auth.userId, domain, keyword, serp.items,
  );

  // 4) Sélection concurrents
  const competitorsRaw = selectCompetitors(serp.items, ourPosition);
  if (competitorsRaw.length === 0) return jsonError('No organic competitors found in SERP', 404);

  // 5) Crawl parallèle (concurrents + notre page)
  const [competitorsCrawled, ourPageText] = await Promise.all([
    crawlCompetitors(competitorsRaw),
    crawlOurPage(page_url),
  ]);

  // 6) LLM
  let llmResult: LLMResult;
  try {
    llmResult = await analyzeWithLLM(
      keyword,
      serp.serp_features,
      serp.paa_questions,
      serp.related_searches,
      competitorsCrawled,
      ourPageText,
      ourPosition,
    );
  } catch (e) {
    console.error('[analyze-serp-intents] LLM failed:', e);
    return jsonError(`LLM analysis failed: ${e instanceof Error ? e.message : 'unknown'}`, 502);
  }

  // 7) Persistance
  const topCompetitorsForDb = competitorsCrawled.map((c) => {
    const llmMatch = llmResult.competitors_analysis.find((x) => x.url === c.url);
    return {
      tier: c.tier,
      url: c.url,
      position: c.position,
      title: c.title,
      domain: c.domain,
      intents_covered: llmMatch?.intents_covered ?? [],
      sections: llmMatch?.sections ?? [],
      strengths: llmMatch?.strengths ?? [],
      coverage_score: llmMatch?.coverage_score ?? 0,
    };
  });

  const row = {
    user_id: auth.userId,
    tracked_site_id: tracked_site_id ?? null,
    domain,
    keyword,
    page_url: page_url ?? null,
    our_position: ourPosition,
    position_source: positionSource,
    detected_intents: llmResult.detected_intents,
    top_competitors: topCompetitorsForDb,
    coverage_matrix: llmResult.coverage_matrix,
    serp_features: serp.serp_features,
    recommendations: llmResult.recommendations,
    serp_provider: serp.provider,
    cost_usd: serp.cost_usd,
    analyzed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
  };

  const { data: saved, error: saveError } = await sb
    .from('serp_intent_analyses')
    .upsert(row, { onConflict: 'user_id,domain,keyword,page_url' })
    .select()
    .single();

  if (saveError) {
    console.error('[analyze-serp-intents] Persist failed:', saveError);
    return jsonError(`Persist failed: ${saveError.message}`, 500);
  }

  return jsonOk({ cached: false, analysis: saved });
});
