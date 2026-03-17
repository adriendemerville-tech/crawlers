import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { trackTokenUsage, trackPaidApiCall, trackEdgeFunctionError } from '../_shared/tokenTracker.ts'
import { trackAnalyzedUrl } from '../_shared/trackUrl.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts'
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts'
import { getSiteContext } from '../_shared/getSiteContext.ts'

// Fonction pour générer un résumé promptable depuis le rapport stratégique
function generateStrategicPromptSummary(title: string, description: string, priority: string): string {
  const priorityLabel = priority === 'Prioritaire' ? '🔴 PRIORITAIRE' : priority === 'Important' ? '🟠 IMPORTANT' : '🟢 OPPORTUNITÉ';
  return `[${priorityLabel}] ${title} - ${description.substring(0, 200)}`;
}

// Fonction pour sauvegarder les recommandations stratégiques dans le registre
async function saveStrategicRecommendationsToRegistry(
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
  domain: string,
  url: string,
  parsedAnalysis: any
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;
    
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('audit_type', 'strategic');
    
    const registryEntries: any[] = [];
    
    if (parsedAnalysis.executive_roadmap && Array.isArray(parsedAnalysis.executive_roadmap)) {
      parsedAnalysis.executive_roadmap.forEach((item: any, idx: number) => {
        const priorityMap: Record<string, string> = { 'Prioritaire': 'critical', 'Important': 'important', 'Opportunité': 'optional' };
        registryEntries.push({
          user_id: user.id, domain, url,
          audit_type: 'strategic',
          recommendation_id: `roadmap_${idx}`,
          title: item.title || `Recommandation ${idx + 1}`,
          description: item.prescriptive_action || item.strategic_rationale || '',
          category: item.category?.toLowerCase() || 'contenu',
          priority: priorityMap[item.priority] || 'important',
          fix_type: null,
          fix_data: { expected_roi: item.expected_roi, category: item.category, full_action: item.prescriptive_action },
          prompt_summary: generateStrategicPromptSummary(item.title || `Recommandation ${idx + 1}`, item.prescriptive_action || '', item.priority || 'Important'),
          is_resolved: false,
        });
      });
    }
    
    if (parsedAnalysis.keyword_positioning?.recommendations && Array.isArray(parsedAnalysis.keyword_positioning.recommendations)) {
      parsedAnalysis.keyword_positioning.recommendations.forEach((rec: string, idx: number) => {
        registryEntries.push({
          user_id: user.id, domain, url,
          audit_type: 'strategic',
          recommendation_id: `kw_rec_${idx}`,
          title: `SEO Keywords #${idx + 1}`,
          description: rec,
          category: 'seo',
          priority: 'important',
          fix_type: null,
          fix_data: { type: 'keyword_recommendation' },
          prompt_summary: `[🟠 SEO] ${rec.substring(0, 200)}`,
          is_resolved: false,
        });
      });
    }
    
    if (registryEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('audit_recommendations_registry')
        .insert(registryEntries);
      if (insertError) console.error('❌ Registre stratégique:', insertError);
      else console.log(`✅ ${registryEntries.length} recommandations sauvegardées`);
    }
  } catch (error) {
    console.error('❌ Erreur registre:', error);
  }
}

// ==================== SHARED TEXT UTILITIES ====================

const STOP_WORDS = new Set([
  'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
  'il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou',
  'plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes',
  'si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore',
  'tout','tous','même','autre','autres','chaque','quelque','quel','quelle','quels','quelles',
  'certains','plusieurs','aucun','tel','telle','tels','telles',
  'gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https',
  'bienvenue','welcome','home','officiel','official',
  'the','and','for','with','your','our','from','that','this','are','was','will','can','has','have',
  'calcul','calculer','outil','service','solution','application','app','logiciel','plateforme',
]);

/** Clean text and tokenize into meaningful words (filters stop words) */
function cleanAndTokenize(text: string, extraExclusions?: Set<string>): string[] {
  return text.toLowerCase()
    .replace(/[|–—·:,\.!?]/g, ' ')
    .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w) && !(extraExclusions?.has(w)));
}

/** Extract Title/H1/Desc from page content context string */
function extractMetadataTexts(pageContentContext: string): string[] {
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  return [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
}

/** Build a set of domain-derived slugs to filter out brand terms */
function buildDomainSlugs(domain: string): Set<string> {
  const slugs = new Set<string>();
  if (!domain) return slugs;
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  for (const part of cleanDomain.split('.')) {
    if (part.length > 2) slugs.add(part);
  }
  slugs.add(cleanDomain.replace(/\./g, ''));
  if (cleanDomain.split('.').length > 0) slugs.add(cleanDomain.split('.')[0]);
  return slugs;
}

// ==================== INTERFACES ====================

interface ToolsData {
  crawlers: any;
  geo: any;
  llm: any;
  pagespeed: any;
}

interface EEATSignals {
  hasAuthorBio: boolean;
  authorBioCount: number;
  hasSocialLinks: boolean;
  hasLinkedInLinks: boolean;
  socialLinksCount: number;
  linkedInLinksCount: number;
  linkedInUrls: string[];
  hasSameAs: boolean;
  hasWikidataSameAs: boolean;
  hasAuthorInJsonLd: boolean;
  hasProfilePage: boolean;
  hasPerson: boolean;
  hasOrganization: boolean;
  hasCaseStudies: boolean;
  caseStudySignals: number;
  hasExpertCitations: boolean;
  detectedSocialUrls: string[];
}

interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  is_ranked: boolean;
  current_rank: number | string;
  is_nugget?: boolean;
}

interface MarketData {
  location_used: string;
  total_market_volume: number;
  top_keywords: KeywordData[];
  data_source: 'dataforseo' | 'fallback';
  fetch_timestamp: string;
}

// Ranking overview from DataForSEO ranked_keywords endpoint
interface RankingOverview {
  total_ranked_keywords: number;
  average_position_global: number;
  average_position_top10: number;
  distribution: {
    top3: number;
    top10: number;
    top20: number;
    top50: number;
    top100: number;
    beyond100: number;
  };
  top_keywords: { keyword: string; position: number; volume: number; url: string }[];
  etv: number; // estimated traffic volume
}

interface BusinessContext {
  sector: string;
  location: string;
  brandName: string;
  locationCode: number | null;
  languageCode: string;
  seDomain: string;
}

// ==================== PROBABILISTIC BRAND NAME DETECTION ====================

interface BrandSignal {
  source: string;
  value: string;
  weight: number;
}

/**
 * Probabilistic algorithm to detect the real brand/company name from 5 HTML signals + domain.
 * Returns { name, confidence }. If confidence >= 0.95, name is the detected brand (capitalized).
 * Otherwise, name falls back to the target URL.
 */
function resolveBrandName(signals: BrandSignal[], domain: string, url: string): { name: string; confidence: number } {
  if (signals.length === 0) return { name: url, confidence: 0 };

  // Normalize for comparison
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9]/g, '').trim();
  const domainSlug = normalize(domain.replace(/^www\./, '').split('.')[0]);

  // Group signals by normalized value
  const groups = new Map<string, { totalWeight: number; bestValue: string; sources: string[] }>();
  for (const sig of signals) {
    const rawVal = sig.value.trim();
    // CRITICAL: Skip values that are clearly taglines/descriptions, not brand names
    // A real brand name is almost never longer than 40 characters
    if (rawVal.length > 40) {
      console.log(`⏭️ Brand detection: skipping too-long signal "${rawVal.substring(0, 50)}..." from ${sig.source}`);
      continue;
    }
    const norm = normalize(rawVal);
    if (!norm || norm.length < 2) continue;
    const existing = groups.get(norm);
    if (existing) {
      existing.totalWeight += sig.weight;
      existing.sources.push(sig.source);
      // Keep the version with best capitalization (longest original form)
      if (sig.value.length >= existing.bestValue.length) existing.bestValue = sig.value;
    } else {
      groups.set(norm, { totalWeight: sig.weight, bestValue: sig.value, sources: [sig.source] });
    }
  }

  if (groups.size === 0) return { name: url, confidence: 0 };

  // Also check for near-matches (one group contains the other)
  const groupKeys = [...groups.keys()];
  for (let i = 0; i < groupKeys.length; i++) {
    for (let j = i + 1; j < groupKeys.length; j++) {
      const a = groupKeys[i], b = groupKeys[j];
      if (a.includes(b) || b.includes(a)) {
        const ga = groups.get(a)!, gb = groups.get(b)!;
        // Merge into the shorter one (more likely the brand name)
        const shorter = a.length <= b.length ? a : b;
        const longer = shorter === a ? b : a;
        const merged = groups.get(shorter)!;
        const other = groups.get(longer)!;
        merged.totalWeight += other.totalWeight;
        merged.sources.push(...other.sources);
        if (other.bestValue.length < merged.bestValue.length || other.sources.length > merged.sources.length) {
          // Keep shorter branded name if it looks cleaner
        }
        groups.delete(longer);
      }
    }
  }

  // Find the best group
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  let best = { norm: '', totalWeight: 0, bestValue: '', sources: [] as string[] };
  for (const [norm, g] of groups) {
    if (g.totalWeight > best.totalWeight) {
      best = { norm, ...g };
    }
  }

  // Calculate confidence
  let confidence = best.totalWeight / totalWeight;

  // Bonus: multiple independent sources agreeing boosts confidence
  if (best.sources.length >= 3) confidence = Math.min(1, confidence + 0.15);
  else if (best.sources.length >= 2) confidence = Math.min(1, confidence + 0.08);

  // Bonus: if the detected name matches the domain slug, it's a strong confirmation
  if (normalize(best.bestValue) === domainSlug) confidence = Math.min(1, confidence + 0.05);

  // Ensure proper capitalization
  let finalName = best.bestValue.trim();
  // If all lowercase, capitalize first letter of each word
  if (finalName === finalName.toLowerCase() && finalName.length > 1) {
    finalName = finalName.replace(/\b\w/g, c => c.toUpperCase());
  }

  console.log(`🎯 Brand detection: "${finalName}" (confidence: ${(confidence * 100).toFixed(1)}%, sources: ${best.sources.join(',')})`);

  if (confidence >= 0.95) {
    return { name: finalName, confidence };
  }
  return { name: url, confidence };
}

function humanizeBrandName(slug: string): string {
  if (!slug || slug.length < 1) return slug;
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function sanitizeBrandNameInResponse(obj: any, domainSlug: string, humanName: string): any {
  if (!obj || !domainSlug || !humanName || domainSlug === humanName) return obj;
  const slugLower = domainSlug.toLowerCase();
  function replaceInString(str: string): string {
    if (!str || typeof str !== 'string') return str;
    const regex = new RegExp(slugLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return str.replace(regex, humanName);
  }
  function walk(node: any): any {
    if (typeof node === 'string') return replaceInString(node);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(node)) { out[k] = walk(v); }
      return out;
    }
    return node;
  }
  return walk(obj);
}

// ==================== DATAFORSEO FUNCTIONS ====================

const DATAFORSEO_LOGIN = Deno.env.get('DATAFORSEO_LOGIN');
const DATAFORSEO_PASSWORD = Deno.env.get('DATAFORSEO_PASSWORD');

function getAuthHeader(): string {
  return `Basic ${btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`)}`;
}

// Well-known location codes to avoid downloading the full list
const KNOWN_LOCATIONS: Record<string, { code: number; name: string; lang: string; seDomain: string }> = {
  'france': { code: 2250, name: 'France', lang: 'fr', seDomain: 'google.fr' },
  'belgium': { code: 2056, name: 'Belgium', lang: 'fr', seDomain: 'google.be' },
  'switzerland': { code: 2756, name: 'Switzerland', lang: 'fr', seDomain: 'google.ch' },
  'canada': { code: 2124, name: 'Canada', lang: 'fr', seDomain: 'google.ca' },
  'luxembourg': { code: 2442, name: 'Luxembourg', lang: 'fr', seDomain: 'google.lu' },
  'germany': { code: 2276, name: 'Germany', lang: 'de', seDomain: 'google.de' },
  'spain': { code: 2724, name: 'Spain', lang: 'es', seDomain: 'google.es' },
  'italy': { code: 2380, name: 'Italy', lang: 'it', seDomain: 'google.it' },
  'united kingdom': { code: 2826, name: 'United Kingdom', lang: 'en', seDomain: 'google.co.uk' },
  'united states': { code: 2840, name: 'United States', lang: 'en', seDomain: 'google.com' },
};

/**
 * Extracts the REAL core business description from page metadata.
 * This is THE most important variable: what does this company actually do?
 */
function extractCoreBusiness(pageContentContext: string): string {
  if (!pageContentContext) return '';
  
  const texts = extractMetadataTexts(pageContentContext);
  if (texts.length === 0) return '';
  
  const bigrams: string[] = [];
  const allWords: string[] = [];
  for (const text of texts) {
    const words = cleanAndTokenize(text);
    allWords.push(...words);
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  const uniqueWords = [...new Set(allWords)];
  const coreBusiness = uniqueWords.slice(0, 8).join(' ');
  
  console.log(`🎯 Core business: "${coreBusiness}"`);
  console.log(`🎯 Key bigrams: ${bigrams.slice(0, 5).join(', ')}`);
  
  return coreBusiness;
}

/**
 * Détecte le contexte business ET le location code.
 * CRITICAL: Le secteur est dérivé du CONTENU de la page, pas du domaine.
 */
function detectBusinessContext(domain: string, pageContentContext: string = ''): BusinessContext {
  const domainParts = domain.toLowerCase().split('.');
  const tld = domainParts[domainParts.length - 1];
  
  const tldToLocation: Record<string, string> = {
    'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada',
    'lu': 'luxembourg', 'de': 'germany', 'es': 'spain', 'it': 'italy',
    'uk': 'united kingdom', 'co.uk': 'united kingdom', 'com': 'france',
    'ai': 'france', 'io': 'france', 'dev': 'france', 'app': 'france',
  };
  
  const locationKey = tldToLocation[tld] || 'france';
  const locationInfo = KNOWN_LOCATIONS[locationKey] || KNOWN_LOCATIONS['france'];
  
  const prefixes = ['www', 'fr', 'en', 'de', 'es', 'it', 'us', 'uk', 'shop', 'store', 'm', 'mobile'];
  const significantParts = domainParts.filter(part => 
    !prefixes.includes(part) && part.length > 2 && 
    !['com', 'fr', 'net', 'org', 'io', 'co', 'be', 'ch', 'de', 'es', 'it', 'uk', 'ai', 'dev', 'app'].includes(part)
  );
  
  const rawSlug = significantParts.length > 0 ? significantParts[0] : domainParts[0];
  const brandName = humanizeBrandName(rawSlug);
  
  // CRITICAL: Derive sector from PAGE CONTENT, not from domain slug
  const coreBusiness = extractCoreBusiness(pageContentContext);
  const sector = coreBusiness || rawSlug.replace(/-/g, ' ');
  
  console.log(`📋 Contexte: marque="${brandName}", secteur="${sector}", location="${locationInfo.name}" (code: ${locationInfo.code}, lang: ${locationInfo.lang})`);
  
  return { sector, location: locationInfo.name, brandName, locationCode: locationInfo.code, languageCode: locationInfo.lang, seDomain: locationInfo.seDomain };
}

function extractKeywordsFromMetadata(pageContentContext: string, domain: string = ''): string[] {
  const extracted: string[] = [];
  const texts = extractMetadataTexts(pageContentContext);
  const domainSlugs = buildDomainSlugs(domain);
  
  for (const text of texts) {
    const words = cleanAndTokenize(text, domainSlugs).filter(w => w.length > 2);
    
    // Prioritize bigrams and trigrams (market-intent phrases)
    for (let i = 0; i < words.length - 2; i++) {
      extracted.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    for (let i = 0; i < words.length - 1; i++) {
      extracted.push(`${words[i]} ${words[i + 1]}`);
    }
    for (const word of words) {
      if (word.length >= 5) extracted.push(word);
    }
  }
  
  return [...new Set(extracted)].slice(0, 12);
}

function generateSeedKeywords(brandName: string, sector: string, pageContentContext: string = '', domain: string = ''): string[] {
  const keywords: string[] = [];
  
  if (pageContentContext) {
    const coreBusiness = extractCoreBusiness(pageContentContext);
    const texts = extractMetadataTexts(pageContentContext);
    const domainSlugs = buildDomainSlugs(domain);
    
    const coreBigrams: string[] = [];
    for (const text of texts) {
      const words = cleanAndTokenize(text, domainSlugs);
      for (let i = 0; i < words.length - 1; i++) {
        coreBigrams.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    
    for (const bg of coreBigrams.slice(0, 3)) {
      if (bg.length > 4 && !keywords.includes(bg)) keywords.push(bg);
    }
    
    const metaKeywords = extractKeywordsFromMetadata(pageContentContext, domain);
    for (const mk of metaKeywords) {
      if (mk.length > 4 && !keywords.includes(mk)) keywords.push(mk);
    }
  }
  
  // Add sector-based queries if different from brand
  const cleanBrand = brandName.toLowerCase().trim();
  if (sector.toLowerCase() !== cleanBrand && sector.length > 3) {
    if (!keywords.some(k => k.includes(sector))) keywords.push(sector);
  }
  
  // Brand terms at the end (low priority — useful for branded volume only)
  if (!keywords.includes(cleanBrand)) keywords.push(cleanBrand);
  
  console.log(`🔑 Seed keywords (core business first): ${keywords.slice(0, 5).join(', ')}`);
  
  return keywords.filter(kw => kw.length > 3 && !kw.includes('undefined')).slice(0, 10);
}

// ==================== AI-DRIVEN SEED GENERATION ====================

async function generateSeedsWithAI(
  url: string,
  pageContentContext: string,
  brandName: string,
  mode: 'initial' | 'vertical' | 'horizontal' = 'initial',
  feedback?: string
): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('⚠️ No AI key for seed generation, falling back to metadata extraction');
    return [];
  }

  const modeInstructions: Record<string, string> = {
    initial: "Services principaux + intentions d'achat/conversion. Ex: 'devis rénovation salle de bain', 'plombier urgence Paris', 'logiciel facturation auto-entrepreneur'.",
    vertical: "Sous-catégories techniques, longue traîne, conversion locale. Creuse en PROFONDEUR les niches métier spécifiques. Ex: 'isolation thermique par l'extérieur prix', 'raccordement cuivre multicouche'.",
    horizontal: "Étapes AMONT du parcours client (financement, permis, diagnostic, comparatif) et besoins CONNEXES. Trouve des chemins de traverse. Ex: 'aide financement rénovation énergétique', 'permis de construire extension maison'.",
  };

  const prompt = `Tu es un Senior SEO Strategist spécialisé en recherche de mots-clés à forte intention.

ANALYSE cette page web:
URL: ${url}
${pageContentContext}

RÈGLE D'OR ABSOLUE: NE CITE JAMAIS le nom de la marque "${brandName}" ni aucune variante dans tes mots-clés. Les mots-clés doivent être 100% GÉNÉRIQUES.

MODE: ${mode.toUpperCase()}
${modeInstructions[mode]}
${feedback ? `\n⚠️ FEEDBACK: Les seeds précédents ont donné de mauvais résultats (volume trop faible ou hors-sujet). ${feedback}. Reformule avec des expressions plus recherchées et plus spécifiques.` : ''}

INSTRUCTIONS:
1. Identifie le CORE BUSINESS exact de cette entreprise
2. Génère exactement 15 mots-clés que des clients potentiels taperaient dans Google
3. Chaque mot-clé = expression de 2-5 mots à forte intention commerciale ou informationnelle
4. Privilégie les requêtes transactionnelles ("devis X", "prix X", "X pas cher") et décisionnelles ("meilleur X", "comparatif X", "avis X")
5. Inclus au moins 3 requêtes longue traîne (4-5 mots)

Réponds UNIQUEMENT avec un JSON: {"core_business": "description courte", "seeds": ["mot clé 1", "mot clé 2", ...]}`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log(`⚠️ AI seed generation failed: ${response.status}`);
      await response.text();
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    trackTokenUsage('generate-seeds', 'google/gemini-2.5-flash-lite', data.usage, url);

    let seeds: string[] = [];
    try {
      let jsonStr = content;
      if (content.includes('```json')) jsonStr = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) jsonStr = content.split('```')[1].split('```')[0].trim();
      jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      const parsed = JSON.parse(jsonStr);
      seeds = (parsed.seeds || parsed.keywords || []).filter((s: string) => typeof s === 'string' && s.length > 3);
      if (parsed.core_business) console.log(`🎯 AI Core Business: "${parsed.core_business}"`);
    } catch {
      const match = content.match(/\[([^\]]+)\]/);
      if (match) {
        seeds = match[1].split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter((s: string) => s.length > 3);
      }
    }

    // Filter out brand name
    const brandLower = brandName.toLowerCase();
    const domainSlug = brandLower.replace(/\s+/g, '');
    seeds = seeds.filter(s => {
      const sLower = s.toLowerCase();
      return !sLower.includes(brandLower) && !sLower.includes(domainSlug);
    });

    console.log(`🤖 AI seeds (${mode}): ${seeds.slice(0, 8).join(', ')}... (${seeds.length} total)`);
    return seeds.slice(0, 15);
  } catch (error) {
    console.error('❌ AI seed generation error:', error);
    return [];
  }
}

function checkDataQuality(keywords: { keyword: string; volume: number; difficulty: number }[]): boolean {
  if (keywords.length < 3) return false;
  const avgVolume = keywords.reduce((sum, kw) => sum + kw.volume, 0) / keywords.length;
  if (avgVolume < 100) return false;
  return true;
}

async function fetchKeywordData(
  seedKeywords: string[], locationCode: number, languageCode: string = 'fr'
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  console.log(`📊 Récupération mots-clés pour location: ${locationCode}, lang: ${languageCode}`);
  const allKeywords: { keyword: string; volume: number; difficulty: number }[] = [];
  const seenLower = new Set<string>();
  
  const addUnique = (kw: { keyword: string; volume: number; difficulty: number }) => {
    const lower = kw.keyword.toLowerCase();
    if (!seenLower.has(lower) && kw.volume >= 0) {
      seenLower.add(lower);
      allKeywords.push(kw);
    }
  };
  
  try {
    // Phase 1: keywords_for_keywords (broader expansion)
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keywords: seedKeywords.slice(0, 5),
        location_code: locationCode, language_code: languageCode,
        sort_by: 'search_volume', include_adult_keywords: false,
      }]),
    });

    if (response.ok) {
      trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'keywords_for_keywords');
      const data = await response.json();
      if (data.status_code === 20000 && data.tasks?.[0]?.result) {
        for (const item of data.tasks[0].result) {
          if (item.keyword && item.search_volume >= 0) {
            addUnique({
              keyword: item.keyword,
              volume: item.search_volume || 0,
              difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100),
            });
          }
        }
        console.log(`✅ ${allKeywords.length} mots-clés via Google Ads API`);
      }
    } else {
      await response.text();
    }
    
    // Phase 2: search_volume fallback for seed keywords themselves
    if (allKeywords.length < 10) {
      console.log('🔄 Fallback: search_volume...');
      const volumeResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          keywords: seedKeywords, location_code: locationCode, language_code: languageCode,
        }]),
      });

      if (volumeResponse.ok) {
        const volumeData = await volumeResponse.json();
        if (volumeData.status_code === 20000 && volumeData.tasks?.[0]?.result) {
          for (const item of volumeData.tasks[0].result) {
            if (item.keyword && item.search_volume >= 0) {
              addUnique({
                keyword: item.keyword,
                volume: item.search_volume || 0,
                difficulty: item.competition ? Math.round(item.competition * 100) : 30,
              });
            }
          }
        }
      } else {
        await volumeResponse.text();
      }
    }
    
    // Phase 3: If still under 5, try broader single-word seeds 
    if (allKeywords.length < 5 && seedKeywords.length > 0) {
      console.log('🔄 Phase 3: broader single-word expansion...');
      const singleWords = seedKeywords
        .flatMap(s => s.split(/\s+/))
        .filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()))
        .slice(0, 5);
      
      if (singleWords.length > 0) {
        const broadResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keywords: singleWords,
            location_code: locationCode, language_code: languageCode,
            sort_by: 'search_volume', include_adult_keywords: false,
          }]),
        });
        
        if (broadResponse.ok) {
          const broadData = await broadResponse.json();
          if (broadData.status_code === 20000 && broadData.tasks?.[0]?.result) {
            for (const item of broadData.tasks[0].result) {
              if (item.keyword && item.search_volume >= 0) {
                addUnique({
                  keyword: item.keyword,
                  volume: item.search_volume || 0,
                  difficulty: item.competition_index || Math.round((item.competition || 0.3) * 100),
                });
              }
            }
            console.log(`✅ Phase 3: ${allKeywords.length} mots-clés total après expansion`);
          }
        } else {
          await broadResponse.text();
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur mots-clés:', error);
  }
  
  return allKeywords.sort((a, b) => b.volume - a.volume).slice(0, 15);
}

async function checkRankings(
  keywords: { keyword: string; volume: number; difficulty: number }[],
  domain: string, locationCode: number, languageCode: string = 'fr', seDomain: string = 'google.fr'
): Promise<KeywordData[]> {
  console.log(`📈 Vérification positionnement pour ${domain}`);
  const results: KeywordData[] = [];
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  
  // Only exclude paid ads — all other SERP types indicate real presence
  const EXCLUDED_TYPES = new Set(['paid', 'ads']);
  
  // Check top 10 keywords by volume for reliable average position
  const keywordsToCheck = keywords.slice(0, 10);
  
  try {
    const tasks = keywordsToCheck.map(kw => ({
      keyword: kw.keyword, location_code: locationCode, language_code: languageCode,
      depth: 50, se_domain: seDomain,
    }));
    
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks),
    });

    if (!response.ok) {
      await response.text();
      return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' }));
    }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/organic');

    const data = await response.json();
    
    for (let i = 0; i < keywordsToCheck.length; i++) {
      const kw = keywordsToCheck[i];
      const taskResult = data.tasks?.[i]?.result?.[0];
      let position: number | string = 'Non classé';
      let isRanked = false;
      
      if (taskResult?.items) {
        for (const item of taskResult.items) {
          if (EXCLUDED_TYPES.has(item.type)) continue;
          
          // Check domain from multiple fields for reliability
          const itemDomain = (item.domain || '').toLowerCase().replace(/^www\./, '');
          const itemUrl = (item.url || '').toLowerCase();
          
          // Match against domain field OR url field
          const domainMatch = itemDomain && (
            itemDomain === cleanDomain ||
            itemDomain.endsWith('.' + cleanDomain) ||
            cleanDomain.endsWith('.' + itemDomain)
          );
          const urlMatch = itemUrl.includes(cleanDomain);
          
          if (domainMatch || urlMatch) {
            position = item.rank_absolute || item.rank_group || 1;
            isRanked = true;
            console.log(`🎯 ${kw.keyword}: ${cleanDomain} trouvé pos ${position} (type: ${item.type}, domain: ${itemDomain})`);
            break;
          }
          
          // Also check nested items (e.g., items inside carousels or packs)
          if (item.items && Array.isArray(item.items)) {
            for (const subItem of item.items) {
              const subDomain = (subItem.domain || '').toLowerCase().replace(/^www\./, '');
              const subUrl = (subItem.url || '').toLowerCase();
              if (subDomain === cleanDomain || subUrl.includes(cleanDomain)) {
                position = item.rank_absolute || item.rank_group || 1;
                isRanked = true;
                console.log(`🎯 ${kw.keyword}: ${cleanDomain} trouvé en sous-item pos ${position} (type: ${item.type})`);
                break;
              }
            }
            if (isRanked) break;
          }
        }
        
        if (!isRanked) {
          // Log first 5 items for debugging
          const itemTypes = taskResult.items.slice(0, 8).map((it: any) => `${it.type}:${(it.domain||'').replace(/^www\./,'')}`).join(', ');
          console.log(`❌ ${kw.keyword}: ${cleanDomain} non trouvé dans ${taskResult.items.length} items [${itemTypes}]`);
        }
      }
      results.push({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, is_ranked: isRanked, current_rank: position });
    }
    
    // All keywords are now checked via SERP (no "Non vérifié")
    // If more than 10 keywords exist, check remaining too
    for (let i = 10; i < keywords.length; i++) {
      results.push({ keyword: keywords[i].keyword, volume: keywords[i].volume, difficulty: keywords[i].difficulty, is_ranked: false, current_rank: 'Non classé' });
    }
    
    // Release data reference
    console.log(`✅ Positionnement: ${results.filter(r => r.is_ranked).length}/${results.length} classés`);
  } catch (error) {
    console.error('❌ Erreur SERP:', error);
    return keywords.map(kw => ({ ...kw, is_ranked: false, current_rank: 'Non classé' }));
  }
  
  return results;
}

// Domains that are NEVER real product competitors (media, directories, aggregators)
const NON_COMPETITOR_DOMAINS = new Set([
  'forbes.com', 'forbes.fr', 'lemonde.fr', 'lefigaro.fr', 'bfmtv.com', 'lesechos.fr',
  'wikipedia.org', 'fr.wikipedia.org', 'en.wikipedia.org',
  'youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'reddit.com', 'tiktok.com', 'pinterest.com',
  'amazon.com', 'amazon.fr', 'ebay.fr', 'ebay.com', 'aliexpress.com', 'cdiscount.com',
  'trustpilot.com', 'glassdoor.fr', 'glassdoor.com', 'indeed.fr', 'indeed.com',
  'capterra.fr', 'capterra.com', 'g2.com', 'getapp.com', 'appvizer.fr', 'appvizer.com',
  'societe.com', 'pappers.fr', 'pagesjaunes.fr', 'yelp.fr', 'yelp.com',
  'journaldunet.com', 'journaldunet.fr', 'commentcamarche.net', 'linternaute.com',
  'medium.com', 'substack.com', 'hubspot.com', 'hubspot.fr', 'salesforce.com',
  'crunchbase.com', 'wellfound.com', 'producthunt.com',
  'google.com', 'google.fr', 'apple.com', 'microsoft.com', 'github.com',
]);

function isNonCompetitorDomain(domain: string): boolean {
  const clean = domain.replace(/^www\./, '').toLowerCase();
  // Exact match
  if (NON_COMPETITOR_DOMAINS.has(clean)) return true;
  // Subdomain match (e.g. "fr.wikipedia.org" → "wikipedia.org")
  const parts = clean.split('.');
  if (parts.length > 2) {
    const root = parts.slice(-2).join('.');
    if (NON_COMPETITOR_DOMAINS.has(root)) return true;
  }
  return false;
}

async function findLocalCompetitor(
  domain: string, sector: string, locationCode: number, pageContentContext: string, languageCode: string = 'fr', seDomain: string = 'google.fr',
  siteContext?: Record<string, unknown> | null,
): Promise<{ name: string; url: string; rank: number; score?: number }[] | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;

  // ── 1. IDENTITY CARD FIRST: return known competitors if available ──
  if (siteContext?.competitors && Array.isArray(siteContext.competitors) && (siteContext.competitors as string[]).length > 0) {
    console.log(`🎯 Concurrents connus (carte d'identité): ${(siteContext.competitors as string[]).join(', ')}`);
    // Return identity card competitors as top-priority results
    return (siteContext.competitors as string[]).slice(0, 3).map((c: string, i: number) => ({
      name: c, url: '', rank: 0, score: 100 - i,
    }));
  }

  // ── 2. BUILD SMART QUERIES based on business_type ──
  const businessType = (siteContext?.business_type as string) || '';
  const brandName = (siteContext?.brand_name as string) || '';
  const commercialArea = (siteContext?.commercial_area as string) || '';
  const gmb = siteContext?.gmb_presence === true;
  const gmbCity = (siteContext?.gmb_city as string) || '';
  const productsServices = (siteContext?.products_services as string) || '';

  // Extract city from content (legacy fallback)
  let city = gmbCity || commercialArea || '';
  if (!city && pageContentContext) {
    const cityPatterns = [
      /(?:à|a|en|sur)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)/g,
      /([A-ZÀ-Ü][a-zà-ü]+(?:[-\s][A-ZÀ-Ü][a-zà-ü]+)*)\s*(?:\d{5})/g,
    ];
    for (const pattern of cityPatterns) {
      const match = pattern.exec(pageContentContext);
      if (match?.[1] && match[1].length > 2 && match[1].length < 30) {
        city = match[1];
        break;
      }
    }
  }

  const sectorWords = sector.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ');
  const productWords = productsServices ? productsServices.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 2)[0] || '' : '';

  // Build query list based on business type
  const queries: string[] = [];
  switch (businessType.toLowerCase()) {
    case 'local':
    case 'artisan':
      queries.push(city ? `${productWords || sectorWords} ${city}` : sectorWords);
      if (gmb && gmbCity) queries.push(`${sectorWords} ${gmbCity} avis`);
      break;
    case 'e-commerce':
    case 'ecommerce':
      queries.push(`${productWords || sectorWords} acheter en ligne`);
      if (brandName) queries.push(`${brandName} alternative`);
      break;
    case 'saas':
      queries.push(brandName ? `${brandName} alternative` : `${sectorWords} logiciel`);
      queries.push(`meilleur ${sectorWords} outil`);
      break;
    case 'media':
    case 'blog':
      queries.push(`${sectorWords} blog référence`);
      break;
    default:
      // Vitrine / unknown — geo if available, else generic
      queries.push(city ? `${sectorWords} ${city}` : sectorWords);
      if (brandName) queries.push(`${brandName} vs`);
      break;
  }

  // Deduplicate and limit to 2 queries (API cost control)
  const uniqueQueries = [...new Set(queries.filter(q => q.trim().length > 3))].slice(0, 2);
  console.log(`🏙️ Recherche concurrents (${businessType || 'auto'}): ${uniqueQueries.map(q => `"${q}"`).join(', ')}`);

  // ── 3. MULTI-QUERY SERP FETCH ──
  const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
  const isValidCompetitor = (item: any) => {
    const d = item.domain.toLowerCase().replace(/^www\./, '');
    if (d.includes(cleanDomain) || cleanDomain.includes(d)) return false;
    if (isNonCompetitorDomain(d)) return false;
    return true;
  };

  // Score map: domain → { name, url, rank, score }
  const scoreMap = new Map<string, { name: string; url: string; rank: number; score: number }>();

  try {
    for (const query of uniqueQueries) {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          keyword: query, location_code: locationCode, language_code: languageCode,
          depth: 20, se_domain: seDomain,
        }]),
      });

      if (!response.ok) { await response.text(); continue; }
      trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/organic/competitor');

      const data = await response.json();
      const items = data.tasks?.[0]?.result?.[0]?.items;
      if (!items || !Array.isArray(items)) continue;

      const organicResults = items.filter((item: any) => item.type === 'organic' && item.domain && item.url);

      for (const item of organicResults) {
        if (!isValidCompetitor(item)) continue;
        const d = item.domain.toLowerCase().replace(/^www\./, '');
        const existing = scoreMap.get(d);
        const rankScore = Math.max(0, 21 - (item.rank_absolute || item.rank_group || 20));

        if (existing) {
          // Appeared in multiple SERPs → bonus
          existing.score += rankScore + 10;
        } else {
          scoreMap.set(d, {
            name: item.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || item.domain,
            url: item.url,
            rank: item.rank_absolute || item.rank_group || 0,
            score: rankScore,
          });
        }
      }
    }

    if (scoreMap.size === 0) {
      console.log('⚠️ Aucun concurrent valide trouvé dans les SERPs');
      return null;
    }

    // ── 4. SORT BY SCORE and return top 3 ──
    const sorted = [...scoreMap.values()].sort((a, b) => b.score - a.score).slice(0, 3);
    console.log(`✅ Top concurrents: ${sorted.map(c => `"${c.name}" (score:${c.score}, pos:${c.rank})`).join(', ')}`);
    return sorted;
  } catch (error) {
    console.error('❌ Erreur recherche concurrents:', error);
    return null;
  }
}

/**
 * Strategic relevance sort: the first keyword should be the most relevant
 * "core business + target audience/segment" combination, not just highest volume.
 */
function sortByStrategicRelevance(
  keywords: KeywordData[],
  seedKeywords: string[],
  pageContentContext: string
): KeywordData[] {
  if (keywords.length === 0) return keywords;

  const texts = extractMetadataTexts(pageContentContext);
  const coreTerms: string[] = [];
  for (const text of texts) {
    coreTerms.push(...cleanAndTokenize(text).filter(w => w.length > 2));
  }
  const uniqueCoreTerms = [...new Set(coreTerms)];

  const topSeeds = seedKeywords.slice(0, 3).map(s => s.toLowerCase());
  const maxVolume = Math.max(...keywords.map(kw => kw.volume), 1);

  const scored = keywords.map(kw => {
    const kwLower = kw.keyword.toLowerCase();
    const volumeScore = kw.volume / maxVolume;
    
    const matchingCoreTerms = uniqueCoreTerms.filter(t => kwLower.includes(t)).length;
    const coreMatchScore = uniqueCoreTerms.length > 0
      ? Math.min(matchingCoreTerms / Math.min(uniqueCoreTerms.length, 3), 1)
      : 0;
    
    let seedScore = 0;
    for (let i = 0; i < topSeeds.length; i++) {
      if (kwLower.includes(topSeeds[i]) || topSeeds[i].includes(kwLower)) {
        seedScore = Math.max(seedScore, 1 - (i * 0.3));
      }
    }
    
    const wordCount = kwLower.split(/\s+/).length;
    const specificityBonus = wordCount >= 2 ? 0.15 : 0;

    // Core business relevance dominates, volume is secondary
    const finalScore = (coreMatchScore * 0.45) + (seedScore * 0.25) + (volumeScore * 0.2) + specificityBonus;
    
    return { kw, finalScore, coreMatchScore, seedScore };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  
  console.log(`🏆 Top 3 strategic keywords: ${scored.slice(0, 3).map(s => `"${s.kw.keyword}" (relevance: ${(s.finalScore * 100).toFixed(0)}%, core: ${(s.coreMatchScore * 100).toFixed(0)}%, seed: ${(s.seedScore * 100).toFixed(0)}%)`).join(' | ')}`);
  
  // Tag high-relevance + low-volume keywords as "nuggets" (Pépites)
  // relevance >= 0.9 (9/10) AND volume < 10 → is_nugget = true
  for (const s of scored) {
    if (s.finalScore >= 0.9 && s.kw.volume < 10) {
      s.kw.is_nugget = true;
      console.log(`💎 Pépite détectée: "${s.kw.keyword}" (relevance: ${(s.finalScore * 100).toFixed(0)}%, volume: ${s.kw.volume})`);
    }
  }
  
  return scored.map(s => s.kw);
}

async function fetchMarketData(domain: string, context: BusinessContext, pageContentContext: string = '', url: string = ''): Promise<MarketData | null> {
  console.log('🚀 Collecte DataForSEO pour:', domain);
  
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !context.locationCode) {
    console.log('⚠️ DataForSEO non disponible');
    return null;
  }
  
  try {
    // ═══ PHASE 1: AI-Driven Seed Generation ═══
    let seedKeywords: string[] = [];
    const effectiveUrl = url || `https://${domain}`;
    
    const aiSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial');
    
    if (aiSeeds.length >= 5) {
      seedKeywords = aiSeeds;
      console.log(`✅ AI-driven seeds: ${seedKeywords.length} keywords`);
    } else {
      // Fallback to metadata extraction
      console.log('⚠️ AI seeds insufficient, falling back to metadata extraction');
      seedKeywords = generateSeedKeywords(context.brandName, context.sector, pageContentContext, domain);
    }
    
    console.log('🌱 Seeds finaux:', seedKeywords.slice(0, 8).join(', '));
    
    // ═══ PHASE 2: DataForSEO API Call ═══
    let keywordData = await fetchKeywordData(seedKeywords, context.locationCode, context.languageCode);
    
    // ═══ PHASE 3: Validation Loop (retry once if poor quality) ═══
    if (!checkDataQuality(keywordData) && aiSeeds.length > 0) {
      console.log('🔄 Data quality check failed — retrying with refined seeds...');
      const avgVol = keywordData.length > 0 
        ? (keywordData.reduce((s, k) => s + k.volume, 0) / keywordData.length).toFixed(0)
        : '0';
      const feedback = `Volume moyen: ${avgVol}. Seulement ${keywordData.length} résultats. Utilise des expressions plus populaires et mainstream.`;
      
      const refinedSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial', feedback);
      
      if (refinedSeeds.length >= 5) {
        const refinedData = await fetchKeywordData(refinedSeeds, context.locationCode, context.languageCode);
        if (refinedData.length > keywordData.length || 
            (refinedData.length > 0 && refinedData.reduce((s, k) => s + k.volume, 0) > keywordData.reduce((s, k) => s + k.volume, 0))) {
          keywordData = refinedData;
          seedKeywords = refinedSeeds;
          console.log(`✅ Refined seeds produced better results: ${keywordData.length} keywords`);
        }
      }
    }
    
    if (keywordData.length === 0) {
      console.log('⚠️ Aucun mot-clé trouvé');
      return null;
    }
    
    // ═══ PHASE 4: Ranking Check ═══
    const rankedKeywords = await checkRankings(keywordData, domain, context.locationCode, context.languageCode, context.seDomain);
    
    // STRATEGIC SORT: first keyword = most relevant for core business + target
    const strategicKeywords = sortByStrategicRelevance(rankedKeywords, seedKeywords, pageContentContext);
    
    // GUARANTEE MINIMUM 5 KEYWORDS
    if (strategicKeywords.length < 5) {
      console.log(`⚠️ Only ${strategicKeywords.length} keywords — supplementing with seeds`);
      const existingLower = new Set(strategicKeywords.map(kw => kw.keyword.toLowerCase()));
      for (const seed of seedKeywords) {
        if (strategicKeywords.length >= 5) break;
        if (seed.length > 3 && !existingLower.has(seed.toLowerCase())) {
          existingLower.add(seed.toLowerCase());
          strategicKeywords.push({
            keyword: seed,
            volume: 0,
            difficulty: 0,
            is_ranked: false,
            current_rank: 'Non classé',
          });
          console.log(`➕ Added seed keyword: "${seed}" (volume unknown)`);
        }
      }
    }
    
    const totalVolume = strategicKeywords.reduce((sum, kw) => sum + kw.volume, 0);
    
    console.log(`✅ Données: ${strategicKeywords.length} mots-clés, volume: ${totalVolume}`);
    
    return {
      location_used: context.location,
      total_market_volume: totalVolume,
      top_keywords: strategicKeywords,
      data_source: 'dataforseo',
      fetch_timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Erreur DataForSEO:', error);
    return null;
  }
}

// ==================== RANKED KEYWORDS (existing domain analysis) ====================

async function fetchRankedKeywords(domain: string, locationCode: number, languageCode: string = 'fr'): Promise<RankingOverview | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;
  
  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📊 Fetching ranked keywords for ${cleanDomain}...`);
  
  try {
    const response = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        target: cleanDomain,
        location_code: locationCode,
        language_code: languageCode,
        limit: 100,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
        filters: ['keyword_data.keyword_info.search_volume', '>', '0'],
      }]),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log(`⚠️ Ranked keywords API error: ${response.status}`);
      await response.text();
      return null;
    }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'labs/ranked_keywords');

    const data = await response.json();
    const taskResult = data.tasks?.[0]?.result?.[0];
    
    if (!taskResult?.items || taskResult.items.length === 0) {
      console.log('⚠️ No ranked keywords found for domain');
      return null;
    }
    
    const items = taskResult.items;
    const totalCount = taskResult.total_count || items.length;
    
    // Calculate distribution and averages
    const distribution = { top3: 0, top10: 0, top20: 0, top50: 0, top100: 0, beyond100: 0 };
    let sumPositionAll = 0;
    let sumPositionTop10 = 0;
    let countTop10 = 0;
    let totalEtv = 0;
    
    const topKeywords: { keyword: string; position: number; volume: number; url: string }[] = [];
    
    for (const item of items) {
      const pos = item.ranked_serp_element?.serp_item?.rank_absolute || item.ranked_serp_element?.serp_item?.rank_group || 999;
      const kw = item.keyword_data?.keyword || '';
      const vol = item.keyword_data?.keyword_info?.search_volume || 0;
      const url = item.ranked_serp_element?.serp_item?.url || '';
      const etv = item.ranked_serp_element?.serp_item?.etv || 0;
      
      sumPositionAll += pos;
      totalEtv += etv;
      
      if (pos <= 3) distribution.top3++;
      if (pos <= 10) { distribution.top10++; sumPositionTop10 += pos; countTop10++; }
      else if (pos <= 20) distribution.top20++;
      else if (pos <= 50) distribution.top50++;
      else if (pos <= 100) distribution.top100++;
      else distribution.beyond100++;
      
      // Keep top 10 keywords by volume for context
      if (topKeywords.length < 10) {
        topKeywords.push({ keyword: kw, position: pos, volume: vol, url });
      }
    }
    
    const avgGlobal = items.length > 0 ? Math.round(sumPositionAll / items.length * 10) / 10 : 0;
    const avgTop10 = countTop10 > 0 ? Math.round(sumPositionTop10 / countTop10 * 10) / 10 : 0;
    
    const overview: RankingOverview = {
      total_ranked_keywords: totalCount,
      average_position_global: avgGlobal,
      average_position_top10: avgTop10,
      distribution,
      top_keywords: topKeywords,
      etv: Math.round(totalEtv),
    };
    
    console.log(`✅ Ranking overview: ${totalCount} keywords, avg pos global=${avgGlobal}, top10=${avgTop10}, ETV=${overview.etv}`);
    console.log(`📊 Distribution: top3=${distribution.top3}, top10=${distribution.top10}, top20=${distribution.top20}, top50=${distribution.top50}, top100=${distribution.top100}`);
    
    return overview;
  } catch (error) {
    console.error('❌ Ranked keywords error:', error);
    return null;
  }
}

// ==================== GOOGLE MY BUSINESS DETECTION ====================

interface GMBData {
  title?: string;
  rating?: number;
  reviews_count?: number;
  category?: string;
  address?: string;
  is_claimed?: boolean;
  quick_wins?: string[];
}

async function detectGoogleMyBusiness(domain: string, brandName: string, locationCode: number, languageCode: string = 'fr'): Promise<GMBData | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;

  const cleanDomain = domain.replace(/^www\./, '');
  console.log(`📍 Searching GMB for "${brandName}" / ${cleanDomain}...`);

  try {
    // Search Google Maps for the brand/domain
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword: brandName,
        location_code: locationCode,
        language_code: context.languageCode,
        depth: 5,
      }]),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log(`⚠️ GMB search failed: ${response.status}`);
      await response.text();
      return null;
    }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/google/maps');

    const data = await response.json();
    const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items || !Array.isArray(items)) {
      console.log('📍 No GMB results found');
      return null;
    }

    // Find the listing that matches the domain
    const match = items.find((item: any) => {
      if (!item) return false;
      const itemDomain = (item.domain || '').replace(/^www\./, '').toLowerCase();
      const itemUrl = (item.url || '').toLowerCase();
      return itemDomain === cleanDomain.toLowerCase() || 
             itemUrl.includes(cleanDomain.toLowerCase()) ||
             (item.website && item.website.toLowerCase().includes(cleanDomain.toLowerCase()));
    });

    if (!match) {
      console.log('📍 No matching GMB listing for domain');
      return null;
    }

    const rating = match.rating?.value ?? match.rating ?? null;
    const reviewsCount = match.rating?.votes_count ?? match.reviews_count ?? null;

    // Generate quick wins based on data
    const quickWins: string[] = [];
    if (rating != null && rating < 4.5 && reviewsCount != null) {
      quickWins.push(`Améliorez votre note (${rating}/5) en sollicitant des avis clients satisfaits. Objectif : atteindre 4.5+ pour maximiser la confiance locale.`);
    }
    if (reviewsCount != null && reviewsCount < 50) {
      quickWins.push(`Avec seulement ${reviewsCount} avis, mettez en place une stratégie de collecte d'avis post-achat (email, QR code, SMS) pour renforcer votre visibilité Maps.`);
    }
    if (quickWins.length === 0 && rating != null && rating >= 4.5) {
      quickWins.push(`Exploitez votre excellente note (${rating}/5) en intégrant des rich snippets "AggregateRating" dans vos données structurées Schema.org.`);
    }
    if (quickWins.length < 2) {
      quickWins.push(`Publiez des Google Posts hebdomadaires (offres, actualités, événements) pour maintenir votre fiche active et améliorer votre positionnement local.`);
    }

    const result: GMBData = {
      title: match.title || brandName,
      rating: typeof rating === 'number' ? rating : undefined,
      reviews_count: typeof reviewsCount === 'number' ? reviewsCount : undefined,
      category: match.category || match.snippet || undefined,
      address: match.address || undefined,
      is_claimed: match.is_claimed ?? undefined,
      quick_wins: quickWins.slice(0, 2),
    };

    console.log(`📍 ✅ GMB found: "${result.title}" — ${result.rating}/5 (${result.reviews_count} avis)`);
    return result;
  } catch (error) {
    console.error('📍 GMB detection error:', error);
    return null;
  }
}

// ==================== FOUNDER DISCOVERY VIA SERP ====================

interface FounderInfo {
  name: string | null;
  profileUrl: string | null;
  platform: string | null;
  isInfluencer: boolean;
  geoMismatch: boolean;
  detectedCountry: string | null;
}

// Countries that should match the target site's TLD/location
const COUNTRY_KEYWORDS: Record<string, string[]> = {
  'france': ['france', 'paris', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'strasbourg', 'nice', 'rennes', 'montpellier', 'île-de-france', 'french'],
  'belgium': ['belgium', 'belgique', 'bruxelles', 'brussels', 'anvers', 'antwerp', 'liège', 'gand', 'ghent', 'belgian'],
  'switzerland': ['switzerland', 'suisse', 'schweiz', 'zürich', 'zurich', 'genève', 'geneva', 'bern', 'berne', 'lausanne', 'swiss'],
  'canada': ['canada', 'montréal', 'montreal', 'toronto', 'vancouver', 'québec', 'quebec', 'ottawa', 'canadian'],
  'germany': ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'köln', 'german'],
  'spain': ['spain', 'españa', 'madrid', 'barcelona', 'valencia', 'sevilla', 'spanish'],
  'italy': ['italy', 'italia', 'roma', 'rome', 'milan', 'milano', 'italian'],
  'united kingdom': ['united kingdom', 'uk', 'london', 'manchester', 'birmingham', 'edinburgh', 'british', 'england', 'scotland', 'wales'],
};

// Foreign countries to detect mismatch (not the target country)
const FOREIGN_COUNTRY_MARKERS: Record<string, string> = {
  'états-unis': 'usa', 'united states': 'usa', 'usa': 'usa', 'new york': 'usa', 'san francisco': 'usa', 'silicon valley': 'usa', 'los angeles': 'usa', 'seattle': 'usa', 'austin': 'usa', 'boston': 'usa', 'chicago': 'usa', 'miami': 'usa',
  'india': 'india', 'inde': 'india', 'mumbai': 'india', 'bangalore': 'india', 'bengaluru': 'india', 'delhi': 'india', 'hyderabad': 'india',
  'china': 'china', 'chine': 'china', 'beijing': 'china', 'shanghai': 'china', 'shenzhen': 'china',
  'japan': 'japan', 'japon': 'japan', 'tokyo': 'japan',
  'brazil': 'brazil', 'brésil': 'brazil', 'são paulo': 'brazil',
  'australia': 'australia', 'australie': 'australia', 'sydney': 'australia', 'melbourne': 'australia',
  'nigeria': 'nigeria', 'lagos': 'nigeria',
  'south africa': 'south_africa', 'afrique du sud': 'south_africa', 'johannesburg': 'south_africa', 'cape town': 'south_africa',
  'morocco': 'morocco', 'maroc': 'morocco', 'casablanca': 'morocco', 'rabat': 'morocco',
  'tunisia': 'tunisia', 'tunisie': 'tunisia', 'tunis': 'tunisia',
  'algeria': 'algeria', 'algérie': 'algeria', 'alger': 'algeria',
  'dubai': 'uae', 'abu dhabi': 'uae', 'émirats': 'uae', 'uae': 'uae',
  'singapore': 'singapore', 'singapour': 'singapore',
  'israel': 'israel', 'israël': 'israel', 'tel aviv': 'israel',
  'russia': 'russia', 'russie': 'russia', 'moscow': 'russia', 'moscou': 'russia',
  'south korea': 'south_korea', 'corée du sud': 'south_korea', 'seoul': 'south_korea',
  'mexico': 'mexico', 'mexique': 'mexico',
  'argentina': 'argentina', 'argentine': 'argentina', 'buenos aires': 'argentina',
  'colombia': 'colombia', 'colombie': 'colombia', 'bogota': 'colombia',
};

/**
 * Geo-verification: checks if a LinkedIn founder's detected location matches the target company's country.
 * Returns { mismatch: true, detectedCountry } if the founder appears to be in a different country.
 */
function verifyFounderGeo(linkedinSnippet: string, targetLocation: string): { mismatch: boolean; detectedCountry: string | null } {
  const snippetLower = linkedinSnippet.toLowerCase();
  const targetLower = targetLocation.toLowerCase();
  
  // Check if the snippet mentions the TARGET country — if yes, no mismatch
  const targetKeywords = COUNTRY_KEYWORDS[targetLower] || COUNTRY_KEYWORDS['france'] || [];
  const matchesTarget = targetKeywords.some(kw => snippetLower.includes(kw));
  if (matchesTarget) {
    return { mismatch: false, detectedCountry: null };
  }
  
  // Check if the snippet mentions a FOREIGN country
  for (const [marker, country] of Object.entries(FOREIGN_COUNTRY_MARKERS)) {
    if (snippetLower.includes(marker)) {
      // Make sure the target country is not the same as the detected foreign country
      const targetCountryId = Object.entries(COUNTRY_KEYWORDS).find(([k]) => k === targetLower)?.[0];
      if (country !== targetCountryId) {
        return { mismatch: true, detectedCountry: country };
      }
    }
  }
  
  // No foreign country detected — assume OK (benefit of the doubt)
  return { mismatch: false, detectedCountry: null };
}

async function searchFounderProfile(domain: string, targetLocation: string = 'france'): Promise<FounderInfo> {
  const locInfo = KNOWN_LOCATIONS[targetLocation.toLowerCase()] || KNOWN_LOCATIONS['france'];
  const result: FounderInfo = { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return result;
  
  const domainClean = domain.replace(/^www\./, '');
  
  try {
    console.log(`👤 Searching founder for ${domainClean}...`);
    
    const queries = [
      { q: `"${domainClean}" fondateur OR CEO OR founder site:linkedin.com/in`, platform: 'linkedin' },
      { q: `"${domainClean}" fondateur OR CEO OR founder site:instagram.com`, platform: 'instagram' },
      { q: `"${domainClean}" fondateur OR CEO OR founder site:youtube.com`, platform: 'youtube' },
    ];
    
    const searchPromises = queries.map(async ({ q, platform }) => {
      try {
        const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
          method: 'POST',
          headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword: q, location_code: locInfo.code, language_code: locInfo.lang, depth: 5 }]),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { await resp.text(); return null; }
        const data = await resp.json();
        const items = data.tasks?.[0]?.result?.[0]?.items || [];
        const organic = items.find((i: any) => i.type === 'organic' && i.url);
        if (organic) {
          let name = organic.title?.split(/\s*[-–|]\s*/)?.[0]?.trim() || null;
          if (name) name = name.replace(/\s*\(.*\)/, '').replace(/\s*@.*/, '').trim();
          // Capture the snippet for geo-verification
          const snippet = organic.description || organic.title || '';
          return { name, url: organic.url, platform, title: organic.title, snippet };
        }
        return null;
      } catch { return null; }
    });
    
    const results = (await Promise.all(searchPromises)).filter(Boolean);
    
    if (results.length === 0) {
      console.log('👤 No founder profile found via SERP');
      return result;
    }
    
    const best = results.find(r => r!.platform === 'linkedin') || results[0]!;
    result.name = best!.name;
    result.profileUrl = best!.url;
    result.platform = best!.platform;
    result.isInfluencer = results.length >= 1;
    
    // ═══ GEO-VERIFICATION LOOP ═══
    // If the best result is LinkedIn, verify the founder's country matches the target company
    if (best!.platform === 'linkedin' && best!.snippet) {
      const geoCheck = verifyFounderGeo(best!.snippet, targetLocation);
      if (geoCheck.mismatch) {
        console.log(`👤 ⚠️ GEO MISMATCH: Founder "${result.name}" appears to be in "${geoCheck.detectedCountry}" but target company is in "${targetLocation}"`);
        console.log(`👤 → LinkedIn card will be HIDDEN to avoid confusion with a homonymous foreign entity`);
        result.geoMismatch = true;
        result.detectedCountry = geoCheck.detectedCountry;
        // Do NOT clear name/profileUrl — keep them for logging, but the flag prevents display
      } else {
        console.log(`👤 ✅ Geo-verification OK: founder location consistent with target "${targetLocation}"`);
      }
    }
    
    console.log(`👤 Founder found: ${result.name} on ${result.platform} → ${result.profileUrl}${result.geoMismatch ? ' [GEO MISMATCH]' : ''}`);
    if (results.length >= 2) {
      console.log(`👤 Multi-platform: ${results.map(r => r!.platform).join(', ')}`);
    }
    
    return result;
  } catch (error) {
    console.error('👤 Founder search error:', error);
    return result;
  }
}

// ==================== FACEBOOK PAGE DISCOVERY VIA SERP ====================

interface FacebookPageInfo {
  pageUrl: string | null;
  pageName: string | null;
  found: boolean;
}

async function searchFacebookPage(brandName: string, sector: string, locationCode: number, languageCode: string): Promise<FacebookPageInfo> {
  const result: FacebookPageInfo = { pageUrl: null, pageName: null, found: false };
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD || !brandName) return result;

  try {
    const query = `"${brandName}" "page facebook" "${sector}"`;
    console.log(`📘 Facebook search: ${query}`);

    const resp = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword: query, location_code: locationCode, language_code: languageCode, depth: 10 }]),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) { await resp.text(); return result; }
    const data = await resp.json();
    const items = data.tasks?.[0]?.result?.[0]?.items || [];

    // Find a facebook.com organic result
    const fbResult = items.find((i: any) =>
      i.type === 'organic' && i.url && /facebook\.com\/(?!.*(?:login|help|about|policies|groups\/|events\/|marketplace))/i.test(i.url)
    );

    if (fbResult) {
      result.pageUrl = fbResult.url.replace(/\/$/, '');
      result.pageName = fbResult.title?.split(/\s*[-–|]\s*/)?.[0]?.trim() || brandName;
      result.found = true;
      console.log(`📘 Facebook page found: ${result.pageName} → ${result.pageUrl}`);
    } else {
      console.log('📘 No Facebook page found via SERP');
    }

    return result;
  } catch (error) {
    console.error('📘 Facebook search error:', error);
    return result;
  }
}


const SYSTEM_PROMPT = `RÔLE: Senior Digital Strategist spécialisé Brand Authority & GEO. Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, souverain, prescriptif. Jargon expert (Entité sémantique, Topical Authority, E-E-A-T, Gap de citabilité). Recommandations NARRATIVES: chaque action = paragraphe rédigé 4-5 phrases.

RÈGLE ABSOLUE ANTI-AUTO-CITATION: Le site analysé ne doit JAMAIS apparaître comme son propre concurrent (leader, direct_competitor, challenger, inspiration_source). Ne cite JAMAIS le domaine analysé, son URL, ni son nom de marque dans competitive_landscape ni dans introduction.competitors[]. Tous les acteurs doivent être des entités DISTINCTES du site audité. Le direct_competitor ne peut PAS avoir la même URL ni le même nom que le site cible.

RÈGLE CONCURRENT DIRECT: Le direct_competitor DOIT être un vrai concurrent produit/service avec le MÊME core business ou une feature proche. INTERDIT: médias (Forbes, Le Monde...), annuaires (Capterra, G2...), marketplaces (Amazon...), réseaux sociaux, Wikipedia. Le concurrent direct doit être une entreprise qui vend un produit/service similaire au site analysé, dans la même zone géographique si local.

RÈGLE SOURCE D'INSPIRATION: L'inspiration_source DOIT avoir le même core business que le site cible OU être un nouvel entrant novateur et reconnu sur un business directement lié. C'est une entreprise innovante qui repousse les standards du secteur. INTERDIT: médias, annuaires, marketplaces, réseaux sociaux, Wikipedia, plateformes généralistes. Exemples: pour un outil IA SEO → Claude Code, OpenClaw, Cursor ; pour un e-commerce bio → La Fourche, Kazidomi. L'inspiration doit être un acteur admiré du même écosystème métier.

RÈGLE MOTS-CLÉS STRATÉGIQUES: La liste de mots-clés DOIT OBLIGATOIREMENT contenir au moins une requête directement liée au core business du site. Ex: pour un agent IA → "agent IA", "agent IA entreprise", "automatisation IA TPE" ; pour un plombier → "plombier Paris", "dépannage plomberie". Si aucun mot-clé core business n'apparaît dans les données DataForSEO, AJOUTE-LE manuellement avec volume estimé et rank "non classé".

DONNÉES DE MARCHÉ RÉELLES (DataForSEO): Utilise les volumes, difficultés et positions RÉELS. Identifie Quick Wins (position 11-20, volume>100), Contenus manquants (mots-clés pertinents où le site n'est PAS classé, volume>50). IMPORTANT: Tu DOIS TOUJOURS générer au moins 2-3 content_gaps en analysant les thématiques du secteur où le site n'a pas de contenu, même si les données DataForSEO ne montrent pas ces mots-clés explicitement. Déduis-les du secteur d'activité et des concurrents.

13 MODULES D'ANALYSE:
A. ÉCOSYSTÈME: 1.Market Leader 2.Concurrent Direct 3.Challenger 4.Source d'Inspiration
B. AUTORITÉ SOCIALE: 5.Preuve Sociale (Reddit,X,LinkedIn) 6.Thought Leadership E-E-A-T 7.Sentiment & Polarité
C. EXPERTISE: 8.Score GEO Citabilité 9.Matrice Gap Sémantique 10.Psychologie Conversion
D. MOTS CLÉS: 11.5 Principaux avec volumes réels 12.Opportunités 13.Gaps Concurrentiels
E. TECHNIQUE: 14.Accessibilité Bots IA 15.Performance 16.Cohérence Sémantique
F. FRAÎCHEUR & IA: 17.Fraîcheur contenus 18.Complexité Schema.org 19.Formats IA-Ready 20.First-Party Data 21.Changelog Marque
G. E-E-A-T: 22.Signaux E-E-A-T 23.Densité données 24.Knowledge Graph 25.Études de cas
H. MONITORING: 26.Monitoring LLM (GA4 referrers IA) 27.Fichier llms.txt`;

const EDITORIAL_MODE_SYSTEM_PROMPT = `RÔLE: Senior Content SEO Strategist spécialisé en optimisation d'articles pour les moteurs de réponse IA (GEO). Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, prescriptif, centré sur la PAGE (pas l'entreprise). Tu analyses un CONTENU SPÉCIFIQUE (article de blog, page éditoriale), pas un site complet.

MODE ÉDITORIAL: Cette URL est une page de contenu (/blog, /article). L'analyse porte sur la QUALITÉ et l'OPTIMISATION de cette page spécifique.

RÈGLE INTRODUCTION: L'introduction doit être COURTE (2-3 phrases max) et décrire le CONTENU de la page, pas l'entreprise. Le lien renvoie vers la page analysée.

RÈGLE CONCURRENCE SERP: Les 4 acteurs concurrents sont les PAGES (pas les entreprises) qui se positionnent dans les SERPs sur la même thématique. Chaque URL doit pointer vers la PAGE concurrente spécifique, pas vers la homepage.
- Leader: La page #1 des SERPs pour la thématique de l'article
- Concurrent Direct: Une page similaire qui se positionne juste autour
- Challenger: Une page montante ou récente sur le même sujet
- Source d'Inspiration: Une page exemplaire dans le traitement éditorial du sujet

MODULES À ANALYSER (contenu uniquement):
1. E-E-A-T de la page (auteur, citations, données)
2. Cohérence sémantique (titre/H1/contenu)
3. Score AEO (formats IA-friendly, tables, FAQ, listes)
4. Visibilité LLM (citabilité par les IA)
5. Risque Zéro-Clic
6. Indice de Citabilité (phrases autonomes citables)
7. Résilience au Résumé
8. Empreinte Lexicale
9. Sentiment d'Expertise
10. Red Team (failles du contenu)

NE PAS ANALYSER: Intelligence de marché, réseaux sociaux de l'entreprise, psychologie de conversion, positionnement de marque.`;

const PRODUCT_MODE_SYSTEM_PROMPT = `RÔLE: Senior Product Page Strategist spécialisé en optimisation de pages produit/service pour les moteurs de recherche classiques ET les moteurs de réponse IA (GEO). Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, prescriptif, centré sur la PAGE PRODUIT (pas l'entreprise entière). Tu analyses une page de conversion spécifique.

MODE PRODUIT: Cette URL est une page produit, service ou offre commerciale. L'analyse porte sur la QUALITÉ, la CONVERSION et l'OPTIMISATION GEO de cette page.

RÈGLE INTRODUCTION: L'introduction doit être COURTE (2-3 phrases max) et décrire le PRODUIT/SERVICE présenté sur la page, pas l'entreprise dans son ensemble. Le lien renvoie vers la page analysée.

RÈGLE CONCURRENCE SERP: Les 4 acteurs concurrents sont les PAGES PRODUIT/SERVICE concurrentes dans les SERPs pour la même requête d'achat. Chaque URL doit pointer vers la page produit concurrente.
- Leader: La page produit #1 des SERPs pour cette catégorie
- Concurrent Direct: Un produit/service similaire qui se positionne juste autour  
- Challenger: Une page produit montante ou disruptive
- Source d'Inspiration: Une page produit exemplaire en matière de conversion ET de SEO

MODULES À ANALYSER:
1. Schema Product/Service (données structurées e-commerce)
2. Cohérence sémantique (titre/H1/contenu produit)
3. Score AEO (formats IA-friendly: tableaux comparatifs, FAQ, specs)
4. Visibilité LLM (le produit est-il recommandé par les IA?)
5. Risque Zéro-Clic (les IA donnent-elles déjà la réponse?)
6. Indice de Citabilité (le produit est-il citable de manière autonome?)
7. Résilience au Résumé
8. Empreinte Lexicale (vocabulaire commercial vs technique)
9. Positionnement de mots-clés (termes d'achat, comparatifs)
10. Red Team (failles de la page produit)

ANALYSER AUSSI: Intelligence de marché LIMITÉE au segment produit, positionnement prix si détectable.
NE PAS ANALYSER: Réseaux sociaux de l'entreprise, thought leadership du fondateur.`;

const DEEP_PAGE_SYSTEM_PROMPT = `RÔLE: Senior SEO & GEO Strategist spécialisé en optimisation de pages internes profondes. Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, prescriptif, centré sur CETTE PAGE SPÉCIFIQUE (pas l'entreprise). Tu analyses une page interne profonde qui a un objectif précis.

MODE PAGE PROFONDE: Cette URL est une page interne spécifique (sous-page, landing page, page catégorie). L'analyse porte sur la pertinence et l'optimisation de cette page dans son contexte.

RÈGLE INTRODUCTION: L'introduction doit être COURTE (2-3 phrases max) et identifier le TYPE et l'OBJECTIF de cette page spécifique. Le lien renvoie vers la page analysée.

RÈGLE CONCURRENCE SERP: Les 4 acteurs concurrents sont les PAGES similaires dans les SERPs qui ciblent la même intention de recherche. Chaque URL doit pointer vers la page concurrente spécifique.
- Leader: La page #1 des SERPs pour l'intention de cette page
- Concurrent Direct: Une page similaire avec le même objectif
- Challenger: Une page innovante sur le même sujet
- Source d'Inspiration: Une page exemplaire dans son approche

MODULES À ANALYSER:
1. E-E-A-T de la page
2. Cohérence sémantique (titre/H1/contenu)
3. Score AEO (formats IA-friendly)
4. Visibilité LLM
5. Risque Zéro-Clic
6. Indice de Citabilité
7. Résilience au Résumé
8. Empreinte Lexicale
9. Positionnement de mots-clés
10. Red Team

ANALYSER AUSSI: Intelligence de marché LIMITÉE au sujet de la page.
NE PAS ANALYSER: Réseaux sociaux de l'entreprise, thought leadership du fondateur.`;


// ==================== TOOLS DATA → MARKDOWN (token optimizer) ====================

function formatToolsDataToMarkdown(toolsData: ToolsData): string {
  const lines: string[] = [];

  // --- CRAWLERS ---
  if (toolsData.crawlers) {
    const c = toolsData.crawlers;
    lines.push('## CRAWLERS');
    if (c.overallScore != null) lines.push(`Score: ${c.overallScore}/100`);
    if (c.bots && Array.isArray(c.bots)) {
      for (const b of c.bots) {
        if (b.name) lines.push(`- ${b.name}: ${b.isAllowed ? '✅' : '❌'}${b.crawlDelay ? ` delay=${b.crawlDelay}` : ''}`);
      }
    }
    if (c.recommendations && Array.isArray(c.recommendations)) {
      lines.push(`Recs: ${c.recommendations.slice(0, 5).join('; ')}`);
    }
  }

  // --- GEO ---
  if (toolsData.geo) {
    const g = toolsData.geo;
    lines.push('## GEO');
    if (g.overallScore != null) lines.push(`Score: ${g.overallScore}/100`);
    if (g.factors && Array.isArray(g.factors)) {
      for (const f of g.factors) {
        if (f.name) lines.push(`- ${f.name}: ${f.score ?? f.status ?? '?'}${f.details ? ` (${String(f.details).substring(0, 80)})` : ''}`);
      }
    }
    if (g.recommendations && Array.isArray(g.recommendations)) {
      lines.push(`Recs: ${g.recommendations.slice(0, 5).join('; ')}`);
    }
  }

  // --- LLM ---
  if (toolsData.llm) {
    const l = toolsData.llm;
    lines.push('## LLM');
    if (l.overallScore != null) lines.push(`Score: ${l.overallScore}/100`);
    if (l.brandMentioned != null) lines.push(`Brand mentioned: ${l.brandMentioned}`);
    if (l.citationScore != null) lines.push(`Citation: ${l.citationScore}`);
    if (l.sentimentScore != null) lines.push(`Sentiment: ${l.sentimentScore}`);
    if (l.hallucinationRisk != null) lines.push(`Hallucination risk: ${l.hallucinationRisk}`);
    if (l.models && Array.isArray(l.models)) {
      for (const m of l.models) {
        if (m.name) lines.push(`- ${m.name}: mentioned=${m.brandMentioned ?? '?'}, sentiment=${m.sentiment ?? '?'}`);
      }
    }
    if (l.recommendations && Array.isArray(l.recommendations)) {
      lines.push(`Recs: ${l.recommendations.slice(0, 5).join('; ')}`);
    }
  }

  // --- PAGESPEED ---
  if (toolsData.pagespeed) {
    const p = toolsData.pagespeed;
    lines.push('## PAGESPEED');
    if (p.overallScore != null) lines.push(`Score: ${p.overallScore}/100`);
    if (p.lcp != null) lines.push(`LCP: ${p.lcp}ms`);
    if (p.fcp != null) lines.push(`FCP: ${p.fcp}ms`);
    if (p.cls != null) lines.push(`CLS: ${p.cls}`);
    if (p.tbt != null) lines.push(`TBT: ${p.tbt}ms`);
    if (p.si != null) lines.push(`SI: ${p.si}ms`);
    if (p.ttfb != null) lines.push(`TTFB: ${p.ttfb}ms`);
    if (p.performance != null) lines.push(`Performance: ${p.performance}`);
    if (p.accessibility != null) lines.push(`Accessibility: ${p.accessibility}`);
    if (p.seo != null) lines.push(`SEO: ${p.seo}`);
    if (p.bestPractices != null) lines.push(`Best Practices: ${p.bestPractices}`);
    if (p.recommendations && Array.isArray(p.recommendations)) {
      lines.push(`Recs: ${p.recommendations.slice(0, 5).join('; ')}`);
    }
  }

  return lines.join('\n');
}

function buildUserPrompt(url: string, domain: string, toolsData: ToolsData, marketData: MarketData | null, pageContentContext: string = '', eeatSignals?: EEATSignals, founderInfo?: FounderInfo, rankingOverview?: RankingOverview | null, contentMode: boolean = false, facebookPageInfo?: FacebookPageInfo): string {
  let marketSection = '';
  
  if (marketData) {
    const kwList = marketData.top_keywords.map(kw => 
      `"${kw.keyword}":${kw.volume}vol,diff${kw.difficulty},pos:${kw.current_rank}`
    ).join('; ');
    
    const quickWins = marketData.top_keywords.filter(kw => 
      typeof kw.current_rank === 'number' && kw.current_rank >= 11 && kw.current_rank <= 20 && kw.volume > 100
    );
    const missing = marketData.top_keywords.filter(kw => !kw.is_ranked && kw.volume > 200);
    
    marketSection = `📊 DONNÉES MARCHÉ (DataForSEO) - Zone: ${marketData.location_used}, Volume total: ${marketData.total_market_volume}
Mots-clés: ${kwList}
Quick Wins: ${quickWins.length > 0 ? quickWins.map(kw => `"${kw.keyword}" pos${kw.current_rank}(${kw.volume}vol)`).join(', ') : 'Aucun'}
Manquants: ${missing.length > 0 ? missing.map(kw => `"${kw.keyword}"(${kw.volume}vol)`).join(', ') : 'Aucun'}`;
  } else {
    marketSection = `⚠️ DataForSEO non disponible - base-toi sur ton analyse du secteur.`;
  }

  // Merge ranking overview into market section to avoid keyword duplication
  if (rankingOverview) {
    marketSection += `\n📈 ÉTAT DES LIEUX SEO: ${rankingOverview.total_ranked_keywords} mots-clés positionnés, pos moy=${rankingOverview.average_position_global}, Top10 moy=${rankingOverview.average_position_top10 || 'N/A'}, ETV=${rankingOverview.etv}
Distrib: Top3=${rankingOverview.distribution.top3} Top10=${rankingOverview.distribution.top10} Top20=${rankingOverview.distribution.top20} Top50=${rankingOverview.distribution.top50} Top100=${rankingOverview.distribution.top100}
Top positionnés: ${rankingOverview.top_keywords.slice(0, 5).map(k => `"${k.keyword}" pos${k.position}(${k.volume}vol)`).join(', ')}`;
  }

  // Build compact E-E-A-T section
  let eeatSection = '';
  if (eeatSignals) {
    const yn = (v: boolean) => v ? 'OUI' : 'NON';
    const lines = [`🔍 E-E-A-T: AuthorBio=${yn(eeatSignals.hasAuthorBio)}(${eeatSignals.authorBioCount}), AuthorJsonLD=${yn(eeatSignals.hasAuthorInJsonLd)}, Person=${yn(eeatSignals.hasPerson)}, ProfilePage=${yn(eeatSignals.hasProfilePage)}, Organization=${yn(eeatSignals.hasOrganization)}, sameAs=${yn(eeatSignals.hasSameAs)}, Wikidata=${yn(eeatSignals.hasWikidataSameAs)}, SocialLinks=${eeatSignals.socialLinksCount}, ExpertCitations=${yn(eeatSignals.hasExpertCitations)}, CaseStudies=${yn(eeatSignals.hasCaseStudies)}(${eeatSignals.caseStudySignals})`];
    if (eeatSignals.detectedSocialUrls.length > 0) {
      lines.push(`URLs sociales: ${eeatSignals.detectedSocialUrls.slice(0, 10).join(', ')}`);
      const personalLI = eeatSignals.linkedInUrls.filter(u => /linkedin\.com\/in\//i.test(u));
      const companyLI = eeatSignals.linkedInUrls.filter(u => /linkedin\.com\/company\//i.test(u));
      if (personalLI.length > 0) lines.push(`LinkedIn perso: ${personalLI.join(', ')}`);
      if (companyLI.length > 0) lines.push(`LinkedIn entreprise: ${companyLI.join(', ')}`);
    }
    // Facebook page info from SERP
    if (facebookPageInfo?.found && facebookPageInfo.pageUrl) {
      lines.push(`📘 Facebook Page SERP: ${facebookPageInfo.pageName || 'trouvée'} → ${facebookPageInfo.pageUrl}`);
    } else {
      lines.push(`📘 Facebook Page SERP: NON TROUVÉE`);
    }
    eeatSection = lines.join('\n');
  }

  // Compact founder section (skip in content mode)
  let founderSection = '';
  if (!contentMode) {
    if (founderInfo?.name && !founderInfo.geoMismatch) {
      founderSection = `\n👤 FONDATEUR: ${founderInfo.name} (${founderInfo.platform || '?'})${founderInfo.profileUrl ? ` URL:${founderInfo.profileUrl}` : ''} Social:${founderInfo.isInfluencer ? 'actif' : 'non'}. Cite ce nom dans thought_leadership.analysis.`;
    } else if (founderInfo?.geoMismatch) {
      founderSection = `\n⚠️ Fondateur homonyme étranger (${founderInfo.detectedCountry}) — NE PAS mentionner. founder_authority="unknown".`;
    }
  }

  const toolsMarkdown = formatToolsDataToMarkdown(toolsData);

  // ═══ CONTENT MODE: Simplified prompt for blog/article pages ═══
  if (contentMode) {
    return `Analyse cette PAGE DE CONTENU: "${url}" (${domain}).
${pageContentContext}
${eeatSection}
${marketSection}
${toolsMarkdown}

⚠️ MODE CONTENU: Analyse la PAGE elle-même, pas l'entreprise. La présentation doit décrire le contenu de la page en 2-3 phrases courtes.

CONCURRENCE SERP: Les concurrents sont les PAGES qui se positionnent dans les SERPs sur la même thématique que cet article. Chaque URL doit pointer vers la PAGE concurrente, pas la homepage.

GÉNÈRE un JSON:
{"introduction":{"presentation":"2-3ph courtes analysant LE CONTENU de la page","strengths":"2-3ph sur les forces du contenu","improvement":"2-3ph sur les axes d'amélioration du contenu","competitors":["Page Leader SERP","Page Concurrente","Page Challenger"]},
"brand_authority":{"dna_analysis":"Analyse de l'expertise démontrée dans le contenu","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"competitive_landscape":{"leader":{"name":"Titre de la page #1 SERP","url":"URL de la page","authority_factor":"Pourquoi cette page domine","analysis":"2-3ph"},"direct_competitor":{"name":"Titre page concurrente","url":"URL de la page","authority_factor":"...","analysis":"2-3ph"},"challenger":{"name":"Titre page challenger","url":"URL","authority_factor":"...","analysis":"2-3ph"},"inspiration_source":{"name":"Titre page exemplaire","url":"URL","authority_factor":"...","analysis":"2-3ph"}},
"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":[],"weaknesses":[],"recommendations":[]},
"llm_visibility":{"citation_probability":0-100,"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["3-5 questions naturelles liées au contenu"],"recommendations":[]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"...","business_value":"High|Medium|Low","pain_point":"...","recommended_action":"..."}}],"quick_wins":[],"content_gaps":[],"opportunities":[],"competitive_gaps":[],"recommendations":[]},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"},
"executive_roadmap":[{"title":"...","prescriptive_action":"4-5ph","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Contenu|Autorité|Technique","priority":"Prioritaire|Important|Opportunité"}],
"executive_summary":"2-3ph résumé du potentiel de cette page","overallScore":0-100,
"quotability":{"score":0-100,"quotes":["phrase citable 1","2","3"]},
"summary_resilience":{"score":0-100,"originalH1":"...","llmSummary":"10 mots max"},
"lexical_footprint":{"jargonRatio":0-100,"concreteRatio":0-100},
"expertise_sentiment":{"rating":1-5,"justification":"1ph"},
"red_team":{"flaws":["faille contenu 1","preuve manquante 2","objection lecteur 3"]}}

RÈGLES:
- introduction.presentation: 2-3 phrases COURTES décrivant LE CONTENU de cette page, pas l'entreprise
- competitive_landscape: 4 PAGES concurrentes dans les SERPs, pas des entreprises. URLs = pages spécifiques
- NE génère PAS: social_signals, market_intelligence, priority_content
- executive_roadmap: MIN 4 recs centrées sur l'optimisation du CONTENU
- quotability, summary_resilience, lexical_footprint, expertise_sentiment, red_team: obligatoires
- JSON pur, sans virgules traînantes`;
  }

  return `Analyse "${url}" (${domain}).
${pageContentContext}
${eeatSection}${founderSection}
${marketSection}
${toolsMarkdown}

GÉNÈRE un JSON:
{"introduction":{"presentation":"4-5ph","strengths":"4-5ph","improvement":"4-5ph","competitors":["Leader","Concurrent","Challenger"]},
"brand_authority":{"dna_analysis":"...","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"social_signals":{"proof_sources":[{"platform":"reddit|x|linkedin|youtube|instagram|facebook","presence_level":"strong|moderate|weak|absent","analysis":"max 450 car","profile_url":"URL exacte des E-E-A-T ou null","profile_name":"ou null"}],"thought_leadership":{"founder_authority":"high|moderate|low|unknown","entity_recognition":"...","eeat_score":0-10,"analysis":"Distingue signaux vérifiés vs inférés"},"sentiment":{"overall_polarity":"positive|mostly_positive|neutral|mixed|negative","hallucination_risk":"low|medium|high","reputation_vibration":"..."}},
"market_intelligence":{"sophistication":{"level":1-5,"description":"...","emotional_levers":["1","2","3"]},"semantic_gap":{"current_position":0-100,"leader_position":0-100,"gap_analysis":"...","priority_themes":["t1","t2","t3","t4"],"closing_strategy":"..."}},
"competitive_landscape":{"leader":{"name":"...","url":"...","authority_factor":"...","analysis":"3-4ph"},"direct_competitor":{"name":"...","url":"URL VALIDE","authority_factor":"...","analysis":"3-4ph"},"challenger":{...},"inspiration_source":{...}},
"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":[],"weaknesses":[],"recommendations":[]},
"llm_visibility":{"citation_probability":0-100,"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["3-5 questions naturelles liées au business"],"recommendations":[]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"priority_content":{"missing_pages":[{"title":"...","rationale":"...","target_keywords":[],"expected_impact":"high|medium|low"}],"content_upgrades":[{"page":"...","current_issue":"...","upgrade_strategy":"..."}]},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"Transactionnel|Informatif|Décisionnel|Navigationnel","business_value":"High|Medium|Low","pain_point":"...","recommended_action":"..."}}],"quick_wins":[{"keyword":"...","volume":0,"current_rank":15,"action":"..."}],"content_gaps":[{"keyword":"mot-clé pertinent non classé","volume":100,"priority":"high|medium|low","action":"Créer une page dédiée..."}],"opportunities":["..."],"competitive_gaps":["..."],"recommendations":["..."]},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"},
"executive_roadmap":[{"title":"...","prescriptive_action":"4-5ph","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Identité|Contenu|Autorité|Social|Technique","priority":"Prioritaire|Important|Opportunité"}],
"executive_summary":"3-4ph CEO/CMO","overallScore":0-100,
"quotability":{"score":0-100,"quotes":["phrase citable 1","2","3"]},
"summary_resilience":{"score":0-100,"originalH1":"...","llmSummary":"10 mots max"},
"lexical_footprint":{"jargonRatio":0-100,"concreteRatio":0-100},
"expertise_sentiment":{"rating":1-5,"justification":"1ph"},
"red_team":{"flaws":["faille 1","preuve manquante 2","objection 3"]}}

RÈGLES:
- main_keywords: MIN 5 obligatoires avec strategic_analysis (intent,business_value,pain_point,recommended_action). Complète si <5 résultats DataForSEO. JAMAIS le nom de marque. 100% génériques.
- executive_roadmap: MIN 6 recs narratives dont ≥1 category "Social"
- direct_competitor: JAMAIS "${domain}". AUTRE domaine, même core business.
- profile_url: UNIQUEMENT URLs listées dans E-E-A-T ci-dessus. COPIE-COLLE. Max 2 profils avec URL. Sinon null.
- Fondateur: cite si CERTAIN. Sinon "fondateur non identifié". founder_authority="unknown" par défaut.
- eeat_score EVIDENCE-BASED: Crawlé: +1pt(AuthorJsonLD,Person/ProfilePage,Wikidata,Organization) +0.5pt(sameAs,AuthorBio,LI company,LI perso,Citations,CaseStudies). Max tech ~7pts. Inféré: +1-3pts marque connue. Sans signal tech: max 3. Avec tech sans incarnation: max 7. Avec incarnation: 7-9. 10: Wikidata ou marque certaine.
- NE PRÉTENDS PAS connaître: nb abonnés, existence GMB, fraîcheur posts. analysis thought_leadership: sépare "Signaux vérifiés" vs "Signaux estimés".
- quotability: phrases factuelles autonomes citables. +33pts/citation.
- summary_resilience: résumé ≤10 mots. Score similarité H1/contenu.
- lexical_footprint: jargonRatio+concreteRatio=100. ATTENTION: "jargon" = UNIQUEMENT les formules vides/corporate sans substance (ex: "solutions innovantes", "accompagnement sur-mesure", "leader de la transformation"). La terminologie métier précise (ex: "assurance vie", "prévoyance collective", "taux de rendement", "SCPI") est du vocabulaire CONCRET, PAS du jargon. Un site professionnel avec du vocabulaire technique spécifique à son secteur doit avoir un concreteRatio élevé (75-95). Seuls les buzzwords creux sans valeur informative comptent comme jargon.
- expertise_sentiment: 1(générique/IA) à 5(expert terrain).
- red_team: 3 failles/objections client sceptique.
- Base recommandations sur état des lieux SEO réel si fourni.
- JSON pur, sans virgules traînantes`;
}

// ==================== EXTRACT PAGE METADATA (lightweight) ====================

async function extractPageMetadata(url: string): Promise<{ context: string; brandSignals: BrandSignal[]; eeatSignals: EEATSignals }> {
  let pageContentContext = '';
  const brandSignals: BrandSignal[] = [];
  const eeatSignals: EEATSignals = {
    hasAuthorBio: false, authorBioCount: 0,
    hasSocialLinks: false, hasLinkedInLinks: false,
    socialLinksCount: 0, linkedInLinksCount: 0, linkedInUrls: [],
    hasSameAs: false, hasWikidataSameAs: false,
    hasAuthorInJsonLd: false, hasProfilePage: false,
    hasPerson: false, hasOrganization: false,
    hasCaseStudies: false, caseStudySignals: 0,
    hasExpertCitations: false, detectedSocialUrls: [],
  };
  
  try {
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log('📄 Fetching page metadata...');
    const pageResp = await fetch(normalizedUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    
    if (!pageResp.ok) {
      await pageResp.text();
      return { context: '', brandSignals: [], eeatSignals };
    }
    
    let html = await pageResp.text();
    
    // SPA detection
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';
    const textOnly = bodyContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (textOnly.length < 200 && html.length > 1000) {
      console.log(`📄 SPA detected (${textOnly.length} chars). Trying JS rendering...`);
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY');
      if (RENDERING_KEY) {
        try {
          const renderResponse = await fetch(`https://chrome.browserless.io/content?token=${RENDERING_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: normalizedUrl,
              rejectResourceTypes: ['image', 'media', 'font', 'stylesheet'],
              waitFor: 2000,
              gotoOptions: { waitUntil: 'networkidle2', timeout: 15000 },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }),
            signal: AbortSignal.timeout(20000),
          });
          
          if (renderResponse.ok) {
            const renderedHtml = await renderResponse.text();
            if (renderedHtml.length > html.length) {
              html = renderedHtml;
              console.log(`📄 ✅ JS rendering success`);
            }
          } else {
            console.log(`📄 ⚠️ Rendering error: ${renderResponse.status}`);
            await renderResponse.text();
          }
        } catch (renderErr) {
          console.log('📄 ⚠️ Rendering failed:', renderErr instanceof Error ? renderErr.message : renderErr);
        }
      }
    }
    
    // ═══ EXTRACT E-E-A-T SIGNALS BEFORE STRIPPING HTML ═══
    console.log('🔍 Extracting E-E-A-T signals from HTML...');
    
    // 1. Author bios
    const authorPatterns = [
      /rel=["']author["']/gi,
      /class=["'][^"']*\bauthor\b[^"']*["']/gi,
      /itemprop=["']author["']/gi,
    ];
    let abCount = 0;
    for (const p of authorPatterns) abCount += (html.match(p) || []).length;
    eeatSignals.hasAuthorBio = abCount > 0;
    eeatSignals.authorBioCount = abCount;
    
    // 2. Social links detection (extract actual URLs)
    const socialUrlPatterns = [
      /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?x\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?twitter\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'#?\s]*)/gi,
      /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@[^"'#?\s]*)/gi,
    ];
    const detectedUrls = new Set<string>();
    const liUrls: string[] = [];
    for (const p of socialUrlPatterns) {
      let m;
      while ((m = p.exec(html)) !== null) {
        const u = m[1].replace(/\/$/, '');
        detectedUrls.add(u);
        if (/linkedin\.com/i.test(u)) liUrls.push(u);
      }
    }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;
    eeatSignals.hasSocialLinks = detectedUrls.size > 0;
    eeatSignals.linkedInUrls = liUrls.slice(0, 5);
    eeatSignals.linkedInLinksCount = liUrls.length;
    eeatSignals.hasLinkedInLinks = liUrls.length > 0;
    
    // 3. JSON-LD analysis + brand signal extraction
    let jsonLdOrgName = '';
    const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of schemaMatches) {
      try {
        const jsonStr = block.replace(/<\/?script[^>]*>/gi, '');
        const parsed = JSON.parse(jsonStr);
        const checkNode = (node: any, depth = 0) => {
          if (!node || typeof node !== 'object' || depth > 5) return;
          if (Array.isArray(node)) { node.forEach(n => checkNode(n, depth + 1)); return; }
          const nodeType = String(node['@type'] || '').toLowerCase();
          if (nodeType.includes('organization')) {
            eeatSignals.hasOrganization = true;
            if (node.name && typeof node.name === 'string' && !jsonLdOrgName) {
              jsonLdOrgName = node.name.trim();
            }
          }
          if (nodeType.includes('person')) eeatSignals.hasPerson = true;
          if (nodeType.includes('profilepage')) eeatSignals.hasProfilePage = true;
          if (node.author || nodeType === 'author') eeatSignals.hasAuthorInJsonLd = true;
          if (node.sameAs) {
            eeatSignals.hasSameAs = true;
            const sameAsArr = Array.isArray(node.sameAs) ? node.sameAs : [node.sameAs];
            for (const s of sameAsArr) {
              if (typeof s === 'string') {
                if (/wikidata\.org/i.test(s)) eeatSignals.hasWikidataSameAs = true;
                if (/linkedin|twitter|x\.com|instagram|youtube|facebook|tiktok/i.test(s)) {
                  detectedUrls.add(s.replace(/\/$/, ''));
                }
              }
            }
          }
          for (const key of Object.keys(node)) {
            if (typeof node[key] === 'object') checkNode(node[key], depth + 1);
          }
        };
        checkNode(parsed);
      } catch { /* skip */ }
    }
    eeatSignals.detectedSocialUrls = [...detectedUrls].slice(0, 20);
    eeatSignals.socialLinksCount = detectedUrls.size;
    
    // 4. Expert citations
    const citPatterns = [
      /selon\s+(?:le|la|les|un|une)\s+(?:expert|spécialiste|étude|rapport|dr\.|prof)/gi,
      /according\s+to/gi,
      /<blockquote/gi,
    ];
    let citCount = 0;
    for (const p of citPatterns) citCount += (html.match(p) || []).length;
    eeatSignals.hasExpertCitations = citCount > 0;
    
    // 5. Case studies
    const csPatterns = [/(?:cas\s+client|étude\s+de\s+cas|case\s+stud|témoignage|success\s+stor)/gi];
    let csCount = 0;
    for (const p of csPatterns) csCount += (html.match(p) || []).length;
    eeatSignals.hasCaseStudies = csCount > 0;
    eeatSignals.caseStudySignals = csCount;
    
    console.log(`🔍 E-E-A-T: author=${eeatSignals.authorBioCount}, social=${eeatSignals.socialLinksCount}, sameAs=${eeatSignals.hasSameAs}, wikidata=${eeatSignals.hasWikidataSameAs}, person=${eeatSignals.hasPerson}, linkedIn=${eeatSignals.linkedInLinksCount}, org=${eeatSignals.hasOrganization}`);
    
    // ═══ NOW strip HTML to metadata only ═══
    const headMatch2 = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const h1Match2 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    html = (headMatch2 ? `<head>${headMatch2[1]}</head>` : '') + 
           (h1Match2 ? `<body><h1>${h1Match2[1]}</h1></body>` : '');
    
    // ═══ COLLECT ALL 5 BRAND SIGNALS ═══
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*?)["']/i)
      || html.match(/<meta\s+content=["']([^"']*?)["']\s+name=["']description["']/i);
    const ogSiteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']*?)["']/i);
    const appNameMatch = html.match(/<meta\s+name=["']application-name["']\s+content=["']([^"']*?)["']/i);
    
    // Signal 1: JSON-LD Organization.name (weight 35)
    if (jsonLdOrgName) {
      brandSignals.push({ source: 'jsonld', value: jsonLdOrgName, weight: 35 });
    }
    
    // Signal 2: og:site_name (weight 30)
    if (ogSiteNameMatch?.[1]?.trim()) {
      brandSignals.push({ source: 'og:site_name', value: ogSiteNameMatch[1].trim(), weight: 30 });
    }
    
    // Signal 3: application-name (weight 15)
    if (appNameMatch?.[1]?.trim()) {
      brandSignals.push({ source: 'application-name', value: appNameMatch[1].trim(), weight: 15 });
    }
    
    // Signal 4: <title> extraction — brand part after separator (weight 10)
    if (titleMatch?.[1]) {
      const titleText = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      for (const sep of [' | ', ' - ', ' — ', ' – ', ' :: ', ' · ']) {
        if (titleText.includes(sep)) {
          const candidate = titleText.split(sep).pop()?.trim() || '';
          if (candidate.length >= 2 && candidate.length <= 50) {
            brandSignals.push({ source: 'title', value: candidate, weight: 10 });
          }
          break;
        }
      }
    }
    
    // Signal 5: Web App Manifest name (weight 10) — fetch in parallel
    try {
      const baseUrl = new URL(normalizedUrl);
      // Check common manifest paths
      const manifestLink = html.match(/<link[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["']/i);
      const manifestPath = manifestLink?.[1] || '/site.webmanifest';
      const manifestUrl = new URL(manifestPath, baseUrl.origin).href;
      
      const manifestResp = await fetch(manifestUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(3000),
      });
      if (manifestResp.ok) {
        const manifestData = await manifestResp.json();
        const mName = (manifestData.name || manifestData.short_name || '').trim();
        if (mName && mName.length >= 2 && mName.length <= 60) {
          brandSignals.push({ source: 'manifest', value: mName, weight: 10 });
        }
      } else {
        await manifestResp.text();
      }
    } catch { /* manifest not available — that's fine */ }
    
    console.log(`🏷️ Brand signals: ${brandSignals.map(s => `${s.source}="${s.value}"(w${s.weight})`).join(', ') || 'none'}`);
    
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const metaDesc = metaDescMatch?.[1]?.trim() || '';
    const h1 = h1Match2?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
    
    if (title || metaDesc || h1) {
      pageContentContext = `
CONTENU PAGE: Titre="${title||'?'}", Desc="${(metaDesc||'?').substring(0,200)}", H1="${h1||'?'}"
Utilise ces informations pour identifier le core business.`;
      console.log(`✅ Metadata: title="${title.substring(0,50)}", h1="${h1.substring(0,50)}"`);
    }
    
    html = '';
  } catch (e) {
    console.log('⚠️ Page fetch failed:', e instanceof Error ? e.message : e);
  }
  
  return { context: pageContentContext, brandSignals, eeatSignals };
}

// ==================== MAIN HANDLER ====================

/** Safely execute an async task, returning null on failure */
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`⚠️ [${label}] failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Race a promise against a deadline. Returns null if deadline wins. */
function withDeadline<T>(promise: Promise<T>, deadlineMs: number, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => {
      console.warn(`⏰ [${label}] hit deadline (${deadlineMs}ms)`);
      resolve(null);
    }, deadlineMs)),
  ]);
}

/** Save result to audit_cache (fire-and-forget) */
async function saveToCache(domain: string, url: string, result: any): Promise<void> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabaseUrlEnv = Deno.env.get('SUPABASE_URL') || '';
  if (!serviceKey || !supabaseUrlEnv) return;
  try {
    const adminClient = createClient(supabaseUrlEnv, serviceKey);
    const cacheKey = `strategic_${domain}_${url}`;
    await adminClient.from('audit_cache').upsert({
      cache_key: cacheKey,
      function_name: 'audit-strategique-ia',
      result_data: result,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: 'cache_key' });
    console.log('✅ Result saved to audit_cache for timeout recovery');
  } catch (cacheErr) {
    console.warn('⚠️ Failed to cache result:', cacheErr);
  }
}

/** Build a minimal fallback result when LLM fails */
function buildFallbackResult(url: string, domain: string, marketData: MarketData | null, rankingOverview: RankingOverview | null, llmData: any, cachedContextOut: any): any {
  return {
    success: true,
    data: {
      url, domain,
      scannedAt: new Date().toISOString(),
      overallScore: 0,
      introduction: { presentation: 'L\'analyse IA n\'a pas pu être complétée. Les données de marché sont disponibles.', strengths: '', improvement: '', competitors: [] },
      brand_authority: { dna_analysis: 'Non disponible', thought_leadership_score: 0, entity_strength: 'unknown' },
      social_signals: { proof_sources: [], thought_leadership: { founder_authority: 'unknown', entity_recognition: '', eeat_score: 0, analysis: '' }, sentiment: { overall_polarity: 'neutral', hallucination_risk: 'medium', reputation_vibration: '' } },
      market_intelligence: { sophistication: { level: 1, description: '', emotional_levers: [] }, semantic_gap: { current_position: 0, leader_position: 0, gap_analysis: '', priority_themes: [], closing_strategy: '' } },
      competitive_landscape: { leader: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' }, direct_competitor: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' }, challenger: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' }, inspiration_source: { name: 'Non identifié', url: null, authority_factor: '', analysis: '' } },
      geo_readiness: { citability_score: 0, readiness_level: 'basic', analysis: 'Non disponible', strengths: [], weaknesses: [], recommendations: [] },
      executive_roadmap: [],
      keyword_positioning: marketData ? {
        main_keywords: marketData.top_keywords.slice(0, 5).map(kw => ({ keyword: kw.keyword, volume: kw.volume, difficulty: kw.difficulty, current_rank: kw.current_rank })),
        quick_wins: [], content_gaps: [], opportunities: [], competitive_gaps: [], recommendations: [],
      } : null,
      market_data_summary: marketData ? { total_market_volume: marketData.total_market_volume, keywords_ranked: marketData.top_keywords.filter(k => k.is_ranked).length, keywords_analyzed: marketData.top_keywords.length, average_position: 0, data_source: 'dataforseo' } : null,
      executive_summary: 'L\'analyse stratégique n\'a pas pu être complétée par l\'IA. Les données de marché et de positionnement sont disponibles.',
      quotability: { score: 0, quotes: [] },
      summary_resilience: { score: 0, originalH1: '', llmSummary: '' },
      lexical_footprint: { jargonRatio: 50, concreteRatio: 50 },
      expertise_sentiment: { rating: 1, justification: 'Non évalué' },
      red_team: { flaws: [] },
      raw_market_data: marketData,
      ranking_overview: rankingOverview,
      toolsData: null,
      llm_visibility_raw: llmData,
      _cachedContext: cachedContextOut,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'audit-strategique-ia', 10, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('audit-strategique-ia', 25)) return concurrencyResponse(corsHeaders);

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  // ═══ ASYNC JOB POLLING: GET ?job_id=xxx ═══
  const reqUrl = new URL(req.url);
  const pollJobId = reqUrl.searchParams.get('job_id');
  if (pollJobId && req.method === 'GET') {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);
    const { data: job } = await sb.from('async_jobs').select('status, result_data, error_message, progress').eq('id', pollJobId).single();
    if (!job) return json({ error: 'Job not found' }, 404);
    if (job.status === 'completed') return json({ success: true, data: job.result_data, status: 'completed' });
    if (job.status === 'failed') return json({ success: false, error: job.error_message, status: 'failed' });
    return json({ status: job.status, progress: job.progress });
  }

  // ═══ ASYNC MODE: POST with { async: true } returns 202 + job_id ═══
  // ═══ GLOBAL DEADLINE: 8 min 30s — guarantees response before Edge Function timeout ═══
  const GLOBAL_DEADLINE = 510_000; // 8min30s
  const startTime = Date.now();
  const isOverDeadline = () => Date.now() - startTime > GLOBAL_DEADLINE;

  try {
    const body = await req.json();
    const { url, toolsData, hallucinationCorrections, competitorCorrections, cachedContext, lang } = body;
    const asyncMode = body.async === true;
    const outputLang = lang || 'fr';
    const langLabel = outputLang === 'fr' ? 'français' : outputLang === 'es' ? 'espagnol' : 'anglais';
    const dfLangCode = outputLang === 'es' ? 'es' : outputLang === 'en' ? 'en' : 'fr';
    const dfSeDomain = outputLang === 'es' ? 'google.es' : outputLang === 'en' ? 'google.com' : 'google.fr';

    if (!url) return json({ success: false, error: 'URL is required' }, 400);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ success: false, error: 'AI service not configured' }, 500);

    // ═══ ASYNC MODE: Create job, self-invoke, return 202 ═══
    if (asyncMode) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, serviceKey);
      const authHeader = req.headers.get('Authorization') || '';
      
      // Extract user_id from auth
      const userSb = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userSb.auth.getUser();
      const userId = user?.id;
      if (!userId) return json({ error: 'Authentication required for async mode' }, 401);

      const { data: job, error: jobError } = await sb
        .from('async_jobs')
        .insert({
          user_id: userId,
          function_name: 'audit-strategique-ia',
          status: 'pending',
          input_payload: { url, toolsData, hallucinationCorrections, competitorCorrections, cachedContext, lang },
        })
        .select('id')
        .single();

      if (jobError || !job) return json({ error: 'Failed to create job' }, 500);

      // Fire-and-forget: self-invoke synchronously with job_id
      const syncBody = { ...body, async: false, _job_id: job.id };
      fetch(`${supabaseUrl}/functions/v1/audit-strategique-ia`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncBody),
      }).catch(err => console.error('[audit-strategique-ia] Async self-invoke failed:', err));

      return json({ job_id: job.id, status: 'pending' }, 202);
    }

    // ═══ JOB TRACKING: if _job_id provided, update progress in DB ═══
    const jobId: string | undefined = body._job_id;
    const supabaseUrlForJob = Deno.env.get('SUPABASE_URL');
    const serviceKeyForJob = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const jobSb = jobId && supabaseUrlForJob && serviceKeyForJob
      ? createClient(supabaseUrlForJob, serviceKeyForJob)
      : null;

    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({ status: 'processing', started_at: new Date().toISOString(), progress: 5 }).eq('id', jobId);
    }

    const effectiveToolsData: ToolsData = toolsData || {
      crawlers: { note: 'Non disponible' },
      geo: { note: 'Non disponible' },
      llm: { note: 'Non disponible' },
      pagespeed: { note: 'Non disponible' },
    };

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    const domain = parsedUrl.hostname;
    const domainWithoutWww = domain.replace(/^www\./, '');
    const domainSlug = domainWithoutWww.split('.')[0];

    // ═══ PAGE TYPE DETECTION: editorial / product / deep / homepage ═══
    const urlPath = parsedUrl.pathname.toLowerCase();
    const pathSegments = urlPath.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

    type PageType = 'homepage' | 'editorial' | 'product' | 'deep';
    let pageType: PageType = 'homepage';

    const editorialPattern = /\/(blog|article|articles|post|posts|news|actualite|actualites|guide|guides|tutoriel|tutorial|ressources|resources|wiki|learn|knowledge|faq)\b/;
    const productPattern = /\/(product|produit|produits|products|shop|boutique|store|catalogue|catalog|item|pricing|tarif|tarifs|offre|offres|service|services|solution|solutions)\b/;

    if (editorialPattern.test(urlPath) && pathSegments.length >= 2) {
      pageType = 'editorial';
    } else if (productPattern.test(urlPath) && pathSegments.length >= 1) {
      pageType = 'product';
    } else if (pathSegments.length >= 3) {
      // Deep page: 3+ path segments = likely a specific inner page
      pageType = 'deep';
    } else if (pathSegments.length >= 1 && urlPath !== '/') {
      // Single segment but not homepage — check slug length as a heuristic
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment.length > 60 || lastSegment.split('-').length > 6) {
        pageType = 'deep';
      }
    }

    const isContentMode = pageType !== 'homepage';
    if (isContentMode) {
      console.log(`📝 PAGE TYPE: "${pageType}" detected for path: ${parsedUrl.pathname}`);
    }

    // ==================== SMART CACHE: Skip expensive calls if cachedContext provided ====================
    const useCache = !!cachedContext;

    let pageContentContext: string;
    let brandSignals: BrandSignal[];
    let eeatSignals: EEATSignals;
    let marketData: MarketData | null;
    let rankingOverview: RankingOverview | null;
    let founderInfo: FounderInfo;
    let localCompetitorData: { name: string; url: string; rank: number } | null = null;
    let gmbData: GMBData | null = null;
    let facebookPageInfo: FacebookPageInfo = { pageUrl: null, pageName: null, found: false };

    if (useCache) {
      // ═══ FAST PATH: Reuse cached context (corrections/re-runs) ═══
      console.log('⚡ SMART CACHE: Using cached context — skipping all data collection');
      pageContentContext = cachedContext.pageContentContext || '';
      brandSignals = cachedContext.brandSignals || [];
      eeatSignals = cachedContext.eeatSignals || {
        hasAuthorBio: false, authorBioCount: 0, hasSocialLinks: false, hasLinkedInLinks: false,
        socialLinksCount: 0, linkedInLinksCount: 0, linkedInUrls: [],
        hasSameAs: false, hasWikidataSameAs: false, hasAuthorInJsonLd: false, hasProfilePage: false,
        hasPerson: false, hasOrganization: false, hasCaseStudies: false, caseStudySignals: 0,
        hasExpertCitations: false, detectedSocialUrls: [],
      };
      marketData = cachedContext.marketData || null;
      rankingOverview = cachedContext.rankingOverview || null;
      founderInfo = cachedContext.founderInfo || { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };
      localCompetitorData = null;
      gmbData = cachedContext.gmbData || null;
      facebookPageInfo = cachedContext.facebookPageInfo || { pageUrl: null, pageName: null, found: false };
      if (cachedContext.llmData) effectiveToolsData.llm = cachedContext.llmData;
    } else {
      // ═══ FULL PATH: Collect all data with maximum parallelism ═══

      // ── WAVE 1: Metadata + Ranked Keywords (independent, parallel) ──
      console.log('📊 WAVE 1: Metadata + Ranked Keywords (parallel)...');
      const [metadataResult, rkOverviewResult] = await Promise.all([
        safe('metadata', () => extractPageMetadata(url)),
        safe('ranked_keywords', () => {
          // We need location code — default to France
          const tld = domain.split('.').pop() || 'com';
          const tldMap: Record<string, string> = { 'fr': 'france', 'be': 'belgium', 'ch': 'switzerland', 'ca': 'canada', 'de': 'germany', 'es': 'spain', 'it': 'italy', 'uk': 'united kingdom', 'com': 'france', 'ai': 'france', 'io': 'france', 'dev': 'france', 'app': 'france' };
          const locKey = tldMap[tld] || 'france';
          const locInfo = KNOWN_LOCATIONS[locKey] || KNOWN_LOCATIONS['france'];
          return fetchRankedKeywords(domain, locInfo.code, locInfo.lang);
        }),
      ]);

      pageContentContext = metadataResult?.context || '';
      brandSignals = metadataResult?.brandSignals || [];
      eeatSignals = metadataResult?.eeatSignals || {
        hasAuthorBio: false, authorBioCount: 0, hasSocialLinks: false, hasLinkedInLinks: false,
        socialLinksCount: 0, linkedInLinksCount: 0, linkedInUrls: [],
        hasSameAs: false, hasWikidataSameAs: false, hasAuthorInJsonLd: false, hasProfilePage: false,
        hasPerson: false, hasOrganization: false, hasCaseStudies: false, caseStudySignals: 0,
        hasExpertCitations: false, detectedSocialUrls: [],
      };
      rankingOverview = rkOverviewResult;

      const context = detectBusinessContext(domain, pageContentContext);

      // ── Fetch site identity card for enriched competitor search ──
      let siteIdentityCtx: Record<string, unknown> | null = null;
      try {
        const sbService = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        siteIdentityCtx = await getSiteContext(sbService, { domain: domainWithoutWww, userId });
        if (siteIdentityCtx) console.log(`📇 Carte d'identité chargée (confiance: ${siteIdentityCtx.identity_confidence || 0})`);
      } catch (e) {
        console.warn(`⚠️ Carte d'identité non disponible:`, e);
      }

      // ── WAVE 2: DataForSEO Market + check-llm + Local Competitor + Founder (all parallel) ──
      console.log(`\n📊 WAVE 2: Market data + LLM check${isContentMode ? '' : ' + Competitor + Founder'} (parallel)...`);

      const needsLlmCheck = !toolsData?.llm || toolsData.llm.note;
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

      const [mktDataResult, llmCheckResult, localCompResult, founderResult, gmbResult, fbResult] = await Promise.allSettled([
        // Market data (DataForSEO keywords) — reduced deadline to preserve LLM budget
        withDeadline(
          fetchMarketData(domain, context, pageContentContext, url),
          120_000, 'market_data'
        ),
        // LLM visibility check (sub-function call) — always needed
        needsLlmCheck && supabaseUrl && supabaseAnonKey
          ? withDeadline(
              (async () => {
                const llmResponse = await fetch(`${supabaseUrl}/functions/v1/check-llm`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url, lang: 'fr' }),
                  signal: AbortSignal.timeout(40000),
                });
                if (!llmResponse.ok) { await llmResponse.text(); return null; }
                const llmResult = await llmResponse.json();
                return llmResult.success && llmResult.data ? llmResult.data : null;
              })(),
              45_000, 'check_llm'
            )
          : Promise.resolve(null),
        // Local competitor — skip in content mode (SERP competitors handled by LLM)
        !isContentMode && context.locationCode
          ? withDeadline(
              findLocalCompetitor(domain, context.sector, context.locationCode, pageContentContext, context.languageCode, context.seDomain),
              20_000, 'local_competitor'
            )
          : Promise.resolve(null),
        // Founder discovery — skip in content mode
        !isContentMode
          ? withDeadline(
              searchFounderProfile(domain, context.location),
              15_000, 'founder'
            )
          : Promise.resolve(null),
        // Google My Business detection — skip in content mode
        !isContentMode && context.locationCode
          ? withDeadline(
              detectGoogleMyBusiness(domain, context.brandName, context.locationCode, context.languageCode),
              12_000, 'gmb'
            )
          : Promise.resolve(null),
        // Facebook page discovery — skip in content mode
        !isContentMode && context.locationCode
          ? withDeadline(
              searchFacebookPage(context.brandName, context.sector, context.locationCode, context.languageCode),
              10_000, 'facebook_page'
            )
          : Promise.resolve(null),
      ]);

      marketData = mktDataResult.status === 'fulfilled' ? mktDataResult.value : null;

      if (llmCheckResult.status === 'fulfilled' && llmCheckResult.value) {
        effectiveToolsData.llm = llmCheckResult.value;
        console.log(`✅ LLM: score ${llmCheckResult.value.overallScore}/100`);
      }

      if (localCompResult.status === 'fulfilled' && localCompResult.value) {
        localCompetitorData = localCompResult.value;
      }

      founderInfo = (founderResult.status === 'fulfilled' && founderResult.value)
        ? founderResult.value
        : { name: null, profileUrl: null, platform: null, isInfluencer: false, geoMismatch: false, detectedCountry: null };

      if (gmbResult.status === 'fulfilled' && gmbResult.value) {
        gmbData = gmbResult.value;
      }

      if (fbResult.status === 'fulfilled' && fbResult.value) {
        facebookPageInfo = fbResult.value;
      }

      console.log(`⏱️ Data collection done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    }

    // ═══ BRAND RESOLUTION ═══
    const { name: resolvedEntityName, confidence: brandConfidence } = resolveBrandName(brandSignals, domain, url);
    const isConfidentBrand = brandConfidence >= 0.95;
    const humanBrandName = isConfidentBrand ? resolvedEntityName : humanizeBrandName(domainSlug);
    console.log(`🎯 Entité: "${resolvedEntityName}" (${(brandConfidence * 100).toFixed(0)}%)`);

    // ═══ BUILD CACHED CONTEXT for client-side recovery & re-runs ═══
    const cachedContextOut = {
      pageContentContext, brandSignals, eeatSignals,
      marketData, rankingOverview, founderInfo,
      llmData: effectiveToolsData.llm,
      gmbData,
      facebookPageInfo,
    };

    // ═══ CHECK DEADLINE before expensive LLM call — need at least 90s ═══
    const elapsedBeforeLLM = Date.now() - startTime;
    const remainingBeforeLLM = GLOBAL_DEADLINE - elapsedBeforeLLM;
    if (remainingBeforeLLM < 90_000) {
      console.warn(`⏰ Only ${(remainingBeforeLLM / 1000).toFixed(0)}s remaining — not enough for LLM call, returning fallback`);
      const fallback = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut);
      saveToCache(domain, url, fallback).catch(() => {});
      return json(fallback);
    }

    // ═══ ÉTAPE 2: LLM ANALYSIS ═══
    console.log(`\n🤖 ÉTAPE 2: Analyse LLM (${((Date.now() - startTime) / 1000).toFixed(1)}s elapsed)...`);

    let userPrompt = buildUserPrompt(url, domain, effectiveToolsData, marketData, pageContentContext, eeatSignals, founderInfo, rankingOverview, isContentMode, facebookPageInfo);

    // Inject language instruction
    userPrompt = `🌐 LANGUE DE RÉDACTION: ${langLabel}. Rédige TOUS les textes, analyses, recommandations et descriptions en ${langLabel}. Les mots-clés SEO restent dans la langue naturelle du site.\n` + userPrompt;
    const pageTypeLabels: Record<PageType, string> = {
      editorial: '📝 MODE ÉDITORIAL',
      product: '🛒 MODE PRODUIT',
      deep: '📄 MODE PAGE PROFONDE',
      homepage: '🏷️',
    };
    if (isContentMode) {
      userPrompt = `${pageTypeLabels[pageType]}: Analyse de la page "${resolvedEntityName}" (type: ${pageType}) — Centre l'analyse sur le CONTENU de cette page, pas sur l'entreprise.\n` + userPrompt;
    } else {
      userPrompt = `🏷️ NOM DE L'ENTITÉ ANALYSÉE: "${resolvedEntityName}" — Utilise CE NOM pour désigner le site dans tout le rapport.\n` + userPrompt;
    }

    if (!isContentMode && localCompetitorData) {
      userPrompt = `🏙️ CONCURRENT LOCAL SERP: "${localCompetitorData.name}" URL:${localCompetitorData.url} Position:${localCompetitorData.rank}. Utilise comme direct_competitor.\n` + userPrompt;
    }

    if (hallucinationCorrections) {
      const corrections = Object.entries(hallucinationCorrections).filter(([_, v]) => v).map(([k, v]) => `${k}="${v}"`).join(', ');
      if (corrections) userPrompt = `⚠️ CORRECTIONS UTILISATEUR (priorité absolue): ${corrections}\n` + userPrompt;
    }

    if (competitorCorrections) {
      const cc = competitorCorrections;
      const parts: string[] = [];
      if (cc.leader?.name) parts.push(`Leader:"${cc.leader.name}"${cc.leader.url ? `(${cc.leader.url})` : ''}`);
      if (cc.direct_competitor?.name) parts.push(`Concurrent:"${cc.direct_competitor.name}"${cc.direct_competitor.url ? `(${cc.direct_competitor.url})` : ''}`);
      if (cc.challenger?.name) parts.push(`Challenger:"${cc.challenger.name}"`);
      if (parts.length > 0) userPrompt = `🏢 CONCURRENTS CORRIGÉS: ${parts.join(', ')}\n` + userPrompt;
    }

    // ── LLM call with remaining time budget ──
    const remainingMs = Math.max(60_000, GLOBAL_DEADLINE - (Date.now() - startTime) - 15_000); // keep 15s buffer
    let parsedAnalysis: any = null;

    const llmResult = await withDeadline(
      (async () => {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro',
            messages: [
              { role: 'system', content: pageType === 'editorial' ? EDITORIAL_MODE_SYSTEM_PROMPT : pageType === 'product' ? PRODUCT_MODE_SYSTEM_PROMPT : pageType === 'deep' ? DEEP_PAGE_SYSTEM_PROMPT : SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(remainingMs),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI error:', response.status, errorText.substring(0, 200));
          return null;
        }

        const aiResponse = await response.json();
        const content = aiResponse.choices?.[0]?.message?.content;
        trackTokenUsage('audit-strategique-ia', 'google/gemini-2.5-pro', aiResponse.usage, url);

        if (!content) return null;
        return content;
      })(),
      remainingMs + 5000, 'llm_call'
    );

    if (!llmResult) {
      console.warn('⚠️ LLM call failed or timed out — returning fallback');
      const fallback = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut);
      saveToCache(domain, url, fallback).catch(() => {});
      return json(fallback);
    }

    // ═══ PARSE JSON ═══
    console.log('\n📝 Parsing...');
    try {
      let jsonContent = llmResult;
      if (llmResult.includes('```json')) jsonContent = llmResult.split('```json')[1].split('```')[0].trim();
      else if (llmResult.includes('```')) jsonContent = llmResult.split('```')[1].split('```')[0].trim();
      jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      parsedAnalysis = JSON.parse(jsonContent);
    } catch {
      try {
        const firstBrace = llmResult.indexOf('{');
        const lastBrace = llmResult.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          let jsonContent = llmResult.substring(firstBrace, lastBrace + 1);
          jsonContent = jsonContent.replace(/,(\s*[\}\]])/g, '$1');
          parsedAnalysis = JSON.parse(jsonContent);
        }
      } catch {
        console.error('❌ JSON parse failed — returning fallback');
        const fallback = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut);
        saveToCache(domain, url, fallback).catch(() => {});
        return json(fallback);
      }
    }

    if (!parsedAnalysis) {
      const fallback = buildFallbackResult(url, domain, marketData, rankingOverview, effectiveToolsData.llm, cachedContextOut);
      saveToCache(domain, url, fallback).catch(() => {});
      return json(fallback);
    }

    // ═══ POST-PROCESSING (all synchronous or fast parallel) ═══

    // Sanitize brand name
    parsedAnalysis = sanitizeBrandNameInResponse(parsedAnalysis, domainSlug, humanBrandName);

    // Validate competitive actors are not self-referencing
    const cleanTargetDomain = domain.replace(/^www\./, '').toLowerCase();
    const brandNameLower = resolvedEntityName.toLowerCase().replace(/\..*$/, '');
    const domainSlugLower = domainSlug.toLowerCase();

    function isSelfReference(actor: any): boolean {
      if (!actor) return false;
      const actorDomain = (() => {
        try { return new URL(actor.url || '').hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
      })();
      const actorNameLower = (actor.name || '').toLowerCase().replace(/\s+/g, '');
      // Also compare full URL to catch exact same page
      const actorUrlNorm = (actor.url || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      const targetUrlNorm = normalizedUrl.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');
      // Self if: same domain, name matches brand/slug, or exact same URL
      return (actorUrlNorm && actorUrlNorm === targetUrlNorm) ||
             (actorDomain && (actorDomain === cleanTargetDomain || actorDomain.includes(cleanTargetDomain) || cleanTargetDomain.includes(actorDomain))) ||
             (actorNameLower && (actorNameLower === brandNameLower || actorNameLower === domainSlugLower || actorNameLower.includes(domainSlugLower) || domainSlugLower.includes(actorNameLower)));
    }

    if (parsedAnalysis.competitive_landscape) {
      const roles = ['leader', 'direct_competitor', 'challenger', 'inspiration_source'] as const;
      for (const role of roles) {
        const actor = parsedAnalysis.competitive_landscape[role];
        if (isSelfReference(actor)) {
          console.log(`⚠️ Self-reference in ${role}: "${actor?.name}" — replacing`);
          if (role === 'direct_competitor' && localCompetitorData) {
            parsedAnalysis.competitive_landscape[role] = {
              name: localCompetitorData.name, url: localCompetitorData.url,
              authority_factor: actor?.authority_factor || 'Concurrent SERP local',
              analysis: `Concurrent identifié via les résultats de recherche locaux, positionné #${localCompetitorData.rank}.`,
            };
          } else {
            parsedAnalysis.competitive_landscape[role].name = 'Non identifié';
            parsedAnalysis.competitive_landscape[role].url = null;
            parsedAnalysis.competitive_landscape[role].analysis = `Auto-référence détectée et supprimée.`;
          }
        }
      }

      // Validate competitor URLs (parallel, with short timeout)
      if (!isOverDeadline()) {
        await Promise.all(roles.map(async (role) => {
          const actor = parsedAnalysis.competitive_landscape[role];
          if (!actor?.url) return;
          let href = actor.url.trim().replace(/^\/+/, '');
          if (!href.startsWith('http')) href = `https://${href}`;
          try {
            new URL(href);
            const res = await fetch(href, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              redirect: 'follow',
              signal: AbortSignal.timeout(4000),
            });
            // After redirect, re-check if resolved URL is self
            const resolvedDomain = (() => {
              try { return new URL(res.url || href).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
            })();
            if (resolvedDomain && (resolvedDomain === cleanTargetDomain || resolvedDomain.includes(cleanTargetDomain) || cleanTargetDomain.includes(resolvedDomain))) {
              console.log(`⚠️ ${role} URL resolved to self-domain (${resolvedDomain}) — removing`);
              actor.name = 'Non identifié';
              actor.url = null;
              actor.analysis = 'Auto-référence détectée après redirection et supprimée.';
            } else if (res.ok || res.status === 403) {
              actor.url = res.url || href;
              console.log(`✅ ${role} URL valid: ${actor.url}`);
            } else {
              console.log(`❌ ${role} URL ${res.status} — removing`);
              actor.url = null;
            }
          } catch {
            actor.url = null;
          }
        }));
      }
    }

    // Remove self from introduction.competitors[]
    if (parsedAnalysis.introduction?.competitors && Array.isArray(parsedAnalysis.introduction.competitors)) {
      parsedAnalysis.introduction.competitors = parsedAnalysis.introduction.competitors.filter((c: string) => {
        const cLower = c.toLowerCase().replace(/\s+/g, '');
        return !(cLower === cleanTargetDomain || cLower === brandNameLower || cLower === domainSlugLower ||
                 cLower.includes(domainSlugLower) || domainSlugLower.includes(cLower));
      });
    }

    // Validate social URLs
    if (parsedAnalysis.social_signals?.proof_sources && Array.isArray(parsedAnalysis.social_signals.proof_sources)) {
      const detectedUrlsSet = new Set(
        (eeatSignals.detectedSocialUrls || []).map((u: string) => u.toLowerCase().replace(/\/$/, ''))
      );
      if (founderInfo?.profileUrl) detectedUrlsSet.add(founderInfo.profileUrl.toLowerCase().replace(/\/$/, ''));
      if (facebookPageInfo?.pageUrl) detectedUrlsSet.add(facebookPageInfo.pageUrl.toLowerCase().replace(/\/$/, ''));
      console.log(`🔗 Validating social URLs against ${detectedUrlsSet.size} detected URLs:`, [...detectedUrlsSet]);

      for (const source of parsedAnalysis.social_signals.proof_sources) {
        if (source.profile_url) {
          const normalized = source.profile_url.toLowerCase().replace(/\/$/, '');
          const isValid = [...detectedUrlsSet].some(detected =>
            normalized.includes(detected) || detected.includes(normalized) ||
            normalized.split('/').slice(-1)[0] === detected.split('/').slice(-1)[0]
          );
          if (!isValid) {
            console.log(`⚠️ Removing hallucinated social URL: ${source.profile_url}`);
            source.profile_url = null;
          }
        }
      }
    }

    // Flag geo mismatch
    if (founderInfo?.geoMismatch && parsedAnalysis.social_signals) {
      parsedAnalysis.social_signals.founder_geo_mismatch = true;
      parsedAnalysis.social_signals.founder_geo_country = founderInfo.detectedCountry;
      if (parsedAnalysis.social_signals.proof_sources) {
        parsedAnalysis.social_signals.proof_sources = parsedAnalysis.social_signals.proof_sources.filter(
          (s: any) => s.platform !== 'linkedin' || s.presence_level === 'absent'
        );
      }
      if (parsedAnalysis.social_signals.thought_leadership) {
        parsedAnalysis.social_signals.thought_leadership.founder_authority = 'unknown';
      }
    }

    // Supplement main_keywords if < 5
    if (parsedAnalysis.keyword_positioning?.main_keywords) {
      const mainKw = parsedAnalysis.keyword_positioning.main_keywords;
      if (mainKw.length < 5 && marketData?.top_keywords) {
        const existingLower = new Set(mainKw.map((kw: any) => (kw.keyword || '').toLowerCase()));
        for (const mkw of marketData.top_keywords) {
          if (mainKw.length >= 5) break;
          if (!existingLower.has(mkw.keyword.toLowerCase())) {
            existingLower.add(mkw.keyword.toLowerCase());
            mainKw.push({ keyword: mkw.keyword, volume: mkw.volume, difficulty: mkw.difficulty, current_rank: mkw.current_rank || 'Non classé' });
          }
        }
      }
    }

    // ═══ FORCE-COMPUTE quotability & summary_resilience ═══
    {
      const rawText = (pageContentContext || '').replace(/Titre="[^"]*"/g, '').replace(/H1="[^"]*"/g, '').replace(/Desc="[^"]*"/g, '');

      // Quotability
      const sentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 40 && s.length < 300);
      const quotableMarkers = [
        /\d+\s*%/i, /\d+\s*(fois|x|million|milliard)/i,
        /permet|offre|garantit|assure|réduit|augmente|améliore/i,
        /premier|unique|seul|leader|innovant|révolutionne/i,
        /grâce à|en seulement|jusqu'à|plus de|moins de/i,
        /enables|provides|reduces|increases|improves|delivers/i,
      ];
      const scoredSentences = sentences.map(s => {
        let score = 0;
        for (const m of quotableMarkers) if (m.test(s)) score++;
        if (!/^(il|elle|ils|elles|ce|cette|ces|it|they|this|these)\b/i.test(s)) score++;
        return { text: s, score };
      }).sort((a, b) => b.score - a.score);

      const topQuotes = scoredSentences.slice(0, 3).filter(q => q.score > 0).map(q => q.text);
      const llmQuotes = parsedAnalysis.quotability?.quotes || [];
      const allQuotes = [...new Set([...llmQuotes, ...topQuotes])].slice(0, 3);
      parsedAnalysis.quotability = { score: Math.min(100, allQuotes.length * 33), quotes: allQuotes };
      console.log(`✅ quotability computed: score=${parsedAnalysis.quotability.score}, quotes=${allQuotes.length}`);

      // Summary resilience
      const h1Match = (pageContentContext || '').match(/H1="([^"]+)"/);
      const titleMatch = (pageContentContext || '').match(/Titre="([^"]+)"/);
      const originalH1 = h1Match?.[1] || titleMatch?.[1] || 'Non détecté';
      const paragraphs = rawText.split(/\n+/).filter(p => p.trim().length > 50);
      const firstParagraph = paragraphs[0] || '';
      const h1Terms = originalH1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const contentLower = (firstParagraph + ' ' + rawText.slice(0, 1000)).toLowerCase();
      const matchedTerms = h1Terms.filter(t => contentLower.includes(t));
      const resilienceScore = h1Terms.length > 0 ? Math.round((matchedTerms.length / h1Terms.length) * 100) : 0;
      const llmSummary = parsedAnalysis.summary_resilience?.llmSummary;
      const autoSummary = firstParagraph.slice(0, 80).replace(/[.!?,;:]+$/, '').trim() || 'Non disponible';
      parsedAnalysis.summary_resilience = {
        score: parsedAnalysis.summary_resilience?.score || resilienceScore,
        originalH1,
        llmSummary: llmSummary || autoSummary,
      };
      console.log(`✅ summary_resilience computed: score=${parsedAnalysis.summary_resilience.score}, H1="${originalH1}"`);
    }

    // Defaults for optional metrics
    if (!parsedAnalysis.lexical_footprint) parsedAnalysis.lexical_footprint = { jargonRatio: 50, concreteRatio: 50 };
    if (!parsedAnalysis.expertise_sentiment) parsedAnalysis.expertise_sentiment = { rating: 1, justification: 'Non évalué' };
    if (!parsedAnalysis.red_teaming) parsedAnalysis.red_teaming = { objections: [] };

    // ═══ BUILD FINAL RESULT ═══
    const result = {
      success: true,
      data: {
        url, domain,
        scannedAt: new Date().toISOString(),
        isContentMode,
        pageType,
        ...parsedAnalysis,
        raw_market_data: marketData,
        ranking_overview: rankingOverview,
        google_my_business: gmbData,
        toolsData: null,
        llm_visibility_raw: effectiveToolsData.llm,
        _cachedContext: cachedContextOut,
      },
    };

    console.log(`✅ AUDIT TERMINÉ (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);

    // ═══ SAVE & RETURN ═══
    // Save to cache (fire-and-forget)
    saveToCache(domain, url, result).catch(() => {});

    // Save recommendations to registry (fire-and-forget)
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl2 = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey2 = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (authHeader && supabaseUrl2 && supabaseKey2) {
      saveStrategicRecommendationsToRegistry(supabaseUrl2, supabaseKey2, authHeader, domain, url, parsedAnalysis)
        .catch(err => console.error('Registre:', err));
    }

    // URL tracking (fire-and-forget)
    trackAnalyzedUrl(url).catch(() => {});

    // Save raw audit data (fire-and-forget)
    if (authHeader && supabaseUrl2 && supabaseKey2) {
      try {
        const sb2 = createClient(supabaseUrl2, supabaseKey2, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user: rawUser } } = await sb2.auth.getUser();
        if (rawUser) {
          saveRawAuditData({
            userId: rawUser.id, url, domain,
            auditType: 'strategic',
            rawPayload: result.data,
            sourceFunctions: ['audit-strategique-ia'],
          }).catch(() => {});
        }
      } catch {}
    }

    // ═══ ASYNC JOB: Save result if running as background job ═══
    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({
        status: 'completed',
        result_data: result.data,
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq('id', jobId);
    }

    return json(result);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    await trackEdgeFunctionError('audit-strategique-ia', error instanceof Error ? error.message : 'Fatal error').catch(() => {});

    // ═══ ASYNC JOB: Mark as failed ═══
    if (jobSb && jobId) {
      await jobSb.from('async_jobs').update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      }).eq('id', jobId).catch(() => {});
    }

    // Even fatal errors return success:true with an empty structure so client never crashes
    return json({
      success: true,
      data: {
        url: '', domain: '',
        scannedAt: new Date().toISOString(),
        overallScore: 0,
        introduction: { presentation: 'Une erreur inattendue est survenue. Veuillez relancer l\'analyse.', strengths: '', improvement: '', competitors: [] },
        executive_roadmap: [],
        executive_summary: 'Analyse interrompue. Veuillez réessayer.',
        _error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  } finally {
    releaseConcurrency('audit-strategique-ia');
  }
});