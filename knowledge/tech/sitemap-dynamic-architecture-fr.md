# Memory: tech/sitemap-dynamic-architecture-fr
Updated: 2026-04-14

## Sitemap dynamique — Architecture complète

### Source de vérité : table `sitemap_entries`
- Colonnes : `domain`, `loc`, `lastmod`, `changefreq`, `priority`, `page_type`, `is_active`
- Contrainte UNIQUE(domain, loc), index partiel sur (domain, is_active)
- RLS : lecture publique, écriture service_role uniquement
- Seed initial : ~65 pages statiques + articles blog existants

### Trigger automatique (Phase 1 ✅)
- `sync_blog_to_sitemap()` sur `blog_articles` (AFTER INSERT/UPDATE/DELETE)
- Publication → UPSERT avec lastmod = CURRENT_DATE
- Dépublication/suppression → is_active = false (soft delete)

### Edge Function `sitemap/index.ts` (Phase 2 ✅)
- Lit `sitemap_entries` WHERE is_active = true AND domain = 'crawlers.fr'
- Génère XML avec hreflang (fr, en, es, x-default) via `?lang=` params
- ETag basé sur count + max(lastmod) → 304 Not Modified si inchangé
- Fallback minimal (homepage) en cas d'erreur DB

### Storage CDN (Phase 3 ✅)
- Bucket `public-assets` (public, service_role write only)
- Edge function `regenerate-sitemap` : lit entries → génère XML → upload dans Storage
- URL CDN : `{SUPABASE_URL}/storage/v1/object/public/public-assets/sitemap.xml`
- Fallback implicite : si régénération échoue, l'ancien fichier reste servi par le CDN

### Trigger chaîné + Cron (Phase 4 ✅)
- Trigger `trg_notify_sitemap_regen` sur `blog_articles` (AFTER INSERT/UPDATE/DELETE)
- Appelle `regenerate-sitemap` via `pg_net.http_post()` (async, non-bloquant)
- Se déclenche uniquement sur changement de statut (publication/dépublication)
- Cron backup quotidien à 4h UTC via `pg_cron` → filet de sécurité
- Chaîne : blog_articles change → sync_blog_to_sitemap (table) → notify_sitemap_regeneration (XML)

### Soumission GSC (Phase 5 ✅)
- `submit-sitemap` pointe vers l'URL Storage CDN (plus l'edge function)
- feedpath par défaut : `{SUPABASE_URL}/storage/v1/object/public/public-assets/sitemap.xml`
- Log analytics : `sitemap_submitted_gsc`

### Widget monitoring admin (Phase 6 ✅)
- Composant `SitemapMonitorWidget` dans le dashboard admin (onglet "Sitemap")
- Affiche : URLs actives/inactives, breakdown par page_type, dernière régénération, dernière soumission GSC
- Bouton "Régénérer" pour forcer manuellement

### Hreflang — Architecture actuelle
- Généré dynamiquement par `buildHreflang()` dans l'edge function
- Ajoute `?lang=en` / `?lang=es` à chaque URL crawlers.fr
- Pas stocké dans la table (suffisant pour SPA avec paramètre lang)
- Si migration vers URLs `/en/`, `/es/` → nécessitera colonne `alternate_urls` ou `hreflang_group_id`

### Sécurité
- Project ref Supabase purgé de tous les fichiers client/public (134 occurrences corrigées)
- Helper centralisé : `src/utils/supabaseUrl.ts` → `edgeFunctionUrl()`
- Scripts publics (widget.js, cloudflare-worker, crawlers-agent) : URL configurable via env var
