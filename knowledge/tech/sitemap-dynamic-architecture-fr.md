# Memory: tech/sitemap-dynamic-architecture-fr
Updated: 2026-04-14

## Sitemap dynamique — Architecture

### Source de vérité : table `sitemap_entries`
- Colonnes : `domain`, `loc`, `lastmod`, `changefreq`, `priority`, `page_type`, `is_active`
- Contrainte UNIQUE(domain, loc), index partiel sur (domain, is_active)
- RLS : lecture publique, écriture service_role uniquement
- Seed initial : ~65 pages statiques + articles blog existants

### Trigger automatique
- `sync_blog_to_sitemap()` sur `blog_articles` (AFTER INSERT/UPDATE/DELETE)
- Publication → UPSERT avec lastmod = CURRENT_DATE
- Dépublication/suppression → is_active = false (soft delete)

### Flux de génération (à implémenter)
1. Cron quotidien OU trigger post-publication → edge function `regenerate-sitemap`
2. SELECT FROM sitemap_entries WHERE is_active = true AND domain = X
3. Génération XML avec hreflang (fr, en, es, x-default)
4. Upload dans Storage bucket `public-assets/sitemap.xml`
5. `robots.txt` pointe vers `https://crawlers.fr/sitemap.xml`
6. `submit-sitemap` notifie GSC via API

### Problèmes résolus
- Fuite du project ref Supabase dans robots.txt
- Pages codées en dur (~240 lignes → ~80 lignes)
- Dates lastmod = today (faux signal SEO)
- Désynchronisation sources/sitemap

### Phases restantes
- Phase 2 : Refactorer edge function sitemap/index.ts (lire sitemap_entries)
- Phase 3 : Bucket Storage + URL propre crawlers.fr/sitemap.xml
- Phase 4 : Cron de régénération
- Phase 5 : submit-sitemap avec nouvelle URL
- Phase 6 : Widget monitoring admin
