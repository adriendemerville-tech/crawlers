# Copilot Orchestrator — Architecture Backend & Frontend

> Documentation technique exhaustive du système Copilot unifié (Félix SAV + Stratège Cocoon).
> Édition : Sprint **P2** — Avril 2026 (post-hardening RLS / status / parité front).

---

## 1. Vue d'ensemble

Le **Copilot Orchestrator** est l'unique backend conversationnel de Crawlers. Il sert simultanément deux personas :

| Persona | Rôle | Modèle LLM | Max tokens | Skills exposés |
|---|---|---|---|---|
| **Félix** | Agent SAV (support client conversationnel, lecture, navigation) | `google/gemini-2.5-flash` | 800 | Lecture audits, KPIs, profile, doc, navigation, ouverture panels |
| **Stratège** | Copilote stratégique Cocoon (analyse + actions CMS sous approbation) | `google/gemini-2.5-pro` | 1500 | Toutes skills Félix + lecture cocoon graph, keyword universe, écriture CMS, déploiement plans cocoon |

Principe architectural : **1 backend, N personas.** L'identité (system prompt, modèle, tokens, policies) est définie dans `personas.ts`. Les capacités (tools/skills) sont définies dans `skills/registry.ts`. L'orchestration (agent loop, persistance, sécurité) vit dans `index.ts`. Helpers communs (safeServiceCall, status flag) dans `helpers.ts`.

L'ancien backend `sav-agent` est **legacy depuis Sprint 6** et n'est plus appelé par le frontend Félix v2 ni par CocoonAIChatUnified.

---

## 2. Backend — `supabase/functions/copilot-orchestrator/`

### 2.1 Structure réelle

```
copilot-orchestrator/
├── index.ts          # Agent loop, JWT, persistance, dispatch skills (~900 lignes)
├── personas.ts       # FELIX_CONFIG / STRATEGIST_CONFIG (95 lignes)
├── helpers.ts        # safeServiceCall, status flag/reconciliation (109 lignes)
└── skills/
    └── registry.ts   # 9 skills publiques + handlers (~525 lignes)
```

### 2.2 `personas.ts` — Configuration des Personas

```ts
export type PersonaId = 'felix' | 'strategist';
export type SkillPolicy = 'auto' | 'approval' | 'forbidden';

export interface PersonaConfig {
  id: PersonaId;
  displayName: string;
  systemPrompt: string;       // depuis _shared/agentPersonas.ts
  model: string;
  maxOutputTokens: number;
  skillPolicies: Record<string, SkillPolicy>;
  defaultSkillPolicy: SkillPolicy; // 'forbidden' par défaut
}
```

**Félix** (SAV)
- `model: 'google/gemini-2.5-flash'`, `maxOutputTokens: 800`
- Auto : `read_audit`, `read_site_kpis`, `read_user_profile`, `read_documentation`, `navigate_to`, `open_audit_panel`
- Approval : `trigger_audit`, `refresh_kpis`
- Forbidden : `cms_publish_draft`, `cms_patch_content`
- `defaultSkillPolicy: 'forbidden'` — toute skill non listée est bloquée

**Stratège** (Cocoon)
- `model: 'google/gemini-2.5-pro'`, `maxOutputTokens: 1500`
- Auto : `read_audit`, `read_site_kpis`, `read_cocoon_graph`, `read_keyword_universe`, `read_documentation`, `analyze_cocoon`, `plan_editorial`, `navigate_to`, `open_audit_panel`
- Approval : `trigger_audit`, `cms_publish_draft`, `cms_patch_content`, `deploy_cocoon_plan`
- Forbidden : tout le reste (default)

**Mode créateur** (admin uniquement) — préfixes `/creator :`, `/cto :`, `/seo :`, `/ux :`
- Vérification `has_role(user_id, 'admin')` côté serveur (403 sinon)
- Override : toutes les policies passent en `auto`, toutes les skills exposées
- Bannière injectée dans le system prompt

### 2.3 `skills/registry.ts` — Tools

Skills réellement présentes dans le registry :

| Skill | Catégorie | Client | Notes |
|---|---|---|---|
| `read_audit` | Lecture audits | userClient (RLS) | Lit Expert/Stratégique/EEAT/Matrice via `raw_payload` |
| `read_site_kpis` | Lecture KPIs | userClient | Agrège SEO/GEO/EEAT scores |
| `read_cocoon_graph` | Lecture cocoon | userClient | Stratège uniquement |
| `read_documentation` | RAG docs | service (lecture publique) | Vector search sur knowledge/ |
| `navigate_to` | Frontend hint | aucun | Renvoie un `path`, le front exécute `useNavigate` |
| `open_audit_panel` | Frontend hint | aucun | |
| `trigger_audit` | Action | service + ownership check | Approval pour Félix et Stratège |
| `cms_publish_draft` | Écriture CMS | service via `safeServiceCall` | Stratège uniquement, approval |
| `cms_patch_content` | Écriture CMS | service via `safeServiceCall` | Stratège uniquement, approval |

> **Manquantes** par rapport à la doc Sprint 12 antérieure : `read_strategic_audit`, `read_eeat_audit`, `read_matrix_audit` (consolidées dans `read_audit`), `read_cms_pages`, `cms_create_draft`, `cocoon_modify`, `cocoon_add_link`, `cocoon_remove_link`, `escalate_to_human`, `create_support_ticket`, `agent_dispatch_*`.

### 2.4 `helpers.ts` — Hardening P0

- **`safeServiceCall`** : wrapper anti-bypass RLS. Toute écriture utilisant le service role doit passer par lui pour vérifier l'ownership (`owns_tracked_site`) avant l'opération. En cas d'échec, log dans `copilot_actions` avec `skill='_security_violation'`.
- **Status flag `processing`** : dès qu'une session entre dans la boucle agent, `copilot_sessions.status = 'processing'`. Reconciliation automatique après **90 s** d'inactivité (timer + cron) → status remis à `'idle'` pour éviter les sessions verrouillées.

### 2.5 `index.ts` — Agent Loop

Responsabilités :

1. CORS + handling `OPTIONS`.
2. Validation JWT côté serveur (`auth.getUser(token)`) → 401 si invalide.
3. Chargement / création de la `copilot_sessions` (par `session_id`).
4. **Status flag** → `processing` (P0).
5. Reconstruction historique : 20 derniers messages depuis `copilot_actions`.
6. Détection mode créateur (admin uniquement, voir §2.2).
7. Boucle agent (max **6 itérations**) :
   - Appel Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
   - Parse `text` ou `tool_calls`
   - Pour chaque tool_call : check policy → `auto` exécute, `approval` persiste et break, `forbidden` rejette
   - Toutes les écritures passent par `safeServiceCall`
8. Persistance finale : `_assistant_reply` dans `copilot_actions`.
9. Calcul coûts → `agent_token_costs`.
10. Status → `idle`. Réponse JSON `{ session_id, reply, actions[], awaiting_approvals[], persona, iterations }`.

**Approvals (P1 #6/#7)** :
- `approve_action_id` dans le body → ré-appel du handler + LLM contextualise le résultat dans `reply`
- `reject_action_id` + `reject_reason` → marquage `rejected` + LLM contextualise

**Erreurs** : 429 retry exponentiel ×3 (1s/2s/4s), 402 message explicite, timeout 60 s, fallback message + log.

---

## 3. Persistance — Tables Supabase

### 3.1 `copilot_sessions`

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | |
| `persona` | text | `felix` ou `strategist` |
| `tracked_site_id` | uuid FK nullable | Site contextuel |
| `context` | jsonb | État libre |
| **`status`** | text | `idle` / `processing` (P0) — reconciled à 90 s |
| `created_at` / `updated_at` | timestamptz | |

RLS : SELECT/INSERT/UPDATE limités à `user_id = auth.uid()`.

### 3.2 `copilot_actions` (audit trail append-only)

Colonnes : `id`, `session_id`, `user_id`, `role` (`user`/`assistant`/`tool` + virtuels `_user_message`/`_assistant_reply`), `content`, `skill_name`, `skill_args`, `skill_result`, `status` (`executed`/`pending_approval`/`approved`/`rejected`/`failed`/`_security_violation`), `error_message`, `tokens_input`, `tokens_output`, `model_used`, `creator_mode`, `created_at`.

RLS : SELECT seulement (user_id = auth.uid()). **Pas de UPDATE/DELETE** → audit immuable.

Cron `copilot-purge-actions-daily` : purge > 90 j (CRON_SECRET requis).

### 3.3 `agent_token_costs`

Suit la consommation Gateway par utilisateur/persona. Permet le plafond partagé Supervisor/CTO (€1.00/jour).

---

## 4. Frontend — État réel

### 4.1 Hook `useCopilot` (`src/hooks/useCopilot.ts`, 274 lignes)

Maintien de l'état local : `sessionId`, `messages[]`, `sending`, `error`. Pas de persistance localStorage : l'historique vit côté backend.

API :

```ts
const {
  sessionId,
  messages,
  sending,
  error,
  sendMessage,    // (text) => Promise<void>
  approve,        // (actionId) => Promise<void>
  reject,         // (actionId, reason?) => Promise<void>
  reset,          // () => void  — efface session locale + repart à 0
} = useCopilot({
  persona,
  getContext,         // () => Record<string, unknown>  — contexte injecté à chaque envoi
  initialSessionId,   // pour reprendre une conversation
  onActions,          // (actions) => void  — pour exécuter navigate_to côté UI
  onAssistantReply,   // (reply, ctx) => void  — sauvegarde recos / analytics
  seedMessages,       // CopilotMessage[]  — onboarding/greeting injecté à l'init
});
```

> **Manquant vs doc Sprint 12** : pas de `loadHistory(sessionId)`, pas de subscription realtime sur `copilot_actions` (streaming long-running non implémenté côté front). La reprise de session se fait uniquement via `initialSessionId`.

### 4.2 Composant `AgentChatShell` (`src/components/Copilot/AgentChatShell.tsx`, 276 lignes)

Wrapper UI réutilisable, partagé par Félix et Stratège.

Features réellement présentes :
- Rendu Markdown via `react-markdown` (sans `remark-gfm` — tables markdown non rendues correctement)
- Bordures différenciées : user → `border-primary` (violet), assistant → `border-accent/60` (or)
- Affichage actions inline avec badge statut (`success`, `error`, `rejected`, `awaiting_approval`)
- **Approval inline** : carte avec `JSON.stringify(input)` + boutons Valider / Refuser
- **Auto-navigation** via `onActions` → `useNavigate(path)` quand `navigate_to` succeeds
- Composer textarea + bouton Envoyer (Entrée envoie, Maj+Entrée nouvelle ligne)
- **Slot `renderComposerExtras`** : injection custom (micro, bug report) — utilisé par Félix
- Bouton "Nouvelle" en header → `reset()`
- Starter prompts cliquables au démarrage

> **Manquant vs doc Sprint 12** : pas de bannière violette mode créateur (la détection est purement serveur), pas de scroll-to-action explicite, pas de raccourci Cmd+Enter (Enter direct).

### 4.3 Intégrations spécifiques — surface, composant, persona

| Surface | Composant | Persona | Particularités |
|---|---|---|---|
| Bulle SAV globale | `Support/ChatWindowUnified.tsx` (510 l) | `felix` | Onboarding, mute, dock, bug report, quiz SEO/Crawlers/Enterprise, voice input, screen context |
| Cocoon | `Cocoon/CocoonAIChatUnified.tsx` (318 l) | `strategist` | Node picking, dock, recalcul graphe, auto-save recos |
| Démo `/app/copilot` | `pages/CopilotPage.tsx` | both (tabs) | Aucune surcouche métier |

### 4.4 Ancrage (docked) via `AISidebarContext`

`src/contexts/AISidebarContext.tsx` expose `felixExpanded` / `cocoonExpanded` (booleans + setters). Quand l'utilisateur clique le bouton « ancrer en colonne pleine hauteur » :
- Félix : `width: 24rem`, ancré à droite, `localStorage.felix_sidebar_expanded='1'` (lu par `FloatingChatBubble` pour masquer la bulle)
- Stratège : `width: 28rem`, ancré à gauche
- `AISidebarPageWrapper` consomme le contexte pour ajuster le padding du contenu principal
- Démontage du composant → reset automatique de l'expanded (pas de padding fantôme)

---

## 5. Sécurité

1. **JWT obligatoire** côté serveur (pas de mode anonyme).
2. **Multi-tenant strict** via `userClient` (RLS auto) ; toute écriture service passe par `safeServiceCall` (P0).
3. **Mode créateur gated** par `has_role(_, 'admin')`.
4. **Audit trail immuable** : pas de policies UPDATE/DELETE sur `copilot_actions`.
5. **Plafond LLM** €1.00/jour partagé Supervisor/CTO.
6. **Validation arguments** : Zod sur chaque skill ; échec → 400 vers le LLM.
7. **Rate limiting** : 30 messages/min par user (`check_rate_limit('copilot_message')`).
8. **Status reconciliation 90 s** (P0) : pas de session verrouillée éternellement.

---

## 6. Cycle de vie d'un message

```
[User] → AgentChatShell.submitDraft
  → useCopilot.sendMessage (placeholder pending=true)
    → supabase.functions.invoke('copilot-orchestrator', { persona, session_id, message, context })
      → index.ts
         1. CORS + JWT
         2. Load/create session, status='processing'
         3. Detect creator mode
         4. Build messages[] (system + 20 last + user)
         5. Loop max 6:
            a. Gateway call (model from persona)
            b. Parse: text only → done
            c. tool_calls → for each: check policy, exec via safeServiceCall, persist
         6. Persist _assistant_reply, costs
         7. status='idle'
      ← { reply, actions[], awaiting_approvals[] }
    ← setState (replace placeholder)
  → onActions: if navigate_to.success → useNavigate(path)
  → onAssistantReply: saving recos / bug report / analytics
```

---

## 7. Fichiers clés

| Fichier | Rôle |
|---|---|
| `supabase/functions/copilot-orchestrator/index.ts` | Agent loop |
| `supabase/functions/copilot-orchestrator/personas.ts` | Config personas |
| `supabase/functions/copilot-orchestrator/helpers.ts` | safeServiceCall + status |
| `supabase/functions/copilot-orchestrator/skills/registry.ts` | Skills + handlers |
| `supabase/functions/copilot-purge-actions/index.ts` | Cron purge 90j |
| `src/hooks/useCopilot.ts` | Hook React |
| `src/components/Copilot/AgentChatShell.tsx` | UI partagée |
| `src/components/Support/ChatWindowUnified.tsx` | Intégration Félix |
| `src/components/Cocoon/CocoonAIChatUnified.tsx` | Intégration Stratège |
| `src/contexts/AISidebarContext.tsx` | État dock global |

---

## 8. Sprint log (ce qui a vraiment été livré)

- **Sprint 6** : Backend `copilot-orchestrator` go-live, Félix bascule dessus.
- **Sprint 7** : `CocoonAIChatUnified` + persona `strategist`.
- **Sprint 8** : Auto-save recos cocoon (parité legacy).
- **Sprint 9** : Quiz SEO/Crawlers + Enterprise + suppression `ChatWindow` legacy.
- **P0** : `safeServiceCall` (anti-bypass RLS), status flag `processing` + reconciliation 90 s.
- **P1** : approve/reject avec reply LLM contextualisé (#6 #7), helpers consolidés.
- **P2** : ancrage docked via `AISidebarContext` (Félix droite 24 rem, Stratège gauche 28 rem), bordures différenciées user/assistant, dock reset automatique au démontage, miroir `felix_sidebar_expanded` pour `FloatingChatBubble`.

## 9. Dette identifiée (avril 2026)

Voir `knowledge/features/support/copilot-front-parity-audit-fr.md` pour le détail. Synthèse :
- Composants legacy `ChatAttachmentPicker` et `ChatReportSearch` présents mais non utilisés par la version v2 de Félix → **fonction « pièces jointes »** disparue.
- **Historique des conversations** Félix (`felix_conversations_archive` localStorage, panneau overlay) non réimplémenté.
- **Live Search** (DataForSEO/SerpAPI/Places) non porté côté `copilot-orchestrator` (skill manquante).
- **Workflow post-audit guidé** (résumé sentiment + boutons priorité) non porté.
- **Screen context** (`utils/screenContext.ts` toujours présent) non envoyé à `copilot-orchestrator`.
- **Phone callback escalation** + **scoring `sav_quality_scores`** : tables et purge cron toujours actives mais aucun écrit côté nouveau backend.
- **Realtime streaming** des actions long-running annoncé en Sprint 12 → non implémenté.

---

*Document maintenu par l'équipe technique Crawlers. Dernière mise à jour : Sprint P2.*
