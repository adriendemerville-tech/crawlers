/**
 * Crawlers.fr — Widget SDK v2.0
 * ==============================
 * Script universel à installer via GTM, WordPress ou injection directe.
 * Charge dynamiquement le routeur correctif depuis serve-client-script.
 *
 * Prérequis : définir window.CRAWLERS_API_KEY avant le chargement du script.
 *
 * Exemple GTM (balise HTML personnalisée) :
 *   <script>window.CRAWLERS_API_KEY = "votre-clé-api-uuid";</script>
 *   <script src="https://crawlers.fr/widget.js" defer></script>
 *
 * @version 2.0.0
 */
;(function initCrawlersWidget() {
  'use strict';

  // ── 1. Ne pas exécuter sur les domaines de preview/dev ──────
  var host = window.location.hostname;
  if (host.indexOf('lovableproject.com') !== -1 || host.indexOf('lovable.app') !== -1 || host === 'localhost') {
    return;
  }

  // ── 2. Récupération de la clé API client ───────────────────
  var cleClient = window.CRAWLERS_API_KEY;

  if (!cleClient) {
    console.error('[Crawlers.fr] Clé API manquante (window.CRAWLERS_API_KEY). Le widget ne peut pas démarrer.');
    return;
  }

  // ── 3. Charger le script dynamique depuis serve-client-script ──
  // Ce script contient le routeur multi-pages avec toutes les règles
  // (JSON-LD, HTML injection, correctifs) configurées dans le dashboard.
  var SCRIPT_URL = 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/serve-client-script?key=' + encodeURIComponent(cleClient);

  try {
    var script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-crawlers-sdk', 'v2');
    script.onerror = function() {
      console.warn('[Crawlers.fr] Impossible de charger le script correctif (fail-safe).');
    };
    // Injecter dans le head pour exécution rapide
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    // Fail-safe : le widget ne doit jamais casser le site hôte
    console.error('[Crawlers.fr] Erreur d\'initialisation.', e);
  }
})();
