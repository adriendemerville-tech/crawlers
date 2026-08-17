---
name: Identité ancrée sur le contenu réel
description: Interdiction d'inférer secteur/produits/cible depuis le nom de domaine ; seules les cartes ancrées sur pages lues sont réutilisables
type: constraint
---

# Carte d'identité : ancrage obligatoire sur le contenu

Le secteur, les produits/services et la cible d'un site ne doivent JAMAIS être déduits du nom de domaine seul.
Cause historique : `dictadevi.io` (logiciel pour artisans du bâtiment : devis, compta, dictée chantier) a été décrit comme un « service de transcription audio/vidéo » ciblant « journalistes et podcasteurs », ce qui a contaminé les prompts LLM de visibilité GEO (questions hors sujet).

Règles :
- `enrichSiteContext.ts` récupère d'abord les preuves de la page d'accueil (title, meta description, H1-H3, texte visible) via `fetchHomepageEvidence` et instruit le modèle de ne jamais interpréter le nom de domaine. Sans preuve : rester générique, source `llm_auto` ; avec preuve : `llm_verified`.
- Une inférence ancrée écrase les champs d'activité issus d'une inférence antérieure non ancrée (`user_manual` reste protégé par l'Identity Gateway).
- `identityResolver.ts` (Marina, phase 0) ne réutilise une carte fraîche que si `identity_source` est ancrée : `user_manual`, `user_voice`, `marina`, `crawl`, `gmb`. Les sources `llm_auto` / `llm_verified` déclenchent une réinférence sur pages réelles et corrigent les champs `market_sector`, `products_services`, `target_audience`, `commercial_area`, `entity_type`, `commercial_model`.
