import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ══════════════════════════════════════════════════════════════
// INTERFACES - MOTEUR ARCHITECTE GÉNÉRATIF V2
// ══════════════════════════════════════════════════════════════

interface FixConfig {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'tracking' | 'hallucination' | 'strategic';
  label: string;
  description: string;
  enabled: boolean;
  priority: 'critical' | 'important' | 'optional';
  data?: Record<string, any>; // Pour passer titre, mots-clés, paragraphes, etc.
}

interface RegistryRecommendation {
  id: string;
  recommendation_id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  fix_type: string | null;
  fix_data: Record<string, any>;
  prompt_summary: string;
  audit_type: 'technical' | 'strategic';
}

interface AttributionConfig {
  enabled: boolean;
  anchorText: string;
}

interface GenerateRequest {
  fixes: FixConfig[];
  siteName: string;
  siteUrl: string;
  language: string;
  includeRegistryContext?: boolean;
  useAI?: boolean; // NOUVEAU: Activer la génération IA pour contenu stratégique
  attribution?: AttributionConfig | null; // NOUVEAU: Configuration attribution Crawlers
}

interface AIGeneratedContent {
  faqItems?: Array<{ question: string; answer: string }>;
  blogSection?: { title: string; intro: string; paragraphs: string[] };
  semanticMeta?: { keywords: string[]; description: string };
}

// ══════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ══════════════════════════════════════════════════════════════

async function fetchRecommendationsRegistry(
  supabaseUrl: string,
  supabaseKey: string,
  authHeader: string,
  domain: string
): Promise<RegistryRecommendation[]> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('⚠️ Utilisateur non authentifié - registre non accessible');
      return [];
    }
    
    const { data, error } = await supabase
      .from('audit_recommendations_registry')
      .select('*')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .eq('is_resolved', false)
      .order('priority', { ascending: true });
    
    if (error) {
      console.error('❌ Erreur lecture registre:', error);
      return [];
    }
    
    console.log(`📋 ${data?.length || 0} recommandations trouvées dans le registre pour ${domain}`);
    return data || [];
  } catch (error) {
    console.error('❌ Erreur lors de la lecture du registre:', error);
    return [];
  }
}

function generateRegistryContextComment(recommendations: RegistryRecommendation[]): string {
  if (recommendations.length === 0) return '';
  
  const technicalRecs = recommendations.filter(r => r.audit_type === 'technical');
  const strategicRecs = recommendations.filter(r => r.audit_type === 'strategic');
  
  let context = `\n  // ══════════════════════════════════════════════════════════════\n`;
  context += `  // 📋 CONTEXTE D'AUDIT - Recommandations actives\n`;
  context += `  // ══════════════════════════════════════════════════════════════\n`;
  
  if (technicalRecs.length > 0) {
    context += `  //\n  // 🔧 AUDIT TECHNIQUE (${technicalRecs.length} recommandations):\n`;
    technicalRecs.slice(0, 5).forEach(rec => {
      context += `  //   - ${rec.prompt_summary.substring(0, 80)}...\n`;
    });
  }
  
  if (strategicRecs.length > 0) {
    context += `  //\n  // 📈 AUDIT STRATÉGIQUE (${strategicRecs.length} recommandations):\n`;
    strategicRecs.slice(0, 5).forEach(rec => {
      context += `  //   - ${rec.prompt_summary.substring(0, 80)}...\n`;
    });
  }
  
  context += `  // ══════════════════════════════════════════════════════════════\n`;
  
  return context;
}

// ══════════════════════════════════════════════════════════════
// GÉNÉRATION IA - CONTENU STRATÉGIQUE
// ══════════════════════════════════════════════════════════════

async function generateStrategicContent(
  fixes: FixConfig[],
  siteName: string,
  siteUrl: string,
  language: string
): Promise<AIGeneratedContent> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('⚠️ LOVABLE_API_KEY non configuré - génération IA désactivée');
    return {};
  }

  const strategicFixes = fixes.filter(f => f.enabled && f.category === 'strategic');
  if (strategicFixes.length === 0) return {};

  const result: AIGeneratedContent = {};

  // Construire le prompt basé sur les fixes stratégiques demandés
  const faqFix = strategicFixes.find(f => f.id === 'inject_faq');
  const blogFix = strategicFixes.find(f => f.id === 'inject_blog_section');
  const semanticFix = strategicFixes.find(f => f.id === 'enhance_semantic_meta');

  if (!faqFix && !blogFix && !semanticFix) return {};

  console.log('🤖 Génération de contenu stratégique via Lovable AI...');

  const langLabel = language === 'fr' ? 'français' : language === 'es' ? 'espagnol' : 'anglais';

  let systemPrompt = `Tu es un expert SEO et rédacteur web spécialisé dans l'optimisation pour les moteurs de recherche et les LLM (ChatGPT, Claude, Perplexity). Tu génères du contenu de haute qualité, factuel et optimisé pour la citabilité.

IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans markdown ni texte avant/après.`;

  let userPrompt = `Génère du contenu SEO optimisé pour le site "${siteName}" (${siteUrl}).
Langue cible: ${langLabel}

Génère le JSON suivant:
{`;

  const jsonParts: string[] = [];

  if (faqFix) {
    const keywords = faqFix.data?.keywords || [];
    const sector = faqFix.data?.sector || siteName;
    const count = faqFix.data?.count || 5;
    
    jsonParts.push(`
  "faqItems": [
    // Génère ${count} FAQ pertinentes pour le secteur "${sector}"
    // Intègre les mots-clés: ${keywords.join(', ') || 'liés au secteur'}
    // Format: { "question": "...", "answer": "..." }
    // Les réponses doivent être factuelles, entre 50-100 mots, avec données chiffrées si possible
  ]`);
  }

  if (blogFix) {
    const topic = blogFix.data?.topic || `Expertise ${siteName}`;
    const targetKeywords = blogFix.data?.keywords || [];
    
    jsonParts.push(`
  "blogSection": {
    "title": "Titre SEO optimisé (50-60 caractères) sur le sujet: ${topic}",
    "intro": "Paragraphe d'introduction engageant (100-150 mots) intégrant les mots-clés: ${targetKeywords.join(', ')}",
    "paragraphs": [
      "3-4 paragraphes de contenu expert (chacun 80-120 mots)",
      "Inclure des données chiffrées, statistiques, conseils actionnables",
      "Optimisé pour la citabilité LLM"
    ]
  }`);
  }

  if (semanticFix) {
    const existingMeta = semanticFix.data?.existingMeta || '';
    const sector = semanticFix.data?.sector || siteName;
    
    jsonParts.push(`
  "semanticMeta": {
    "keywords": ["5-7 mots-clés LSI optimisés pour le secteur ${sector}"],
    "description": "Meta description optimisée (150-160 caractères) - engageante et factuelle"
  }`);
  }

  userPrompt += jsonParts.join(',') + `
}

RAPPEL: JSON valide uniquement, pas de markdown.`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('❌ Rate limit IA - génération stratégique ignorée');
        return {};
      }
      if (response.status === 402) {
        console.error('❌ Crédits IA épuisés - génération stratégique ignorée');
        return {};
      }
      console.error('❌ Erreur IA:', response.status);
      return {};
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      console.error('❌ Réponse IA vide');
      return {};
    }

    // Parser le JSON (avec nettoyage robuste)
    let jsonContent = content;
    if (content.includes('```json')) {
      jsonContent = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonContent = content.split('```')[1].split('```')[0].trim();
    }

    // Nettoyer les trailing commas
    jsonContent = jsonContent
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');

    const parsed = JSON.parse(jsonContent);
    
    if (parsed.faqItems) result.faqItems = parsed.faqItems;
    if (parsed.blogSection) result.blogSection = parsed.blogSection;
    if (parsed.semanticMeta) result.semanticMeta = parsed.semanticMeta;

    console.log('✅ Contenu stratégique généré par IA');
    return result;

  } catch (error) {
    console.error('❌ Erreur génération IA:', error);
    return {};
  }
}

// ══════════════════════════════════════════════════════════════
// GÉNÉRATEURS DE CODE - CORRECTIFS TECHNIQUES
// ══════════════════════════════════════════════════════════════

function generateFixCode(
  fix: FixConfig,
  siteName: string,
  siteUrl: string,
  language: string,
  aiContent?: AIGeneratedContent
): { fn: string; call: string } {
  switch (fix.id) {
    // ═══════════════════════════════════════════════════════════
    // CORRECTIFS SEO TECHNIQUES
    // ═══════════════════════════════════════════════════════════
    
    case 'fix_title':
      return {
        fn: `  // Correction de la balise Title
  function fixTitle() {
    var title = document.querySelector('title');
    var currentTitle = title ? title.textContent : '';
    
    // Si le titre est trop long, on le tronque
    if (currentTitle && currentTitle.length > 60) {
      var newTitle = currentTitle.substring(0, 57) + '...';
      document.title = newTitle;
      console.log('[Crawlers.fr] Title optimisé:', newTitle);
    }
    
    // Si pas de titre, on en crée un
    if (!title) {
      title = document.createElement('title');
      title.textContent = '${siteName} - Site Officiel';
      document.head.appendChild(title);
      console.log('[Crawlers.fr] Title créé');
    }
  }`,
        call: 'fixTitle();'
      };

    case 'fix_meta_desc':
      const customDesc = fix.data?.description || `Découvrez ${siteName} - Votre partenaire de confiance. Visitez notre site pour en savoir plus.`;
      return {
        fn: `  // Ajout/Optimisation de la Meta Description
  function fixMetaDescription() {
    var metaDesc = document.querySelector('meta[name="description"]');
    var newContent = '${customDesc.replace(/'/g, "\\'")}';
    
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content = newContent;
      document.head.appendChild(metaDesc);
      console.log('[Crawlers.fr] Meta description ajoutée');
    } else if (metaDesc.content.length > 160 || metaDesc.content.length < 120) {
      metaDesc.content = newContent;
      console.log('[Crawlers.fr] Meta description optimisée');
    }
  }`,
        call: 'fixMetaDescription();'
      };

    case 'fix_h1':
      return {
        fn: `  // Correction de la balise H1
  function fixH1() {
    var h1s = document.querySelectorAll('h1');
    
    if (h1s.length === 0) {
      var mainTitle = document.querySelector('header h2, .hero h2, main h2');
      if (mainTitle) {
        var newH1 = document.createElement('h1');
        newH1.className = mainTitle.className;
        newH1.textContent = mainTitle.textContent;
        mainTitle.parentNode.replaceChild(newH1, mainTitle);
        console.log('[Crawlers.fr] H1 créé depuis H2 existant');
      }
    } else if (h1s.length > 1) {
      for (var i = 1; i < h1s.length; i++) {
        var h2 = document.createElement('h2');
        h2.className = h1s[i].className;
        h2.innerHTML = h1s[i].innerHTML;
        h1s[i].parentNode.replaceChild(h2, h1s[i]);
      }
      console.log('[Crawlers.fr] H1 multiples corrigés en H2');
    }
  }`,
        call: 'fixH1();'
      };

    case 'fix_jsonld':
      const schemaType = fix.data?.schemaType || 'Organization';
      return {
        fn: `  // Injection de données structurées JSON-LD
  function injectJsonLd() {
    var existingJsonLd = document.querySelector('script[type="application/ld+json"]');
    
    if (!existingJsonLd) {
      var jsonLd = {
        "@context": "https://schema.org",
        "@type": "${schemaType}",
        "name": "${siteName}",
        "url": "${siteUrl}",
        "logo": "${siteUrl}/logo.png",
        "sameAs": [],
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "availableLanguage": ["${language === 'fr' ? 'French' : language === 'es' ? 'Spanish' : 'English'}"]
        }
      };
      
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd, null, 2);
      document.head.appendChild(script);
      console.log('[Crawlers.fr] JSON-LD Schema.org injecté');
    }
  }`,
        call: 'injectJsonLd();'
      };

    // ═══════════════════════════════════════════════════════════
    // CORRECTIFS PERFORMANCE
    // ═══════════════════════════════════════════════════════════

    case 'fix_lazy_images':
      return {
        fn: `  // Lazy Loading des images
  function enableLazyLoading() {
    var images = document.querySelectorAll('img:not([loading])');
    var viewportHeight = window.innerHeight;
    
    images.forEach(function(img) {
      var rect = img.getBoundingClientRect();
      if (rect.top > viewportHeight * 1.5) {
        img.loading = 'lazy';
        img.decoding = 'async';
      }
    });
    
    console.log('[Crawlers.fr] Lazy loading activé sur', images.length, 'images');
  }`,
        call: 'enableLazyLoading();'
      };

    case 'fix_https_redirect':
      return {
        fn: `  // Redirection HTTPS
  function forceHttps() {
    if (window.location.protocol === 'http:') {
      window.location.href = window.location.href.replace('http:', 'https:');
      console.log('[Crawlers.fr] Redirection HTTPS forcée');
    }
  }`,
        call: 'forceHttps();'
      };

    // ═══════════════════════════════════════════════════════════
    // CORRECTIFS ACCESSIBILITÉ
    // ═══════════════════════════════════════════════════════════

    case 'fix_contrast':
      return {
        fn: `  // Amélioration du contraste
  function improveContrast() {
    var elements = document.querySelectorAll('p, span, a, li, td, th, label');
    var improved = 0;
    
    elements.forEach(function(el) {
      var style = window.getComputedStyle(el);
      var color = style.color;
      var bgColor = style.backgroundColor;
      
      if (color.includes('rgb(') && bgColor.includes('rgb(')) {
        var colorBrightness = getColorBrightness(color);
        var bgBrightness = getColorBrightness(bgColor);
        var contrast = Math.abs(colorBrightness - bgBrightness);
        
        if (contrast < 125 && bgBrightness > 200) {
          el.style.color = '#374151';
          improved++;
        }
      }
    });
    
    if (improved > 0) {
      console.log('[Crawlers.fr] Contraste amélioré sur', improved, 'éléments');
    }
  }
  
  function getColorBrightness(color) {
    var rgb = color.match(/\\d+/g);
    if (!rgb || rgb.length < 3) return 128;
    return (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
  }`,
        call: 'improveContrast();'
      };

    case 'fix_alt_images':
      return {
        fn: `  // Ajout des attributs alt manquants
  function fixImageAlts() {
    var images = document.querySelectorAll('img:not([alt]), img[alt=""]');
    
    images.forEach(function(img, index) {
      var src = img.src || '';
      var filename = src.split('/').pop().split('?')[0];
      var altText = filename
        .replace(/\\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\\d+/g, '')
        .trim();
      
      if (!altText) {
        altText = 'Image ' + (index + 1) + ' - ${siteName}';
      }
      
      img.alt = altText;
    });
    
    console.log('[Crawlers.fr] Alt text ajouté à', images.length, 'images');
  }`,
        call: 'fixImageAlts();'
      };

    // ═══════════════════════════════════════════════════════════
    // TRACKING
    // ═══════════════════════════════════════════════════════════

    case 'fix_gtm':
      const gtmId = fix.data?.gtmId || 'GTM-XXXXXXX';
      return {
        fn: `  // Intégration Google Tag Manager
  function injectGTM() {
    var gtmId = '${gtmId}';
    
    if (window.google_tag_manager && window.google_tag_manager[gtmId]) {
      console.log('[Crawlers.fr] GTM déjà présent');
      return;
    }
    
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',gtmId);
    
    var noscript = document.createElement('noscript');
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.googletagmanager.com/ns.html?id=' + gtmId;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);
    
    console.log('[Crawlers.fr] Google Tag Manager injecté:', gtmId);
  }`,
        call: 'injectGTM();'
      };

    case 'fix_ga4':
      const measurementId = fix.data?.measurementId || 'G-XXXXXXXXXX';
      return {
        fn: `  // Intégration Google Analytics 4
  function injectGA4() {
    var measurementId = '${measurementId}';
    
    if (window.gtag) {
      console.log('[Crawlers.fr] Google Analytics déjà présent');
      return;
    }
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId);
    
    console.log('[Crawlers.fr] Google Analytics 4 injecté:', measurementId);
  }`,
        call: 'injectGA4();'
      };

    // ═══════════════════════════════════════════════════════════
    // CORRECTION HALLUCINATION IA
    // ═══════════════════════════════════════════════════════════

    case 'fix_hallucination':
      const hallucinationData = fix.data || {};
      const trueValue = hallucinationData.trueValue || siteName;
      const confusionFixes = (hallucinationData.confusionSources || []).slice(0, 3);
      return {
        fn: `  // Correction Hallucination IA - Injection métadonnées anti-confusion
  function fixHallucination() {
    var metas = [
      { name: 'ai-description', content: '${trueValue.replace(/'/g, "\\'")}' },
      { name: 'dc.description', content: '${trueValue.replace(/'/g, "\\'")}' },
      { property: 'og:description', content: '${trueValue.replace(/'/g, "\\'")}' }
    ];
    
    metas.forEach(function(meta) {
      var existing = document.querySelector('meta[name="' + meta.name + '"], meta[property="' + meta.property + '"]');
      if (!existing) {
        var el = document.createElement('meta');
        if (meta.name) el.setAttribute('name', meta.name);
        if (meta.property) el.setAttribute('property', meta.property);
        el.content = meta.content;
        document.head.appendChild(el);
      }
    });
    
    var clarificationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "${siteName}",
      "description": "${trueValue.replace(/"/g, '\\"').replace(/'/g, "\\'")}",
      "url": "${siteUrl}",
      "knowsAbout": ${JSON.stringify(confusionFixes.length > 0 ? confusionFixes : [siteName])}
    };
    
    var schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.setAttribute('data-crawlers-hallucination-fix', 'true');
    schemaScript.textContent = JSON.stringify(clarificationSchema, null, 2);
    document.head.appendChild(schemaScript);
    
    console.log('[Crawlers.fr] ✓ Correction hallucination IA appliquée');
  }`,
        call: 'fixHallucination();'
      };

    // ═══════════════════════════════════════════════════════════
    // NOUVEAUX CORRECTIFS STRATÉGIQUES (ARCHITECTE GÉNÉRATIF)
    // ═══════════════════════════════════════════════════════════

    case 'inject_faq':
      // Utiliser le contenu généré par IA si disponible
      const faqItems = aiContent?.faqItems || fix.data?.items || [
        { question: `Qu'est-ce que ${siteName} ?`, answer: `${siteName} est votre partenaire de confiance pour des solutions innovantes et de qualité.` },
        { question: `Comment contacter ${siteName} ?`, answer: `Vous pouvez nous contacter via notre formulaire en ligne ou par téléphone.` },
      ];
      
      const faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqItems.map((item: any) => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      };

      const faqHtml = faqItems.map((item: any, idx: number) => 
        `<div class="crawlers-faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
          <h3 itemprop="name" class="crawlers-faq-question">${item.question}</h3>
          <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
            <p itemprop="text" class="crawlers-faq-answer">${item.answer}</p>
          </div>
        </div>`
      ).join('\\n        ');

      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Section FAQ avec Schema.org FAQPage
  function injectFAQSection() {
    // Vérifier si une FAQ existe déjà
    if (document.querySelector('[itemtype="https://schema.org/FAQPage"]') || document.querySelector('.crawlers-faq-section')) {
      console.log('[Crawlers.fr] FAQ déjà présente');
      return;
    }
    
    // Créer le conteneur FAQ
    var faqSection = document.createElement('section');
    faqSection.className = 'crawlers-faq-section';
    faqSection.setAttribute('itemscope', '');
    faqSection.setAttribute('itemtype', 'https://schema.org/FAQPage');
    faqSection.innerHTML = \`
      <style>
        .crawlers-faq-section { padding: 3rem 1.5rem; background: #f9fafb; margin: 2rem 0; }
        .crawlers-faq-title { font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; text-align: center; }
        .crawlers-faq-item { background: white; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .crawlers-faq-question { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: #111827; }
        .crawlers-faq-answer { color: #4b5563; line-height: 1.6; margin: 0; }
      </style>
      <h2 class="crawlers-faq-title">Questions Fréquentes</h2>
      <div class="crawlers-faq-container">
        ${faqHtml}
      </div>
    \`;
    
    // Injecter avant le footer ou à la fin du main
    var footer = document.querySelector('footer');
    var main = document.querySelector('main');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(faqSection, footer);
    } else if (main) {
      main.appendChild(faqSection);
    } else {
      document.body.appendChild(faqSection);
    }
    
    // Injecter le JSON-LD FAQPage
    var faqSchema = ${JSON.stringify(faqJsonLd)};
    var schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.setAttribute('data-crawlers-faq', 'true');
    schemaScript.textContent = JSON.stringify(faqSchema, null, 2);
    document.head.appendChild(schemaScript);
    
    console.log('[Crawlers.fr] 🏗️ Section FAQ injectée avec ${faqItems.length} questions et Schema.org FAQPage');
  }`,
        call: 'injectFAQSection();'
      };

    case 'inject_blog_section':
      const blogData = aiContent?.blogSection || fix.data?.blog || {
        title: `Expertise ${siteName}`,
        intro: `Découvrez notre expertise et nos conseils pour vous accompagner dans vos projets.`,
        paragraphs: [
          `Notre équipe d'experts vous accompagne depuis plus de 10 ans dans vos projets les plus ambitieux.`,
          `Nous mettons notre savoir-faire au service de votre réussite avec des solutions innovantes et sur mesure.`
        ]
      };

      const blogParagraphsHtml = blogData.paragraphs.map((p: string) => 
        `<p class="crawlers-blog-paragraph">${p}</p>`
      ).join('\\n        ');

      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Section Blog/Contenu Éditorial
  function injectBlogSection() {
    if (document.querySelector('.crawlers-blog-section')) {
      console.log('[Crawlers.fr] Section blog déjà présente');
      return;
    }
    
    var blogSection = document.createElement('article');
    blogSection.className = 'crawlers-blog-section';
    blogSection.setAttribute('itemscope', '');
    blogSection.setAttribute('itemtype', 'https://schema.org/Article');
    blogSection.innerHTML = \`
      <style>
        .crawlers-blog-section { padding: 3rem 1.5rem; max-width: 800px; margin: 2rem auto; }
        .crawlers-blog-title { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; color: #111827; }
        .crawlers-blog-intro { font-size: 1.125rem; color: #4b5563; margin-bottom: 1.5rem; line-height: 1.7; font-style: italic; }
        .crawlers-blog-paragraph { color: #374151; line-height: 1.8; margin-bottom: 1rem; }
      </style>
      <h2 class="crawlers-blog-title" itemprop="headline">${blogData.title}</h2>
      <p class="crawlers-blog-intro" itemprop="description">${blogData.intro}</p>
      <div itemprop="articleBody">
        ${blogParagraphsHtml}
      </div>
      <meta itemprop="author" content="${siteName}">
      <meta itemprop="publisher" content="${siteName}">
    \`;
    
    var main = document.querySelector('main');
    var hero = document.querySelector('.hero, [class*="hero"], header + section');
    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(blogSection, hero.nextSibling);
    } else if (main) {
      main.insertBefore(blogSection, main.firstChild);
    } else {
      document.body.insertBefore(blogSection, document.body.firstChild);
    }
    
    console.log('[Crawlers.fr] 🏗️ Section blog/contenu éditorial injectée avec Schema.org Article');
  }`,
        call: 'injectBlogSection();'
      };

    case 'enhance_semantic_meta':
      const semanticData = aiContent?.semanticMeta || fix.data?.semantic || {
        keywords: [siteName, 'expertise', 'qualité', 'innovation', 'service'],
        description: `${siteName} - Votre partenaire de confiance pour des solutions innovantes et de qualité.`
      };

      return {
        fn: `  // 🏗️ ARCHITECTE: Enrichissement Sémantique des Métadonnées
  function enhanceSemanticMeta() {
    var keywords = ${JSON.stringify(semanticData.keywords)};
    var optimizedDesc = '${semanticData.description.replace(/'/g, "\\'")}';
    
    // Meta keywords (toujours utile pour certains moteurs et LLM)
    var metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = keywords.join(', ');
    
    // Open Graph enrichi
    var ogTags = [
      { property: 'og:title', content: document.title },
      { property: 'og:description', content: optimizedDesc },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: window.location.href },
      { property: 'og:site_name', content: '${siteName}' }
    ];
    
    ogTags.forEach(function(tag) {
      var existing = document.querySelector('meta[property="' + tag.property + '"]');
      if (!existing) {
        var meta = document.createElement('meta');
        meta.setAttribute('property', tag.property);
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });
    
    // Twitter Card
    var twitterTags = [
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: document.title },
      { name: 'twitter:description', content: optimizedDesc }
    ];
    
    twitterTags.forEach(function(tag) {
      var existing = document.querySelector('meta[name="' + tag.name + '"]');
      if (!existing) {
        var meta = document.createElement('meta');
        meta.name = tag.name;
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });
    
    // Dublin Core pour citations académiques/IA
    var dcTags = [
      { name: 'dc.title', content: document.title },
      { name: 'dc.description', content: optimizedDesc },
      { name: 'dc.publisher', content: '${siteName}' },
      { name: 'dc.language', content: '${language}' }
    ];
    
    dcTags.forEach(function(tag) {
      var existing = document.querySelector('meta[name="' + tag.name + '"]');
      if (!existing) {
        var meta = document.createElement('meta');
        meta.name = tag.name;
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });
    
    console.log('[Crawlers.fr] 🏗️ Métadonnées sémantiques enrichies (OG, Twitter, DC)');
  }`,
        call: 'enhanceSemanticMeta();'
      };

    case 'inject_breadcrumbs':
      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Fil d'Ariane avec Schema.org BreadcrumbList
  function injectBreadcrumbs() {
    if (document.querySelector('[itemtype="https://schema.org/BreadcrumbList"]') || document.querySelector('.crawlers-breadcrumbs')) {
      console.log('[Crawlers.fr] Fil d\\'ariane déjà présent');
      return;
    }
    
    var path = window.location.pathname.split('/').filter(Boolean);
    var breadcrumbs = [{ name: 'Accueil', url: '/' }];
    var currentPath = '';
    
    path.forEach(function(segment, index) {
      currentPath += '/' + segment;
      var name = segment.replace(/-/g, ' ').replace(/\\b\\w/g, function(l) { return l.toUpperCase(); });
      breadcrumbs.push({ name: name, url: currentPath });
    });
    
    if (breadcrumbs.length < 2) return; // Pas besoin sur la home
    
    var breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map(function(item, index) {
        return {
          "@type": "ListItem",
          "position": index + 1,
          "name": item.name,
          "item": window.location.origin + item.url
        };
      })
    };
    
    var nav = document.createElement('nav');
    nav.className = 'crawlers-breadcrumbs';
    nav.setAttribute('aria-label', 'Fil d\\'ariane');
    nav.innerHTML = \`
      <style>
        .crawlers-breadcrumbs { padding: 0.75rem 1.5rem; font-size: 0.875rem; color: #6b7280; }
        .crawlers-breadcrumbs ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .crawlers-breadcrumbs li { display: flex; align-items: center; }
        .crawlers-breadcrumbs li:not(:last-child)::after { content: '›'; margin-left: 0.5rem; color: #9ca3af; }
        .crawlers-breadcrumbs a { color: #3b82f6; text-decoration: none; }
        .crawlers-breadcrumbs a:hover { text-decoration: underline; }
      </style>
      <ol itemscope itemtype="https://schema.org/BreadcrumbList">
        \${breadcrumbs.map(function(item, index) {
          var isLast = index === breadcrumbs.length - 1;
          return '<li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem">' +
            (isLast ? '<span itemprop="name">' + item.name + '</span>' :
              '<a itemprop="item" href="' + item.url + '"><span itemprop="name">' + item.name + '</span></a>') +
            '<meta itemprop="position" content="' + (index + 1) + '">' +
            '</li>';
        }).join('')}
      </ol>
    \`;
    
    var main = document.querySelector('main');
    var header = document.querySelector('header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(nav, header.nextSibling);
    } else if (main) {
      main.insertBefore(nav, main.firstChild);
    }
    
    // Injecter le JSON-LD
    var schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.setAttribute('data-crawlers-breadcrumbs', 'true');
    schemaScript.textContent = JSON.stringify(breadcrumbSchema, null, 2);
    document.head.appendChild(schemaScript);
    
    console.log('[Crawlers.fr] 🏗️ Fil d\\'ariane injecté avec Schema.org BreadcrumbList');
  }`,
        call: 'injectBreadcrumbs();'
      };

    case 'inject_local_business':
      const localData = fix.data?.business || {
        name: siteName,
        address: '',
        city: '',
        postalCode: '',
        country: 'FR',
        phone: '',
        openingHours: 'Mo-Fr 09:00-18:00'
      };
      
      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Schema.org LocalBusiness
  function injectLocalBusiness() {
    if (document.querySelector('[data-crawlers-local-business]')) {
      console.log('[Crawlers.fr] LocalBusiness déjà présent');
      return;
    }
    
    var localBusinessSchema = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "${localData.name}",
      "url": "${siteUrl}",
      ${localData.address ? `"address": {
        "@type": "PostalAddress",
        "streetAddress": "${localData.address}",
        "addressLocality": "${localData.city}",
        "postalCode": "${localData.postalCode}",
        "addressCountry": "${localData.country}"
      },` : ''}
      ${localData.phone ? `"telephone": "${localData.phone}",` : ''}
      "openingHours": "${localData.openingHours}"
    };
    
    var schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.setAttribute('data-crawlers-local-business', 'true');
    schemaScript.textContent = JSON.stringify(localBusinessSchema, null, 2);
    document.head.appendChild(schemaScript);
    
    console.log('[Crawlers.fr] 🏗️ Schema.org LocalBusiness injecté');
  }`,
        call: 'injectLocalBusiness();'
      };

    default:
      return { fn: '', call: '' };
  }
}

// ══════════════════════════════════════════════════════════════
// GÉNÉRATION DU SCRIPT COMPLET
// ══════════════════════════════════════════════════════════════

function generateCorrectiveScript(
  fixes: FixConfig[],
  siteName: string,
  siteUrl: string,
  language: string,
  registryContext: string = '',
  aiContent?: AIGeneratedContent,
  attribution?: AttributionConfig | null
): string {
  const enabledFixes = fixes.filter(f => f.enabled);
  if (enabledFixes.length === 0 && !attribution?.enabled) return '';

  const fixFunctions: string[] = [];
  const fixCalls: string[] = [];

  // Générer les fonctions de correction
  enabledFixes.forEach(fix => {
    const { fn, call } = generateFixCode(fix, siteName, siteUrl, language, aiContent);
    if (fn) fixFunctions.push(fn);
    if (call) fixCalls.push(call);
  });

  // Ajouter la fonction d'attribution si activée
  if (attribution?.enabled) {
    const anchorText = attribution.anchorText || 'Technologie Crawlers.fr';
    fixFunctions.push(`  // Attribution Crawlers.fr (Growth & Ethical Score)
  function injectCrawlersAttribution() {
    // Vérifier si l'attribution existe déjà
    if (document.querySelector('[data-crawlers-attribution]')) return;
    
    // Créer le lien d'attribution
    var link = document.createElement('a');
    link.href = 'https://crawlers.fr';
    link.textContent = '${anchorText.replace(/'/g, "\\'")}';
    link.rel = 'dofollow';
    link.target = '_blank';
    link.setAttribute('data-crawlers-attribution', 'true');
    link.style.cssText = 'font-size: 11px; color: #64748b; text-decoration: none; opacity: 0.8; transition: opacity 0.2s;';
    link.onmouseover = function() { this.style.opacity = '1'; };
    link.onmouseout = function() { this.style.opacity = '0.8'; };
    
    // Trouver ou créer le conteneur footer
    var footer = document.querySelector('footer');
    if (footer) {
      var container = document.createElement('div');
      container.style.cssText = 'text-align: center; padding: 10px 0; border-top: 1px solid #e2e8f0; margin-top: 20px;';
      container.appendChild(link);
      footer.appendChild(container);
    } else {
      // Fallback: injecter avant </body>
      var container = document.createElement('div');
      container.style.cssText = 'text-align: center; padding: 15px 0; font-size: 11px; color: #64748b; background: #f8fafc;';
      container.appendChild(link);
      document.body.appendChild(container);
    }
    
    console.log('[Crawlers.fr] ✅ Attribution injectée');
  }`);
    fixCalls.push('injectCrawlersAttribution();');
  }

  // Date localisée
  const dateLocale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';
  const dateStr = new Date().toLocaleDateString(dateLocale);

  // Catégoriser les fixes
  const technicalFixes = enabledFixes.filter(f => ['seo', 'performance', 'accessibility'].includes(f.category));
  const trackingFixes = enabledFixes.filter(f => f.category === 'tracking');
  const strategicFixes = enabledFixes.filter(f => f.category === 'strategic');
  const hallucinationFixes = enabledFixes.filter(f => f.category === 'hallucination');

  // Construire le script IIFE
  const script = `/**
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ Crawlers.fr - ARCHITECTE GÉNÉRATIF v2.0
 * ═══════════════════════════════════════════════════════════════
 * 
 * Généré le ${dateStr}
 * Site: ${siteName}
 * URL: ${siteUrl}
 * 
 * Correctifs appliqués: ${enabledFixes.length} au total
 *   → Techniques (SEO/Perf/A11y): ${technicalFixes.length}
 *   → Tracking: ${trackingFixes.length}
 *   → Stratégiques (Contenu/FAQ/Blog): ${strategicFixes.length}
 *   → Anti-Hallucination IA: ${hallucinationFixes.length}
 * 
 * Powered by Lovable AI Gateway
 * ═══════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';
${registryContext}
  // ═══════════════════════════════════════════════════════════
  // UTILITAIRES
  // ═══════════════════════════════════════════════════════════

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // FONCTIONS DE CORRECTION
  // ═══════════════════════════════════════════════════════════

${fixFunctions.join('\n\n')}

  // ═══════════════════════════════════════════════════════════
  // EXÉCUTION SÉQUENTIELLE DES CORRECTIONS
  // ═══════════════════════════════════════════════════════════

  ready(function() {
    console.log('[Crawlers.fr] 🏗️ Architecte Génératif v2.0 - Initialisation...');
    
    try {
${fixCalls.map(call => `      ${call}`).join('\n')}
      
      console.log('[Crawlers.fr] ✅ ${enabledFixes.length} correctif(s) appliqué(s) avec succès');
      console.log('[Crawlers.fr] 📊 Techniques: ${technicalFixes.length} | Tracking: ${trackingFixes.length} | Stratégiques: ${strategicFixes.length} | Anti-Hallucination: ${hallucinationFixes.length}');
    } catch (error) {
      console.error('[Crawlers.fr] ❌ Erreur lors de l\\'application des correctifs:', error);
    }
  });

})();`;

  return script;
}

// ══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      fixes, 
      siteName, 
      siteUrl, 
      language = 'fr', 
      includeRegistryContext = true,
      useAI = true,
      attribution
    }: GenerateRequest = await req.json();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🏗️ ARCHITECTE GÉNÉRATIF v2.0 - Génération de code correctif');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📍 Site: ${siteName} (${siteUrl})`);
    console.log(`📋 Fixes demandés: ${fixes?.length || 0}`);

    if (!fixes || !Array.isArray(fixes)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Fixes array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!siteName || !siteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'siteName and siteUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const enabledFixes = fixes.filter(f => f.enabled);
    
    if (enabledFixes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          code: '', 
          fixesApplied: 0,
          message: 'No fixes enabled'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le contexte du registre si demandé
    let registryContext = '';
    let registryRecommendations: RegistryRecommendation[] = [];
    
    if (includeRegistryContext) {
      const authHeader = req.headers.get('Authorization') || '';
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      
      if (authHeader && supabaseUrl && supabaseKey) {
        let domain = siteUrl;
        try {
          const urlObj = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
          domain = urlObj.hostname.replace('www.', '');
        } catch (e) {
          console.log('Could not parse URL for domain extraction:', siteUrl);
        }
        
        registryRecommendations = await fetchRecommendationsRegistry(
          supabaseUrl,
          supabaseKey,
          authHeader,
          domain
        );
        
        if (registryRecommendations.length > 0) {
          registryContext = generateRegistryContextComment(registryRecommendations);
          console.log(`📋 Contexte d'audit ajouté (${registryRecommendations.length} recommandations)`);
        }
      }
    }

    // Générer le contenu stratégique via IA si demandé
    let aiContent: AIGeneratedContent = {};
    const hasStrategicFixes = enabledFixes.some(f => f.category === 'strategic');
    
    if (useAI && hasStrategicFixes) {
      console.log('🤖 Génération de contenu stratégique via Lovable AI...');
      aiContent = await generateStrategicContent(fixes, siteName, siteUrl, language);
    }

    // Générer le script avec contexte et contenu IA
    const code = generateCorrectiveScript(fixes, siteName, siteUrl, language, registryContext, aiContent, attribution);
    const linesCount = code.split('\n').length;

    // Catégoriser les fixes pour le résumé
    const technicalFixes = enabledFixes.filter(f => ['seo', 'performance', 'accessibility'].includes(f.category));
    const trackingFixes = enabledFixes.filter(f => f.category === 'tracking');
    const strategicFixes = enabledFixes.filter(f => f.category === 'strategic');
    const hallucinationFixes = enabledFixes.filter(f => f.category === 'hallucination');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✅ Script généré: ${linesCount} lignes`);
    console.log(`   → Techniques: ${technicalFixes.length}`);
    console.log(`   → Tracking: ${trackingFixes.length}`);
    console.log(`   → Stratégiques: ${strategicFixes.length}`);
    console.log(`   → Anti-Hallucination: ${hallucinationFixes.length}`);
    console.log('═══════════════════════════════════════════════════════════════');

    return new Response(
      JSON.stringify({
        success: true,
        code,
        fixesApplied: enabledFixes.length,
        linesCount,
        registryRecommendationsCount: registryRecommendations.length,
        aiContentGenerated: Object.keys(aiContent).length > 0,
        fixesSummary: enabledFixes.map(f => ({
          id: f.id,
          label: f.label,
          category: f.category,
          priority: f.priority
        })),
        categorySummary: {
          technical: technicalFixes.length,
          tracking: trackingFixes.length,
          strategic: strategicFixes.length,
          hallucination: hallucinationFixes.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error generating corrective code:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
