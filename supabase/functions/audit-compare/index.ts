import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
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

// ==================== PAGESPEED ====================

interface PageSpeedScores {
  performanceMobile: number;
  performanceDesktop: number;
  fcpMs: number;
  lcpMs: number;
  cls: number;
  ttfbMs: number;
}

async function fetchPageSpeedScores(url: string): Promise<PageSpeedScores | null> {
  const API_KEY = Deno.env.get('GOOGLE_PAGESPEED_API_KEY');
  if (!API_KEY) return null;
  
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  
  try {
    const [mobileResp, desktopResp] = await Promise.all([
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=mobile&category=performance&key=${API_KEY}`, { signal: AbortSignal.timeout(20000) }),
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(normalizedUrl)}&strategy=desktop&category=performance&key=${API_KEY}`, { signal: AbortSignal.timeout(20000) }),
    ]);
    
    let performanceMobile = 0, performanceDesktop = 0;
    let fcpMs = 0, lcpMs = 0, cls = 0, ttfbMs = 0;
    
    if (mobileResp.ok) {
      const d = await mobileResp.json();
      performanceMobile = Math.round((d.lighthouseResult?.categories?.performance?.score || 0) * 100);
      const audits = d.lighthouseResult?.audits || {};
      fcpMs = Math.round(audits['first-contentful-paint']?.numericValue || 0);
      lcpMs = Math.round(audits['largest-contentful-paint']?.numericValue || 0);
      cls = parseFloat((audits['cumulative-layout-shift']?.numericValue || 0).toFixed(3));
      ttfbMs = Math.round(audits['server-response-time']?.numericValue || 0);
    } else { await mobileResp.text(); }
    
    if (desktopResp.ok) {
      const d = await desktopResp.json();
      performanceDesktop = Math.round((d.lighthouseResult?.categories?.performance?.score || 0) * 100);
    } else { await desktopResp.text(); }
    
    trackPaidApiCall('audit-compare', 'google', 'pagespeed');
    return { performanceMobile, performanceDesktop, fcpMs, lcpMs, cls, ttfbMs };
  } catch (e) {
    console.warn('PageSpeed fetch failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ==================== CONTENT DEPTH EXTRACTION ====================

interface ContentDepth {
  wordCount: number;
  h2Count: number;
  h3Count: number;
  hasJsonLd: boolean;
  hasOpenGraph: boolean;
  hasFAQ: boolean;
  internalLinksCount: number;
  externalLinksCount: number;
  imagesCount: number;
  imagesWithoutAlt: number;
}

function extractContentDepth(html: string, domain: string): ContentDepth {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const textOnly = body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();

  const h2Matches = body.match(/<h2[\s>]/gi);
  const h3Matches = body.match(/<h3[\s>]/gi);

  const hasJsonLd = /<script[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(html);
  const hasOpenGraph = /<meta[^>]*property=["']og:/i.test(html);
  const hasFAQ = /FAQPage/i.test(html) || (/<h[23][^>]*>[^<]*(FAQ|question|foire aux questions)/i.test(html));

  // Count links
  const linkMatches = html.match(/<a[^>]*href=["']([^"'#]+)["'][^>]*>/gi) || [];
  let internal = 0, external = 0;
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  for (const link of linkMatches) {
    const hrefMatch = link.match(/href=["']([^"'#]+)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (href.startsWith('/') || href.includes(cleanDomain)) internal++;
    else if (href.startsWith('http')) external++;
  }

  // Count images
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  let imagesWithoutAlt = 0;
  for (const img of imgMatches) {
    if (!/alt=["'][^"']+["']/i.test(img)) imagesWithoutAlt++;
  }

  return {
    wordCount: textOnly.split(/\s+/).filter(w => w.length > 1).length,
    h2Count: h2Matches?.length || 0,
    h3Count: h3Matches?.length || 0,
    hasJsonLd,
    hasOpenGraph,
    hasFAQ,
    internalLinksCount: internal,
    externalLinksCount: external,
    imagesCount: imgMatches.length,
    imagesWithoutAlt,
  };
}

// ==================== BRAND COLOR EXTRACTION ====================

function extractBrandColor(html: string): string | null {
  // 1. <meta name="theme-color" content="#xxx">
  const themeColorMatch = html.match(/<meta\s+name=["']theme-color["']\s+content=["']([^"']+)["']/i) ||
                          html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']theme-color["']/i);
  if (themeColorMatch?.[1] && /^#[0-9a-fA-F]{3,8}$/.test(themeColorMatch[1].trim())) {
    return themeColorMatch[1].trim();
  }
  
  // 2. <meta property="og:color" ...> (less common)
  const ogColorMatch = html.match(/<meta\s+property=["']og:color["']\s+content=["']([^"']+)["']/i);
  if (ogColorMatch?.[1] && /^#[0-9a-fA-F]{3,8}$/.test(ogColorMatch[1].trim())) {
    return ogColorMatch[1].trim();
  }

  // 3. Most frequently used non-white/black/gray hex color in inline styles & CSS
  const colorMatches = html.match(/#[0-9a-fA-F]{6}/g) || [];
  const colorCounts = new Map<string, number>();
  for (const c of colorMatches) {
    const lower = c.toLowerCase();
    // Skip white, black, grays, near-white, near-black
    if (['#ffffff', '#000000', '#f5f5f5', '#333333', '#666666', '#999999', '#cccccc', '#eeeeee', '#fafafa', '#f0f0f0', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#404040', '#262626', '#171717'].includes(lower)) continue;
    // Skip near-gray (all channels within 30 of each other)
    const r = parseInt(lower.slice(1, 3), 16);
    const g = parseInt(lower.slice(3, 5), 16);
    const b = parseInt(lower.slice(5, 7), 16);
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC - minC < 30) continue; // too gray
    colorCounts.set(lower, (colorCounts.get(lower) || 0) + 1);
  }
  
  if (colorCounts.size > 0) {
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  }
  
  return null;
}

// ==================== PAGE METADATA EXTRACTION ====================

interface PageMetadata {
  title: string;
  h1: string;
  desc: string;
  context: string;
  contentDepth: ContentDepth;
  rawHtml: string;
  brandColor: string | null;
}

async function extractPageMetadata(url: string, domain: string): Promise<PageMetadata> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const emptyDepth: ContentDepth = { wordCount: 0, h2Count: 0, h3Count: 0, hasJsonLd: false, hasOpenGraph: false, hasFAQ: false, internalLinksCount: 0, externalLinksCount: 0, imagesCount: 0, imagesWithoutAlt: 0 };
  try {
    const resp = await fetch(normalizedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) { await resp.text(); return { title: '', h1: '', desc: '', context: '', contentDepth: emptyDepth, rawHtml: '' }; }
    
    let html = await resp.text();
    
    // SPA fallback
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    const textOnly = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (textOnly.length < 200 && html.length > 500) {
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY');
      if (RENDERING_KEY) {
        try {
          console.log(`[audit-compare] SPA detected for ${normalizedUrl} (textOnly=${textOnly.length} chars), using Browserless v2`);
          const renderResponse = await fetch(`https://production-sfo.browserless.io/content?token=${RENDERING_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: normalizedUrl,
              rejectResourceTypes: ['image', 'media', 'font'],
              waitForSelector: { selector: 'h2, main, article, section, [class*="hero"], #root > div > div', timeout: 10000 },
              gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 },
            }),
            signal: AbortSignal.timeout(25000),
          });
          if (renderResponse.ok) {
            const rh = await renderResponse.text();
            if (rh.length > html.length) {
              html = rh;
              console.log(`[audit-compare] Browserless rendered ${rh.length} chars for ${domain}`);
            }
          } else {
            const errText = await renderResponse.text();
            console.warn(`[audit-compare] Browserless failed (${renderResponse.status}): ${errText.substring(0, 200)}`);
          }
        } catch (e) {
          console.warn(`[audit-compare] Browserless error:`, e instanceof Error ? e.message : e);
        }
      } else {
        console.warn(`[audit-compare] SPA detected but no RENDERING_API_KEY configured`);
      }
    }
    
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
    
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const h1 = h1Match?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const desc = descMatch?.[1]?.trim() || '';
    const contentDepth = extractContentDepth(html, domain);
    const brandColor = extractBrandColor(html);
    
    const context = `CONTENU PAGE: Titre="${title||'?'}", Desc="${(desc||'?').substring(0,200)}", H1="${h1||'?'}"`;
    return { title, h1, desc, context, contentDepth, rawHtml: html, brandColor };
  } catch (e) {
    console.warn('Page fetch failed:', e instanceof Error ? e.message : e);
    return { title: '', h1: '', desc: '', context: '', contentDepth: emptyDepth, rawHtml: '', brandColor: null };
  }
}

// ==================== BACKLINKS (DataForSEO) ====================

interface BacklinkProfile {
  referringDomains: number;
  totalBacklinks: number;
  domainRank: number;
  topAnchors: string[];
}

async function fetchBacklinkProfile(domain: string): Promise<BacklinkProfile | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  try {
    const resp = await fetch('https://api.dataforseo.com/v3/backlinks/summary/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ target: domain, internal_list_limit: 0, external_list_limit: 0 }]),
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) { await resp.text(); return null; }
    trackPaidApiCall('audit-compare', 'dataforseo', 'backlinks/summary');
    const data = await resp.json();
    const result = data.tasks?.[0]?.result?.[0];
    if (!result) return null;

    // Fetch top anchors
    let topAnchors: string[] = [];
    try {
      const anchorResp = await fetch('https://api.dataforseo.com/v3/backlinks/anchors/live', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{ target: domain, limit: 5, order_by: ['backlinks,desc'] }]),
        signal: AbortSignal.timeout(10000),
      });
      if (anchorResp.ok) {
        trackPaidApiCall('audit-compare', 'dataforseo', 'backlinks/anchors');
        const anchorData = await anchorResp.json();
        const items = anchorData.tasks?.[0]?.result?.[0]?.items || [];
        topAnchors = items.map((i: any) => i.anchor || '').filter((a: string) => a.length > 0).slice(0, 5);
      } else { await anchorResp.text(); }
    } catch { /* skip anchors */ }

    return {
      referringDomains: result.referring_domains || 0,
      totalBacklinks: result.backlinks || 0,
      domainRank: result.rank || 0,
      topAnchors,
    };
  } catch (e) {
    console.warn('Backlinks fetch failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ==================== KEYWORD SEED GENERATION (AI) ====================

async function generateSeedsWithAI(url: string, context: string, domain: string, opponentDomain?: string): Promise<string[]> {
  const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
  if (!OPENROUTER_API_KEY) return [];
  
  const domainClean = domain.replace(/^www\./, '').split('.')[0];
  const opponentClean = opponentDomain?.replace(/^www\./, '').split('.')[0] || '';
  
  const excludeBrands = opponentClean 
    ? `SANS les noms de marque "${domainClean}" et "${opponentClean}"` 
    : `SANS le nom de marque "${domainClean}"`;
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: `Analyse cette page:\nURL: ${url}\n${context}\n\nGénère 10 mots-clés SPÉCIFIQUES à ce site (${excludeBrands}) que des clients de CE site précisément taperaient. Les mots-clés doivent refléter l'activité PROPRE de ${domain}, pas des termes génériques du secteur. Expressions de 2-4 mots, intention commerciale ou informationnelle.\n${opponentDomain ? `IMPORTANT: Ce site est comparé à ${opponentDomain}. Les mots-clés doivent être DIFFÉRENCIANTS pour ${domain}, pas des termes communs aux deux.` : ''}\nRéponds UNIQUEMENT JSON: {"seeds":["mot clé 1","mot clé 2",...]}` }],
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

// ==================== INDIVIDUAL SITE ANALYSIS (Phase 1 & 2) ====================

const SITE_ANALYSIS_PROMPT = `RÔLE: Senior Digital Strategist spécialisé GEO & Visibilité IA. Analyse individuelle d'un site.

POSTURE: Analytique, factuel, concis. Jargon expert (E-E-A-T, Topical Authority, Citabilité).

Tu analyses UN site web. Concentre-toi sur des observations FACTUELLES et MESURABLES.`;

function buildSitePrompt(url: string, domain: string, metadata: PageMetadata, keywords: any[], llmData: any, backlinks: BacklinkProfile | null): string {
  const cd = metadata.contentDepth;
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

  let blSection = '';
  if (backlinks) {
    blSection = `\n🔗 BACKLINKS (DataForSEO):
- Domaines référents: ${backlinks.referringDomains}
- Total backlinks: ${backlinks.totalBacklinks}
- Domain Rank: ${backlinks.domainRank}
- Top ancres: ${backlinks.topAnchors.join(', ') || 'N/A'}`;
  }

  let depthSection = `\n📄 PROFONDEUR CONTENU (HTML réel):
- Mots: ${cd.wordCount}
- H2: ${cd.h2Count}, H3: ${cd.h3Count}
- JSON-LD: ${cd.hasJsonLd ? 'Oui' : 'Non'}, Open Graph: ${cd.hasOpenGraph ? 'Oui' : 'Non'}, FAQ: ${cd.hasFAQ ? 'Oui' : 'Non'}
- Liens internes: ${cd.internalLinksCount}, externes: ${cd.externalLinksCount}
- Images: ${cd.imagesCount} (${cd.imagesWithoutAlt} sans alt)`;
  
  return `Analyse "${url}" (${domain}).
Titre="${metadata.title||'?'}", H1="${metadata.h1||'?'}", Desc="${metadata.desc?.substring(0,200)||'?'}"
${depthSection}
${blSection}
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
  "eeat_score": {
    "experience": 0-10,
    "expertise": 0-10,
    "authoritativeness": 0-10,
    "trustworthiness": 0-10,
    "overall": 0-10,
    "justification": "1-2 phrases expliquant le score"
  },
  "expertise_sentiment": {"rating": 1-5, "justification": "1 phrase"}
}

RÈGLES:
- brand_dna: STRICTEMENT 280 caractères max
- strengths & weaknesses: EXACTEMENT 3 chacun, phrases courtes
- main_keywords: reprends les données DataForSEO fournies avec analyse stratégique
- aeo_score: estime la capacité du site à apparaître en position zéro / réponse IA
- eeat_score: évalue chaque pilier E-E-A-T indépendamment (Experience=vécu terrain, Expertise=compétence technique, Authoritativeness=reconnaissance secteur, Trustworthiness=crédibilité/transparence)
- expertise_sentiment: 1=générique/IA, 5=expert terrain confirmé
- JSON pur, sans commentaires`;
}

// ==================== CROSS-COMPARISON PROMPT (Phase 3) ====================

const CROSS_COMPARE_SYSTEM = `RÔLE: Analyste comparatif senior. Tu reçois les données FACTUELLES de deux sites concurrents et tu produis une analyse DIFFÉRENTIELLE.

RÈGLE CARDINALE: Tes observations doivent s'appuyer sur les ÉCARTS MESURABLES entre les deux sites. Ne répète jamais les mêmes conclusions pour les deux. Si une métrique est proche, dis-le explicitement et explique CE QUI les différencie RÉELLEMENT.

POSTURE: Tranchant, factuel, utile. Chaque phrase doit apporter une information qu'on ne pourrait pas deviner sans les données.`;

function buildCrossComparePrompt(
  site1: { domain: string; analysis: any; backlinks: BacklinkProfile | null; contentDepth: ContentDepth; keywords: any[] },
  site2: { domain: string; analysis: any; backlinks: BacklinkProfile | null; contentDepth: ContentDepth; keywords: any[] },
): string {
  const bl1 = site1.backlinks;
  const bl2 = site2.backlinks;
  const cd1 = site1.contentDepth;
  const cd2 = site2.contentDepth;

  // Compute SERP overlap — now using enriched keywords with cross-domain rankings
  const kw1Set = new Set(site1.keywords.map((k: any) => k.keyword.toLowerCase()));
  const kw2Set = new Set(site2.keywords.map((k: any) => k.keyword.toLowerCase()));
  const overlap = [...kw1Set].filter(k => kw2Set.has(k));

  // Build unified keyword table for the prompt (all keywords with both sites' rankings)
  const allKwMap = new Map<string, { site1_rank: string | number; site2_rank: string | number; volume: number }>();
  for (const kw of site1.keywords) {
    const key = kw.keyword.toLowerCase();
    allKwMap.set(key, {
      site1_rank: kw.current_rank ?? 'Non classé',
      site2_rank: kw.opponent_rank ?? 'Non vérifié',
      volume: kw.volume || 0,
    });
  }
  for (const kw of site2.keywords) {
    const key = kw.keyword.toLowerCase();
    const existing = allKwMap.get(key);
    if (existing) {
      existing.site2_rank = kw.current_rank ?? 'Non classé';
    } else {
      allKwMap.set(key, {
        site1_rank: kw.opponent_rank ?? 'Non vérifié',
        site2_rank: kw.current_rank ?? 'Non classé',
        volume: kw.volume || 0,
      });
    }
  }

  // Keywords where BOTH sites have a numeric rank = direct competition
  const directCompetition = [...allKwMap.entries()]
    .filter(([, v]) => typeof v.site1_rank === 'number' && typeof v.site2_rank === 'number')
    .sort((a, b) => b[1].volume - a[1].volume);

  const kwTableLines = [...allKwMap.entries()]
    .sort((a, b) => b[1].volume - a[1].volume)
    .slice(0, 15)
    .map(([kw, v]) => `"${kw}": vol=${v.volume}, ${site1.domain}=#${v.site1_rank}, ${site2.domain}=#${v.site2_rank}`)
    .join('\n');

  return `COMPARAISON: ${site1.domain} vs ${site2.domain}

═══ DONNÉES FACTUELLES ═══

📄 PROFONDEUR CONTENU:
${site1.domain}: ${cd1.wordCount} mots, ${cd1.h2Count} H2, ${cd1.h3Count} H3, JSON-LD=${cd1.hasJsonLd}, OG=${cd1.hasOpenGraph}, FAQ=${cd1.hasFAQ}, liens internes=${cd1.internalLinksCount}, images sans alt=${cd1.imagesWithoutAlt}/${cd1.imagesCount}
${site2.domain}: ${cd2.wordCount} mots, ${cd2.h2Count} H2, ${cd2.h3Count} H3, JSON-LD=${cd2.hasJsonLd}, OG=${cd2.hasOpenGraph}, FAQ=${cd2.hasFAQ}, liens internes=${cd2.internalLinksCount}, images sans alt=${cd2.imagesWithoutAlt}/${cd2.imagesCount}

🔗 BACKLINKS:
${site1.domain}: ${bl1 ? `${bl1.referringDomains} domaines référents, ${bl1.totalBacklinks} backlinks, DR=${bl1.domainRank}, ancres=[${bl1.topAnchors.join(', ')}]` : 'Non disponible'}
${site2.domain}: ${bl2 ? `${bl2.referringDomains} domaines référents, ${bl2.totalBacklinks} backlinks, DR=${bl2.domainRank}, ancres=[${bl2.topAnchors.join(', ')}]` : 'Non disponible'}

📊 TABLEAU SERP CROISÉ (positions des deux sites sur le pool commun de mots-clés):
${kwTableLines || 'Aucune donnée SERP disponible'}

Chevauchement exact: ${overlap.length} mots-clés en commun
Compétition directe (les deux classés): ${directCompetition.length} mots-clés

🤖 SCORES IA INDIVIDUELS:
${site1.domain}: AEO=${site1.analysis?.aeo_score ?? '?'}, Expertise=${site1.analysis?.expertise_sentiment?.rating ?? '?'}/5
${site2.domain}: AEO=${site2.analysis?.aeo_score ?? '?'}, Expertise=${site2.analysis?.expertise_sentiment?.rating ?? '?'}/5

═══ ANALYSE DEMANDÉE ═══

Génère un JSON avec cette structure:
{
  "verdict": "Qui a l'avantage et POURQUOI, en 2 phrases maximum basées sur des données.",
  "authority_winner": "${site1.domain}" | "${site2.domain}",
  "authority_gap": {
    "magnitude": "écrasant|significatif|modéré|marginal",
    "key_factor": "Le facteur décisif en 1 phrase",
    "domain_rank_delta": number,
    "referring_domains_ratio": number
  },
  "content_depth_winner": "${site1.domain}" | "${site2.domain}",
  "content_comparison": {
    "word_count_ratio": number,
    "structural_advantage": "Qui a la meilleure hiérarchie H2/H3 et pourquoi",
    "technical_seo_edge": "Qui a le meilleur setup technique (JSON-LD, OG, FAQ) et pourquoi"
  },
  "serp_battlefield": {
    "overlap_count": number,
    "head_to_head": [{"keyword":"...","site1_rank":"...","site2_rank":"...","winner":"...","analysis":"1 phrase"}],
    "exclusive_strengths_site1": ["mots-clés où seul ${site1.domain} est positionné"],
    "exclusive_strengths_site2": ["mots-clés où seul ${site2.domain} est positionné"]
  },
  "differentiators": [
    {"dimension": "...", "site1_value": "...", "site2_value": "...", "advantage": "${site1.domain}|${site2.domain}", "impact": "critique|important|mineur"}
  ],
  "strategic_recommendations": {
    "for_site1": ["Recommandation spécifique 1", "Recommandation spécifique 2"],
    "for_site2": ["Recommandation spécifique 1", "Recommandation spécifique 2"]
  }
}

RÈGLES STRICTES:
- head_to_head: utilise le TABLEAU SERP CROISÉ ci-dessus. Prends les mots-clés où les DEUX sites ont un classement numérique, max 8. Si un seul est classé, mets-le dans exclusive_strengths.
- differentiators: EXACTEMENT 4-6 dimensions, chaque valeur CHIFFRÉE
- Si un écart est < 15%, dis "marginal" et cherche ce qui les distingue VRAIMENT
- Recommandations: spécifiques à chaque site, jamais génériques
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
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
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

async function analyzeSite(
  url: string,
  domain: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  openrouterKey: string,
  opponentDomain?: string,
  langLabel: string = 'français',
): Promise<{ metadata: PageMetadata; analysis: any; llm_raw: any; keywords: any[]; backlinks: BacklinkProfile | null; pagespeed: PageSpeedScores | null }> {
  // Step 1: Metadata + LLM visibility + Backlinks + PageSpeed in parallel
  const [metadata, llmResult, backlinks, pagespeed] = await Promise.all([
    extractPageMetadata(url, domain),
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
    fetchBacklinkProfile(domain),
    fetchPageSpeedScores(url),
  ]);

  // Step 2: Seeds (needs metadata)
  const seeds = await generateSeedsWithAI(url, metadata.context, domain, opponentDomain);

  // Step 3: Keywords (needs seeds)
  const locCode = detectLocationCode(domain);
  const keywords = await fetchKeywordData(seeds, locCode, domain);

  // Step 4: Individual LLM analysis
  const prompt = buildSitePrompt(url, domain, metadata, keywords, llmResult, backlinks);
  let analysis: any = null;
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: SITE_ANALYSIS_PROMPT + `\n\nLANGUE DE RÉDACTION: ${langLabel}. Rédige TOUTES les analyses en ${langLabel}.` }, { role: 'user', content: prompt }],
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

  return { metadata, analysis, llm_raw: llmResult, keywords, backlinks, pagespeed };
}

// ==================== PHASE 3: CROSS-COMPARISON ====================

async function runCrossComparison(
  site1: { domain: string; analysis: any; backlinks: BacklinkProfile | null; contentDepth: ContentDepth; keywords: any[] },
  site2: { domain: string; analysis: any; backlinks: BacklinkProfile | null; contentDepth: ContentDepth; keywords: any[] },
  openrouterKey: string,
  langLabel: string = 'français',
): Promise<any> {
  const prompt = buildCrossComparePrompt(site1, site2);
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: CROSS_COMPARE_SYSTEM + `\n\nLANGUE DE RÉDACTION: ${langLabel}. Rédige TOUTES les analyses en ${langLabel}.` }, { role: 'user', content: prompt }],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(55000),
    });
    if (!resp.ok) { await resp.text(); return null; }
    const data = await resp.json();
    trackTokenUsage('audit-compare-cross', 'google/gemini-2.5-flash', data.usage, `${site1.domain} vs ${site2.domain}`);
    return parseAIResponse(data.choices?.[0]?.message?.content || null);
  } catch (e) {
    console.warn('Cross-comparison failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ==================== PHASE 2.5: CROSS-SERP CHECK ====================

/**
 * After both sites have their own keywords, we merge the keyword pools
 * and check SERP rankings for BOTH domains on the combined set.
 * This ensures the "SERP Battlefield" has data even when both sites
 * target the same niche (e.g. twin products).
 */
async function crossCheckSerpRankings(
  kw1: any[], kw2: any[],
  domain1: string, domain2: string,
  locationCode: number,
): Promise<{ site1Keywords: any[]; site2Keywords: any[] }> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    return { site1Keywords: kw1, site2Keywords: kw2 };
  }

  const cleanDomain1 = domain1.replace(/^www\./, '').toLowerCase();
  const cleanDomain2 = domain2.replace(/^www\./, '').toLowerCase();

  // Collect unique keywords from both sites that need cross-checking
  const kw1Map = new Map(kw1.map(k => [k.keyword.toLowerCase(), k]));
  const kw2Map = new Map(kw2.map(k => [k.keyword.toLowerCase(), k]));

  // Keywords from site1 that site2 doesn't have (need to check site2's rank)
  const needCheckForSite2: string[] = [];
  // Keywords from site2 that site1 doesn't have (need to check site1's rank)
  const needCheckForSite1: string[] = [];

  for (const [key, kw] of kw1Map) {
    if (!kw2Map.has(key)) {
      needCheckForSite2.push(kw.keyword);
    }
  }
  for (const [key, kw] of kw2Map) {
    if (!kw1Map.has(key)) {
      needCheckForSite1.push(kw.keyword);
    }
  }

  // For overlapping keywords, cross-assign ranks
  for (const [key] of kw1Map) {
    if (kw2Map.has(key)) {
      kw1Map.get(key)!.opponent_rank = kw2Map.get(key)!.current_rank;
      kw2Map.get(key)!.opponent_rank = kw1Map.get(key)!.current_rank;
    }
  }

  // Batch SERP check: site2's rankings on site1's keywords and vice versa
  const allToCheck = [
    ...needCheckForSite2.slice(0, 5).map(kw => ({ keyword: kw, checkDomain: cleanDomain2, assignTo: 'kw1' as const })),
    ...needCheckForSite1.slice(0, 5).map(kw => ({ keyword: kw, checkDomain: cleanDomain1, assignTo: 'kw2' as const })),
  ];

  if (allToCheck.length > 0) {
    try {
      const serpTasks = allToCheck.map(item => ({
        keyword: item.keyword,
        location_code: locationCode,
        language_code: 'fr',
        depth: 30,
        se_domain: 'google.fr',
      }));

      const serpResp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(serpTasks),
        signal: AbortSignal.timeout(15000),
      });

      if (serpResp.ok) {
        trackPaidApiCall('audit-compare', 'dataforseo', 'serp/organic-cross');
        const serpData = await serpResp.json();

        for (let i = 0; i < allToCheck.length; i++) {
          const item = allToCheck[i];
          const taskResult = serpData.tasks?.[i]?.result?.[0];
          let opponentRank: number | string = 'Non classé';
          let ownRank: number | string = 'Non classé';

          if (taskResult?.items) {
            for (const entry of taskResult.items) {
              if (entry.type === 'paid') continue;
              const entryDomain = (entry.domain || '').toLowerCase().replace(/^www\./, '');

              if (entryDomain === item.checkDomain || (entry.url || '').toLowerCase().includes(item.checkDomain)) {
                opponentRank = entry.rank_absolute || 1;
              }
              // Also check if the OTHER domain appears
              const otherDomain = item.assignTo === 'kw1' ? cleanDomain1 : cleanDomain2;
              if (entryDomain === otherDomain || (entry.url || '').toLowerCase().includes(otherDomain)) {
                ownRank = entry.rank_absolute || 1;
              }
            }
          }

          const kwKey = item.keyword.toLowerCase();
          if (item.assignTo === 'kw1' && kw1Map.has(kwKey)) {
            kw1Map.get(kwKey)!.opponent_rank = opponentRank;
            // Also add to kw2 if opponent is ranked
            if (typeof opponentRank === 'number' && !kw2Map.has(kwKey)) {
              kw2Map.set(kwKey, {
                keyword: item.keyword,
                volume: kw1Map.get(kwKey)!.volume || 0,
                difficulty: kw1Map.get(kwKey)!.difficulty || 0,
                current_rank: opponentRank,
                opponent_rank: kw1Map.get(kwKey)!.current_rank,
              });
            }
          } else if (item.assignTo === 'kw2' && kw2Map.has(kwKey)) {
            kw2Map.get(kwKey)!.opponent_rank = opponentRank;
            if (typeof opponentRank === 'number' && !kw1Map.has(kwKey)) {
              kw1Map.set(kwKey, {
                keyword: item.keyword,
                volume: kw2Map.get(kwKey)!.volume || 0,
                difficulty: kw2Map.get(kwKey)!.difficulty || 0,
                current_rank: opponentRank,
                opponent_rank: kw2Map.get(kwKey)!.current_rank,
              });
            }
          }
        }
      } else {
        await serpResp.text();
      }
    } catch (e) {
      console.warn('[cross-serp] SERP cross-check failed:', e instanceof Error ? e.message : e);
    }
  }

  console.log(`[cross-serp] Enriched: ${kw1Map.size} kw for ${domain1}, ${kw2Map.size} kw for ${domain2}`);

  return {
    site1Keywords: [...kw1Map.values()],
    site2Keywords: [...kw2Map.values()],
  };
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  
  try {
    const { url1, url2, skipCache, lang } = await req.json();
    const outputLang = lang || 'fr';
    const langLabel = outputLang === 'fr' ? 'français' : outputLang === 'es' ? 'espagnol' : 'anglais';
    
    if (!url1 || !url2) return json({ success: false, error: 'Two URLs are required' }, 400);
    
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) return json({ success: false, error: 'AI service not configured' }, 500);
    
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

    // Check cache (skip if requested)
    if (!skipCache) {
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
    } else {
      // Invalidate old cache
      await supabaseAdmin.from('audit_cache').delete().eq('cache_key', cacheKey);
      console.log(`🗑️ Cache invalidated for ${cacheKey}`);
    }

    // Check credits (4 required) — free for admins & subscribers
    const { data: profile } = await supabase.from('profiles').select('credits_balance, plan_type, subscription_status').eq('user_id', user.id).single();
    const isProAgency = profile?.plan_type === 'agency_pro' && profile?.subscription_status === 'active';
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    const isUnlimited = isAdmin || isProAgency;
    
    if (!isUnlimited) {
      if (!profile || profile.credits_balance < 4) {
        return json({ success: false, error: 'Insufficient credits (4 required)', balance: profile?.credits_balance || 0 }, 402);
      }
      const { data: creditResult } = await supabase.rpc('use_credit', { p_user_id: user.id, p_amount: 4, p_description: 'Audit comparé' });
      if (!creditResult?.success) {
        return json({ success: false, error: creditResult?.error || 'Credit deduction failed' }, 402);
      }
    }
    
    const domain1 = new URL(normalizedUrl1).hostname.replace(/^www\./, '');
    const domain2 = new URL(normalizedUrl2).hostname.replace(/^www\./, '');
    
    console.log(`🔄 Audit comparé v2: ${domain1} vs ${domain2}`);
    
    // ═══ Phase 1 & 2: Both site pipelines in PARALLEL ═══
    const [site1, site2] = await Promise.all([
      analyzeSite(url1, domain1, supabaseUrl, supabaseAnonKey, OPENROUTER_API_KEY, domain2, langLabel),
      analyzeSite(url2, domain2, supabaseUrl, supabaseAnonKey, OPENROUTER_API_KEY, domain1, langLabel),
    ]);
    
    // ═══ Phase 2.5: CROSS-SERP CHECK — enrich both keyword sets with opponent rankings ═══
    const enrichedKeywords = await crossCheckSerpRankings(
      site1.keywords, site2.keywords, domain1, domain2, detectLocationCode(domain1),
    );
    
    // ═══ Phase 3: CROSS-COMPARISON with both datasets ═══
    console.log(`🔀 Phase 3: Cross-comparison ${domain1} vs ${domain2}`);
    const crossComparison = await runCrossComparison(
      { domain: domain1, analysis: site1.analysis, backlinks: site1.backlinks, contentDepth: site1.metadata.contentDepth, keywords: enrichedKeywords.site1Keywords },
      { domain: domain2, analysis: site2.analysis, backlinks: site2.backlinks, contentDepth: site2.metadata.contentDepth, keywords: enrichedKeywords.site2Keywords },
      OPENROUTER_API_KEY, langLabel,
    );
    
    console.log(`✅ Audit comparé v2 terminé: site1=${site1.analysis ? 'OK' : 'FAIL'}, site2=${site2.analysis ? 'OK' : 'FAIL'}, cross=${crossComparison ? 'OK' : 'FAIL'}`);
    
    const fallbackAnalysis = { brand_dna: 'Analyse non disponible', strengths: [], weaknesses: [], aeo_score: 0, eeat_score: null, expertise_sentiment: { rating: 1, justification: 'Non évalué' } };
    
    const resultData = {
      site1: {
        url: url1,
        domain: domain1,
        metadata: { title: site1.metadata.title, h1: site1.metadata.h1, desc: site1.metadata.desc },
        analysis: site1.analysis || fallbackAnalysis,
        llm_raw: site1.llm_raw,
        keywords: site1.keywords,
        backlinks: site1.backlinks,
        contentDepth: site1.metadata.contentDepth,
        pagespeed: site1.pagespeed,
        brandColor: site1.metadata.brandColor,
      },
      site2: {
        url: url2,
        domain: domain2,
        metadata: { title: site2.metadata.title, h1: site2.metadata.h1, desc: site2.metadata.desc },
        analysis: site2.analysis || fallbackAnalysis,
        llm_raw: site2.llm_raw,
        keywords: site2.keywords,
        backlinks: site2.backlinks,
        contentDepth: site2.metadata.contentDepth,
        pagespeed: site2.pagespeed,
        brandColor: site2.metadata.brandColor,
      },
      crossComparison,
      scannedAt: new Date().toISOString(),
    };

    await saveToCache(supabaseAdmin, cacheKey, resultData);

    return json({ success: true, data: resultData });
  } catch (e) {
    console.error('audit-compare error:', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
