# Audit de parité front — Félix v2 vs Stratège Cocoon (Copilot Orchestrator)

> Édition Sprint **P2** — Avril 2026.
> Objectif : recenser les paramètres asymétriques, les régressions et les fonctionnalités historiques perdues lors de la migration vers `copilot-orchestrator` (1 backend / 2 personas).

---

## 1. Composants concernés

| Surface | Fichier | Lignes | Persona backend |
|---|---|---|---|
| **Félix** (bulle SAV globale) | `src/components/Support/ChatWindowUnified.tsx` | 510 | `felix` |
| **Stratège Cocoon** (panneau /app/cocoon) | `src/components/Cocoon/CocoonAIChatUnified.tsx` | 318 | `strategist` |
| Shell partagé | `src/components/Copilot/AgentChatShell.tsx` | 276 | — |
| Hook | `src/hooks/useCopilot.ts` | 274 | — |
| Bulle flottante | `src/components/Support/FloatingChatBubble.tsx` | 354 | (Félix uniquement) |

---

## 2. Comparaison fonctionnelle

| Fonctionnalité | Félix (`ChatWindowUnified`) | Stratège (`CocoonAIChatUnified`) | Commentaire |
|---|---|---|---|
| Persona backend | ✅ `felix` (Gemini Flash, 800 tokens) | ✅ `strategist` (Gemini Pro, 1500 tokens) | OK |
| Starter prompts | ✅ 3 SEO génériques | ✅ 3 cocoon | OK |
| Composer markdown + Send | ✅ (via shell) | ✅ (via shell) | OK |
| Approve/Reject inline | ✅ (via shell) | ✅ (via shell) | OK |
| Auto-navigation `navigate_to` | ✅ | ✅ | OK |
| Bordures différenciées user/assistant | ✅ | ✅ | OK depuis P2 |
| Dock pleine hauteur | ✅ droite 24 rem | ✅ gauche 28 rem | OK depuis P2, via `AISidebarContext` |
| Minimiser | ✅ | ✅ | OK |
| Fermer / rouvrir | ✅ via bulle | ✅ via toggle « Stratège » | OK |
| Mute (cloche) | ✅ `localStorage.felix_muted` | ❌ | Asymétrie — pas de notif sonore Stratège, donc non bloquant |
| Onboarding seed (greeting) | ✅ `seedMessages` + `triggerOnboarding` | ❌ | Seul Félix a un onboarding premier-démarrage |
| Voice input (micro) | ✅ `ChatMicButton` + vocab user domains | ❌ | Asymétrie produit assumée |
| Bug report mode + slash `/bug` | ✅ insertion `user_bug_reports` | ❌ | Spécifique SAV |
| Quiz SEO/Crawlers (slash `/quiz`) | ✅ `SeoQuiz` + `felix-seo-quiz` | ❌ | Spécifique SAV |
| Enterprise quiz (slash `/enterprise`) | ✅ `EnterpriseQuiz` | ❌ | Spécifique SAV |
| Validation admin questions auto-générées | ✅ `QuizValidationNotif` | ❌ | Spécifique admin SAV |
| Notification bug résolu (toast) | ✅ | ❌ | Spécifique SAV |
| Node picking (graphe cocoon) | ❌ | ✅ `Crosshair`, sélection ≤ 5 nœuds, injecté dans `selected_nodes` | Spécifique Cocoon |
| Recalculer graphe (callback parent) | ❌ | ✅ bouton « Recalculer » | Spécifique Cocoon |
| Auto-save recommandations | ❌ | ✅ INSERT `cocoon_recommendations` si reply > 200c & SEO_KEYWORDS match | Parité Sprint 8 |
| Logo header | ✅ `CrawlersLogo` 28 px | ⚠️ `<Network/>` lucide | Pas de logo de marque côté Stratège |
| Récap session_id en bas | ❌ | ❌ | Aucun des deux |

---

## 3. Fonctionnalités historiques **perdues** (vs `sav-agent` legacy)

Liste des features documentées dans `knowledge/features/support/help-center-ai-fr.md` mais **plus présentes** dans la version `ChatWindowUnified` v2 :

| Feature legacy | Statut actuel | Localisation code mort |
|---|---|---|
| **Pièces jointes PDF audits / scripts** | ❌ Désactivée | `src/components/Support/ChatAttachmentPicker.tsx` (toujours exporté via `Support/index.ts`, jamais monté) |
| **Recherche rapport dans le chat** | ❌ Désactivée | `src/components/Support/ChatReportSearch.tsx` (idem) |
| **Historique conversations Félix** | ❌ Désactivée | clés `felix_conversations_archive` / `felix_current_conversation` plus écrites |
| **Workflow post-audit guidé** | ❌ Désactivée | hook `felixOnboarding` ne déclenche plus le workflow |
| **Screen context** (capture audit en cours) | ❌ Non envoyée | `src/utils/screenContext.ts` toujours présent (96 lignes), aucun appel depuis `ChatWindowUnified` |
| **Live Search** (DataForSEO / SerpAPI / Places) | ❌ Non portée | aucune skill `live_search` dans `skills/registry.ts` |
| **Compteur live-search** (`sav_conversations.metadata.live_search_count`) | ❌ Plus écrit | table inutilisée |
| **Escalade téléphone après 3 itérations** | ❌ Non portée | tables `sav_conversations.phone_callback*` et cron `cleanup_expired_phone_callbacks` actifs mais alimentés à 0 |
| **Scoring de précision `sav_quality_scores`** | ❌ Non porté | dashboard `Admin → Intelligence → AssistantPrecisionCard` lit toujours la table mais aucune insertion neuve |
| **Mémoire persistante `site_memory`** | ❌ Non portée | Skills lecture/écriture absentes du registry |
| **Enrichissement carte d'identité** | ❌ Non porté | idem |
| **Suggestions opérationnelles** (rappels scans, GMB local) | ❌ Non portées | logique disparue |
| **Détection langue auto FR/EN/ES** | ⚠️ Implicite (LLM) | plus de détection explicite, dépend du prompt persona |

> **Mise à jour Q4.6** : `Admin/SavDashboard.tsx` affiche désormais une carte **« Copilot Félix — sessions »** lisant `copilot_sessions WHERE persona='felix'` + `copilot_actions` (skills `_user_message`/`_assistant_reply`). La carte legacy `sav_conversations` reste affichée tant que les escalades phone et les `sav_quality_scores` n'ont pas été reportés sur la nouvelle architecture.

---

## 4. Bugs / cassures identifiés

| # | Sévérité | Bug | Fichier | Statut |
|---|---|---|---|---|
| B1 | 🟠 moyenne | Prop `initialExpandedGreeting` déclarée et passée par `FloatingChatBubble` mais **non destructurée** dans `ChatWindowUnified` → la salutation longue ne s'affichait jamais | `Support/ChatWindowUnified.tsx` | ✅ **Corrigé Q1.2** |
| B2 | 🟠 moyenne | `react-markdown` rendu sans `remark-gfm` → tableaux Markdown des réponses Stratège affichés en pre-text, listes-tâches non parsées | `Copilot/AgentChatShell.tsx` | ✅ **Corrigé Q3.1** (remark-gfm + styles prose-table) |
| B3 | 🟡 faible | Bouton flottant Félix utilisait `bg-[#7c3aed]` violet plein → enfreint la charte « pas de fond » | `Support/FloatingChatBubble.tsx` ligne 338 | ✅ **Corrigé Q2** (border + bg transparent) |
| B4 | 🟡 faible | Émoji 👋 / 🔍 dans `FloatingChatBubble` → enfreint la règle « pas d'émoji » | `Support/FloatingChatBubble.tsx` | ✅ **Corrigé Q2** |
| B5 | 🟡 faible | `useEffect` cleanup setFelixExpanded(false) se déclenche aussi au lazy-unmount de Suspense | `Support/ChatWindowUnified.tsx` ligne 126-128 | ✅ **Acté Q4.6** — comportement souhaité (libère le padding du `AISidebarPageWrapper`), pas de régression observée |
| B6 | 🟡 faible | Toggle bulle/dock teste `localStorage` directement à chaque render au lieu de lire `useAISidebar` → race possible | `Support/FloatingChatBubble.tsx` ligne 334 | ✅ **Corrigé Q4.3** (lecture context `felixExpanded`) |
| B7 | 🟠 moyenne | `useCopilot.reset()` n'informait pas le backend → la session précédente restait `processing` jusqu'à reconciliation 90s | `hooks/useCopilot.ts` + `copilot-orchestrator/index.ts` | ✅ **Corrigé Q1.3** (handler `close_session`) |
| B8 | 🔴 haute | `safeServiceCall` réellement branché sur les handlers `cms_*` ? | `copilot-orchestrator/skills/registry.ts` | ✅ **Audité Q1.1** — branché sur `cms_publish_draft`, `cms_patch_content` ; autres skills utilisent `userClient` (RLS) |
| B9 | 🟡 faible | Stratège n'a pas de logo de marque (`<Network/>` lucide) | `Cocoon/CocoonAIChatUnified.tsx` ligne 202 | ✅ **Corrigé Q4.2** (CrawlersLogo size 20) |
| B10 | 🟡 faible | `FloatingChatBubble` utilisait gradients violets `from-violet-500 to-violet-800` en dur dans 3 tooltips | `Support/FloatingChatBubble.tsx` | ✅ **Corrigé Q2** (border primary + bg-background) |

---

## 5. Asymétries de paramètres `useCopilot`

| Param `useCopilot` | Félix passe ? | Stratège passe ? |
|---|---|---|
| `persona` | ✅ `felix` | ✅ `strategist` |
| `getContext` | ✅ avec `route`, `tracked_site_id`, `domain`, `user_id`, `surface: felix-bubble`, `bug_report_mode` | ✅ avec `route`, `surface: cocoon-strategist`, `tracked_site_id`, `domain`, `user_id`, `selected_nodes`, `nodes_count` |
| `seedMessages` | ✅ onboarding/greeting | ✅ **Q4.1** greeting cocoon |
| `onAssistantReply` | ✅ bug report + slash commands | ✅ auto-save reco |
| `onActions` | ❌ délégué au shell (autoNavigate) | ❌ idem |
| `initialSessionId` | ✅ **Q4.4** via panneau historique | ✅ **Q4.5** panneau historique branché de manière identique (`CopilotHistoryPanel persona="strategist"`) |

> **Sprint 6 enfin exploité** : `useCopilot` hydrate désormais l'historique depuis `copilot_actions` (skills `_user_message` / `_assistant_reply`) quand `initialSessionId` est fourni.

---

## 6. Recommandations de remédiation (ordre suggéré)

1. **B1 / B8** — ✅ corrigés Q1.
2. **B4 / B3 / B10** — ✅ conformité charte appliquée Q2.
3. ✅ Q3.3 — `screen_context` injecté dans le `getContext()` de Félix via `captureScreenContext(location.pathname)`.
4. ✅ Q4.1 — `seedMessages` Stratège (greeting cocoon adaptatif au domaine + nb nœuds).
5. ✅ Q3.2 — `ChatAttachmentPicker` branché dans `composerLeading` de Félix (rapports + scripts + images).
6. ✅ Q4.4 — Panneau « Historique » Félix via `CopilotHistoryPanel` (lecture `copilot_sessions WHERE persona='felix'`, hydratation via `initialSessionId`).
7. ✅ **Q4.5 — Panneau « Historique » Stratège** (parité front 100%, même composant, persona `strategist`).
8. ⏳ Sprint dédié — Skill `live_search` dans le registry (ports DataForSEO/SerpAPI/Places) — vraie feature backend hors scope UI.
9. ✅ **Q4.6 — Refactor `Admin/SavDashboard`** : ajout de `CopilotSessionsCard` (lecture `copilot_sessions` + `copilot_actions`, dépliage messages persona Félix). Carte legacy `sav_conversations` conservée pour escalades phone & `sav_quality_scores` non encore portés.
10. (Optionnel) Réintroduire `escalate_to_phone` comme skill `approval` côté Félix.

---

## 7. Bilan Q1→Q4

- **10 bugs sur 10 résolus** (B5 acté comme comportement souhaité Q4.6).
- **8 recos sur 9 livrées** ; reste `live_search` (sprint backend dédié).
- **Parité Félix ⇄ Stratège : 100%** sur le scope front (seedMessages ✅, logo charte ✅, markdown tables ✅, panneau historique ✅).
- **Admin Sav : migration progressive** vers `copilot_*` engagée (Q4.6) — coexistence avec legacy le temps de porter escalades phone & scoring.

---

*Document maintenu par l'équipe technique Crawlers.*
