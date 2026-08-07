---
name: Confrontation d'audits tiers (Félix / Stratège)
description: Import d'un audit externe (PDF/DOCX/texte) dans le chat et confrontation aux données Crawlers avec 4 verdicts + actions de vérification
type: feature
---

# Confrontation d'audits externes

## Chaîne
1. Trombone du chat (`ChatAttachmentPicker`) → `src/lib/copilot/externalAuditImport.ts`
2. `POST /api/external-audit-import` (server route TanStack, PAS une edge function — la création de nouvelles edge functions est bloquée sur ce projet)
   - texte / CSV / JSON / HTML : extraction déterministe (0 LLM)
   - DOCX : `fflate` unzip `word/document.xml` (0 LLM)
   - PDF : 1 seul appel `google/gemini-3.1-flash-lite` (Lovable AI Gateway, `LOVABLE_API_KEY`), température 0, consigne de transcription stricte
   - `.doc` refusé (415), texte tronqué à 120 000 caractères
3. Insertion dans `external_audits` (RLS `auth.uid()`)
4. Envoi automatique d'un message utilisateur (helper `sendText` de `AgentChatShell`) qui déclenche la skill

## Skills (copilot-orchestrator, policy `auto` pour Félix et Stratège)
- `list_external_audits` — liste les audits importés
- `confront_external_audit` — renvoie le texte de l'audit (30k max) + instantané Crawlers
  (`tracked_sites`, dernier `site_crawls.content_integrity`, `cocoon_diagnostic_results.scores`,
  dernier `audits`) + `methodologyFor()` + consignes de sortie
- `compare_methodology` — explique le calcul de nos scores (`_shared/auditMethodology.ts`)

## Règles de verdict (imposées par les instructions de la skill)
Verdicts autorisés uniquement : **FIABLE / NON FIABLE / CONFIRMÉ PAR CRAWLERS / CONTRADICTOIRE**,
rendus en tableau markdown. `CONTRADICTOIRE` interdit sans mesure Crawlers réelle et fraîche.
Si la donnée manque, l'agent doit proposer une action et attendre l'accord :
`trigger_audit` (approval), `market_diagnosis` / `live_search` (auto, quotas), `compare_methodology`.
