# Memory: features/support/help-center-ai-fr
Updated: now

## Agent SAV "Crawler"
- Modèle : Gemini Flash via Lovable AI Gateway (`LOVABLE_API_KEY`)
- Limite stricte : 1000 caractères par message
- Base de connaissance : documentation /aide + taxonomie front-end complète (routes, onglets, positions des composants)
- Accès aux données backend : `tracked_sites`, `crawl_pages`, `site_crawls`, `cocoon_sessions`, `profiles`
- Consigne : ne produit pas (pas d'audits, crawls, génération de code) — explique et conseille uniquement
- Détection automatique de la langue de l'utilisateur (FR/EN/ES)
- Utilise le prénom si disponible dans `profiles`
- Peut envoyer des liens internes (ex: `/cocoon`, `/matrice`, `/console`)
- Logo robot Crawlers dans la conversation (remplace emoji et "Crawler" texte)

## Couverture GMB complète
- Connaît le workflow complet : connexion OAuth → import fiches → avis/posts/performances
- Sait orienter vers Console > GMB ou Console > API pour la connexion
- Explique les prérequis (Pro Agency + compte Google propriétaire)
- Décrit les fonctionnalités : avis, posts, performances locales, multi-fiches, drag & drop
- Intégration avec Audit Local SEO et Stratégie 360°
- Troubleshooting : fiche non visible → vérifier rôle propriétaire/gestionnaire dans Google Business Profile
- Ne mentionne JAMAIS les noms de fonctions (`gmb-actions`, `gsc-auth`, etc.)

## Fonctionnalités avancées
- **Voice input** : Bouton micro — Web Speech API (FR/EN/ES), transcription en temps réel
- **Pièces jointes** : Bouton + — charge un rapport (`pdf_audits`) ou script (`site_script_rules`) du compte de l'utilisateur, avec bouton "Explique-moi"
- **Suggestions opérationnelles** : rappels de scans, suggestions Cocoon, recommandations d'audit, suggestions GMB si établissement local détecté

## Scoring de précision (`sav_quality_scores`)
- `precision_score` (0-100) : qualité globale
- `route_match` : navigation vers la destination suggérée (proximité logique)
- `repeated_intent_count` : reformulations du même motif (détecté par mots-clés)
- `escalated_to_phone` : escalade vers rappel
- Dashboard monitoring : Admin → Intelligence → Supervisor → Carte "Précision Assistant SAV"

## Escalade
- Après 3 itérations sans satisfaction → propose rappel téléphonique
- Collecte du numéro de téléphone (format 06/07)
- Stockage temporaire dans `sav_conversations.phone_callback`
- Purge automatique après 48h via `cleanup_expired_phone_callbacks()`

## Monitoring Admin
- Onglet SAV IA dans le dashboard admin
- Historique complet des conversations
- Indicateurs de satisfaction
- Registre des demandes de rappel
- Toutes les conversations enregistrées dans `sav_conversations`
- Score de pertinence dans Intelligence → Supervisor (AssistantPrecisionCard)

## Supervision
- **Supervisor** : audite l'assistant SAV (avg precision, escalation rate, repeated intents, route match rate)
- **Agent CTO** : ne monitore PAS l'assistant SAV (hors scope)

## Couverture Homepage (Lead Magnets)
- L'agent connaît les lead magnets de la homepage (GEO Score, LLM Visibility, AI Bots) pour orienter les utilisateurs
- Sait expliquer le fonctionnement du vérificateur de bots IA (robots.txt) et ses résultats
- Peut rediriger vers la page /aide pour la documentation complète des outils gratuits

## Couverture Matrice d'Audit
- Connaît le workflow complet : import fichier (XLSX/CSV/DOCX) → parsing → routing → exécution → résultats
- Sait orienter vers /matrice pour lancer un audit personnalisé
- Explique les trois types de détection : SEO, GEO, Hybride
- Décrit la logique de double scoring (Parsed Score vs Crawlers Score) et le matchType (exact/partial/custom_only)
- Peut expliquer pourquoi certains critères n'ont qu'un seul score (pas d'équivalent technique ou prompt custom uniquement)
- Connaît les micro-functions disponibles : meta-tags, structured-data, robots, images, backlinks, content-quality, eeat
- Sait que `check-llm` accepte un prompt personnalisé et un ciblage de provider unique
