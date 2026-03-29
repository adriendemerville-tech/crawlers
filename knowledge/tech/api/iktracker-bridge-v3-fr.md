# Memory: tech/api/iktracker-bridge-v3-fr
Updated: 2026-03-29

L'intégration bidirectionnelle avec IKtracker via 'iktracker-actions' permet à Parménion de piloter le registre Autopilot distant. Le système génère des articles de 800 à 1500 mots (Gemini 2.5 Pro) en format Markdown pur (##, ###, listes, liens markdown), excluant toute balise HTML. L'image de style 'cinematic' est stockée dans 'image-references/parmenion/' et injectée via le champ 'image_url' (alias de 'featured_image_url'). Pour garantir la pertinence sémantique et éviter les hallucinations SEO, l'utilisation de la fiche d'identité complète du site (ex: IKtracker) est obligatoire. L'authentification repose sur une clé API via le header 'x-api-key' avec bypass automatique du fair-use pour les appels système (SERVICE_ROLE).

## Endpoints disponibles (v2.0.0)

Base URL: `https://yarjaudctshlxkatqgeb.supabase.co/functions/v1/blog-api`

### Content
- `GET/POST/PUT/DELETE /posts` — Articles de blog (upsert par slug)
- `GET/POST/PUT/DELETE /pages` — Pages statiques (upsert par page_key)
- Field aliases: content, featured_image_url, meta_description, author_name, subtitle acceptent de multiples variantes

### Code Injection (alias: /code, /cms-push-code, /injection)
- `GET/PUT /cms-push-code/head` — Scripts head globaux (content, label, is_active)
- `GET/PUT /cms-push-code/body-end` — Scripts body-end globaux
- `GET/PUT /cms-push-code/page/:page_key` — Scripts par page

### SEO
- `GET/PUT /seo/robots-txt` — Contenu robots.txt
- `GET/POST/DELETE /seo/redirects` — Redirections 301/302

### Autopilot
- `POST /autopilot/events` — Signaler un événement
- `GET /autopilot/registry` — Timeline des changements
- `GET /autopilot/health` — Scores de santé par page
- `GET /autopilot/events` — Lister les événements
- `GET /autopilot/summary` — Résumé autopilot

### Actions iktracker-actions
Content: list-pages, get-page, update-page, create-page, delete-page, list-posts, get-post, create-post, update-post, delete-post
Injection: push-code-head, push-code-body, push-code-page, get-injection-head, get-injection-body-end, get-injection-page
SEO: get-robots-txt, update-robots-txt, list-redirects, create-redirect, delete-redirect
Autopilot: push-event, autopilot-registry, autopilot-health, autopilot-events, autopilot-summary
Divers: test-connection
