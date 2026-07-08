# Backlog Front — Composants > 800 lignes non audités
Date : 2026-07-08 · Source : `find src -name "*.tsx|*.ts" | wc -l` (hors `types.ts` autogen et fichiers `data/`)

Périmètre : composants front dépassant 800 lignes qui n'ont **pas encore** été audités dans les Vagues 1 à 3 de `RECOMMANDATIONS.md`.

**Déjà audités** (exclus de cette liste) : `AuditCompare.tsx` (1 677 l.), `ConversionOptimizer.tsx` (848 l.), `SerpBenchmark.tsx` (498 l.), `AnnotatedPageView.tsx` (478 l.).

---

## Priorité HAUTE — > 1 500 lignes (6 composants)
| Fichier | Lignes | Contexte / hypothèse |
|---|---|---|
| `src/components/Cocoon/CocoonAIChat.tsx` | 2 143 | Chat IA cocoon — coût LLM élevé, à croiser avec Vague 2 Cocoon |
| `src/components/Support/ChatWindow.tsx` | 2 137 | SAV / Félix — volume user élevé, chat streaming |
| `src/components/ExpertAudit/CorrectiveCodeEditor/SmartConfigurator/index.tsx` | 2 109 | Éditeur code Expert Audit — critique fiabilité |
| `src/components/ExpertAudit/ExpertAuditDashboard.tsx` | 1 671 | Dashboard Expert Audit — à croiser avec Vague 3 partie 5 |
| `src/pages/MatricePrompt.tsx` | 1 639 | Front matrix — à croiser avec Vague 3 partie 6 |
| `src/pages/Marina.tsx` | 1 510 | Module prospection B2B — voir `mem://features/prospecting/marina-module-fr` |

## Priorité MOYENNE — 1 000 à 1 500 lignes (14 composants)
| Fichier | Lignes | Contexte / hypothèse |
|---|---|---|
| `src/components/Profile/ExternalApisTab.tsx` | 1 419 | Config APIs externes profil |
| `src/components/Profile/GMBDashboard.tsx` | 1 408 | Dashboard Google My Business — `mem://features/pro-agency/gmb-dashboard-fr` |
| `src/pages/Cocoon.tsx` | 1 346 | Page cocoon principale |
| `src/pages/SiteCrawl.tsx` | 1 327 | Page crawl — à croiser avec Vague 3 partie 1 |
| `src/components/Admin/BlogManagement.tsx` | 1 220 | Admin blog — `mem://tech/admin/cms-dashboard-v2-fr` |
| `src/components/Cocoon/CocoonForceGraph3D.tsx` | 1 213 | Graph 3D cocoon — perf WebGL |
| `src/components/Profile/SmartCmsConnectModal.tsx` | 1 191 | Wizard CMS — `mem://features/cms/custom-rest-api-key-registration-fr` |
| `src/components/Admin/FinancesDashboard.tsx` | 1 182 | Admin finances |
| `src/components/Profile/MyTracking.tsx` | 1 169 | Suivi tracking profil (couplé au hook 932 l.) |
| `src/components/Cocoon/CocoonForceGraph.tsx` | 1 148 | Graph 2D cocoon |
| `src/pages/Tarifs.tsx` | 1 142 | Page tarifs — statique probablement à alléger |
| `src/components/Admin/UserManagement.tsx` | 1 102 | Admin users |
| `src/components/Cocoon/CocoonRadialGraph.tsx` | 1 083 | Graph radial cocoon |
| `src/pages/Lexique.tsx` | 1 064 | Page lexique SEO — probablement statique |
| `src/components/Profile/PromptMatrixCard.tsx` | 1 023 | Card matrix profil |

## Zone GRISE — 800 à 1 000 lignes (9 composants)
| Fichier | Lignes | Contexte / hypothèse |
|---|---|---|
| `src/pages/ContentArchitectPage.tsx` | 980 | Content Architect — `knowledge/tech/architecture/content-architect-and-console-fr.md` |
| `src/hooks/useMyTracking.ts` | 932 | Hook tracking (couplé à `MyTracking.tsx`) |
| `src/pages/Aide.tsx` | 929 | Page aide — statique probable |
| `src/hooks/useCrawlEngine.ts` | 897 | Hook crawl — à croiser avec Vague 3 partie 1 |
| `src/pages/Index.tsx` | 896 | Home page |
| `src/components/LLMDashboard.tsx` | 881 | Dashboard LLM |
| `src/components/Profile/WordPressConfigCard.tsx` | 864 | Config WordPress |
| `src/components/Profile/LLMDepthCard.tsx` | 848 | Card LLM depth |
| `src/components/Admin/CtoSupervisor.tsx` | 830 | Admin CTO supervisor |

---

## Top 3 candidats prioritaires (impact usage × complexité)
1. **`Support/ChatWindow.tsx`** (2 137 l.) — SAV/Félix, streaming, volume users
2. **`Cocoon/CocoonAIChat.tsx`** (2 143 l.) — chat IA cocoon coûteux LLM
3. **`ExpertAudit/SmartConfigurator/index.tsx`** (2 109 l.) — critique fiabilité éditeur Expert

## Notes de méthode
- Refaire un `find` à chaque nouvelle vague : ces tailles évoluent vite (une nouvelle feature front peut ajouter 500 l. en 2 semaines).
- Exclure systématiquement : `src/integrations/supabase/types.ts` (autogen 14k l.), `src/data/*` (contenu statique).
- Pour chaque audit : rédiger d'abord un brief (`knowledge/audits/{feature}/brief-YYYY-MM-DD.md`) selon le canevas `skill/audit-brief`.
