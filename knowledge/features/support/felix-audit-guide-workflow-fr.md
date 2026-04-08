# Memory: features/support/felix-audit-guide-workflow-fr
Updated: 2026-04-08

## Workflow post-audit guidé de Félix

### Déclenchement
- Événement `expert-audit-complete` (CustomEvent avec `detail: { source, url }`)
- Émis par : `ExpertAuditDashboard` (audit stratégique) et `MatricePrompt` (matrice)
- Condition : Félix doit être en mode étendu (`isExpanded`)
- Anti-doublon : `auditGuideTriggered.current` tracke le dernier `source_url`

### Étapes du workflow
1. **ask_summary** — "Veux-tu que je te résume les résultats ?" + boutons Oui/Non
2. **show_priorities** — Fetch `architect_workbench` (top 15 findings actifs), affiche sentiment + compteurs par sévérité, puis 3 boutons priorité (🔴 Critique, 🟠 Important, 🟡 Recommandé)
3. **show_solutions** — Au clic priorité : liste les problèmes avec source, catégorie, description. Calcule le lane dominant (code vs content). Propose groupement par type.
4. **confirm_implement** — "Veux-tu implémenter [lane dominant] ?" + boutons Oui/Non
   - Oui → ouvre Code Architect (`/architecte-generatif`) ou Content Architect (modale)
   - Non → propose mise à jour du plan d'action
5. **confirm_action_plan** — "Veux-tu mettre à jour le plan d'action ?" + boutons Oui/Non
   - Oui → confirme mise à jour Console
   - Non → "Tu peux revenir via l'historique 🕐"

### Cas spécial : workbench vide
- Si 0 findings actifs → "Bravo ! Aucun problème critique détecté."

### Source mapping dans les solutions
- `audit_tech` → Audit technique
- `audit_strategic` → Audit stratégique  
- `cocoon` → Stratège Cocoon
- `felix` → Félix
- `parse-matrix-hybrid` → Matrice
