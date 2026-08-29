# Audit UI/UX — Home, Console, Audit Expert, Marina, Content Architect, Administration

Date : 29/08/2026 — périmètre : `src/pages/Index.tsx`, `src/pages/Profile.tsx` + `src/components/Console/**`, `src/pages/ExpertAudit.tsx` + `src/components/ExpertAudit/**`, `src/pages/Marina.tsx` + `src/components/Marina/**`, `src/components/Cocoon/CocoonContentArchitect*`, `src/components/Admin/**`.

## Verdict en une phrase

L'intuition est juste : l'**organisation fonctionnelle est bonne**, mais trois défauts de fabrication rendent l'ensemble lourd — (1) **aucune palette unique réellement appliquée** (le violet/or coexiste avec 4 familles de couleurs parasites et ~200 hex codés en dur), (2) **aucune échelle typographique normée** (de `text-xs` à `text-5xl` sans paliers, compensée par un hack `zoom: 0.8`), (3) **une navigation à 3 niveaux imbriqués** dans la Console/Admin qui dilue la hiérarchie de l'information.

## Chiffres du diagnostic

| Mesure | Valeur | Commentaire |
|---|---|---|
| Occurrences `slate-*` | 192 | Palette Tailwind par défaut, hors charte |
| Occurrences `blue/sky/cyan/teal/indigo-*` | 560 | Couleurs interdites (bleu IA, pétrole) |
| Éléments à fond coloré plein (`bg-primary`, `bg-violet-*`…) | 1 129 | La règle « bordure + texte, jamais de fond » n'est pas tenue à l'échelle |
| Hex codés en dur | ~200 (top : `#fbbf24`, `#0f172a`, `#a78bfa`) | Aucun passage par les tokens |
| Items de navigation Console | ~21, sur un seul niveau, sans regroupement | Charge cognitive maximale à l'ouverture |
| Items de navigation Admin | 5 groupes / ~28 items + 9 sous-onglets | 3 niveaux imbriqués |
| Emoji | 0 sur les 6 surfaces auditées | Conforme |

---

## 1. Home

**Bloquant**
- `src/components/HeroSection.tsx:12` — dégradé du titre en hex arbitraires `from-[#0545a8] via-[#6a00ff] to-[#f5a800]`. Le `#0545a8` est un **bleu pur interdit**, et le dégradé contourne `--color-brand-violet` / `--color-brand-gold`.
- `src/styles.css:712` — `.home-root { zoom: 0.8; }` : toute la home est rétrécie de 20 % via une propriété non standard (ignorée par Firefox), au lieu de corriger l'échelle typographique. Casse le zoom navigateur (accessibilité) et le rendu cross-browser.

**Majeur**
- Accents `amber-500` codés à la main au lieu du token gold : `HeroSection.tsx:121`, `Index.tsx:718`.
- Sauts typographiques brusques `text-2xl` → `text-4xl` sans palier (`Index.tsx:594, 722, 813`), sur une page qui va de `text-xs` à `text-5xl`.

**Bon point** : `PageEditorial.tsx:39-68` respecte une hiérarchie propre `h2 text-2xl` → `h3 text-lg`. C'est le gabarit à généraliser.

**Recommandation** : supprimer le `zoom`, définir un scale de 6 crans (display / h1 / h2 / h3 / body / caption) dans `styles.theme.css`, et remplacer tous les dégradés par un token `--gradient-brand` violet→or.

---

## 2. Console

**Bloquant**
- `Console/GoogleServicesOnboardingModal.tsx:156,252` — palette « iOS dark » complète en dur (`#1c1c1e`, `#2c2c2e`, `#3a3a3c`), sans lien avec la charte.

**Majeur**
- Bleus interdits : `AnomalyAlertsBanner.tsx:30`, `SerpBenchmark.tsx:34,479`. Pétrole : `Profile/MyTracking.tsx:264`.
- **Navigation plate de ~21 entrées** (`ConsoleSidebar.tsx:280-345` : tracking, geo, competition, crawls, marina, reports, action-plans, corrective-codes, gmb, drafts, sea-seo, indexation, netlinking, tracking-api, gsc-bigquery, marketplace + wallet, bundle, settings, admin) sans sections. Aucune notion de « ce que je fais tous les jours » vs « ce que j'ouvre une fois par mois ».
- Empilement de densités : sidebar → onglet → Card → sous-grille `grid-cols-4` (`MyTracking.tsx:838`). Trois niveaux de découpage visuel concurrents dans la même zone d'écran.

**Majeur (hiérarchie)** — les KPI passent de 2 colonnes (`sm`) à 5 (`xl`) sans palier `md`/`lg` (`MyTracking.tsx:228`).

**Recommandation** : regrouper la sidebar en 4 sections nommées (Pilotage / Analyse / Contenu & liens / Compte), replier les 8 modules secondaires derrière « Plus », et n'exposer que 4 KPI en tête de vue, le reste en second rideau.

---

## 3. Audit Expert

**Bloquant**
- `ExpertAudit/expertReportExport.ts:494-999` — ~20 couleurs Tailwind par défaut en dur pour l'export PDF/HTML (`#f1f5f9`, `#334155`, `#fee2e2`, `#166534`, `#fbbf24`…). Les livrables client ne portent pas la marque.

**Majeur**
- Couleurs interdites diffuses dans **≥15 fichiers** : `CategoryCard.tsx:19`, `StrategicTab.tsx:221,252`, `PriorityContentCard.tsx:139-150`, `SecurityZone.tsx:104`, `LoadingSteps.tsx:168,173`, `TechnicalTab.tsx:60`, `CodeBlock.tsx:248`, etc. Le bleu y joue le rôle de couleur d'état, rôle qui devrait revenir au violet primaire.
- `ExpertAuditDashboard.tsx:1382` — `#fbbf24` au lieu du token gold.
- **7 implémentations de jauge/score** redondantes : `AEOScoreCard`, `ChunkabilityScoreCard`, `FanOutScoreCard`, `PainScoreCard`, `ScoreGauge200`, `ScoreGauge`, `GeoScoreGauge`. Épaisseurs, rayons et seuils divergent → l'utilisateur ne peut pas lire deux scores avec la même grille.

**Recommandation** : un seul `<ScoreGauge value size variant>` paramétré, et une palette d'export dérivée des tokens (3 couleurs de statut maximum).

---

## 4. Marina

**Bloquant**
- `Marina/ClaudeVerdictAnimation.tsx:95-138` — palette **recopiée de l'identité Claude/Anthropic** (`#faf9f5`, `#e3e1d7`, `#262624`) + feux macOS (`#ff5f57`, `#febc2e`, `#28c840`), 21 hex. Composant produit habillé aux couleurs d'un tiers.

**Majeur**
- `Marina.tsx` = **1 838 lignes** : pricing, features, doc API, preview et rapport empilés dans un seul fichier, avec 4 niveaux de titres (`h1` → `h4`, 7 `h4` entre les lignes 1547 et 1719). À comparer aux 117 lignes d'`ExpertAudit.tsx` qui délègue. C'est la principale cause du sentiment de « design mal hiérarchisé » sur cette page.

**Recommandation** : découper en 5 composants de section, plafonner à `h3`, et une seule densité par section (soit narrative, soit tabulaire, jamais les deux).

---

## 5. Modal Content Architect

**Bloquant**
- `Cocoon/ContentArchitectToolbar.tsx:31-43` — thème câblé en dur `bg-[#0f172a]` + `teal-500/15` + `slate-*`. La variante `green` est **identique** à `cocoon` : la prop `colorTheme` ne produit aucun effet (code mort).
- `CocoonContentArchitectModal.tsx:598-796` — 17 occurrences `slate-*`/`teal-*`/`#0f172a`/`#1e293b`. La modal a **sa propre feuille de style bleu-nuit/pétrole**, étrangère au reste de l'app : rupture visuelle franche à l'ouverture depuis une page violet/or. C'est la violation la plus systémique de l'audit.

**Bon point** : la décomposition en 12 sous-panneaux est saine, et l'objet `themes` centralise déjà la palette — la correction se fait en un seul endroit.

**Recommandation** : remplacer les deux thèmes par les tokens `--card` / `--border` / `--primary` (gold pour l'état actif), et supprimer la prop `colorTheme`.

---

## 6. Administration

**Majeur (structure)**
- `Admin/AdminDashboard.tsx:242-298` — 5 groupes, ~28 items. L'onglet `intelligence` ouvre `IntelligenceHub.tsx:21-56` avec **9 sous-onglets**. Chaîne réelle : Console (onglet admin) → Admin (5 groupes / 28 items) → Intelligence (9 onglets) = **3 niveaux imbriqués**, au-delà des 2 niveaux tenables.
- Doublon : `eeat` existe en top-level (`AdminDashboard.tsx:293`) **et** en sous-onglet (`IntelligenceHub.tsx:41`).

**Majeur (couleurs)**
- `blue-500` sur ≥10 fichiers : `SeoPageDrafts.tsx:32`, `SeoCodeProposals.tsx:40`, `ParmenionTaskPlan.tsx:61`, `WorkbenchAdmin.tsx:72,281`, `ParmenionTargetPanel.tsx:69,771,781`, `FunctionsManagement.tsx:142`, `UserManagement.tsx:24,525`, `UserKpiModal.tsx:317,323`.
- `UserManagement.tsx:26,28,733` cumule `teal`, `sky` et `blue` dans un seul fichier.
- `SocialContentDashboard.tsx:27-45` — 8 couleurs de charts en dur, à normaliser sur `heat-0..4` (`styles.theme.css:56-60`).

**Recommandation** : aplatir à 2 niveaux (une sidebar de 5 sections, les 9 onglets d'Intelligence devenant des items de la section Agents), supprimer le doublon `eeat`.

---

## Plan de correction proposé (par effet réel décroissant)

1. **Typographie** — supprimer `zoom: 0.8`, publier un scale de 6 crans, remplacer les 8 tailles ad hoc de la home et de Marina. Effet immédiat sur la perception « écrit trop gros ».
2. **Palette** — codemod des 560 `blue/sky/teal/cyan` et 192 `slate` vers les tokens ; puis passe manuelle sur les ~200 hex (priorité : modal Content Architect, `ClaudeVerdictAnimation`, `expertReportExport`).
3. **Navigation** — regroupement de la sidebar Console (4 sections + « Plus ») et aplatissement de l'Admin à 2 niveaux, doublon `eeat` supprimé.
4. **Densité** — 4 KPI maximum en tête de vue, une seule densité par section, suppression des sous-grilles imbriquées.
5. **Composants** — une jauge de score unique, découpage de `Marina.tsx` en 5 sections.
6. **Boutons** — audit exhaustif des 1 129 fonds pleins pour appliquer la règle « bordure + texte ».

## Points non tranchés

- L'audit est statique (classes et hex dans le JSX) : il ne mesure pas le contraste réellement rendu. Une passe de captures comparatives clair/sombre confirmerait les priorités visuelles.
- `#0A66C2` dans `PaymentButton.tsx:252` est le bleu de marque LinkedIn : légitime, mais à isoler dans un token `--brand-linkedin` pour ne pas polluer le décompte des violations.
