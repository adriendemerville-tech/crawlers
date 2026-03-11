import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

// ==================== UTILITIES ====================

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

const KNOWN_LOCATIONS: Record<string, { code: number; name: string }> = {
  'france': { code: 2250, name: 'France' },
  'belgium': { code: 2056, name: 'Belgium' },
  'switzerland': { code: 2756, name: 'Switzerland' },
  'canada': { code: 2124, name: 'Canada' },
  'germany': { code: 2276, name: 'Germany' },
  'spain': { code: 2724, name: 'Spain' },
  'italy': { code: 2380, name: 'Italy' },
  'united kingdom': { code: 2826, name: 'United Kingdom' },
  'united states': { code: 2840, name: 'United States' },
};

function detectLocationCode(domain: string): number {
  const tld = domain.split('.').pop() || 'com';
  const tldMap: Record<string, string> = {
    'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada',
    'de': 'germany', 'es': 'spain', 'it': 'italy', 'uk': 'united kingdom',
    'com': 'france', 'ai': 'france', 'io': 'france', 'dev': 'france', 'app': 'france',
  };
  const locKey = tldMap[tld] || 'france';
  return KNOWN_LOCATIONS[locKey]?.code || 2250;
}

// ==================== PAGE METADATA EXTRACTION ====================

async function extractPageMetadata(url: string): Promise<{ title: string; h1: string; desc: string; context: string }> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    const resp = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) { await resp.text(); return { title: '', h1: '', desc: '', context: '' }; }
    
    let html = await resp.text();
    
    // SPA fallback
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    const textOnly = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (textOnly.length < 200 && html.length > 1000) {
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY');
      if (RENDERING_KEY) {
        try {
          const renderResponse = await fetch(`https://chrome.browserless.io/content?token=${RENDERING_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: normalizedUrl, rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'], waitFor: 2000, gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 } }),
            signal: AbortSignal.timeout(18000),
          });
          if (renderResponse.ok) { const rh = await renderResponse.text(); if (rh.length > html.length) html = rh; }
          else await renderResponse.text();
        } catch { /* skip */ }
      }
    }
    
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
    
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const h1 = h1Match?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const desc = descMatch?.[1]?.trim() || '';
    
    const context = `CONTENU PAGE: Titre="${title||'?'}", Desc="${(desc||'?').substring(0,200)}", H1="${h1||'?'}"`;
    return { title, h1, desc, context };
  } catch (e) {
    console.warn('Page fetch failed:', e instanceof Error ? e.message : e);
    return { title: '', h1: '', desc: '', context: '' };
  }
}

// ==================== KEYWORD SEED GENERATION (AI) ====================

async function generateSeedsWithAI(url: string, context: string, domain: string): Promise<string[]> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) return [];
  
  const domainClean = domain.replace(/^www\./, '').split('.')[0];
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: `Analyse cette page:\nURL: ${url}\n${context}\n\nGénère 10 mots-clés génériques (SANS le nom de marque "${domainClean}") que des clients taperaient. Expressions de 2-4 mots, intention commerciale ou informationnelle.\nRéponds UNIQUEMENT JSON: {"seeds":["mot clé 1","mot clé 2",...]}` }],
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(12000),
    });
    
    if (!response.ok) { await response.text(); return []; }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    trackTokenUsage('audit-compare-seeds', 'google/gemini-2.5-flash-lite', data.usage, url);
    
    let jsonStr = content;
    if (content.includes('```json')) jsonStr = content.split('```json')[1].split('```')[0].trim();
    else if (content.includes('```')) jsonStr = content.split('```')[1].split('```')[0].trim();
    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    
    const parsed = JSON.parse(jsonStr);
    return (parsed.seeds || []).filter((s: string) => typeof s === 'string' && s.length > 3 && !s.toLowerCase().includes(domainClean.toLowerCase())).slice(0, 10);
  } catch {
    return [];
  }
}

// ==================== KEYWORD DATA (DataForSEO) ====================

async function fetchKeywordData(seeds: string[], locationCode: number, domain: string): Promise<any[]> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || seeds.length === 0) return [];
  
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const results: any[] = [];
  const seen = new Set<string>();
  
  try {
    // Fetch keyword volumes
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keywords: seeds.slice(0, 5), location_code: locationCode, language_code: 'fr', sort_by: 'search_volume' }]),
    });
    
    if (response.ok) {
      trackPaidApiCall('audit-compare', 'dataforseo', 'keywords_for_keywords');
      const data = await response.json();
      if (data.status_code === 20000 && data.tasks?.[0]?.result) {
        for (const item of data.tasks[0].result) {
          if (item.keyword && item.search_volume >= 0 && !seen.has(item.keyword.toLowerCase())) {
            seen.add(item.keyword.toLowerCase());
            results.push({ keyword: item.keyword, volume: item.search_volume || 0, difficulty: item.competition_index || 30 });
          }
        }
      }
    } else { await response.text(); }
    
    // Check SERP rankings for top 8 keywords
    const topKw = results.sort((a, b) => b.volume - a.volume).slice(0, 8);
    if (topKw.length > 0) {
      const serpTasks = topKw.map(kw => ({ keyword: kw.keyword, location_code: locationCode, language_code: 'fr', depth: 30, se_domain: 'google.fr' }));
      const serpResp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(serpTasks),
      });
      
      if (serpResp.ok) {
        trackPaidApiCall('audit-compare', 'dataforseo', 'serp/organic');
        const serpData = await serpResp.json();
        for (let i = 0; i < topKw.length; i++) {
          const taskResult = serpData.tasks?.[i]?.result?.[0];
          let rank: number | string = 'Non classé';
          let isRanked = false;
          if (taskResult?.items) {
            for (const item of taskResult.items) {
              if (item.type === 'paid') continue;
              const itemDomain = (item.domain || '').toLowerCase().replace(/^www\./, '');
              if (itemDomain === cleanDomain || (item.url || '').toLowerCase().includes(cleanDomain)) {
                rank = item.rank_absolute || 1;
                isRanked = true;
                break;
              }
            }
          }
          topKw[i].current_rank = rank;
          topKw[i].is_ranked = isRanked;
        }
      } else { await serpResp.text(); }
    }
    
    return topKw.slice(0, 10);
  } catch (e) {
    console.error('Keyword data error:', e);
    return [];
  }
}

// ==================== LIGHTWEIGHT LLM ANALYSIS ====================

const COMPARE_SYSTEM_PROMPT = `RÔLE: Senior Digital Strategist spécialisé GEO & Visibilité IA. Analyse comparative focalisée.

POSTURE: Analytique, factuel, concis. Jargon expert (E-E-A-T, Topical Authority, Citabilité).

Tu analyses UN site web pour un audit comparatif. Concentre-toi sur la perception des LLMs, les mots-clés et la stratégie de visibilité IA.`;

function buildComparePrompt(url: string, domain: string, metadata: { title: string; h1: string; desc: string }, keywords: any[], llmData: any): string {
  let kwSection = '';
  if (keywords.length > 0) {
    kwSection = `\n📊 MOTS-CLÉS (DataForSEO):\n${keywords.map(kw => `"${kw.keyword}": ${kw.volume}vol, diff${kw.difficulty}, pos:${kw.current_rank || 'Non classé'}`).join('\n')}`;
  }
  
  let llmSection = '';
  if (llmData) {
    llmSection = `\n🤖 VISIBILITÉ LLM:\nScore: ${llmData.overallScore ?? '?'}/100`;
    if (llmData.models && Array.isArray(llmData.models)) {
      for (const m of llmData.models) {
        if (m.name) llmSection += `\n- ${m.name}: mentioned=${m.brandMentioned ?? '?'}, sentiment=${m.sentiment ?? '?'}`;
      }
    }
  }
  
  return `Analyse "${url}" (${domain}).
Titre="${metadata.title||'?'}", H1="${metadata.h1||'?'}", Desc="${metadata.desc?.substring(0,200)||'?'}"
${kwSection}
${llmSection}

GÉNÈRE un JSON avec ces modules UNIQUEMENT:
{
  "brand_dna": "Description concise du positionnement et de l'identité de marque. MAX 280 caractères.",
  "strengths": ["Force 1", "Force 2", "Force 3"],
  "weaknesses": ["Faiblesse 1", "Faiblesse 2", "Faiblesse 3"],
  "llm_visibility": {
    "citation_probability": 0-100,
    "analysis": "2-3 phrases sur la perception par les IA",
    "test_queries": [
      {"query": "requête test 1", "purpose": "objectif", "target_llms": ["ChatGPT","Claude","Perplexity"]},
      {"query": "requête test 2", "purpose": "objectif", "target_llms": ["ChatGPT","Claude"]},
      {"query": "requête test 3", "purpose": "objectif", "target_llms": ["Perplexity"]}
    ]
  },
  "keyword_positioning": {
    "main_keywords": [{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"Transactionnel|Informatif|Décisionnel","business_value":"High|Medium|Low","recommended_action":"..."}}],
    "opportunities": ["opportunité 1","opportunité 2"],
    "recommendations": ["rec 1","rec 2"]
  },
  "aeo_score": 0-100,
  "expertise_sentiment": {"rating": 1-5, "justification": "1 phrase"}
}

RÈGLES:
- brand_dna: STRICTEMENT 280 caractères max
- strengths & weaknesses: EXACTEMENT 3 chacun, phrases courtes
- main_keywords: reprends les données DataForSEO fournies avec analyse stratégique
- aeo_score: estime la capacité du site à apparaître en position zéro / réponse IA
- expertise_sentiment: 1=générique/IA, 5=expert terrain confirmé
- JSON pur, sans commentaires`;
}

// ==================== JSON PARSER ====================

function parseAIResponse(content: string | null): any {
  if (!content) return null;
  try {
    let jsonStr = content;
    if (content.includes('```json')) jsonStr = content.split('```json')[1].split('```')[0].trim();
    else if (content.includes('```')) jsonStr = content.split('```')[1].split('```')[0].trim();
    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return JSON.parse(jsonStr);
  } catch {
    try {
      const first = content.indexOf('{');
      const last = content.lastIndexOf('}');
      if (first !== -1 && last > first) {
        let s = content.substring(first, last + 1).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(s);
      }
    } catch { /* skip */ }
    return null;
  }
}

// ==================== CACHE HELPERS ====================

function buildCacheKey(url1: string, url2: string): string {
  const sorted = [url1, url2].sort().join('|');
  return `compare:${sorted}`;
}

async function saveToCache(supabase: any, cacheKey: string, resultData: any): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h
    await supabase.from('audit_cache').upsert({
      cache_key: cacheKey,
      function_name: 'audit-compare',
      result_data: resultData,
      expires_at: expiresAt,
    }, { onConflict: 'cache_key' });
  } catch (e) {
    console.warn('Cache save failed:', e);
  }
}

// ==================== SINGLE-SITE PIPELINE ====================

/** Runs the full pipeline for one site: metadata → seeds → keywords → LLM analysis */
async function analyzeSite(
  url: string,
  domain: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  openrouterKey: string,
): Promise<{ metadata: any; analysis: any; llm_raw: any; keywords: any[] }> {
  // Step 1: Metadata + LLM visibility in parallel
  const [metadata, llmResult] = await Promise.all([
    extractPageMetadata(url),
    (async () => {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/check-llm`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, lang: 'fr' }),
          signal: AbortSignal.timeout(35000),
        });
        if (!resp.ok) { await resp.text(); return null; }
        const r = await resp.json();
        return r.success && r.data ? r.data : null;
      } catch { return null; }
    })(),
  ]);

  // Step 2: Seeds (needs metadata)
  const seeds = await generateSeedsWithAI(url, metadata.context, domain);

  // Step 3: Keywords (needs seeds)
  const locCode = detectLocationCode(domain);
  const keywords = await fetchKeywordData(seeds, locCode, domain);

  // Step 4: LLM analysis (needs all above)
  const prompt = buildComparePrompt(url, domain, metadata, keywords, llmResult);
  let analysis: any = null;
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: COMPARE_SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(55000),
    });
    if (resp.ok) {
      const data = await resp.json();
      trackTokenUsage('audit-compare', 'google/gemini-2.5-flash', data.usage, url);
      analysis = parseAIResponse(data.choices?.[0]?.message?.content || null);
    } else { await resp.text(); }
  } catch (e) {
    console.warn(`LLM analysis failed for ${domain}:`, e instanceof Error ? e.message : e);
  }

  return { metadata, analysis, llm_raw: llmResult, keywords };
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  
  try {
    const { url1, url2 } = await req.json();
    
    if (!url1 || !url2) return json({ success: false, error: 'Two URLs are required' }, 400);
    
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) return json({ success: false, error: 'AI service not configured' }, 500);
    
    // Verify auth & deduct credits
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ success: false, error: 'Authentication required' }, 401);
    
    const normalize = (u: string) => u.startsWith('http') ? u : `https://${u}`;
    const normalizedUrl1 = normalize(url1);
    const normalizedUrl2 = normalize(url2);
    const cacheKey = buildCacheKey(normalizedUrl1, normalizedUrl2);

    // Check cache first (recover from previous timeout)
    const { data: cached } = await supabaseAdmin
      .from('audit_cache')
      .select('result_data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached?.result_data) {
      console.log(`✅ Audit comparé: cache hit for ${url1} vs ${url2}`);
      return json({ success: true, data: cached.result_data, fromCache: true });
    }

    // Check credits (5 required)
    const { data: profile } = await supabase.from('profiles').select('credits_balance, plan_type, subscription_status').eq('user_id', user.id).single();
    
    const isProAgency = profile?.plan_type === 'agency_pro' && profile?.subscription_status === 'active';
    
    if (!isProAgency) {
      if (!profile || profile.credits_balance < 5) {
        return json({ success: false, error: 'Insufficient credits (5 required)', balance: profile?.credits_balance || 0 }, 402);
      }
      
      // Deduct 5 credits
      const { data: creditResult } = await supabase.rpc('use_credit', { p_user_id: user.id, p_amount: 5, p_description: 'Audit comparé' });
      if (!creditResult?.success) {
        return json({ success: false, error: creditResult?.error || 'Credit deduction failed' }, 402);
      }
    }
    
    const domain1 = new URL(normalizedUrl1).hostname.replace(/^www\./, '');
    const domain2 = new URL(normalizedUrl2).hostname.replace(/^www\./, '');
    
    console.log(`🔄 Audit comparé: ${domain1} vs ${domain2}`);
    
    // ═══ Run both site pipelines in PARALLEL ═══
    const [site1, site2] = await Promise.all([
      analyzeSite(url1, domain1, supabaseUrl, supabaseAnonKey, OPENROUTER_API_KEY),
      analyzeSite(url2, domain2, supabaseUrl, supabaseAnonKey, OPENROUTER_API_KEY),
    ]);
    
    console.log(`✅ Audit comparé terminé: site1=${site1.analysis ? 'OK' : 'FAIL'}, site2=${site2.analysis ? 'OK' : 'FAIL'}`);
    
    const resultData = {
      site1: {
        url: url1,
        domain: domain1,
        metadata: site1.metadata,
        analysis: site1.analysis || { brand_dna: 'Analyse non disponible', strengths: [], weaknesses: [], aeo_score: 0, expertise_sentiment: { rating: 1, justification: 'Non évalué' } },
        llm_raw: site1.llm_raw,
        keywords: site1.keywords,
      },
      site2: {
        url: url2,
        domain: domain2,
        metadata: site2.metadata,
        analysis: site2.analysis || { brand_dna: 'Analyse non disponible', strengths: [], weaknesses: [], aeo_score: 0, expertise_sentiment: { rating: 1, justification: 'Non évalué' } },
        llm_raw: site2.llm_raw,
        keywords: site2.keywords,
      },
      scannedAt: new Date().toISOString(),
    };

    // Save to cache preemptively (smart cache pattern)
    await saveToCache(supabaseAdmin, cacheKey, resultData);

    return json({ success: true, data: resultData });
  } catch (e) {
    console.error('audit-compare error:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
