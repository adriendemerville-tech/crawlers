# Vague 1 · Audit transverse — 2026-07-08

Trois scans automatisés lancés en parallèle : sécurité (`security--run_security_scan` + `supabase--linter`), performance DB (`supabase--slow_queries`), hygiène de code (`rg` transverse) + dépendances npm.

Détails par domaine : [01-security-scan.md](./01-security-scan.md) · [02-slow-queries.md](./02-slow-queries.md) · [03-code-hygiene.md](./03-code-hygiene.md).

## Findings critiques (à fixer cette semaine)

- [ ] **Batcher les updates `crawl_jobs.processed_count` et `site_crawls.crawled_pages`** — 32M appels cumulés, 7 800s de DB. Agréger côté worker en tranches de 500 pages / 5s. Levier x100 sur la charge DB.
- [ ] **Créer 5 index composites manquants** (`crawl_jobs`, `analytics_events` ×2, `parmenion_decision_log`, `strategist_recommendations`) — voir migration dans `02-slow-queries.md`.
- [ ] **Retirer 12 appels LLM directs hors `aiGatewayCall`** (`audit-compare`, `calculate-llm-visibility`, `detect-fan-out`, `crawlQueue/finalizer`, `dataForSeoStrategic`, `strategicAudit/businessContext`, `check-llm`) — viole la mémoire `combo-abc-allocation-fr`, coûts LLM invisibles.
- [ ] **Identifier les 2 tables `RLS Enabled No Policy`** et statuer (intentionnel ou oubli).

## Findings moyens (backlog 2 semaines)

- [ ] Migrer polling `site_crawls.status` et `crawl_pages` vers Supabase Realtime — 48M appels cumulés uniquement pour du polling.
- [ ] `ALTER FUNCTION … SET search_path = public` en batch sur toutes les functions flaggées.
- [ ] Restreindre les policies SELECT des 5-6 buckets publics qui autorisent le listing.
- [ ] Statuer sur chaque SECURITY DEFINER exécutable par `anon` : REVOKE, INVOKER, ou documenté public.
- [ ] Déplacer les 2 extensions installées dans `public` → schéma `extensions`.
- [ ] Retirer les emojis des 10+ fichiers source (contrainte projet).

## Findings mineurs (nice-to-have)

- [ ] Nettoyer les hardcoded colors (~400 occurrences, concentrées Cocoon) — sera repris dans l'audit Cocoon (Vague 2).
- [ ] Ajouter ESLint `no-console` (15 fichiers avec `console.log` en prod).
- [ ] Réduire les `: any` TypeScript au fil des audits verticaux.

## Métriques baseline (à comparer dans 30j)

| Signal | Baseline 2026-07-08 |
|---|---|
| Findings sécurité totaux | **151** (0 ERROR, ~149 WARN, 2 INFO) |
| Vulnérabilités npm high/critical | **0** |
| Total ms cumulé top 5 slow queries | **~14 300 s** (période pg_stat_statements) |
| Calls `UPDATE crawl_jobs.processed_count` | **16 296 269** |
| Appels LLM hors gateway centralisé | **14** (dont ~2 légitimes) |
| Fichiers `src/` contenant des emojis | **10+** |
| Hardcoded colors dans `src/` | **~400 occurrences** |
| Fichiers `src/` avec `console.log` | **15** |

## Recommandation d'enchaînement

1. **Cette semaine** : implémenter les 4 findings critiques (levier immédiat sur perf DB + coût LLM + observabilité).
2. **Semaine +1** : Vague 2 · audit `copilot-orchestrator` (avec canevas `audit-brief`).
3. Le nettoyage design-system Cocoon sera intégré à l'audit Cocoon (Vague 2, feature 3) pour éviter le double passage.
