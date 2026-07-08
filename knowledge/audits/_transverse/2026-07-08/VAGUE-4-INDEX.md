# Vague 4 — Index des briefs
Date : 2026-07-08

Angle transverse : cohérence avec **Copilot orchestrator + skills + vector memory + prompt safety layer**.

## 6 briefs produits en parallèle

| # | Feature | Fichier | Baseline |
|---|---|---|---|
| 1 | Workflow Audit SEO | `knowledge/audits/workflow-audit-seo/brief-2026-07-08.md` | delta vs Vague 3 (`expert-seo/brief-2026-07-08.md`) |
| 2 | Workflow Audit GEO | `knowledge/audits/workflow-audit-geo/brief-2026-07-08.md` | première itération dédiée |
| 3 | Content Architect | `knowledge/audits/content-architect/brief-2026-07-08.md` | première itération |
| 4 | Code Architect | `knowledge/audits/code-architect/brief-2026-07-08.md` | première itération |
| 5 | Breathing Spiral | `knowledge/audits/breathing-spiral/brief-2026-07-08.md` | première itération dédiée algorithme |
| 6 | Marina | `knowledge/audits/marina/brief-2026-07-08.md` | première itération complète |

## Ordre suggéré d'exécution
1. #1 SEO (delta, rapide, valide la méthode Vague 4)
2. #5 Breathing Spiral (transverse, impacte #3 et #6)
3. #2 GEO (isolé, gros volume)
4. #3 Content Architect (dépend de #5 pour cluster diversity)
5. #4 Code Architect (isolé, sécurité prioritaire)
6. #6 Marina (dépend de #1, #2, #5 — vérifie non-duplication)

## Règles Vague 4
- Chaque audit livre `knowledge/audits/{slug}/audit-2026-07-08.md` référençant son brief
- Chaque audit vérifie l'intégration Copilot (skill déclarable, vector memory, prompt safety)
- Chaque audit re-check la contrainte design Crawlers (violet/or/noir/blanc, bordure sans fond, pas d'emoji, pas de bleu IA)
- Ne pas lancer les audits sans validation utilisateur des briefs (skill/audit-brief §1)
