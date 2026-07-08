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

---

# Vague 2 · Cocoon — 2026-07-08

Brief : [`knowledge/audits/cocoon/brief-2026-07-08.md`](../../cocoon/brief-2026-07-08.md).
Périmètre : **11 edge functions** cocoon-* (5 967 l. backend) + **34 composants** frontend Cocoon (~13 600 l.) + `Cocoon.tsx` (1 346 l.) + `FeaturesCocoon.tsx` (422 l.).

## Points forts

- **Backend LLM 100% propre** : `cocoon-chat` et `cocoon-diag-subdomains` utilisent `aiGatewayFetch`, tous les autres (`cocoon-strategist`, `calculate-cocoon-logic`, `cocoon-diag-{authority,content,semantic,structure}`) sont déterministes → coût LLM Cocoon **maîtrisé**.
- **Modularisation backend** : 11 functions séparées par domaine (diag, linking, deploy, chat, strategist) — pas de monolithe.
- **3 modes de visualisation** (2D force, 3D three.js, radial) → offre unique sur le marché.
- **Content Architect** avec cache markdown TTL 30j + RPC partagée → économie LLM sur recommandations similaires cross-users.
- **Persist session** dédiée (`persist-cocoon-session`) → reprise séance intacte.

## 25. Frontend Cocoon — dette de composants monstres (P0-Maint)
**But visé** : 5 composants dépassent 1 000 lignes et concentrent la majeure partie de la dette. Découper en sous-composants et hooks métier.

| Fichier | Lignes | Action |
|---|---|---|
| `CocoonAIChat.tsx` | **2 143** | Extraire `useCocoonChat` hook, `<ChatHeader>`, `<ChatMessages>`, `<ChatInput>`, `<StrategistSidebar>` |
| `CocoonForceGraph3D.tsx` | 1 213 | Extraire `useGraphData`, `<NodeMesh>`, `<LinkLine>`, `<GraphControls>` |
| `CocoonForceGraph.tsx` | 1 148 | Idem 2D, factoriser avec 3D via `useCocoonGraph` |
| `CocoonRadialGraph.tsx` | 1 083 | Idem |
| `Cocoon.tsx` (page) | 1 346 | Extraire tabs, orchestration, modaux en sous-pages |

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 4 | 1 | 1 | 10 | **3.7** | 5j |

**Levier** : les 3 graphes dupliquent probablement 60% de logique (nodes/links/filters/tooltips). Un `useCocoonGraph()` partagé + `GraphRenderer` par techno diviserait le code par ~2.

## 26. Supprimer le shim `CocoonAIChatUnified.tsx` (dead-code)
**But visé** : ce fichier est un re-export 9 lignes de l'ancien `CocoonAIChat`. Confusant, laisse croire à un nouveau chat. Migrer les 3 imports vers `CocoonAIChat` direct puis supprimer le shim.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 5 | **1.1** | 0.25j |

## 27. Hardcoded colors Cocoon (~400 occurrences, P1 — contrainte projet)
**But visé** : remplacer `bg-white`, `bg-black`, `text-white`, `bg-[#...]`, `border-[#...]` par tokens sémantiques `bg-background`, `text-foreground`, `border-border`, etc. Concentré sur `CocoonAIChat` (67), `CocoonNodePanel` (63), `Cocoon.tsx` (54), `ContentArchitectPreview` (50), `FeaturesCocoon` (49), `ImageStylePicker` (48), `ContentArchitectStructurePanel` (38). Prérequis : dark mode fonctionnel + charte violet/or/noir/blanc respectée.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 8 | **1.7** | 2j |

## 28. Retirer les emojis Cocoon (P1 — contrainte projet)
**But visé** : `CocoonAIChat.tsx` (67), `CocoonNodePanel.tsx` (63), et 8+ autres. Remplacer par icônes `lucide-react` neutres cohérentes avec la charte.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 7 | **1.5** | 1j |

## 29. Réduire les `: any` (top offenders Cocoon)
**But visé** : 24 dans `CocoonAIChat`, 23 dans `CocoonContentArchitectModal`, 19 dans `Cocoon.tsx`. Typer les payloads chat (SSE events, tool calls) et les drafts architect (structure H1-H3, tasks, JSON-LD).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 2 | 0 | 6 | **1.7** | 1.5j |

## 30. Audit qualité UX 3D — Profiler + FPS sur >100 nodes
**But visé** : `CocoonForceGraph3D` utilise `@react-three/fiber` + `three.js`. Sur des sites >100 pages, risque FPS < 30. Mesurer avec React Profiler + Chrome DevTools Performance, ajouter `useMemo` / `<Instances>` / LOD si besoin.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 7 | 0 | 0 | 4 | **2.3** | 1j (audit) + 1-3j fix conditionnel |

## Synthèse Vague 2 · Cocoon

| Priorité | Items | Effort | Gain global moyen |
|---|---|---|---|
| **P0-Cocoon** | #25 (split composants monstres) | **5j** | **3.7 / 10** |
| **P1-Cocoon** | #27 (colors) · #28 (emojis) · #30 (FPS 3D) | **4j** | **1.8 / 10** |
| **P2-Cocoon** | #26 (shim) · #29 (any) | **1.75j** | **1.4 / 10** |

**Verdict global Cocoon** : **backend excellent (LLM maîtrisé, 11 functions modulaires, 3 modes visualisation uniques au monde)** — **le problème est 100% frontend**. Cocoon concentre à lui seul ~40% de la dette design system Crawlers (hardcoded colors + emojis) et 5 composants dépassent 1 000 lignes. C'est le chantier front prioritaire du projet.

**Baseline à re-mesurer dans 30j** :
- Lignes `CocoonAIChat.tsx` (baseline : **2 143**)
- Lignes cumulées top 5 composants Cocoon (baseline : **~6 933**)
- Hardcoded colors Cocoon (baseline : **~400**)
- Emojis composants Cocoon (baseline : **10+ fichiers**)
- FPS `CocoonForceGraph3D` sur 100 nodes (baseline : **à mesurer**)

---

# Vague 2 · render-page + SSR SEO

Audit `supabase/functions/render-page/index.ts` (942 l., 4 types de routes : static / blog / landing / guide), `bot-prerender-check` (81 l.), `prerender_cache` (10 col.).

## 31. `PUBLIC_ROUTES` hardcodé (43 entrées) → migrer en DB
**But visé** : chaque nouvelle landing SEO nécessite un **redeploy edge function**. Migrer vers `site_taxonomy` ou une table `seo_static_routes(route, title, description, updated_at)` avec RLS read `to anon`. Bénéfice : ajout de routes SEO sans deploy, cohérence avec `sitemap.xml`, admin UI de gestion.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 8 | **2.3** | 1.5j |

## 32. 3 blocs cache lookup + upsert dupliqués — factoriser
**But visé** : les patterns `select prerender_cache … eq route … gt expires_at` puis `upsert prerender_cache` sont copiés 3 fois (blog, guide, static — landing n'a MÊME PAS de cache lookup en lecture, bug latent). Factoriser en `withPrerenderCache(route, ttlMs, generator)`. Inclure landing dans le cache lookup.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 0 | 1 | 8 | **3.1** | 1j |

## 33. `content_hash = ""` sur landing + guide upserts
**But visé** : le champ `content_hash` sert à détecter les régénérations sans changement (économie de re-crawl bots). Blog le calcule (SHA-256), landing et guide écrivent `""`. Corriger : calculer le hash sur les 3 chemins, et court-circuiter le upsert si `hash inchangé && expires_at prolongeable`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 4 | 0 | 2 | 5 | **2.7** | 0.5j |

## 34. Pas d'ETag / Last-Modified sur les réponses HTML
**But visé** : les bots (GPTBot, Googlebot, ClaudeBot) re-téléchargent inutilement les pages inchangées. Ajouter `ETag: "<content_hash>"` + `Last-Modified: <rendered_at>` + gérer `If-None-Match` / `If-Modified-Since` → renvoyer **304 Not Modified**. Économie bande passante + budget crawl.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 7 | 0 | 4 | 4 | **4.4** | 1j |

## 35. TTL cache fixe 24h sans invalidation sur update
**But visé** : quand un article blog est mis à jour, le cache prerender reste servi jusqu'à 24h. Aucun trigger `on update blog_articles / seo_page_drafts → delete from prerender_cache where route = …`. Ajouter un trigger DB pour invalidation immédiate.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 0 | 0 | 6 | **1.8** | 0.5j |

## 36. 404 rendus en JSON — soft-404 risk Google
**But visé** : les routes inconnues répondent `{"error": "Route not found"}` avec `Content-Type: application/json` et status 404. Googlebot peut interpréter cela comme un **soft-404** au lieu d'un vrai 404. Renvoyer un HTML minimal 404 avec `<title>404</title>` et `<meta name="robots" content="noindex">`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 2 | 0 | 3 | **1.1** | 0.25j |

## 37. `markdownToHtml` maison — pas d'échappement dans les blocs contenu
**But visé** : le convertisseur maison échappe les `<td>` / titres mais **pas** le contenu des paragraphes (`<p>${trimmed}</p>` avec `trimmed` non-escapé). Si un article contient `<script>` dans son markdown source, il est injecté brut. Actuellement mitigé (blog_articles admin-only), mais si `seo_page_drafts` accepte du user-generated content un jour → **XSS SSR**. Remplacer par `marked` + `DOMPurify` (comme `dictadevi-actions`).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 7 | 0 | 5 | **3.2** | 0.5j |

## 38. `isBot` détecté puis inutilisé (log-only)
**But visé** : `BOT_UA_RE` teste 30+ user-agents mais ne branche rien — tous les visiteurs reçoivent le HTML rendu (correct pour SSR universel). Alors : soit **retirer la détection** (dead code + log noise), soit **l'utiliser pour analytics** (upsert `bot_hits` avec route + timestamp → alimente le dashboard GEO bot mix).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 4 | **1.1** | 0.5j (option analytics) |

## 39. Aucun test unitaire sur les 4 générateurs HTML
**But visé** : `generateStaticHTML` / `generateBlogArticleHTML` / landing / guide contiennent la logique SEO critique (JSON-LD, canonical, hreflang, breadcrumb). Un regexp mal placé casse **toute la SEO du site sans que ça se voie**. Ajouter tests snapshot + assertions (`<title>` non vide, `<link rel=canonical>` présent, JSON-LD parsable, breadcrumb valid).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 8 | **2.3** | 1j |

## Synthèse Vague 2 · render-page

| Priorité | Items | Effort | Gain global moyen |
|---|---|---|---|
| **P0-render** | #34 (ETag/304) · #37 (XSS markdown) | **1.5j** | **3.8 / 10** |
| **P1-render** | #31 (routes en DB) · #32 (factoriser cache) · #33 (content_hash) · #39 (tests) | **4j** | **2.6 / 10** |
| **P2-render** | #35 (TTL invalidation) · #36 (404 HTML) · #38 (isBot) | **1.25j** | **1.3 / 10** |

**Verdict global render-page** : function **fonctionnelle et bien pensée SEO** (JSON-LD complets, hreflang, breadcrumb, FAQ extraction, sections informationnelles neutres avec liens autoritaires), mais dette architecturale : **routes hardcodées** (bloque scaling contenu), **cache sans invalidation** (contenu périmé 24h), **absence ETag** (coût bande passante bots élevé), et **1 risque XSS latent** si `seo_page_drafts` s'ouvre au UGC. Les 2 P0 (ETag + XSS) sont livrables en 1.5j et débloquent budget crawl + sécurité.

**Baseline à re-mesurer dans 30j** :
- Nombre de routes hardcodées (baseline : **43**)
- Cache hit ratio `prerender_cache` (baseline : à mesurer via headers `X-Prerender`)
- Coût bande passante bots (baseline : logs edge — actuellement 0 réponses 304)
- Taux XSS potentiel sur `seo_page_drafts.content` (baseline : **1 chemin non-échappé**)

---

# Vague 2 · Feature 5 — audit-expert-seo (+ expert-audit)

Brief : [`knowledge/audits/expert-seo/brief-2026-07-08.md`](../../expert-seo/brief-2026-07-08.md)

Périmètre audité : `audit-expert-seo` (2 338 l.), `expert-audit` (2 987 l., legacy), `audit-compare` (1 062 l.), `measure-audit-impact` (486 l.), `snapshot-audit-impact` (402 l.), `save-audit` (172 l.), front `ExpertAudit/*` (~40 cards, `ExpertAuditDashboard` 1 671 l.).

## 40. Duplication massive `audit-expert-seo` ↔ `expert-audit` (P0)
**But visé** : les deux functions partagent `normalizeUrl`, `extractDomain`, `analyzeHtml`/`analyzeHtmlWithDOM`, `checkRobotsTxt`, `checkSitemap`, `tryBrowserless`, `smartFetch`, `checkLlmsTxt` — **~1 500 lignes de code dupliqué**. Toute correction (ex: parser JSON-LD) doit être faite 2× ou drift silencieux. Statuer : `expert-audit` = legacy à retirer, ou fusion en `audit-expert-seo` + wrapper de compat ? Extraire d'abord tous les utilitaires partagés dans `_shared/htmlAnalysis.ts` + `_shared/sitemapRobots.ts`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 3 | 4 | **10** | **4.6** | 4j |

## 41. `audit-compare` : 3 fetch OpenRouter directs hors gateway (P0, déjà flaggé Vague 1)
**But visé** : lignes 343, 736, 768 — bypass `aiGatewayCall`. Aucun tracking `ai_gateway_usage` → **coûts audit-compare invisibles**, pas de fallback, pas de kill switch. Réécrire les 3 appels via `aiGatewayFetch` avec `edge_function='audit-compare'`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 4 | **9** | 6 | **4.4** | 1j |

## 42. Cache `audit_cache` non utilisé par `audit-expert-seo` ni `expert-audit`
**But visé** : la table `audit_cache` (6 colonnes) existe mais aucune des deux functions n'y lit ni n'y écrit (grep vide). Chaque audit relance PageSpeed + Browserless + DataForSEO + LLM = **5-8¢ à chaque appel**, même sur URL déjà auditée dans les 10 minutes. Brancher cache 30 min sur `normalize(url) + user_plan` → économie estimée x2-x5 sur re-clics.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 6 | 0 | **8** | 5 | **4.4** | 1.5j |

## 43. `ExpertAuditDashboard.tsx` (1 671 l.) monolithique + 17 `console.log`
**But visé** : le dashboard rend 20+ cards, fetch data, gère loading/error/email gate — tout dans 1 fichier. Split en `<ExpertAuditDataProvider>` (fetch + normalisation) + `<ExpertAuditCards>` (rendu grille) + `<ExpertAuditGating>` (email gate). Retirer les 17 `console.log` (top offender front avec `scriptGenerator.ts`).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 1 | 0 | 8 | **2.9** | 3j |

## 44. `WorkflowCarousel.tsx` (675 l.) — dette framer-motion + runtime error
**But visé** : le composant provoque un runtime error récurrent (`Failed to fetch dynamically imported module: framer-motion`) visible dans les logs preview. Auditer les imports dynamiques + `TestimonialsCarousel` (même erreur). Passer en import statique ou lazy safe (`React.lazy` + `Suspense` fallback).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 4 | 0 | 0 | 6 | **2.3** | 0.5j |

## 45. Cards trop grosses (5 fichiers > 500 l.)
**But visé** : `KeywordPositioningCard` 819, `StrategicInsights` 652, `InlineAuthForm` 579, `HallucinationCorrectionModal` 517, `MaillageIPRCard` 505. Une card = un fait diagnostic + une action — au-delà de 300 l. il y a mélange data/rendu/interaction. Split systématique en hook `useXxxData` + composant présentation.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 7 | **2.3** | 3j |

## Synthèse Vague 2 · expert-seo

| Priorité | Items | Effort | Gain global moyen |
|---|---|---|---|
| **P0-expert** | #40 (dedup 2 functions) · #41 (audit-compare LLM gateway) · #42 (audit_cache) | **6.5j** | **4.5 / 10** |
| **P1-expert** | #43 (split dashboard) · #45 (split 5 cards) | **6j** | **2.6 / 10** |
| **P2-expert** | #44 (framer-motion lazy fix) | **0.5j** | **2.3 / 10** |

**Verdict global expert-seo** : porte d'entrée conversion critique, **audit produit riche** (20+ cards, GEO+SEO+GMB+hallucinations unifiés = différenciateur réel vs Ahrefs/Semrush), mais **dette technique lourde** : ~1 500 l. dupliquées entre 2 functions, cache inutilisé (coût LLM 2-5× ce qu'il pourrait être), dashboard 1 671 l. monolithique. P0 = 6.5j pour diviser coût LLM par ~3 et retirer la duplication silencieuse.

---

# Vague 2 · Feature 6 — audit-matrice (+ parse-matrix-* + MatricePrompt)

Brief : [`knowledge/audits/matrix/brief-2026-07-08.md`](../../matrix/brief-2026-07-08.md)

Périmètre audité : `audit-matrice` (499 l.), `parse-doc-matrix` (368 l.), `parse-matrix-hybrid` (384 l.), `parse-matrix-geo` (734 l.), `MatricePrompt.tsx` (1 639 l. — **plus gros fichier front du projet**), `Matrice/*` (14 composants).

## 46. Redondance schéma : 5 tables `matrix_*` / `audit_matrix_*` pour 2 modèles data (P0)
**But visé** : la DB porte simultanément :
- `audit_matrix_sessions` + `audit_matrix_results` (scoring **par critère**, colonnes `criterion_id`, `parsed_score`, `crawlers_score`, `source_function`)
- `matrix_audit_sessions` + `matrix_audit_results` (scoring **par prompt**, colonnes `prompt_item_id`, `axe`, `poids`, `csv_weighted_score`, `verdict`)
- `matrix_audits` (métadonnées site/label/status — 3e forme)

= **5 tables** pour ce qui devrait être 2 (sessions + results) avec discriminant `mode: 'criterion' | 'prompt'`. Impact : requêtes front doivent joindre 2 systèmes, RLS × 5, migrations divergentes. Statuer legacy (probablement `matrix_audits` + `matrix_audit_*` = ancien, `audit_matrix_*` = nouveau) et proposer plan de migration.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 3 | 0 | **10** | **3.9** | 5j (migration) |

## 47. 3 parsers `parse-matrix-*` très proches — factoriser (P1)
**But visé** : `parse-doc-matrix` (368 l., DOCX), `parse-matrix-hybrid` (384 l., DOCX+CSV+prompt), `parse-matrix-geo` (734 l., matrice GEO spécialisée). Les 3 partagent : appel LLM structured output, normalisation criteria, insert `audit_matrix_*`. Extraire `_shared/matrixParser.ts` (schema Zod + LLM call + normalize) et laisser chaque function ne porter que sa spécialisation (extraction DOCX vs CSV vs GEO scoring).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 1 | 3 | 8 | **2.9** | 3j |

## 48. `parse-matrix-geo` : dual gateway OpenRouter/Lovable incohérent (P1)
**But visé** : lignes 286-448 — la function bascule entre `aiGatewayFetch` (l. 214, 345) et `fetch` direct sur `openrouter.ai/api/v1` (l. 286-319) selon `useOpenRouter`. Résultat : **certains appels tracés dans `ai_gateway_usage`, d'autres non**, kill switch admin partiellement respecté. Router **tout** via `aiGatewayFetch` (le gateway supporte déjà OpenRouter en fallback).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 2 | 6 | 5 | **3.0** | 0.75j |

## 49. `MatricePrompt.tsx` 1 639 l. + 31 `: any` (top offender projet) (P1)
**But visé** : plus gros fichier front, plus mauvais typage projet (31 `any` sur payloads LLM). Split minimum en 4 : `<MatricePromptWizard>` (steps), `<MatricePromptEditor>` (édition prompt + preview), `<MatricePromptRunner>` (exécution + progress) + hook `useMatriceSession`. Typer les payloads LLM avec les Zod schemas déjà utilisés côté edge (`parse-matrix-*`).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 2 | 0 | **9** | **3.5** | 4j |

## 50. `ImportStepper.tsx` (720 l.) + 11 `console.log`
**But visé** : le stepper d'import DOCX/CSV mélange upload, preview canvas, détection type, orchestration. Split en 3 étapes composants (`<StepUpload>`, `<StepPreview>`, `<StepConfirm>`) + retrait des `console.log`. Bonus : externaliser la logique `MatriceTypeDetector` (55 l.) et `columnCleaner`/`typeDetector` (déjà dans `utils/matrice/*`) qui sont bien isolés mais peu réutilisés.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 1 | 1 | 0 | 6 | **2.2** | 2j |

## 51. Table `matrix_errors` remplie mais aucun dashboard admin
**But visé** : `matrix_errors` (15 colonnes, 3 policies) accumule les erreurs de parsing sans surface admin pour les traiter. Résultat : erreurs récurrentes silencieuses, pas de boucle d'amélioration parsers. Ajouter un onglet AdminDashboard "Erreurs matrice" (top 20 par `error_type` + `count(*)` + exemple payload).

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 2 | 5 | **1.7** | 1j |

## Synthèse Vague 2 · matrix

| Priorité | Items | Effort | Gain global moyen |
|---|---|---|---|
| **P0-matrix** | #46 (dedup 5 tables) | **5j** | **3.9 / 10** |
| **P1-matrix** | #47 (dedup 3 parsers) · #48 (gateway unifié) · #49 (split MatricePrompt + typage) | **7.75j** | **3.1 / 10** |
| **P2-matrix** | #50 (split ImportStepper) · #51 (dashboard erreurs) | **3j** | **2.0 / 10** |

**Verdict global matrix** : **différenciateur unique** sur le marché (N×M libre + cube 3D pivotable, vs Content Gap 2D fermé) mais **schéma DB explosé en 5 tables redondantes** (dette lourde à réduire avant d'ajouter des features) et **top offender projet en typage** (31 `any` sur `MatricePrompt`). P0 seul (dedup tables) débloque migrations futures et RLS cohérent.

**Baseline à re-mesurer dans 30j** :
- Nombre de tables `matrix_*` + `audit_matrix_*` (baseline : **5 tables**)
- Nombre de parsers `parse-matrix-*` (baseline : **3 functions, 1 486 l. cumulées**)
- `: any` dans `MatricePrompt.tsx` (baseline : **31**)
- Appels LLM `parse-matrix-geo` hors gateway (baseline : **1 chemin `useOpenRouter=true`**)
- Erreurs `matrix_errors` traitées (baseline : dashboard inexistant)

---

# Vague 3 — Audit `crawl multi-pages` (2026-07-08)

Brief : `knowledge/audits/crawl-multi-pages/brief-2026-07-08.md`
Périmètre : `crawl-site` (690 l.) + `process-crawl-queue` (309 l.) + `cron-crawl-scheduler` (264 l.) + `strategic-crawl` (375 l.) + `_shared/crawlQueue/*` (5 modules, 1 155 l.) + front `SiteCrawl.tsx` (1 327 l.) + `useCrawlEngine.ts` (897 l.) + `useSiteCrawl.ts` (735 l.) + tables `site_crawls` / `crawl_pages` / `crawl_jobs` / `site_crawl_schedule`

## Signaux mesurés (choc)

**Volumétrie réelle** :
- `crawl_pages` : **3 765 lignes** (16 MB)
- `site_crawls` : **80 lignes** (416 kB) — 4 completed, 1 crawling, 1 stopped sur 30j
- `crawl_jobs` : **80 lignes** (584 kB)

**Trafic DB cumulé sur les tables crawl** (pg_stat_statements) :
| Requête | Calls | Total ms | Mean ms |
|---|---|---|---|
| UPDATE `crawl_jobs.processed_count` | **16 348 136** | 4 877 980 | 0.30 |
| UPDATE `site_crawls.crawled_pages` | **16 348 151** | 2 954 920 | 0.18 |
| INSERT `crawl_pages` (ON CONFLICT DO NOTHING) | 16 347 887 | 2 912 927 | 0.18 |
| SELECT `crawl_jobs` WHERE status IN(…) | **16 481 646** | 2 064 665 | 0.13 |
| SELECT `crawl_pages.id` WHERE crawl_id=… | **32 693 802** | 1 795 659 | 0.05 |
| SELECT `site_crawls.status` WHERE id=… | 16 347 095 | 1 127 977 | 0.07 |
| SELECT `crawl_jobs.id` WHERE status IN(…) | 16 344 301 | 1 020 151 | 0.06 |

**Ratio dément** : ~**4 300 opérations DB par page effectivement crawlée**. Cumul temps DB sur les tables crawl seules : **~4 heures 40 min**. C'est le tableau de bord Vague 1 (32M updates) qui s'expliquait mais dont personne n'avait tracé la cause.

---

## Findings

### #52 — [P0 · 0.5j] Worker fait 2 UPDATE PAR PAGE crawlée (16.3M writes)
- **Où** : `process-crawl-queue/index.ts` lignes 73-74, 142-143, **252-253** (le vrai coupable : boucle worker)
- **Ce qu'il fait** :
  ```ts
  await supabase.from('crawl_jobs').update({ processed_count: newProcessedCount }).eq('id', job.id);
  await supabase.from('site_crawls').update({ crawled_pages: newProcessedCount }).eq('id', job.crawl_id);
  ```
  → **2 UPDATE réseau par page**, à chaque itération de la boucle interne
- **Impact mesuré** : 16.3M × 2 = **32.6M UPDATE** cumulés, ~130 min DB
- **Fix immédiat** : batcher les mises à jour toutes les **N=5 pages** OU passer par **1 trigger DB** :
  ```sql
  create trigger tg_bump_crawl_counters after insert on crawl_pages
  for each statement execute function bump_crawl_counters();
  -- fonction: update site_crawls set crawled_pages=(select count(*) from crawl_pages where crawl_id=NEW.crawl_id) where id=NEW.crawl_id;
  ```
  Bénéfice : 1 requête d'insert crawl_pages → 1 déclenchement trigger, plus aucun UPDATE explicite côté worker.
- **Gain estimé** : -95% writes (32.6M → ~1.6M) + latence worker divisée par ~2

### #53 — [P0 · 0.25j] `useSiteCrawl.ts` (735 l.) = code MORT — copy/paste doublon jamais importé
- **Où** : `src/hooks/useSiteCrawl.ts`
- **Preuve** : `rg -rn "useSiteCrawl" src/ | grep -v "hooks/useSiteCrawl.ts"` → **0 résultat**
- **Vrai hook utilisé** : `useCrawlEngine` (897 l.), importé uniquement dans `SiteCrawl.tsx`
- **Doublon complet** : les 2 hooks font le même polling `site_crawls`, la même `loadPages`, la même compare — c'est un fork oublié
- **Fix** : `rm src/hooks/useSiteCrawl.ts`
- **Bénéfice** : -735 lignes de dette, plus de confusion pour futurs devs

### #54 — [P0 · 0.5j] Polling front 5s `SELECT *` sur `site_crawls` — inclut `ai_summary`+`ai_recommendations` (potentiellement lourds)
- **Où** : `useCrawlEngine.ts:196-295` (`setInterval(async () => { supabase.from('site_crawls').select('*').eq('id', crawlId).single(); }, 5000)`)
- **Volume observé** : **16.3M SELECT** sur site_crawls (`SELECT status FROM site_crawls WHERE id=…`) — c'est le polling multiplié par la durée des jobs
- **Problèmes cumulés** :
  1. `select('*')` alors que la boucle n'utilise que `status`, `crawled_pages`, `total_pages`, `error_message` — les colonnes `ai_summary` (text long) et `ai_recommendations` (jsonb) sont tirées à chaque tick
  2. Aucun realtime subscription — polling toutes les 5s pour un état qui pourrait être poussé via `postgres_changes`
  3. Le polling ne s'arrête que sur `completed` ou `error` — si l'onglet reste ouvert et le crawl foire silencieusement, ça poll pour l'éternité (watchdog 120s existe mais uniquement pour `mapping`/`queued`)
- **Fix minimal** :
  - `.select('status, crawled_pages, total_pages, error_message, avg_page_score, ai_summary, ai_recommendations')` + fetch complet uniquement quand `status === 'completed'`
  - Passer à **Realtime subscription** sur `site_crawls WHERE id=X` (élimine 99% des SELECTs)
- **Gain estimé** : -90% SELECTs (16.3M → 1.6M) + payload par tick divisée par ~10

### #55 — [P1 · 0.25j] `ActiveCrawlBanner` = 3e polling parallèle (5s + idleCheck 30s)
- **Où** : `src/components/Profile/ActiveCrawlBanner.tsx:147, 164-172`
- **Ce qu'il fait** : monté globalement (Profile page), poll `site_crawls WHERE user_id=X AND status IN ('queued','mapping','crawling','analyzing')` toutes les 5s si un crawl actif détecté, sinon idleCheck 30s
- **Cumul** : si l'utilisateur a la page `/site-crawl` **ET** la sidebar Profile ouverte → **useCrawlEngine (5s) + ActiveCrawlBanner (5s) + finalizer(watchdog)** = 3 pollings simultanés sur les mêmes tables
- **Fix** : remplacer par une **Realtime subscription unique** partagée via un contexte `<CrawlContext>` — un seul `postgres_changes` listener pour tout l'app
- **Gain estimé** : -66% SELECTs quand plusieurs vues ouvertes

### #56 — [P1 · 1j] `crawl-site/index.ts` (690 l.) monolithe + 32 `console.log` + 9 `: any`
- **Où** : `supabase/functions/crawl-site/index.ts`
- **Contenu** : orchestrateur `detect|analyze` — mélange fetch sitemap, appels Spider.map, cmsContentScanner, découverte hybride, réutilisation pages <12h, création job, dispatch worker
- **À découper** en 4 modules `_shared/crawlSite/` :
  - `discovery.ts` (sitemap + Spider.map + cmsContentScanner)
  - `reuse.ts` (réutilisation pages < 12h)
  - `jobCreator.ts` (création `crawl_jobs` + estimation crédits)
  - `dispatcher.ts` (appel `process-crawl-queue`)
- **Nettoyage** : 32 `console.log` → passer par un logger structuré (déjà utilisé dans finalizer/scraperStrategy) et retirer les debug une fois stables
- **Gain** : cohérence avec `_shared/crawlQueue/*` déjà modulaire (Phase 5 déjà faite pour le worker, jamais faite pour l'orchestrateur)

### #57 — [P1 · 1j] `useCrawlEngine.ts` (897 l.) monolithe + 16 `: any`
- **Où** : `src/hooks/useCrawlEngine.ts`
- **Responsabilités mélangées** : polling status + loadPages + compare 2 crawls + createReport + delete + sitemap tree fetch + serp indexed pages + watchdog
- **À découper** :
  - `useCrawlPolling(crawlId)` (poll Realtime)
  - `useCrawlPages(crawlId)` (loadPages + filtres)
  - `useCrawlCompare(a, b)` (delta)
  - `useCrawlActions(crawlId)` (delete, createReport, stop)
  - `useCrawlDiscovery(url)` (sitemap + serp indexed)
- **Bénéfice** : composants qui n'ont pas besoin du compare ne payent plus son coût

### #58 — [P2 · 1j] `SiteCrawl.tsx` (1 327 l.) — 2e plus gros front du projet
- **Où** : `src/pages/SiteCrawl.tsx`
- **Après** #57 : orchestre les sous-hooks + rendu conditionnel (detect / analyze / results / compare / export sitemap)
- **À splitter** en `<CrawlDetectPanel>`, `<CrawlAnalyzePanel>`, `<CrawlResults>`, `<CrawlComparePanel>`, `<CrawlExportBar>` — chacun ~200 l.

### #59 — [P2 · 0.25j] 84 `console.log` cumulés dans les fonctions crawl
- **Répartition** : `crawl-site` 32 + `process-crawl-queue` 17 + `scraperStrategy` 15 + `finalizer` 12 + `strategic-crawl` 8
- **Fix** : passer les logs de debug (préfixe `[Worker]`) en flag conditionnel `if (Deno.env.get('CRAWL_DEBUG'))` ou logger niveau (info/warn/error) — garder les erreurs, retirer les traces de rendu

### #60 — [P2 · 0.25j] `strategic-crawl` mal documenté comme feature « crawl » alors que c'est une micro-function `strategic-orchestrator`
- **Où** : `src/data/backendDocumentation.ts:341`, `src/components/admin/architectureKnowledge.ts:89`, `src/components/admin/ArchitectureMap.tsx:15`
- **Réalité** : `strategic-crawl` = extraction métadonnées + signaux E-E-A-T + CTA/SEO, appelée uniquement par `strategic-orchestrator:154` (audit stratégique 1-URL). PAS un doublon de `crawl-site`.
- **Fix doc** : sortir `strategic-crawl` de la brique CRAWL dans `ArchitectureMap.tsx` et le rattacher à STRATEGIC. Idem dans `backendDocumentation` et `architectureKnowledge`.
- **Bénéfice** : évite qu'un futur audit tente de le fusionner à `crawl-site` par erreur

---

## Résumé Vague 3 partie 1 · crawl multi-pages
- **P0** = **1.25j** (#52 batch/trigger + #53 rm dead code + #54 select+realtime)
- **P1** = **2.25j** (#55 realtime unique + #56 modulariser crawl-site + #57 splitter useCrawlEngine)
- **P2** = **1.5j** (#58 splitter SiteCrawl + #59 logs + #60 doc)
- **Total** : **5j**

**Verdict** : l'architecture cascade renderPage → Spider → Firecrawl → Browserless est **excellente et différenciante** (aucun concurrent grand public ne fait ça), la modularisation `_shared/crawlQueue/*` (Phase 5) est propre. Mais **le worker écrit 2× par page + le front poll toutes les 5s en SELECT* + un hook doublon mort de 735 lignes traîne** → c'est ce qui produit les 32M+ opérations DB observées. Les 3 P0 ci-dessus (**1.25j**) éliminent ~95% du trafic DB inutile. C'est le meilleur ratio ROI/effort de toute la Vague 3.

**Baseline à re-mesurer dans 30j** :
- `pg_stat_statements` UPDATE `crawl_jobs.processed_count` (baseline : **16 348 136 calls**)
- `pg_stat_statements` SELECT `site_crawls.status` WHERE id=… (baseline : **16 347 095 calls**)
- Lignes `useSiteCrawl.ts` (baseline : **735, cible : 0**)
- Lignes `useCrawlEngine.ts` (baseline : **897, cible : ≤400 après split**)
- Lignes `SiteCrawl.tsx` (baseline : **1 327, cible : ≤500**)
- `console.log` cumulés fonctions crawl (baseline : **84**)
