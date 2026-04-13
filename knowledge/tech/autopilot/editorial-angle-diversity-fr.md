# Memory: tech/autopilot/editorial-angle-diversity-fr
Updated: 2026-04-13

## Diversification des angles éditoriaux — Parménion

### Problème résolu
Parménion générait uniquement des articles type "Guide Complet" pour les sites clients (ex: IKtracker), créant 62 articles quasi-identiques en format et en angle.

### 5 stratégies d'angle obligatoires

| Angle | Description | Exemple (IKtracker) |
|-------|-------------|---------------------|
| **Persona** | Ciblage par métier/profil dans le titre | "Comment les infirmières gèrent leurs IK" |
| **Actualité** | Accroche sur événement récent, réforme, nom propre | "PLF 2026 : impact sur les frais pro" |
| **Niche étroit** | UNE question ultra-spécifique, format court | "Peut-on déduire les péages de ses IK ?" |
| **Comparatif** | Opposer 2 options, idée reçue, démystification | "Diesel vs électrique : impact sur vos IK" |
| **Tutoriel pratique** | Pas un guide — une procédure concrète pas-à-pas | "Remplir le 2042 pour ses frais en 5 min" |

### Implémentation technique

1. **Prompt contenu** (`parmenion-orchestrator`): Les anciens exemples "guide complet" sont remplacés par les 5 angles avec exemples concrets. L'instruction explicite interdit le "guide complet" par défaut.

2. **Diversity block** (`contentBrief.ts` → `buildDiversityPromptBlock`): Ajoute une section "ANGLES ÉDITORIAUX" dans le bloc injecté, rappelant les 5 angles et imposant l'alternance.

3. **Gardes existants conservés**: Le cap de 5% max pour les "guides" reste actif, la taxonomie article_type et semantic_ring sont inchangées.

### Fichiers modifiés
- `supabase/functions/parmenion-orchestrator/index.ts` (prompt contenu)
- `supabase/functions/_shared/contentBrief.ts` (buildDiversityPromptBlock)
