# Memory: tech/api/iktracker-bridge-v2-fr
Updated: 2026-03-28

## Bridge IKtracker — Intégration bidirectionnelle

### Edge Function : `iktracker-actions`
Pont API entre Crawlers et l'API Content d'IKtracker. Permet de lire/modifier les articles de blog et les pages statiques.

### URL cible
`https://yarjaudctshlxkatqgeb.supabase.co/functions/v1/blog-api`

### Authentification
Header `x-api-key` avec le secret `IKTRACKER_API_KEY`.

### Actions disponibles

#### Pages (CMS)
| Action | Description |
|--------|-------------|
| `list-pages` | Lister toutes les pages |
| `get-page` | Récupérer une page par `page_key` |
| `update-page` | Modifier une page (meta, contenu, H1, etc.) |
| `create-page` | Créer une nouvelle page |
| `delete-page` | Supprimer une page |

#### Posts (Blog)
| Action | Description |
|--------|-------------|
| `list-posts` | Lister les articles (pagination limit/offset) |
| `get-post` | Récupérer un article par `slug` |
| `create-post` | Créer un nouvel article |
| `update-post` | Modifier un article |
| `delete-post` | Supprimer un article |

#### Autopilot (Monitoring)
| Action | Description |
|--------|-------------|
| `push-event` | Pousser un événement de santé (event_type, severity, page_key, message) |
| `autopilot-registry` | Consulter la timeline des modifications |
| `autopilot-health` | Scores de santé par page |
| `autopilot-events` | Lister les incidents (filtre `resolved`) |
| `autopilot-summary` | Résumé global de l'Autopilot |

#### Utilitaire
| Action | Description |
|--------|-------------|
| `test-connection` | Tester la connexion (liste les pages, retourne le count) |

### Utilisation par Parménion
L'Autopilote utilise `iktracker-actions` pour :
1. **Execute** : déployer les corrections de contenu (`update-page`) et les nouveaux articles (`create-post`)
2. **Validate** : vérifier le déploiement via `get-page` / `get-post`
3. **Sync** : pousser un événement de statut à IKtracker à chaque complétion de phase (`push-event`)

### Traçabilité
Chaque action est loguée dans `analytics_events` avec :
- `event_type: 'cms_action:iktracker'`
- `event_data: { action, slug, page_key, updates_keys, response_status }`
