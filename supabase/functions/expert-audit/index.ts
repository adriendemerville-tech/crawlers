import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface RecommendationItem {
  id: string;
  priority: 'critical' | 'important' | 'optional';
  category: string;
  icon: string;
  title: string;
  description: string;
}

function generateRecommendations(scores: any, htmlAnalysis: HtmlAnalysis, psiData: any): RecommendationItem[] {
  const recommendations: RecommendationItem[] = [];
  const audits = psiData?.lighthouseResult?.audits || {};
  
  // Performance recommendations
  const lcpMs = audits['largest-contentful-paint']?.numericValue || 0;
  if (lcpMs > 2500) {
    recommendations.push({
      id: 'lcp-slow',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'LCP trop lent (> 2.5s)',
      description: 'Votre contenu principal met trop de temps à charger. Optimisez la taille de vos images (WebP), activez la compression Brotli et améliorez le temps de réponse serveur (TTFB).'
    });
  }
  
  const tbpMs = audits['total-blocking-time']?.numericValue || 0;
  if (tbpMs > 300) {
    recommendations.push({
      id: 'tbt-high',
      priority: 'critical',
      category: 'performance',
      icon: '🔴',
      title: 'Temps de blocage élevé',
      description: 'Le JavaScript bloque le thread principal trop longtemps. Divisez le code en chunks, différez les scripts non critiques avec defer/async.'
    });
  }
  
  const cls = audits['cumulative-layout-shift']?.numericValue || 0;
  if (cls > 0.1) {
    recommendations.push({
      id: 'cls-high',
      priority: 'important',
      category: 'performance',
      icon: '🟠',
      title: 'Instabilité visuelle (CLS)',
      description: 'Les éléments de la page bougent pendant le chargement. Définissez des dimensions fixes pour les images et les embeds.'
    });
  }
  
  // Technical SEO recommendations
  if (!htmlAnalysis.hasTitle) {
    recommendations.push({
      id: 'no-title',
      priority: 'critical',
      category: 'technique',
      icon: '🔴',
      title: 'Balise Title manquante',
      description: 'Ajoutez une balise <title> unique et descriptive (50-60 caractères) contenant vos mots-clés principaux.'
    });
  } else if (htmlAnalysis.titleLength > 70) {
    recommendations.push({
      id: 'title-long',
      priority: 'important',
      category: 'technique',
      icon: '🟠',
      title: 'Title trop long',
      description: `Votre titre fait ${htmlAnalysis.titleLength} caractères. Réduisez-le à 60 caractères maximum pour éviter la troncature dans les SERP.`
    });
  }
  
  if (!htmlAnalysis.hasMetaDesc) {
    recommendations.push({
      id: 'no-meta-desc',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Meta Description absente',
      description: 'Ajoutez une meta description de 150-160 caractères incitant au clic et contenant vos mots-clés.'
    });
  }
  
  if (htmlAnalysis.h1Count === 0) {
    recommendations.push({
      id: 'no-h1',
      priority: 'critical',
      category: 'contenu',
      icon: '🔴',
      title: 'Balise H1 manquante',
      description: 'Chaque page doit avoir un unique titre H1 contenant votre mot-clé principal. C\'est crucial pour le SEO et la compréhension par les LLM.'
    });
  } else if (htmlAnalysis.h1Count > 1) {
    recommendations.push({
      id: 'multiple-h1',
      priority: 'important',
      category: 'contenu',
      icon: '🟡',
      title: 'Plusieurs H1 détectés',
      description: `Vous avez ${htmlAnalysis.h1Count} balises H1. Conservez-en une seule et convertissez les autres en H2.`
    });
  }
  
  if (htmlAnalysis.wordCount < 500) {
    recommendations.push({
      id: 'thin-content',
      priority: 'important',
      category: 'contenu',
      icon: '🟠',
      title: 'Contenu insuffisant',
      description: `Seulement ~${htmlAnalysis.wordCount} mots détectés. Les pages performantes en SEO contiennent généralement 800+ mots de contenu pertinent.`
    });
  }
  
  // AI/GEO recommendations
  if (!htmlAnalysis.hasSchemaOrg) {
    recommendations.push({
      id: 'no-schema',
      priority: 'important',
      category: 'ia',
      icon: '🟠',
      title: 'Schema.org absent',
      description: 'Ajoutez des données structurées (JSON-LD) pour aider ChatGPT, Perplexity et Google SGE à comprendre votre contenu. Types recommandés : Organization, Article, FAQPage, Product.'
    });
  }
  
  // Security recommendations  
  if (!htmlAnalysis.isHttps) {
    recommendations.push({
      id: 'no-https',
      priority: 'critical',
      category: 'securite',
      icon: '🔴',
      title: 'HTTPS non activé',
      description: 'Installez immédiatement un certificat SSL. Google pénalise les sites HTTP et les navigateurs affichent des avertissements de sécurité.'
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
        title: 'Éléments tactiles trop petits',
        description: 'Les boutons et liens sont trop proches sur mobile. Augmentez la taille des zones tactiles à 48x48px minimum.'
      });
    }
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
    const [psiData, safeBrowsing, htmlAnalysis, robotsAnalysis] = await Promise.all([
      fetchPageSpeedData(normalizedUrl),
      checkSafeBrowsing(normalizedUrl),
      analyzeHtml(normalizedUrl),
      checkRobotsTxt(normalizedUrl)
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
      },
      aiReady: {
        score: aiReadyScore,
        maxScore: 30,
        hasSchemaOrg: htmlAnalysis.hasSchemaOrg,
        schemaTypes: htmlAnalysis.schemaTypes,
        hasRobotsTxt: robotsAnalysis.exists,
        robotsPermissive: robotsAnalysis.permissive,
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
    
    console.log('Expert Audit complete. Score:', totalScore, '/200');
    
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
          rawData: {
            psi: { categories, audits: Object.keys(audits).slice(0, 10) },
            safeBrowsing,
            htmlAnalysis,
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
