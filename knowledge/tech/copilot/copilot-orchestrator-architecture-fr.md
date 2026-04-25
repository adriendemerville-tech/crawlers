# Copilot Orchestrator — Architecture Backend & Frontend

> **Documentation technique exhaustive du système Copilot unifié (Félix SAV + Stratège Cocoon).**
> Édition : Sprint 12 (mode créateur admin) — Avril 2026.

---

## 1. Vue d'ensemble

Le **Copilot Orchestrator** est l'unique backend conversationnel de Crawlers. Il sert simultanément deux personas :

| Persona | Rôle | Modèle LLM | Skills exposés |
|---|---|---|---|
| **Félix** | Agent SAV (support client conversationnel) | `google/gemini-2.5-flash` | Lecture audits, navigation UI, lecture CMS, escalade humain |
| **Stratège** | Copilote stratégique Cocoon | `google/gemini-2.5-pro` | Toutes skills Félix + écriture CMS, planification éditoriale, modification cocoon |

**Principe architectural** : *1 backend, N personas.* L'identité (system prompt, modèle, tokens, policies) est définie dans `personas.ts`. Les capacités (tools/skills) sont définies dans `skills/registry.ts`. L'orchestration (agent loop, persistance, sécurité) vit dans `index.ts`.

L'ancien backend `sav-agent` est legacy depuis Sprint 6 et n'est plus appelé par le frontend.

---

## 2. Backend — `supabase/functions/copilot-orchestrator/`

### 2.1 Structure

```
copilot-orchestrator/
├── index.ts          # Agent loop, validation JWT, persistance, dispatch skills
├── personas.ts       # Configuration Félix / Stratège (prompts, models, policies)
└── skills/
    └── registry.ts   # Définition de toutes les skills (tools) + handlers
```

### 2.2 `index.ts` — Agent Loop (471 lignes)

**Responsabilités :**

1. **Validation CORS** + handling `OPTIONS` preflight.
2. **Validation JWT** côté serveur via `supabase.auth.getUser(token)`. Rejette `401` si absent ou invalide.
3. **Chargement de la session** depuis `copilot_sessions` (par `session_id` ou création d'une nouvelle).
4. **Reconstruction de l'historique** : derniers 20 messages depuis `copilot_actions` (ordre chronologique).
5. **Détection mode créateur** (admins uniquement) : préfixes `/creator :`, `/cto :`, `/seo :`, `/ux :` extraits du message → `creatorMode = true`, override des policies à `auto`, exposition de toutes les skills du registry.
6. **Boucle d'agent tool-calling** (max **6 itérations**) :
   - Appel Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
   - Parse de la réponse : `text` ou `tool_calls`
   - Pour chaque `tool_call` :
     - Vérification policy (`auto` / `approval` / `forbidden`) selon persona
     - Si `approval` requise et pas encore approuvée : insertion d'une `copilot_action` avec `status='pending_approval'` et break de la boucle
     - Si `auto` : exécution immédiate du handler (`registry.execute(skillName, args, context)`)
     - Insertion `copilot_action` avec `status='executed'` ou `'failed'`
     - Append du résultat dans `messages` pour la prochaine itération
7. **Persistance finale** : `assistant_message`, `actions[]`, `tokens_used`, `model_used` dans `copilot_actions`.
8. **Calcul coût** : multiplication tokens × tarif Gateway → insertion dans `agent_token_costs`.
9. **Réponse JSON** : `{ session_id, message, actions[], approval_needed?, creator_mode? }`.

**Gestion des erreurs :**
- `429 Rate limit` : retry exponentiel 3 fois (1s, 2s, 4s)
- `402 Payment Required` (crédits Gateway épuisés) : message d'erreur explicite
- `500 LLM error` : fallback message + log dans `copilot_actions.error_message`
- Timeout `60s` par appel Gateway

### 2.3 `personas.ts` — Configuration des Personas (95 lignes)

```ts
export type PersonaName = 'felix' | 'strategist';
export type SkillPolicy = 'auto' | 'approval' | 'forbidden';

export interface PersonaConfig {
  name: PersonaName;
  displayName: string;
  systemPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  skillPolicies: Record<string, SkillPolicy>;
}
```

**Félix** (SAV) :
- `model: 'google/gemini-2.5-flash'` — rapide, peu coûteux
- `maxTokens: 2000`
- `temperature: 0.3` — réponses factuelles
- Skills `auto` : `read_audit`, `read_cocoon`, `read_cms_pages`, `navigate_to`, `escalate_to_human`
- Skills `approval` : aucune
- Skills `forbidden` : `cms_publish_draft`, `cms_patch_content`, `cocoon_modify`, toutes les écritures

**Stratège** (Cocoon) :
- `model: 'google/gemini-2.5-pro'` — raisonnement avancé
- `maxTokens: 4000`
- `temperature: 0.5` — créativité modérée
- Skills `auto` : toutes les lectures + `navigate_to`
- Skills `approval` : `cms_publish_draft`, `cms_patch_content`, `cocoon_modify` (l'utilisateur valide avant exécution)
- Skills `forbidden` : `escalate_to_human`, opérations admin

**Mode créateur** (admin uniquement) :
- Override `resolveSkillPolicy()` → toutes les skills passent en `auto`
- Bannière injectée dans le system prompt : `"⚙️ MODE CRÉATEUR ACTIF — Validation auto, écritures CMS autorisées."`
- Toutes les skills du registry exposées (`registry.listSkills()`), pas seulement la whitelist persona

### 2.4 `skills/registry.ts` — Tools

Centralise **toutes** les skills disponibles. Chaque skill expose :

```ts
interface SkillDefinition {
  name: string;
  description: string;        // pour le LLM (tool description)
  parameters: JSONSchema;     // arguments validés (Zod)
  handler: (args, context) => Promise<SkillResult>;
  requires: 'service' | 'user'; // quel client Supabase utiliser
}
```

**Catégories de skills :**

| Catégorie | Skills | Client |
|---|---|---|
| **Lecture audits** | `read_audit`, `read_strategic_audit`, `read_eeat_audit`, `read_matrix_audit` | `userClient` (RLS) |
| **Lecture cocoon** | `read_cocoon`, `read_cocoon_diagnostics`, `read_keyword_universe` | `userClient` |
| **Lecture CMS** | `read_cms_pages`, `read_cms_drafts`, `cms_content_scan` | `userClient` |
| **Écriture CMS** | `cms_publish_draft`, `cms_patch_content`, `cms_create_draft` | `service` (validation interne) |
| **Cocoon write** | `cocoon_modify`, `cocoon_add_link`, `cocoon_remove_link` | `service` |
| **Navigation** | `navigate_to` (renvoie une URL au frontend, pas d'effet serveur) | aucun |
| **SAV** | `escalate_to_human`, `create_support_ticket` | `service` |
| **Admin** | `agent_dispatch_seo`, `agent_dispatch_cto`, `agent_dispatch_ux` (créateur uniquement) | `service` |

**Différence `userClient` vs `service`** :
- `userClient` : créé avec le JWT de l'utilisateur → RLS appliquée → ne peut lire que ses propres données
- `service` : `SUPABASE_SERVICE_ROLE_KEY` → bypass RLS, MAIS chaque handler doit re-vérifier la propriété via `owns_tracked_site(site_id)` ou équivalent

---

## 3. Persistance — Tables Supabase

### 3.1 `copilot_sessions`

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid PK | Session ID |
| `user_id` | uuid FK | Propriétaire |
| `persona` | text | `'felix'` ou `'strategist'` |
| `tracked_site_id` | uuid FK nullable | Site contextuel |
| `context` | jsonb | État libre (page courante, audit en cours…) |
| `created_at` / `updated_at` | timestamptz | |

**RLS :** SELECT/INSERT/UPDATE limités à `user_id = auth.uid()`.

### 3.2 `copilot_actions` (audit trail append-only)

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `user_id` | uuid FK | |
| `role` | text | `'user'` / `'assistant'` / `'tool'` |
| `content` | text | Message texte |
| `skill_name` | text nullable | Nom de la skill appelée |
| `skill_args` | jsonb nullable | Arguments |
| `skill_result` | jsonb nullable | Résultat |
| `status` | text | `'executed'` / `'pending_approval'` / `'approved'` / `'rejected'` / `'failed'` |
| `error_message` | text nullable | Détails erreur |
| `tokens_input` / `tokens_output` | int | Comptage tokens |
| `model_used` | text | `google/gemini-2.5-flash` etc. |
| `creator_mode` | bool | true si exécuté en mode créateur |
| `created_at` | timestamptz | |

**RLS :** SELECT limité à `user_id = auth.uid()`. **Pas de policy UPDATE/DELETE** → audit immuable.

**Cron `copilot-purge-actions-daily`** : purge les entrées > 90 jours via l'edge function `copilot-purge-actions` (CRON_SECRET requis).

### 3.3 `agent_token_costs`

Suit la consommation Gateway par utilisateur/persona. Permet le plafond partagé Supervisor/CTO (€1.00/jour).

---

## 4. Frontend

### 4.1 Hook `useCopilot` (`src/hooks/useCopilot.ts`)

**Responsabilités :**

- Maintien de l'état : `sessionId`, `messages[]`, `pendingApproval`, `isLoading`
- `sendMessage(text)` :
  - Append message user dans state
  - `supabase.functions.invoke('copilot-orchestrator', { body: { message, session_id, persona, context } })`
  - Append réponse assistant
  - Si `approval_needed === true` : stocker `pendingApproval = { skill, args, action_id }`
- `approveAction(actionId)` / `rejectAction(actionId)` : nouvel appel avec `{ approved_action_id }` pour reprendre la boucle
- `loadHistory(sessionId)` : SELECT depuis `copilot_actions` ordonné par `created_at`
- Écoute realtime sur `copilot_actions` (channel `copilot-session-${sessionId}`) pour streaming des actions long-running

**Signature exposée :**
```ts
const {
  messages,
  sendMessage,
  isLoading,
  pendingApproval,
  approveAction,
  rejectAction,
  resetSession,
} = useCopilot({ persona: 'strategist', trackedSiteId, context });
```

### 4.2 Composant `AgentChatShell` (générique)

Wrapper UI réutilisable utilisé par Félix (drawer SAV) et le Stratège Cocoon (modal `/app/cocoon`).

**Features :**
- Rendu Markdown via `react-markdown` + `remark-gfm` (tables, code blocks)
- Rendu actions inline avec badges de statut :
  - 🟢 `executed` : badge vert "Exécuté"
  - 🟡 `pending_approval` : badge ambre "Validation requise" + boutons Approuver/Refuser
  - 🔴 `failed` : badge rouge avec `error_message`
- **Auto-navigation** : si action `navigate_to` exécutée → `useNavigate()` vers l'URL retournée
- Scroll auto en bas, indicateur de frappe, gestion clavier (Cmd+Enter pour envoyer)
- Mode `creatorMode` détecté côté client (préfixe `/creator :`) → bannière violette en haut du chat

### 4.3 Intégrations spécifiques

| Surface | Composant | Persona |
|---|---|---|
| **Drawer SAV global** | `FelixDrawer` (header global) | `felix` |
| **Stratège Cocoon** | `CocoonAIChatUnified` (modal sur `/app/cocoon`) | `strategist` |
| **Admin agents** | `AdminAgentConsole` (préfixes `/cto :`, `/seo :`, `/ux :`) | `strategist` + creatorMode |

---

## 5. Sécurité

**Couches de protection :**

1. **JWT obligatoire** : validation côté serveur via `auth.getUser(token)`. Pas de mode anonyme.
2. **Multi-tenant strict** : `userClient` créé par token → RLS s'applique automatiquement sur toutes les lectures.
3. **Mode créateur gated** : check `has_role(user_id, 'admin')` avant d'autoriser le préfixe `/creator :`.
4. **Audit trail immuable** : aucune policy UPDATE/DELETE sur `copilot_actions`.
5. **Plafond dépenses LLM** : €1.00/jour partagé entre agents Supervisor/CTO (cf. `tech/agent-spending-limit-fr`).
6. **Validation arguments** : chaque skill valide ses `args` via Zod avant exécution. Échec → `400` retourné au LLM, pas d'exécution.
7. **Rate limiting** : 30 messages/minute par utilisateur via `check_rate_limit('copilot_message')`.

---

## 6. Mode Créateur — Détails

Activé exclusivement pour les utilisateurs avec rôle `admin`. Détection côté serveur :

```ts
const CREATOR_PREFIXES = ['/creator :', '/cto :', '/seo :', '/ux :'];
const creatorMode = CREATOR_PREFIXES.some(p => message.startsWith(p));

if (creatorMode) {
  const isAdmin = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'unauthorized_creator_mode' }), { status: 403 });
  }
  // Strip prefix, inject banner, expose all skills, force auto policy
  cleanedMessage = message.replace(/^\/(creator|cto|seo|ux) :\s*/, '');
  systemPrompt += '\n\n⚙️ MODE CRÉATEUR ACTIF — Toutes les skills exposées, validation auto.';
  exposedSkills = registry.listSkills(); // ALL
  policyOverride = 'auto';
}
```

**Effets concrets :**
- L'agent peut publier directement sur le CMS sans approbation utilisateur
- L'agent peut modifier la structure cocoon
- L'agent peut dispatcher des tâches aux agents internes (CTO, SEO, UX)

---

## 7. Cycle de vie d'un message

```
[User] → [AgentChatShell.sendMessage]
    ↓
[useCopilot.sendMessage]
    ↓
[supabase.functions.invoke('copilot-orchestrator')]
    ↓
[index.ts]
  1. CORS + JWT validation
  2. Load session + history
  3. Detect creator mode (admin)
  4. Build messages[] (system + history + user)
  5. Loop (max 6):
     a. Call Gateway (model from persona)
     b. Parse response
     c. If text only → done
     d. If tool_calls:
        - For each call:
          * Check policy
          * If approval needed → persist action + break loop
          * Else execute handler
          * Persist action
          * Append to messages
  6. Persist final assistant message
  7. Return JSON
    ↓
[useCopilot] → setState
    ↓
[AgentChatShell] → render markdown + action badges
    ↓
[If navigate_to] → useNavigate(url)
[If approval needed] → render Approve/Reject buttons
```

---

## 8. Fichiers clés

| Fichier | Rôle |
|---|---|
| `supabase/functions/copilot-orchestrator/index.ts` | Agent loop, persistance, sécurité |
| `supabase/functions/copilot-orchestrator/personas.ts` | Config Félix + Stratège |
| `supabase/functions/copilot-orchestrator/skills/registry.ts` | Définition skills + handlers |
| `supabase/functions/copilot-purge-actions/index.ts` | Cron purge 90j |
| `supabase/functions/copilot-admin-stats/index.ts` | KPIs admin (sessions, coûts, top skills) |
| `src/hooks/useCopilot.ts` | Hook React orchestration |
| `src/components/agents/AgentChatShell.tsx` | UI générique chat |
| `src/components/agents/FelixDrawer.tsx` | Intégration SAV globale |
| `src/components/Cocoon/CocoonAIChatUnified.tsx` | Intégration Stratège Cocoon |

---

## 9. Évolutions futures

- **Sprint 13** : streaming SSE des réponses Gateway (latence perçue)
- **Sprint 14** : persona `auditor` (rôle équipe Pro Agency)
- **Sprint 15** : mémoire long-terme par utilisateur (vector store)

---

*Document maintenu par l'équipe technique Crawlers. Dernière mise à jour : Sprint 12.*
