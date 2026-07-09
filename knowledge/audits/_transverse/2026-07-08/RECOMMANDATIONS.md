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

---

# VAGUE 3 · Partie 2 — SERP Benchmark multi-providers

## Contexte
Audit de `serp-benchmark` (446 l.) et de son écosystème SERP (`serpapi-actions` 217 l., `fetch-serp-kpis` 416 l., `analyze-serp-intents` 555 l., `refresh-serp-all` 516 l.). Baseline SQL : **11 benchmarks / 9 requêtes distinctes / 0 sur 30 derniers jours**, `serpapi_cache` **0 lignes**.

## #61 — [P0 · 0.25j] `serp-benchmark` n'utilise PAS `serpapi_cache` → chaque call = 3 fetch providers payants
- **Où** : `supabase/functions/serp-benchmark/index.ts:289-299`
- **Constat** : `fetchDataForSEO`/`fetchSerpApi`/`fetchSerper` appelés en `Promise.all` sans consultation du cache. Le cache `serpapi_cache` (16 col, 4 pol, TTL 24h) existe mais n'est câblé que sur `serpapi-actions` (qui n'est appelée que par `GmbKeywordsTab`).
- **Impact coût** : à la re-frappe d'une même query (débogage, démo, lead magnet anonyme), on repaye **3 appels externes** systématiquement.
- **Fix** : lookup `serpapi_cache` (clé = `sha256(query|location|language|country|providers.sort)`) **avant** `Promise.all`, TTL 24h. `user_id` = utiliser un `system_user_id` déterministe pour anonymes ou clé cache dédiée `provider_cache` sans `user_id`.
- **Gain** : -60 à -90% coût SERP externes selon taux de répétition.

## #62 — [P0 · 0.25j] Aucun `trackPaidApiCall` dans `serp-benchmark` → coûts SERP invisibles
- **Où** : `supabase/functions/serp-benchmark/index.ts` — aucun import de `../_shared/tokenTracker.ts`
- **Constat** : `fetch-serp-kpis`, `analyze-serp-intents`, `refresh-serp-all` tracent DataForSEO/SerpApi/Serper via `trackPaidApiCall`. **`serp-benchmark` ne trace rien**, alors qu'il fait 3 appels payants en //.
- **Impact** : la table `paid_api_calls` sous-estime le coût réel SerpApi/DataForSEO/Serper (aucune ligne provenant de `serp-benchmark`), le dashboard admin coût est faussé.
- **Fix** : ajouter `await trackPaidApiCall('serp-benchmark', 'dataforseo', 'serp/organic/live')` etc. dans chaque `fetchXxx` **après** un succès HTTP (avant retour).

## #63 — [P0 · 0.25j] Anonyme sans rate-limit sur `action='benchmark'` (lead magnet) → drain risque
- **Où** : `supabase/functions/serp-benchmark/index.ts:258-274`
- **Constat** : `authHeader` optionnel, `benchmark` autorisé sans user. Aucun `rate_limit_tokens` check, aucun IP throttling. Un bot peut déclencher **N × 3 appels providers payants** gratuitement.
- **Fix** : pour user null → check `rate_limit_tokens` par IP (fingerprint), plafond 3/jour/IP + réduire à 2 providers (SerpApi seul, le moins cher) en mode anonyme.

## #64 — [P1 · 0.25j] `Promise.all` fragile → 1 provider en erreur = tout casse
- **Où** : `supabase/functions/serp-benchmark/index.ts:299`
- **Constat** : les fetchers **catch déjà** leurs erreurs et retournent `{ error: '...' }`, donc `Promise.all` ne rejette pas en pratique. Mais toute regression future qui laisserait un `throw` non catchée bloquerait toute la comparaison.
- **Fix défensif** : remplacer par `Promise.allSettled` + normalisation → aligné avec `analyze-serp-intents:297` qui utilise déjà `allSettled`.

## #65 — [P1 · 0.5j] `serpapi-actions` (217 l.) sous-utilisée (1 seul appelant `GmbKeywordsTab`) → à fusionner dans `serp-benchmark`
- **Où** : `supabase/functions/serpapi-actions/index.ts` — appelé uniquement par `src/components/Profile/GmbKeywordsTab.tsx:123` et référencé (non-code) par `update-claims-audit`
- **Constat** : la function router (`search`, `search-news`, `search-images`, `search-local`) implémente elle-même cache + tracking, mais duplique la logique SerpApi de `serp-benchmark`. Une seule feature UI la consomme réellement.
- **Fix** : ajouter action `serpapi_raw` dans `serp-benchmark` (avec cache #61 + tracking #62 mutualisés) puis retirer `serpapi-actions`. `GmbKeywordsTab` bascule sur `serp-benchmark { action: 'serpapi_raw', tbm: 'lcl' }`.
- **Bénéfice** : -217 lignes edge, un seul chemin SERP, un seul cache, un seul tracker.

## #66 — [P1 · 0.5j] `SerpBenchmark.tsx` (498 l.) — polling ou re-fetch non contrôlé
- **Où** : `src/components/Console/SerpBenchmark.tsx:105` et `:172` (2 invocations `serp-benchmark`)
- **À vérifier lors du fix** : que la 2e invocation (auto-refresh ou action utilisateur ?) n'est pas déclenchée involontairement lors du render. Si feature effectivement à 0 usage/30j en prod, alors non-critique — mais si activée à demain, chaque re-render pourrait triple-facturer.
- **Fix** : audit des `useEffect` deps + `useCallback` sur les 2 handlers, plus splitter le composant en 3 : `<BenchmarkForm>`, `<BenchmarkResultsTable>`, `<BenchmarkHistoryList>`.

## #67 — [P2 · 0.25j] Périmètre SERP fragmenté : 5 edge functions × 5 responsabilités qui se recoupent
- **Constat** :
  - `serp-benchmark` — multi-provider agrégé + workbench drift
  - `fetch-serp-kpis` — DataForSEO `ranked_keywords` + `serp/organic` (indexation) — appelé par `useSiteCrawl`, `useCrawlEngine`, `useMyTracking`, `ExpertAuditDashboard`, `MyTracking`
  - `analyze-serp-intents` — DataForSEO `serp/advanced` + Serper + LLM intent extraction
  - `refresh-serp-all` — cron batch multi-sites (DataForSEO backlinks/anchors + GA4)
  - `serpapi-actions` — SerpApi raw pass-through
- **Chevauchement** : DataForSEO organique appelé dans **3** functions distinctes, aucun cache partagé.
- **Fix ciblé** : après #61-#65, extraire `_shared/serp/providers.ts` qui exporte `fetchDataForSEO`/`fetchSerpApi`/`fetchSerper` avec cache+tracking intégrés. Les 4 functions restantes deviennent de simples orchestrateurs.
- **Gain long terme** : point d'entrée unique pour changer de provider ou renégocier un contrat.

## #68 — [P2 · 0.25j] `analyze-serp-intents` (555 l.) + `refresh-serp-all` (516 l.) monolithes
- Découpe similaire à #56 : `intentExtractor.ts`, `competitorsCrawler.ts`, `resultsPersister.ts` pour analyze — `batchRunner.ts`, `providerRefresher.ts`, `siteScheduler.ts` pour refresh.
- **À faire uniquement après stabilisation #61-#67** — sinon refactor prématuré.

---

## Résumé Vague 3 partie 2 · serp-benchmark
- **P0** = **0.75j** (#61 cache + #62 tracking + #63 rate-limit anonyme)
- **P1** = **1.25j** (#64 allSettled + #65 fusion serpapi-actions + #66 SerpBenchmark front)
- **P2** = **0.5j** (#67 `_shared/serp/providers.ts` + #68 découpe analyze/refresh)
- **Total** : **2.5j**

**Verdict** : l'idée du **benchmark multi-providers avec pénalité single-hit** est réellement **différenciante** (aucun Semrush/Ahrefs/AccuRanker ne le fait — tous mono-source). Mais l'implémentation actuelle est **une passoire à coûts** :
1. cache existant non branché (`serpapi_cache` 0 lignes)
2. tracking coût manquant (`paid_api_calls` sous-estime)
3. anonyme sans rate-limit (drain lead magnet)
4. code SerpApi dupliqué entre 2 functions

Les 3 P0 (**0.75j**) suffisent à sécuriser l'ouverture publique de la feature. #65 (fusion) réduit la surface de -217 lignes edge à effort modéré.

**Baseline à re-mesurer dans 30j** :
- `serpapi_cache` count (baseline : **0 lignes** ; cible : > 100 hits/mois si feature activée)
- `paid_api_calls` filtrées `edge_function='serp-benchmark'` (baseline : **0**, cible : 100% des benchmark tracés)
- `serp_benchmark_results` count / 30j (baseline : **0** actuels ; à surveiller si feature devient discoverable)
- Lignes `serpapi-actions/index.ts` (baseline : **217**, cible : **0** après #65)
- Lignes `SerpBenchmark.tsx` (baseline : **498**, cible : ≤200 par composant après split)

---

# VAGUE 3 · Partie 3 — Conversion Optimizer

## Contexte
Audit de `analyze-ux-context` (**1 334 lignes**, plus gros monolithe backend audité) + front `ConversionOptimizer.tsx` (848 l.) + `AnnotatedPageView.tsx` (478 l.). Baseline SQL : **10 analyses total, dernière le 2026-05-08, score moyen 74/100 → feature à adoption quasi-nulle depuis 60 jours**. `agent-ux` (307 l., admin `UxAgentDashboard`) confirmé hors scope (feature indépendante Design System pour `cto_code_proposals`).

## #69 — [P0 · 0.5j] 2 appels Browserless séquentiels par analyse → double coût + double timeout
- **Où** : `supabase/functions/analyze-ux-context/index.ts:354` (`captureScreenshotWithAnnotations`) puis `:498` (`findTextPositions`)
- **Constat** : le 1er script Browserless (`captureScreenshotWithAnnotations`) fait `page.goto` + scroll + extraction images + chunkability + screenshot pleine page. Le 2e (`findTextPositions`) **re-navigue vers la MÊME URL** (`page.goto ${JSON.stringify(pageUrl)}`) juste pour extraire les bounding boxes de textes → 2× fetch réseau, 2× `waitUntil: networkidle2`, 2× `setTimeout 3000-4000ms`, 2× `trackPaidApiCall('browserless')`.
- **Impact** : ~30-60s ajoutées par analyse + double crédit Browserless.
- **Fix** : fusionner l'extraction texte-position dans le même script Puppeteer que le screenshot. Le 1er script a déjà la page chargée → ajouter un bloc `page.evaluate((targets) => { /* text positions */ }, ...)` juste avant `page.screenshot()`. Retirer `findTextPositions` sauf pour le mode `annotations-only` (rétro-analyse ancien screenshot).
- **Gain** : **-50% latence, -50% coût Browserless** sur le mode `default` (le mode dominant).

## #70 — [P0 · 0.25j] Timeout Browserless 45 000ms viole la contrainte mémoire (30s cap)
- **Où** : `supabase/functions/analyze-ux-context/index.ts:674` et `:874` — `page.goto(..., { waitUntil: 'networkidle2', timeout: 45000 })`
- **Constat** : mem://tech/browserless/timeout-and-semaphore-fix-fr impose **30 000ms** (fix précédent : 135s→30s + sémaphore 7 slots). Ici 2 endroits à 45 000ms + `networkidle2` (attend 2 requêtes < 500ms) + `setTimeout 4000` + scroll ~4s + `setTimeout 2500` → **worst case > 50s par appel Browserless**, donc >100s pour l'analyse totale (cf. #69).
- **Fix** : `timeout: 30000` + `waitUntil: 'domcontentloaded'` (comme `renderPage`) + réduire `setTimeout 4000→1500` et `setTimeout 2500→1000`. Le scroll progressif reste utile pour lazy-loading.
- **Gain** : conformité + -30% latence.

## #71 — [P0 · 0.5j] Aucun cache d'analyse → chaque re-clic = re-payer LLM + 2× Browserless
- **Où** : `analyze-ux-context/index.ts:501-516` — insert `ux_context_analyses` mais aucune lecture préalable pour détecter une analyse récente sur la même URL/même contenu.
- **Constat** : `ux_context_analyses` a un champ `screenshot_url` unique par appel (`${trackedSiteId}/${Date.now()}.jpg`), aucun cache-hit. Sur une feature à faible adoption (10 analyses/60j) l'impact est faible, mais toute activation marketing (lead magnet, ProAgency onboarding) exploserait le coût.
- **Fix** : avant `captureScreenshotWithAnnotations`, chercher `ux_context_analyses WHERE tracked_site_id=X AND page_url=Y AND created_at > NOW() - 7 days` → si trouvé ET `crawl_pages.updated_at < ux.created_at` (contenu inchangé), retourner l'analyse en cache. Ajouter `force_refresh: boolean` dans le body pour bypass.
- **Gain** : à échelle marketing, jusqu'à -80% coût LLM+Browserless.

## #72 — [P1 · 1j] Monolithe 1 334 lignes — 3 modes dans un seul handler + 42 `console.log` + 20 `: any`
- **Où** : `supabase/functions/analyze-ux-context/index.ts`
- **Structure actuelle** : `Deno.serve` (32-618, **587 l.**) + `captureScreenshotWithAnnotations` (660-860, **200 l.**) + `findTextPositions` (862-1088, **226 l.**) + `SYSTEM_PROMPT` + `buildPrompt` (1172-1334, **162 l.**)
- **Découpe recommandée** en `_shared/uxContext/` :
  - `modes/defaultAnalysis.ts` (mode principal — 587 l. actuelles)
  - `modes/annotationsOnly.ts` (mode réhydratation historique)
  - `modes/manualSuggestions.ts` (mode Premium+ zones dessinées)
  - `browserless/captureAndPositions.ts` (fusion #69)
  - `prompts/systemPrompt.ts` + `prompts/buildPrompt.ts` + `prompts/gaSection.ts` + `prompts/identityGaps.ts`
  - `persistence/insertAnalysis.ts` + `persistence/workbenchInjector.ts`
- **Nettoyage** : 42 `console.log` → logger structuré niveau (debug/info/warn/error), 20 `: any` → typer les payloads AI (`AxisScores`, `Suggestion`, `ImageAnalysis`)
- **Gain** : lisibilité, testabilité par mode, taille bundle réduit pour cold-start Deno.

## #73 — [P1 · 0.25j] `logAIUsageFromResponse` sans `await` → potentiel logging perdu
- **Où** : `analyze-ux-context/index.ts:474` — `logAIUsageFromResponse(getServiceClient(), ...)` (pas de `await`, pas de `.catch()`)
- **Constat** : `trackTokenUsage` juste au-dessus utilise `.catch(() => {})` (fire-and-forget explicite). `logAIUsageFromResponse` n'a ni await ni catch → si la promesse rejette, erreur non capturée qui peut faire tomber la function (Deno unhandled rejection warning). Aussi : Deno peut tuer la function avant que l'insert finisse.
- **Fix** : `logAIUsageFromResponse(...).catch((e) => console.warn('[analyze-ux-context] log failed', e.message))` OU `await logAIUsageFromResponse(...)` si l'insert doit être garanti.

## #74 — [P1 · 0.5j] `ConversionOptimizer.tsx` (848 l.) — 3 handlers `invoke` dupliqués + composant à splitter
- **Où** : `src/pages/ConversionOptimizer.tsx:244-268` (`handleAnalyze`), `:271-304` (`handleRecalculate`), `:306-350` (`hydrateSavedAnalysisAnnotations`)
- **Constat** : 3 appels `supabase.functions.invoke('analyze-ux-context', ...)` avec pattern identique (invoke → check error/success → toast → setState). Zéro abstraction, chaque handler duplique la gestion d'erreur.
- **Fix** :
  - extraire `useAnalyzeUxContext()` hook exposant `{ analyze, recalculate, hydrateAnnotations, isAnalyzing, isRecalculating, isBackfilling }`
  - splitter en `<SiteAndPageSelector>`, `<AnalysisScoreBoard>`, `<SuggestionsList>`, `<AnnotatedScreenshot>`, `<HistoryPanel>`
  - `hydrateSavedAnalysisAnnotations` est aujourd'hui un mécanisme silencieux au click sur un ancien audit → à documenter comme "migration progressive des vieux screenshots"

## #75 — [P2 · 0.25j] `AnnotatedPageView.tsx` (478 l.) et `ManualAnnotationOverlay.tsx` (264 l.) — canvas overlay non memoïsé
- **Où** : `src/components/ConversionOptimizer/AnnotatedPageView.tsx` (478 l.), `ManualAnnotationOverlay.tsx` (264 l.), `CROReportPreviewModal.tsx` (370 l.)
- **À vérifier** : les annotations (jusqu'à 20 bulles + zones dessinées) sont re-rendues à chaque scroll/resize ? `useMemo` sur les positions ? Debounce sur le drawing mode ?
- **Fix** : audit dédié après #69-#71, viser < 300 l./composant.

## #76 — [P2 · 0.5j] Mémoire `mem://tech/conversion-optimizer/comprehensive-v3-fr` manquante malgré référence dans l'index
- **Où** : `mem://index.md` référence `[Conversion Optimizer](mem://tech/conversion-optimizer/comprehensive-v3-fr) — Conversion optimizer UI & GA4 metrics` mais le fichier `knowledge/tech/conversion-optimizer/comprehensive-v3-fr.md` **n'existe pas**.
- **Fix** : créer le fichier avec l'état réel post-audit (8 axes, 3 modes, dépendance Browserless, cache #71 ajouté, contraintes de plan).

---

## Résumé Vague 3 partie 3 · conversion-optimizer
- **P0** = **1.25j** (#69 fusion 2 Browserless + #70 timeout 30s + #71 cache 7 jours)
- **P1** = **1.75j** (#72 découpe monolithe + #73 await log + #74 splitter ConversionOptimizer.tsx)
- **P2** = **0.75j** (#75 audit canvas overlay + #76 créer mémoire manquante)
- **Total** : **3.75j**

**Verdict** : le concept **screenshot pleine page + bulles ancrées aux suggestions IA + intégration GA4 behavioral + voice_dna + auto-enrichissement identité** est **techniquement unique sur le marché** (Hotjar = data brute, Fibr.ai = reco sans ancrage visuel, VWO = A/B lourd). Le rendu final est probablement bluffant. Mais **le moteur double-appelle Browserless pour la même URL** (#69), **dépasse le cap timeout mémoire** (#70) et **n'a aucun cache** (#71) → 3 défauts structurels qui rendent la feature **trop chère pour être ouverte largement**.

**Bonne nouvelle** : à 10 usages/60j, aucun dégât en production actuel. Les 1.25j de P0 doivent être bookés **AVANT** toute campagne d'activation de la feature (ProAgency onboarding, lead magnet public).

**Baseline à re-mesurer dans 30j** :
- `ux_context_analyses` count / 30j (baseline : **~0**, cible : > 100 si feature promue)
- `paid_api_calls` filtrées `edge_function='analyze-ux-context' AND provider='browserless'` — ratio calls/analyses (baseline : **2** ; cible : **1** après #69)
- `ai_gateway_usage.cost_credits` moyen par analyse (baseline à établir dès #71 déployé — cible < 2¢)
- Lignes `analyze-ux-context/index.ts` (baseline : **1 334**, cible : ≤ 400 handler principal après #72)
- Lignes `ConversionOptimizer.tsx` (baseline : **848**, cible : ≤ 300 après split #74)
- `console.log` (baseline : **42**, cible : 0 en mode prod)

---

# Vague 3 · Partie 4 — audit-compare (Audit Comparé)

Brief : `knowledge/audits/audit-compare/brief-2026-07-08.md`
Périmètre : `supabase/functions/audit-compare/index.ts` (1 062 l.) + `src/pages/AuditCompare.tsx` (1 677 l., **plus gros front du projet**) + table `audit_cache`.
Signal audité : 3 appels LLM directs OpenRouter (`google/gemini-3.1-flash-lite` + 2× `google/gemini-3-flash-preview`), jusqu'à 6 appels DataForSEO (backlinks/summary + backlinks/anchors + keywords_for_keywords + serp/organic ×3), 2 PageSpeed, 1 Browserless par URL comparée → **soit ~9 appels payants × 2 sites = 18 hits externes par comparaison**.

## #77 · P0 · 1j — Migrer les 3 appels LLM d'OpenRouter direct vers Lovable AI Gateway
**Fichier** : `supabase/functions/audit-compare/index.ts` l.332-370 (`generateSeedsWithAI`), l.699-756 (`analyzeSite`), l.762-786 (`runCrossComparison`).
**Problème** : `fetch('https://openrouter.ai/api/v1/chat/completions', { headers: { Authorization: 'Bearer ${OPENROUTER_API_KEY}' } })` → **0 tracking dans `ai_gateway_usage`**, marge OpenRouter empilée sur marge Google Gemini (double marge), et viole `mem://tech/ai/llm-task-alignment-fr` qui impose la gateway unifiée. Vague 1 avait déjà flaggé cette function → **rien n'a été fait depuis**.
**Fix** :
```ts
import { aiGatewayFetch } from '../_shared/aiGateway.ts';
const resp = await aiGatewayFetch({
  method: 'POST',
  headers: { 'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [...] })
});
```
Modèle cible : `google/gemini-2.5-flash` (les modèles `gemini-3.1-flash-lite` et `gemini-3-flash-preview` ne sont pas dans le catalogue Lovable — vérifier `ai-models-chat` avant deploy). Retirer la dépendance à `OPENROUTER_API_KEY`.
**Gain** : -30 à -50 % de coût LLM (suppression marge OpenRouter), tracking complet dans `ai_gateway_usage`, conformité contrainte projet.

## #78 · P0 · 0.5j — Étendre le TTL du cache de 2 h à 7 jours
**Fichier** : `supabase/functions/audit-compare/index.ts` l.682 `const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();`
**Problème** : le cache dure **2 h**. Or les données bougent lentement : backlinks DataForSEO refresh mensuel, keywords_for_keywords stable sur 30 j, PageSpeed rarement > ±5 pts en 7 j. Un utilisateur qui compare 2 sites 3× dans la même semaine paie **3× ~18 appels externes**. À 10¢ par comparaison estimés (5¢ DataForSEO + 3¢ LLM + 2¢ browserless), c'est 30¢ vs 10¢.
**Fix** : `expires_at = NOW() + INTERVAL '7 days'`, ajouter param query `?force_refresh=true` déjà présent (l.965 `if (!forceRefresh)`) → OK côté check, il suffit d'étendre le TTL.
**Gain** : -66 % du coût sur usages répétés semaine.

## #79 · P0 · 0.5j — SERP cross-check appelé 3× au lieu d'1×
**Fichier** : `supabase/functions/audit-compare/index.ts` l.404-430 (`fetchKeywordData` → serp/organic dans loop) + l.848-866 (`crossCheckSerpRankings` → 2 autres serp/organic).
**Problème** : `serp/organic/live/regular` est déclenché **une fois par site dans `fetchKeywordData`** (pour retrouver les rankings existants) **puis à nouveau dans `crossCheckSerpRankings`** pour comparer les 2 sites. Ce dernier peut réutiliser les résultats du premier passage.
**Fix** : passer les `serpResults` du premier passage en argument à `crossCheckSerpRankings`, ne relancer que si `serpResults.length === 0` (cas "les 2 sites n'ont pas de mots-clés ranked").
**Gain** : -2 appels DataForSEO par comparaison (économie ~1¢/comparaison, mais surtout -40 % de latence sur la Phase 3).

## #80 · P1 · 1j — Découpe du monolithe 1 062 l.
**Fichier** : `supabase/functions/audit-compare/index.ts` (17 fonctions internes dans un seul fichier).
**Problème** : `extractPageMetadata`, `fetchPageSpeedScores`, `fetchBacklinkProfile`, `generateSeedsWithAI`, `fetchKeywordData`, `analyzeSite`, `runCrossComparison`, `crossCheckSerpRankings`, `saveToCache`, `buildCacheKey`, `json`, `normalizeUrl` etc. coexistent → impossible de tester une brique isolément, chaque déploiement recompile 1 062 l.
**Fix** : découpe en `_shared/auditCompare/` avec 5 fichiers :
- `_shared/auditCompare/pagespeed.ts` (~120 l.)
- `_shared/auditCompare/backlinks.ts` (~110 l., appels DataForSEO backlinks)
- `_shared/auditCompare/keywords.ts` (~140 l., appels DataForSEO keywords + serp)
- `_shared/auditCompare/browserless.ts` (~130 l., extractPageMetadata)
- `_shared/auditCompare/llm.ts` (~200 l., generateSeedsWithAI + analyzeSite + runCrossComparison)
- `_shared/auditCompare/cache.ts` (~60 l.)
- `index.ts` réduit à ~300 l. (handler + orchestration + json helper).

## #81 · P1 · 0.5j — 16 `: any` + 8 `console.log` non structurés
**Fichier** : `supabase/functions/audit-compare/index.ts` — 16 occurrences `: any`, 8 `console.log`.
**Fix** : typer les payloads DataForSEO (`DataForSEOBacklinksResponse`, `DataForSEOKeywordsResponse`, `DataForSEOSerpResponse`), remplacer `console.log` par un logger structuré (`{ fn: 'audit-compare', phase: 'backlinks', url, duration_ms }`) pour permettre l'agrégation dans les logs edge.

## #82 · P1 · 1.5j — Frontend `AuditCompare.tsx` 1 677 l. (record du projet)
**Fichier** : `src/pages/AuditCompare.tsx` — **le plus gros front du projet**.
**Problème** : sans lecture ligne à ligne, on peut déjà anticiper : logique de handlers, rendu du "SERP battlefield", cartes comparatives, graphiques radar, export PDF, gestion des états (idle/loading/error/comparing/done), tout dans une seule page.
**Fix** : découper en sous-composants :
- `<CompareUrlInputs>` (formulaire 2 URLs + validation)
- `<CompareLoadingTimeline>` (barre de progression multi-phase)
- `<CompareRadarChart>` (visualisation scores)
- `<CompareSerpBattlefield>` (grille SERP head-to-head)
- `<CompareBacklinksPanel>`, `<CompareKeywordsPanel>`, `<CompareLLMInsights>`
- Hook `useAuditCompare()` : encapsule invoke + états + cache client.
Cible : `AuditCompare.tsx` ≤ 300 l. (juste orchestration + layout).

## Résumé Vague 3 partie 4 · audit-compare
- **P0** = **2j** (#77 migration gateway + #78 TTL 7 j + #79 fusion SERP)
- **P1** = **3j** (#80 découpe monolithe + #81 types/logs + #82 découpe front)
- **Total** : **5j**

**Verdict** : audit-compare est **la function la plus coûteuse à l'usage** du projet (18 appels externes par comparaison). Le P0 #77 (migration gateway) est **la plus grosse économie unitaire de la Vague 3** — chaque comparaison coûtera 30-50 % moins cher dès déploiement. À faire **avant** toute mise en avant de la feature comparative dans l'UI.

---

# Vague 3 · Partie 5 — expert-audit + audit-expert-seo (Audit Expert)

Brief : `knowledge/audits/audit-expert/brief-2026-07-08.md`
Périmètre : `supabase/functions/expert-audit/index.ts` (**2 987 l.**) + `supabase/functions/audit-expert-seo/index.ts` (**2 338 l.**) + `src/pages/ExpertAudit.tsx` (170 l., **thin wrapper OK**).
Signal audité : **5 325 lignes cumulées de backend** — probablement le plus gros duo d'edge functions du projet. LLM appelé via `aiGatewayFetch` (bon) mais avec modèles `google/gemini-3-flash-preview` + `google/gemini-3.1-pro-preview` → **hors catalogue Lovable AI**.

## #83 · P0 · 0.5j — Modèles LLM hors catalogue Lovable AI
**Fichiers** : `expert-audit/index.ts` l.2756 (`model: 'google/gemini-3-flash-preview'`) + `audit-expert-seo/index.ts` l.1966 (`model: 'google/gemini-3.1-pro-preview'`).
**Problème** : ces modèles n'existent pas dans le catalogue `ai-models-chat` (violation `mem://ai-models-using`). L'appel gateway renvoie probablement 400 silencieusement → **l'introduction narrative n'est jamais générée** (fallback `null` géré à l.1954 `if (!LOVABLE_API_KEY) return null;` mais silencieux même si le 400 vient du modèle).
**Fix** :
- `expert-audit` : passer à `google/gemini-2.5-flash` (rapide, prix bas, adapté à l'intro 3 paragraphes)
- `audit-expert-seo` : passer à `google/gemini-2.5-pro` (fidélité meilleure pour l'intro consultant senior)
- Ajouter un log explicite du statut HTTP + body en cas d'échec (aujourd'hui perdu).
**Vérification requise** : après fix, tester une génération réelle et lire la réponse (le 400 provider ne remonte pas via `invoke`).

## #84 · P0 · 1j — Redondance fonctionnelle expert-audit vs audit-expert-seo
**Problème** : les deux functions ont le même objet métier (audit technique d'une URL) avec des scoring légèrement différents (200 pts vs 200 pts, mais découpage variable). 5 325 l. dupliquées de fetch PageSpeed, extract HTML, analyse schema, détection sitemap/robots. Une lecture des sections `fetchAndRenderPage` et `fetchPageSpeedScores` dans les 2 fichiers révélerait probablement 60-80 % de code équivalent.
**Fix** (audit approfondi 0.5j puis refactor 0.5j) :
1. Lire les 2 fichiers en parallèle et produire un diff fonctionnel (`expert-audit` = v1, `audit-expert-seo` = v2 ?).
2. Si l'un est le successeur : marquer l'autre `@deprecated`, rediriger les callers vers le nouveau.
3. Extraire les briques communes (`_shared/expertAudit/pagespeed.ts`, `.../renderPage.ts`, `.../analyzeHtml.ts`, `.../scoring.ts`).

## #85 · P1 · 1.5j — Découpe des 2 monolithes
**Fichiers** : `expert-audit/index.ts` 2 987 l. + `audit-expert-seo/index.ts` 2 338 l.
**Fix** : après #84 (fusion/déprécation), la function survivante est découpée en 6-8 modules `_shared/expertAudit/*` (rendering, pagespeed, html, schema, security, scoring, narrative, cache). Handler `index.ts` réduit à ≤ 400 l.

## #86 · P1 · 0.5j — Dette : 90 `console.log` + 9 `: any` cumulés
**Fichiers** : `expert-audit` (62 `console.log` + 4 `: any`) + `audit-expert-seo` (28 `console.log` + 5 `: any`).
**Fix** : logger structuré partagé, types Response DataForSEO/PageSpeed factorisés dans `_shared/types/`.

## #87 · P2 · 0.5j — Cache expert-audit invalidé manuellement 2× dans les migrations
**Problème** : `20260309123630_*.sql` et `20260309124732_*.sql` contiennent des `DELETE FROM audit_cache WHERE function_name = 'expert-audit'` → indique un bug historique où le cache renvoyait des résultats faux. Aucun trace du fix côté function.
**Fix** : audit du `buildCacheKey` d'expert-audit (probablement basé uniquement sur `url`, sans versionner le schéma de scoring → ancien cache renvoie l'ancien barème). Ajouter `scoring_version` dans la clé de cache.

---

# Vague 3 · Partie 6 — Matrix (parse-matrix-*)

Brief : périmètre réduit — **il n'existe pas de `matrix-audit` edge function**. Le "système matrix" est composé de 3 parsers :
- `parse-doc-matrix/index.ts` (368 l.)
- `parse-matrix-geo/index.ts` (734 l.)
- `parse-matrix-hybrid/index.ts` (384 l.)
Total : 1 486 l. + table `content_requirements_matrix` référencée par 12 functions (voir `mem://tech/architecture/unified-requirements-matrix-fr`).

## #88 · P1 · 1j — Redondance parse-doc vs parse-matrix-hybrid vs parse-matrix-geo
**Problème** : 3 parsers qui font peu ou prou le même travail (extraire une matrice de requirements depuis un doc/URL). 1 486 l. cumulées → probablement 40 % de duplication (extraction texte, chunking, appel LLM, mapping vers `content_requirements_matrix`).
**Fix** (audit 0.25j puis refactor 0.75j) : identifier le parser "canonique" (probablement `parse-matrix-hybrid` selon son nom), déprécier les 2 autres ou les transformer en wrappers thin qui appellent le canonique avec des params `mode: 'geo' | 'doc' | 'hybrid'`.

**Note** : audit léger volontaire — les parseurs matrix sont appelés à faible fréquence (usage on-demand), l'impact coût est marginal vs audit-compare / expert-audit.

---

# Résumé Vague 3 · Partie 4-6 (audit-compare + expert + matrix)
- **P0** = **3.5j** (#77 gateway + #78 TTL + #79 fusion SERP + #83 modèles catalogue + #84 dédup expert)
- **P1** = **6j** (#80 découpe compare + #81 types compare + #82 front compare + #85 découpe experts + #86 dette experts + #88 dédup matrix)
- **P2** = **0.5j** (#87 cache expert)
- **Total partie 4-6** : **10j**

## Cumul Vague 3 complète (parties 1 à 6)
- **P0** = **6.75j** (Vague 3.1-3 : 3.25j + Vague 3.4-6 : 3.5j)
- **P1** = **11.25j** (Vague 3.1-3 : 5.25j + Vague 3.4-6 : 6j)
- **P2** = **3.25j** (Vague 3.1-3 : 2.75j + Vague 3.4-6 : 0.5j)
- **Total Vague 3** : **21.25j**

## Top 3 économies immédiates de la Vague 3
1. **#77 (1j)** — Migrer audit-compare LLM d'OpenRouter direct vers Lovable AI Gateway → -30 à -50 % coût LLM sur la function la plus utilisée du benchmark comparatif.
2. **#78 (0.5j)** — TTL cache 2 h → 7 j sur audit-compare → -66 % sur usages répétés semaine.
3. **#83 (0.5j)** — Corriger les modèles hors catalogue d'expert-audit + audit-expert-seo → **débloque les introductions narratives** qui échouent probablement en silence aujourd'hui (à vérifier dans logs).

**Ordre de déploiement recommandé** : #83 (fix silencieux) → #77 + #78 (économies max) → #84 (dette structurelle) → reste.

---

# Vague 4 — Workflows critiques (SEO / GEO / Content Architect / Code Architect / Breathing Spiral / Marina)

Briefs : `knowledge/audits/{workflow-audit-seo,workflow-audit-geo,content-architect,code-architect,breathing-spiral,marina}/brief-2026-07-08.md`
Audits : mêmes dossiers, fichier `audit-2026-07-08.md`.
Angle transverse : cohérence Copilot orchestrator + skills + vector memory + prompt safety.

## #89 · P0 SÉCU · 1j — Sanitiser HTML côté edge dans `iktracker-actions`
**Fichier** : `supabase/functions/iktracker-actions/index.ts` (798 l.)
**Problème** : aucun appel `DOMPurify.sanitize` détecté côté edge alors que la mémoire `code-and-injection-security-v2-fr` l'exige. Si le contrôle est purement client, un client malveillant (ou un skill Copilot compromis) peut pousser du HTML/JS non sanitizé jusqu'à l'injection sur site cible → **XSS on-site vraiment déployé**.
**Fix** : créer `supabase/functions/_shared/htmlSanitizer.ts` basé sur `npm:isomorphic-dompurify` + `npm:jsdom`, appelé sur TOUT `payload.html`/`payload.script` avant push IKtracker. Ajouter test XSS canary.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 10 | 0 | 5 | **4.3** | 1j |

## #90 · P0 · 0.5j — `detect-fan-out` : 3 appels OpenRouter directs à migrer sur gateway
**Fichier** : `supabase/functions/detect-fan-out/index.ts` (lignes 49, 81, 106)
**Problème** : 3 `fetch("https://openrouter.ai/api/v1/chat/completions")` bypass total du gateway → 0 trace dans `ai_gateway_usage`, pas de kill switch admin `disable_premium`, pas de fallback. Même problème pattern que #77 sur audit-compare, non résolu ici.
**Fix** : remplacer par `aiGatewayFetch` (`_shared/aiGatewayFetch.ts`), mapper les 3 modèles vers ids catalogue.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 6 | 8 | 9 | **6.6** | 0.5j |

## #91 · P0 · 3j — Marina : découpe + typage + migration gateway
**Fichier** : `supabase/functions/marina/index.ts` (2 984 l., 87 `console.log`, 57 `: any`, `LOVABLE_API_KEY` en fetch direct)
**Problème** : plus gros edge du projet (dépasse même `expert-audit`), triple risque : dette structurelle (57 `any`), hors observabilité gateway, duplication probable des modules SEO/GEO/Spiral déjà existants.
**Fix** :
1. `_shared/marina/{prospectScoring,seoSnapshot,geoSnapshot,spiralSnapshot,outreachLLM,whiteLabel,types}.ts`
2. Handler `index.ts` ≤ 400 l., orchestrateur pur
3. Snapshots SEO/GEO/Spiral = **invocation** des edges/modules canoniques (`computeSeoScoreV2`, `spiralClassifier`, `geo-kpis-aggregate`) — jamais de copie locale
4. Tout LLM via `aiGatewayFetch` (drop `LOVABLE_API_KEY` direct)
5. Logger structuré + correlation_id par prospect

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 4 | 6 | 7 | 10 | **6.6** | 3j |

## #92 · P0 · 1.5j — Content Architect : typage strict + découpe
**Fichier** : `content-architecture-advisor/index.ts` (1 642 l., 43 `console.log`, **49 `: any`**)
**Problème** : pipeline 4 étages (briefing → stratège → rédacteur → tonalisateur) tout `any` → 0 garantie de forme du draft final avant push CMS 7 plateformes = risque de publication cassée en prod.
**Fix** :
1. `_shared/contentArchitect/types.ts` (`Briefing`, `StrategyPlan`, `WriterDraft`, `TonalizedDraft`)
2. Split `_shared/contentArchitect/{briefing,strategist,writer,tonalizer}.ts`
3. Handler ≤ 300 l., zod validation entre étages

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 3 | 4 | 10 | **4.7** | 1.5j |

## #93 · P1 · 0.5j — Skills Copilot manquants pour 5 workflows
**Problème** : aucun des workflows Vague 4 n'expose de skill dans `_shared/skills/registry.ts` → Copilot Félix/Stratège ne peut pas orchestrer, seulement pointer l'UI. Contradiction directe avec mémoire `copilot/architecture-1backend-npersonas`.
**Fix** : déclarer 5 skills avec policy par persona :
- `audit_seo` — Félix `auto`, Stratège `approval`
- `audit_geo` — Félix `auto`, Stratège `approval`
- `generate_content_architecture` — Stratège `auto`, Félix `forbidden`
- `inject_code_advanced` — Félix `approval`, Stratège `forbidden`
- `explain_spiral_phase` — Stratège `auto`, Félix `auto`
- `run_marina_prospect` — Stratège `approval` uniquement

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 4 | 3 | 8 | **3.7** | 0.5j |

## #94 · P1 · 1j — Breathing Spiral : typage strict compute-spiral-signals + cocoon-strategist
**Fichiers** : `compute-spiral-signals/index.ts` (660 l., 11 `any`), `cocoon-strategist/index.ts` (1 705 l., 18 `any`)
**Problème** : algo signature Crawlers mais 6 signaux typés `any` → une modif de pondération peut silencieusement casser la phase computation. Cocoon-strategist est monolithique (1 705 l.) comme content-architect.
**Fix** : `_shared/spiralTypes.ts` (`SpiralSignal`, `SpiralPhase`, `SpiralScore`) + découpe `_shared/strategist/{planner,prioritizer,executor,rewardLoop}.ts`.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 2 | 2 | 3 | 9 | **3.5** | 1j |

## #95 · P1 · 0.5j — Vector memory : embed résultats audits SEO/GEO/Marina
**Problème** : la mémoire hybride (`copilot/vector-memory-hybrid-recall`) fonctionne sur `copilot_actions` mais les résultats des audits SEO/GEO/Marina ne sont **jamais wrappés** avec `wrapToolResult('audit_*_result')` → Félix ne peut pas rappeler les findings des 30j précédents pour un utilisateur récurrent.
**Fix** : dans chaque handler post-audit (SEO, GEO, Marina), après retour succès, insérer une trace `copilot_actions` avec `tool_result` wrappé — worker `embed-copilot-turns` fera le reste.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 3 | 5 | 7 | **3.5** | 0.5j |

## #96 · P2 · 0.5j — Logger structuré partagé (dette console.log Vague 4)
**Compteur cumulé Vague 4** : 275 `console.*` (audit-expert-seo 71 + expert-audit 53 + content-architect 43 + iktracker 24 + cocoon-strategist 20 + compute-spiral 6 + marina 87 + geo-kpis 2 + fan-out 2 — net des doublons Vague 3).
**Fix** : `_shared/logger.ts` (`log.info({ correlation_id, feature, step }, ...)`), migration progressive par feature en tâche de fond.

| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 2 | 0 | 8 | **2.3** | 0.5j |

---

# Résumé Vague 4
- **P0** = **6j** (#89 sanitize + #90 fan-out gateway + #91 marina + #92 content architect)
- **P1** = **2j** (#93 skills + #94 spiral typing + #95 vector memory)
- **P2** = **0.5j** (#96 logger)
- **Total Vague 4** : **8.5j**

## Top 3 urgences Vague 4 (impact × risque)
1. **#89 (1j)** — Sanitize HTML côté edge sur iktracker → **fermer un risque XSS potentiel on-site du client** (le plus critique).
2. **#90 (0.5j)** — Gateway fan-out → dernière function qui bypass encore le gateway, ferme la boucle observabilité GEO.
3. **#91 (3j)** — Marina découpe/typage/gateway → la plus grosse dette structurelle du projet, bloquera scale outreach B2B.

**Ordre de déploiement recommandé** : #89 (sécu bloquante) → #90 (quick win coût) → #93 (débloque Copilot orchestration) → #92 + #94 (dette structurelle) → #91 (chantier long) → #95 + #96 (finition).

## Cumul projet (Vagues 1 à 4)
- **P0** = **6.75j (V1-2) + 6.75j (V3) + 6j (V4)** = **19.5j**
- **P1** = variable (voir résumés par vague)
- **Total P0+P1+P2 projet** : ≈ **50j-homme** de dette identifiée sur 4 vagues d'audit.

---

# Vague 4-bis — Marina périmètre élargi (2026-07-08)
Source : `knowledge/audits/marina/audit-2026-07-08-bis.md` · Brief : `brief-2026-07-08-bis.md`
Périmètre : front public + admin + pipeline outreach + 7 tables + `view-marina-report` + `_shared/marinaWorkbench`.

## #97 · P0 · 1.25j — GRANT + policies sur les 7 tables Marina/outreach (M7+M8+M9)
**Preuve** : `information_schema.role_table_grants` → seul `sandbox_exec` a des grants ; `authenticated` et `service_role` absents sur les 7 tables. `marina_api_keys` n'a que 2 policies SELECT (aucun INSERT/UPDATE). `marina_prospects` + `prospect_outreach_queue` sont Admin-only ALL → Pro Agency owner ne peut pas lire ses propres prospects.
**Fix** : migration unique
```sql
GRANT SELECT,INSERT,UPDATE,DELETE ON public.marina_api_keys, public.marina_prospects,
  public.outreach_sequences, public.outreach_daily_quotas, public.outreach_events,
  public.prospect_outreach_queue TO authenticated;
GRANT ALL ON <toutes> TO service_role;
-- marina_training_data reste service_role only.
-- Policies owner-scoped à ajouter : marina_api_keys (ALL auth.uid), marina_prospects (SELECT/UPDATE owner), prospect_outreach_queue (SELECT via join owner).
```
| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 10 | 0 | 8 | **6.0** | 1.25j |

## #98 · P1 · 0.25j — Prompt safety `prospect-pipeline` (M10)
**Preuve** : ligne 190 de `prospect-pipeline/index.ts` — `callLovableAIText(prompt)` où `prompt` contient `p.description`/`p.company_name` bruts (données prospect potentiellement adverses).
**Fix** : `import { wrapUserInput } from '../_shared/promptSafety.ts'` puis wrapper toute variable prospect avant concaténation dans le prompt.
| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 7 | 0 | 4 | **3.5** | 0.25j |

## #99 · P1 · 0.5j — Anti-`any` workflow Marina (M11)
**Preuve grep** : 91 `: any` cumulés sur `marina/index.ts` (57) + `MarinaDashboard` (15) + `prospect-pipeline` (10) + `Marina.tsx` (4) + `ProspectPipelineDashboard` (3) + `marinaWorkbench` (2). Cast révélateur : `.from('marina_prospects' as any)` = types Supabase désynchronisés.
**Fix** : `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts` puis règle ESLint `no-explicit-any` scoped `**/marina*/**` + `**/prospect*/**`.
| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 3 | 0 | 8 | **3.5** | 0.5j |

## #100 · P1 · 0.5j — Télémétrie produit Marina (M12)
**Preuve SQL** : 0 event `analytics_events` matching marina/prospect/outreach → aucune mesure d'adoption.
**Fix** : instrumenter `marina_audit_launched`, `marina_export_pdf` (front admin), `marina_report_viewed` (Marina.tsx), `outreach_step_sent` (edge server-side avec `event_source='edge'`).
| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 0 | 5 | 6 | **2.5** | 0.5j |

## #101 · P1 · 1.5j — Découpe `Marina.tsx` viewer/launcher (M13)
**Preuve** : `Marina.tsx` = 1 510 l. sans aucun `functions.invoke('marina')` → page publique = viewer démo du dernier `async_jobs`. Divergence claire avec l'intent Pro Agency self-service documenté dans `mem://features/prospecting/marina-module-fr`.
**Fix** : décomposer en `MarinaHero.tsx` + `MarinaDemoViewer.tsx` + `MarinaLaunchForm.tsx` (< 300 l. chacun), brancher `MarinaLaunchForm` sur edge `marina` avec quota Pro Agency, ou déprécier la page si décision produit "admin-only".
| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 3 | 0 | 0 | 8 | **3.0** | 1.5j |

## #102 · P2 · 0.5j — Access control `view-marina-report` (M15)
**Preuve** : `view-marina-report` sert tout `job_id` UUID sans vérifier `user_id` (leak potentiel par referrer/log).
**Fix** : signature HMAC courte dans l'URL (`?sig=hmac(job_id||expiry)`), vérif côté edge, ou décision explicite "share by URL" documentée.
| Perf | Sécu | Coût | Maint | **Global** | Effort |
|---|---|---|---|---|---|
| 0 | 5 | 0 | 3 | **2.0** | 0.5j |

---

# Résumé Vague 4-bis
- **P0** : 1.25j (#97)
- **P1** : 2.75j (#98 + #99 + #100 + #101)
- **P2** : 0.5j (#102)
- **Total Vague 4-bis** : **4.5j**

## Top 3 urgences Vague 4-bis
1. **#97 (1.25j)** — GRANT + policies : débloque tout usage self-service Pro Agency + conformité règle projet.
2. **#98 (0.25j)** — Prompt safety prospect-pipeline : ferme un vecteur d'injection depuis bio LinkedIn.
3. **#101 (1.5j)** — Découpe Marina.tsx : aligne le front public avec l'intent produit Pro Agency.

## Cumul projet (Vagues 1 → 4-bis)
- **P0 cumulé** : 19.5j + 1.25j = **20.75j**
- **Total dette** : ≈ **54.5j-homme** sur 5 audits (V1, V2, V3, V4, V4-bis).



---

# Vague 6 — 5 features (crawl-multi-pages, render-page, cocoon, serp-benchmark, conversion-optimizer)

## #103 · P0 · 0.5j — Credit cost crawl figé à 1 crédit (C1)
Preuve `crawl-site/index.ts:431-433` → 1 crédit constant vs grille brief 5-40. Sous-facturation 40× sur crawl 500p.
Fix : `_shared/crawlCreditCost.ts` (5≤50p / 10≤100p / 15≤200p / 25≤350p / 40>350p).

## #104 · P0 · 0.25j — Plan Premium crawl traité comme Free (C2)
`crawl-site/index.ts:382,405` : seul agency_pro/premium dépasse 50p. Fix : branches `premium/pro → 150p`.

## #105 · P0 · 0.25j — `crawl_pages` sans policy UPDATE/DELETE (C3)
Bypass service_role silencieux. Fix : policies UPDATE service_role + DELETE authenticated via join `site_crawls`.

## #106 · P0 · 0.25j — XSS stocké dans `markdownToHtml` render-page (R1)
`render-page` L108 : href `$2` + inline injectés sans `escapeHtml()`. Exécution JS depuis `blog_articles.content`.
Fix : `escapeHtml` sur href/text + sanitize serveur.

## #107 · P0 · 0.5j — SSRF `bot-prerender-check` (R2)
Toute URL HTTP(S) acceptée sans blocklist IP/CIDR (IMDS 169.254.169.254, localhost, RFC1918).
Fix : DNS resolve + blocklist CIDR + validation scheme.

## #108 · P0 · 0.25j — Cache landing jamais relu render-page (R3)
Bloc cache-check absent handler `/landing/<slug>` (L617-733). Toujours fresh, coûts SSR ×N.
Fix : recopier pattern blog L558 sur landing.

## #109 · P0 · 0.5j — Cocoon INSERT policies manquantes
Tables `cocoon_strategy_plans` + `cocoon_diagnostic_results` : pas de policy INSERT authenticated. Bypass service_role masque le trou.
Fix : policies INSERT `auth.uid() = user_id`.

## #110 · P0 · 0.25j — SERP `refresh-serp-all` : `ReferenceError` silencieux
`supabaseUrl`/`serviceKey` jamais déclarés → cron cassé depuis le début, SERP batch 100% down.
Fix : ajouter les 2 déclarations en tête de handler.

## #111 · P0 · 0.5j — SERP lead magnet anonyme sans rate-limit
3 providers payants appelables à volonté → drain coût immédiat.
Fix : rate-limit IP (10/j) + captcha turnstile + quota anonyme dailyCostGuard.

## #112 · P1 · 0.5j — Télémétrie crawl absente (C4)
5 events `crawl_launched/_detect/_analyze/_export/_compare` via `track-analytics`.

## #113 · P1 · 0.5j — 31 `: any` `finalizer.ts` crawl (C5)
`_shared/crawlQueue/dbTypes.ts` avec interfaces dérivées schema.

## #114 · P1 · 1j — Découpe `useCrawlEngine`/`useSiteCrawl` (C6, 1632 LOC total)
`useCrawlPolling/Compare/Detect/Stats` (< 250 l. chacun).

## #115 · P1 · 0.5j — `strategic-crawl` code mort 375 l. (C7)
Décision : intégrer E-E-A-T dans `htmlAnalyzer.ts` shared + archiver standalone.

## #116 · P1 · 0.25j — Gemini `-preview` sans fallback (C8, C9-cocoon, C-marina)
Remplacer `gemini-3-flash-preview` → `google/gemini-flash-1.5` + retry `gemini-pro`. Applicable finalizer crawl + analyze-ux-context + cocoon.

## #117 · P1 · 0.25j — Voice-tone trigger ANON_KEY (C9)
`finalizer.ts:403` → `SERVICE_ROLE_KEY`.

## #118 · P1 · 0.5j — IKtracker hardcodé `crawl-site` (C10)
Extraire `_shared/tenantOverrides/iktracker.ts`.

## #119 · P1 · 0.5j — ETag/304 absent render-page (R4)
Bots re-téléchargent HTML complet. Fix : hash SHA-256 du body + If-None-Match handler.

## #120 · P1 · 0.25j — `content_hash=""` hardcodé landing/guide render-page (R5)
Invalidation conditionnelle inopérante 2/3 types. Fix : SHA-256 sur payload rendu.

## #121 · P1 · 0.25j — `isBot` détecté jamais exploité (R6)
Actuellement `console.log` only. Fix : incrémenter `bot_hits` + priorisation cache.

## #122 · P1 · 0.5j — Invalidation cache render-page absente (R7)
Pas de trigger DB à la publication. Fix : trigger AFTER UPDATE `blog_articles/seo_page_drafts` → DELETE `prerender_cache`.

## #123 · P1 · 0.5j — Cocoon prompt injection `domainDataBlock` non wrappé
Données crawlées injectées brutes dans LLM stratège.
Fix : `wrapUserInput('domain_data', ...)` + préambule sécurité.

## #124 · P1 · 1j — Cocoon Three.js chargé statiquement (~520 KB bundle)
Bloque LCP home même sans ouvrir Cocoon.
Fix : `React.lazy` + `Suspense` sur composants 3D + code-split route.

## #125 · P1 · 0.5j — SERP zéro `trackPaidApiCall` (P1-1)
3 API calls/benchmark invisibles dans `paid_api_calls`. `dailyCostGuard` aveugle.
Fix : wrapper `trackPaidApiCall` sur les 3 providers.

## #126 · P1 · 0.5j — SERP `serpapi_cache` jamais lue (P1-2)
0% cache hit, gaspillage 100% sur queries récurrentes.
Fix : lookup `serpapi_cache` avant call, TTL 24h.

## #127 · P1 · 0.25j — SERP `Promise.all` vs `allSettled` (P1-3)
Un throw non attrapé fait exploser le benchmark entier. Fix : `Promise.allSettled`.

## #128 · P1 · 0.5j — SERP dup `fetchSerpApi` verbatim (P1-4)
Dupliqué entre `serp-benchmark` et `serpapi-actions` (sans cache/tracking).
Fix : `_shared/serpapi/fetch.ts` unifié.

## #129 · P2 · 0.5j — Thundering herd crawl self-relay (C11)
Worker + cron + `crawl-site` peuvent lancer N instances/job.
Fix : `pg_try_advisory_xact_lock(job.id)`.

## #130 · P2 · 0.5j — `discoverDirectories` query non-aggregée (C12)
300k rows/run cron. Fix : RPC `get_crawl_directories` avec `GROUP BY`.

## #131 · P2 · 0.25j — `site_crawl_schedule` service_role only (C13)
Pro Agency ne peut consulter/modifier planning. Fix : policies SELECT+UPDATE `auth.uid()=user_id`.

## #132 · P2 · 0.5j — Bloat render-page 43 liens nav + hardcoded prices (R8/R9/R10)
Fix : nav minimale statique + prix depuis `plans_config` + resync ROUTE_LABELS vs PUBLIC_ROUTES.

## #133 · P2 · 0.5j — Cocoon 23 emojis violant design system Crawlers
Fix : remplacer par icônes lucide-react (palette violet/or/noir/blanc).

## #134 · P2 · 0.25j — SERP prompt LLM non wrappé + `: any` × 20 + `bg-blue-500` interdit
Fix : `wrapToolResult` + typage + tokens design system.

## #135 · P2 · 1j — Conversion-optimizer P0 : sémaphore non branché + modèle LLM inexistant + timeout 45s
`analyze-ux-context/index.ts` : `gemini-3-flash-preview` (idem #116), sémaphore déclaré mais jamais acquire/release, timeout 45s cause failures. Fix : brancher sémaphore, modèle stable, timeout 90s + streaming.

## #136 · P1 · 0.5j — Conversion-optimizer bucket `ux-screenshots` public (fuite RGPD)
Screenshots UX indexables par n'importe qui via URL prédictible.
Fix : bucket privé + signed URLs 15min.

## #137 · P1 · 0.5j — Conversion-optimizer RLS UPDATE `ux_context_analyses` manquante + cache absent + double-tracking LLM + monolithe 1334 l.
Fix combo : policy UPDATE, cache hash payload, dédup `trackAiCall`, découpe en 3 modules `_shared/uxContext/`.

## #138 · P2 · 0.5j — Conversion-optimizer 34 `any` + 8 `console.log` + XSS HTML inline rapport + page 848 l. + `agent-ux` orphelin
Fix combo : typage, logger structuré, `escapeHtml`, découpe UI, archivage `agent-ux`.

---

# Résumé Vague 6
- **P0** : 3.25j (#103-#111, 9 items)
- **P1** : 8.75j (#112-#128, 17 items)
- **P2** : 4j (#129-#138, 10 items)
- **Total Vague 6** : **~16j** sur 36 findings

## Top 5 urgences Vague 6
1. **#110 (0.25j)** — `refresh-serp-all` ReferenceError : cron SERP cassé depuis le début.
2. **#111 (0.5j)** — SERP lead magnet sans rate-limit : drain coût immédiat.
3. **#106 (0.25j) + #107 (0.5j)** — XSS render-page + SSRF bot-prerender.
4. **#103 (0.5j) + #104 (0.25j)** — Revenus crawl : sous-facturation 40× + Premium=Free.
5. **#109 (0.5j)** — Cocoon INSERT policies : bypass service_role masqué.

## Cumul projet (Vagues 1 → 6)
- **P0 cumulé** : 20.75j + 3.25j = **24j**
- **Total dette** : ~54.5j + 16j = **~70.5j-homme** sur 10 features auditées

---

# Vague 5 — Audits expert-seo · audit-compare · copilot-orchestrator · parmenion · matrix

## #139 · P0 · 2j — Expert-SEO : bypass total RLS sur tables audits
Policies "Service role full access" sur `audits`, `audit_cache`, `audit_raw_data` avec `USING (true)` sans `TO service_role` → n'importe quel `authenticated` voit/modifie les audits d'autrui.
Fix : Ajouter `TO service_role` ou `USING (auth.role() = 'service_role')` via migration corrective.

## #140 · P0 · 1j — Expert-SEO : appel LLM hors Gateway dans audit-compare
`audit-compare/index.ts:343` appelle directement `openrouter.ai` (gemini-3.1-flash-lite) sans `aiGatewayFetch` → aucun tracking coûts/quotas.
Fix : Router via `aiGatewayFetch`.

## #141 · P1 · 5j — Expert-SEO : duplication massive audit-expert-seo vs expert-audit
Deux fonctions ~2500 l. chacune font PSI/Safe Browsing/HTML analysis quasi-identiques.
Fix : Fusionner sur `audit-expert-seo`, migrer spécificités EEAT/CMS, déprécier `expert-audit`.

## #142 · P1 · 2j — Expert-SEO : safeServiceCall absent pour vérif propriété
Edge functions SEO accèdent aux données par domaine sans valider `tracked_site_id` via `safeServiceCall` → collision multi-users trackant même domaine.
Fix : Wrapper `safeServiceCall` sur audits.

## #143 · P1 · 1j — Expert-SEO : GRANTs manquants pour authenticated
`audit_raw_data`, `audit_impact_snapshots` sans `GRANT SELECT, INSERT TO authenticated` → casse dès correctif #139.
Fix : Migration GRANTs explicites.

## #144 · P2 · 1j — Expert-SEO : DS non conforme + console.log
`ExpertAuditDashboard.tsx` : `bg-violet-500/10`, `bg-[hsl(263,70%,38%)]` hardcodés + console.log prod.
Fix : Variables thème CSS, retirer logs.

## #145 · P2 · 1j — Expert-SEO : risque timeout edge 60s
Appels synchrones Browserless + PSI + DataForSEO avec timeouts 30s+ cumulés.
Fix : Réduire timeouts individuels, garantir `Promise.all`.

## #149 · P0 · 2j — Audit-compare : fuite coûts LLM et Gateway bypass
`generateSeedsWithAI`, `analyzeSite`, `runCrossComparison` utilisent `fetch` direct vers OpenRouter au lieu d'`aiGatewayFetch`.
Fix : Migrer les 3 handlers vers `aiGatewayFetch`.

## #150 · P1 · 1j — Audit-compare : absence rate-limit IP (lead magnet drain)
Appels payants DataForSEO déclenchables par anonymes sans restriction IP.
Fix : `ipRateLimiter` en tête du handler avant tout appel payant.

## #151 · P1 · 1.5j — Audit-compare : monolithe frontend 1677 l.
`AuditCompare.tsx` mélange logique/types/i18n/composants non mémoïsés → re-renders massifs.
Fix : Split `features/audit-compare/components/` (CompareForm, RadarBattle, …).

## #152 · P1 · 1j — Audit-compare : SSRF sur extractPageMetadata
`extractPageMetadata` fetch URLs utilisateurs sans validation.
Fix : `assertSafeUrl` (_shared/ssrf.ts) + `stealthFetch`.

## #153 · P2 · 0.5j — Audit-compare : TTL cache 2h inadapté
Backlinks/keywords sont stables → 2h gaspille les appels.
Fix : TTL 24h min, 7j idéal pour domaines non-frais.

## #154 · P2 · 1j — Audit-compare : monolithe backend 1062 l.
Logique métier non mutualisée dans `index.ts`.
Fix : Déporter dans `_shared/audit-compare/`.

## #155 · P2 · 0.5j — Audit-compare : détection SPA inefficace
Fallback Browserless sur simple check longueur texte.
Fix : Utiliser `isSpaDetected` shared basé sur signatures frameworks.

## #159 · P0 · 1j — Copilot : recall vectoriel hybride tombé en fallback JS
`recallMemoryContext` échoue sur la RPC (`auth.uid()` null avec service role, `p_user_id` non passé) → fallback cosine JS 50 lignes, recall cross-session inopérant.
Fix : Passer `p_user_id` explicite à `search_copilot_turns_hybrid` (SECURITY DEFINER + filtrage interne).

## #160 · P1 · 1j — Copilot : violation charte "pas de bleu IA" sur Félix
`AgentChatShell.tsx:188` utilise `border-primary bg-primary` (bleu IA) pour bulles Félix.
Fix : Bascule gris anthracite/noir Crawlers, Stratège garde accent safran.

## #161 · P1 · 1j — Copilot : Anthropic cache breakpoints manquants sur historique
`callLLM` active cache uniquement sur system prompt, pas de `cache_control` sur messages historique → re-lecture payante chaque itération.
Fix : Injecter `cache_control: { type: 'ephemeral' }` sur dernier message user précédent dans `loadHistory`.

## #162 · P2 · 0.5j — Copilot : skill trigger_audit autorisée pour Félix
Félix (SAV gratuit) peut proposer action payante en approval → friction UX.
Fix : `trigger_audit: 'forbidden'` pour Félix dans `personas.ts`.

## #163 · P2 · 1j — Copilot : séquençage navigation inefficace
Skills `navigate_to`/`open_audit_panel` traitées en séquentiel alors que sans effet de bord serveur.
Fix : Déplacer catégorie `navigate` dans batch `parallelizable` (baisse TTFB).

## #164 · P1 · 1.5j — Copilot : safeServiceCall manquant sur cms_publish_draft (blog)
`registry.ts:404` écrit `blog_articles` via service role avec vérif admin uniquement, sans validation périmètre.
Fix : Wrapper CMS vérification granulaire propriété/permission même pour admins.

## #169 · P1 · 2j — Parmenion : propagation aveugle après skip Audit
Orchestrateur continue Diagnose/Prescribe sur données obsolètes si Audit skipped (crawl en cours).
Fix : Interrompre le cycle si phase critique retourne `skipped`.

## #170 · P0 · 3j — Parmenion : race condition Execute→Validate
Validate lancée immédiatement après Execute dans le même thread → cache CMS + latence workers empêchent la détection déploiement.
Fix : Découpler Validate avec délai min 30min ou cycle t+1.

## #171 · P1 · 1j — Parmenion : évaporation Tasks 2-8 du plan stratège
Stratège génère plan 8 tâches mais orchestrateur n'exécute que la 1ère.
Fix : Persister plan complet dans `strategist_recommendations`, Execute traite backlog avant re-prescription.

## #172 · P2 · 0.5j — Parmenion : collision config multi-target sur domaine
`ilike('domain')` sans filtrage strict `tracked_site_id` → mauvaise config si staging/prod partagent domaine.
Fix : Filtrage exact tuple `(domain, tracked_site_id)`.

## #173 · P2 · 2j — Parmenion : risque timeout Lambda sur cycles Sonnet 4.5
5 phases séquentielles avec LLM lents peuvent dépasser 300s edge timeout.
Fix : File d'attente async (Edge HTTP) ou augmenter timeout par phase.

## #174 · P1 · 1j — Parmenion : backlog guard inopérant sur Execute bloquée
Guard stoppe prescription si backlog >5 mais ne gère pas tâches en échec boucle.
Fix : `retry_count` sur décisions, bascule `failed` définitif après 3 tentatives.

## #175 · P2 · 1j — Parmenion : instabilité persona par rotation multi-phase
Round-robin peut changer persona entre Audit et Execute du même cycle.
Fix : Fixer persona au niveau `autopilot-engine` pour tout le cycle.

## #176 · P1 · 1j — Parmenion : faiblesse isolation site_id vs domaine
Orchestrateur fait confiance aux paramètres domain/tracked_site_id sans vérifier corrélation DB.
Fix : Guard intégrité au démarrage vérifiant appartenance domaine↔tracked_site_id↔user.

## #179 · P0 · 0.5j — Matrix : modèle LLM inexistant 'gpt-5'
Orchestrateur utilise `openai/gpt-5` (inexistant) pour scoring → échecs systématiques.
Fix : Basculer `openai/gpt-4o` ou `gpt-4-turbo`.

## #180 · P0 · 1j — Matrix : timeout 504 parallélisation non bornée
`audit-matrice` lance tous appels LLM en `Promise.all` sans throttle → 429 provider ou >60s edge sur matrices 20+ critères.
Fix : Pool concurrence bornée (p-limit) + backoff.

## #181 · P1 · 3j — Matrix : redondance schéma 7+ tables
`audit_matrix_sessions`, `matrix_audits`, `prompt_matrix_items`… quasi-identiques → incohérence + RLS complexe.
Fix : Unifier autour de `matrix_audits` + `matrix_audit_results`.

## #182 · P1 · 1j — Matrix : scoring brittle (fieldValueToNumeric)
Conversion labels ('Oui/Non') via regex hardcodées, échoue sur synonymes/variations.
Fix : Scoring piloté par métadonnées JSON ou prompts de normalisation.

## #183 · P1 · 2j — Matrix : dette technique MatricePrompt.tsx 1639 l.
31 `: any` dépassent seuil maintenabilité.
Fix : Split PromptManager/MatrixGrid/ResultSummary, typage strict imports.

## #184 · P2 · 1j — Matrix : fragmentation logique de parsing
`parse-doc-matrix`, `parse-matrix-hybrid`, `parse-matrix-geo` dupliquent 60% extraction XLSX/CSV.
Fix : Fonction unique paramétrable dans `_shared`.

## #185 · P2 · 0.5j — Matrix : latence artificielle orchestrateur front
`matrixOrchestrator.ts` impose 300ms fixe entre appels LLM sans nécessité (rate limit géré côté edge).
Fix : Supprimer ou passer à file d'attente priorité.

## #186 · P2 · 0.5j — Matrix : mapping incohérent moteurs IA
Import XLSX mappe Perplexity → Gemini-3-Flash-Preview au lieu de Sonar/GPT.
Fix : Harmoniser `mapEngineName` avec capacités réelles gateway.

---

# Résumé Vague 5
- **P0** : 9.5j (#139, #140, #149, #159, #170, #179, #180 — 7 items)
- **P1** : 20.5j (#141, #142, #143, #150, #151, #152, #160, #161, #164, #169, #171, #174, #176, #181, #182, #183 — 16 items)
- **P2** : 10j (#144, #145, #153, #154, #155, #162, #163, #172, #173, #175, #184, #185, #186 — 13 items)
- **Total Vague 5** : **~40j** sur 36 findings (5 features)

## Top 5 urgences Vague 5
1. **#139 (2j)** — Expert-SEO RLS bypass total sur audits (fuite cross-user).
2. **#170 (3j)** — Parmenion race condition Validate (validation cassée).
3. **#179 (0.5j) + #180 (1j)** — Matrix modèle inexistant + timeout.
4. **#149 (2j) + #140 (1j)** — Bypass AI Gateway (audit-compare + audit-expert-seo).
5. **#159 (1j)** — Copilot recall vectoriel dégradé (mémoire cross-session cassée).

## Cumul projet (Vagues 1 → 6)
- **P0 cumulé** : 24j + 9.5j = **33.5j**
- **Total dette** : ~70.5j + 40j = **~110.5j-homme** sur 15 features auditées

---

# Vague 7 — CMS push · Refresh pipeline · Analytics ingest · Copilot skills récents

**4 features · 49 findings · ~59j-homme**

## Feature 1 — CMS push multi-plateformes (findings #187-#195)

## #187 · P1 · 2j — SSRF sur `site_url` dans cms-register-api-key
Valider hostname contre denylist RFC-1918 + vérifier correspondance domaine `tracked_site` prouvé.

## #188 · P1 · 1j — SSRF sur `target_url` dans cms-patch-content (avec redirect: follow)
Denylist IP privées + `redirect: 'error'` + assertion domaine == tracked_site.

## #189 · P1 · 2j — api_key / oauth_tokens stockés en clair dans cms_connections
Chiffrer via `pgsodium.crypto_aead_det_encrypt` ou Supabase Vault ; prévoir migration rétro-chiffrement.

## #190 · P1 · 1j — XSS stocké : sortie `marked` sans sanitisation dans dictadevi-actions
Passer la sortie de `marked` à `DOMPurify` (linkedom) ou `rehype-sanitize` avec allowlist stricte.

## #191 · P1 · 1j — cms_page_content en lecture publique totale (USING true)
Remplacer par `auth.uid() = user_id` ou ajouter `is_public boolean default false` scopé.

## #192 · P2 · 1j — Absence de rate-limit sur cms-register-api-key
Sliding window 10 req/min/user via Upstash Redis ou compteur base `(user_id, last_probe_at)`.

## #193 · P2 · 0.5j — Credentials CMS persistés en clair dans localStorage
Ne stocker qu'un booléen `credsSaved` ; passer à `sessionStorage` si persistance requise.

## #194 · P2 · 1j — `corrective_script` non échappé dans le plugin PHP
Signer via HMAC-SHA256 côté Crawlers et vérifier signature côté plugin avant `echo` ; afficher hash dans UI.

## #195 · P3 · 1j — Prolifération de `any` dans cmsContentScanner.ts
Déclarer interfaces `WpPostRaw`, `ShopifyArticleRaw`, `DictadeviPostRaw` + try/catch par plateforme.

---

## Feature 2 — Refresh / Update pipeline (findings #200-#209)

## #200 · P1 · 1j — Coût LLM invisible : 5/6 skills refresh hors aiGatewayFetch
Wrapper `editorial-pipeline-run` + `trackPaidApiCall` sur SerpAPI dans update-claims-audit.

## #201 · P1 · 1j — Orchestration 100% séquentielle : claims/topic_gaps/mentions parallélisables
Créer `update-orchestrate` exécutant les 3 skills en `Promise.all` après `extracted`.

## #202 · P1 · 2j — Anti-hallucination gates absents avant cms-patch-content
Bloquer draft-consolidate si `claims.contradicted > 0` (HTTP 412) + appeler `diagnose-hallucination` avant publish.

## #203 · P2 · 0.5j — update-extract-content : monolithe standalone hors updatePipelineGuards
Remplacer 60 lignes inline par `import { authAndGate }` + test unitaire d'égalité `PREMIUM_PLANS`.

## #204 · P2 · 1j — update-market-trends : données de marché simulées en production
Ajouter `data_source: 'simulated'` + bannière UI jusqu'à intégration SimilarWeb/StatCounter.

## #205 · P2 · 0.5j — patch_effectiveness : GRANT admin-only, inaccessible au pipeline
Ajouter `user_id UUID` + policy INSERT `user_id = auth.uid() OR admin`.

## #206 · P2 · 0.5j — content_monitor_log : policy INSERT absente pour authenticated
`CREATE POLICY "Users insert own monitor logs" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())`.

## #207 · P2 · 1j — cms-patch-content : accumulation timeouts CMS, garde 60s manquante
AbortController global 55s + persistance `in_progress` dans content_monitor_log pour reprise idempotente.

## #208 · P3 · 0.5j — update-guidance : slug `google/gemini-3-flash-preview` inexistant
Corriger en `google/gemini-flash-1.5` + fallback `openai/gpt-4o-mini`.

## #209 · P3 · 0.5j — update_artifacts : expires_at non enforced, aucune purge
`cron.schedule` weekly DELETE + tâche `purge_expired_artifacts` fallback.

---

## Feature 3 — Analytics ingest GA4/GSC/BigQuery (findings #216-#230)

## #216 · P0 · 0.5j — Cron-mode `body.all=true` non restreint au service-role
Ajouter `if (body.all && !auth.isAdmin) return 403` dans fetch-gsc-daily — sinon n'importe quel user drainne les quotas GSC globaux.

## #217 · P1 · 0.5j — Credentials OAuth divergents dans fetch-gsc-daily
Unifier sur `GOOGLE_GSC_CLIENT_ID/SECRET` ou déléguer à `ensureFreshToken` de resolveGoogleToken.

## #218 · P1 · 1j — Circuit breaker global (pas par connexion utilisateur)
Convertir en `Map<connectionId, CircuitState>` ; ne pas décompter 400/401 dans le compteur.

## #219 · P1 · 0.5j — State OAuth sans nonce CSRF — IDOR sur callback
Nonce cryptographique serveur + table `oauth_states` avec TTL 10min ; valider avant traitement token.

## #220 · P1 · 0.5j — profiles.gsc_refresh_token non révoqué au niveau colonne
`REVOKE SELECT (gsc_access_token, gsc_refresh_token) ON profiles FROM authenticated, anon` + déprécier legacy path.

## #221 · P1 · 1j — Zéro gestion 429/quota dans fetch-gsc-daily
Backoff exponentiel + respect `Retry-After` + compteur quota KV partagé + `trackEdgeFunctionError`.

## #222 · P2 · 1j — Coûts BigQuery non tracés dans ai_gateway_usage
`trackPaidApiCall('gsc-bigquery-query', 'bigquery', kind, bytes_processed)` + colonne `bytes_billed`.

## #223 · P2 · 0.5j — gsc_bigquery_cache lu en service_role — isolation dégradée
Ajouter `user_id` dans clé lookup ou passer par userClient (RLS enforce ownership).

## #224 · P2 · 0.5j — Disconnect Ads révoque tous les scopes OAuth sans avertissement
Révoquer `refresh_token` (plus définitif) + modale d'avertissement UI + re-check GSC/GA4.

## #225 · P2 · 1j — First GA4 pull : N fetches fire-and-forget sans throttle
Sérialiser avec délai 200ms inter-requêtes ; limiter à 5 sites max ; ou déléguer à pg_cron queue.

## #226 · P2 · 1j — autoLinkConnection : appel GSC live à chaque resolve manqué
Restreindre à one-shot post-OAuth + flag `link_attempted_at` sur tracked_sites (cooldown 24h).

## #227 · P3 · 0.5j — ga4_traffic_sources_cache : user_id absent de la clé unique
Ajouter `user_id` à UNIQUE constraint et clause `onConflict` de l'upsert.

## #228 · P2 · 0.5j — google_ads_history_log : INSERT policy ouverte aux clients
Remplacer `TO authenticated` par `TO service_role` ; auditer toutes les tables `*_history_log`.

## #229 · P1 · 2j — refresh_token stocké en clair — pas de chiffrement applicatif
Chiffrer via `pgsodium` / Supabase Vault ; stocker UUID secret, déchiffrer edge-side seulement.

## #230 · P3 · 0.5j — resolveGoogleToken : SELECT * ramène tous les tokens en mémoire
Remplacer par colonnes explicites ; après #229, ne sélectionner que UUID Vault.

---

## Feature 4 — Copilot skills récents (findings #231-#245)

## #231 · P1 · 3j — DataForSEO + SerpAPI appelés directement hors gateway
Router via edge `data-router` avec AbortController + compteur dépense journalière ; migrer credentials vers Vault.

## #232 · P2 · 5j — Absence totale de cache SERP (serpapi_cache non implémenté)
Créer table `serpapi_cache (query_hash, source, results, expires_at)` + lookup avant appel (TTL 4h SERP, 24h Places).

## #233 · P1 · 2j — Race condition TOCTOU sur quota Pro live_search (20/jour)
RPC atomique `increment_and_check_quota(user_id, event_type, limit, window)` avant appel API, pas après.

## #234 · P2 · 2j — bumpSessionCounter non-atomique (Free/Premium)
RPC `increment_session_counter` avec `jsonb_set` atomique ; supprimer read-modify-write TypeScript.

## #235 · P2 · 1j — market_diagnosis_page_targeting_v2 absent du registry comme skill autonome
Extraire `fetchPageSignals` + `decidePageVerdict` en SkillDefinition dédié + entrée dans skillPolicies.

## #236 · P3 · 1j — Axe H hardcodé à 50, pondération nulle dans tous les profils
Affecter H à signal réel (schema_org, canonical) OU supprimer axe et documenter matrice 7×8.

## #237 · P2 · 1j — Lookup tracked_site dans market_diagnosis via ilike ambigu
Remplacer par `.eq('domain', domain)` strict + fallback ilike uniquement si null.

## #238 · P2 · 3j — Numéro téléphone stocké en clair dans sav_conversations (RGPD)
Chiffrer via `pgp_sym_encrypt` + trigger d'effacement post `phone_callback_expires_at`.

## #239 · P1 · 2j — Race condition TOCTOU identique sur quota Pro market_diagnosis
Même RPC atomique que #233 avec `event_type = 'copilot_market_diagnosis'` avant les 4 appels DFS.

## #240 · P3 · 1j — Plan 'starter' non géré dans les fonctions quota
Cas explicite `plan === 'starter'` OU commentaire assertant `starter === free` intentionnel.

## #241 · P2 · 3j — Aucun timeout sur les 4 appels DFS parallèles dans market_diagnosis
Wrapper `dfsPost` avec Promise.race timeout 8s + Promise.race global 25s + log timeout dans copilot_actions.

## #242 · P3 · 2j — escalate_to_phone sans deduplication inter-sessions
Check `phone_callback` actif existant avant INSERT + index `(user_id, phone_callback_expires_at)`.

## #243 · P2 · 2j — Workbench insert sans contrainte d'unicité (doublons verdicts)
UNIQUE `(user_id, domain, target_url, source_function)` + `ON CONFLICT DO UPDATE`.

## #244 · P2 · 1j — Fenêtre quota 24h calculée côté TypeScript (drift horloge)
Déplacer calcul `now() - interval '24 hours'` dans RPC Postgres du #233/#239.

## #245 · P3 · 1j — Personas : market_diagnosis_page_targeting_v2 absent des skillPolicies
Après #235, ajouter explicitement dans skillPolicies + documenter défaut fermé.

---

# Résumé Vague 7

- **P0** : 0.5j (#216 — 1 item)
- **P1** : 22j (#187, #188, #189, #190, #191, #200, #201, #202, #217, #218, #219, #220, #221, #229, #231, #233, #239 — 17 items)
- **P2** : 27.5j (#192, #193, #194, #203, #204, #205, #206, #207, #222, #223, #224, #225, #226, #228, #232, #234, #235, #237, #238, #241, #243, #244 — 22 items)
- **P3** : 9j (#195, #208, #209, #227, #230, #236, #240, #242, #245 — 9 items)
- **Total Vague 7** : **~59j** sur 49 findings (4 features)

## Top 5 urgences Vague 7
1. **#216 (0.5j)** — Cron-mode `all=true` accessible à tout user authentifié (drain quotas GSC globaux).
2. **#189 + #229 (4j)** — Tokens (CMS + Google refresh) stockés en clair : blast radius maximum en cas de dump DB.
3. **#187 + #188 (3j)** — Double SSRF (cms-register-api-key + cms-patch-content) exploitable par user authentifié.
4. **#233 + #239 (4j)** — TOCTOU quotas Pro live_search + market_diagnosis (dépassement coût mesurable).
5. **#190 + #191 (2j)** — XSS stocké dictadevi (Markdown non sanitisé) + cms_page_content lecture publique totale (exfiltration corpus).

## Cumul projet (Vagues 1 → 7)
- **Features auditées** : **20** (16 précédentes + 4 Vague 7)
- **P0 cumulé** : 33.5j + 0.5j = **34j**
- **Total dette** : ~110.5j + 59j = **~169.5j-homme** sur 20 features

