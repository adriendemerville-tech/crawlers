# Memory: tech/autopilot/routing-dispatch-fr
Updated: 2026-03-28

## Routing & Dispatch — Parménion

### Principe
L'orchestrateur Parménion distingue strictement les canaux de déploiement selon le type de correctif prescrit par le LLM.

### 5 canaux de sortie

| Canal | Payload LLM | Destination | Exemples |
|-------|------------|-------------|----------|
| `emit_code` | JS injectable, CSS, scripts | `generate-corrective-code` | Fix LCP, lazy-loading, schema.org dynamique |
| `emit_code_deploy` | Code correctif prêt | `cms-push-code` | Push du JS correctif dans WordPress, Shopify, Drupal, Webflow, PrestaShop, Odoo (fallback widget.js) |
| `emit_corrective_data` | JSON, meta, structured data | `iktracker-actions` (update-page) | robots.txt, sitemap entries, JSON-LD |
| `emit_corrective_content` | H1, H2, paragraphes existants | `iktracker-actions` (update-page) | Réécriture titre, enrichissement contenu |
| `emit_editorial_content` | Nouveaux articles, nouvelles pages | `iktracker-actions` (create-post) / `cms-push-draft` | Articles de blog, pages FAQ, landing pages |

### Règles de groupement
- **Lot TECHNIQUE** : `emit_code` + `emit_corrective_data` (même prompt LLM)
- **Lot CONTENU** : `emit_corrective_content` + `emit_editorial_content` (même prompt LLM)
- Le mélange technique/contenu dans un même prompt est **interdit**
- Max 4 tool calls par prompt

### Re-routage automatique
L'engine effectue un re-routage automatique si le LLM prescrit :
- Du code technique à destination du bridge CMS → redirigé vers `generate-corrective-code`
- Du contenu éditorial à destination du code → redirigé vers `iktracker-actions`

### Dispatch vers IKtracker
Le bridge `iktracker-actions` traduit les prescriptions en actions CMS :
- `update-page` : modification de pages existantes (meta, H1, contenu)
- `create-post` : création de nouveaux articles
- `delete-page` / `delete-post` : suppression (avec confirmation)

### Coordonnées de ciblage
Chaque prescription porte les coordonnées issues du workbench :
- `target_url` → quelle page
- `target_selector` → quel élément (h1, meta_description, content, schema_org, a[href])
- `target_operation` → quelle action (replace, insert_after, append, create, delete_element)

Le LLM reçoit ces coordonnées et produit le contenu/code correspondant. L'engine de dispatch mappe ensuite vers l'action CMS appropriée.

### Limites de sécurité
- Max 10 actions CMS par cycle
- Logging systématique dans `analytics_events` (event_type: `cms_action:iktracker`)
- Synchronisation avec le registre Autopilot distant d'IKtracker (`push-event`)
