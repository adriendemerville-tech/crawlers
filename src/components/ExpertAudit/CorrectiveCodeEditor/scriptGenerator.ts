// Types for fix configuration
export interface FixConfig {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'tracking' | 'hallucination';
  label: string;
  description: string;
  enabled: boolean;
  priority: 'critical' | 'important' | 'optional';
  data?: Record<string, any>;
}

// Hallucination fix data
export interface HallucinationFixData {
  trueValue: string;
  confusionSources: string[];
  correctedIntro: string;
}

// Generate the complete corrective script
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

  // Build the complete IIFE script
  const script = `/**
 * Crawlers.fr - Script Correctif Automatique
 * Généré le ${new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US')}
 * Site: ${siteName}
 * Correctifs actifs: ${enabledFixes.length}
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
    console.log('[Crawlers.fr] Initialisation des correctifs...');
    
    try {
${fixCalls.map(call => `      ${call}`).join('\n')}
      
      console.log('[Crawlers.fr] ✓ ${enabledFixes.length} correctif(s) appliqué(s) avec succès');
    } catch (error) {
      console.error('[Crawlers.fr] Erreur lors de l\\'application des correctifs:', error);
    }
  });

})();`;

  return script;
}

// Generate individual fix code
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
      return {
        fn: `  // Ajout de la Meta Description
  function fixMetaDescription() {
    var metaDesc = document.querySelector('meta[name="description"]');
    
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      metaDesc.content = 'Découvrez ${siteName} - Votre partenaire de confiance. Visitez notre site pour en savoir plus.';
      document.head.appendChild(metaDesc);
      console.log('[Crawlers.fr] Meta description ajoutée');
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
      // Chercher un titre principal à promouvoir
      var mainTitle = document.querySelector('header h2, .hero h2, main h2');
      if (mainTitle) {
        var newH1 = document.createElement('h1');
        newH1.className = mainTitle.className;
        newH1.textContent = mainTitle.textContent;
        mainTitle.parentNode.replaceChild(newH1, mainTitle);
        console.log('[Crawlers.fr] H1 créé depuis H2 existant');
      }
    } else if (h1s.length > 1) {
      // Convertir les H1 supplémentaires en H2
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
      return {
        fn: `  // Injection de données structurées JSON-LD
  function injectJsonLd() {
    var existingJsonLd = document.querySelector('script[type="application/ld+json"]');
    
    if (!existingJsonLd) {
      var jsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
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

    case 'fix_lazy_images':
      return {
        fn: `  // Lazy Loading des images
  function enableLazyLoading() {
    var images = document.querySelectorAll('img:not([loading])');
    var viewportHeight = window.innerHeight;
    
    images.forEach(function(img) {
      var rect = img.getBoundingClientRect();
      // N'appliquer le lazy loading qu'aux images hors viewport
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
      
      // Vérifier si le texte est trop clair sur fond clair
      if (color.includes('rgb(') && bgColor.includes('rgb(')) {
        var colorBrightness = getColorBrightness(color);
        var bgBrightness = getColorBrightness(bgColor);
        var contrast = Math.abs(colorBrightness - bgBrightness);
        
        // Si contraste insuffisant, assombrir le texte
        if (contrast < 125 && bgBrightness > 200) {
          el.style.color = '#374151'; // gray-700
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
        .replace(/\\.[^.]+$/, '') // Retirer extension
        .replace(/[-_]/g, ' ')   // Remplacer tirets/underscores par espaces
        .replace(/\\d+/g, '')    // Retirer les chiffres
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

    case 'fix_gtm':
      const gtmId = fix.data?.gtmId || 'GTM-XXXXXXX';
      return {
        fn: `  // Intégration Google Tag Manager
  function injectGTM() {
    var gtmId = '${gtmId}';
    
    // Vérifier si GTM n'est pas déjà présent
    if (window.google_tag_manager && window.google_tag_manager[gtmId]) {
      console.log('[Crawlers.fr] GTM déjà présent');
      return;
    }
    
    // Script GTM
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',gtmId);
    
    // Noscript fallback
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

    case 'fix_hallucination':
      const hallucinationData = fix.data || {};
      const trueValue = hallucinationData.trueValue || siteName;
      const confusionFixes = (hallucinationData.confusionSources || []).slice(0, 3);
      return {
        fn: `  // Correction Hallucination IA - Injection métadonnées anti-confusion
  function fixHallucination() {
    // Ajouter des métadonnées claires pour les crawlers IA
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
    
    // Ajouter un schema.org enrichi pour clarifier l'entité
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
    
    console.log('[Crawlers.fr] ✓ Correction hallucination IA appliquée - métadonnées clarificatrices injectées');
  }`,
        call: 'fixHallucination();'
      };

    case 'fix_ga4':
      const measurementId = fix.data?.measurementId || 'G-XXXXXXXXXX';
      return {
        fn: `  // Intégration Google Analytics 4
  function injectGA4() {
    var measurementId = '${measurementId}';
    
    // Vérifier si GA n'est pas déjà présent
    if (window.gtag) {
      console.log('[Crawlers.fr] Google Analytics déjà présent');
      return;
    }
    
    // Script gtag.js
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
    
    // Configuration
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId);
    
    console.log('[Crawlers.fr] Google Analytics 4 injecté:', measurementId);
  }`,
        call: 'injectGA4();'
      };

    default:
      return { fn: '', call: '' };
  }
}
