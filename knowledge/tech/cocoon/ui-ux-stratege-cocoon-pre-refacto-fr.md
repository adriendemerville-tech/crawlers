# UI/UX du Stratège Cocoon — État avant refactorisation

> Snapshot exhaustif de l'UI/UX du composant `CocoonAIChat` (chat agent IA dans la vue Cocoon) avant la refactorisation prévue. Ce document sert de référence pour préserver l'identité visuelle et les comportements lors de la migration vers `CocoonAIChatUnified` (Sprint 8 / `useStrategistV2Flag`).
>
> Source : `src/components/Cocoon/CocoonAIChat.tsx` (2143 lignes — marqué `@deprecated`).

---

## 1. Identité visuelle

### Logo : `GoldCrawlersLogo` (inline)
- SVG 48×48, `viewBox="0 0 48 48"`, coins arrondis (`rx=10`).
- Fond : gradient diagonal **doré** (`linearGradient` id `cocoonStrategistGoldGrad`) :
  - `0%` → `#f5c842` (jaune d'or clair)
  - `50%` → `#d4a853` (or moyen)
  - `100%` → `#b8860b` (DarkGoldenRod)
- Robot blanc (`stroke="#ffffff"`, `strokeWidth=1.5`) au centre, `transform="translate(8.4, 8.4) scale(1.3)"`.
- Path robot : antenne (`M12 8V4H8`) + corps (`rect 4,8 16×12 rx=2`) + oreilles (`M2 14h2`, `M20 14h2`) + yeux (`M9 13v2`, `M15 13v2`).
- Tailles utilisées : `size={18}` dans le header et le toggle.
- **Identique** au logo de la Home (`AIAgentsSection`) — distinct du Félix violet (`CrawlersLogo` avec `chatBotGrad` violet).

### Palette de couleurs
| Rôle | Valeur | Usage |
|---|---|---|
| Fond chat | `#0f0a1e/95` + `backdrop-blur-xl` | Conteneur principal |
| Fond header | `bg-gradient-to-r from-[#1a1035] to-[#0f0a1e]` | Bandeau du haut |
| Bordure conteneur | `border-[hsl(263,70%,20%)]` | Violet sombre |
| Or principal | `#fbbf24` | Titre, accents, badge, send button |
| Or hover | `#f59e0b` | Hover du bouton Send |
| Texte titre | `text-[#fbbf24]` | « Stratège Cocoon » |
| Émeraude | `emerald-400/500` | Bouton "Optimiser maillage" |
| Ambre | `amber-400/500` | Bouton "Stratégie 360°" |
| Violet | `violet-500/300` | Bouton "Architecte contenu" |
| Texte | `text-white` + opacités `/25 /30 /40 /50 /60 /80` | Hiérarchie discrète |

### Typographie
- Tailles très compactes : titre `text-[11px]`, messages `text-xs`, métadonnées `text-[10px]`/`text-[9px]`.
- Police mono pour compteur de fontSize et badge messages : `font-mono`.
- Curseur dynamique de taille de texte (`fontSize` state, bornes `FONT_MIN`/`FONT_MAX`).

---

## 2. Layout & dimensions

### Conteneur racine
- `<div className="relative">` — wrapper du toggle + chat flottant.

### Mode normal (chat fermé puis ouvert)
- **Position** : `fixed bottom-20 left-2 sm:left-4`
- **Taille** : `w-[475px] max-w-[90vw]`, `maxHeight: min(600px, 72vh)`
- **Style** : `rounded-2xl border bg-[#0f0a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/40`
- `z-50`, `overflow-hidden`, `flex flex-col`

### Mode étendu (`isExpanded === true`)
- **Position** : `fixed top-0 left-0 h-full`
- **Taille** : `w-[28rem] max-w-[90vw]` (sidebar gauche pleine hauteur)
- Bordure droite uniquement : `border-r border-[hsl(263,70%,20%)]`
- Transition : `transition-all duration-300 ease-in-out`

### Toggle button (bouton flottant déclencheur)
- Pill horizontal : `flex items-center gap-2 px-3.5 py-2 rounded-xl border backdrop-blur-md`
- Fond doré transparent : `bg-[#fbbf24]/10 border-[#fbbf24]/20 text-[#fbbf24]`
- Hover : `bg-[#fbbf24]/20` ; ouvert : `bg-[#fbbf24]/15`
- Contenu : `<GoldCrawlersLogo size={18} />` + libellé `{t.title}` (« Stratège Cocoon »)
- **Compteur messages** : pastille `bg-[#fbbf24]/20 rounded-full font-mono`
- **Badge bugs** : `absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 animate-pulse` si `resolvedBugCount > 0`

---

## 3. Header (barre de titre)

`flex items-center justify-between px-3 py-1.5 border-b border-white/10`

### Gauche
- `<GoldCrawlersLogo size={18} />` + `<p className="text-[11px] font-semibold text-[#fbbf24]">{t.title}</p>`

### Droite — barre d'actions (icônes 12×12, boutons `p-1 rounded-lg hover:bg-white/10`)
1. **Historique** (`<Clock />`) — toggle panneau historique. État actif : `bg-white/10`.
2. *Séparateur* `w-px h-3 bg-white/10 mx-0.5`.
3. **Zoom out texte** (`<ZoomOut />`).
4. **Compteur fontSize** : `text-[9px] text-white/25 font-mono min-w-[20px]`.
5. **Zoom in texte** (`<ZoomIn />`).
6. **Optimiser maillage** (`<Network />`) — vert émeraude, hover `bg-emerald-500/20`. Disabled si `nodes.length < 3`.
7. **Stratégie 360°** (`<Compass />`) — ambre, hover `bg-amber-500/20`. Disabled sans `trackedSiteId`.
8. *Séparateur*.
9. **Effacer** (`<Trash2 />`) — uniquement si `messages.length > 0`.
10. **Étendre/Réduire** (`<Maximize2 />` / `<Minimize2 />`).
11. **Ouvrir nouvel onglet** (`<ExternalLink />`) → `/stratege-cocoon`.
12. **Réduire** (`<Minus className="w-3.5 h-3.5" />`) — ferme uniquement.
13. **Fermer** (`<X className="w-3.5 h-3.5" />`) — ferme + reset `isExpanded`.

---

## 4. Panneau Historique (collapsible)

- Conteneur : `border-b border-white/10 bg-[#0f0a1e] max-h-[200px] overflow-y-auto`
- En-tête : `<ChevronLeft />` retour + libellé i18n (Historique / History / Historial)
- Liste sessions : boutons `text-[10px]`, hover `bg-white/5`
  - Session active : `bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-white/80`
  - Affiche : `summary || domain`, date locale (`day numeric, month short, hour:minute`), compteur `message_count msg`

---

## 5. Zone messages

- Conteneur scrollable : `flex-1 overflow-y-auto px-4 py-3 space-y-3`, `minHeight: 200px`

### États vides / d'accueil
- Message d'accueil centré (`text-center py-4 space-y-3`) avec `prose prose-invert` (markdown).
- Boutons CTA verticaux : `flex flex-col items-center gap-2`.
- Boutons de raccourcis "Stratégie 360°" et "Optimiser maillage" pleine largeur :
  ```
  inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-medium
  ```

### Bulle utilisateur
- `flex justify-end`
- Bulle : `max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed`
- (Style fond user appliqué via classe — typiquement violet/doré subtil)

### Bulle assistant
- `flex justify-start`
- Markdown rendu via `ReactMarkdown` avec `prose prose-invert max-w-none`
- **Auto-linking lexique** : termes SEO (juice, maillage, EEAT, etc.) transformés en liens `/lexique#anchor` via `injectLexiconLinks()` → couleur `text-violet-400 hover:text-violet-300 underline decoration-violet-400/40`.
- Bouton **Copier** au survol : `opacity-0 group-hover:opacity-100`, icône `<Copy />` puis `<Check className="text-green-400" />` après copie.

### Indicateur de chargement (typing)
- Bulle `bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-3.5 py-2.5`
- 3 points animés : `w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-bounce` avec délais `0ms / 150ms / 300ms`
- Texte d'état : `text-[10px] text-white/40`

### Quick Replies (suggestions)
- Détectées par `extractQuickReplies()` (oui/non, listes numérotées, bullets, **bold**/**bold**)
- Boutons sous bulle : `flex flex-wrap gap-1.5 mt-2 px-1`
- Style : `px-3 py-1.5 rounded-none border border-white/15 text-white/60 text-[11px] font-medium bg-transparent hover:bg-white/5 hover:text-white/90 hover:border-white/30`
- ⚠️ **Conformité charte** : `bg-transparent` + bordure + texte (respecte la règle "pas de fond plein sur boutons").

### Bandeaux contextuels
- **Mode signalement bug actif** : bandeau `border-t border-amber-500/20 bg-amber-500/5`, texte ambré + `<Bug />` 12×12.
- **CTA bug** : bouton ambré `border-amber-500/30 bg-amber-500/10 text-amber-300`.
- **CTA refresh** : bouton `bg-[hsl(263,70%,50%)] text-white` (violet primaire) avec `<RefreshCw />`.

---

## 6. Slots de pages sélectionnées (picker)

Apparaît au-dessus de l'input quand `selectedSlots.length > 0` ou `pickingIndex !== null`.

- Conteneur : `px-4 py-2 space-y-1.5 border-t border-white/5`
- Slot rempli : `bg-[#fbbf24]/10 border border-[#fbbf24]/20 rounded-lg px-2.5 py-1`
  - Pastille : `w-1.5 h-1.5 rounded-full bg-[#fbbf24]`
  - Slug : `text-[#fbbf24] font-mono text-[11px] truncate`
  - Bouton supprimer (apparaît au survol) : `<X className="w-3 h-3 text-white/40" />`
- Slot en cours de pick : `bg-[#fbbf24]/5 border-[#fbbf24]/30 border-dashed animate-pulse`
  - `<Search className="text-[#fbbf24]" />` + texte `pickFromGraph`

### Bouton "+" ajout slot
- Position absolue : `absolute right-3 bottom-[72px]`
- Carré 18×18 : `rounded-[3px] border border-white/25 bg-transparent`
- Visible si `selectedSlots.length < MAX_SLOTS && pickingIndex === null`

### Bouton "Analyser" (déclenche prompt analyse)
- `flex justify-end px-4 py-1.5 border-t border-white/5`
- Pill doré : `bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#0f0a1e] font-semibold text-[11px]`
- Icône `<Sparkles />` + libellé `t.analyze`
- Hover : `shadow-lg shadow-[#fbbf24]/20`

---

## 7. Boutons d'action dynamiques (au-dessus de l'input)

Apparaissent en fonction du contenu du **dernier message assistant** (regex sur le contenu) :

| Détection (regex sur `content`) | Bouton | Couleur | Icône |
|---|---|---|---|
| `plan d'action / quick win / prioris` | "Ajouter au plan d'action" (`70%` largeur, centré) | `border-emerald-400/30 text-emerald-300` | `<ClipboardList />` |
| `maillage / liens internes / injection` (sans architect) | "Optimiser le maillage" | `border-emerald-400/30 text-emerald-300` | `<Syringe />` |
| `architecte / créer page / nouvelle page` (sans maillage) | "Architecte contenu" | `border-violet-500/30 text-violet-300` | `<Hammer />` |
| `stratégi / cannibali / orphelin / cluster` (sans les autres) | "Stratégie 360°" | `border-amber-500/30 text-amber-300` | `<Compass />` |

Tous : `bg-transparent`, `rounded-xl`, `text-[11px] font-medium`, hover `bg-{couleur}-500/10`.

États bouton "Ajouter au plan" :
- Succès : `border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_2px_rgba(16,185,129,0.25)]`
- Loading : `border-white/15 text-white/40 animate-pulse`

---

## 8. Zone d'input

`px-3 pb-3 pt-1 border-t border-white/5`, `flex gap-2 items-end`

### Textarea
- `<Textarea>` shadcn
- Style : `bg-white/5 border-white/10 text-white text-xs placeholder:text-white/25`
- `resize-none min-h-[36px] max-h-[10rem] overflow-y-auto rounded-xl`
- Focus ring doré : `focus-visible:ring-[#fbbf24]/30`
- Auto-resize JS : `el.style.height = Math.min(el.scrollHeight, 160) + 'px'`
- Submit : `Enter` (sans Shift) → `sendMessage()`

### Bouton micro
- `<ChatMicButton onTranscript={...} userDomains={[domain]} />`

### Bouton Send
- `<Button size="icon">` shadcn override
- `h-9 w-9 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e]`
- Disabled : `disabled:opacity-30`
- Icône : `<Send className="w-3.5 h-3.5" />`
- ⚠️ **Note charte** : ce bouton a un fond plein doré (exception assumée pour CTA principal).

---

## 9. Comportements & interactions

### États clés (React)
- `isOpen`, `isExpanded`, `showHistory`, `showArchitectModal`
- `messages[]`, `input`, `isLoading`, `isDeploying`, `deploySuccess`
- `selectedSlots[]`, `pickingIndex`, `autoPicking`
- `fontSize` (zoom texte), `chatHistoryId.current`
- `architectDraft`, `architectPrefillUrl`, `architectIsExistingPage`
- `resolvedBugCount` (badge rouge sur toggle)

### Détection d'intention
- `detectBugIntentCocoon()` — 30+ mots-clés (bug, erreur, plante, cassé, etc.)
- `detectCocoonQuizIntent()` — quiz cocoon, tester mes connaissances...
- `detectCocoonHowTo()` — comment, à quoi sert, c'est quoi, orpheline, cannibalisation...

### Auto-linking lexique
- Map `LEXICON_TERMS` : 35+ termes SEO → ancres `/lexique#xxx`
- Regex construite avec termes triés par longueur décroissante (évite matchs partiels)
- Liens : `text-violet-400 underline decoration-violet-400/40`

### Modale Content Architect
- `<CocoonContentArchitectModal>` ouverte par bouton "Architecte contenu"
- Props : `nodes, domain, trackedSiteId, hasCmsConnection, draftData, prefillUrl, isExistingPage`
- Visibilité gated par `useContentArchitectVisibility()`

### Internationalisation
- `useLanguage()` — 3 langues : `fr` (défaut), `en`, `es`
- Toutes les chaînes UI passent par l'objet `t` (`t.title`, `t.placeholder`, `t.optimize`, `t.strategy`, `t.clear`, `t.analyze`, `t.empty`, `t.pickFromGraph`, `t.selectNode`, `t.strategyBtn`...)

---

## 10. Conformité charte Crawlers

| Règle | Respect | Note |
|---|---|---|
| Couleurs : violet, jaune d'or, noir, blanc | ✅ | Palette stricte (sauf accents émeraude/ambre fonctionnels) |
| Boutons : bordure + texte (pas de fond plein) | ⚠️ Partiel | Quick replies et CTA dynamiques OK ; bouton Send + "Analyser" font exception (CTA primaires) |
| Pas d'emoji | ✅ | Aucun emoji unicode dans l'UI |
| Pas de bleu IA | ✅ | Aucun bleu type ChatGPT |
| Logo doré identique à Home | ✅ | `GoldCrawlersLogo` aligné `AIAgentsSection` |
| Distinction visuelle vs Félix | ✅ | Or vs violet — identités séparées |

---

## 11. Points de vigilance pour la refacto

1. **Préserver le `GoldCrawlersLogo`** doré (gradient `#f5c842 → #d4a853 → #b8860b`) — ne pas le confondre avec Félix violet.
2. **Garder l'auto-linking lexique** (`LEXICON_TERMS` + `injectLexiconLinks`) — feature SEO importante.
3. **Détection d'intention bug** — déclenche bandeau ambré + CTA spécifiques.
4. **Boutons d'action dynamiques** basés sur le contenu — UX clé qui guide l'utilisateur.
5. **Mode étendu (sidebar gauche pleine hauteur)** vs mode floating — deux layouts à conserver.
6. **Système de slots de pages** avec picker depuis le graphe (`pickingIndex`, `MAX_SLOTS`).
7. **Quick replies extraction** — patterns multiples (oui/non, numérotés, bullets, bold).
8. **Historique des sessions** — panneau collapsible avec sessions multiples par site.
9. **Zoom texte** (`fontSize` state) — accessibilité.
10. **Internationalisation FR/EN/ES** — toutes les chaînes externalisées.

---

## 12. Composants & dépendances couplées

- `CocoonContentArchitectModal` — modale "Architecte contenu"
- `ChatMicButton` (`@/components/Support`) — input vocal
- `SeoQuiz` (`@/components/Support`) — quiz SEO contextuel
- `useContentArchitectVisibility` — gating Content Architect
- `useAISidebar` (`@/contexts/AISidebarContext`) — coordination sidebar IA globale
- `useAuth`, `useAdmin`, `useLanguage`
- Edge functions backend appelées (chat, deploy plan, optimize, strategy 360°)

---

**Dernière mise à jour** : avant refactorisation Sprint 8 (`CocoonAIChatUnified` / `useStrategistV2Flag`).
**Fichier source** : `src/components/Cocoon/CocoonAIChat.tsx` (2143 lignes, marqué `@deprecated`).
