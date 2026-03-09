import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { trackTokenUsage, trackPaidApiCall } from '../_shared/tokenTracker.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
const KNOWN_LOCATIONS: Record<string, { code: number; name: string }> = {
  'france': { code: 2250, name: 'France' },
  'belgium': { code: 2056, name: 'Belgium' },
  'switzerland': { code: 2756, name: 'Switzerland' },
  'canada': { code: 2124, name: 'Canada' },
  'luxembourg': { code: 2442, name: 'Luxembourg' },
  'germany': { code: 2276, name: 'Germany' },
  'spain': { code: 2724, name: 'Spain' },
  'italy': { code: 2380, name: 'Italy' },
  'united kingdom': { code: 2826, name: 'United Kingdom' },
  'united states': { code: 2840, name: 'United States' },
};

/**
 * Extracts the REAL core business description from page metadata.
 * This is THE most important variable: what does this company actually do?
 */
function extractCoreBusiness(pageContentContext: string): string {
  if (!pageContentContext) return '';
  
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  
  const texts = [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
  if (texts.length === 0) return '';
  
  const stopWords = new Set([
    'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
    'il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou',
    'plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes',
    'si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore',
    'tout','tous','même','autre','autres','chaque','quelque',
    'gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https',
    'the','and','for','with','your','our','from','that','this','are','was','will','can','has','have',
    'bienvenue','welcome','home','officiel','official',
  ]);
  
  // Extract meaningful bigrams from ALL text sources (best for business intent)
  const bigrams: string[] = [];
  const allWords: string[] = [];
  for (const text of texts) {
    const cleaned = text.toLowerCase()
      .replace(/[|–—·:,\.!?]/g, ' ')
      .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const words = cleaned.split(' ').filter(w => w.length > 1 && !stopWords.has(w));
    allWords.push(...words);
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]} ${words[i + 1]}`);
    }
  }
  
  // The core business = unique meaningful words combined
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
  
  console.log(`📋 Contexte: marque="${brandName}", secteur="${sector}", location="${locationInfo.name}" (code: ${locationInfo.code})`);
  
  return { sector, location: locationInfo.name, brandName, locationCode: locationInfo.code };
}

function extractKeywordsFromMetadata(pageContentContext: string, domain: string = ''): string[] {
  const extracted: string[] = [];
  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  
  const texts = [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
  
  const stopWords = new Set(['le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux','il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou','plus','vous','votre','vos','nous','notre','nos','leur','leurs','mon','ma','mes','ton','ta','tes','si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore','tout','tous','même','autre','autres','quel','quelle','quels','quelles','chaque','quelque','certains','plusieurs','aucun','tel','telle','tels','telles','gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https','calcul','calculer','outil','service','solution','application','app','logiciel','plateforme']);
  
  // Build a set of domain-derived slugs to filter out (e.g. "limova", "limovaai")
  const domainSlugs = new Set<string>();
  if (domain) {
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    const parts = cleanDomain.split('.');
    for (const part of parts) {
      if (part.length > 2) domainSlugs.add(part);
    }
    domainSlugs.add(cleanDomain.replace(/\./g, ''));
    if (parts.length > 0) domainSlugs.add(parts[0]);
  }
  
  for (const text of texts) {
    const cleaned = text.toLowerCase()
      .replace(/[|–—·:]/g, ' ')
      .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const words = cleaned.split(' ').filter(w => 
      w.length > 2 && !stopWords.has(w) && !domainSlugs.has(w)
    );
    
    // Prioritize bigrams and trigrams (market-intent phrases)
    for (let i = 0; i < words.length - 2; i++) {
      extracted.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
    for (let i = 0; i < words.length - 1; i++) {
      extracted.push(`${words[i]} ${words[i + 1]}`);
    }
    // Individual words only if long enough to be meaningful
    for (const word of words) {
      if (word.length >= 5) extracted.push(word);
    }
  }
  
  return [...new Set(extracted)].slice(0, 12);
}

function generateSeedKeywords(brandName: string, sector: string, pageContentContext: string = '', domain: string = ''): string[] {
  const keywords: string[] = [];
  
  // CRITICAL: Extract the core business phrase and ensure it's the TOP seed keyword
  if (pageContentContext) {
    const coreBusiness = extractCoreBusiness(pageContentContext);
    // Extract the most meaningful bigram as the core business keyword
    const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
    const h1Match = pageContentContext.match(/H1="([^"?]+)/);
    const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
    const texts = [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
    
    // Find the best core-business bigram (the "what we do" phrase)
    const businessStopWords = new Set(['le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux','il','elle','ce','cette','qui','que','son','sa','ses','se','ne','pas','avec','dans','ou','plus','vous','votre','vos','nous','notre','nos','leur','leurs','si','mais','car','donc','ni','comme','entre','chez','vers','très','aussi','bien','encore','tout','tous','même','autre','autres','gratuit','gratuite','meilleur','meilleure','site','web','page','accueil','www','http','https','bienvenue','welcome','home','officiel','official','the','and','for','with','your','our','from','that','this','are','was','will','can','has','have']);
    
    // Build domain slugs to exclude
    const domainSlugs = new Set<string>();
    if (domain) {
      const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
      for (const part of cleanDomain.split('.')) {
        if (part.length > 2) domainSlugs.add(part);
      }
    }
    
    const coreBigrams: string[] = [];
    for (const text of texts) {
      const cleaned = text.toLowerCase()
        .replace(/[|–—·:,\.!?]/g, ' ')
        .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const words = cleaned.split(' ').filter(w => w.length > 1 && !businessStopWords.has(w) && !domainSlugs.has(w));
      for (let i = 0; i < words.length - 1; i++) {
        coreBigrams.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    
    // Add core bigrams FIRST (these are the "what we do" phrases)
    for (const bg of coreBigrams.slice(0, 3)) {
      if (bg.length > 4 && !keywords.includes(bg)) {
        keywords.push(bg);
      }
    }
    
    // Then add remaining metadata keywords
    const metaKeywords = extractKeywordsFromMetadata(pageContentContext, domain);
    for (const mk of metaKeywords) {
      if (mk.length > 4 && !keywords.includes(mk)) {
        keywords.push(mk);
      }
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
  seedKeywords: string[], locationCode: number
): Promise<{ keyword: string; volume: number; difficulty: number }[]> {
  console.log(`📊 Récupération mots-clés pour location: ${locationCode}`);
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
        location_code: locationCode, language_code: 'fr',
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
          keywords: seedKeywords, location_code: locationCode, language_code: 'fr',
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
        .filter(w => w.length >= 4)
        .slice(0, 5);
      
      if (singleWords.length > 0) {
        const broadResponse = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keywords: singleWords,
            location_code: locationCode, language_code: 'fr',
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
  domain: string, locationCode: number
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
      keyword: kw.keyword, location_code: locationCode, language_code: 'fr',
      depth: 50, se_domain: 'google.fr',
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
  domain: string, sector: string, locationCode: number, pageContentContext: string
): Promise<{ name: string; url: string; rank: number } | null> {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) return null;

  let city = '';
  if (pageContentContext) {
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

  // Use first 2-3 meaningful words from sector for a focused SERP query
  const sectorWords = sector.split(' ').filter(w => w.length > 2).slice(0, 3).join(' ');
  const localQuery = city ? `${sectorWords} ${city}` : sectorWords;
  console.log(`🏙️ Recherche concurrent local: "${localQuery}"`);

  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: { 'Authorization': getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        keyword: localQuery, location_code: locationCode, language_code: 'fr',
        depth: 20, se_domain: 'google.fr',
      }]),
    });

    if (!response.ok) {
      await response.text();
      return null;
    }
    trackPaidApiCall('audit-strategique-ia', 'dataforseo', 'serp/organic/local');

    const data = await response.json();
    const items = data.tasks?.[0]?.result?.[0]?.items;
    if (!items || !Array.isArray(items)) return null;

    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    const organicResults = items.filter((item: any) => item.type === 'organic' && item.domain && item.url);
    
    // A valid competitor must: (1) not be the target, (2) not be a media/directory/aggregator
    const isValidCompetitor = (item: any) => {
      const d = item.domain.toLowerCase().replace(/^www\./, '');
      if (d.includes(cleanDomain) || cleanDomain.includes(d)) return false; // self
      if (isNonCompetitorDomain(d)) return false; // media/directory
      return true;
    };

    const targetIdx = organicResults.findIndex((item: any) => {
      const d = item.domain.toLowerCase().replace(/^www\./, '');
      return d.includes(cleanDomain) || cleanDomain.includes(d);
    });

    let competitor: any = null;

    if (targetIdx === -1) {
      // Target not found in SERP — take first valid competitor
      competitor = organicResults.find(isValidCompetitor);
    } else if (targetIdx === 0) {
      // Target is #1 — take next valid competitor
      competitor = organicResults.find((item: any, idx: number) => idx > targetIdx && isValidCompetitor(item));
    } else {
      // Target is ranked — find closest valid competitor above
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (isValidCompetitor(organicResults[i])) { competitor = organicResults[i]; break; }
      }
      // Fallback: closest below
      if (!competitor) {
        for (let i = targetIdx + 1; i < organicResults.length; i++) {
          if (isValidCompetitor(organicResults[i])) { competitor = organicResults[i]; break; }
        }
      }
    }

    if (competitor) {
      const result = {
        name: competitor.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || competitor.domain,
        url: competitor.url,
        rank: competitor.rank_absolute || competitor.rank_group || 0,
      };
      console.log(`✅ Concurrent local: "${result.name}" position ${result.rank} (domain: ${competitor.domain})`);
      return result;
    }
    console.log('⚠️ Aucun concurrent valide trouvé dans les SERPs');
    return null;
  } catch (error) {
    console.error('❌ Erreur concurrent local:', error);
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

  const stopWords = new Set([
    'le','la','les','de','des','du','un','une','et','est','en','pour','par','sur','au','aux',
    'avec','dans','ou','plus','vous','votre','nos','notre','nous','si','mais','car',
    'the','and','for','with','your','our','from','that','this',
  ]);

  const titleMatch = pageContentContext.match(/Titre="([^"?]+)/);
  const h1Match = pageContentContext.match(/H1="([^"?]+)/);
  const descMatch = pageContentContext.match(/Desc="([^"?]+)/);
  const texts = [titleMatch?.[1], h1Match?.[1], descMatch?.[1]].filter(Boolean) as string[];
  
  const coreTerms: string[] = [];
  for (const text of texts) {
    const words = text.toLowerCase()
      .replace(/[|–—·:,\.!?]/g, ' ')
      .replace(/[^\wàâäéèêëïîôùûüÿçœæ\s'-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    coreTerms.push(...words);
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
    let keywordData = await fetchKeywordData(seedKeywords, context.locationCode);
    
    // ═══ PHASE 3: Validation Loop (retry once if poor quality) ═══
    if (!checkDataQuality(keywordData) && aiSeeds.length > 0) {
      console.log('🔄 Data quality check failed — retrying with refined seeds...');
      const avgVol = keywordData.length > 0 
        ? (keywordData.reduce((s, k) => s + k.volume, 0) / keywordData.length).toFixed(0)
        : '0';
      const feedback = `Volume moyen: ${avgVol}. Seulement ${keywordData.length} résultats. Utilise des expressions plus populaires et mainstream.`;
      
      const refinedSeeds = await generateSeedsWithAI(effectiveUrl, pageContentContext, context.brandName, 'initial', feedback);
      
      if (refinedSeeds.length >= 5) {
        const refinedData = await fetchKeywordData(refinedSeeds, context.locationCode);
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
    const rankedKeywords = await checkRankings(keywordData, domain, context.locationCode);
    
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

async function fetchRankedKeywords(domain: string, locationCode: number): Promise<RankingOverview | null> {
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
        language_code: 'fr',
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

// ==================== FOUNDER DISCOVERY VIA SERP ====================

interface FounderInfo {
  name: string | null;
  profileUrl: string | null;
  platform: string | null;
  isInfluencer: boolean;
}

async function searchFounderProfile(domain: string): Promise<FounderInfo> {
  const result: FounderInfo = { name: null, profileUrl: null, platform: null, isInfluencer: false };
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
          body: JSON.stringify([{ keyword: q, location_code: 2250, language_code: 'fr', depth: 5 }]),
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { await resp.text(); return null; }
        const data = await resp.json();
        const items = data.tasks?.[0]?.result?.[0]?.items || [];
        const organic = items.find((i: any) => i.type === 'organic' && i.url);
        if (organic) {
          let name = organic.title?.split(/\s*[-–|]\s*/)?.[0]?.trim() || null;
          if (name) name = name.replace(/\s*\(.*\)/, '').replace(/\s*@.*/, '').trim();
          return { name, url: organic.url, platform, title: organic.title };
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
    
    console.log(`👤 Founder found: ${result.name} on ${result.platform} → ${result.profileUrl}`);
    if (results.length >= 2) {
      console.log(`👤 Multi-platform: ${results.map(r => r!.platform).join(', ')}`);
    }
    
    return result;
  } catch (error) {
    console.error('👤 Founder search error:', error);
    return result;
  }
}

// ==================== LLM PROMPT (compact) ====================

const SYSTEM_PROMPT = `RÔLE: Senior Digital Strategist spécialisé Brand Authority & GEO. Rapport premium niveau cabinet de conseil.

POSTURE: Analytique, souverain, prescriptif. Jargon expert (Entité sémantique, Topical Authority, E-E-A-T, Gap de citabilité). Recommandations NARRATIVES: chaque action = paragraphe rédigé 4-5 phrases.

RÈGLE ABSOLUE ANTI-AUTO-CITATION: Le site analysé ne doit JAMAIS apparaître comme son propre concurrent (leader, direct_competitor, challenger, inspiration_source). Ne cite JAMAIS le domaine analysé ni son nom de marque dans competitive_landscape ni dans introduction.competitors[]. Tous les acteurs doivent être des entités DISTINCTES du site audité.

RÈGLE CONCURRENT DIRECT: Le direct_competitor DOIT être un vrai concurrent produit/service avec le MÊME core business ou une feature proche. INTERDIT: médias (Forbes, Le Monde...), annuaires (Capterra, G2...), marketplaces (Amazon...), réseaux sociaux, Wikipedia. Le concurrent direct doit être une entreprise qui vend un produit/service similaire au site analysé, dans la même zone géographique si local.

RÈGLE SOURCE D'INSPIRATION: L'inspiration_source DOIT avoir le même core business que le site cible OU être un nouvel entrant novateur et reconnu sur un business directement lié. C'est une entreprise innovante qui repousse les standards du secteur. INTERDIT: médias, annuaires, marketplaces, réseaux sociaux, Wikipedia, plateformes généralistes. Exemples: pour un outil IA SEO → Claude Code, OpenClaw, Cursor ; pour un e-commerce bio → La Fourche, Kazidomi. L'inspiration doit être un acteur admiré du même écosystème métier.

RÈGLE MOTS-CLÉS STRATÉGIQUES: La liste de mots-clés DOIT OBLIGATOIREMENT contenir au moins une requête directement liée au core business du site. Ex: pour un agent IA → "agent IA", "agent IA entreprise", "automatisation IA TPE" ; pour un plombier → "plombier Paris", "dépannage plomberie". Si aucun mot-clé core business n'apparaît dans les données DataForSEO, AJOUTE-LE manuellement avec volume estimé et rank "non classé".

DONNÉES DE MARCHÉ RÉELLES (DataForSEO): Utilise les volumes, difficultés et positions RÉELS. Identifie Quick Wins (position 11-20, volume>100), Contenus manquants (non classé, volume>200).

13 MODULES D'ANALYSE:
A. ÉCOSYSTÈME: 1.Market Leader 2.Concurrent Direct 3.Challenger 4.Source d'Inspiration
B. AUTORITÉ SOCIALE: 5.Preuve Sociale (Reddit,X,LinkedIn) 6.Thought Leadership E-E-A-T 7.Sentiment & Polarité
C. EXPERTISE: 8.Score GEO Citabilité 9.Matrice Gap Sémantique 10.Psychologie Conversion
D. MOTS CLÉS: 11.5 Principaux avec volumes réels 12.Opportunités 13.Gaps Concurrentiels
E. TECHNIQUE: 14.Accessibilité Bots IA 15.Performance 16.Cohérence Sémantique
F. FRAÎCHEUR & IA: 17.Fraîcheur contenus 18.Complexité Schema.org 19.Formats IA-Ready 20.First-Party Data 21.Changelog Marque
G. E-E-A-T: 22.Signaux E-E-A-T 23.Densité données 24.Knowledge Graph 25.Études de cas
H. MONITORING: 26.Monitoring LLM (GA4 referrers IA) 27.Fichier llms.txt`;

function buildUserPrompt(url: string, domain: string, toolsData: ToolsData, marketData: MarketData | null, pageContentContext: string = '', eeatSignals?: EEATSignals, founderInfo?: FounderInfo): string {
  let marketSection = '';
  
  if (marketData) {
    const kwList = marketData.top_keywords.map(kw => 
      `"${kw.keyword}":${kw.volume}vol,diff${kw.difficulty},pos:${kw.current_rank}`
    ).join('; ');
    
    const quickWins = marketData.top_keywords.filter(kw => 
      typeof kw.current_rank === 'number' && kw.current_rank >= 11 && kw.current_rank <= 20 && kw.volume > 100
    );
    const missing = marketData.top_keywords.filter(kw => !kw.is_ranked && kw.volume > 200);
    
    marketSection = `
📊 DONNÉES MARCHÉ (DataForSEO) - Zone: ${marketData.location_used}, Volume total: ${marketData.total_market_volume}
Mots-clés: ${kwList}
Quick Wins: ${quickWins.length > 0 ? quickWins.map(kw => `"${kw.keyword}" pos${kw.current_rank}(${kw.volume}vol)`).join(', ') : 'Aucun'}
Manquants: ${missing.length > 0 ? missing.map(kw => `"${kw.keyword}"(${kw.volume}vol)`).join(', ') : 'Aucun'}
`;
  } else {
    marketSection = `⚠️ DataForSEO non disponible - base-toi sur ton analyse du secteur.\n`;
  }

  // Build E-E-A-T evidence section from crawled HTML signals
  let eeatSection = '';
  if (eeatSignals) {
    const lines: string[] = ['🔍 SIGNAUX E-E-A-T DÉTECTÉS SUR LE SITE (données factuelles du crawler):'];
    lines.push(`- Bios auteur détectées dans le HTML: ${eeatSignals.hasAuthorBio ? `OUI (${eeatSignals.authorBioCount} occurrences)` : 'NON'}`);
    lines.push(`- Author déclaré en JSON-LD: ${eeatSignals.hasAuthorInJsonLd ? 'OUI' : 'NON'}`);
    lines.push(`- Entité Person en JSON-LD: ${eeatSignals.hasPerson ? 'OUI' : 'NON'}`);
    lines.push(`- ProfilePage en JSON-LD: ${eeatSignals.hasProfilePage ? 'OUI' : 'NON'}`);
    lines.push(`- Organization en JSON-LD: ${eeatSignals.hasOrganization ? 'OUI' : 'NON'}`);
    lines.push(`- sameAs (liens entités externes): ${eeatSignals.hasSameAs ? 'OUI' : 'NON'}`);
    lines.push(`- sameAs vers Wikidata: ${eeatSignals.hasWikidataSameAs ? 'OUI ← signal fort d\'autorité institutionnelle' : 'NON'}`);
    lines.push(`- Liens sociaux détectés dans le HTML: ${eeatSignals.socialLinksCount} lien(s)`);
    if (eeatSignals.detectedSocialUrls.length > 0) {
      lines.push(`  URLs sociales trouvées: ${eeatSignals.detectedSocialUrls.slice(0, 10).join(', ')}`);
      // Distinguish personal LinkedIn profiles from company pages
      const personalLI = eeatSignals.linkedInUrls.filter(u => /linkedin\.com\/in\//i.test(u));
      const companyLI = eeatSignals.linkedInUrls.filter(u => /linkedin\.com\/company\//i.test(u));
      if (personalLI.length > 0) lines.push(`  └─ Profils LinkedIn PERSONNELS (incarnation humaine): ${personalLI.join(', ')}`);
      if (companyLI.length > 0) lines.push(`  └─ Pages LinkedIn ENTREPRISE (entité de marque): ${companyLI.join(', ')}`);
    }
    lines.push(`- Citations d'experts / blockquotes: ${eeatSignals.hasExpertCitations ? 'OUI' : 'NON'}`);
    lines.push(`- Études de cas / témoignages: ${eeatSignals.hasCaseStudies ? `OUI (${eeatSignals.caseStudySignals} signaux)` : 'NON'}`);
    eeatSection = lines.join('\n');
  }

  // Inject founder info from SERP discovery
  let founderSection = '';
  if (founderInfo?.name) {
    founderSection = `\n👤 FONDATEUR/DIRIGEANT IDENTIFIÉ (via recherche SERP — donnée vérifiée):
- Nom: ${founderInfo.name}
- Plateforme principale: ${founderInfo.platform || 'inconnue'}
- URL profil vérifié: ${founderInfo.profileUrl || 'non trouvé'}
- Présence sociale: ${founderInfo.isInfluencer ? 'OUI — actif sur les réseaux' : 'NON — pas de présence sociale notable'}
INSTRUCTION: Cite "${founderInfo.name}" nommément dans thought_leadership.analysis et si pertinent dans l'introduction.${founderInfo.profileUrl ? ` Utilise EXACTEMENT cette URL: ${founderInfo.profileUrl} comme profile_url dans le proof_source correspondant à la plateforme "${founderInfo.platform}".` : ' Ce dirigeant n\'a pas de profil social influent — mentionne-le dans l\'analyse SANS profile_url.'}`;
  }

  // Compact JSON serialization (no pretty-print to save memory)
  return `Analyse du site "${url}" (domaine: ${domain}).
${pageContentContext}
${pageContentContext}
${eeatSection}${founderSection}
${marketSection}
CRAWLERS:${JSON.stringify(toolsData.crawlers)}
GEO:${JSON.stringify(toolsData.geo)}
LLM:${JSON.stringify(toolsData.llm)}
PAGESPEED:${JSON.stringify(toolsData.pagespeed)}

GÉNÈRE UN JSON avec cette structure:
{"introduction":{"presentation":"4-5 phrases","strengths":"4-5 phrases","improvement":"4-5 phrases","competitors":["Leader","Concurrent","Challenger"]},
"brand_authority":{"dna_analysis":"...","thought_leadership_score":0-100,"entity_strength":"dominant|established|emerging|unknown"},
"social_signals":{"proof_sources":[{"platform":"reddit|x|linkedin|youtube|instagram","presence_level":"strong|moderate|weak|absent","analysis":"...","profile_url":"URL COMPLÈTE du profil social détecté (ex: https://linkedin.com/in/..., https://x.com/..., https://instagram.com/...) ou null si inconnu","profile_name":"Nom du profil/personne identifié ou null"}],"thought_leadership":{"founder_authority":"high|moderate|low|unknown","entity_recognition":"...","eeat_score":0-10,"analysis":"..."},"sentiment":{"overall_polarity":"positive|mostly_positive|neutral|mixed|negative","hallucination_risk":"low|medium|high","reputation_vibration":"..."}},
"market_intelligence":{"sophistication":{"level":1-5,"description":"...","emotional_levers":["1","2","3"]},"semantic_gap":{"current_position":0-100,"leader_position":0-100,"gap_analysis":"...","priority_themes":["thème sémantique manquant 1","thème 2","thème 3","thème 4"],"closing_strategy":"..."}},
"competitive_landscape":{"leader":{"name":"...","url":"URL ou null","authority_factor":"facteur clé de domination","analysis":"3-4 phrases d'analyse"},"direct_competitor":{"name":"...","url":"URL VALIDE OBLIGATOIRE","authority_factor":"facteur clé de parité/différence","analysis":"3-4 phrases d'analyse"},"challenger":{"name":"...","url":"URL ou null","authority_factor":"facteur de disruption","analysis":"3-4 phrases d'analyse"},"inspiration_source":{"name":"...","url":"URL ou null","authority_factor":"qualité benchmark","analysis":"3-4 phrases d'analyse"}},
"geo_citability":{"score":0-100,"readiness_level":"pioneer|ready|developing|basic|absent","analysis":"...","strengths":["..."],"weaknesses":["..."],"recommendations":["..."]},
"llm_visibility":{"citation_probability":0-100,"knowledge_graph_presence":"strong|moderate|weak|absent","analysis":"...","test_queries":[{"query":"...","purpose":"...","target_llms":["ChatGPT","Claude","Perplexity"]}]},
"conversational_intent":{"ratio":0-100,"analysis":"...","question_titles_detected":0,"total_titles_analyzed":0,"examples":["OBLIGATOIRE: 3-5 reformulations en QUESTIONS NATURELLES directement liées au business/produits/services du site analysé. Ex pour un e-commerce de matériaux: 'Quel isolant naturel choisir pour une maison ancienne ?'. Ne PAS donner d'exemples génériques."],"recommendations":["..."]},
"zero_click_risk":{"at_risk_keywords":[{"keyword":"...","volume":0,"risk_level":"high|medium|low","sge_threat":"...","defense_strategy":"..."}],"overall_risk_score":0-100,"analysis":"..."},
"priority_content":{"missing_pages":[{"title":"...","rationale":"...","target_keywords":["..."],"expected_impact":"high|medium|low"}],"content_upgrades":[{"page":"...","current_issue":"...","upgrade_strategy":"..."}]},
"keyword_positioning":{"main_keywords":[{"keyword":"...","volume":0,"difficulty":0,"current_rank":"...","strategic_analysis":{"intent":"Transactionnel|Informatif|Décisionnel|Navigationnel","business_value":"High|Medium|Low","pain_point":"Quel problème l'utilisateur cherche-t-il à résoudre ?","recommended_action":"Action concrète pour se positionner"}}],"quick_wins":[{"keyword":"...","current_rank":0,"volume":0,"action":"..."}],"content_gaps":[{"keyword":"...","volume":0,"priority":"high|medium|low","action":"..."}],"opportunities":["..."],"competitive_gaps":["..."],"recommendations":["..."]},
"market_data_summary":{"total_market_volume":0,"keywords_ranked":0,"keywords_analyzed":0,"average_position":0,"data_source":"dataforseo|fallback"},
"executive_roadmap":[{"title":"...","prescriptive_action":"Paragraphe 4-5 phrases","strategic_rationale":"...","expected_roi":"High|Medium|Low","category":"Identité|Contenu|Autorité|Social|Technique","priority":"Prioritaire|Important|Opportunité"}],
"executive_summary":"3-4 phrases pour CEO/CMO",
"overallScore":0-100}

INSTRUCTIONS CRITIQUES:
- UTILISE LES DONNÉES RÉELLES pour keyword_positioning et market_data_summary
- keyword_positioning.main_keywords: MINIMUM 5 mots-clés OBLIGATOIRES. Chaque mot-clé DOIT avoir un objet "strategic_analysis" avec intent, business_value, pain_point et recommended_action. Si les données DataForSEO contiennent moins de 5 résultats ou des volumes à 0, COMPLÈTE avec des mots-clés pertinents pour le core business avec volumes estimés et rank "Non classé". Un site a TOUJOURS au moins 5 mots-clés stratégiques.
- INTERDICTION d'inclure le nom de marque dans les mots-clés main_keywords. Les mots-clés doivent être 100% génériques (ex: "agent IA entreprise" et non "Limova agent IA").
- Pour chaque mot-clé, l'analyse stratégique doit expliquer POURQUOI ce mot-clé rapporte de l'argent (business_value) et quel PROBLÈME l'utilisateur cherche à résoudre (pain_point).
- executive_roadmap: MINIMUM 6 recommandations narratives dont AU MOINS 1 avec category "Social"
- Recommandation Social: identifier LE réseau social adapté à la marque, stratégie concrète, impact sur citabilité IA
- GOLIATH=leader national/international massif. CONCURRENT LOCAL=acteur SERP local avec URL valide obligatoire
- ⚠️ RÈGLE ABSOLUE CONCURRENT DIRECT: Le "direct_competitor" NE PEUT JAMAIS être le même domaine que le site analysé ("${domain}"). Il doit OBLIGATOIREMENT s'agir d'un AUTRE nom de domaine, positionné plus haut dans les SERPs, avec le même core business ou une fonctionnalité équivalente. Si les données SERP fournissent un concurrent, utilise-le. Sinon, identifie un acteur réel du même secteur.
- PROFILS SOCIAUX — RÈGLE ABSOLUE ANTI-HALLUCINATION:
   • Les SEULES URLs autorisées dans "profile_url" sont celles EXACTEMENT listées dans "URLs sociales trouvées" des SIGNAUX E-E-A-T ci-dessus.
   • Tu ne dois JAMAIS inventer, deviner ou construire une URL de profil social. Si tu n'as pas vu l'URL exacte dans les données crawler, mets profile_url: null.
   • COPIE-COLLE les URLs telles quelles depuis les signaux E-E-A-T. Ne modifie pas un seul caractère.
   • Inclus MAXIMUM 2 profils avec profile_url (uniquement parmi les URLs détectées). Les autres plateformes: profile_url: null.
- IDENTIFICATION DU FONDATEUR/DIRIGEANT: Si tu connais avec CERTITUDE le nom du fondateur ou dirigeant principal de l'entité (grâce à tes connaissances pré-entraînées), cite-le nommément dans thought_leadership.analysis et/ou dans l'introduction. Indique son profil LinkedIn UNIQUEMENT s'il figure dans les URLs détectées. Si tu n'es pas certain de l'identité, écris "fondateur non identifié".
- SCORING E-E-A-T EVIDENCE-BASED: Le eeat_score (0-10) doit être fondé sur les PREUVES OBSERVABLES fournies dans "SIGNAUX E-E-A-T DÉTECTÉS". 
   MÉTHODOLOGIE: Commence par compter les signaux factuels détectés, puis enrichis avec tes connaissances pré-entraînées sur la marque (si elle est suffisamment connue).
   
   ⚠️ RÉALITÉ DU MARCHÉ: La plupart des entreprises n'ont PAS d'incarnation humaine (pas de fondateur identifiable, pas de Person en JSON-LD). C'est NORMAL. Le E-E-A-T est une donnée NOUVELLE que très peu de sites implémentent. Ne pénalise pas excessivement l'absence d'incarnation.
   
   SIGNAUX TECHNIQUES (vérifiés par le crawler — haute fiabilité):
   +1pt: Author déclaré en JSON-LD (hasAuthorInJsonLd=OUI)
   +1pt: Person ou ProfilePage en JSON-LD (hasPerson ou hasProfilePage=OUI)
   +1pt: sameAs vers Wikidata (hasWikidataSameAs=OUI) — signal fort d'autorité institutionnelle
   +1pt: Organization déclarée en JSON-LD avec données structurées complètes
   +0.5pt: sameAs présent sans Wikidata (hasSameAs=OUI)
   +0.5pt: Bios auteur dans le HTML (hasAuthorBio=OUI)
   +0.5pt: Page LinkedIn entreprise (/company/) détectée — entité de marque
   +0.5pt: Profils LinkedIn personnels (/in/) détectés — incarnation humaine (BONUS, pas obligatoire)
   +0.5pt: Citations d'experts / blockquotes détectées
   +0.5pt: Études de cas / témoignages détectés
   Base technique max: ~7 points à partir des signaux crawlés
   
   SIGNAUX INFÉRÉS (connaissances pré-entraînées — fiabilité variable):
   +1-3pts: Marque connue nationalement/internationalement (Wikipedia, Knowledge Graph Google, couverture presse)
   +0.5-1pt: GMB actif avec avis (si la marque est suffisamment connue pour que tu le saches)
   ATTENTION: Si tu n'es PAS CERTAIN qu'une information est vraie, NE L'AJOUTE PAS au score. Mieux vaut sous-estimer que halluciner.
   
   HONNÊTETÉ RADICALE:
   - Tu NE PEUX PAS vérifier le nombre d'abonnés d'un réseau social → ne prétends JAMAIS connaître ce chiffre
   - Tu NE PEUX PAS vérifier si un GMB existe → ne l'affirme que pour des marques notoirement connues
   - Tu NE PEUX PAS vérifier la fraîcheur des publications sociales → ne juge pas l'activité récente
   - Instagram n'est PAS obligatoire. Ne recommande un réseau que s'il est pertinent pour le secteur d'activité.
   - Dans "analysis" du thought_leadership, DISTINGUE EXPLICITEMENT: "Signaux vérifiés sur le site: [liste]" vs "Signaux estimés (connaissances pré-entraînées): [liste]"
   
   PLAFONDS (ajustés — incarnation NON obligatoire):
   - Sans AUCUN signal technique détecté (tout à NON): max 3/10 (basé uniquement sur la notoriété inférée)
   - Avec signaux techniques (Organization, sameAs, etc.) SANS incarnation humaine: max 7/10 (c'est le cas normal)
   - Avec incarnation (Person/Author/profil personnel) + signaux techniques: 7-9/10
   - 9-10/10: réservé aux marques à autorité institutionnelle vérifiable (Wikidata sameAs, OU marque de référence que tu peux attester avec certitude)
- founder_authority: "unknown" si aucun fondateur/dirigeant n'est identifiable dans les signaux E-E-A-T crawlés ni dans tes connaissances. Ne PAS inventer. C'est le cas le plus fréquent.
- PRÉSENCE SOCIALE: Analyse uniquement les plateformes PERTINENTES pour le secteur. Ne force pas la présence sur Instagram si ce n'est pas pertinent. Les proof_sources doivent refléter la réalité: si un réseau est absent et non pertinent, indique presence_level: "absent" sans le traiter comme un défaut.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, toolsData, hallucinationCorrections, competitorCorrections } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveToolsData: ToolsData = toolsData || {
      crawlers: { note: 'Non disponible' },
      geo: { note: 'Non disponible' },
      llm: { note: 'Non disponible' },
      pagespeed: { note: 'Non disponible' },
    };

    // ==================== FETCH PAGE METADATA (lightweight) ====================
    const { context: pageContentContext, brandSignals, eeatSignals } = await extractPageMetadata(url);

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const domain = new URL(normalizedUrl).hostname;
    const domainWithoutWww = domain.replace(/^www\./, '');
    const domainSlug = domainWithoutWww.split('.')[0];
    
    // ==================== PROBABILISTIC BRAND NAME RESOLUTION ====================
    const { name: resolvedEntityName, confidence: brandConfidence } = resolveBrandName(brandSignals, domain, url);
    const isConfidentBrand = brandConfidence >= 0.95;
    // humanBrandName is used for sanitization (slug → readable) in non-introduction sections
    const humanBrandName = isConfidentBrand ? resolvedEntityName : humanizeBrandName(domainSlug);
    console.log(`🎯 Entité résolue: "${resolvedEntityName}" (confiance: ${(brandConfidence * 100).toFixed(1)}%, ${isConfidentBrand ? 'NOM DÉTECTÉ' : 'FALLBACK URL'})`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🚀 AUDIT STRATÉGIQUE pour: ${domain} (${resolvedEntityName})`);

    // ==================== SINGLE context detection (no duplicate API calls) ====================
    const context = detectBusinessContext(domain, pageContentContext);

    // ==================== ÉTAPE 1: DATAFORSEO + RANKED KEYWORDS (parallel) ====================
    console.log('\n📊 ÉTAPE 1: DataForSEO...');
    const [marketData, rankingOverview] = await Promise.all([
      fetchMarketData(domain, context, pageContentContext, url),
      context.locationCode ? fetchRankedKeywords(domain, context.locationCode) : Promise.resolve(null),
    ]);

    // ==================== ÉTAPE 1b: CONCURRENT LOCAL + FOUNDER (parallel) ====================
    console.log('\n🏙️ ÉTAPE 1b: Concurrent local + Founder discovery...');
    let localCompetitorData: { name: string; url: string; rank: number } | null = null;
    let founderInfo: FounderInfo = { name: null, profileUrl: null, platform: null, isInfluencer: false };
    
    // Run in parallel
    const [localCompResult, founderResult] = await Promise.allSettled([
      context.locationCode ? findLocalCompetitor(domain, context.sector, context.locationCode, pageContentContext) : Promise.resolve(null),
      searchFounderProfile(domain),
    ]);
    
    if (localCompResult.status === 'fulfilled' && localCompResult.value) {
      localCompetitorData = localCompResult.value;
    } else if (localCompResult.status === 'rejected') {
      console.error('❌ Concurrent local:', localCompResult.reason);
    }
    
    if (founderResult.status === 'fulfilled' && founderResult.value) {
      founderInfo = founderResult.value;
    }

    // ==================== ÉTAPE 1c: CHECK-LLM (skip if toolsData already has LLM data) ====================
    if (!toolsData?.llm || toolsData.llm.note) {
      console.log('\n🤖 ÉTAPE 1c: check-llm...');
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        
        if (supabaseUrl && supabaseAnonKey) {
          const llmResponse = await fetch(`${supabaseUrl}/functions/v1/check-llm`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, lang: 'fr' }),
            signal: AbortSignal.timeout(30000), // 30s timeout for sub-function
          });
          
          if (llmResponse.ok) {
            const llmResult = await llmResponse.json();
            if (llmResult.success && llmResult.data) {
              effectiveToolsData.llm = llmResult.data;
              console.log(`✅ LLM: score ${llmResult.data.overallScore}/100`);
            }
          } else {
            await llmResponse.text(); // consume
            console.log('⚠️ check-llm error:', llmResponse.status);
          }
        }
      } catch (e) {
        console.error('❌ check-llm:', e);
      }
    } else {
      console.log('✅ LLM data already provided, skipping check-llm call');
    }

    // ==================== ÉTAPE 2: LLM ANALYSIS ====================
    console.log('\n🤖 ÉTAPE 2: Analyse LLM...');
    
    let userPrompt = buildUserPrompt(url, domain, effectiveToolsData, marketData, pageContentContext, eeatSignals, founderInfo);
    
    // Inject ranking overview as priority context for the LLM
    if (rankingOverview) {
      const rkSection = `
📈 ÉTAT DES LIEUX SEO ACTUEL (DataForSEO ranked_keywords — données RÉELLES du domaine):
- Mots-clés positionnés: ${rankingOverview.total_ranked_keywords}
- Position moyenne globale: ${rankingOverview.average_position_global}
- Position moyenne Top 10: ${rankingOverview.average_position_top10 || 'Aucun mot-clé en Top 10'}
- Trafic organique estimé (ETV): ${rankingOverview.etv}
- Distribution: Top 3=${rankingOverview.distribution.top3}, Top 10=${rankingOverview.distribution.top10}, Top 20=${rankingOverview.distribution.top20}, Top 50=${rankingOverview.distribution.top50}, Top 100=${rankingOverview.distribution.top100}
- Top keywords positionnés: ${rankingOverview.top_keywords.slice(0, 5).map(k => `"${k.keyword}" pos${k.position}(${k.volume}vol)`).join(', ')}
⚠️ INSTRUCTION: Base tes recommandations sur cet état des lieux RÉEL. Identifie les forces (mots-clés bien positionnés) et les faiblesses (absence du Top 10 sur des requêtes clés). Le market_data_summary DOIT inclure average_position basé sur ces données. Les quick_wins doivent tenir compte des positions existantes.
`;
      userPrompt = rkSection + userPrompt;
    }
    
    // Inject resolved entity name for the LLM
    userPrompt = `🏷️ NOM DE L'ENTITÉ ANALYSÉE: "${resolvedEntityName}" — Utilise CE NOM pour désigner le site dans tout le rapport (introduction incluse).\n` + userPrompt;
    
    if (localCompetitorData) {
      userPrompt = `🏙️ CONCURRENT LOCAL SERP: "${localCompetitorData.name}" URL:${localCompetitorData.url} Position:${localCompetitorData.rank}. Utilise comme direct_competitor.\n` + userPrompt;
    }
    
    if (hallucinationCorrections) {
      const corrections = Object.entries(hallucinationCorrections)
        .filter(([_, v]) => v)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');
      if (corrections) {
        userPrompt = `⚠️ CORRECTIONS UTILISATEUR (priorité absolue): ${corrections}\n` + userPrompt;
      }
    }
    
    if (competitorCorrections) {
      const cc = competitorCorrections;
      const parts: string[] = [];
      if (cc.leader?.name) parts.push(`Leader:"${cc.leader.name}"${cc.leader.url ? `(${cc.leader.url})` : ''}`);
      if (cc.direct_competitor?.name) parts.push(`Concurrent:"${cc.direct_competitor.name}"${cc.direct_competitor.url ? `(${cc.direct_competitor.url})` : ''}`);
      if (cc.challenger?.name) parts.push(`Challenger:"${cc.challenger.name}"`);
      if (parts.length > 0) {
        userPrompt = `🏢 CONCURRENTS CORRIGÉS: ${parts.join(', ')}\n` + userPrompt;
      }
    }
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: 'AI credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText.substring(0, 200));
      return new Response(JSON.stringify({ success: false, error: 'AI analysis failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    trackTokenUsage('audit-strategique-ia', 'google/gemini-2.5-pro', aiResponse.usage, url);

    if (!content) {
      return new Response(JSON.stringify({ success: false, error: 'Empty AI response' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ==================== PARSE JSON ====================
    console.log('\n📝 Parsing...');
    let parsedAnalysis;
    try {
      let jsonContent = content;
      if (content.includes('```json')) jsonContent = content.split('```json')[1].split('```')[0].trim();
      else if (content.includes('```')) jsonContent = content.split('```')[1].split('```')[0].trim();
      jsonContent = jsonContent.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      parsedAnalysis = JSON.parse(jsonContent);
    } catch {
      try {
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          let jsonContent = content.substring(firstBrace, lastBrace + 1);
          jsonContent = jsonContent.replace(/,(\s*[\}\]])/g, '$1');
          parsedAnalysis = JSON.parse(jsonContent);
        } else throw new Error('No JSON found');
      } catch {
        return new Response(JSON.stringify({ success: false, error: 'Failed to parse AI analysis' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Sanitize brand name
    parsedAnalysis = sanitizeBrandNameInResponse(parsedAnalysis, domainSlug, humanBrandName);

    // ═══ POST-PROCESS: Validate ALL competitive actors are not the target domain ═══
    const cleanTargetDomain = domain.replace(/^www\./, '').toLowerCase();
    const brandNameLower = resolvedEntityName.toLowerCase().replace(/\..*$/, ''); // "limova.ai" → "limova"
    const domainSlugLower = domainSlug.toLowerCase(); // "limova"
    
    function isSelfReference(actor: any): boolean {
      if (!actor) return false;
      // Check URL match
      const actorDomain = (() => {
        try {
          const u = actor.url?.startsWith('http') ? actor.url : `https://${actor.url || ''}`;
          return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
        } catch { return ''; }
      })();
      if (actorDomain && (actorDomain === cleanTargetDomain || actorDomain.includes(cleanTargetDomain) || cleanTargetDomain.includes(actorDomain))) {
        return true;
      }
      // Check name match (e.g. "Limova.ai", "Limova", "limova")
      const nameLower = (actor.name || '').toLowerCase().replace(/\s+/g, '');
      if (nameLower === cleanTargetDomain || nameLower === brandNameLower || nameLower === domainSlugLower ||
          nameLower.includes(domainSlugLower) || domainSlugLower.includes(nameLower)) {
        return true;
      }
      return false;
    }

    if (parsedAnalysis.competitive_landscape) {
      const roles = ['leader', 'direct_competitor', 'challenger', 'inspiration_source'] as const;
      for (const role of roles) {
        const actor = parsedAnalysis.competitive_landscape[role];
        if (actor && isSelfReference(actor)) {
          console.log(`⚠️ ${role} "${actor.name}" is self-reference — replacing`);
          if (role === 'direct_competitor' && localCompetitorData) {
            parsedAnalysis.competitive_landscape[role] = {
              name: localCompetitorData.name,
              url: localCompetitorData.url,
              authority_factor: actor.authority_factor || 'Concurrent SERP local',
              analysis: `Concurrent identifié via les résultats de recherche locaux, positionné #${localCompetitorData.rank}.`,
            };
          } else {
            parsedAnalysis.competitive_landscape[role].name = 'Non identifié';
            parsedAnalysis.competitive_landscape[role].url = null;
            parsedAnalysis.competitive_landscape[role].analysis = `Auto-référence détectée et supprimée. Acteur non identifié pour le rôle "${role}".`;
          }
        }
      }
    }

    // ═══ POST-PROCESS: Validate competitor URLs are accessible ═══
    if (parsedAnalysis.competitive_landscape) {
      const roles2 = ['leader', 'direct_competitor', 'challenger', 'inspiration_source'] as const;
      await Promise.all(roles2.map(async (role) => {
        const actor = parsedAnalysis.competitive_landscape[role];
        if (!actor?.url) return;
        let href = actor.url.trim().replace(/^\/+/, '');
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          href = `https://${href}`;
        }
        try {
          new URL(href); // syntax check
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 6000);
          const res = await fetch(href, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            redirect: 'follow',
            signal: ctrl.signal,
          });
          clearTimeout(tid);
          if (res.ok || res.status === 403) {
            // Update to final URL after redirects
            actor.url = res.url || href;
            console.log(`✅ ${role} URL valid: ${actor.url}`);
          } else {
            console.log(`❌ ${role} URL returned ${res.status} — removing`);
            actor.url = null;
          }
        } catch (e: any) {
          console.log(`❌ ${role} URL unreachable (${e.message}) — removing`);
          actor.url = null;
        }
      }));
    }

    // ═══ POST-PROCESS: Remove self from introduction.competitors[] ═══
    if (parsedAnalysis.introduction?.competitors && Array.isArray(parsedAnalysis.introduction.competitors)) {
      parsedAnalysis.introduction.competitors = parsedAnalysis.introduction.competitors.filter((c: string) => {
        const cLower = c.toLowerCase().replace(/\s+/g, '');
        const isSelf = cLower === cleanTargetDomain || cLower === brandNameLower || cLower === domainSlugLower ||
                       cLower.includes(domainSlugLower) || domainSlugLower.includes(cLower);
        if (isSelf) console.log(`⚠️ Removing self-reference "${c}" from introduction.competitors`);
        return !isSelf;
      });
    }

    // ═══ POST-PROCESS: Validate social URLs against crawler-detected ones ═══
    if (parsedAnalysis.social_signals?.proof_sources && Array.isArray(parsedAnalysis.social_signals.proof_sources)) {
      const detectedUrlsSet = new Set(
        (eeatSignals.detectedSocialUrls || []).map((u: string) => u.toLowerCase().replace(/\/$/, ''))
      );
      // Also whitelist founder profile URL from SERP discovery
      if (founderInfo?.profileUrl) {
        detectedUrlsSet.add(founderInfo.profileUrl.toLowerCase().replace(/\/$/, ''));
      }
      console.log(`🔗 Validating social URLs against ${detectedUrlsSet.size} detected URLs:`, [...detectedUrlsSet]);
      
      for (const source of parsedAnalysis.social_signals.proof_sources) {
        if (source.profile_url) {
          const normalized = source.profile_url.toLowerCase().replace(/\/$/, '');
          // Check if this URL (or a close match) was actually detected by the crawler
          const isValid = [...detectedUrlsSet].some(detected => 
            normalized.includes(detected) || detected.includes(normalized) ||
            // Allow matching by path segment (e.g. /in/yoan-drahy matches detected /in/yoan-drahy)
            normalized.split('/').slice(-1)[0] === detected.split('/').slice(-1)[0]
          );
          if (!isValid) {
            console.log(`⚠️ Removing hallucinated social URL: ${source.profile_url} (not in detected set)`);
            source.profile_url = null;
          }
        }
      }
    }

    // ═══ POST-PROCESS: Guarantee minimum 5 main_keywords ═══
    if (parsedAnalysis.keyword_positioning?.main_keywords) {
      const mainKw = parsedAnalysis.keyword_positioning.main_keywords;
      if (mainKw.length < 5 && marketData?.top_keywords) {
        console.log(`⚠️ Only ${mainKw.length} main_keywords from AI — supplementing from market data`);
        const existingLower = new Set(mainKw.map((kw: any) => (kw.keyword || '').toLowerCase()));
        for (const mkw of marketData.top_keywords) {
          if (mainKw.length >= 5) break;
          if (!existingLower.has(mkw.keyword.toLowerCase())) {
            existingLower.add(mkw.keyword.toLowerCase());
            mainKw.push({
              keyword: mkw.keyword,
              volume: mkw.volume,
              difficulty: mkw.difficulty,
              current_rank: mkw.current_rank || 'Non classé',
            });
          }
        }
        console.log(`✅ main_keywords after supplement: ${mainKw.length}`);
      }
    }

    const result = {
      success: true,
      data: {
        url, domain,
        scannedAt: new Date().toISOString(),
        ...parsedAnalysis,
        raw_market_data: marketData,
        toolsData: null, // Don't echo back the full toolsData to save response size
        llm_visibility_raw: effectiveToolsData.llm,
      }
    };

    console.log('✅ AUDIT TERMINÉ');

    // Save to registry (fire and forget)
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (authHeader && supabaseUrl && supabaseKey) {
      saveStrategicRecommendationsToRegistry(supabaseUrl, supabaseKey, authHeader, domain, url, parsedAnalysis)
        .catch(err => console.error('Registre:', err));
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate audit' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
