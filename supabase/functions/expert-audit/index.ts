import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapping des recommandations vers les types de fix pour le générateur de code
const RECOMMENDATION_TO_FIX_MAP: Record<string, { fixType: string | null; category: string }> = {
  'title_too_long': { fixType: 'fix_title', category: 'seo' },
  'missing_title': { fixType: 'fix_title', category: 'seo' },
  'missing_meta_desc': { fixType: 'fix_meta_desc', category: 'seo' },
  'short_meta_desc': { fixType: 'fix_meta_desc', category: 'seo' },
  'multiple_h1': { fixType: 'fix_h1', category: 'seo' },
  'missing_h1': { fixType: 'fix_h1', category: 'seo' },
  'no_schema_org': { fixType: 'fix_jsonld', category: 'seo' },
  'not_https': { fixType: 'fix_https_redirect', category: 'performance' },
  'low_content': { fixType: null, category: 'seo' },
  'performance_critical': { fixType: 'fix_lazy_images', category: 'performance' },
  'robots_restrictive': { fixType: null, category: 'seo' },
};

// Fonction pour générer un résumé promptable
function generatePromptSummary(rec: { id: string; title: string; description: string; priority: string; fixes?: string[] }): string {
  const priorityLabel = rec.priority === 'critical' ? '🔴 CRITIQUE' : rec.priority === 'important' ? '🟠 IMPORTANT' : '🟢 OPTIONNEL';
  const fixesText = rec.fixes && rec.fixes.length > 0 ? ` Actions: ${rec.fixes.slice(0, 2).join('; ')}` : '';
  return `[${priorityLabel}] ${rec.title} - ${rec.description.substring(0, 150)}${fixesText}`;
}

// Fonction pour sauvegarder les recommandations dans le registre
async function saveRecommendationsToRegistry(
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
  domain: string,
  url: string,
  auditType: 'technical' | 'strategic',
  recommendations: Array<{ id: string; title: string; description: string; priority: string; category: string; fixes?: string[] }>
): Promise<void> {
  try {
    // Créer un client avec le token de l'utilisateur
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Récupérer l'utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ Utilisateur non authentifié - registre non mis à jour');
      return;
    }
    
    // Supprimer les anciennes recommandations pour ce domaine/type
    await supabase
      .from('audit_recommendations_registry')
      .delete()
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('audit_type', auditType);
    
    // Préparer les nouvelles recommandations
    const registryEntries = recommendations.map(rec => {
      const mapping = RECOMMENDATION_TO_FIX_MAP[rec.id] || { fixType: null, category: rec.category };
      return {
        user_id: user.id,
        domain,
        url,
        audit_type: auditType,
        recommendation_id: rec.id,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        priority: rec.priority,
        fix_type: mapping.fixType,
        fix_data: { fixes: rec.fixes || [] },
        prompt_summary: generatePromptSummary(rec),
        is_resolved: false,
      };
    });
    
    // Insérer les nouvelles recommandations
    const { error: insertError } = await supabase
      .from('audit_recommendations_registry')
      .insert(registryEntries);
    
    if (insertError) {
      console.error('❌ Erreur sauvegarde registre:', insertError);
    } else {
      console.log(`✅ ${registryEntries.length} recommandations sauvegardées dans le registre (${auditType})`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde du registre:', error);
  }
}

const GOOGLE_API_KEY = "AIzaSyALHaypJWTqbt8K1klhQkYeLPRBjaOs2hc";

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
}

interface RobotsAnalysis {
  exists: boolean;
  permissive: boolean;
  content: string;
}

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

async function fetchPageSpeedData(url: string): Promise<any> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&category=BEST_PRACTICES&key=${GOOGLE_API_KEY}`;
  
  console.log('Fetching PageSpeed data...');
  const response = await fetch(apiUrl);
  
  if (!response.ok) {
    const error = await response.json();
    console.error('PSI Error:', error);
    throw new Error(error?.error?.message || 'PageSpeed API error');
  }
  
  return await response.json();
}

async function checkSafeBrowsing(url: string): Promise<{ safe: boolean; threats: string[] }> {
  const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_API_KEY}`;
  
  console.log('Checking Safe Browsing...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: {
          clientId: "crawlers-fr",
          clientVersion: "1.0"
        },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });
    
    if (!response.ok) {
      console.error('Safe Browsing API error:', response.status);
      return { safe: true, threats: [] }; // Assume safe if API fails
    }
    
    const data = await response.json();
    const threats = data.matches?.map((m: any) => m.threatType) || [];
    
    return { safe: threats.length === 0, threats };
  } catch (error) {
    console.error('Safe Browsing check failed:', error);
    return { safe: true, threats: [] };
  }
}

async function analyzeHtml(url: string): Promise<HtmlAnalysis> {
  console.log('Analyzing HTML...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0; +https://crawlers.fr)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titleContent = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) 
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    const metaDescContent = metaDescMatch ? metaDescMatch[1].trim() : '';
    
    // Extract H1 tags
    const h1Matches = html.match(/<h1[^>]*>([^<]*)<\/h1>/gi) || [];
    const h1Contents = h1Matches.map(h1 => {
      const content = h1.replace(/<[^>]*>/g, '').trim();
      return content;
    });
    
    // Count words (simple approximation)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = textContent.split(' ').filter(w => w.length > 2).length;
    
    // Check for Schema.org JSON-LD
    const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    const schemaTypes: string[] = [];
    
    for (const match of schemaMatches) {
      try {
        const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
        const parsed = JSON.parse(jsonContent);
        if (parsed['@type']) {
          schemaTypes.push(parsed['@type']);
        }
        if (parsed['@graph']) {
          for (const item of parsed['@graph']) {
            if (item['@type']) schemaTypes.push(item['@type']);
          }
        }
      } catch {
        // Invalid JSON-LD
      }
    }

    // Detect GTM / GA4 / analytics
    const hasGTM = /googletagmanager\.com\/gtm\.js/i.test(html) || /GTM-[A-Z0-9]+/i.test(html);
    const hasGA4 = /googletagmanager\.com\/gtag\/js\?id=G-/i.test(html) || /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-/i.test(html);
    
    // Detect images missing alt text
    const allImages = html.match(/<img[^>]*>/gi) || [];
    const imagesMissingAlt = allImages.filter(img => {
      const hasAlt = /alt\s*=\s*["'][^"']+["']/i.test(img);
      return !hasAlt;
    }).length;
    
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
      hasSchemaOrg: schemaTypes.length > 0,
      schemaTypes,
      isHttps: url.startsWith('https://'),
      hasGTM,
      hasGA4,
      imagesTotal: allImages.length,
      imagesMissingAlt,
    };
  } catch (error) {
    console.error('HTML analysis failed:', error);
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
      hasGTM: false,
      hasGA4: false,
      imagesTotal: 0,
      imagesMissingAlt: 0,
    };
  }
}

async function checkRobotsTxt(url: string): Promise<RobotsAnalysis> {
  console.log('Checking robots.txt...');
  
  try {
    const domain = new URL(url).origin;
    const robotsUrl = `${domain}/robots.txt`;
    
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrawlersFR/1.0)'
      }
    });
    
    if (!response.ok) {
      return { exists: false, permissive: true, content: '' };
    }
    
    const content = await response.text();
    
    // Check if robots.txt blocks everything
    const hasDisallowAll = /Disallow:\s*\/\s*$/m.test(content) && /User-agent:\s*\*/m.test(content);
    
    return {
      exists: true,
      permissive: !hasDisallowAll,
      content: content.substring(0, 500)
    };
  } catch {
    return { exists: false, permissive: true, content: '' };
  }
}

interface CrawlersResult {
  bots: Array<{
    name: string;
    userAgent: string;
    company: string;
    status: 'allowed' | 'blocked' | 'unknown';
    reason?: string;
    blockSource?: 'robots.txt' | 'meta-tag' | 'http-status';
    lineNumber?: number;
  }>;
  allowsAIBots: {
    gptBot: boolean;
    claudeBot: boolean;
    perplexityBot: boolean;
    googleExtended: boolean;
    appleBotExtended: boolean;
    ccBot: boolean;
  };
  allowedCount: number;
  blockedCount: number;
}

async function checkCrawlers(url: string): Promise<CrawlersResult | null> {
  console.log('Checking AI crawlers...');
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration for crawlers check');
      return null;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/check-crawlers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      console.error('Crawlers check failed:', response.status);
      return null;
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data?.bots) {
      console.error('Invalid crawlers response:', result.error);
      return null;
    }
    
    const bots = result.data.bots;
    
    // Extract individual bot status
    const getBotStatus = (name: string) => {
      const bot = bots.find((b: { name: string }) => b.name === name);
      return bot?.status === 'allowed';
    };
    
    const allowsAIBots = {
      gptBot: getBotStatus('GPTBot'),
      claudeBot: getBotStatus('ClaudeBot'),
      perplexityBot: getBotStatus('PerplexityBot'),
      googleExtended: getBotStatus('Google-Extended'),
      appleBotExtended: getBotStatus('Applebot-Extended'),
      ccBot: getBotStatus('CCBot'),
    };
    
    const allowedCount = bots.filter((b: { status: string }) => b.status === 'allowed').length;
    const blockedCount = bots.filter((b: { status: string }) => b.status === 'blocked').length;
    
    console.log(`AI Crawlers check complete: ${allowedCount} allowed, ${blockedCount} blocked`);
    
    return {
      bots,
      allowsAIBots,
      allowedCount,
      blockedCount,
    };
  } catch (error) {
    console.error('Error checking crawlers:', error);
    return null;
  }
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

function generateRecommendations(scores: any, htmlAnalysis: HtmlAnalysis, psiData: any): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];
  const audits = psiData?.lighthouseResult?.audits || {};
  
  // Performance recommendations
  const lcpMs = audits['largest-contentful-paint']?.numericValue || 0;
  const lcpSeconds = (lcpMs / 1000).toFixed(1);
  
  if (lcpMs > 2500) {
    recommendations.push({
      id: 'lcp-slow',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'LCP trop lent : contenu principal inaccessible rapidement',
      description: `Votre Largest Contentful Paint (LCP) est de ${lcpSeconds}s, bien au-delà du seuil recommandé de 2.5s. Cela signifie que vos visiteurs attendent trop longtemps avant de voir le contenu principal, ce qui augmente significativement le taux de rebond et pénalise votre référencement Google.`,
      strengths: [
        "La page se charge et répond au serveur",
        "Le contenu est accessible après chargement complet"
      ],
      weaknesses: [
        `LCP actuel : ${lcpSeconds}s (objectif < 2.5s)`,
        "Les utilisateurs mobiles sont particulièrement impactés (connexions plus lentes)",
        "Google utilise le LCP comme facteur de classement Core Web Vitals",
        "Les crawlers IA (GPTBot, ClaudeBot) peuvent abandonner avant chargement complet"
      ],
      fixes: [
        "Convertir toutes les images en format WebP ou AVIF (gain moyen 30-50% de taille)",
        "Implémenter le lazy loading sur les images sous la ligne de flottaison avec loading='lazy'",
        "Activer la compression Brotli côté serveur (meilleure que Gzip)",
        "Optimiser le TTFB en utilisant un CDN (Cloudflare, Fastly) et le caching HTTP",
        "Précharger les ressources critiques avec <link rel='preload'> pour fonts et hero images",
        "Réduire les requêtes bloquantes en différant les CSS non critiques"
      ]
    });
  } else if (lcpMs <= 2500) {
    // Add as strength context for other recommendations
  }
  
  const tbtMs = audits['total-blocking-time']?.numericValue || 0;
  if (tbtMs > 300) {
    recommendations.push({
      id: 'tbt-high',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'JavaScript bloquant : interactivité dégradée',
      description: `Le Total Blocking Time (TBT) de ${Math.round(tbtMs)}ms dépasse largement le seuil de 200ms. Le thread principal est monopolisé par des scripts JavaScript, empêchant toute interaction utilisateur pendant ce temps.`,
      strengths: [
        "Le JavaScript est exécuté correctement",
        "Les fonctionnalités interactives finissent par se charger"
      ],
      weaknesses: [
        `TBT actuel : ${Math.round(tbtMs)}ms (objectif < 200ms)`,
        "L'interface semble 'gelée' pendant le chargement",
        "Impact négatif sur le score Performance de Lighthouse",
        "Les utilisateurs impatients quittent avant l'interactivité complète"
      ],
      fixes: [
        "Diviser le bundle JavaScript en chunks avec code splitting (React.lazy, dynamic imports)",
        "Différer les scripts non critiques avec les attributs defer ou async",
        "Supprimer ou remplacer les bibliothèques JavaScript lourdes (moment.js → date-fns)",
        "Utiliser le tree-shaking pour éliminer le code mort",
        "Déplacer les scripts analytics et third-party en chargement asynchrone",
        "Implémenter le Server-Side Rendering (SSR) pour le contenu critique"
      ]
    });
  }
  
  const cls = audits['cumulative-layout-shift']?.numericValue || 0;
  if (cls > 0.1) {
    recommendations.push({
      id: 'cls-high',
      priority: 'important',
      category: 'performance',
      icon: '🟠',
      title: 'Instabilité visuelle : éléments qui bougent au chargement',
      description: `Votre Cumulative Layout Shift (CLS) de ${cls.toFixed(3)} indique que des éléments de la page se déplacent de manière inattendue pendant le chargement, créant une expérience frustrante pour l'utilisateur.`,
      strengths: [
        "Le layout final est stable une fois chargé",
        "La structure HTML est correctement définie"
      ],
      weaknesses: [
        `CLS actuel : ${cls.toFixed(3)} (objectif < 0.1)`,
        "Les utilisateurs peuvent cliquer accidentellement sur le mauvais élément",
        "Pénalité Core Web Vitals appliquée par Google",
        "Expérience utilisateur dégradée, surtout sur mobile"
      ],
      fixes: [
        "Définir des dimensions explicites (width/height) sur toutes les images et vidéos",
        "Réserver l'espace pour les publicités et embeds avec aspect-ratio CSS",
        "Éviter d'injecter du contenu au-dessus du contenu existant sans réservation d'espace",
        "Utiliser font-display: swap avec des fonts de fallback de taille similaire",
        "Précharger les fonts critiques avec <link rel='preload' as='font'>",
        "Tester avec Chrome DevTools > Performance > Layout Shift Regions"
      ]
    });
  }
  
  // Technical SEO recommendations
  if (!htmlAnalysis.hasTitle) {
    recommendations.push({
      id: 'no-title',
      priority: 'critical',
      category: 'technique',
      icon: '🔴',
      title: 'Balise Title absente : page non identifiable',
      description: 'Votre page ne possède pas de balise <title>. C\'est le premier élément analysé par Google et les moteurs de recherche pour comprendre le sujet de votre page. Sans titre, votre page apparaîtra avec un libellé générique ou l\'URL dans les résultats de recherche.',
      weaknesses: [
        "Aucune balise <title> détectée dans le <head>",
        "Impossible de se positionner correctement dans les SERP",
        "Les partages sociaux afficheront l'URL au lieu d'un titre attractif",
        "Les LLM ne peuvent pas identifier le sujet principal de la page"
      ],
      fixes: [
        "Ajouter une balise <title> unique dans le <head> de la page",
        "Limiter le titre à 50-60 caractères pour éviter la troncature",
        "Inclure le mot-clé principal au début du titre",
        "Formuler le titre de manière engageante pour inciter au clic",
        "Éviter les titres dupliqués entre les pages du site"
      ]
    });
  } else if (htmlAnalysis.titleLength > 70) {
    recommendations.push({
      id: 'title-long',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: 'Titre trop long : troncature dans les résultats de recherche',
      description: `Votre titre fait ${htmlAnalysis.titleLength} caractères. Google tronque généralement les titres au-delà de 60 caractères, ce qui peut couper des informations importantes et réduire le taux de clic.`,
      strengths: [
        "Une balise <title> est présente",
        `Titre actuel : "${htmlAnalysis.titleContent?.substring(0, 50)}..."`
      ],
      weaknesses: [
        `Longueur actuelle : ${htmlAnalysis.titleLength} caractères (recommandé : 50-60)`,
        "Le titre sera tronqué avec '...' dans les résultats Google",
        "Les informations clés en fin de titre ne seront pas visibles"
      ],
      fixes: [
        "Réduire le titre à 60 caractères maximum",
        "Placer le mot-clé principal dans les 30 premiers caractères",
        "Supprimer les mots inutiles (le, la, les, de, etc.)",
        "Tester l'affichage avec un outil de prévisualisation SERP"
      ]
    });
  } else {
    // Title is good - can be used as strength elsewhere
  }
  
  if (!htmlAnalysis.hasMetaDesc) {
    recommendations.push({
      id: 'no-meta-desc',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Meta Description manquante : opportunité de clic perdue',
      description: 'Votre page n\'a pas de meta description. Google génèrera automatiquement un extrait à partir du contenu de la page, mais ce texte sera souvent moins pertinent et moins incitatif qu\'une description rédigée manuellement.',
      weaknesses: [
        "Aucune balise <meta name='description'> détectée",
        "Google choisira un extrait aléatoire du contenu",
        "Taux de clic (CTR) potentiellement réduit",
        "Opportunité manquée d'inclure un appel à l'action"
      ],
      fixes: [
        "Ajouter <meta name='description' content='...'> dans le <head>",
        "Rédiger 150-160 caractères maximum pour éviter la troncature",
        "Inclure le mot-clé principal naturellement",
        "Ajouter un appel à l'action (Découvrez, Apprenez, Obtenez...)",
        "Rendre la description unique pour chaque page"
      ]
    });
  }
  
  if (htmlAnalysis.h1Count === 0) {
    recommendations.push({
      id: 'no-h1',
      priority: 'critical',
      category: 'contenu',
      icon: '🔴',
      title: 'Balise H1 absente : structure sémantique brisée',
      description: 'Votre page ne contient aucune balise H1. Le H1 est le titre principal de votre contenu et joue un rôle crucial pour le SEO et l\'accessibilité. Les moteurs de recherche et les LLM utilisent cette balise pour comprendre le sujet central de la page.',
      weaknesses: [
        "Aucune balise <h1> détectée sur la page",
        "Les moteurs de recherche ne peuvent pas identifier le sujet principal",
        "Structure de heading non conforme aux standards d'accessibilité",
        "Les LLM (ChatGPT, Perplexity) auront du mal à extraire le contexte"
      ],
      fixes: [
        "Ajouter exactement une balise <h1> par page",
        "Placer le H1 en haut du contenu principal (pas dans le header/nav)",
        "Inclure le mot-clé principal dans le H1",
        "S'assurer que le H1 résume le contenu de la page en une phrase",
        "Vérifier que les autres titres suivent la hiérarchie (H2, H3, etc.)"
      ]
    });
  } else if (htmlAnalysis.h1Count > 1) {
    recommendations.push({
      id: 'multiple-h1',
      priority: 'important',
      category: 'contenu',
      icon: '🟡',
      title: 'Plusieurs H1 détectés : confusion sémantique',
      description: `Votre page contient ${htmlAnalysis.h1Count} balises H1. Bien que HTML5 autorise techniquement plusieurs H1 dans des sections, il est recommandé d'en avoir un seul pour une hiérarchie claire et un meilleur référencement.`,
      strengths: [
        "Des balises de titre sont présentes sur la page",
        "La structure de heading existe"
      ],
      weaknesses: [
        `${htmlAnalysis.h1Count} balises H1 détectées au lieu d'une seule`,
        "Les moteurs de recherche peuvent confondre le sujet principal",
        "Dilution du poids sémantique du titre principal"
      ],
      fixes: [
        "Conserver uniquement le H1 le plus représentatif du contenu",
        "Convertir les autres H1 en H2 ou H3 selon leur importance",
        "Vérifier que le H1 restant contient le mot-clé principal",
        "Utiliser des outils comme HeadingsMap pour visualiser la hiérarchie"
      ]
    });
  }
  
  if (htmlAnalysis.wordCount < 500) {
    recommendations.push({
      id: 'thin-content',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Contenu trop léger : risque de thin content',
      description: `Votre page ne contient qu'environ ${htmlAnalysis.wordCount} mots. Les pages avec un contenu limité ont moins de chances de se positionner sur des requêtes compétitives et offrent moins de valeur aux utilisateurs et aux LLM.`,
      strengths: [
        "Du contenu textuel est présent sur la page",
        "La page n'est pas vide"
      ],
      weaknesses: [
        `Seulement ~${htmlAnalysis.wordCount} mots détectés (recommandé : 800+)`,
        "Difficulté à couvrir un sujet en profondeur",
        "Moins d'opportunités pour les mots-clés longue traîne",
        "Les LLM disposeront de peu de contexte pour les citations"
      ],
      fixes: [
        "Enrichir le contenu pour atteindre 800-1500 mots selon le sujet",
        "Ajouter des sections FAQ pour répondre aux questions fréquentes",
        "Inclure des exemples concrets, études de cas ou statistiques",
        "Développer les sous-sections avec des H2/H3 et du contenu détaillé",
        "Ajouter des tableaux comparatifs ou des listes à puces pour structurer l'information"
      ]
    });
  }
  
  // AI/GEO recommendations
  if (!htmlAnalysis.hasSchemaOrg) {
    recommendations.push({
      id: 'no-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Données structurées absentes : invisibilité pour les IA',
      description: 'Votre page ne contient pas de données structurées Schema.org (JSON-LD). Ces balises permettent aux moteurs de recherche et aux LLM de comprendre précisément le contexte et le type de contenu de votre page.',
      weaknesses: [
        "Aucun balisage JSON-LD ou Schema.org détecté",
        "Pas de rich snippets possibles dans les résultats Google",
        "Les LLM (ChatGPT, Perplexity, Claude) manquent de contexte structuré",
        "Opportunité manquée pour les featured snippets et les réponses IA"
      ],
      fixes: [
        "Implémenter Schema.org en JSON-LD (plus simple que microdata)",
        "Pour un site vitrine : ajouter Organization et WebSite",
        "Pour des articles : ajouter Article avec author, datePublished",
        "Pour des produits : ajouter Product avec price, availability",
        "Ajouter FAQPage pour les sections FAQ (très citable par les LLM)",
        "Valider avec Google Rich Results Test : search.google.com/test/rich-results"
      ]
    });
  } else {
    recommendations.push({
      id: 'schema-present',
      priority: 'optional',
      category: 'ia',
      icon: '✅',
      title: 'Données structurées détectées : bonne base GEO',
      description: `Votre page contient des données structurées Schema.org : ${htmlAnalysis.schemaTypes.join(', ')}. C'est un excellent point de départ pour la visibilité auprès des LLM et les rich snippets Google.`,
      strengths: [
        `Types Schema détectés : ${htmlAnalysis.schemaTypes.join(', ')}`,
        "Les moteurs de recherche peuvent créer des rich snippets",
        "Les LLM ont un contexte structuré pour les citations"
      ],
      fixes: [
        "Enrichir avec des types complémentaires (FAQPage, HowTo, Review)",
        "Vérifier que tous les champs requis sont renseignés",
        "Tester régulièrement avec le Rich Results Test de Google"
      ]
    });
  }
  
  // Security recommendations  
  if (!htmlAnalysis.isHttps) {
    recommendations.push({
      id: 'no-https',
      priority: 'critical',
      category: 'securite',
      icon: '🔴',
      title: 'HTTPS non activé : site marqué "Non sécurisé"',
      description: 'Votre site n\'utilise pas HTTPS. Les navigateurs modernes affichent un avertissement "Non sécurisé" et Google pénalise les sites HTTP dans son classement. C\'est un critère éliminatoire pour le référencement moderne.',
      weaknesses: [
        "Le site est accessible en HTTP non chiffré",
        "Chrome affiche 'Non sécurisé' dans la barre d'adresse",
        "Pénalité de classement Google appliquée",
        "Les données utilisateur transitent en clair (problème RGPD)",
        "Certains navigateurs bloquent les fonctionnalités avancées (géolocalisation, etc.)"
      ],
      fixes: [
        "Obtenir un certificat SSL gratuit via Let's Encrypt",
        "Configurer la redirection HTTP → HTTPS au niveau serveur",
        "Mettre à jour tous les liens internes en HTTPS",
        "Configurer HSTS (HTTP Strict Transport Security)",
        "Vérifier qu'aucune ressource n'est chargée en HTTP (mixed content)"
      ]
    });
  }
  
  // Mobile friendliness
  const psiSeoScore = psiData?.lighthouseResult?.categories?.seo?.score || 0;
  if (psiSeoScore < 0.9) {
    const tapTargets = audits['tap-targets'];
    if (tapTargets?.score < 1) {
      recommendations.push({
        id: 'mobile-tap',
        priority: 'critical',
        category: 'technique',
        icon: '🔴',
        title: 'Éléments tactiles trop petits : navigation mobile difficile',
        description: 'Les zones cliquables de votre site sont trop petites ou trop proches les unes des autres. Sur mobile, les utilisateurs auront du mal à cliquer précisément, ce qui génère de la frustration et des erreurs de navigation.',
        weaknesses: [
          "Boutons et liens trop petits pour les doigts",
          "Espacement insuffisant entre les éléments interactifs",
          "Pénalité mobile-first indexing de Google",
          "Taux de rebond mobile probablement élevé"
        ],
        fixes: [
          "Agrandir toutes les zones tactiles à 48x48 pixels minimum",
          "Ajouter un padding de 8px minimum entre les éléments cliquables",
          "Utiliser des boutons plutôt que des liens texte pour les actions importantes",
          "Tester sur de vrais appareils mobiles, pas seulement en émulation",
          "Utiliser Chrome DevTools > Device Mode pour simuler différents écrans"
        ]
      });
    }
  }
  
  // Robots.txt analysis
  if (!scores.aiReady?.robotsPermissive) {
    recommendations.push({
      id: 'robots-restrictive',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Robots.txt restrictif : crawlers IA potentiellement bloqués',
      description: 'Votre fichier robots.txt pourrait bloquer les crawlers des LLM (GPTBot, ClaudeBot, PerplexityBot). Cela réduit vos chances d\'être cité dans les réponses génératives.',
      weaknesses: [
        "Le robots.txt contient des règles Disallow restrictives",
        "Les bots IA modernes pourraient être bloqués",
        "Réduction de la visibilité dans les moteurs génératifs"
      ],
      fixes: [
        "Vérifier que GPTBot, ClaudeBot, PerplexityBot ne sont pas bloqués",
        "Ajouter des règles Allow explicites pour les crawlers IA si nécessaire",
        "Supprimer les Disallow: / génériques qui bloquent tout",
        "Tester avec robots.txt Tester de Google Search Console"
      ]
    });
  }
  
  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, optional: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

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
    
    console.log('Starting Expert Audit for:', normalizedUrl);
    
    // Run all checks in parallel
    const [psiData, safeBrowsing, htmlAnalysis, robotsAnalysis, crawlersResult] = await Promise.all([
      fetchPageSpeedData(normalizedUrl),
      checkSafeBrowsing(normalizedUrl),
      analyzeHtml(normalizedUrl),
      checkRobotsTxt(normalizedUrl),
      checkCrawlers(normalizedUrl)
    ]);
    
    const categories = psiData.lighthouseResult?.categories || {};
    const audits = psiData.lighthouseResult?.audits || {};
    
    // Calculate scores
    const psiPerformance = categories.performance?.score || 0;
    const psiSeo = categories.seo?.score || 0;
    
    // A. Performance (40 pts)
    const performanceScore = Math.round(psiPerformance * 40);
    
    // B. Technical (50 pts) = PSI SEO * 30 + HTTP 200 = 20
    const httpStatusOk = true; // We got the page, so status is OK
    const technicalScore = Math.round(psiSeo * 30) + (httpStatusOk ? 20 : 0);
    
    // C. Semantic (60 pts)
    let semanticScore = 0;
    if (htmlAnalysis.hasTitle && htmlAnalysis.titleLength <= 70) semanticScore += 10;
    if (htmlAnalysis.hasMetaDesc) semanticScore += 10;
    if (htmlAnalysis.h1Count === 1) semanticScore += 20;
    if (htmlAnalysis.wordCount >= 500) semanticScore += 20;
    
    // D. AI Ready (30 pts)
    let aiReadyScore = 0;
    if (htmlAnalysis.hasSchemaOrg) aiReadyScore += 15;
    if (robotsAnalysis.exists && robotsAnalysis.permissive) aiReadyScore += 15;
    
    // E. Security (20 pts)
    let securityScore = 0;
    if (htmlAnalysis.isHttps) securityScore += 10;
    if (safeBrowsing.safe) securityScore += 10;
    
    const totalScore = performanceScore + technicalScore + semanticScore + aiReadyScore + securityScore;
    
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
        score: technicalScore,
        maxScore: 50,
        psiSeo: Math.round(psiSeo * 100),
        httpStatus: 200,
        isHttps: htmlAnalysis.isHttps,
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
        imagesTotal: htmlAnalysis.imagesTotal,
        imagesMissingAlt: htmlAnalysis.imagesMissingAlt,
        hasGTM: htmlAnalysis.hasGTM,
        hasGA4: htmlAnalysis.hasGA4,
      },
      aiReady: {
        score: aiReadyScore,
        maxScore: 30,
        hasSchemaOrg: htmlAnalysis.hasSchemaOrg,
        schemaTypes: htmlAnalysis.schemaTypes,
        hasRobotsTxt: robotsAnalysis.exists,
        robotsPermissive: robotsAnalysis.permissive,
        allowsAIBots: crawlersResult?.allowsAIBots,
      },
      security: {
        score: securityScore,
        maxScore: 20,
        isHttps: htmlAnalysis.isHttps,
        safeBrowsingOk: safeBrowsing.safe,
        threats: safeBrowsing.threats,
      },
    };
    
    const recommendations = generateRecommendations(scores, htmlAnalysis, psiData);
    
    // Generate narrative introduction using AI
    let introduction = null;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (LOVABLE_API_KEY) {
      try {
        console.log('Generating narrative introduction...');
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
                content: `Tu es un expert SEO technique. Tu dois générer une introduction structurée en 3 paragraphes pour un audit technique SEO. Réponds UNIQUEMENT en JSON valide.`
              },
              { 
                role: 'user', 
                content: `Analyse les données suivantes pour le site ${domain} (${normalizedUrl}) et génère 3 paragraphes d'introduction:

DONNÉES TECHNIQUES:
- Score total: ${totalScore}/200
- Performance: ${performanceScore}/40 (LCP: ${(audits['largest-contentful-paint']?.numericValue / 1000).toFixed(1)}s, TBT: ${Math.round(audits['total-blocking-time']?.numericValue || 0)}ms)
- Technique SEO: ${technicalScore}/50 (Score PSI SEO: ${Math.round(psiSeo * 100)}%)
- Sémantique: ${semanticScore}/60 (Titre: ${htmlAnalysis.hasTitle ? 'oui' : 'non'}, Meta desc: ${htmlAnalysis.hasMetaDesc ? 'oui' : 'non'}, H1: ${htmlAnalysis.h1Count}, Mots: ${htmlAnalysis.wordCount})
- Préparation IA: ${aiReadyScore}/30 (Schema.org: ${htmlAnalysis.hasSchemaOrg ? 'oui' : 'non'}, Types: ${htmlAnalysis.schemaTypes.join(', ') || 'aucun'})
- Sécurité: ${securityScore}/20 (HTTPS: ${htmlAnalysis.isHttps ? 'oui' : 'non'})
- Titre: "${htmlAnalysis.titleContent}"
- Meta description: "${htmlAnalysis.metaDescContent?.substring(0, 100) || 'absente'}"

Réponds avec ce JSON exact:
{
  "presentation": "Paragraphe 1 (4-5 phrases): Présentation du site, core business déduit du titre/contenu, secteur d'activité, zone géographique probable, ancienneté estimée, publics cibles.",
  "strengths": "Paragraphe 2 (4-5 phrases): Un aspect technique positif ET un aspect sémantique/référencement positif. Expliquer pourquoi ce sont des atouts dans le contexte concurrentiel actuel.",
  "improvement": "Paragraphe 3 (4-5 phrases): Une donnée moins bonne, sa conséquence technique/SEO, et pourquoi c'est prioritaire à corriger dans le contexte concurrentiel actuel."
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
            introduction = JSON.parse(jsonContent);
            console.log('Narrative introduction generated successfully');
          }
        } else {
          console.error('AI introduction generation failed:', aiResponse.status);
        }
      } catch (aiError) {
        console.error('Error generating introduction:', aiError);
        // Continue without introduction - not critical
      }
    }
    
    console.log('Expert Audit complete. Score:', totalScore, '/200');
    
    // Sauvegarder les recommandations dans le registre (async, non-bloquant)
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (authHeader && supabaseUrl && supabaseKey) {
      // Lancer en arrière-plan (ne pas bloquer la réponse)
      saveRecommendationsToRegistry(
        supabaseUrl,
        supabaseKey,
        authHeader,
        domain,
        normalizedUrl,
        'technical',
        recommendations
      ).catch(err => console.error('Erreur sauvegarde registre:', err));
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: normalizedUrl,
          domain,
          scannedAt: new Date().toISOString(),
          totalScore,
          maxScore: 200,
          scores,
          recommendations,
          introduction,
          rawData: {
            psi: { categories, audits: Object.keys(audits).slice(0, 10) },
            safeBrowsing,
            htmlAnalysis,
            robotsAnalysis,
            crawlersData: crawlersResult,
          }
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Expert Audit error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Audit failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
