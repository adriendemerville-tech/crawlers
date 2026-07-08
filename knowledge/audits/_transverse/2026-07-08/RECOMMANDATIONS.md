# Vague 1 · Recommandations priorisées — 2026-07-08

Chaque reco = **But visé** (pourquoi on le fait) + **Score de gain qualité** sur 4 axes notés /10 :

- **Perf** : latence utilisateur + charge DB/edge
- **Sécu** : réduction surface d'attaque
- **Coût** : € LLM + € Supabase économisés
- **Maintenabilité** : lisibilité, dette, observabilité

**Score global** = moyenne pondérée (Perf ×1, Sécu ×1.5, Coût ×1.2, Maintenabilité ×1) / 4.7, sur 10.

Ordre = score global décroissant. Effort en jours-homme indicatif.

---

## P0 — À faire cette semaine

### 1. Batcher les updates compteurs `crawl_jobs` / `site_crawls`
**But visé** : arrêter d'exploser la DB avec 32M d'updates ligne à ligne pour incrémenter deux compteurs. Passer à un `SET x = x + N` toutes les 500 pages ou 5s côté worker.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 10 | 0 | 9 | 6 | **7.4** | 1j |

**Levier** : x100 à x500 sur le volume de calls, ~7 800s de DB récupérées sur la période.

---

### 2. Créer les 5 index composites manquants
**But visé** : passer les queries `analytics_events`, `crawl_jobs`, `parmenion_decision_log`, `strategist_recommendations` de 100-300ms à <20ms. Migration unique, zéro risque.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 9 | 0 | 6 | 5 | **5.8** | 0.5j |

**Levier** : ~5 000s de DB récupérées, dashboards Console/Admin plus fluides.

---

### 3. Refactor 12 appels LLM directs → `aiGatewayCall`
**But visé** : remettre TOUS les appels LLM sous observabilité (`ai_gateway_usage`), respecter le kill switch admin `disable_premium`, activer les fallbacks 2 niveaux, se conformer à la mémoire `combo-abc-allocation-fr`.

Fichiers : `audit-compare`, `calculate-llm-visibility`, `detect-fan-out`, `crawlQueue/finalizer`, `dataForSeoStrategic`, `strategicAudit/businessContext`, `check-llm`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 6 | 9 | 10 | **7.2** | 1.5j |

**Levier** : ~12 flux LLM aujourd'hui invisibles → tracés, plafonnables, résilients.

---

### 4. Statuer sur les 2 tables `RLS Enabled No Policy`
**But visé** : décider intentionnel (write-only via service_role → documenter) ou oubli (→ créer les policies). Aujourd'hui tables muettes ou trou de sécu selon.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 8 | 0 | 5 | **3.6** | 0.5j |

**Levier** : lever une ambiguïté sécu, retirer 2 INFO du scanner.

---

## P1 — Backlog 2 semaines

### 5. Migrer polling `site_crawls.status` + `crawl_pages` → Supabase Realtime
**But visé** : supprimer 48M d'appels de polling. UX crawl en direct (pas de délai 3-5s), charge DB divisée.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 9 | 0 | 7 | 7 | **6.1** | 2j |

---

### 6. `ALTER FUNCTION … SET search_path = public` en batch
**But visé** : neutraliser le risque de schema shadowing sur ~majorité des fonctions. Migration unique générée depuis le linter.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 7 | 0 | 4 | **3.1** | 0.5j |

---

### 7. Restreindre les policies SELECT des 5-6 buckets publics listables
**But visé** : empêcher un anon de lister le contenu (fuite indirecte : noms de fichiers, structure). Restreindre à `owner = auth.uid()` ou aux paths publics documentés.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 8 | 0 | 4 | **3.4** | 0.5j |

---

### 8. Audit des SECURITY DEFINER exécutables par `anon`
**But visé** : pour chaque fonction, décider REVOKE / passer INVOKER / documenter comme public volontaire (ex. `get_shared_architect_recommendation`). Fermer les escalations potentielles.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 9 | 0 | 5 | **3.9** | 1j |

---

### 9. Déplacer 2 extensions `public` → `extensions`
**But visé** : hygiène schéma standard Supabase, évite les collisions de noms.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 4 | 0 | 5 | **2.3** | 0.25j |

---

### 10. Retirer les emojis des 10+ fichiers source
**But visé** : conformité contrainte projet (emojis interdits). Remplacer par icônes `lucide-react` neutres.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 7 | **1.5** | 1j |

---

## P2 — Nice-to-have (à intégrer aux audits verticaux)

### 11. Nettoyer les ~400 hardcoded colors (concentrées Cocoon)
**But visé** : conformité design system (violet/or/noir/blanc), dark mode fonctionnel. À traiter dans l'audit Cocoon (Vague 2) pour éviter double passage.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 8 | **1.7** | 2j (dans Cocoon) |

---

### 12. Ajouter ESLint `no-console` (autoriser warn/error)
**But visé** : arrêter la pollution console utilisateur + éviter les leaks de payload en prod. Sweep unique sur 15 fichiers.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 2 | 0 | 5 | **1.7** | 0.5j |

---

### 13. Réduire les `: any` TypeScript au fil des audits verticaux
**But visé** : dette de typage. Traiter opportuniste, pas de sprint dédié.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 1 | 0 | 5 | **1.4** | continu |

---

## Synthèse

| Priorité | Items | Effort total | Gain global moyen |
|---|---|---|---|
| **P0 (cette semaine)** | 4 | **3.5j** | **6.0 / 10** |
| **P1 (2 semaines)** | 6 | **5.25j** | **3.4 / 10** |
| **P2 (opportuniste)** | 3 | ~continu | **1.6 / 10** |

**Recommandation** : enchaîner P0 (1 semaine dev) → lancer Vague 2 (audit `copilot-orchestrator`) en parallèle du P1 traité en fond de tâche.

---

# Vague 2 · Copilot Orchestrator — 2026-07-08

Brief : [`knowledge/audits/copilot-orchestrator/brief-2026-07-08.md`](../../copilot-orchestrator/brief-2026-07-08.md).
Périmètre audité : `supabase/functions/copilot-orchestrator/**` (5 328 lignes) + `src/hooks/useCopilot.ts` + `src/components/Copilot/**` + `supabase/functions/mcp-server/`.

## Points forts (baseline solide)

- Appels LLM **100% via `aiGatewayCall` / `aiGatewayCallStream`** — 0 bypass gateway. Conforme `combo-abc-allocation-fr`.
- `safeServiceCall` (anti-bypass RLS) présent sur les skills write sensibles (cms_publish, cms_patch).
- **Prompt safety complète** : `PROMPT_SAFETY_PREAMBLE` + `wrapUserContent` + `wrapToolResult` sur user_input, tool_result et memory_recall.
- **Intent bucket + `shouldRecallMemory`** gate l'embed+RPC vectoriel sur chit-chat/navigate (économie ~1 embed + 1 RPC par tour trivial).
- **`FORBIDDEN_EVEN_IN_CREATOR`** : 5 skills inviolables (`delete_site`, `delete_user`, `rotate_keys`, `escalate_to_human`, `mass_delete`) même en mode créateur admin.
- **Prompt caching Anthropic** actif + `maxOutputTokens` dynamique par bucket → coûts optimisés Claude.
- **Stop batch sur première approval** (P0 #2) — pas d'exécution en cascade non consentie.
- **Tests présents** : `helpers_test.ts`, `streaming_test.ts`, `intentBucket_test.ts`.
- **Hygiène code** : 0 `console.log`, 1 `: any` sur 5 328 lignes back.
- **MCP server exposé** (`supabase/functions/mcp-server/index.ts`, manifest live) — gating Pro Agency + rate limit 30/h.

## 14. Splitter `skills/registry.ts` (2 567 lignes, 26 skills en 1 fichier)
**But visé** : rendre le registry maintenable (aujourd'hui : PR conflicts systématiques, cold-start bundle lourd, revue impossible). Découper par domaine : `skills/read/`, `skills/cms/`, `skills/admin/`, `skills/cocoon/`, `skills/live/`, `skills/memory/`, `skills/sav/`, avec un `registry.ts` de 100 lignes qui agrège.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 3 | 1 | 10 | **3.5** | 2j |

**Levier** : dette de maintenabilité massive levée, onboarding contributeur x3.

## 15. Splitter `copilot-orchestrator/index.ts` (1 594 lignes)
**But visé** : séparer `Deno.serve` handler / agent loop / gestion approval-reject / cleanup / historique. Extraire `agentLoop.ts`, `session.ts`, `handlers/approve.ts`, `handlers/reject.ts`, `handlers/close.ts`. Améliore aussi le cold-start si tree-shaking.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 3 | 1 | 9 | **3.5** | 1.5j |

## 16. Étendre `safeServiceCall` aux skills read (5/26 aujourd'hui)
**But visé** : aujourd'hui `read_audit`, `read_site_kpis`, `read_cocoon_graph`, `read_site_memory`, `admin_lookup_user` s'appuient sur le `SkillContext.userClient` (RLS active) mais dès qu'un skill lit via `service` sans passer par `safeServiceCall`, l'appartenance `tracked_site` n'est pas vérifiée. Auditer les 21 skills restantes et forcer `safeServiceCall` pour tout accès `service` scoped à un `tracked_site_id` fourni par le LLM.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 9 | 0 | 5 | **3.9** | 1j |

**Levier** : ferme la classe entière de bugs "le LLM invente un tracked_site_id d'un autre user et le service_role obéit".

## 17. Refondre `mcp-server` avec `@lovable.dev/mcp-js` + OAuth 2.1
**But visé** : le MCP actuel (101 lignes codées main, bearer Supabase brut, emojis interdits dans les error messages 🔒⚠️⏳❌) doit passer à `@lovable.dev/mcp-js` — `defineTool` par outil, `defineMcp` central, OAuth 2.1 avec consentement page (`/.lovable/oauth/consent`) au lieu du bearer session copié. Aligne Crawlers sur le standard Rank.ai / Screaming Frog MCP et débloque la connexion depuis ChatGPT / Claude / Cursor sans copier-coller de JWT.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 8 | 0 | 8 | **4.9** | 3j |

**Levier stratégique** : gap concurrentiel (mars 2026 = Screaming Frog MCP) refermé, exposition Crawlers → écosystème agents externes.

## 18. `MAX_ITERATIONS = 6` trop bas pour workflow multi-skills
**But visé** : la doc `ai-sdk-agent-patterns` recommande `stepCountIs(50)` pour agents. Ici 6 tours = coupe prématurément un workflow "audit maillage → propose fix → cms_patch" qui peut prendre 8-10 tool_calls. Passer à 12 par défaut, 20 en mode créateur.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 1 | 0 | -2 | 5 | **1.1** | 0.25j |

**Attention** : léger surcoût LLM (score coût négatif). À combiner avec un `iteration_budget` par persona pour cap sécu.

## 19. Retirer les emojis de `mcp-server/index.ts` (contrainte projet)
**But visé** : conformité règle "emojis interdits". Remplacer par messages texte neutres.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 6 | **1.3** | 0.1j |

Regroupé avec l'item 17 (refonte MCP) pour éviter double passage.

## Synthèse Vague 2 · Copilot

| Priorité | Items | Effort | Gain global moyen |
|---|---|---|---|
| **P0-Copilot** | #16 (safeServiceCall read skills) · #17 (MCP OAuth) | **4j** | **4.4 / 10** |
| **P1-Copilot** | #14 (split registry) · #15 (split index) · #18 (MAX_ITER) | **3.75j** | **2.7 / 10** |
| **P2-Copilot** | #19 (emojis MCP) | **0.1j** (dans #17) | **1.3 / 10** |

**Verdict global copilot** : **architecture solide, dette de refactor + un gap MCP stratégique**. Le copilote est parmi les plus mûrs du projet — priorité = #17 (positionnement concurrentiel MCP) + #16 (fermer trou RLS potentiel).

**Baseline à re-mesurer dans 30j** :
- Lignes `skills/registry.ts` (baseline : **2 567**)
- Lignes `index.ts` (baseline : **1 594**)
- Skills utilisant `safeServiceCall` sur 26 total (baseline : **5/26 = 19%**)
- MCP auth mode (baseline : `bearer_supabase_session`, cible : `oauth_2.1_dcr`)

---

# Vague 2 · Parménion (autopilot orchestrator) — 2026-07-08

Brief : [`knowledge/audits/parmenion/brief-2026-07-08.md`](../../parmenion/brief-2026-07-08.md).
Périmètre : `parmenion-orchestrator` (2 467 l.) + `autopilot-engine` (1 218 l.) + `autopilot-validate-deployed` (308 l.) + `parmenion-feedback` (227 l.) + `parmenion-api` (184 l.) + `_shared/parmenion/**` + `_shared/autopilot/**`.

## Points forts

- **Modularisation shared solide** : `_shared/parmenion/{types,prompts,toolSchemas,llmClient,keywordEnrichment,personaEngine,imageOriginality}` + `_shared/autopilot/{types,cmsActionRouter,iktrackerBridge,postDiagnose,semanticGate,postExecute}` — orchestrator délégué proprement.
- **Pipeline 5 phases déterministe** avec `getNextPhase`, garde crawl-in-flight, `consecutive_crawl_skips` pour alerting.
- **Gardes en place** : backlog guard, cluster diversity SQL cap, persona rotation, dedup Jaccard synonym-aware, saturation snapshots — conformes aux mémoires projet.
- **Route admin-only** : check `getAuthenticatedUser` + `isAdmin` (sauf service_role interne).
- **`validate-deployed`** : Jaccard + longueur + qualité + marqueurs script → vraie validation post-deploy (rare dans la concurrence).
- **CMS bridge routing** : `resolveCmsBridge` traite Dictadevi comme IKtracker en orchestrator et ré-aiguille en execute (élégant).

## 20. `parmenion-orchestrator` — 2 fetch LLM directs hors `aiGatewayFetch` (P0)
**But visé** : ligne 2105 `index.ts` + ligne 58 `_shared/parmenion/llmClient.ts` bypassent `aiGatewayFetch` (fallback maison OpenRouter → Lovable). Résultat : ces cycles Parménion **échappent au tracking `ai_gateway_usage`**, au kill switch admin `disable_premium`, au routage 2026 forcé. Refactor pour tout passer par `aiGatewayFetch` (qui gère déjà cascade + tracking + kill switch).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 5 | 9 | 8 | **5.5** | 1j |

**Levier** : les cycles Parménion sont fréquents (cron 6h × N sites) — coût aujourd'hui invisible dans le dashboard admin, kill switch inopérant sur cette voie.

## 21. `autopilot-engine` — 15+ fetch manuels vers edge functions avec `SERVICE_ROLE_KEY` inline
**But visé** : remplacer les `fetch(\`${supabaseUrl}/functions/v1/...\`, { Authorization: Bearer SERVICE_ROLE })` par `supabase.functions.invoke()` sur le client service. Bénéfices : (1) une seule surface `Authorization` gérée par le client SDK, (2) retry/timeout unifiés, (3) plus de risque de leaker service_role dans les logs si un `console.log(headers)` traîne, (4) auto-injection headers CORS/version.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 1 | 6 | 0 | 8 | **3.7** | 1.5j |

## 22. `autopilot-engine` — 34 `console.log` en prod
**But visé** : cron 6h × N sites → volume énorme de logs bruts non structurés dans `edge_function_logs`. Passer à `console.log(JSON.stringify({ event, ... }))` structuré ou introduire un helper `log()` léger avec niveaux (`info` / `warn` / `error`).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 1 | 2 | 7 | **2.8** | 0.5j |

## 23. Splitter `parmenion-orchestrator/index.ts` (2 467 lignes)
**But visé** : le fichier reste monolithique malgré `_shared/parmenion/` — le `Deno.serve` handler mélange phase detection, garde crawl, prescribe, execute-dispatch, feedback. Extraire un `phases/{audit,diagnose,prescribe,execute,validate}.ts` déclenchés par un mini router de phase.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 2 | 1 | 9 | **3.1** | 2j |

## 24. Ajouter des tests sur le pipeline 5 phases (aucun test dans le périmètre)
**But visé** : `helpers_test` + `intentBucket_test` existent sur copilot, **rien** sur Parménion. Ajouter au minimum : test `getNextPhase` (transitions valides), test backlog guard (>5 pending), test dedup Jaccard (synonym-aware), test crawl-guard (skip si `processing`).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 3 | 1 | 9 | **2.9** | 1.5j |

**Levier** : Parménion touche à des sites de prod en écriture CMS — une régression silencieuse (backlog guard cassé, phase qui saute) publie du contenu non maîtrisé.

## Synthèse Vague 2 · Parménion

| Priorité | Items | Effort | Gain global moyen |
|---|---|---|---|
| **P0-Parménion** | #20 (LLM hors gateway) · #21 (fetch → invoke) | **2.5j** | **4.6 / 10** |
| **P1-Parménion** | #23 (split orchestrator) · #24 (tests pipeline) · #22 (console.log) | **4j** | **2.9 / 10** |

**Verdict global Parménion** : **pipeline solide et unique sur le marché (validation post-deploy + gardes)**, mais **2 fetch LLM directs sont critiques** — Parménion est un des plus gros consommateurs LLM (cron 6h × N sites × 5 phases) et ces coûts sont invisibles dans le dashboard admin. Fix #20 est prioritaire.

**Baseline à re-mesurer dans 30j** :
- Appels LLM `parmenion-orchestrator` tracés dans `ai_gateway_usage` (baseline : **incomplet, 2 flux non tracés**)
- Fetch manuels dans `autopilot-engine` (baseline : **15+**)
- `console.log` dans `autopilot-engine` (baseline : **34**)
- Tests unitaires Parménion (baseline : **0**)
- Lignes `parmenion-orchestrator/index.ts` (baseline : **2 467**)
