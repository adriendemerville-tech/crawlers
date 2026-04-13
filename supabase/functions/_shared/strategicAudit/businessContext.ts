/**
 * Business context detection, keyword seed generation, and location mapping.
 */
import { trackTokenUsage } from '../tokenTracker.ts';
import { cleanAndTokenize, extractMetadataTexts, buildDomainSlugs, STOP_WORDS } from './textUtils.ts';
import { humanizeBrandName } from './brandDetection.ts';
import type { BusinessContext } from './types.ts';

// Well-known location codes to avoid downloading the full list
export const KNOWN_LOCATIONS: Record<string, { code: number; name: string; lang: string; seDomain: string }> = {
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
 */
export function extractCoreBusiness(pageContentContext: string): string {
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
 */
export function detectBusinessContext(domain: string, pageContentContext: string = ''): BusinessContext {
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
  const coreBusiness = extractCoreBusiness(pageContentContext);
  const sector = coreBusiness || rawSlug.replace(/-/g, ' ');
  console.log(`📋 Contexte: marque="${brandName}", secteur="${sector}", location="${locationInfo.name}" (code: ${locationInfo.code}, lang: ${locationInfo.lang})`);
  return { sector, location: locationInfo.name, brandName, locationCode: locationInfo.code, languageCode: locationInfo.lang, seDomain: locationInfo.seDomain };
}

export function extractKeywordsFromMetadata(pageContentContext: string, domain: string = ''): string[] {
  const extracted: string[] = [];
  const texts = extractMetadataTexts(pageContentContext);
  const domainSlugs = buildDomainSlugs(domain);
  for (const text of texts) {
    const words = cleanAndTokenize(text, domainSlugs).filter(w => w.length > 2);
    for (let i = 0; i < words.length - 2; i++) extracted.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    for (let i = 0; i < words.length - 1; i++) extracted.push(`${words[i]} ${words[i + 1]}`);
    for (const word of words) { if (word.length >= 5) extracted.push(word); }
  }
  return [...new Set(extracted)].slice(0, 12);
}

export function generateSeedKeywords(brandName: string, sector: string, pageContentContext: string = '', domain: string = ''): string[] {
  const keywords: string[] = [];
  if (pageContentContext) {
    const coreBusiness = extractCoreBusiness(pageContentContext);
    const texts = extractMetadataTexts(pageContentContext);
    const domainSlugs = buildDomainSlugs(domain);
    const coreBigrams: string[] = [];
    for (const text of texts) {
      const words = cleanAndTokenize(text, domainSlugs);
      for (let i = 0; i < words.length - 1; i++) coreBigrams.push(`${words[i]} ${words[i + 1]}`);
    }
    for (const bg of coreBigrams.slice(0, 3)) { if (bg.length > 4 && !keywords.includes(bg)) keywords.push(bg); }
    const metaKeywords = extractKeywordsFromMetadata(pageContentContext, domain);
    for (const mk of metaKeywords) { if (mk.length > 4 && !keywords.includes(mk)) keywords.push(mk); }
  }
  const cleanBrand = brandName.toLowerCase().trim();
  if (sector.toLowerCase() !== cleanBrand && sector.length > 3) {
    if (!keywords.some(k => k.includes(sector))) keywords.push(sector);
  }
  if (!keywords.includes(cleanBrand)) keywords.push(cleanBrand);
  console.log(`🔑 Seed keywords (core business first): ${keywords.slice(0, 5).join(', ')}`);
  return keywords.filter(kw => kw.length > 3 && !kw.includes('undefined')).slice(0, 10);
}

export async function generateSeedsWithAI(
  url: string, pageContentContext: string, brandName: string,
  mode: 'initial' | 'vertical' | 'horizontal' = 'initial', feedback?: string
): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('⚠️ No AI key for seed generation, falling back to metadata extraction');
    return [];
  }
  const modeInstructions: Record<string, string> = {
    initial: "Services principaux + intentions d'achat/conversion. Ex: 'devis rénovation salle de bain', 'plombier urgence Paris', 'logiciel facturation auto-entrepreneur'.",
    vertical: "Sous-catégories techniques, longue traîne, conversion locale. Creuse en PROFONDEUR les niches métier spécifiques.",
    horizontal: "Étapes AMONT du parcours client (financement, permis, diagnostic, comparatif) et besoins CONNEXES.",
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
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash-lite', messages: [{ role: 'user', content: prompt }], temperature: 0.5 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { console.log(`⚠️ AI seed generation failed: ${response.status}`); await response.text(); return []; }
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
      if (match) { seeds = match[1].split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, '')).filter((s: string) => s.length > 3); }
    }
    const brandLower = brandName.toLowerCase();
    const domainSlug = brandLower.replace(/\s+/g, '');
    seeds = seeds.filter(s => { const sLower = s.toLowerCase(); return !sLower.includes(brandLower) && !sLower.includes(domainSlug); });
    console.log(`🤖 AI seeds (${mode}): ${seeds.slice(0, 8).join(', ')}... (${seeds.length} total)`);
    return seeds.slice(0, 15);
  } catch (error) {
    console.error('❌ AI seed generation error:', error);
    return [];
  }
}
