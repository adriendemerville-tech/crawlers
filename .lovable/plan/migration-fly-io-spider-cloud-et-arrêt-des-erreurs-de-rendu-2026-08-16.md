# Migration Fly.io → Spider.cloud et arrêt des erreurs de rendu

## Constat

Le rendu JavaScript des pages (utilisé par les audits, Marina, le crawl et les scans machine) repose sur une cascade : Browserless en premier, puis Fly.io, puis Spider.cloud.

Deux problèmes :

1. **Fly.io est suspendu et ne répond plus.** Chaque tentative attend le timeout avant de basculer, ce qui ralentit toute la chaîne et fait échouer des jobs sur limite de temps.
2. **Des routes internes protégées par connexion** (`/app/site-crawl`, `/cf-shield`, `/app/console`, etc.) sont envoyées au rendu JS. Sans session, la page reste une coquille vide, le moteur attend un contenu qui n'arrivera jamais, et on obtient des erreurs 500 en série (14 en une heure sur le tableau de bord admin) — tout en payant des appels de rendu inutiles.

La vraie économie ne vient pas du choix Fly vs Spider, mais de l'arrêt des rendus inutiles.

## Ce qui va être fait

### Étape 1 — Ne plus jamais rendre les routes internes protégées

Ajout d'une liste d'exclusion : pour les URLs de crawlers.fr sous `/app/*`, `/cf-shield`, `/auth`, `/console` et assimilées, le rendu JS est court-circuité. On retourne le HTML statique tel quel, avec une note explicite « page protégée par authentification — rendu JS non applicable » remontée dans les audits.

Effet attendu : disparition de la quasi-totalité des erreurs 500 Browserless et du coût associé.

### Étape 2 — Retirer Fly.io de la cascade

La cascade devient : **Browserless → Spider.cloud → auto-rendu interne**.

Fly.io n'est plus appelé nulle part dans le chemin de rendu. Le code Fly reste présent mais inerte, activable uniquement si les variables d'environnement Fly sont reconfigurées un jour (drapeau explicite, désactivé par défaut). Les fichiers concernés : le module de rendu partagé, `fetch-external-site`, `audit-expert-seo`, `machine-layer-scan`, `dry-run-script`.

Effet attendu : plus d'attente inutile sur un service mort, jobs plus rapides, moins de dépassements de temps.

### Étape 3 — Limiter le coût Spider

- Un seul appel Spider par URL, jamais de nouvelle tentative en boucle.
- Cache court (24 h) du HTML rendu par URL, pour éviter de repayer la même page pendant un audit multipage ou un enchaînement d'audits.
- Le rendu Spider n'est déclenché que si la page statique est réellement insuffisante (les seuils de détection actuels sont conservés, mais on n'accepte plus le rendu s'il n'apporte rien).
- Chaque appel Spider continue d'être tracé comme appel payant, pour suivi dans le tableau de bord finances.

### Étape 4 — Mettre le tableau de bord admin en cohérence

Le bandeau « Browserless — Service en erreur » affiche aujourd'hui « Fly.io : aucun fallback détecté », ce qui est trompeur. Il affichera désormais l'état réel du repli Spider (nombre de rendus repris, dernier succès), et le bouton de test Fly est remplacé par un test Spider. La fonction `fly-health-check` reste, mais n'est plus utilisée dans l'alerte.

### Étape 5 — Vérification

- Test de rendu sur une page publique externe (doit passer par Browserless ou Spider et remonter du contenu).
- Test sur `/app/site-crawl` (doit être ignoré sans erreur ni appel payant).
- Relecture des journaux d'erreurs sur une fenêtre d'une heure : l'objectif est zéro `browserless_error` sur les routes internes.
- Vérification du compteur d'appels payants Spider avant/après pour confirmer la baisse.

## Notes techniques

- Liste d'exclusion centralisée dans le module de rendu partagé, appliquée avant la détection SPA, afin que tous les appelants en bénéficient sans modification.
- Cache de rendu via une table dédiée à clé URL canonique (réutilisation de la normalisation d'URL déjà en place pour le crawl), TTL 24 h.
- `SPIDER_API_KEY` doit être présent : vérification faite au début de la mise en œuvre, sinon la cascade se limite à Browserless.
- Aucune modification du contrat de retour du rendu : les appelants (Marina, Parménion, audits) restent inchangés.
