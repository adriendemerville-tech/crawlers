# Périclès — scan concurrentiel et attribution GEO dans la boucle

## Réponse courte aux deux questions

- **`prescribe` n'est pas supprimée.** Elle continue de choisir l'action, le cluster et la page cible. Rien ne change à cette étape.
- **À quelle étape ?** Deux photos SERP et deux photos IA sont ajoutées **autour de l'exécution** :
  - photo **avant** juste après `execute` ;
  - photo **après** au moment de la mesure (`pericles_measure_rewards`, J+14 pour le SEO, J+30 pour l'IA).
- **Comment ça communique ?** Tout est rattaché à l'identifiant de la décision (`pericles_decision_log`). La mesure enrichit deux nouveaux signaux sur cette même ligne, et le score de priorité les relit au tour suivant. Aucun nouvel orchestrateur, aucun appel LLM.
- **Comment ça communique ?** Tout est rattaché à l'identifiant de la décision (`pericles_decision_log`). La mesure enrichit deux nouveaux signaux sur cette même ligne, et le score de priorité les relit au tour suivant. Aucun nouvel orchestrateur, aucun appel LLM.

```text
prescribe ──► execute ──┬─► photo AVANT : positions concurrents + visibilité IA
                        │
                        └─► (délai 14 / 30 j)
                                  │
mesure ──► photo APRÈS ──► récompense GSC (existante)
                        + contexte marché (nouveau)
                        + récompense IA (nouveau)
                                  │
                        réinjection dans le score de priorité
                                  │
                        prochain tour : prescribe reçoit le score mis à jour
```

## Ce qui manque aujourd'hui

1. La récompense ne regarde que nos propres clics/positions GSC : une baisse due à un concurrent qui progresse est comptée comme un échec de notre action.
2. Les mesures de visibilité IA existent mais ne sont rattachées à aucune décision : impossible de dire quelle action a fait bouger les citations.

## Bloc 1 — Scan concurrentiel (amont / aval)

- Nouvelle fonction `pericles-competitive-scan`, appelée avec un identifiant de décision et une phase (`before` / `after`).
- Elle prend les 3 à 5 mots-clés du cluster visé par la décision et interroge le **pool SERP mutualisé** (`_shared/serpPool.ts`, classe `position`, TTL 24 h) — jamais DataForSEO en direct, donc coût quasi nul quand un autre module a déjà payé la requête.
- Elle enregistre pour chaque mot-clé : notre position, les 5 premiers domaines et leur position.
- Table `pericles_competitive_snapshots` (décision, phase, mot-clé, notre position, top 5, date), RLS propriétaire + service role, `GRANT` explicites.

À la mesure, comparaison des deux phases pour produire un **contexte marché** :

- notre position s'améliore et les concurrents stagnent → gain propre, récompense pleine ;
- tout le monde progresse ou recule ensemble → mouvement de marché, récompense atténuée ;
- nous reculons pendant qu'un concurrent identifié gagne la place → perte concurrentielle nommée, remontée dans le Workbench.

## Bloc 2 — Attribution de la visibilité IA

- Ajout d'un lien décision sur les mesures de visibilité IA (`geo_visibility_snapshots.pericles_decision_id`, plus la phase).
- Photo avant à l'exécution, photo après à J+30 (le délai réel d'un changement de citation), sur rotation quotidienne pour garder le budget IA actuel — pas d'augmentation du nombre de modèles interrogés.
- Nouveau signal `geo_reward_signal` sur la décision : delta du taux de citation et du score global, mesuré seulement si les deux photos existent.

## Bloc 3 — Réinjection

- `pericles_measure_rewards` écrit les deux nouveaux champs en même temps que la récompense existante, dans la même transaction : un seul juge, pas de second mécanisme concurrent.
- `score_spiral_priority` ajoute deux termes bornés, volontairement plus faibles que le signal GSC : contexte marché entre −8 et +6, récompense IA entre −6 et +6, avec repli neutre quand la mesure est absente.
- Le seuil de pause automatique reste piloté par le seul signal GSC : un marché défavorable ne doit pas geler un domaine.

## Bloc 4 — Cycle de vie du constat dans le Workbench

Aujourd'hui un constat exécuté passe en `done` tout de suite : la boucle perd la
trace au moment même où la mesure commence. C'est le vrai défaut.

Nouveau cycle, sans nouvelle file :

```text
pending ─► in_progress ─► executed (mesure en cours) ─► done | regressed
```

- `executed` : l'action est faite mais pas encore jugée. Le constat **reste
  visible** dans le Workbench, en lecture seule, avec la date de mesure attendue.
- `done` : mesure terminée et récompense positive. Le constat sort de la file.
- `regressed` : mesure terminée et récompense négative. Le constat redevient
  éligible, avec le motif (perte propre ou perte concurrentielle nommée) et le
  compteur de tentatives incrémenté.
- Les états `executed` **ne comptent pas** dans le plafond de 40 constats actifs
  par domaine, sinon la file se bouche pendant les 14 à 30 jours de mesure.
- `workbench-hygiene` archive un `executed` jamais mesurable au bout de 45 jours,
  en `dismissed` et jamais en `done`.

## Conséquences de la mesure du ROI

Ce que la mesure change concrètement dans le cycle :

- **Le ROI devient une donnée, pas une promesse.** Chaque action porte son gain
  mesuré en clics, position et citations IA. On peut dire quel type d'action
  rapporte sur un domaine donné, et arrêter ceux qui ne rapportent rien.
- **Le ROI face à la concurrence sépare deux échecs très différents :** perdre
  parce que notre action était mauvaise, ou perdre parce qu'un concurrent a
  investi plus. Le premier justifie de refaire autrement ; le second justifie
  de changer de terrain, pas de s'acharner.
- **Effet de sélection :** le score de priorité privilégie progressivement les
  familles d'actions rentables sur ce domaine. Risque à surveiller : un
  enfermement sur ce qui marche déjà. D'où des bornes volontairement faibles sur
  les nouveaux signaux et le maintien de la rotation de clusters existante.
- **Effet sur la pause automatique :** inchangée, toujours pilotée par le seul
  signal GSC. Un marché globalement défavorable ne doit pas geler un domaine dont
  les actions sont saines.
- **Effet de latence :** un jugement fiable coûte 14 jours en SEO et 30 en IA. La
  boucle reste donc lente par nature ; la vitesse vient du nombre d'actions en
  parallèle, pas du raccourcissement des fenêtres.
- **Limite assumée :** un delta n'est pas une preuve de causalité. Une mise à
  jour d'algorithme ou une saisonnalité peut porter le gain. Le contexte marché
  réduit ce biais sans le supprimer, et rien n'est présenté comme certain.


## Coût et garde-fous

- SERP : 3 à 5 requêtes par décision et par phase, mutualisées et mises en cache 24 h. Plafond dur par domaine et par jour, sinon la phase est marquée non mesurée.
- IA : aucun appel supplémentaire, seulement le rattachement des mesures déjà planifiées.
- LLM : zéro appel ajouté à la boucle.
- Invariant : une phase manquante ne devient jamais un zéro. Elle reste « non mesurée » et n'influence pas le score.

## Détails techniques

- `supabase/functions/pericles-competitive-scan/index.ts` : nouvelle fonction, entrée `{ decision_id, phase }`, lecture via `getSerp`.
- `supabase/functions/autopilot-engine/index.ts` : déclenche la phase `before` après `execution_completed_at`, en tâche non bloquante.
- Migration : table `pericles_competitive_snapshots`, colonnes `market_context_signal` et `geo_reward_signal` sur `pericles_decision_log`, colonnes de rattachement sur `geo_visibility_snapshots`.
- Migration : mise à jour de `pericles_measure_rewards` (calcul du contexte marché et de la récompense IA) et de `score_spiral_priority` (deux termes bornés).
- `supabase/functions/cron-geo-pipeline/index.ts` : propage la décision et la phase à `snapshot-geo-visibility`.
- UI : colonne « contexte marché » et « effet IA » dans le Workbench et le tableau de bord Périclès, en lecture seule.
