
## Plan : Tâches exécutables dans le Plan Cocoon

### 1. Migration DB — Ajouter les colonnes d'exécution à `cocoon_tasks`
- `action_type` : `linking` | `content` | `code` | `manual` — type d'action à exécuter
- `action_payload` (JSONB) : contexte nécessaire à l'exécution (URL cible, ancres, sélecteurs, etc.)
- `execution_status` : `pending` | `running` | `completed` | `failed` | `skipped`
- `execution_result` (JSONB) : résultat de l'exécution (logs, erreurs, liens déployés, etc.)
- `executed_at` (timestamp) : date d'exécution

### 2. UI — Refonte du modal `CocoonTaskPlanModal`
Chaque carte de tâche affichera :
- Un **badge d'action** coloré (🔗 Maillage, ✍️ Contenu, 🛠 Code, ✋ Manuel)
- Un **bouton "Exécuter"** qui déclenche l'action appropriée :
  - `linking` → appelle `cocoon-bulk-auto-linking` (auto-maillage IA)
  - `content` → ouvre l'Architecte Contenu pré-rempli OU appelle `content-architecture-advisor`
  - `code` → appelle `generate-corrective-code` + `cms-push-code`
  - `manual` → reste une checklist classique
- Un **statut d'exécution** visible (spinner, ✅ succès, ❌ échec avec message)
- Le statut passe automatiquement à `done` après exécution réussie

### 3. Alimentation automatique
Quand le Stratège Cocoon ajoute une tâche au plan (via "Ajouter au plan d'action"), le système détectera automatiquement le `action_type` et remplira le `action_payload` à partir du contexte de la recommandation.
