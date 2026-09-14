# Périclès — scan concurrentiel et attribution GEO dans la boucle

## Réponse courte aux deux questions

- **`prescribe` n'est pas supprimée.** Elle continue de choisir l'action, le cluster et la page cible. Rien ne change à cette étape.
- **À quelle étape ?** Deux photos SERP et deux photos IA sont ajoutées **autour de l'exécution** :
  - photo **avant** juste après `execute` ;
  - photo **après** au moment de la mesure (`pericles_measure_rewards`, J+14 pour le SEO, J+30 pour l'IA).
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

## Revue critique de ce plan

Passé au crible, tout n'est pas nécessaire au même titre.

**Nécessaire, et c'est le vrai défaut de la boucle :**

- Le cycle de vie du constat (Bloc 4). Aujourd'hui un constat exécuté sort de la
  file avant d'être jugé : la boucle ne peut structurellement pas apprendre de
  ses échecs. Sans ça, les deux autres blocs mesurent dans le vide.
- L'attribution de la visibilité IA (Bloc 2). Les mesures existent déjà et sont
  déjà payées ; il ne manque qu'une colonne de rattachement. Coût quasi nul,
  gain immédiat, aucun risque.

**Nécessaire mais à conditionner (correction apportée au Bloc 1) :**

- Scanner la concurrence sur **chaque** décision, deux fois, était surdimensionné :
  cela achète de la donnée SERP pour 80 % de décisions dont le résultat GSC est
  déjà clair. Le scan ne sert qu'à **arbitrer un échec** : « ai-je mal fait, ou
  un concurrent a-t-il fait mieux ? ». Il devient donc conditionnel.

**Superflu, retiré :**

- Un scan `before` systématique. La photo « avant » se reconstitue depuis le pool
  SERP et `keyword_universe`, qui historisent déjà les positions. Une seule photo
  payée, au moment de l'arbitrage, suffit.
- Un terme de score dédié au contexte marché. Un troisième terme dans
  `score_spiral_priority` rend le score illisible pour un gain marginal. Le
  contexte marché sert à **neutraliser** une récompense négative injuste, pas à
  créer un signal parallèle.

**Risque principal restant :** attribuer un delta à une action. Ni le SEO ni
l'IA ne donnent de causalité propre. Le plan ne prétend donc pas mesurer une
cause, seulement écarter les faux échecs les plus évidents.

## Bloc 1 — Arbitrage concurrentiel (conditionnel)

Déclenchement : **uniquement** quand la récompense GSC mesurée est négative.
Aucun scan quand l'action a visiblement réussi.

- Nouvelle fonction `pericles-competitive-scan`, entrée `{ decision_id }`, une
  seule phase : l'état du marché au moment du verdict.
- 3 mots-clés maximum du cluster visé, lus via le **pool SERP mutualisé**
  (`_shared/serpPool.ts`, classe `position`, TTL 24 h) — jamais DataForSEO en
  direct. Coût nul quand un autre module a déjà payé la requête.
- Position « avant » reconstituée depuis l'historique déjà stocké
  (`keyword_universe`, `serp_pool`) : aucune requête supplémentaire.
- Table `pericles_competitive_snapshots` (décision, mot-clé, notre position,
  top 5 domaines et positions, date), RLS propriétaire + service role, `GRANT`
  explicites.

Effet unique : qualifier l'échec.

- Un concurrent identifié a pris la place → `market_context = 'competitor_gain'`,
  récompense négative **neutralisée** (ramenée à 0), motif nommé dans le Workbench.
- Personne n'a bougé au-dessus de nous → `market_context = 'self_loss'`,
  récompense négative conservée telle quelle.
- Scan impossible ou plafond atteint → `market_context = null`, récompense
  conservée. Jamais de neutralisation par défaut.

## Bloc 2 — Attribution de la visibilité IA

- Ajout d'un lien décision sur les mesures de visibilité IA (`geo_visibility_snapshots.pericles_decision_id`, plus la phase).
- Photo avant à l'exécution, photo après à J+30 (le délai réel d'un changement de citation), sur la rotation quotidienne existante — pas d'augmentation du nombre de modèles interrogés.
- Nouveau signal `geo_reward_signal` sur la décision : delta du taux de citation et du score global, mesuré seulement si les deux photos existent.

## Bloc 3 — Réinjection

- `pericles_measure_rewards` reste le juge unique : il applique la neutralisation du contexte marché puis écrit `geo_reward_signal`, dans la même transaction que la récompense existante.
- `score_spiral_priority` ajoute **un seul** terme borné : récompense IA entre −6 et +6, repli neutre quand la mesure est absente. Le contexte marché n'entre pas dans le score, il corrige la récompense en amont.
- Le seuil de pause automatique reste piloté par le seul signal GSC : un marché défavorable ne doit pas geler un domaine.

## Bloc 4 — Cycle de vie du constat dans le Workbench

Aujourd'hui un constat exécuté passe en `done` tout de suite : la boucle perd la
trace au moment même où la mesure commence. C'est le vrai défaut.

Réponse directe : **le constat reste dans le Workbench pendant toute la durée de
la mesure**, puis il est classé selon le verdict.

Nouveau cycle, sans nouvelle file :

```text
pending ─► in_progress ─► executed (mesure en cours) ─► done | regressed
```

- `executed` : l'action est faite mais pas encore jugée. Le constat **reste
  visible** dans le Workbench, en lecture seule, avec la date de mesure attendue.
  C'est le seul état qui permet de suivre l'action jusqu'au verdict.
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
## Ordre de réalisation

1. Bloc 4 (cycle de vie) puis Bloc 2 (attribution IA) : coût quasi nul, aucune
   dépendance externe, bénéfice immédiat sur la boucle.
2. Bloc 1 (arbitrage concurrentiel) une fois qu'il y a des récompenses négatives
   réellement mesurées à arbitrer — sinon on construit un juge sans dossier.
3. Bloc 3 (réinjection) en dernier, quand les deux signaux existent.

## Coût et garde-fous

- SERP : au maximum 3 requêtes, et seulement sur une décision jugée négative,
  donc une minorité. Mutualisées et mises en cache 24 h. Plafond dur par domaine
  et par jour, sinon la décision reste « non arbitrée ».
- IA : aucun appel supplémentaire, seulement le rattachement des mesures déjà planifiées.
- LLM : zéro appel ajouté à la boucle.
- Invariant : une mesure manquante ne devient jamais un zéro. Elle reste
  « non mesurée » et n'influence ni le score ni la récompense.

## Détails techniques

- `supabase/functions/pericles-competitive-scan/index.ts` : nouvelle fonction, entrée `{ decision_id }`, lecture via `getSerp`, appelée seulement sur récompense négative.
- Migration : table `pericles_competitive_snapshots`, colonnes `market_context` et `geo_reward_signal` sur `pericles_decision_log`, colonne de rattachement sur `geo_visibility_snapshots`, nouveaux états sur `architect_workbench`.
- Migration : mise à jour de `pericles_measure_rewards` (neutralisation par contexte marché, récompense IA) et de `score_spiral_priority` (un seul terme borné ajouté).
- `supabase/functions/cron-geo-pipeline/index.ts` : propage la décision et la phase à `snapshot-geo-visibility`.
- `supabase/functions/workbench-hygiene/index.ts` : exclut `executed` du plafond de 40, archive au-delà de 45 jours.
- UI : colonnes « en mesure », « verdict » et « effet IA » dans le Workbench et le tableau de bord Périclès, en lecture seule.
