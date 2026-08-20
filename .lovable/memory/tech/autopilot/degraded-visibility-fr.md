---
name: Parménion — remontée UI des cycles dégradés
description: Compteur d'incidents 7 j et causes lisibles dans ParmenionExecutionStatus, plus kick advisor à 3 tentatives avant de dégrader un cycle
type: feature
---
# Cycles dégradés : plus d'échec silencieux

## UI
`ParmenionExecutionStatus` affiche par site :
- un badge `N incidents / 7 j` comptant les `parmenion_decision_log` en `degraded`, `partial` ou `failed` sur 7 jours ;
- un bloc « Cycles dégradés — causes » listant les 5 derniers incidents (phase, statut, ancienneté) avec les messages extraits de `execution_error`.

`execution_error` peut être un tableau JSON d'erreurs de phase (`{function, message, severity}`) ou du texte brut : le parsing gère les deux et n'échoue jamais. Un incident sans cause enregistrée est affiché comme tel plutôt que masqué.

## Cause racine traitée
Les `degraded` de type `cms` venaient d'un `HTTP 503` au démarrage de `content-architecture-advisor` (CPU wall-time à froid). `autopilot-engine` tombait alors dans une branche synchrone et dégradait le cycle.

Désormais le lancement du job advisor tente 3 modes en séquence avec backoff : `async` → `async` (retry 4 s) → `staged: true` (research → synthesis via `job_queue`, aucun boot long). Le cycle n'est dégradé que si les 3 échouent, et le message porte le détail HTTP de chaque tentative.
