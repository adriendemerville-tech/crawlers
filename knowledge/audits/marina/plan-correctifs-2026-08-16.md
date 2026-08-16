# Plan de correctifs — chaîne d'audit Marina (2026-08-16)

Référence : `report-critique-consolidee-2026-08-16.md` (note consolidée 43/100).
Cible : 85-90/100.

Principe directeur : **Marina n'est qu'un assembleur.** Presque tous les défauts
constatés naissent en amont, dans les outils qu'elle appelle. Corriger uniquement
`marina/index.ts` reviendrait à masquer les symptômes et laisserait `/audit`
(audit technique + audit stratégique GEO), le Cocoon, Parménion et le Workbench
avec les mêmes défauts. Chaque lot ci-dessous corrige donc **la source**, puis
Marina consomme.

## Périmètre réel de la chaîne

| Maillon | Fonction / module | Appelé par Marina |
|---|---|---|
| Audit technique | `audit-expert-seo` | `callFunction` phase 1a |
| Audit stratégique GEO | `strategic-orchestrator` → `audit-strategique-ia` + `_shared/strategicAudit/*` | phase 1b |
| Crawl multi-page | `crawl-site` + `process-crawl-queue` | phase 2 |
| Cocoon / maillage | `calculate-cocoon-logic` | phase 3 |
| Visibilité LLM | `calculate-llm-visibility` | phase 3 |
| Ton éditorial | `analyze-voice-tone` | phase 3 |
| Intégrité de contenu | `_shared/contentIntegrity/*` | phase 2 |
| Autorité / marché | `_shared/domainAuthority.ts`, `_shared/marketObservations.ts` | phase 1b |
| Verdict & synthèse | `_shared/strategicVerdict.ts`, `_shared/topPriorities.ts`, `_shared/roiWeighting.ts` | phases 3-4 |
| Sorties | `_shared/marinaWorkbench.ts`, `archetypeWorkbench.ts`, `aeoRewrites.ts` → Workbench → Parménion / Stratège Cocoon | phase 4 |

## Lot 1 — Preuve sociale déterministe (P0, défauts 1 et 4)

Nouveau module partagé `_shared/socialProof.ts`, à trois couches, avec une règle dure :
**une couche supérieure ne peut jamais infirmer une couche inférieure.**

1. Couche on-site (0 token) : lecture de `AggregateRating` / `Review` / `Organization`
   dans le JSON-LD déjà extrait par `crawl-site`, plus détection de compteurs d'avis
   et de témoignages dans le DOM.
2. Couche sources externes (cache 24 h) : Google Places (note + volume d'avis),
   Trustpilot, plateformes sectorielles détectées via les liens sortants du site.
3. Couche LLM : **qualification uniquement** (ton, fraîcheur, cohérence). Interdiction
   d'émettre `has_reviews: false` ; en l'absence de signal, statut `non concluant`.

Consommateurs à câbler dans le même lot :
- `_shared/strategicAudit/pageAnalyzer.ts` + `prompts.ts` : les signaux E-E-A-T reçoivent
  le résultat déterministe en entrée, le prompt ne peut plus l'inventer.
- `_shared/strategicPrompts.ts` : suppression du jugement `social_proof` par LLM libre.
- `audit-expert-seo` : même source pour le score E-E-A-T de `/audit`.
- Score GEO « schema » alimenté par les types réellement détectés au crawl (défaut 4),
  pas par une seconde estimation LLM.

## Lot 2 — Garde-fou d'entrée/sortie LLM (P0, défaut 2)

Dans `_shared/lovableAI.ts` (donc pour tous les appelants, pas seulement Marina) :
- refus d'appel si le contexte de page utile est vide → module marqué `non concluant` ;
- filtre de sortie rejetant toute chaîne de gabarit de prompt (`CONTENU PAGE:`,
  `Utilise ces informations`, balises internes) avant écriture d'un rapport ;
- interdiction de toute année codée en dur dans les prompts (défaut 19) : injection
  systématique de l'année courante.

## Lot 3 — Boilerplate retiré avant analyse (P0, défaut 3)

`_shared/contentIntegrity/normalize.ts` sait déjà retirer navigation et footer.
- L'extraction du premier paragraphe (analyse AEO / réponse directe) passe par
  `normalize.ts` avant tout calcul et tout prompt.
- Même normalisation appliquée dans `audit-expert-seo` (ratio texte/code, thin content)
  et dans `calculate-cocoon-logic` (similarité et clusters), pour que le méga-menu
  n'alimente plus ni la similarité ni le comptage de mots.

## Lot 4 — Réconciliation des compteurs et clamp des scores (P1, défauts 5-11)

Nouveau module `_shared/auditReconciliation.ts` appliqué en fin de phase 3 :
- source unique de vérité pour le périmètre (URL découvertes vs sitemap vs crawlées)
  et affichage explicite des trois nombres avec leur signification ;
- source unique pour les pages orphelines : `calculate-cocoon-logic` fait foi, le
  stratège ne peut plus annoncer un autre chiffre ;
- cohérence toxicité backlinks : si `domainAuthority` détecte une empreinte artificielle,
  la conclusion « profil sain, aucun désaveu » est interdite ;
- clamp de tout score à son maximum déclaré (fin du « 55/50 ») ;
- arrondi unifié des positions et volumes (fin de 22 vs 22,1 ; 3 899 vs 3 800) ;
- carte d'identité : un champ `non résolu` ne peut plus servir d'entrée à un arbitrage
  (mix de gabarits, liste de concurrents) — le bloc devient une hypothèse explicite ou
  disparaît (`_shared/identityResolver.ts`).

## Lot 5 — Plan d'action discriminant (P2, défauts 12-15)

Dans `_shared/topPriorities.ts` et `_shared/roiWeighting.ts` (donc aussi pour `/audit`
et pour le Workbench) :
- empreinte de recommandation (`fingerprint`) et déduplication : une même consigne
  déclinée par gabarit devient **une** action avec la liste des gabarits concernés ;
- sévérité et impact calculés depuis le signal mesuré (écart au seuil, volume, position),
  jamais constants ;
- champs `owner`, `kpi` et estimation de trafic obligatoires par action ;
- distinction nette « déjà dans le Workbench » / « nouvellement détecté » avec le
  décompte réel (défaut 14) via `_shared/marinaWorkbench.ts`.

## Lot 6 — Éditorialisation du rendu (P3, défauts 16-19)

- Étiquettes de sévérité rendues comme badge, jamais concaténées en fin de phrase.
- Table de traduction des champs bruts (`readiness level`, `toxicity score`,
  `Missing Terms`, `Red Team`) dans le rendu HTML partagé.
- Suppression des tableaux de remplissage : pas de tableau si toutes les colonnes
  valent 0 ; clusters à 1 page regroupés en une ligne « n clusters isolés »
  (`calculate-cocoon-logic` renvoie déjà la taille des clusters).
- Nommage lisible des clusters (terme dominant) au lieu de `cluster_23`.

## Ordre d'exécution et vérification

1. Lots 1 + 2 (fiabilité factuelle — c'est l'axe à 30 points).
2. Lot 3, puis Lot 4.
3. Lots 5 et 6.

Vérification à chaque lot : relance d'un audit Marina sur `avenir-renovations.fr`
et sur `crawlers.fr`, plus un `/audit` technique et un `/audit` stratégique sur le
même domaine, pour confirmer que les deux surfaces affichent désormais les mêmes
chiffres. Notation via `report-quality-rubric-fr.md` (grille consolidée).
