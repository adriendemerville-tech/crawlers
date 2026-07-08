---
name: audit-brief
description: Rédige un brief d'audit cadré (objectif métier, cas d'usage, logique, critères qualité, benchmark concurrentiel, périmètre, signaux) AVANT tout audit de feature ou d'edge function Crawlers. Se déclenche dès qu'un audit backend/frontend/perf/sécurité est demandé sur une feature nommée.
---

# Audit Brief — Canevas Crawlers

Objectif : produire un `.md` de cadrage figé AVANT chaque audit, pour que l'audit reste focalisé, mesurable et comparable dans le temps.

## Quand déclencher

- L'utilisateur demande « audite {feature|function|module} »
- Un re-audit est planifié sur une feature déjà briefée (comparer vs baseline)
- Avant tout refactor structurel d'une edge function chaude

## Workflow

1. Identifier la cible : nom de la feature OU nom d'edge function OU chemin frontend.
2. Créer le fichier `knowledge/audits/{feature-slug}/brief-YYYY-MM-DD.md` avec le canevas ci-dessous rempli.
3. Lister les fichiers du périmètre (backend + frontend + tables) via `rg` — ne pas les lire encore.
4. Présenter le brief à l'utilisateur pour validation / correction du benchmark concurrentiel.
5. Après validation → lancer l'audit en gardant ce brief en ligne de mire.
6. À la fin de l'audit, écrire `knowledge/audits/{feature-slug}/audit-YYYY-MM-DD.md` qui référence le brief et scoré chaque critère qualité.

## Canevas obligatoire (7 sections figées)

```md
# Audit Brief — {feature}
Date : {YYYY-MM-DD} · Auditeur : Lovable · Baseline : {lien vers brief précédent ou "première itération"}

## 1. Objectif métier
{1-2 phrases : ce que la feature doit accomplir pour l'utilisateur final Crawlers}

## 2. Cas d'usage principaux
- {Persona (Free / Premium / Pro Agency / Admin)} → {action} → {résultat attendu}
- ...

## 3. Logique métier clé
- Règles, formules, seuils
- Gating : plan, rôle, quota
- Dépendances : tables (`x`, `y`), edge functions (`a`, `b`), LLM (modèle + fallback), APIs externes
- Contraintes projet applicables (mémoires : {liste mem://...})

## 4. Critères de qualité attendus
| Axe | Cible | Mesure |
|---|---|---|
| Fonctionnel | {ce qui doit marcher} | test/manuel |
| Performance | latence p95 < {X}ms | logs edge |
| Coût LLM | < {Y}¢ / appel | `ai_gateway_usage` |
| Sécurité | RLS + GRANT + isolation `auth.uid()` | `security--run_security_scan` |
| UX | design system Crawlers (violet/or/noir/blanc, pas d'emoji, pas de bleu IA, boutons bordure+texte) | revue visuelle |

## 5. Benchmark concurrentiel
- Concurrent 1 : {nom} — ce qu'ils font, force/faiblesse
- Concurrent 2 : ...
- Barre à atteindre / dépasser : {phrase claire}

## 6. Périmètre d'audit
### In scope
- Backend : `supabase/functions/{...}/index.ts`
- Frontend : `src/{...}`
- Tables : `{...}`
### Hors scope
- {ce qu'on n'audite PAS cette fois}

## 7. Signaux à mesurer
- SQL : `select ... from ai_gateway_usage where edge_function = '...'`
- Logs edge : `supabase--edge_function_logs {name}`
- Analytics : événements `analytics_events` pertinents
- Métriques front : bundle size, re-renders, requêtes réseau
```

## Règles dures

1. NE JAMAIS lancer un audit sans brief validé par l'utilisateur.
2. NE JAMAIS improviser une section — les 7 sections sont figées et obligatoires.
3. Le benchmark concurrentiel (§5) DOIT être proposé par l'agent puis corrigé par l'utilisateur (l'agent connaît mal le marché SEO/GEO français fin).
4. Le brief est un artefact versionné : ne jamais écraser, toujours créer `brief-YYYY-MM-DD.md`.
5. Respecter les contraintes projet Crawlers (couleurs violet/or/noir/blanc, pas d'emoji, pas de bleu IA, boutons sans fond).
6. Rationaliser les tokens : lister les fichiers du périmètre AVANT de les lire, et ne lire que ceux qui servent le brief.

## Failure modes

- Feature ambiguë (« audite le copilot ») → demander précision (Félix ? Stratège ? orchestrator ? UI ?) avant d'écrire le brief.
- Aucune donnée dans `ai_gateway_usage` pour cette function → noter §7 « pas de baseline, audit qualitatif uniquement ».
- Concurrent inconnu → laisser §5 en TODO explicite pour l'utilisateur, ne pas inventer.
