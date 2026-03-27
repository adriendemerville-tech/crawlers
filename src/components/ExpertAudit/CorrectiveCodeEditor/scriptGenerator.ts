// Types for fix configuration - CODE ARCHITECT v3.2 — CLS-ZERO + Merge-Override Protocol
export interface FixConfig {
  id: string;
  category: 'seo' | 'performance' | 'accessibility' | 'tracking' | 'hallucination' | 'strategic';
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
  
  // Strategic Fixes (Code Architect)
  inject_faq: { category: 'strategic', label: 'Injection Section FAQ', priority: 'important' },
  inject_blog_section: { category: 'strategic', label: 'Injection Contenu Éditorial', priority: 'important' },
  enhance_semantic_meta: { category: 'strategic', label: 'Enrichissement Sémantique', priority: 'important' },
  inject_breadcrumbs: { category: 'strategic', label: 'Fil d\'Ariane', priority: 'optional' },
  inject_local_business: { category: 'strategic', label: 'Schema LocalBusiness', priority: 'optional' },
} as const;

// ══════════════════════════════════════════════════════════════
// PROTOCOLE CLS-ZERO — Règles d'injection
// ══════════════════════════════════════════════════════════════
//
// Règle 1 — DONNÉES SÉMANTIQUES : JSON-LD exclusivement dans <head>
//           via injectJsonLd(id, data). Pas de HTML visible pour FAQ/entité/avis.
//
// Règle 2A — ATTRIBUTION (bas de page) : Lien "Optimisé pour les IA par crawlers.fr"
//            injecté à la fin du <body>/footer. Opacité 1, discret mais visible.
//
// Règle 2B — SKELETON (haut/milieu de page) : Réserve l'espace via min-height CSS
//            AVANT d'injecter le HTML pour éviter tout CLS.
//
// Règle 3 — OPTIMISATIONS TECHNIQUES : loading="lazy" hors-écran,
//           fetchpriority="high" sur image LCP, via MutationObserver.
//
// Règle 4 — MERGE-OVERRIDE : clearLock(id) supprime l'ancien fix avant réinjection.
//           Le dernier script déployé écrase les parties redondantes, conserve les uniques.
//
// Règle 5 — STRUCTURE : IIFE + try/catch + commentaires CLS.
// ══════════════════════════════════════════════════════════════

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

  const dateLocale = language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US';

  // Build the complete IIFE script — Règle 5: IIFE + try/catch + Isolation SDK
  const configEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sdk-status`;
  
  const script = `/**
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ Crawlers.fr — CODE ARCHITECT v3.2 (CLS-ZERO + Merge-Override)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Généré le ${new Date().toLocaleDateString(dateLocale)}
 * Site: ${siteName}
 * URL: ${siteUrl}
 * 
 * Correctifs appliqués: ${enabledFixes.length} au total
 *   → Techniques (SEO/Perf/A11y): ${technicalFixes.length}
 *   → Tracking: ${trackingFixes.length}
 *   → Stratégiques (JSON-LD sémantique): ${strategicFixes.length}
 *   → Anti-Hallucination IA: ${hallucinationFixes.length}
 *
 * Protocole CLS-ZERO + Merge-Override:
 *   Règle 1  — Données sémantiques → JSON-LD <head> uniquement
 *   Règle 2A — Attribution → bas de page (footer)
 *   Règle 2B — Contenu visible → skeleton (min-height) avant injection
 *   Règle 3  — lazy/fetchpriority via MutationObserver
 *   Règle 4  — Merge-Override: le dernier script écrase les fixes redondants
 *              (clearLock supprime l'ancien DOM/JSON-LD avant réinjection)
 *   Règle 5  — IIFE + try/catch silencieux
 *   Règle 6  — requestIdleCallback (non-bloquant)
 *   Règle 7  — Kill Switch distant (sdk-status)
 *   Règle 8  — No-Global Policy (aucune pollution window)
 *   Règle 9  — DocumentFragment pour injections DOM
 * ═══════════════════════════════════════════════════════════════
 */
(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // RÈGLE 8 — NO-GLOBAL POLICY
  // Aucune variable ne fuit dans window sauf le namespace dédié.
  // ═══════════════════════════════════════════════════════════
   var __CRAWLERS_CONFIG__ = {
    version: '3.2',
    site: '${siteUrl}',
    fixes: ${enabledFixes.length},
    generatedAt: new Date().toISOString()
  };
  // Exposer sous préfixe unique — configurable: true pour permettre l'écrasement par un script ultérieur
  try {
    if (window.__CRAWLERS_CONFIG__) { safeLog('[Crawlers.fr] ♻️ Script précédent détecté — merge-override actif'); }
    Object.defineProperty(window, '__CRAWLERS_CONFIG__', { value: __CRAWLERS_CONFIG__, writable: false, configurable: true });
  } catch(e) {}

  // ═══════════════════════════════════════════════════════════
  // RÈGLE 6 — EXECUTION DEFERRAL (Non-bloquant)
  // Utilise requestIdleCallback pour ne jamais bloquer le rendu.
  // ═══════════════════════════════════════════════════════════
  var scheduleIdle = (typeof window.requestIdleCallback === 'function')
    ? function(fn) { window.requestIdleCallback(fn, { timeout: 3000 }); }
    : function(fn) { setTimeout(fn, 0); };

  // ═══════════════════════════════════════════════════════════
  // RÈGLE 5 — FAIL-SAFE : Tout est silencieux en production
  // ═══════════════════════════════════════════════════════════
  var isDev = (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
  function safeLog() { if (isDev) { try { console.log.apply(console, arguments); } catch(e) {} } }
  function safeWarn() { if (isDev) { try { console.warn.apply(console, arguments); } catch(e) {} } }

  // ═══════════════════════════════════════════════════════════
  // UTILITAIRES CLS-ZERO
  // ═══════════════════════════════════════════════════════════

  // Attendre que le DOM soit prêt
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Règle 4: Système de Locks — merge-override
  // Si un lock existe déjà, on SUPPRIME l'ancien élément pour que le nouveau script le remplace.
  function clearLock(id) {
    var existing = document.querySelectorAll('[data-crawlers-lock="' + id + '"]');
    for (var i = 0; i < existing.length; i++) {
      // Pour les éléments <head> (meta, title), on ne supprime pas le noeud, juste l'attribut
      if (existing[i].parentNode === document.head) {
        existing[i].removeAttribute('data-crawlers-lock');
      } else {
        // Pour les éléments injectés dans le body (FAQ, blog section, skeleton…), on les retire
        existing[i].parentNode && existing[i].parentNode.removeChild(existing[i]);
      }
      safeLog('[Crawlers.fr] ♻️ Lock précédent supprimé:', id);
    }
  }
  // Rétro-compat : hasLock renvoie toujours false après clearLock
  function hasLock(id) {
    return !!document.querySelector('[data-crawlers-lock="' + id + '"]');
  }
  function setLock(el, id) {
    if (el && el.setAttribute) el.setAttribute('data-crawlers-lock', id);
  }

  // Règle 1: Injection JSON-LD dans <head> — merge-override (remplace l'ancien si existant)
  function injectJsonLd(id, data) {
    var old = document.querySelector('script[data-crawlers-jsonld="' + id + '"]');
    if (old) {
      old.parentNode && old.parentNode.removeChild(old);
      safeLog('[Crawlers.fr] ♻️ JSON-LD remplacé:', id);
    }
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-crawlers-jsonld', id);
    script.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(script);
    safeLog('[Crawlers.fr] JSON-LD injecté:', id);
  }

  // Règle 9: DocumentFragment pour minimiser les reflows
  function createFragment(html) {
    var frag = document.createDocumentFragment();
    var temp = document.createElement('div');
    temp.innerHTML = html;
    while (temp.firstChild) frag.appendChild(temp.firstChild);
    return frag;
  }

  // Règle 2B: Injection Skeleton — réserve l'espace avant insertion HTML
  // Utilise DocumentFragment (Règle 9) pour minimiser les reflows
  function injectWithSkeleton(targetSelector, html, minHeight, insertPosition) {
    var skeletonId = 'crawlers-skeleton-' + Math.random().toString(36).substr(2, 6);
    var style = document.createElement('style');
    style.textContent = '#' + skeletonId + ' { min-height: ' + minHeight + '; transition: min-height 0.3s ease; }';
    document.head.appendChild(style);

    var container = document.createElement('div');
    container.id = skeletonId;
    // Règle 9: Utiliser DocumentFragment
    container.appendChild(createFragment(html));

    var target = document.querySelector(targetSelector);
    if (target && insertPosition === 'before') {
      target.parentNode.insertBefore(container, target);
    } else if (target && insertPosition === 'after') {
      target.parentNode.insertBefore(container, target.nextSibling);
    } else {
      var footer = document.querySelector('footer');
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(container, footer);
      } else {
        document.body.appendChild(container);
      }
    }
    return container;
  }

  // ═══════════════════════════════════════════════════════════
  // FONCTIONS DE CORRECTION
  // ═══════════════════════════════════════════════════════════

${fixFunctions.join('\n\n')}

  // ═══════════════════════════════════════════════════════════
  // Règle 2A: ATTRIBUTION — Bas de page, visible, discret
  // "Optimisé pour les IA par crawlers.fr"
  // ═══════════════════════════════════════════════════════════
  function injectCrawlersAttribution() {
    clearLock('attribution');

    var link = document.createElement('a');
    link.href = 'https://crawlers.fr';
    link.textContent = 'Optimisé pour les IA par crawlers.fr';
    link.rel = 'dofollow';
    link.target = '_blank';
    link.style.cssText = 'font-size: 11px; color: #64748b; text-decoration: none; opacity: 1;';

    var container = document.createElement('div');
    container.style.cssText = 'text-align: center; padding: 8px 0; font-size: 11px;';
    container.appendChild(link);
    setLock(container, 'attribution');

    var footer = document.querySelector('footer');
    if (footer) {
      footer.appendChild(container);
    } else {
      document.body.appendChild(container);
    }
    safeLog('[Crawlers.fr] ✅ Attribution injectée (Règle 2A — bas de page)');
  }

  // ═══════════════════════════════════════════════════════════
  // RÈGLE 7 — KILL SWITCH DISTANT
  // Vérifie l'état du SDK avant exécution. Si désactivé, autodestruction.
  // ═══════════════════════════════════════════════════════════
  function checkKillSwitch(callback) {
    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 2000);

      fetch('${configEndpoint}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: location.hostname }),
        signal: controller.signal
      })
      .then(function(r) {
        clearTimeout(timeoutId);
        if (!r.ok) { safeWarn('[Crawlers.fr] Kill switch: endpoint error', r.status); callback(false); return; }
        return r.json();
      })
      .then(function(data) {
        if (!data) { callback(false); return; }
        if (data.isEnabled === false) {
          safeLog('[Crawlers.fr] ⛔ SDK désactivé à distance — autodestruction');
          callback(false);
        } else {
          callback(true);
        }
      })
      .catch(function() {
        clearTimeout(timeoutId);
        // Fail-open: si l'endpoint est injoignable, on exécute quand même
        // pour ne pas casser les sites clients en cas de panne de notre API
        safeWarn('[Crawlers.fr] Kill switch injoignable — fail-open');
        callback(true);
      });
    } catch(e) {
      // Environnement sans fetch (SSR, ancien navigateur) → fail-open
      callback(true);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EXÉCUTION — Orchestration complète
  // Règle 5 (try/catch silencieux) + Règle 6 (idle) + Règle 7 (kill switch)
  // ═══════════════════════════════════════════════════════════

  ready(function() {
    // Règle 6: Defer to idle time
    scheduleIdle(function() {
      // Règle 7: Kill switch check before execution
      checkKillSwitch(function(isEnabled) {
        if (!isEnabled) return; // Autodestruction silencieuse

        // Règle 5: Global try-catch — SILENT failure
        try {

          safeLog('[Crawlers.fr] 🏗️ Code Architect v3.2 — CLS-ZERO + Merge-Override');

${fixCalls.map(call => `          ${call}`).join('\n')}

          // Règle 2A — Attribution toujours en dernier (bas de page)
          injectCrawlersAttribution();

          safeLog('[Crawlers.fr] ✅ ${enabledFixes.length} correctif(s) appliqué(s) — CLS-ZERO');
        } catch (e) {
          // Règle 5: SILENT FAILURE — jamais d'erreur dans la console du client
          // En dev uniquement, on log pour debug
          safeWarn('[Crawlers.fr] Erreur silencieuse:', e);
        }
      });
    });
  });

})();`;

  return script;
}

// Generate individual fix code (simplified frontend version) — CLS-ZERO Protocol
function generateFixCode(
  fix: FixConfig,
  siteName: string,
  siteUrl: string,
  language: string
): { fn: string; call: string } {
  switch (fix.id) {

    // ═══════════════════════════════════════════════════════════
    // SEO TECHNIQUES — Injection <head> (pas de CLS)
    // ═══════════════════════════════════════════════════════════

    case 'fix_title':
      return {
         fn: `  // Correction de la balise Title (head — pas d'impact CLS)
  // Règle 4: Merge-override — écrase le fix précédent si présent
  function fixTitle() {
    clearLock('fix_title');
    try {
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
      setLock(title, 'fix_title');
    } catch(e) { console.error('[Crawlers.fr] Erreur fixTitle:', e); }
  }`,
        call: 'fixTitle();'
      };

    case 'fix_meta_desc':
      const customDesc = fix.data?.description || `Découvrez ${siteName} - Votre partenaire de confiance.`;
      return {
         fn: `  // Meta Description (head — pas d'impact CLS)
  // Règle 4: Merge-override
  function fixMetaDescription() {
    clearLock('fix_meta_desc');
    try {
      var metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        metaDesc.content = '${customDesc.replace(/'/g, "\\'")}';
        document.head.appendChild(metaDesc);
        console.log('[Crawlers.fr] Meta description ajoutée');
      }
      setLock(metaDesc, 'fix_meta_desc');
    } catch(e) { console.error('[Crawlers.fr] Erreur fixMetaDescription:', e); }
  }`,
        call: 'fixMetaDescription();'
      };

    case 'fix_h1':
      return {
         fn: `  // Correction de la balise H1 — Remplacement dynamique White Hat
  // Règle 4: Merge-override
  function fixH1() {
    clearLock('fix_h1');
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
          setLock(newH1, 'fix_h1');
          console.log('[Crawlers.fr] ✅ H1 créé par remplacement du H2 visible');
        }
      } else if (h1s.length > 1) {
        for (var j = 1; j < h1s.length; j++) {
          var h2 = document.createElement('h2');
          h2.className = h1s[j].className;
          h2.innerHTML = h1s[j].innerHTML;
          if (h1s[j].parentNode) h1s[j].parentNode.replaceChild(h2, h1s[j]);
        }
        setLock(h1s[0], 'fix_h1');
        console.log('[Crawlers.fr] ✅ H1 multiples corrigés en H2');
      }
    } catch(e) { console.error('[Crawlers.fr] Erreur correction H1:', e); }
  }`,
        call: 'fixH1();'
      };

    case 'fix_jsonld':
      return {
         fn: `  // Règle 1: Injection JSON-LD Organization dans <head> (données sémantiques)
  function injectOrganizationJsonLd() {
    clearLock('fix_jsonld');
    try {
      injectJsonLd('organization', {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "${siteName}",
        "url": "${siteUrl}"
      });
      // Utiliser le head comme support de lock
      setLock(document.head, 'fix_jsonld');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectJsonLd:', e); }
  }`,
        call: 'injectOrganizationJsonLd();'
      };

    // ═══════════════════════════════════════════════════════════
    // PERFORMANCE — Règle 3: lazy + fetchpriority
    // ═══════════════════════════════════════════════════════════

    case 'fix_lazy_images':
      return {
         fn: `  // Règle 3: Lazy Loading images hors-écran + fetchpriority="high" sur image LCP
  function optimizeImages() {
    clearLock('fix_lazy_images');
    try {
      var images = document.querySelectorAll('img');
      var viewportHeight = window.innerHeight;
      var lcpFixed = false;

      // MutationObserver pour l'image LCP (héro/bannière)
      var lcpSelectors = '.hero img, [class*="hero"] img, [class*="banner"] img, header img, main > section:first-child img';
      var lcpImg = document.querySelector(lcpSelectors);
      if (lcpImg) {
        lcpImg.setAttribute('fetchpriority', 'high');
        lcpImg.setAttribute('loading', 'eager');
        lcpImg.setAttribute('decoding', 'sync');
        lcpFixed = true;
        console.log('[Crawlers.fr] Règle 3 — fetchpriority=high sur image LCP');
      }

      // Lazy loading sur les images hors-écran
      images.forEach(function(img) {
        if (img === lcpImg) return; // Ne pas lazy-load l'image LCP
        var rect = img.getBoundingClientRect();
        if (rect.top > viewportHeight * 1.5) {
          img.loading = 'lazy';
          img.decoding = 'async';
        }
      });

      // MutationObserver pour LCP si pas encore trouvée
      if (!lcpFixed) {
        var observer = new MutationObserver(function(mutations) {
          var found = document.querySelector(lcpSelectors);
          if (found) {
            found.setAttribute('fetchpriority', 'high');
            found.setAttribute('loading', 'eager');
            found.setAttribute('decoding', 'sync');
            observer.disconnect();
            console.log('[Crawlers.fr] Règle 3 — MutationObserver: fetchpriority=high appliqué');
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(function() { observer.disconnect(); }, 10000);
      }

      setLock(document.body, 'fix_lazy_images');
      console.log('[Crawlers.fr] Règle 3 — Lazy loading activé');
    } catch(e) { console.error('[Crawlers.fr] Erreur optimizeImages:', e); }
  }`,
        call: 'optimizeImages();'
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

    // ═══════════════════════════════════════════════════════════
    // ACCESSIBILITÉ
    // ═══════════════════════════════════════════════════════════

    case 'fix_contrast':
      return {
         fn: `  // Amélioration du contraste
  // Règle 4: Merge-override
  function improveContrast() {
    clearLock('fix_contrast');
    try {
      // Version simplifiée — version complète côté serveur
      setLock(document.body, 'fix_contrast');
      console.log('[Crawlers.fr] Contraste (version complète côté serveur)');
    } catch(e) { console.error('[Crawlers.fr] Erreur improveContrast:', e); }
  }`,
        call: 'improveContrast();'
      };

    case 'fix_alt_images':
      return {
         fn: `  // Ajout des attributs alt
  // Règle 4: Merge-override
  function fixImageAlts() {
    clearLock('fix_alt_images');
    try {
      var images = document.querySelectorAll('img:not([alt]), img[alt=""]');
      images.forEach(function(img, index) {
        img.alt = 'Image ' + (index + 1) + ' - ${siteName}';
      });
      setLock(document.body, 'fix_alt_images');
      console.log('[Crawlers.fr] Alt text ajouté à', images.length, 'images');
    } catch(e) { console.error('[Crawlers.fr] Erreur fixImageAlts:', e); }
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
  // Règle 4: Merge-override
  function injectGTM() {
    clearLock('fix_gtm');
    try {
      if (window.google_tag_manager) return;
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
      setLock(document.head, 'fix_gtm');
      console.log('[Crawlers.fr] GTM injecté:', '${gtmId}');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectGTM:', e); }
  }`,
        call: 'injectGTM();'
      };

    case 'fix_ga4':
      const measurementId = fix.data?.measurementId || 'G-XXXXXXXXXX';
      return {
         fn: `  // Intégration Google Analytics 4
  // Règle 4: Merge-override
  function injectGA4() {
    clearLock('fix_ga4');
    try {
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
      setLock(document.head, 'fix_ga4');
      console.log('[Crawlers.fr] GA4 injecté');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectGA4:', e); }
  }`,
        call: 'injectGA4();'
      };

    // ═══════════════════════════════════════════════════════════
    // HALLUCINATION — Règle 1: JSON-LD uniquement
    // ═══════════════════════════════════════════════════════════

    case 'fix_hallucination':
      const hallucinationData = fix.data || {};
      const trueValue = hallucinationData.trueValue || siteName;
      return {
         fn: `  // Règle 1: Correction Hallucination IA — JSON-LD dans <head> uniquement
  // Règle 4: Merge-override
  function fixHallucination() {
    clearLock('fix_hallucination');
    try {
      // Données sémantiques via JSON-LD exclusivement (Règle 1)
      injectJsonLd('hallucination-fix', {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "${siteName}",
        "description": "${trueValue.replace(/"/g, '\\"').replace(/'/g, "\\'")}",
        "url": "${siteUrl}",
        "disambiguatingDescription": "${trueValue.replace(/"/g, '\\"').replace(/'/g, "\\'")}"
      });
      setLock(document.head, 'fix_hallucination');
      console.log('[Crawlers.fr] ✓ Correction hallucination IA — JSON-LD (Règle 1)');
    } catch(e) { console.error('[Crawlers.fr] Erreur fixHallucination:', e); }
  }`,
        call: 'fixHallucination();'
      };

    // ═══════════════════════════════════════════════════════════
    // STRATÉGIQUES — Règle 1 (JSON-LD) + Règle 2B (Skeleton)
    // ═══════════════════════════════════════════════════════════

    case 'inject_faq':
      return {
         fn: `  // Règle 1: FAQ → JSON-LD FAQPage dans <head> (données sémantiques IA/GEO)
  // Pas de HTML visible = pas de CLS
  // Règle 4: Merge-override
  function injectFAQSection() {
    clearLock('inject_faq');
    try {
      // Version complète générée côté serveur avec contenu IA
      // Frontend fallback: JSON-LD sémantique uniquement (Règle 1)
      injectJsonLd('faq', {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": []
      });
      setLock(document.head, 'inject_faq');
      console.log('[Crawlers.fr] 🏗️ FAQ JSON-LD (Règle 1 — version complète côté serveur)');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectFAQSection:', e); }
  }`,
        call: 'injectFAQSection();'
      };

    case 'inject_blog_section':
      return {
         fn: `  // Règle 2B: Blog → Skeleton (espace réservé) + injection HTML
  // Règle 4: Merge-override
  function injectBlogSection() {
    clearLock('inject_blog_section');
    try {
      // Version complète générée côté serveur avec contenu IA
      console.log('[Crawlers.fr] 🏗️ Blog (Règle 2B — version complète côté serveur)');
      setLock(document.head, 'inject_blog_section');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectBlogSection:', e); }
  }`,
        call: 'injectBlogSection();'
      };

    case 'enhance_semantic_meta':
      return {
         fn: `  // Enrichissement Sémantique — head uniquement (pas de CLS)
  // Règle 4: Merge-override
  function enhanceSemanticMeta() {
    clearLock('enhance_semantic_meta');
    try {
      // Version complète générée côté serveur
      console.log('[Crawlers.fr] 🏗️ Sémantique (version complète côté serveur)');
      setLock(document.head, 'enhance_semantic_meta');
    } catch(e) { console.error('[Crawlers.fr] Erreur enhanceSemanticMeta:', e); }
  }`,
        call: 'enhanceSemanticMeta();'
      };

    case 'inject_breadcrumbs':
      return {
         fn: `  // Règle 1: Breadcrumbs → JSON-LD BreadcrumbList dans <head>
  // Règle 4: Merge-override
  function injectBreadcrumbs() {
    clearLock('inject_breadcrumbs');
    try {
      var path = window.location.pathname.split('/').filter(Boolean);
      var items = [{ name: 'Accueil', url: '/' }];
      var currentPath = '';
      path.forEach(function(segment, index) {
        currentPath += '/' + segment;
        var name = segment.replace(/-/g, ' ').replace(/\\b\\w/g, function(l) { return l.toUpperCase(); });
        items.push({ name: name, url: currentPath });
      });
      if (items.length < 2) return;

      // Règle 1: JSON-LD uniquement dans <head>
      injectJsonLd('breadcrumbs', {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items.map(function(item, index) {
          return {
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": window.location.origin + item.url
          };
        })
      });
      setLock(document.head, 'inject_breadcrumbs');
      console.log('[Crawlers.fr] 🏗️ Breadcrumbs JSON-LD injecté (Règle 1)');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectBreadcrumbs:', e); }
  }`,
        call: 'injectBreadcrumbs();'
      };

    case 'inject_local_business':
      return {
         fn: `  // Règle 1: LocalBusiness → JSON-LD dans <head> (données sémantiques)
  // Règle 4: Merge-override
  function injectLocalBusiness() {
    clearLock('inject_local_business');
    try {
      // Version complète générée côté serveur
      injectJsonLd('local-business', {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": "${siteName}",
        "url": "${siteUrl}"
      });
      setLock(document.head, 'inject_local_business');
      console.log('[Crawlers.fr] 🏗️ LocalBusiness JSON-LD (Règle 1)');
    } catch(e) { console.error('[Crawlers.fr] Erreur injectLocalBusiness:', e); }
  }`,
        call: 'injectLocalBusiness();'
      };

    default:
      return { fn: '', call: '' };
  }
}
