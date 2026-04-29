# UI/UX de Félix — État avant refactorisation

> Snapshot exhaustif de l'UI/UX de **Félix**, le copilote SAV/onboarding global de Crawlers, avant la prochaine refactorisation. Sert de référence pour préserver l'identité visuelle, les comportements et les triggers.
>
> Sources principales :
> - `src/components/Support/FloatingChatBubble.tsx` (353 lignes) — bulle flottante & bandeaux d'invite
> - `src/components/Support/ChatWindowUnified.tsx` (598 lignes) — fenêtre chat (Sprint 9, branchée `copilot-orchestrator`)
> - `src/components/Support/CrawlersLogo.tsx` (38 lignes) — logo robot violet
> - Composants couplés : `AgentChatShell`, `ChatMicButton`, `ChatAttachmentPicker`, `ChatReportSearch`, `SeoQuiz`, `EnterpriseQuiz`, `QuizValidationNotif`, `CopilotHistoryPanel`

---

## 1. Identité visuelle

### Logo : `CrawlersLogo` (SVG inline)
- SVG 48×48, `viewBox="0 0 48 48"`, coins arrondis (`rx=10`).
- Fond : gradient diagonal **violet** (`linearGradient` id `chatBotGrad`, direction `100% 0% → 0% 100%`) :
  - `0%` → `#d4a853` (touche dorée subtile en coin haut-droit)
  - `30%` → `#8b5cf6` (violet clair)
  - `70%` → `#7c3aed` (violet profond)
  - `100%` → `#3b5998` (bleu nuit)
- Robot blanc (`stroke="#ffffff"`, `strokeWidth=1.5`) au centre, `transform="translate(9, 7.5) scale(1.25)"`.
- Path robot : antenne (`M12 8V4H8`) + corps (`rect 4,8 16×12 rx=2`) + oreilles (`M2 14h2`, `M20 14h2`) + yeux (`M9 13v2`, `M15 13v2`).
- Tailles utilisées : `size={56}` dans la bulle flottante, `size={28}` dans le header chat.
- **Distinct du Stratège Cocoon** (or pur `#f5c842 → #b8860b`) — Félix = identité **violet** dominante.

### Palette de couleurs (charte respectée : violet + or + noir + blanc)
| Rôle | Token | Usage |
|---|---|---|
| Fond chat | `bg-background` | Conteneur principal |
| Bordures | `border-border`, `border-primary/40`, `border-primary/60` | Cadre, bandeaux, bouton flottant |
| Accent primaire | `primary` (violet) | Logo, ring focus, accent badges |
| Texte | `text-foreground`, `text-muted-foreground` | Hiérarchie tokens |
| Bandeaux contextuels | `bg-muted/20`, `bg-muted/10` | Mode bug, overlays quiz |
| Notification badge | `bg-destructive text-destructive-foreground` | Pastille messages non lus |
| Backdrop bulle flottante | `bg-background/80 backdrop-blur` | Bouton circulaire + tooltips |

### Typographie
- Titre header : `text-sm font-semibold` ("Félix")
- Sous-titre header : `text-[10px] uppercase tracking-wide text-muted-foreground` ("Copilot v2 · unifié")
- Tooltips d'invite : `text-xs font-medium`
- Mode bug : `text-[11px]`
- **Zoom texte** : cycle `0.875 / 1 / 1.15 / 1.3 rem`, persistant via `localStorage.felix_font_scale`

---

## 2. Bouton flottant (FAB)

### Position & visibilité
- **Position** : `fixed bottom-5 right-{centered}` — calc dynamique :
  ```
  right: max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))
  ```
  → aligne le FAB sur le bord droit de la zone de contenu max-w-`72rem`, tout en restant visible sur petits écrans.
- **z-index** : `z-[110]`
- **Masqué** sur :
  - Mobile (`useIsMobile()`)
  - Pages rapport (`/app/rapport/`, `/temporarylink/`, `/temporaryreport/`, `/r/`)
  - Pages auth (`/signup`, `/auth`)
  - Page Cocoon (`/app/cocoon`) — pour ne pas concurrencer le Stratège
  - Quand sidebar Félix ancrée (`felixExpanded`) ou Cocoon étendu (`cocoonExpanded`)

### Style
- Cercle 50.4×50.4px (`h-[3.15rem] w-[3.15rem] rounded-full`)
- `border border-primary/60 bg-background/80 backdrop-blur`
- Hover : `hover:bg-background hover:scale-105`
- Focus : `focus-visible:ring-2 focus-visible:ring-primary`
- ⚠️ **Conformité charte** : bordure + fond translucide (pas de fond plein violet), respecte la règle "bouton avec bordure".
- Animation `animate-felix-bounce` lors du **ping-pong bounce** (1ʳᵉ visite home après 20s).

### Badge notification
- Pastille `h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse`
- Position : `bottom-[54px]` au-dessus du FAB
- Affiche : `unreadCount` (cap `9+`) ou `!` pour onboarding/quiz suggestion
- Conditions d'affichage : `unreadCount > 0` OU `showOnboardingPulse` OU `showGuestQuizSuggestion` OU `showHallucinationBubble`

---

## 3. Tooltips d'invite (bandeaux pré-ouverture)

Trois bandeaux contextuels apparaissent **au-dessus du FAB** (`bottom-[72px]`, `max-w-[220-260px]`) :

### Style commun
```
fixed bottom-[72px] z-[110] rounded-xl border border-primary/40 bg-background/95 backdrop-blur
text-foreground px-3 py-2 text-xs font-medium shadow-lg cursor-pointer group
```
- Bouton fermeture : `absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border bg-background opacity-0 group-hover:opacity-100`

### Variantes
| Trigger | Délai | Texte | Animation |
|---|---|---|---|
| **Onboarding** (user connecté, 1ère/4ᵉ/7ᵉ visite) | 2.5s | "Bonjour, moi c'est Félix. Veux-tu que je t'explique comment fonctionne Crawlers ?" | `animate-bounce` |
| **Guest Quiz** (visiteur non connecté sur `/`) | 5s, auto-hide 10s | "En quoi puis-je t'être utile ?" | — |
| **Diagnostic Hallucination** (event `felix-hallucination-diagnosis`) | immédiat, auto-hide 15s | "Veux-tu que je t'aide à diagnostiquer cette hallucination ?" | `animate-bounce` |

Chaque tooltip joue un son via `playNotificationSound()` (sauf sur pages "silencieuses" `/` et `/blog/*`, et si `isMuted`).

---

## 4. Fenêtre chat — Layout

### 3 modes d'affichage
1. **Flottant standard** (par défaut) :
   ```
   right: max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))
   bottom: 5rem
   width: 24rem (384px)
   height: 36rem (576px)
   ```
2. **Ancré pleine hauteur à droite** (`docked === felixExpanded`) :
   ```
   right: 0; top: 0; bottom: 0;
   width: 24rem; borderRadius: 0
   ```
3. **Minimisé** : même position flottante, mais `height: 3rem` (juste le header visible).

### Conteneur racine
- `fixed z-[110] flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl`
- `role="dialog"`, `aria-label="Félix — Copilote"`
- **Lazy-loaded** via `React.lazy(() => import('./ChatWindowUnified'))` avec fallback spinner.

---

## 5. Header

`flex items-center justify-between border-b border-border px-3 py-2`

### Gauche
- `<CrawlersLogo size={28} />` (logo violet)
- Bloc texte :
  - `<div className="text-sm font-semibold">Félix</div>`
  - `<div className="text-[10px] uppercase tracking-wide text-muted-foreground">Copilot v2 · unifié</div>`

### Droite — barre d'icônes (5+1 boutons, tous `p-1 rounded-md border border-transparent hover:border-border`)
1. **Historique** (`<History className="h-3.5 w-3.5" />`) — toggle `CopilotHistoryPanel`. État actif : `border-primary text-primary`.
2. **Taille texte** (`<Type />`) — cycle `cycleFontScale()` (4 paliers).
3. **Mute/Unmute** (`<Bell />` / `<BellOff />`) — persiste `localStorage.felix_muted` + dispatch `felix_mute_changed`.
4. **Réduire** (`<Minus />`) — `setMinimized(true)` + désancre si docked.
5. **Ancrer/Désancrer** (`<PanelRightOpen />` / `<PanelRightClose />`) — toggle `felixExpanded` (sidebar pleine hauteur).
6. **Fermer** (`<X />`) — appelle `onClose()`.

⚠️ **Conformité charte** : tous les boutons sans fond, bordure transparente au repos, bordure visible au hover. Respecte la règle "pas de fond plein".

---

## 6. Panneau Historique (`CopilotHistoryPanel`)

- Affiché entre header et corps quand `showHistory && !minimized`
- Composant partagé Copilot — sessions filtrées par `persona="felix"` et `userId`
- Actions : `onPickSession(sid)`, `onNewSession()`, `onClose()`
- Le `shellKey` (incrémenté à chaque pick/new) force le remount de `AgentChatShell`

---

## 7. Bandeau "Mode bug actif"

Affiché en haut du corps quand `bugMode === true` :
```
border-b border-primary/40 bg-muted/20 px-3 py-1.5 text-[11px] text-foreground
```
Texte : « Mode bug actif — décris le problème, il sera transmis à l'équipe. » + lien `annuler` (underline).

Activé par :
- Slash command `/bug …` dans le composer
- Bouton dédié dans `ChatAttachmentPicker`
- Side-effect : insère un `user_bug_reports` avec `route`, `ai_summary`, `session_id`, `source_assistant: 'felix'`

---

## 8. Overlays (quiz / enterprise / validation)

Bloc scrollable `max-h-[55%] overflow-y-auto border-b border-border bg-muted/10 p-3 space-y-3` au-dessus du shell quand `hasOverlay || extraMessages.length > 0` :

| Overlay | Composant | Trigger |
|---|---|---|
| **Quiz SEO** | `<SeoQuiz>` | `/quiz`, intent détecté, `autoStartCrawlersQuiz` |
| **Quiz Crawlers** | `<SeoQuiz isCrawlersQuiz>` | `/quiz crawlers` ou via bouton du quiz SEO |
| **Enterprise contact** | `<EnterpriseQuiz>` | `/enterprise`, event `felix-enterprise-contact` (depuis pages pricing) |
| **Validation admin** | `<QuizValidationNotif>` | Admin uniquement, questions auto-générées en attente |

Les `extraMessages` (messages assistant additionnels) s'affichent en cartes :
```
rounded-md border border-border px-3 py-2 text-xs text-foreground whitespace-pre-wrap
```

À la fin du quiz : push `**Score : X/Y** — Niveau : Débutant/Intermédiaire/Avancé/Expert` + corrections détaillées + analytics `quiz:seo_score` / `quiz:crawlers_score`.

---

## 9. Corps : `AgentChatShell` (Copilot v2)

Le rendu des messages, du composer et des tool-calls est délégué au shell partagé Copilot.

### Props passées
```ts
<AgentChatShell
  key={shellKey}
  persona="felix"
  title="Félix"
  subtitle="Copilote SAV unifié — questions, audits, navigation"
  starterPrompts={STARTERS}
  getContext={getContext}      // injecte trackedSiteId + domain + screen capture
  seedMessages={...}            // onboarding ou greeting initial
  initialSessionId={pickedSessionId}
  onAssistantReply={onAssistantReply}
  fontScale={fontScale}
  composerLeading={...}
  renderComposerExtras={...}
/>
```

### Starter prompts (boutons d'amorce vide)
```ts
const STARTERS = [
  'Explique-moi mon dernier audit',
  'Ouvre la cocoon',
  'Quels sont mes quick wins SEO ?',
];
```

### Composer enrichi
- **`composerLeading`** : `<ChatAttachmentPicker>` (bouton "+" pour joindre rapport / image / activer bug mode)
- **`renderComposerExtras` slot `inside`** : `<ChatMicButton>` (input vocal avec `userDomains` pour autocomplétion)
- **`renderComposerExtras` slot `leading`** : `<ChatReportSearch>` (recherche d'un rapport utilisateur à attacher)

### Contexte injecté (`getContext`)
- `trackedSiteId` + `domain` (résolu depuis l'URL ou `tracked_sites`)
- `userDomains[]` (tous les domaines de l'user)
- `screenContext` capturé via `captureScreenContext()` (route, viewport, sélection)
- `bugMode` (booléen)

---

## 10. Onboarding (premier démarrage)

- Hook `isOnboardingDone()` lit `localStorage.felix_onboarding_done`
- À l'ouverture (`triggerOnboarding === true`), `getOnboardingMessages(null)` injecte une séquence de messages assistants seedés
- À la consommation : `onOnboardingConsumed()` + `markOnboardingDone()`
- Notification onboarding **rate-limitée** : `every 3 visits` (1ʳᵉ, 4ᵉ, 7ᵉ…) via `localStorage.felix_notif_visit_count`
- Auto-dismiss possible via `notifDismissedThisSession` (cross + state local)

---

## 11. Greetings personnalisés

Évènement `felix-open-with-message` (custom event) accepte :
```ts
{ message: string, expandedMessage?: string }
```
- `message` (court) → utilisé en mode flottant
- `expandedMessage` (long) → utilisé si déjà ancré (`docked`)
- B1 fix : si un seul des deux est fourni, on l'utilise quel que soit le mode
- Source : bouton "Nous écrire" sur la page Aide

---

## 12. Notifications & realtime

### Compteur unread
- `support_messages` non lus (`is_admin = true`, `read_at IS NULL`) sur la conversation `support_conversations` ouverte
- + `user_bug_reports` (`status = 'resolved'`, `notified_user = false`)
- Subscription realtime sur `INSERT` dans `support_messages` (channel `user-unread-messages`)
- Reset à l'ouverture via `markMessagesAsRead()` (UPDATE `read_at`)

### Sons
- `playNotificationSound()` joué pour onboarding pulse, guest quiz, hallucination bubble
- **Pages silencieuses** : `/` (home) et `/blog/*` (pas de son malgré le bandeau)
- Mute global persisté + sync cross-tab via `window.dispatchEvent('felix_mute_changed')`

---

## 13. Évènements custom écoutés

| Événement | Action |
|---|---|
| `felix-enterprise-contact` | Ouvre le chat + démarre `EnterpriseQuiz` |
| `felix-open-with-message` | Ouvre le chat avec greeting personnalisé |
| `felix-hallucination-diagnosis` | Affiche bandeau invite (15s) puis lance diagnostic au clic via `felix-start-hallucination-diagnosis` |
| `felix_mute_changed` | Sync mute state cross-component |
| URL param `?felix=fullpage` | Ouvre directement en mode étendu |

---

## 14. Accessibilité

- `role="dialog"` + `aria-label="Félix — Copilote"` sur le conteneur
- `aria-label` sur tous les boutons icônes (Historique, Taille du texte, Activer/Couper le son, Réduire, Ancrer, Fermer)
- `focus-visible:ring-2 focus-visible:ring-primary` sur le FAB
- Zoom texte cyclable (`Type` icon) — 4 paliers, persistant
- Bouton fermeture tooltips avec `aria-label="Fermer"`

---

## 15. Conformité charte Crawlers

| Règle | Respect | Note |
|---|---|---|
| Couleurs : violet, jaune d'or, noir, blanc | ✅ | Violet dominant + accent doré subtil dans le gradient logo |
| Boutons : bordure + texte (pas de fond plein) | ✅ | FAB, boutons header, tooltips — tous bordés sans fond plein |
| Pas d'emoji | ⚠️ | Le `✕` (caractère unicode U+2715) est utilisé sur les croix de fermeture des tooltips — à vérifier vs charte stricte |
| Pas de bleu IA | ✅ | Aucun bleu type ChatGPT (le `#3b5998` du gradient est en bas du logo, peu visible) |
| Logo distinct vs Stratège | ✅ | Violet vs Or — identités séparées |

---

## 16. Points de vigilance pour la refacto

1. **Préserver le `CrawlersLogo` violet** (`chatBotGrad`) — ne pas le confondre avec `GoldCrawlersLogo` du Stratège Cocoon.
2. **3 modes d'affichage** : flottant / ancré pleine hauteur / minimisé — calc précis du `right` à conserver.
3. **Lazy loading** du `ChatWindowUnified` via `React.lazy` — performance critique sur la home.
4. **Triggers automatiques** : onboarding (every 3 visits), guest quiz (5s home), bounce (20s home), hallucination bubble — calendrier précis à respecter.
5. **Évènements custom** (`felix-open-with-message`, `felix-enterprise-contact`, `felix-hallucination-diagnosis`) — API publique consommée par d'autres composants.
6. **Slash commands** : `/bug`, `/quiz`, `/quiz crawlers`, `/enterprise` — détection dans le composer.
7. **Pages exclues** : Cocoon (`/app/cocoon`), rapports, auth, mobile — masquer entièrement le FAB.
8. **Realtime unread** : subscription `support_messages` à conserver pour le badge.
9. **Mute global** persisté + synchronisé cross-component via event.
10. **Zoom texte** (4 paliers) persistant — accessibilité.
11. **Coordination avec sidebar Cocoon** (`AISidebarContext`) : Félix masqué quand Cocoon étendu, et inversement.
12. **Sounds rate-limited** : pages silencieuses (`/`, `/blog/*`) — éviter pollution sonore sur landing.

---

## 17. Composants & dépendances couplées

- `AgentChatShell` (`@/components/Copilot`) — shell générique Copilot v2
- `useCopilot` hook — orchestration messages / tool-calls
- `CopilotHistoryPanel` — historique sessions partagé
- `ChatMicButton` — input vocal Whisper
- `ChatAttachmentPicker` — joindre rapport/image, activer bug mode
- `ChatReportSearch` — recherche rapports utilisateur
- `SeoQuiz`, `EnterpriseQuiz`, `QuizValidationNotif` — overlays quiz
- `useAISidebar` (`AISidebarContext`) — coordination sidebar Félix ↔ Cocoon
- `useAuth`, `useAdmin`, `useCredits` (Agency Pro gating)
- `useIsMobile` — masquage mobile
- `felixOnboarding` (`@/utils`) — séquence onboarding + flag done
- `screenContext` (`@/utils`) — capture du contexte écran injecté au copilot
- `playNotificationSound` (`@/utils`) — sons d'invite
- Edge function `copilot-orchestrator` (Sprint 9) — backend agent loop

---

**Dernière mise à jour** : avant prochaine refactorisation. État actuel = **Sprint 9** (`ChatWindowUnified` branché sur `copilot-orchestrator`, ancien `ChatWindow` legacy supprimé).

**Fichiers source** :
- `src/components/Support/FloatingChatBubble.tsx` (353 lignes)
- `src/components/Support/ChatWindowUnified.tsx` (598 lignes)
- `src/components/Support/CrawlersLogo.tsx` (38 lignes)
