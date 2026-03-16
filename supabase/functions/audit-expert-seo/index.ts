import { DOMParser, Element, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"
import { assertSafeUrl } from '../_shared/ssrf.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { checkIpRate, getClientIp, rateLimitResponse, acquireConcurrency, releaseConcurrency, concurrencyResponse } from '../_shared/ipRateLimiter.ts'
import { checkFairUse, getUserContext } from '../_shared/fairUse.ts'
import { saveRawAuditData } from '../_shared/saveRawAuditData.ts'

const GOOGLE_API_KEY = Deno.env.get('GOOGLE_PAGESPEED_API_KEY') || '';

// ==================== INTERFACES ====================

interface SelfAuditResult {
  isReliable: boolean;
  reason?: string;
  reliabilityScore: number;
}

interface SmartFetchResult {
  html: string;
  renderingMode: 'static_fast' | 'dynamic_rendered';
  selfAudit: SelfAuditResult;
}

interface SemanticConsistency {
  titleH1Similarity: number;
  verdict: string;
  details: string;
}

interface ContentDensity {
  ratio: number;
  verdict: string;
  htmlSize: number;
  textSize: number;
}

interface LinkProfile {
  internal: number;
  external: number;
  total: number;
  toxicAnchors: string[];
  toxicAnchorsCount: number;
}

interface BrokenLink {
  url: string;
  status: number;
  anchor: string;
  type: 'internal' | 'external';
}

interface BrokenLinksAnalysis {
  total: number;
  broken: BrokenLink[];
  checked: number;
  corsBlocked: number;
  verdict: 'optimal' | 'warning' | 'critical';
}

interface JsonLdValidation {
  valid: boolean;
  types: string[];
  parseErrors: string[];
  count: number;
  isJsGenerated: boolean;
}

interface ExpertInsights {
  semanticConsistency: SemanticConsistency;
  contentDensity: ContentDensity;
  linkProfile: LinkProfile;
  jsonLdValidation: JsonLdValidation;
  brokenLinks?: BrokenLinksAnalysis;
}

interface HtmlAnalysis {
  hasTitle: boolean;
  titleLength: number;
  titleContent: string;
  hasMetaDesc: boolean;
  metaDescLength: number;
  metaDescContent: string;
  h1Count: number;
  h1Contents: string[];
  h2Count: number;
  h2Contents: string[];
  wordCount: number;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  isHttps: boolean;
  insights: ExpertInsights;
  imagesTotal: number;
  imagesMissingAlt: number;
  htmlSizeBytes: number;
}

interface RobotsAnalysis {
  exists: boolean;
  permissive: boolean;
  content: string;
  allowsAIBots: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
  };
}

interface AuditMeta {
  scannedAt: string;
  renderingMode: 'static_fast' | 'dynamic_rendered';
  reliabilityScore: number;
  blockingError?: string;
}

interface RecommendationItem {
  id: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  icon: string;
  title: string;
  description: string;
  strengths?: string[];
  weaknesses?: string[];
  fixes?: string[];
}

// ==================== TOXIC ANCHORS LIST ====================

const TOXIC_ANCHORS = [
  'cliquez ici', 'click here', 'here', 'ici', 'lire la suite', 'read more',
  'en savoir plus', 'learn more', 'plus', 'more', 'voir', 'see', 'link',
  'lien', 'suite', 'continuer', 'continue', 'suivant', 'next', 'details',
  'détails', 'cliquer', 'click', 'allez', 'go', 'page', 'article'
];

// ==================== UTILITY FUNCTIONS ====================

/**
 * Normalisation robuste d'URL avec correction automatique des erreurs courantes
 * - Ajoute https:// si absent
 * - Corrige les doubles slashes
 * - Supprime les espaces et caractères invisibles
 * - Gère les URLs mal formatées
 */
function normalizeUrl(url: string): string {
  // Nettoyage basique
  let normalized = url
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
    .replace(/\s+/g, '') // Remove all whitespace
    .toLowerCase();
  
  // Corriger les protocoles mal écrits
  normalized = normalized
    .replace(/^https?:\/+/i, 'https://') // Fix http:/// or https:/// 
    .replace(/^htt[ps]?:(?!\/\/)/i, 'https://') // Fix http: without slashes
    .replace(/^htpps?:\/\//i, 'https://') // Fix typos like htpps://
    .replace(/^hhttps?:\/\//i, 'https://') // Fix hhttps://
    .replace(/^wwww?\./i, 'www.'); // Fix wwww.
  
  // Ajouter https:// si aucun protocole
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    // Si commence par www., ajouter https://
    if (normalized.startsWith('www.')) {
      normalized = `https://${normalized}`;
    } else {
      // Sinon, ajouter https://www. si ça ressemble à un domaine court
      // Ex: google.fr → https://www.google.fr
      // Ex: my-site.example.com → https://my-site.example.com (pas de www)
      const parts = normalized.split('.');
      if (parts.length === 2 && parts[0].length <= 15 && !parts[0].includes('-')) {
        normalized = `https://www.${normalized}`;
      } else {
        normalized = `https://${normalized}`;
      }
    }
  }
  
  // Valider la structure URL finale
  try {
    const urlObj = new URL(normalized);
    // S'assurer que le hostname est valide
    if (!urlObj.hostname || urlObj.hostname.length < 4) {
      throw new Error('Invalid hostname');
    }
    return urlObj.toString().replace(/\/$/, ''); // Remove trailing slash
  } catch {
    // Si toujours invalide, retourner tel quel (sera géré par l'erreur fetch)
    return normalized;
  }
}

/**
 * Tente de résoudre l'URL correcte en testant plusieurs variantes
 * Retourne l'URL qui répond, ou la première par défaut
 */
async function resolveWorkingUrl(baseUrl: string): Promise<{ url: string; resolved: boolean }> {
  const normalized = normalizeUrl(baseUrl);
  
  // Parse pour générer des variantes
  let urlObj: URL;
  try {
    urlObj = new URL(normalized);
  } catch {
    return { url: normalized, resolved: false };
  }
  
  const hostname = urlObj.hostname;
  const pathname = urlObj.pathname;
  
  // Générer des variantes à tester
  const variants: string[] = [normalized];
  
  // Variante sans www si présent
  if (hostname.startsWith('www.')) {
    variants.push(`https://${hostname.slice(4)}${pathname}`);
  } else {
    // Variante avec www si absent
    variants.push(`https://www.${hostname}${pathname}`);
  }
  
  // Variante http si https échoue (rare mais possible)
  variants.push(normalized.replace('https://', 'http://'));
  
  console.log(`[URL-Resolver] Testing ${variants.length} URL variants...`);
  
  // Tester chaque variante avec un HEAD request rapide
  for (const variant of variants) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(variant, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CrawlersAI/2.0; +https://crawlers.fr)',
        },
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      // Récupérer l'URL finale après redirections
      const finalUrl = response.url || variant;
      
      if (response.ok || response.status === 405 || response.status === 403) {
        // 405 = Method Not Allowed (some sites block HEAD but allow GET)
        // 403 = Forbidden (WAF/Cloudflare but site is real — will try GET in smartFetch)
        console.log(`[URL-Resolver] ✅ Found working URL: ${finalUrl} (status: ${response.status})`);
        return { url: finalUrl, resolved: true };
      }
    } catch (e) {
      // Continue to next variant
      console.log(`[URL-Resolver] ❌ Failed: ${variant}`);
    }
  }
  
  // Aucune variante n'a fonctionné, retourner l'originale
  console.log(`[URL-Resolver] ⚠️ No working variant found, using original: ${normalized}`);
  return { url: normalized, resolved: false };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüç0-9\s]/g, '').trim();
  const words1 = new Set(normalize(text1).split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalize(text2).split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = [...words1].filter(w => words2.has(w));
  const union = new Set([...words1, ...words2]);
  
  return Math.round((intersection.length / union.size) * 100);
}

// ==================== SELF-AUDIT MECHANISM ====================

function performSelfAudit(doc: HTMLDocument, htmlLength: number): SelfAuditResult {
  const bodyText = doc.body?.textContent?.trim() || "";
  const bodyTextLength = bodyText.length;
  
  // Rule 1: Large HTML but minimal visible text = SPA not rendered
  if (htmlLength > 2000 && bodyTextLength < 200) {
    return {
      isReliable: false,
      reliabilityScore: 0.2,
      reason: "CRITICAL: DOM vide détecté. Le contenu est probablement généré par JavaScript (SPA/React/Vue). Le fallback de rendu sera utilisé."
    };
  }
  
  // Rule 2: Check for SPA framework indicators without content
  const hasSpaIndicators = doc.querySelector('[data-reactroot], [ng-app], [data-v-], #__next, #__nuxt, #app[data-server-rendered]') !== null;
  const hasNoscriptWarning = doc.querySelector('noscript')?.textContent?.includes('JavaScript') || false;
  
  if (hasSpaIndicators && bodyTextLength < 500) {
    return {
      isReliable: false,
      reliabilityScore: 0.3,
      reason: "WARNING: Framework SPA détecté avec contenu limité. Le rendu JavaScript est probablement requis."
    };
  }
  
  // Rule 3: Very short content overall
  if (bodyTextLength < 100) {
    return {
      isReliable: false,
      reliabilityScore: 0.4,
      reason: "WARNING: Contenu textuel très faible. La page pourrait être en erreur ou requérir JavaScript."
    };
  }
  
  // All checks passed
  return {
    isReliable: true,
    reliabilityScore: 1.0
  };
}

// ==================== SMART FETCHER WITH JS FALLBACK ====================

async function smartFetch(url: string): Promise<SmartFetchResult> {
  assertSafeUrl(url);
  console.log('[SmartFetch] Tentative 1: Fetch statique standard...');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CrawlersFR/2.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });
    
    clearTimeout(timeoutId);
    
    // Accept 403 responses if they contain HTML content (WAF/Cloudflare protection)
    if (!response.ok && response.status !== 403) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // For 403 with very little content, it's a real block — try Browserless directly
    if (response.status === 403 && html.length < 500) {
      console.log(`[SmartFetch] 403 avec contenu insuffisant (${html.length} chars), tentative Browserless directe...`);
      
      const RENDERING_KEY_403 = Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY');
      
      if (RENDERING_KEY_403) {
        try {
          const renderUrl403 = `https://production-sfo.browserless.io/content?token=${RENDERING_KEY_403}`;
          const renderController403 = new AbortController();
          const renderTimeout403 = setTimeout(() => renderController403.abort(), 30000);
          
          const renderResponse403 = await fetch(renderUrl403, {
            method: 'POST',
            signal: renderController403.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: url,
              rejectResourceTypes: ['image', 'media', 'font'],
              gotoOptions: { waitUntil: 'networkidle2', timeout: 25000 },
              waitForSelector: { selector: 'body', timeout: 5000 },
            })
          });
          
          clearTimeout(renderTimeout403);
          
          if (renderResponse403.ok) {
            const renderedHtml403 = await renderResponse403.text();
            if (renderedHtml403.length > 500) {
              console.log(`[SmartFetch] ✅ Browserless 403-fallback réussi (${renderedHtml403.length} chars)`);
              const renderedDoc403 = new DOMParser().parseFromString(renderedHtml403, 'text/html');
              if (renderedDoc403) {
                const renderedAudit403 = performSelfAudit(renderedDoc403, renderedHtml403.length);
                return {
                  html: renderedHtml403,
                  renderingMode: 'dynamic_rendered' as const,
                  selfAudit: { ...renderedAudit403, reliabilityScore: Math.max(renderedAudit403.reliabilityScore, 0.85) }
                };
              }
            }
          } else {
            const errText = await renderResponse403.text().catch(() => '');
            console.log(`[SmartFetch] ⚠️ Browserless 403-fallback erreur ${renderResponse403.status}: ${errText.slice(0, 200)}`);
          }
        } catch (e403: unknown) {
          const err403 = e403 as Error;
          console.log(`[SmartFetch] ⚠️ Browserless 403-fallback exception: ${err403.message}`);
        }
      } else {
        console.log('[SmartFetch] ⚠️ RENDERING_API_KEY non configurée — impossible de contourner le 403');
      }
      
      throw new Error(`HTTP 403 (blocked)`);
    }
    
    if (response.status === 403) {
      console.log(`[SmartFetch] 403 accepté avec ${html.length} chars de contenu`);
    }
    const htmlLength = html.length;
    
    // Parse DOM for self-audit
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }
    
    const selfAudit = performSelfAudit(doc, htmlLength);
    
    // If self-audit fails, try JavaScript rendering fallback via Browserless.io
    if (!selfAudit.isReliable) {
      console.log('[SmartFetch] Auto-contrôle échoué:', selfAudit.reason);
      console.log('[SmartFetch] Tentative 2: Fallback rendu JavaScript via Browserless.io...');
      
      const RENDERING_KEY = Deno.env.get('RENDERING_API_KEY') || Deno.env.get('BROWSERLESS_API_KEY');
      
      if (RENDERING_KEY) {
        try {
          // Browserless.io /content endpoint for full HTML rendering
          const renderUrl = `https://production-sfo.browserless.io/content?token=${RENDERING_KEY}`;
          
          const renderController = new AbortController();
          const renderTimeoutId = setTimeout(() => renderController.abort(), 30000);
          
          const renderResponse = await fetch(renderUrl, {
            method: 'POST',
            signal: renderController.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: url,
              rejectResourceTypes: ['image', 'media', 'font'],
              gotoOptions: { 
                waitUntil: 'networkidle2',
                timeout: 25000
              },
              waitForSelector: { selector: 'body', timeout: 5000 },
            })
          });
          
          clearTimeout(renderTimeoutId);
          
          if (renderResponse.ok) {
            const renderedHtml = await renderResponse.text();
            const renderedDoc = new DOMParser().parseFromString(renderedHtml, 'text/html');
            
            if (renderedDoc) {
              const renderedAudit = performSelfAudit(renderedDoc, renderedHtml.length);
              
              if (renderedAudit.isReliable) {
                console.log('[SmartFetch] ✅ Fallback Browserless.io réussi! Contenu rendu récupéré.');
                return {
                  html: renderedHtml,
                  renderingMode: 'dynamic_rendered',
                  selfAudit: { ...renderedAudit, reliabilityScore: 0.95 }
                };
              } else {
                console.log('[SmartFetch] ⚠️ Contenu rendu toujours insuffisant après Browserless');
              }
            }
          } else {
            // Gestion des erreurs HTTP Browserless (403, 429, timeout, etc.)
            const errorStatus = renderResponse.status;
            const errorText = await renderResponse.text().catch(() => 'Unknown error');
            console.log(`[SmartFetch] ⚠️ Browserless.io erreur HTTP ${errorStatus}:`, errorText);
            
            if (errorStatus === 403) {
              console.log('[SmartFetch] ⚠️ Browserless.io: Accès refusé (clé invalide ou quota dépassé)');
            } else if (errorStatus === 429) {
              console.log('[SmartFetch] ⚠️ Browserless.io: Rate limit atteint');
            } else if (errorStatus === 504 || errorStatus === 524) {
              console.log('[SmartFetch] ⚠️ Browserless.io: Timeout du service');
            }
          }
        } catch (renderError: unknown) {
          const error = renderError as Error;
          if (error.name === 'AbortError') {
            console.log('[SmartFetch] ⚠️ Browserless.io: Timeout local (30s dépassées)');
          } else {
            console.log('[SmartFetch] ⚠️ Erreur fallback Browserless.io:', error.message || renderError);
          }
        }
      } else {
        console.log('[SmartFetch] ⚠️ RENDERING_API_KEY non configurée dans les secrets - fallback JS impossible');
        console.log('[SmartFetch] 💡 Configurez la clé API Browserless.io (secret RENDERING_API_KEY) pour activer le rendu des SPA');
      }
      
      // Return original with degraded reliability
      return {
        html,
        renderingMode: 'static_fast',
        selfAudit: { ...selfAudit, reliabilityScore: Math.max(selfAudit.reliabilityScore, 0.5) }
      };
    }
    
    console.log('[SmartFetch] ✅ Fetch statique réussi (fiabilité: 100%)');
    return {
      html,
      renderingMode: 'static_fast',
      selfAudit
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ==================== DOM-BASED HTML ANALYSIS ====================

function analyzeHtmlWithDOM(html: string, url: string): HtmlAnalysis {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  if (!doc) {
    return createEmptyAnalysis(url);
  }
  
  // === ÉTAPE 1 : Extraction des métadonnées (DOM complet) ===
  
  // Extract title using DOM (no regex!)
  const titleElement = doc.querySelector('title');
  const titleContent = titleElement?.textContent?.trim() || '';
  
  // Extract meta description using DOM
  const metaDescElement = doc.querySelector('meta[name="description"]');
  const metaDescContent = metaDescElement?.getAttribute('content')?.trim() || '';
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACTION H1 - APPROCHE HYBRIDE DOM + REGEX FALLBACK
  // ═══════════════════════════════════════════════════════════════
  
  const h1Contents: string[] = [];
  
  // Méthode 1: DOM standard
  const h1Elements = doc.querySelectorAll('h1');
  for (let i = 0; i < h1Elements.length; i++) {
    const h1Text = (h1Elements[i] as Element).textContent?.trim() || '';
    if (h1Text && h1Text.length > 0) {
      h1Contents.push(h1Text);
    }
  }
  
  // Méthode 2: Fallback regex si DOM n'a rien trouvé
  // (gère les H1 avec attributs complexes, style inline, etc.)
  if (h1Contents.length === 0) {
    console.log('[H1] DOM vide, tentative regex fallback...');
    const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    let h1Match;
    while ((h1Match = h1Regex.exec(html)) !== null) {
      const h1Html = h1Match[1];
      const h1Text = cleanHtmlToText(h1Html);
      if (h1Text && h1Text.length > 0) {
        h1Contents.push(h1Text);
        console.log(`[H1-Regex] Trouvé: "${h1Text.substring(0, 60)}${h1Text.length > 60 ? '...' : ''}"`);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EXTRACTION H2 - APPROCHE HYBRIDE DOM + REGEX FALLBACK
  // ═══════════════════════════════════════════════════════════════
  
  const h2Contents: string[] = [];
  
  // Méthode 1: DOM standard
  const h2Elements = doc.querySelectorAll('h2');
  for (let i = 0; i < h2Elements.length; i++) {
    const h2Text = (h2Elements[i] as Element).textContent?.trim() || '';
    if (h2Text && h2Text.length > 0) {
      h2Contents.push(h2Text);
    }
  }
  
  // Méthode 2: Fallback regex si DOM n'a rien trouvé
  if (h2Contents.length === 0) {
    console.log('[H2] DOM vide, tentative regex fallback...');
    const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    let h2Match;
    while ((h2Match = h2Regex.exec(html)) !== null) {
      const h2Html = h2Match[1];
      const h2Text = cleanHtmlToText(h2Html);
      if (h2Text && h2Text.length > 0) {
        h2Contents.push(h2Text);
        console.log(`[H2-Regex] Trouvé: "${h2Text.substring(0, 60)}${h2Text.length > 60 ? '...' : ''}"`);
      }
    }
  }
  
  console.log(`[Headings] H1: ${h1Contents.length}, H2: ${h2Contents.length}`);
  
  // === ÉTAPE 2 : Analyse JSON-LD AVANT suppression des scripts ===
  const jsonLdValidation = analyzeJsonLd(doc, html);
  console.log(`[JSON-LD] Trouvé ${jsonLdValidation.count} scripts, types: ${jsonLdValidation.types.join(', ') || 'aucun'}`);
  
  // === ÉTAPE 3 : Analyse du profil de liens (DOM complet) ===
  const linkProfile = analyzeLinkProfile(doc, url);
  
  // === ÉTAPE 4 : Analyse des images via REGEX (Deno DOMParser ne supporte pas querySelectorAll pour img) ===
  const imgRegex = /<(?:img|amp-img|image)\b([^>]*)(?:\/?>|>[^<]*<\/(?:img|amp-img|image)>)/gi;
  let imagesTotal = 0;
  let imagesMissingAlt = 0;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    imagesTotal++;
    const attrs = imgMatch[1] || '';
    // Check for alt attribute with non-empty value
    const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/i);
    if (!altMatch || (altMatch[1] ?? altMatch[2] ?? altMatch[3] ?? '').trim().length === 0) {
      imagesMissingAlt++;
    }
  }
  // Also count <source> with image types or srcset
  const sourceRegex = /<source\b[^>]*(?:type\s*=\s*["']image\/|srcset\s*=)[^>]*\/?>/gi;
  let sourceCount = 0;
  while (sourceRegex.exec(html) !== null) sourceCount++;
  imagesTotal += sourceCount;
  console.log(`[analyzeHtml] 🖼️ Images (regex): ${imagesTotal} total, ${imagesMissingAlt} missing alt`);

  // === ÉTAPE 5 : Nettoyage du DOM pour calcul du texte ===
  const scriptsAndStyles = doc.querySelectorAll('script, style, noscript, template');
  scriptsAndStyles.forEach(el => (el as Element).remove());
  
  // === ÉTAPE 6 : Calcul du word count sur le texte propre ===
  const bodyText = doc.body?.textContent || '';
  const cleanText = bodyText.replace(/\s+/g, ' ').trim();
  const wordCount = cleanText.split(' ').filter(w => w.length > 2).length;
  
  // Semantic consistency (title vs H1)
  const semanticConsistency = analyzeSemanticConsistency(titleContent, h1Contents[0] || '');
  
  // Content density (code vs text ratio)
  const contentDensity = analyzeContentDensity(html, cleanText);

  // HTML size in bytes
  const htmlSizeBytes = new TextEncoder().encode(html).length;
  
  const insights: ExpertInsights = {
    semanticConsistency,
    contentDensity,
    linkProfile,
    jsonLdValidation
  };
  
  return {
    hasTitle: titleContent.length > 0,
    titleLength: titleContent.length,
    titleContent,
    hasMetaDesc: metaDescContent.length > 0,
    metaDescLength: metaDescContent.length,
    metaDescContent,
    h1Count: h1Contents.length,
    h1Contents,
    h2Count: h2Contents.length,
    h2Contents,
    wordCount,
    hasSchemaOrg: jsonLdValidation.valid && jsonLdValidation.count > 0,
    schemaTypes: jsonLdValidation.types,
    isHttps: url.startsWith('https://'),
    insights,
    imagesTotal,
    imagesMissingAlt,
    htmlSizeBytes,
  };
}

// Helper: Nettoyer le HTML interne pour extraire le texte brut
function cleanHtmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '') // Supprimer les balises HTML internes
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, ' ')
    .trim();
}

function createEmptyAnalysis(url: string): HtmlAnalysis {
  return {
    hasTitle: false,
    titleLength: 0,
    titleContent: '',
    hasMetaDesc: false,
    metaDescLength: 0,
    metaDescContent: '',
    h1Count: 0,
    h1Contents: [],
    h2Count: 0,
    h2Contents: [],
    wordCount: 0,
    hasSchemaOrg: false,
    schemaTypes: [],
    isHttps: url.startsWith('https://'),
    insights: {
      semanticConsistency: { titleH1Similarity: 0, verdict: 'unknown', details: 'Analyse impossible' },
      contentDensity: { ratio: 0, verdict: 'unknown', htmlSize: 0, textSize: 0 },
      linkProfile: { internal: 0, external: 0, total: 0, toxicAnchors: [], toxicAnchorsCount: 0 },
      jsonLdValidation: { valid: false, types: [], parseErrors: [], count: 0 }
    },
    imagesTotal: 0,
    imagesMissingAlt: 0,
    htmlSizeBytes: 0,
  };
}

// ==================== EXPERT INSIGHTS FUNCTIONS ====================

function detectJsGeneratedSchema(html: string): boolean {
  const regularScripts = html.match(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of regularScripts) {
    const content = script.replace(/<script[^>]*>|<\/script>/gi, '');
    if (
      /application\/ld\+json/i.test(content) ||
      (/@context.*schema\.org/i.test(content) && /JSON\.stringify|createElement|innerHTML|insertAdjacentHTML|appendChild/i.test(content)) ||
      /structured[_-]?data|jsonLd|json_ld|schemaMarkup|schema_markup/i.test(content)
    ) {
      return true;
    }
  }
  const jsSchemaPatterns = [
    /window\.__NEXT_DATA__[\s\S]*?@context/i,
    /nuxt[\s\S]*?jsonld|__NUXT__[\s\S]*?schema/i,
    /gtm.*application\/ld\+json/i,
    /tagmanager.*schema\.org/i,
  ];
  for (const pattern of jsSchemaPatterns) {
    if (pattern.test(html)) return true;
  }
  return false;
}

function analyzeJsonLd(doc: HTMLDocument, rawHtml: string): JsonLdValidation {
  const isJsGenerated = detectJsGeneratedSchema(rawHtml);
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const types: string[] = [];
  const parseErrors: string[] = [];
  let validCount = 0;
  
  console.log(`[JSON-LD] Analyse de ${scripts.length} balises script[type="application/ld+json"], JS-generated: ${isJsGenerated}`);
  
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i] as Element;
    const content = script.textContent || '';
    
    try {
      const parsed = JSON.parse(content);
      validCount++;
      
      const findTypes = (node: any): void => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(item => findTypes(item));
          return;
        }
        if (node['@type']) {
          if (Array.isArray(node['@type'])) {
            types.push(...node['@type']);
          } else {
            types.push(node['@type']);
          }
        }
        if (node['@graph'] && Array.isArray(node['@graph'])) {
          findTypes(node['@graph']);
        }
        for (const key in node) {
          if (key !== '@graph' && node[key] && typeof node[key] === 'object') {
            findTypes(node[key]);
          }
        }
      };
      
      findTypes(parsed);
      
    } catch (e) {
      parseErrors.push(`Script ${i + 1}: JSON invalide`);
      console.log(`[JSON-LD] Erreur parsing script ${i + 1}:`, e);
    }
  }
  
  const uniqueTypes = [...new Set(types)];
  console.log(`[JSON-LD] Résultat: ${validCount} valides, ${uniqueTypes.length} types uniques: ${uniqueTypes.join(', ')}`);
  
  return {
    valid: parseErrors.length === 0 && validCount > 0,
    types: uniqueTypes,
    parseErrors,
    count: scripts.length,
    isJsGenerated
  };
}

function analyzeLinkProfile(doc: HTMLDocument, baseUrl: string): LinkProfile {
  const links = doc.querySelectorAll('a[href]');
  const baseDomain = extractDomain(baseUrl);
  
  let internal = 0;
  let external = 0;
  const toxicAnchors: string[] = [];
  
  for (let i = 0; i < links.length; i++) {
    const link = links[i] as Element;
    const href = link.getAttribute('href') || '';
    const anchorText = link.textContent?.toLowerCase().trim() || '';
    
    // Skip empty, javascript, and anchor links
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      continue;
    }
    
    // Determine if internal or external
    try {
      const linkUrl = new URL(href, baseUrl);
      if (linkUrl.hostname === baseDomain || linkUrl.hostname.endsWith('.' + baseDomain)) {
        internal++;
      } else {
        external++;
      }
    } catch {
      // Relative link = internal
      internal++;
    }
    
    // Check for toxic anchors
    if (anchorText && TOXIC_ANCHORS.some(toxic => anchorText === toxic || anchorText.includes(toxic))) {
      if (!toxicAnchors.includes(anchorText) && toxicAnchors.length < 10) {
        toxicAnchors.push(anchorText);
      }
    }
  }
  
  return {
    internal,
    external,
    total: internal + external,
    toxicAnchors,
    toxicAnchorsCount: toxicAnchors.length
  };
}

function analyzeSemanticConsistency(title: string, h1: string): SemanticConsistency {
  const similarity = calculateTextSimilarity(title, h1);
  
  let verdict: string;
  let details: string;
  
  if (similarity === 100) {
    verdict = 'redundant';
    details = 'Title et H1 identiques : opportunité sémantique perdue. Diversifiez pour cibler plus de mots-clés.';
  } else if (similarity >= 70) {
    verdict = 'optimal';
    details = 'Excellente cohérence sémantique entre Title et H1 avec variation suffisante.';
  } else if (similarity >= 40) {
    verdict = 'acceptable';
    details = 'Cohérence correcte. Considérez un meilleur alignement pour renforcer le signal sémantique.';
  } else if (similarity > 0) {
    verdict = 'inconsistent';
    details = 'Incohérence sémantique détectée. Le Title et le H1 semblent traiter de sujets différents.';
  } else {
    verdict = 'missing';
    details = 'Analyse impossible : Title ou H1 manquant.';
  }
  
  return { titleH1Similarity: similarity, verdict, details };
}

function analyzeContentDensity(html: string, visibleText: string): ContentDensity {
  const htmlSize = html.length;
  const textSize = visibleText.length;
  const ratio = htmlSize > 0 ? Math.round((textSize / htmlSize) * 100) : 0;
  
  let verdict: string;
  if (ratio < 10) {
    verdict = 'critical';
  } else if (ratio < 15) {
    verdict = 'warning';
  } else if (ratio < 25) {
    verdict = 'acceptable';
  } else {
    verdict = 'optimal';
  }
  
  return { ratio, verdict, htmlSize, textSize };
}

// ==================== BROKEN LINKS CHECKER ====================

async function checkBrokenLinks(doc: HTMLDocument, baseUrl: string): Promise<BrokenLinksAnalysis> {
  console.log('[BrokenLinks] Vérification des liens cassés...');
  
  const links = doc.querySelectorAll('a[href]');
  const baseDomain = extractDomain(baseUrl);
  const linksToCheck: { url: string; anchor: string; type: 'internal' | 'external' }[] = [];
  const checkedUrls = new Set<string>();
  
  // Collect unique links (limit to 30 for performance)
  for (let i = 0; i < links.length && linksToCheck.length < 30; i++) {
    const link = links[i] as Element;
    const href = link.getAttribute('href') || '';
    const anchorText = link.textContent?.trim().substring(0, 50) || '';
    
    // Skip empty, javascript, anchor, mailto, tel links
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || 
        href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) {
      continue;
    }
    
    try {
      const absoluteUrl = new URL(href, baseUrl).href;
      
      // Skip if already checked
      if (checkedUrls.has(absoluteUrl)) continue;
      checkedUrls.add(absoluteUrl);
      
      const linkDomain = new URL(absoluteUrl).hostname;
      const isInternal = linkDomain === baseDomain || linkDomain.endsWith('.' + baseDomain);
      
      linksToCheck.push({
        url: absoluteUrl,
        anchor: anchorText,
        type: isInternal ? 'internal' : 'external'
      });
    } catch {
      // Invalid URL, skip
    }
  }
  
  console.log(`[BrokenLinks] Vérification de ${linksToCheck.length} liens...`);
  
  const brokenLinks: BrokenLink[] = [];
  let corsBlocked = 0;
  
  // Check links in parallel with timeout
  const checkPromises = linksToCheck.map(async (link) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(link.url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/2.0; +https://crawlers.fr)'
        },
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      // 4xx and 5xx are broken
      if (response.status >= 400) {
        return {
          url: link.url,
          status: response.status,
          anchor: link.anchor,
          type: link.type
        };
      }
      return null;
    } catch (error) {
      // Network errors, timeouts, CORS - mark as potentially blocked for external
      if (link.type === 'external') {
        corsBlocked++;
        return null;
      }
      // Internal link that fails is considered broken
      return {
        url: link.url,
        status: 0,
        anchor: link.anchor,
        type: link.type
      };
    }
  });
  
  const results = await Promise.all(checkPromises);
  
  for (const result of results) {
    if (result) {
      brokenLinks.push(result);
    }
  }
  
  // Determine verdict
  let verdict: 'optimal' | 'warning' | 'critical';
  if (brokenLinks.length === 0) {
    verdict = 'optimal';
  } else if (brokenLinks.length <= 2) {
    verdict = 'warning';
  } else {
    verdict = 'critical';
  }
  
  console.log(`[BrokenLinks] ✅ ${brokenLinks.length} liens cassés trouvés sur ${linksToCheck.length} vérifiés`);
  
  return {
    total: linksToCheck.length,
    broken: brokenLinks,
    checked: linksToCheck.length,
    corsBlocked,
    verdict
  };
}

// ==================== ROBOTS.TXT ANALYSIS ====================

async function checkRobotsTxt(url: string): Promise<RobotsAnalysis> {
  console.log('[Robots] Vérification robots.txt...');
  
  try {
    const domain = new URL(url).origin;
    const robotsUrl = `${domain}/robots.txt`;
    
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/2.0)' }
    });
    
    if (!response.ok) {
      return { 
        exists: false, 
        permissive: true, 
        content: '',
        allowsAIBots: { gptBot: true, claudeBot: true, perplexityBot: true }
      };
    }
    
    const content = await response.text();
    const contentLower = content.toLowerCase();
    
    // Check if robots.txt blocks everything
    const hasDisallowAll = /disallow:\s*\/\s*$/m.test(contentLower) && /user-agent:\s*\*/m.test(contentLower);
    
    // Check AI bot permissions
    const blocksGPTBot = /user-agent:\s*gptbot[\s\S]*?disallow:\s*\//mi.test(content);
    const blocksClaudeBot = /user-agent:\s*claude/mi.test(content) && /disallow:\s*\//mi.test(content);
    const blocksPerplexityBot = /user-agent:\s*perplexitybot[\s\S]*?disallow:\s*\//mi.test(content);
    
    return {
      exists: true,
      permissive: !hasDisallowAll,
      content: content.substring(0, 1000),
      allowsAIBots: {
        gptBot: !blocksGPTBot,
        claudeBot: !blocksClaudeBot,
        perplexityBot: !blocksPerplexityBot
      }
    };
  } catch {
    return { 
      exists: false, 
      permissive: true, 
      content: '',
      allowsAIBots: { gptBot: true, claudeBot: true, perplexityBot: true }
    };
  }
}

// ==================== PAGESPEED & SAFE BROWSING ====================

async function fetchPageSpeedData(url: string): Promise<any | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&key=${GOOGLE_API_KEY}`;
  
  // Try up to 2 attempts (initial + 1 retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`[PSI] Tentative ${attempt}/2 — Récupération données PageSpeed...`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(apiUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`[PSI] Erreur HTTP ${response.status} (tentative ${attempt}):`, error?.error?.message || response.status);
        
        // If rate limited (429), wait before retry
        if (response.status === 429 && attempt < 2) {
          console.log('[PSI] Rate limited, attente 3s avant retry...');
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        if (attempt < 2) continue;
        return null;
      }
      
      const data = await response.json();
      
      // Validate that we actually got lighthouse data
      if (!data?.lighthouseResult?.categories?.performance) {
        console.warn('[PSI] Réponse reçue mais sans données Lighthouse valides');
        if (attempt < 2) continue;
        return null;
      }
      
      console.log('[PSI] ✅ Données PageSpeed récupérées avec succès');
      return data;
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      console.error(`[PSI] ${isAbort ? 'Timeout' : 'Erreur réseau'} (tentative ${attempt}):`, error);
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function checkSafeBrowsing(url: string): Promise<{ safe: boolean; threats: string[] }> {
  const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_API_KEY}`;
  
  console.log('[SafeBrowsing] Vérification sécurité...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: { clientId: "crawlers-fr", clientVersion: "2.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });
    
    if (!response.ok) {
      console.error('[SafeBrowsing] Erreur API:', response.status);
      return { safe: true, threats: [] };
    }
    
    const data = await response.json();
    const threats = data.matches?.map((m: any) => m.threatType) || [];
    
    return { safe: threats.length === 0, threats };
  } catch (error) {
    console.error('[SafeBrowsing] Erreur:', error);
    return { safe: true, threats: [] };
  }
}

// ==================== RECOMMENDATIONS GENERATOR ====================

function generateRecommendations(
  scores: any, 
  htmlAnalysis: HtmlAnalysis, 
  psiData: any,
  insights: ExpertInsights
): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];
  const audits = psiData?.lighthouseResult?.audits || {};
  
  // === PERFORMANCE RECOMMENDATIONS ===
  const lcpMs = audits['largest-contentful-paint']?.numericValue || 0;
  const lcpSeconds = (lcpMs / 1000).toFixed(1);
  
  if (lcpMs > 2500) {
    recommendations.push({
      id: 'lcp-slow',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'LCP trop lent : contenu principal inaccessible rapidement',
      description: `Votre Largest Contentful Paint (LCP) est de ${lcpSeconds}s, bien au-delà du seuil recommandé de 2.5s.`,
      strengths: ["La page se charge et répond au serveur"],
      weaknesses: [
        `LCP actuel : ${lcpSeconds}s (objectif < 2.5s)`,
        "Les crawlers IA peuvent abandonner avant chargement complet"
      ],
      fixes: [
        "Convertir les images en WebP/AVIF",
        "Implémenter le lazy loading",
        "Activer la compression Brotli",
        "Utiliser un CDN"
      ]
    });
  }
  
  const tbtMs = audits['total-blocking-time']?.numericValue || 0;
  if (tbtMs > 300) {
    recommendations.push({
      id: 'tbt-high',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'JavaScript bloquant : interactivité dégradée',
      description: `Le TBT de ${Math.round(tbtMs)}ms dépasse le seuil de 200ms.`,
      weaknesses: [`TBT actuel : ${Math.round(tbtMs)}ms (objectif < 200ms)`],
      fixes: ["Code splitting", "Différer les scripts non critiques", "Utiliser SSR"]
    });
  }
  
  // === CONTENT DENSITY RECOMMENDATION ===
  if (insights.contentDensity.verdict === 'critical' || insights.contentDensity.verdict === 'warning') {
    recommendations.push({
      id: 'thin-content-ratio',
      priority: insights.contentDensity.verdict === 'critical' ? 'critical' : 'important',
      category: 'contenu',
      icon: insights.contentDensity.verdict === 'critical' ? '🔴' : '🟠',
      title: 'Ratio code/texte trop faible (Thin Content)',
      description: `Seulement ${insights.contentDensity.ratio}% du HTML correspond à du texte visible. Les moteurs de recherche et LLM peinent à extraire du contenu pertinent.`,
      weaknesses: [
        `Ratio actuel : ${insights.contentDensity.ratio}% (recommandé > 15%)`,
        `HTML total : ${Math.round(insights.contentDensity.htmlSize / 1024)}KB`,
        `Texte visible : ${Math.round(insights.contentDensity.textSize / 1024)}KB`
      ],
      fixes: [
        "Réduire le JavaScript et CSS inline",
        "Supprimer le code HTML inutile",
        "Enrichir le contenu textuel visible"
      ]
    });
  }
  
  // === SEMANTIC CONSISTENCY RECOMMENDATION ===
  if (insights.semanticConsistency.verdict === 'redundant') {
    recommendations.push({
      id: 'semantic-cannibalization',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Cannibalisation sémantique Title/H1',
      description: insights.semanticConsistency.details,
      weaknesses: [
        `Similarité : ${insights.semanticConsistency.titleH1Similarity}% (Title et H1 identiques)`,
        "Opportunité de mots-clés longue traîne perdue"
      ],
      fixes: [
        "Varier le H1 pour inclure des synonymes ou des variantes",
        "Garder le mot-clé principal dans les deux mais formuler différemment"
      ]
    });
  } else if (insights.semanticConsistency.verdict === 'inconsistent') {
    recommendations.push({
      id: 'semantic-inconsistent',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Incohérence sémantique Title/H1',
      description: insights.semanticConsistency.details,
      weaknesses: [
        `Similarité : ${insights.semanticConsistency.titleH1Similarity}% seulement`,
        "Les moteurs peuvent confondre le sujet de la page"
      ],
      fixes: [
        "Aligner le H1 sur le sujet principal du Title",
        "S'assurer que les deux traitent du même sujet"
      ]
    });
  }
  
  // === LINK PROFILE RECOMMENDATIONS ===
  if (insights.linkProfile.toxicAnchorsCount > 3) {
    recommendations.push({
      id: 'toxic-anchors',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: 'Ancres de liens génériques détectées',
      description: `${insights.linkProfile.toxicAnchorsCount} liens utilisent des ancres non-descriptives ("cliquez ici", "en savoir plus"). Ces ancres n'apportent aucune valeur SEO.`,
      weaknesses: [
        `Ancres toxiques : ${insights.linkProfile.toxicAnchors.slice(0, 5).join(', ')}`,
        "Aucun contexte sémantique pour les crawlers"
      ],
      fixes: [
        "Remplacer par des ancres descriptives contenant des mots-clés",
        "Exemple : 'Découvrez nos services SEO' au lieu de 'cliquez ici'"
      ]
    });
  }
  
  // === JSON-LD RECOMMENDATIONS ===
  if (insights.jsonLdValidation.parseErrors.length > 0) {
    recommendations.push({
      id: 'jsonld-errors',
      priority: 'critical',
      category: 'ia',
      icon: '🔴',
      title: 'Données structurées JSON-LD invalides',
      description: 'Des erreurs de syntaxe JSON ont été détectées. Google et les LLM ne peuvent pas lire ces données.',
      weaknesses: insights.jsonLdValidation.parseErrors,
      fixes: [
        "Valider le JSON avec jsonlint.com",
        "Vérifier les virgules et guillemets manquants",
        "Tester avec Google Rich Results Test"
      ]
    });
  } else if (insights.jsonLdValidation.count === 0) {
    recommendations.push({
      id: 'no-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Données structurées absentes',
      description: 'Aucun balisage Schema.org détecté. Les LLM manquent de contexte structuré.',
      fixes: [
        "Implémenter Organization et WebSite au minimum",
        "Ajouter FAQPage pour les sections FAQ"
      ]
    });
  }
  
  // === STANDARD SEO RECOMMENDATIONS ===
  if (!htmlAnalysis.hasTitle) {
    recommendations.push({
      id: 'no-title',
      priority: 'critical',
      category: 'technique',
      icon: '🔴',
      title: 'Balise Title absente',
      description: 'Aucune balise <title> détectée.',
      fixes: ["Ajouter une balise <title> unique de 50-60 caractères"]
    });
  }
  
  if (htmlAnalysis.h1Count === 0) {
    recommendations.push({
      id: 'no-h1',
      priority: 'critical',
      category: 'contenu',
      icon: '🔴',
      title: 'Balise H1 absente',
      description: 'Aucune balise H1 détectée.',
      fixes: ["Ajouter exactement une balise <h1> par page"]
    });
  }
  
  if (!htmlAnalysis.isHttps) {
    recommendations.push({
      id: 'no-https',
      priority: 'critical',
      category: 'securite',
      icon: '🔴',
      title: 'HTTPS non activé',
      description: 'Le site utilise HTTP non sécurisé.',
      fixes: ["Obtenir un certificat SSL via Let's Encrypt"]
    });
  }
  
  // === BROKEN LINKS RECOMMENDATION ===
  if (insights.brokenLinks && insights.brokenLinks.broken.length > 0) {
    const brokenCount = insights.brokenLinks.broken.length;
    const brokenUrls = insights.brokenLinks.broken.slice(0, 3).map(b => `${b.anchor || b.url.substring(0, 40)} (${b.status || 'timeout'})`);
    
    recommendations.push({
      id: 'broken-links',
      priority: brokenCount > 2 ? 'critical' : 'important',
      category: 'technique',
      icon: brokenCount > 2 ? '🔴' : '🟠',
      title: `${brokenCount} lien${brokenCount > 1 ? 's' : ''} cassé${brokenCount > 1 ? 's' : ''} détecté${brokenCount > 1 ? 's' : ''}`,
      description: `Des liens pointent vers des pages inexistantes (erreur 404/500). Cela nuit à l'expérience utilisateur et au crawl SEO.`,
      weaknesses: [
        `${brokenCount} lien${brokenCount > 1 ? 's' : ''} cassé${brokenCount > 1 ? 's' : ''} sur ${insights.brokenLinks.checked} vérifiés`,
        ...brokenUrls
      ],
      fixes: [
        "Supprimer ou corriger les liens vers les pages inexistantes",
        "Mettre en place des redirections 301 si les pages ont été déplacées",
        "Utiliser un outil de monitoring des liens cassés"
      ]
    });
  }
  
  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, optional: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

// ==================== AI NARRATIVE GENERATION ====================

async function generateNarrativeIntroduction(
  domain: string,
  url: string,
  totalScore: number,
  scores: any,
  htmlAnalysis: HtmlAnalysis,
  insights: ExpertInsights,
  meta: AuditMeta,
  lang: string = 'fr'
): Promise<{ presentation: string; strengths: string; improvement: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) return null;
  
  try {
    console.log('[AI] Génération introduction narrative...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { 
            role: 'system', 
            content: `Tu es un consultant SEO senior. Tu dois générer une introduction structurée en 3 paragraphes pour un audit technique SEO Expert. RÈGLE ABSOLUE: Tu DOIS désigner le site analysé EXCLUSIVEMENT par son NOM DE DOMAINE fourni dans le prompt. Ne jamais inventer, déduire ou halluciner un nom de marque ou une description générique. Réponds UNIQUEMENT en JSON valide. LANGUE DE RÉDACTION: ${lang === 'fr' ? 'français' : lang === 'es' ? 'espagnol' : 'anglais'}. Rédige TOUT le contenu dans cette langue.`
          },
          { 
            role: 'user', 
            content: `Analyse pour le site "${domain}" (${url}). ⚠️ Le nom à utiliser dans le texte est "${domain}", jamais un autre nom.

DONNÉES TECHNIQUES:
- Score total: ${totalScore}/200 (Fiabilité audit: ${Math.round(meta.reliabilityScore * 100)}%)
- Mode de rendu: ${meta.renderingMode === 'dynamic_rendered' ? 'JavaScript rendu' : 'Statique'}
- Performance: ${scores.performance.score}/40 (LCP: ${(scores.performance.lcp / 1000).toFixed(1)}s)
- Technique: ${scores.technical.score}/50
- Sémantique: ${scores.semantic.score}/60 (Mots: ${htmlAnalysis.wordCount})
- IA/GEO: ${scores.aiReady.score}/30 (Schema: ${htmlAnalysis.schemaTypes.join(', ') || 'aucun'})

INSIGHTS EXPERTS:
- Ratio code/texte: ${insights.contentDensity.ratio}% (${insights.contentDensity.verdict})
- Cohérence Title/H1: ${insights.semanticConsistency.titleH1Similarity}% (${insights.semanticConsistency.verdict})
- Liens internes: ${insights.linkProfile.internal}, externes: ${insights.linkProfile.external}
- Ancres toxiques: ${insights.linkProfile.toxicAnchorsCount}
- JSON-LD valide: ${insights.jsonLdValidation.valid ? 'Oui' : 'Non'}

Titre: "${htmlAnalysis.titleContent}"
Meta: "${htmlAnalysis.metaDescContent?.substring(0, 100) || 'absente'}"

LANGUE: Rédige en ${lang === 'fr' ? 'français' : lang === 'es' ? 'espagnol' : 'anglais'}.

Réponds avec ce JSON:
{
  "presentation": "Paragraphe 1: Présentation du site, secteur d'activité déduit, zone géo, publics cibles.",
  "strengths": "Paragraphe 2: Un point technique positif ET un point sémantique positif avec contexte concurrentiel.",
  "improvement": "Paragraphe 3: Une donnée moins bonne, sa conséquence technique/SEO/GEO, pourquoi c'est prioritaire."
}`
          }
        ],
        temperature: 0.4,
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        let jsonContent = content;
        if (content.includes('```json')) {
          jsonContent = content.split('```json')[1].split('```')[0].trim();
        } else if (content.includes('```')) {
          jsonContent = content.split('```')[1].split('```')[0].trim();
        }
        console.log('[AI] ✅ Introduction générée');
        return JSON.parse(jsonContent);
      }
    }
  } catch (error) {
    console.error('[AI] Erreur génération:', error);
  }
  
  return null;
}

// ==================== MAIN SERVER ====================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  const ipCheck = checkIpRate(clientIp, 'audit-expert-seo', 15, 60_000);
  if (!ipCheck.allowed) return rateLimitResponse(corsHeaders, ipCheck.retryAfterMs);

  if (!acquireConcurrency('audit-expert-seo', 40)) return concurrencyResponse(corsHeaders);

  try {
    const { url, lang } = await req.json();
    const outputLang = lang || 'fr';
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validation de base de l'URL
    const trimmedUrl = url.trim();
    if (trimmedUrl.length < 4 || !trimmedUrl.includes('.')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `URL invalide: "${trimmedUrl}" n'est pas une adresse web valide. Veuillez entrer une URL complète (ex: example.com)`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Étape 1: Normalisation et résolution de l'URL
    console.log('='.repeat(60));
    console.log('[AUDIT-EXPERT-SEO] Résolution URL pour:', trimmedUrl);
    
    const { url: resolvedUrl, resolved } = await resolveWorkingUrl(trimmedUrl);
    const normalizedUrl = resolvedUrl;
    const domain = extractDomain(normalizedUrl);
    
    console.log(`[AUDIT-EXPERT-SEO] URL résolue: ${normalizedUrl} (résolu automatiquement: ${resolved})`);
    console.log('='.repeat(60));
    
    // Step 2: Smart Fetch with JS fallback
    let smartFetchResult: SmartFetchResult;
    try {
      smartFetchResult = await smartFetch(normalizedUrl);
    } catch (fetchError) {
      console.error('[SmartFetch] Erreur critique:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
      const isConnectionError = errorMessage.includes('ECONNREFUSED') || 
                                 errorMessage.includes('Connection refused') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('abort') ||
                                 errorMessage.includes('ENOTFOUND') ||
                                 errorMessage.includes('getaddrinfo');
      
      // Si la résolution a échoué, essayer une dernière fois avec www
      if (!resolved && !normalizedUrl.includes('www.')) {
        console.log('[SmartFetch] Tentative avec www...');
        const wwwUrl = normalizedUrl.replace('https://', 'https://www.');
        try {
          smartFetchResult = await smartFetch(wwwUrl);
          // Si ça marche, on continue avec cette URL
          console.log('[SmartFetch] ✅ Succès avec www');
        } catch {
          // Échec définitif
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: isConnectionError 
                ? `Site inaccessible: Le serveur de "${domain}" ne répond pas. Vérifiez que l'URL est correcte et que le site est en ligne.`
                : `Impossible d'accéder à "${domain}": ${errorMessage}. Vérifiez l'orthographe de l'URL.` 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: isConnectionError 
              ? `Site inaccessible: Le serveur de "${domain}" ne répond pas. Vérifiez que l'URL est correcte et que le site est en ligne.`
              : `Impossible d'accéder à "${domain}": ${errorMessage}. Vérifiez l'orthographe de l'URL.` 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Check for blocking error
    if (!smartFetchResult.selfAudit.isReliable && smartFetchResult.selfAudit.reliabilityScore < 0.4) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RENDERING_REQUIRED',
          message: smartFetchResult.selfAudit.reason,
          meta: {
            scannedAt: new Date().toISOString(),
            renderingMode: smartFetchResult.renderingMode,
            reliabilityScore: smartFetchResult.selfAudit.reliabilityScore,
            blockingError: smartFetchResult.selfAudit.reason
          }
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Step 2: Run all checks in parallel (including broken links)
    const doc = new DOMParser().parseFromString(smartFetchResult.html, 'text/html');
    
    const [psiData, safeBrowsing, robotsAnalysis, brokenLinksAnalysis] = await Promise.all([
      fetchPageSpeedData(normalizedUrl),
      checkSafeBrowsing(normalizedUrl),
      checkRobotsTxt(normalizedUrl),
      doc ? checkBrokenLinks(doc, normalizedUrl) : Promise.resolve({ total: 0, broken: [], checked: 0, corsBlocked: 0, verdict: 'optimal' as const })
    ]);
    
    // Step 3: DOM-based HTML analysis
    const htmlAnalysis = analyzeHtmlWithDOM(smartFetchResult.html, normalizedUrl);
    
    // Gestion gracieuse si PageSpeed a échoué (psiData peut être null)
    const categories = psiData?.lighthouseResult?.categories || {};
    const audits = psiData?.lighthouseResult?.audits || {};
    
    // Calculate scores
    const psiPerformance = categories.performance?.score || 0;
    const psiSeo = categories.seo?.score || 0;
    
    const performanceScore = Math.round(psiPerformance * 40);
    const technicalScore = Math.round(psiSeo * 30) + 20;
    
    let semanticScore = 0;
    if (htmlAnalysis.hasTitle && htmlAnalysis.titleLength <= 70) semanticScore += 10;
    if (htmlAnalysis.hasMetaDesc) semanticScore += 10;
    if (htmlAnalysis.h1Count === 1) semanticScore += 20;
    if (htmlAnalysis.wordCount >= 500) semanticScore += 20;
    
    let aiReadyScore = 0;
    if (htmlAnalysis.hasSchemaOrg) {
      aiReadyScore += 15;
      if (htmlAnalysis.insights?.jsonLdValidation?.isJsGenerated) {
        aiReadyScore -= 3;
        console.log('[Audit-Expert-SEO] ⚠️ Schema is JS-generated — AI Ready score penalized (-3)');
      }
    }
    if (robotsAnalysis.exists && robotsAnalysis.permissive) aiReadyScore += 15;
    
    // Bonus/penalty for broken links (affects technical score)
    let brokenLinksBonus = 0;
    if (brokenLinksAnalysis.verdict === 'optimal') {
      brokenLinksBonus = 5; // Bonus for no broken links
    } else if (brokenLinksAnalysis.verdict === 'critical') {
      brokenLinksBonus = -10; // Penalty for many broken links
    } else {
      brokenLinksBonus = -3; // Small penalty for few broken links
    }
    
    let securityScore = 0;
    if (htmlAnalysis.isHttps) securityScore += 10;
    if (safeBrowsing.safe) securityScore += 10;
    
    // Apply reliability factor to total score (with broken links adjustment)
    const rawTotalScore = performanceScore + technicalScore + semanticScore + aiReadyScore + securityScore + brokenLinksBonus;
    const totalScore = Math.round(Math.max(0, rawTotalScore) * smartFetchResult.selfAudit.reliabilityScore);
    
    const scores = {
      performance: {
        score: performanceScore,
        maxScore: 40,
        psiPerformance: Math.round(psiPerformance * 100),
        lcp: audits['largest-contentful-paint']?.numericValue || 0,
        fcp: audits['first-contentful-paint']?.numericValue || 0,
        cls: audits['cumulative-layout-shift']?.numericValue || 0,
        tbt: audits['total-blocking-time']?.numericValue || 0,
      },
      technical: {
        score: technicalScore + brokenLinksBonus,
        maxScore: 50,
        psiSeo: Math.round(psiSeo * 100),
        httpStatus: 200,
        isHttps: htmlAnalysis.isHttps,
        brokenLinksCount: brokenLinksAnalysis.broken.length,
        brokenLinksChecked: brokenLinksAnalysis.checked,
      },
      semantic: {
        score: semanticScore,
        maxScore: 60,
        hasTitle: htmlAnalysis.hasTitle,
        titleLength: htmlAnalysis.titleLength,
        hasMetaDesc: htmlAnalysis.hasMetaDesc,
        metaDescLength: htmlAnalysis.metaDescLength,
        hasUniqueH1: htmlAnalysis.h1Count === 1,
        h1Count: htmlAnalysis.h1Count,
        wordCount: htmlAnalysis.wordCount,
      },
      aiReady: {
        score: aiReadyScore,
        maxScore: 30,
        hasSchemaOrg: htmlAnalysis.hasSchemaOrg,
        schemaTypes: htmlAnalysis.schemaTypes,
        hasRobotsTxt: robotsAnalysis.exists,
        robotsPermissive: robotsAnalysis.permissive,
        allowsAIBots: robotsAnalysis.allowsAIBots,
      },
      security: {
        score: securityScore,
        maxScore: 20,
        isHttps: htmlAnalysis.isHttps,
        safeBrowsingOk: safeBrowsing.safe,
        threats: safeBrowsing.threats,
      },
    };
    
    const meta: AuditMeta = {
      scannedAt: new Date().toISOString(),
      renderingMode: smartFetchResult.renderingMode,
      reliabilityScore: smartFetchResult.selfAudit.reliabilityScore,
    };
    
    // Add broken links to insights
    const enrichedInsights = {
      ...htmlAnalysis.insights,
      brokenLinks: brokenLinksAnalysis
    };
    
    const recommendations = generateRecommendations(scores, htmlAnalysis, psiData, enrichedInsights);
    
    // Generate AI narrative
    const introduction = await generateNarrativeIntroduction(
      domain, normalizedUrl, totalScore, scores, htmlAnalysis, enrichedInsights, meta, outputLang
    );
    
    console.log('='.repeat(60));
    console.log(`[AUDIT-EXPERT-SEO] ✅ Audit terminé. Score: ${totalScore}/200 (Fiabilité: ${Math.round(meta.reliabilityScore * 100)}%)`);
    console.log('='.repeat(60));
    
    const responseData = {
      success: true,
      data: {
        url: normalizedUrl,
        domain,
        meta,
        totalScore,
        maxScore: 200,
        scores,
        insights: enrichedInsights,
        recommendations,
        introduction,
        rawData: {
          psi: { categories, audits: Object.keys(audits).slice(0, 10) },
          safeBrowsing,
          htmlAnalysis: {
            ...htmlAnalysis,
            insights: undefined // Already in insights field
          },
          robotsAnalysis
        }
      }
    };

    // Save raw audit data (fire-and-forget)
    try {
      const authHeader = req.headers.get('Authorization') || '';
      if (authHeader) {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          saveRawAuditData({
            userId: user.id, url: normalizedUrl, domain,
            auditType: 'technical',
            rawPayload: responseData.data,
            sourceFunctions: ['audit-expert-seo'],
          }).catch(() => {});
        }
      }
    } catch {}

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[AUDIT-EXPERT-SEO] Erreur:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Audit failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    releaseConcurrency('audit-expert-seo');
  }
});
