// Types for fix configuration - ARCHITECTE GÉNÉRATIF v2.0
export interface FixConfig {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'tracking' | 'hallucination' | 'strategic';
  label: string;
  description: string;
  enabled: boolean;
  priority: 'critical' | 'important' | 'optional';
  data?: Record<string, any>; // Pour passer titre, mots-clés, paragraphes, etc.
}

// Hallucination fix data
export interface HallucinationFixData {
  trueValue: string;
  confusionSources: string[];
  correctedIntro: string;
}

// Strategic fix data types
export interface FAQItem {
  question: string;
  answer: string;
}

export interface BlogSectionData {
  title: string;
  intro: string;
  paragraphs: string[];
}

export interface SemanticMetaData {
  keywords: string[];
  description: string;
}

export interface LocalBusinessData {
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  openingHours?: string;
}

// Available fix IDs for the Corrective Code Editor
export const AVAILABLE_FIXES = {
  // SEO Fixes
  fix_title: { category: 'seo', label: 'Correction Title', priority: 'critical' },
  fix_meta_desc: { category: 'seo', label: 'Meta Description', priority: 'critical' },
  fix_h1: { category: 'seo', label: 'Balise H1', priority: 'important' },
  fix_jsonld: { category: 'seo', label: 'JSON-LD Schema.org', priority: 'important' },
  
  // Performance Fixes
  fix_lazy_images: { category: 'performance', label: 'Lazy Loading Images', priority: 'important' },
  fix_https_redirect: { category: 'performance', label: 'Redirection HTTPS', priority: 'critical' },
  
  // Accessibility Fixes
  fix_contrast: { category: 'accessibility', label: 'Contraste', priority: 'optional' },
  fix_alt_images: { category: 'accessibility', label: 'Alt Images', priority: 'important' },
  
  // Tracking Fixes
  fix_gtm: { category: 'tracking', label: 'Google Tag Manager', priority: 'optional' },
  fix_ga4: { category: 'tracking', label: 'Google Analytics 4', priority: 'optional' },
  
  // Hallucination Fix
  fix_hallucination: { category: 'hallucination', label: 'Correction Hallucination IA', priority: 'critical' },
  
  // Strategic Fixes (NEW - Architecte Génératif)
  inject_faq: { category: 'strategic', label: 'Injection Section FAQ', priority: 'important' },
  inject_blog_section: { category: 'strategic', label: 'Injection Contenu Éditorial', priority: 'important' },
  enhance_semantic_meta: { category: 'strategic', label: 'Enrichissement Sémantique', priority: 'important' },
  inject_breadcrumbs: { category: 'strategic', label: 'Fil d\'Ariane', priority: 'optional' },
  inject_local_business: { category: 'strategic', label: 'Schema LocalBusiness', priority: 'optional' },
} as const;

// Generate the complete corrective script (Frontend fallback - simplified version)
// The full generation is done server-side via the Edge Function
export function generateCorrectiveScript(
  fixes: FixConfig[],
  siteName: string,
  siteUrl: string,
  language: string
): string {
  const enabledFixes = fixes.filter(f => f.enabled);
  if (enabledFixes.length === 0) return '';

  const fixFunctions: string[] = [];
  const fixCalls: string[] = [];

  // Generate fix functions based on enabled fixes
  enabledFixes.forEach(fix => {
    const { fn, call } = generateFixCode(fix, siteName, siteUrl, language);
    if (fn) fixFunctions.push(fn);
    if (call) fixCalls.push(call);
  });

  // Categorize fixes
  const technicalFixes = enabledFixes.filter(f => ['seo', 'performance', 'accessibility'].includes(f.category));
  const trackingFixes = enabledFixes.filter(f => f.category === 'tracking');
  const strategicFixes = enabledFixes.filter(f => f.category === 'strategic');
  const hallucinationFixes = enabledFixes.filter(f => f.category === 'hallucination');

  // Build the complete IIFE script
  const script = `/**
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ Crawlers.fr - ARCHITECTE GÉNÉRATIF v2.0
 * ═══════════════════════════════════════════════════════════════
 * 
 * Généré le ${new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
 * Site: ${siteName}
 * URL: ${siteUrl}
 * 
 * Correctifs appliqués: ${enabledFixes.length} au total
 *   → Techniques (SEO/Perf/A11y): ${technicalFixes.length}
 *   → Tracking: ${trackingFixes.length}
 *   → Stratégiques (Contenu/FAQ/Blog): ${strategicFixes.length}
 *   → Anti-Hallucination IA: ${hallucinationFixes.length}
 * ═══════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  // Attendre que le DOM soit prêt
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  // === FONCTIONS DE CORRECTION ===

${fixFunctions.join('\n\n')}

  // === EXÉCUTION DES CORRECTIONS ===

  ready(function() {
    console.log('[Crawlers.fr] 🏗️ Architecte Génératif v2.0 - Initialisation...');
    
    try {
${fixCalls.map(call => `      ${call}`).join('\n')}
      
      console.log('[Crawlers.fr] ✅ ${enabledFixes.length} correctif(s) appliqué(s) avec succès');
    } catch (error) {
      console.error('[Crawlers.fr] ❌ Erreur lors de l\\'application des correctifs:', error);
    }
  });

})();`;

  return script;
}

// Generate individual fix code (simplified frontend version)
function generateFixCode(
  fix: FixConfig,
  siteName: string,
  siteUrl: string,
  language: string
): { fn: string; call: string } {
  switch (fix.id) {
    case 'fix_title':
      return {
        fn: `  // Correction de la balise Title
  function fixTitle() {
    var title = document.querySelector('title');
    var currentTitle = title ? title.textContent : '';
    
    if (currentTitle && currentTitle.length > 60) {
      var newTitle = currentTitle.substring(0, 57) + '...';
      document.title = newTitle;
      console.log('[Crawlers.fr] Title optimisé:', newTitle);
    }
    
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
      const customDesc = fix.data?.description || `Découvrez ${siteName} - Votre partenaire de confiance.`;
      return {
        fn: `  // Ajout de la Meta Description
  function fixMetaDescription() {
    var metaDesc = document.querySelector('meta[name="description"]');
    
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content = '${customDesc.replace(/'/g, "\\'")}';
      document.head.appendChild(metaDesc);
      console.log('[Crawlers.fr] Meta description ajoutée');
    }
  }`,
        call: 'fixMetaDescription();'
      };

    case 'fix_h1':
      return {
        fn: `  // Correction de la balise H1 — Remplacement dynamique White Hat
  function fixH1() {
    try {
      var h1s = document.querySelectorAll('h1');
      if (h1s.length === 0) {
        var candidates = ['.article-title','.hero-title','.page-title','.entry-title','.post-title','.main-title','.section-title'];
        var mainTitle = null;
        for (var i = 0; i < candidates.length; i++) {
          mainTitle = document.querySelector('h2' + candidates[i]);
          if (mainTitle) break;
        }
        if (!mainTitle) mainTitle = document.querySelector('main h2, article h2, .hero h2, header h2');
        if (mainTitle && mainTitle.parentNode) {
          var newH1 = document.createElement('h1');
          newH1.innerHTML = mainTitle.innerHTML;
          newH1.className = mainTitle.className;
          for (var a = 0; a < mainTitle.attributes.length; a++) {
            var attr = mainTitle.attributes[a];
            if (attr.name !== 'class') newH1.setAttribute(attr.name, attr.value);
          }
          mainTitle.parentNode.replaceChild(newH1, mainTitle);
          console.log('[Crawlers.fr] ✅ H1 créé par remplacement du H2 visible');
        }
      } else if (h1s.length > 1) {
        for (var j = 1; j < h1s.length; j++) {
          var h2 = document.createElement('h2');
          h2.className = h1s[j].className;
          h2.innerHTML = h1s[j].innerHTML;
          if (h1s[j].parentNode) h1s[j].parentNode.replaceChild(h2, h1s[j]);
        }
        console.log('[Crawlers.fr] ✅ H1 multiples corrigés en H2');
      }
    } catch(e) { console.error('[Crawlers.fr] Erreur correction H1:', e); }
  }`,
        call: 'fixH1();'
      };

    case 'fix_jsonld':
      return {
        fn: `  // Injection de données structurées JSON-LD
  function injectJsonLd() {
    var existingJsonLd = document.querySelector('script[type="application/ld+json"]');
    
    if (!existingJsonLd) {
      var jsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "${siteName}",
        "url": "${siteUrl}"
      };
      
      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd, null, 2);
      document.head.appendChild(script);
      console.log('[Crawlers.fr] JSON-LD injecté');
    }
  }`,
        call: 'injectJsonLd();'
      };

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
    
    console.log('[Crawlers.fr] Lazy loading activé');
  }`,
        call: 'enableLazyLoading();'
      };

    case 'fix_https_redirect':
      return {
        fn: `  // Redirection HTTPS
  function forceHttps() {
    if (window.location.protocol === 'http:') {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }`,
        call: 'forceHttps();'
      };

    case 'fix_contrast':
      return {
        fn: `  // Amélioration du contraste
  function improveContrast() {
    // Implémentation simplifiée - version complète côté serveur
    console.log('[Crawlers.fr] Amélioration du contraste (version complète côté serveur)');
  }`,
        call: 'improveContrast();'
      };

    case 'fix_alt_images':
      return {
        fn: `  // Ajout des attributs alt
  function fixImageAlts() {
    var images = document.querySelectorAll('img:not([alt]), img[alt=""]');
    
    images.forEach(function(img, index) {
      img.alt = 'Image ' + (index + 1) + ' - ${siteName}';
    });
    
    console.log('[Crawlers.fr] Alt text ajouté');
  }`,
        call: 'fixImageAlts();'
      };

    case 'fix_gtm':
      const gtmId = fix.data?.gtmId || 'GTM-XXXXXXX';
      return {
        fn: `  // Intégration Google Tag Manager
  function injectGTM() {
    var gtmId = '${gtmId}';
    if (window.google_tag_manager) return;
    
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',gtmId);
    
    console.log('[Crawlers.fr] GTM injecté:', gtmId);
  }`,
        call: 'injectGTM();'
      };

    case 'fix_ga4':
      const measurementId = fix.data?.measurementId || 'G-XXXXXXXXXX';
      return {
        fn: `  // Intégration Google Analytics 4
  function injectGA4() {
    if (window.gtag) return;
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=${measurementId}';
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', '${measurementId}');
    
    console.log('[Crawlers.fr] GA4 injecté');
  }`,
        call: 'injectGA4();'
      };

    case 'fix_hallucination':
      const hallucinationData = fix.data || {};
      const trueValue = hallucinationData.trueValue || siteName;
      return {
        fn: `  // Correction Hallucination IA
  function fixHallucination() {
    var clarificationSchema = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "${siteName}",
      "description": "${trueValue.replace(/"/g, '\\"').replace(/'/g, "\\'")}"
    };
    
    var schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.textContent = JSON.stringify(clarificationSchema);
    document.head.appendChild(schemaScript);
    
    console.log('[Crawlers.fr] ✓ Correction hallucination IA appliquée');
  }`,
        call: 'fixHallucination();'
      };

    // Strategic fixes - simplified frontend versions (full generation is server-side)
    case 'inject_faq':
      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Section FAQ
  function injectFAQSection() {
    // Version complète générée côté serveur avec contenu IA
    console.log('[Crawlers.fr] 🏗️ FAQ (version complète côté serveur avec IA)');
  }`,
        call: 'injectFAQSection();'
      };

    case 'inject_blog_section':
      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Section Blog
  function injectBlogSection() {
    // Version complète générée côté serveur avec contenu IA
    console.log('[Crawlers.fr] 🏗️ Blog (version complète côté serveur avec IA)');
  }`,
        call: 'injectBlogSection();'
      };

    case 'enhance_semantic_meta':
      return {
        fn: `  // 🏗️ ARCHITECTE: Enrichissement Sémantique
  function enhanceSemanticMeta() {
    // Version complète générée côté serveur
    console.log('[Crawlers.fr] 🏗️ Sémantique (version complète côté serveur)');
  }`,
        call: 'enhanceSemanticMeta();'
      };

    case 'inject_breadcrumbs':
      return {
        fn: `  // 🏗️ ARCHITECTE: Injection Fil d'Ariane
  function injectBreadcrumbs() {
    // Version complète générée côté serveur
    console.log('[Crawlers.fr] 🏗️ Breadcrumbs (version complète côté serveur)');
  }`,
        call: 'injectBreadcrumbs();'
      };

    case 'inject_local_business':
      return {
        fn: `  // 🏗️ ARCHITECTE: Schema LocalBusiness
  function injectLocalBusiness() {
    // Version complète générée côté serveur
    console.log('[Crawlers.fr] 🏗️ LocalBusiness (version complète côté serveur)');
  }`,
        call: 'injectLocalBusiness();'
      };

    default:
      return { fn: '', call: '' };
  }
}
