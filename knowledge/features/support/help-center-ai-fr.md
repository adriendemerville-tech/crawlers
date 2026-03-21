# Memory: features/support/help-center-ai-fr
Updated: now

## Agent SAV "Crawler"
- Modèle : Gemini Flash via Lovable AI Gateway (`LOVABLE_API_KEY`)
- Limite stricte : 1000 caractères par message
- Base de connaissance : documentation /aide + taxonomie front-end complète
- Accès aux données backend : `tracked_sites`, `crawl_pages`, `site_crawls`, `cocoon_sessions`, `profiles`
- Consigne : ne produit pas (pas d'audits, crawls, génération de code) — explique et conseille uniquement
- Détection automatique de la langue de l'utilisateur
- Utilise le prénom si disponible dans `profiles`
- Peut envoyer des liens internes (ex: `/cocoon`, `/matrice`, `/console`)
- Logo robot Crawlers dans la conversation (remplace emoji et "Crawler" texte)

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

## Suggestions opérationnelles
L'agent peut formuler des suggestions basées sur les données réelles du client :
- Rappels de scans non effectués depuis longtemps
- Suggestions d'utilisation de Cocoon pour les gaps détectés
- Recommandations suite aux résultats d'audit (notoriété, maillage, etc.)
- Suivi des scripts injectés et de leur efficacité
