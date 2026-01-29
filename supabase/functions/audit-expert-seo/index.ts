import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser, Element, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_API_KEY = "AIzaSyALHaypJWTqbt8K1klhQkYeLPRBjaOs2hc";

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
  wordCount: number;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  isHttps: boolean;
  insights: ExpertInsights;
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

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  return normalized;
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
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
      
      const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY');
      
      if (BROWSERLESS_API_KEY) {
        try {
          // Browserless.io /content endpoint for full HTML rendering
          const renderUrl = `https://chrome.browserless.io/content?token=${BROWSERLESS_API_KEY}`;
          
          // User-Agent identique au fetch initial pour éviter les blocages
          const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 CrawlersFR/2.0';
          
          const renderController = new AbortController();
          const renderTimeoutId = setTimeout(() => renderController.abort(), 30000); // 30s timeout for rendering
          
          const renderResponse = await fetch(renderUrl, {
            method: 'POST',
            signal: renderController.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: url,
              // Optimisation: bloquer les ressources inutiles pour accélérer et réduire les coûts
              rejectResourceTypes: ['image', 'media', 'font'],
              // Attendre que le réseau soit inactif (JS chargé)
              waitFor: 3000,
              gotoOptions: { 
                waitUntil: 'networkidle0',
                timeout: 25000
              },
              // Passer le même User-Agent
              userAgent: userAgent
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
        console.log('[SmartFetch] ⚠️ BROWSERLESS_API_KEY non configurée dans les secrets - fallback JS impossible');
        console.log('[SmartFetch] 💡 Configurez la clé API Browserless.io pour activer le rendu des SPA');
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
  
  // Extract H1 tags using DOM
  const h1Elements = doc.querySelectorAll('h1');
  const h1Contents: string[] = [];
  for (let i = 0; i < h1Elements.length; i++) {
    const h1Text = (h1Elements[i] as Element).textContent?.trim() || '';
    if (h1Text) h1Contents.push(h1Text);
  }
  
  // === ÉTAPE 2 : Analyse JSON-LD AVANT suppression des scripts ===
  const jsonLdValidation = analyzeJsonLd(doc);
  console.log(`[JSON-LD] Trouvé ${jsonLdValidation.count} scripts, types: ${jsonLdValidation.types.join(', ') || 'aucun'}`);
  
  // === ÉTAPE 3 : Analyse du profil de liens (DOM complet) ===
  const linkProfile = analyzeLinkProfile(doc, url);
  
  // === ÉTAPE 4 : Nettoyage du DOM pour calcul du texte ===
  const scriptsAndStyles = doc.querySelectorAll('script, style, noscript');
  scriptsAndStyles.forEach(el => (el as Element).remove());
  
  // === ÉTAPE 5 : Calcul du word count sur le texte propre ===
  const bodyText = doc.body?.textContent || '';
  const cleanText = bodyText.replace(/\\s+/g, ' ').trim();
  const wordCount = cleanText.split(' ').filter(w => w.length > 2).length;
  
  // Semantic consistency (title vs H1)
  const semanticConsistency = analyzeSemanticConsistency(titleContent, h1Contents[0] || '');
  
  // Content density (code vs text ratio)
  const contentDensity = analyzeContentDensity(html, cleanText);
  
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
    wordCount,
    hasSchemaOrg: jsonLdValidation.valid && jsonLdValidation.count > 0,
    schemaTypes: jsonLdValidation.types,
    isHttps: url.startsWith('https://'),
    insights
  };
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
    wordCount: 0,
    hasSchemaOrg: false,
    schemaTypes: [],
    isHttps: url.startsWith('https://'),
    insights: {
      semanticConsistency: { titleH1Similarity: 0, verdict: 'unknown', details: 'Analyse impossible' },
      contentDensity: { ratio: 0, verdict: 'unknown', htmlSize: 0, textSize: 0 },
      linkProfile: { internal: 0, external: 0, total: 0, toxicAnchors: [], toxicAnchorsCount: 0 },
      jsonLdValidation: { valid: false, types: [], parseErrors: [], count: 0 }
    }
  };
}

// ==================== EXPERT INSIGHTS FUNCTIONS ====================

function analyzeJsonLd(doc: HTMLDocument): JsonLdValidation {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const types: string[] = [];
  const parseErrors: string[] = [];
  let validCount = 0;
  
  console.log(`[JSON-LD] Analyse de ${scripts.length} balises script[type="application/ld+json"]`);
  
  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i] as Element;
    const content = script.textContent || '';
    
    try {
      const parsed = JSON.parse(content);
      validCount++;
      
      // Fonction récursive pour extraire tous les @type dans des structures imbriquées
      const findTypes = (node: any): void => {
        if (!node || typeof node !== 'object') return;
        
        // Si c'est un tableau, parcourir chaque élément
        if (Array.isArray(node)) {
          node.forEach(item => findTypes(item));
          return;
        }
        
        // Extraire le @type s'il existe
        if (node['@type']) {
          if (Array.isArray(node['@type'])) {
            types.push(...node['@type']);
          } else {
            types.push(node['@type']);
          }
        }
        
        // Traiter @graph s'il existe
        if (node['@graph'] && Array.isArray(node['@graph'])) {
          findTypes(node['@graph']);
        }
        
        // Parcourir récursivement les autres propriétés (sauf @graph déjà traité)
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
    count: scripts.length
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

async function fetchPageSpeedData(url: string): Promise<any> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&key=${GOOGLE_API_KEY}`;
  
  console.log('[PSI] Récupération données PageSpeed...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[PSI] Erreur:', error);
      
      // Gestion gracieuse des erreurs PageSpeed (NO_FCP, timeout, quota, etc.)
      const errorMessage = error?.error?.message || 'PageSpeed API error';
      const isRenderingError = errorMessage.includes('NO_FCP') || 
                               errorMessage.includes('NO_LCP') ||
                               errorMessage.includes('page did not paint');
      const isQuotaError = response.status === 429 || errorMessage.includes('quota');
      
      console.log(`[PSI] ⚠️ Erreur gérée: ${isRenderingError ? 'rendu impossible' : isQuotaError ? 'quota dépassé' : 'autre'}`);
      
      // Retourner des données vides au lieu de throw - l'audit continuera avec les autres analyses
      return {
        lighthouseResult: {
          categories: {
            performance: { score: null },
            seo: { score: null },
            'best-practices': { score: null }
          },
          audits: {}
        },
        psiError: {
          type: isRenderingError ? 'rendering_failed' : isQuotaError ? 'quota_exceeded' : 'api_error',
          message: errorMessage
        }
      };
    }
    
    return await response.json();
  } catch (error) {
    console.error('[PSI] Erreur réseau:', error);
    
    // Erreur réseau ou timeout - retourner des données vides
    return {
      lighthouseResult: {
        categories: {
          performance: { score: null },
          seo: { score: null },
          'best-practices': { score: null }
        },
        audits: {}
      },
      psiError: {
        type: 'network_error',
        message: error instanceof Error ? error.message : 'Network error'
      }
    };
  }
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
  meta: AuditMeta
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
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: `Tu es un consultant SEO senior. Tu dois générer une introduction structurée en 3 paragraphes pour un audit technique SEO Expert. Réponds UNIQUEMENT en JSON valide.`
          },
          { 
            role: 'user', 
            content: `Analyse pour ${domain} (${url}):

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const normalizedUrl = normalizeUrl(url);
    const domain = extractDomain(normalizedUrl);
    
    console.log('='.repeat(60));
    console.log('[AUDIT-EXPERT-SEO] Démarrage audit pour:', normalizedUrl);
    console.log('='.repeat(60));
    
    // Step 1: Smart Fetch with JS fallback
    let smartFetchResult: SmartFetchResult;
    try {
      smartFetchResult = await smartFetch(normalizedUrl);
    } catch (fetchError) {
      console.error('[SmartFetch] Erreur critique:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
      const isConnectionError = errorMessage.includes('ECONNREFUSED') || 
                                 errorMessage.includes('Connection refused') ||
                                 errorMessage.includes('timeout') ||
                                 errorMessage.includes('abort');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: isConnectionError 
            ? `Site inaccessible: Le serveur de ${url} ne répond pas. Vérifiez que l'URL est correcte et que le site est en ligne.`
            : `Impossible d'accéder à l'URL: ${errorMessage}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    
    const categories = psiData.lighthouseResult?.categories || {};
    const audits = psiData.lighthouseResult?.audits || {};
    
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
    if (htmlAnalysis.hasSchemaOrg) aiReadyScore += 15;
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
      domain, normalizedUrl, totalScore, scores, htmlAnalysis, enrichedInsights, meta
    );
    
    console.log('='.repeat(60));
    console.log(`[AUDIT-EXPERT-SEO] ✅ Audit terminé. Score: ${totalScore}/200 (Fiabilité: ${Math.round(meta.reliabilityScore * 100)}%)`);
    console.log('='.repeat(60));
    
    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[AUDIT-EXPERT-SEO] Erreur:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Audit failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
