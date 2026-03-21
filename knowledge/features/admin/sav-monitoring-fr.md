# Memory: features/admin/sav-monitoring-fr
Updated: now

Le dashboard Admin dispose d'un onglet 'SAV IA' centralisant l'historique des conversations de l'agent 'Crawler'. Il permet de suivre les indicateurs de satisfaction, les demandes d'escalade vers un rappel téléphonique et le registre des numéros de téléphone collectés (purgés sous 48h via `cleanup_expired_phone_callbacks()`). Cette interface assure le contrôle qualité des réponses générées par l'IA et la gestion des demandes de support complexes.

## Agent Crawler (SAV)
- Modèle : Gemini Flash via Lovable AI Gateway
- Limite : 1000 caractères par message
- Base de connaissance : documentation /aide + taxonomie front-end complète (routes, onglets, composants)
- Accès data : tables `tracked_sites`, `crawl_pages`, `site_crawls`, `cocoon_sessions` pour suggestions opérationnelles
- Détection automatique de la langue de l'utilisateur
- Utilise le prénom de l'utilisateur quand disponible (table `profiles`)
- Escalade téléphonique après 3 itérations insatisfaisantes
- Table : `sav_conversations` (messages JSON, phone_callback, phone_callback_expires_at)
- Logo robot Crawlers au lieu d'emoji dans la conversation
- Peut envoyer des liens internes vers les fonctionnalités pertinentes

## Agent Cocoon (Assistant Maillage)
- Détection automatique de la langue
- Bouton seringue pour injecter les instructions de maillage
- Historique : `cocoon_chat_histories`
