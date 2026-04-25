---
name: Copilot Orchestrator — Architecture Backend & Frontend
description: Documentation technique exhaustive de l'edge function `copilot-orchestrator` et de son intégration UI (Félix, Stratège Cocoon, mode créateur).
type: feature
---

# Copilot Orchestrator — Architecture détaillée

> Edge function unique servant **N personas** (Félix SAV, Stratège Cocoon, et tout futur agent) au-dessus d'un **registre central de skills** et d'une **boucle d'agent (tool calling)** branchée sur Lovable AI Gateway.

---

## 1. Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                             │
│                                                                        │
│  ChatWindowUnified (Félix)        CocoonAIChatUnified (Stratège)       │
│         │                                  │                           │
│         └──────────────┬───────────────────┘                           │
│                        ▼                                               │
│                AgentChatShell                                          │
│                 (UI + markdown)                                        │
│                        │                                               │
│                        ▼                                               │
│                useCopilot (hook)                                       │
│         sendMessage / approve / reset                                  │
│                        │                                               │
│                        ▼                                               │
│           supabase.functions.invoke('copilot-orchestrator')            │
└────────────────────────┼───────────────────────────────────────────────┘
                         │  Bearer JWT
                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTION: supabase/functions/copilot-orchestrator    │
│                                                                        │
│   index.ts ─────────► personas.ts ─────────► skills/registry.ts        │
│   (agent loop)        (config + policy)      (handlers + JSON Schema)  │
│        │                                              │                │
│        ▼                                              ▼                │
│   Lovable AI Gateway                         RLS userClient            │
│   (tool calling)                             service client            │
│        │                                              │                │
│        └──────────────┬───────────────────────────────┘                │
│                       ▼                                                │
│        Tables : copilot_sessions / copilot_actions                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend — `supabase/functions/copilot-orchestrator/`

### 2.1 Contrat HTTP

**Endpoint** : `POST /functions/v1/copilot-orchestrator`
**Auth** : Bearer JWT obligatoire (`getClaims` → `userId`)

**Body** :
```ts
{
  persona: 'felix' | 'strategist',   // requis
  session_id?: string,                // optionnel — sinon nouvelle session
  message?: string,                   // requis sauf si approve_action_id
  context?: Record<string, unknown>,  // injecté dans le system prompt
  approve_action_id?: string          // ré-exécute une action awaiting_approval
}
```

**Réponse** :
```ts
{
  session_id: string,
  reply: string,                       // texte markdown final
  actions: Array<{
    skill: string,
    status: 'success'|'error'|'rejected'|'awaiting_approval',
    output?: unknown, error?: string, action_id?: string
  }>,
  awaiting_approvals: Array<{ action_id, skill, input }>,
  persona: string,
  iterations: number
}
```

### 2.2 Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `index.ts` | Auth, routing approval/chat, agent loop, persistance, gestion mode créateur. |
| `personas.ts` | Map `id → PersonaConfig` (system prompt, modèle, `skillPolicies`, `defaultSkillPolicy`). |
| `skills/registry.ts` | Catalogue de skills (`SkillDefinition` = name + description + JSON Schema + handler). Helpers `getSkill`, `listSkills`, `buildToolDefinitions`. |

### 2.3 Personas (`personas.ts`)

Type clé :
```ts
type SkillPolicy = 'auto' | 'approval' | 'forbidden';
```

| Persona | `id` | Modèle | maxTokens | Particularités |
|---|---|---|---|---|
| **Félix** | `felix` | `google/gemini-2.5-flash` | 800 | Lecture/navigation auto · `trigger_audit` & `refresh_kpis` en `approval` · CMS `forbidden`. |
| **Stratège Cocoon** | `strategist` | `google/gemini-2.5-pro` | 1500 | Lecture étendue + `analyze_cocoon` / `plan_editorial` en `auto` · CMS publish/patch et `deploy_cocoon_plan` en `approval`. |

`defaultSkillPolicy` = `'forbidden'` pour les deux : **toute skill non listée est refusée par défaut** (sécurité par défaut).

System prompts : importés depuis `_shared/agentPersonas.ts` (`FELIX_PERSONA.styleGuide`, `STRATEGIST_PERSONA.styleGuide`) — source de vérité unique partagée avec les autres edge functions.

### 2.4 Registre des skills (`skills/registry.ts`)

Structure :
```ts
interface SkillDefinition {
  name: string;
  description: string;             // utilisée par le LLM pour décider quand appeler
  parameters: JSONSchema;          // validé par le LLM (tool calling)
  handler: (input, ctx) => Promise<{ ok, data?, error? }>;
}
interface SkillContext {
  userId, sessionId, persona,
  supabase: SupabaseClient,        // userClient → RLS appliqué
  service: SupabaseClient          // service role (cross-table contrôlé)
}
```

**Skills livrés (Sprint 4)** :

| Skill | Catégorie | Source | Notes |
|---|---|---|---|
| `read_audit` | Lecture | `audits` (RLS) | Tronque `audit_data` via `summarizePayload`. |
| `read_site_kpis` | Lecture | `tracked_sites` + dernier `audits` | Pas de score directement → dérivé du dernier audit. |
| `read_cocoon_graph` | Lecture | `cocoon_diagnostic_results` (latest) | Tronque `findings` à 8 entrées. |
| `read_documentation` | Lecture | `audit_recommendations_registry` | Sanitize regex `[^\p{L}\p{N}\s\-]`, max 80 char, max 10 résultats. |
| `navigate_to` | Navigation (directive UI) | — | Renvoie `{ action:'navigate', path }` ; consommé par le frontend. |
| `open_audit_panel` | Navigation | — | `{ action:'open_panel', target:'audit', audit_id }`. |
| `trigger_audit` | Action (approval) | invoke `expert-audit` / `audit-expert-seo` / `audit-strategique-ia` | Mappé via `AUDIT_FN_BY_TYPE`. |
| `cms_publish_draft` | Action (approval) | `seo_page_drafts` ou `blog_articles` | Vérifie propriété via RLS, idempotent (`already_published`). |
| `cms_patch_content` | Action (approval) | invoke `cms-patch-content` | 1-20 patches/appel, 19 zones supportées (h1, meta, faq, schema_org, og_*…). |

**Construction des `tools` envoyés au LLM** : `buildToolDefinitions(allowedSkillNames)` ne sérialise que les skills dont la policy ≠ `forbidden` pour la persona courante.

### 2.5 Agent loop (`index.ts`)

```
loadHistory ─► messages = [system + history + user]
   while (i < MAX_ITERATIONS=6):
      llmResp = callLLM(persona.model, messages, tools)
      push assistant message (avec tool_calls éventuels)
      if !tool_calls → finalReply = content; break
      for each tool_call:
        policy = resolveSkillPolicy(persona, skill)
        if creatorMode && skill connue → policy = 'auto'
        switch policy:
          forbidden → log status='rejected', renvoie erreur au LLM
          approval  → log 'awaiting_approval', stopForApproval=true
          auto      → handler(input, ctx), log success/error,
                      réinjecte JSON.stringify(result) en role='tool'
      if stopForApproval → finalReply = buildApprovalPromptText(); break
```

**Constantes** :
- `MAX_ITERATIONS = 6` — garde-fou anti-boucle infinie.
- `HISTORY_LIMIT = 20` derniers tours `_user_message` / `_assistant_reply`.

**Gestion d'erreurs Lovable AI** :
- `429` → `"LLM rate-limit. Réessaie dans quelques secondes."`
- `402` → `"Crédits LLM épuisés. Recharge le workspace."`
- Autre `!ok` → erreur tronquée à 300 caractères.

### 2.6 Mode créateur (`/creator :`, `/createur :`, `/admin :`)

Préfixe en début de message → match regex `^\s*\/(?:createur|creator|admin)\s*:\s*`.

Si `has_role(_user_id, 'admin')` retourne `true` :
1. `isCreatorMode = true`, le préfixe est strippé.
2. Bannière `## ⚙️ MODE CRÉATEUR ACTIF` injectée dans le system prompt.
3. **Toutes** les skills du registry sont exposées (`listSkills()` ∪ skills persona).
4. La policy de chaque skill est forcée à `auto` lors de la résolution dans la loop (override de `resolveSkillPolicy`).

Sinon : préfixe ignoré silencieusement, comportement normal de la persona.

### 2.7 Persistance

**`copilot_sessions`** : `id, user_id, persona, title (slice 80), context, status, last_message_at, created_at, updated_at`.

**`copilot_actions`** (audit trail **append-only**) : chaque tool call → 1 ligne (`skill, input, output, status, error_message, duration_ms, llm_cost_usd`). Statuts : `success | error | rejected | awaiting_approval`.

Conventions spéciales pour reconstituer la conversation :
- `skill = '_user_message'` → `input.content` = texte user.
- `skill = '_assistant_reply'` → `output.content` = réponse finale.

`loadHistory()` filtre uniquement ces deux skills, ordre `desc` puis `.reverse()` → tableau chronologique de 20 messages max.

### 2.8 Approval flow

`POST { approve_action_id }` (sans `message`) :
1. SELECT action `WHERE id=… AND user_id=… AND status='awaiting_approval'`.
2. Réexécute `skill.handler(action.input, ctx)`.
3. **Insert** une nouvelle ligne `copilot_actions` avec le résultat (l'ancienne reste intacte → audit immuable).
4. Retourne `{ approved_action_id, completed_action_id, result }`.

---

## 3. Frontend — `src/`

### 3.1 Hook `useCopilot` (`src/hooks/useCopilot.ts`)

API publique :
```ts
const { sessionId, messages, sending, error,
        sendMessage, approve, reset } = useCopilot({
  persona: 'felix' | 'strategist',
  getContext?: () => Record<string, unknown> | undefined,
  initialSessionId?: string | null,
  onActions?: (actions) => void,         // hook directives navigate_to/open_panel
  onAssistantReply?: (reply, ctx) => void,
  seedMessages?: CopilotMessage[],       // greetings affichés mais pas envoyés
});
```

Flux `sendMessage(text)` :
1. Push `userMsg` + `placeholder` (assistant `pending: true`) dans `messages`.
2. `supabase.functions.invoke('copilot-orchestrator', { body: { persona, session_id, message, context } })`.
3. Au retour : remplace le placeholder par `{ content, actions, awaiting_approvals }`.
4. Déclenche `onActions(data.actions)` puis `onAssistantReply(data.reply, …)`.
5. Erreur → message assistant `*Erreur : …*`, `setError(msg)`.

`approve(actionId)` : push un message « _Validation de l'action #xxxxxx_ » + placeholder, puis appel orchestrator avec `approve_action_id`. Affiche `Action exécutée avec succès.` ou `Action en échec : …`.

`reset()` : vide `sessionRef`, `messages`, `error`. Aucune persistance locale — l'historique reste côté backend, retrouvé en passant `initialSessionId`.

### 3.2 Shell UI `AgentChatShell` (`src/components/Copilot/AgentChatShell.tsx`)

Composant générique (réutilisé Félix + Stratège). Caractéristiques :

- **Markdown obligatoire** : `react-markdown` autour de chaque message (`prose prose-sm prose-invert`).
- **Charte boutons** : bordure + texte, **aucune couleur de fond** (`border border-foreground … hover:border-primary`).
- **Auto-scroll** : `useEffect` sur `messages.length` + dernier `content`.
- **Composer** : `<textarea>` 2 lignes, `Entrée` envoie, `Shift+Entrée` saut de ligne.
- **Starter prompts** : boutons cliquables affichés tant que `messages.length === 0`.
- **`renderComposerExtras`** : render-prop exposant `{ appendToDraft, setDraft, submitDraft, sending }` — utilisé pour brancher le micro vocal de Félix (`ChatWindowUnified`).
- **Auto-navigation** : si `autoNavigate` (par défaut `true`), le shell intercepte les actions `navigate_to` / `success` et appelle `navigate(path)` via React Router.

Rendu d'une action :
- Badge `status` : `success` (foreground/70), `error` (destructive), `rejected` (line-through muted), `awaiting_approval` (primary).

Rendu d'une approbation :
- Bloc bordé `border-primary/40` avec JSON pretty, deux boutons **Valider** / **Refuser** (refuser = envoie `"Annule cette action."`).

### 3.3 Intégrations

| Composant | Persona | Particularités |
|---|---|---|
| `src/components/Support/ChatWindowUnified.tsx` | `felix` | Bulle SAV flottante, branche le micro vocal via `renderComposerExtras`. |
| `src/components/Cocoon/CocoonAIChatUnified.tsx` | `strategist` | Pose `getContext()` avec le `tracked_site_id` courant. |
| `src/pages/CopilotPage.tsx` | sélecteur | Page debug/dev des deux personas. |

---

## 4. Sécurité & garanties

| Couche | Mécanisme |
|---|---|
| Auth | JWT vérifié via `auth.getClaims(token)` ; `userId` jamais dérivé du body. |
| RLS | Toutes les lectures/mutations métier passent par `ctx.supabase` (client utilisateur) → policies `tracked_sites`, `audits`, `seo_page_drafts`, etc. appliquées. |
| Skills | Whitelist par persona + `defaultSkillPolicy='forbidden'` ; `forbidden` log + erreur réinjectée au LLM. |
| Mode créateur | Gated par `has_role(user, 'admin')` côté serveur — préfixe ignoré pour les non-admins. |
| Audit trail | `copilot_actions` append-only ; approbation = nouvelle ligne (jamais de mutation in-place). |
| Anti-boucle | `MAX_ITERATIONS = 6`, `HISTORY_LIMIT = 20`. |
| Rate-limit LLM | 429/402 surfacés en clair (« recharge workspace »). |
| Sanitize | `read_documentation` filtre regex Unicode + tronque à 80 chars avant `ilike`. |

---

## 5. Ajouter une nouvelle skill (recette)

1. Créer un `SkillDefinition` dans `skills/registry.ts` (handler + JSON Schema strict).
2. Ajouter le nom dans `SKILLS` (registry).
3. Pour chaque persona qui doit y accéder : ajouter `'ma_skill': 'auto' | 'approval'` dans `skillPolicies` (`personas.ts`).
4. Si la skill est destructive → `'approval'` obligatoire.
5. Tester via `supabase--curl_edge_functions` ou la bulle Félix avec `/creator : <demande>`.
6. Mettre à jour cette doc + la doc SAV (`src/data/backendDocumentation.ts`, page `/aide`) si la skill est exposée à l'utilisateur final.

---

## 6. Ajouter une nouvelle persona

1. Définir `MA_PERSONA` dans `_shared/agentPersonas.ts` (style guide + forbidden phrases).
2. Ajouter `MA_PERSONA_CONFIG` dans `personas.ts` (modèle, `skillPolicies`, `maxOutputTokens`).
3. Référencer dans le `REGISTRY` + étendre le type `PersonaId`.
4. Côté frontend : nouveau composant qui mount `<AgentChatShell persona="ma_persona" … />`.
5. Si la persona a un contexte spécifique (site_id, audit_id) : passer `getContext`.

---

## 7. Limites connues / dette

- Pas de **streaming** : la réponse arrive d'un bloc (la loop tool-calling est synchrone). Acceptable pour Félix (réponses courtes) ; à reconsidérer pour le Stratège sur longues analyses.
- `loadHistory` ne charge que 20 paires → conversations longues perdent le contexte ancien (compaction LLM future).
- Aucune **dédup** des tool calls dans la même itération (le LLM peut rappeler 2× la même skill).
- Pas de timeout par skill — un handler bloqué bloque toute la requête (max 60s edge function).
