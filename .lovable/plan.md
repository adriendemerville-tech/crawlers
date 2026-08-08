# Recette 48 h + plan de tâches

Recette complète des livraisons du 06/08 09h au 08/08 09h : lecture du code modifié, typecheck front + Deno, smoke test navigateur des pages clés, état réel en base (Parménion, jobs, workbench, LLM).

Rapport détaillé : `knowledge/audits/_recette/recette-48h-2026-08-08.md`

## Ce qui a été livré

Content Integrity (near-duplicate SimHash/LSH + thin content), confrontation d'audits tiers, disclaimer PDF obligatoire, Marina Multipages (15 URLs / répertoire), mutualisation des rapports Marina + synthèse exécutive /100, plafonds grands sites 10 000 URLs, bloc Marché & Autorité (Authority Score /100), métadonnées site par défaut, doc technique v12.

## Déjà corrigé pendant la recette

- **SSR cassé sur `/marina` et la home** : `window` lu pendant le rendu (Marina, `mockNewsData`, `FreeTrialBanner`) — React basculait en rendu client, donc HTML appauvri pour Google et les IA sur deux pages stratégiques. Corrigé, plus aucune erreur de rendu serveur.
- **`.catch()` sur un builder PostgREST** dans le chemin d'erreur d'`audit-strategique-ia` : masquait l'erreur réelle et laissait le job bloqué. Corrigé et redéployé.
- **Clés dupliquées** dans `_shared/lovableAI.ts` (table de fallback + table de coûts).
- **Parménion figé** : `iktracker.fr` bloqué en « en cours » depuis 06h avec 3 cycles morts. Réconciliation appliquée.

## Ce qui reste en défaut

- Parménion n'a **aucune auto-réconciliation** : ce blocage est le 3e du même type. Un déblocage manuel n'est pas un correctif.
- 5 fonctions tuées en CPU wall-time en 48 h (`content-architecture-advisor`, `marina`).
- **Trois features livrées sans aucun run réel** : Content Integrity (0 constat), Autorité (0 constat), audits tiers (0 import).
- Cadence : `dictadevi.io` 22 h sans cycle, `crawlers.fr` 36 h, LinkedIn 0 post en 48 h.
- Types Deno : traductions Marina EN/ES incomplètes, incompatibilité `ToolsData` / `CrawlToolsData` dans le scoring de citabilité.
- 148 avertissements linter base (2 tables RLS sans policy, `search_path` mutable, SECURITY DEFINER publics).

## Plan de tâches proposé

### Lot A — fiabilité production (aujourd'hui)
- A1. Auto-réconciliation dans `parmenion-orchestrator` : config « en cours » > 2 h → `idle`, décision `planned` > 30 min → reprise de la phase (pas seulement `skipped_stale`).
- A2. Découper `content-architecture-advisor` et `marina` en étapes enfilées dans `job_queue` + timeout dur, pour supprimer les CPU wall-time.
- A3. Vérifier le cron LinkedIn et rejouer un cycle Parménion sur `dictadevi.io` et `crawlers.fr`.

### Lot B — preuve d'exécution des nouveautés (48 h)
- B1. Crawl réel sur un site pilote pour produire des constats `near_duplicate` / `thin_content` et vérifier leur consommation par Parménion.
- B2. Audit stratégique réel sur `crawlers.fr` pour valider la chaîne Autorité complète : carte UI → section PDF → workbench → tâche Parménion.
- B3. Import d'un vrai audit tiers pour valider les verdicts et le hook de navigation.
- B4. Rejouer un crawl 7 000 pages pour valider les plafonds et le graph.

### Lot C — qualité et coût (1 semaine)
- C1. Corriger les types Deno (traductions Marina EN/ES, `ToolsData` / `CrawlToolsData`).
- C2. Batcher les compteurs de crawl (premier levier de charge base).
- C3. Mutualiser le cache Marina et le cache autorité (mêmes appels DataForSEO payants).
- C4. Un seul appel LLM de synthèse par domaine en multipages au lieu d'un par URL.
- C5. Traiter les 148 avertissements linter par familles (policies manquantes d'abord).
