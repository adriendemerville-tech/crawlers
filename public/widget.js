/**
 * Crawlers.fr — Widget GTM / WordPress
 * =====================================
 * Script à installer via Google Tag Manager ou en injection directe.
 *
 * Prérequis : définir window.CRAWLERS_API_KEY avant le chargement du script.
 *
 * Exemple GTM (balise HTML personnalisée) :
 *   <script>window.CRAWLERS_API_KEY = "votre-clé-api-uuid";</script>
 *   <script src="https://crawlers.fr/widget.js" defer></script>
 *
 * @version 1.0.0
 */
;(async function initCrawlersWidget() {
  'use strict';

  // ── 1. Récupération de l'URL courante ──────────────────────
  var urlActuelle = window.location.href;

  // ── 2. Récupération de la clé API client ───────────────────
  var cleClient = window.CRAWLERS_API_KEY;

  if (!cleClient) {
    console.error('[Crawlers.fr] Clé API manquante (window.CRAWLERS_API_KEY). Le widget ne peut pas démarrer.');
    return;
  }

  // ── 3. Construction du payload ─────────────────────────────
  var donneesAEnvoyer = {
    apiKey: cleClient,
    urlDuClient: urlActuelle
  };

  // ── 4. Appel à l'Edge Function widget-connect ──────────────
  // URL de production pointant vers l'Edge Function Supabase
  var ENDPOINT = 'https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/widget-connect';

  try {
    var reponse = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(donneesAEnvoyer)
    });

    // ── 5. Traitement de la réponse ────────────────────────────
    if (reponse.ok) {
      var resultat = await reponse.json();
      console.log('[Crawlers.fr] Connecté avec succès !', resultat);

      // Stocke la config pour utilisation par d'autres scripts
      window.__CRAWLERS_CONFIG__ = resultat.config || {};
      window.__CRAWLERS_SITE__ = resultat.site || {};

      // Dispatch un événement custom pour que GTM puisse réagir
      window.dispatchEvent(new CustomEvent('crawlers:connected', {
        detail: resultat
      }));

    } else if (reponse.status === 401) {
      console.warn('[Crawlers.fr] Clé API invalide. Vérifiez votre configuration.');
    } else if (reponse.status === 403) {
      console.warn('[Crawlers.fr] Domaine non autorisé pour cette clé API.');
    } else {
      console.warn('[Crawlers.fr] Erreur serveur (' + reponse.status + ').');
    }

  } catch (erreur) {
    // Fail-safe : le widget ne doit jamais casser le site hôte
    console.error('[Crawlers.fr] Impossible de joindre le serveur.', erreur);
  }
})();
