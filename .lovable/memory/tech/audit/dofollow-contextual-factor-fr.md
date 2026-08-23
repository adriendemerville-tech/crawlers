---
name: Dofollow — facteur contextuel, jamais preuve autonome
description: Faisceau d'indices pour la toxicité des backlinks, autorité indépendante estimée et formulation du verdict dans Marina / audit expert
type: feature
---
Règle absolue : `100 % dofollow` n'est **jamais** présenté comme une preuve de toxicité. Un lien dofollow est le comportement normal d'un lien éditorial.

`supabase/functions/_shared/domainAuthority.ts` (calibrage v5) :
- `dofollow_context` : `ratio`, `level` (`faible` / `a_surveiller` / `aggravant`), `points` (0 / 3 / 8), `corroborating[]`, `sitewide_suspected`.
- Points ajoutés **uniquement** si ratio ≥ 95 % ET domaines référents > 50 ET anomalies structurelles mesurées : empreinte sitewide (≥ 10 liens/domaine du réseau propre ou ≥ 25 liens/domaine global), part du réseau propre ≥ 20 %, ancre dominante ≥ 30 %, ancres non naturelles ≥ 25 %, autorité moyenne tiers < 15/100, un référent concentrant ≥ 15 % des liens (seulement si backlinks ≥ 50), référents hors-sujet. 1 anomalie → 3 pts ; ≥ 2 → 8 pts.
- `independence` : autorité apparente → autorité indépendante estimée (réseau propre retiré, répétition au-delà de 3 liens/domaine tiers neutralisée), `dependency_share`. Toujours libellé « Simulation indicative — non équivalente au calcul de Google ».

Verdict : `pollue` s'affiche « Risque élevé — profil à investiguer », `a_surveiller` « À surveiller — profil à documenter ». Jamais « pénalité Google ». Le désaveu n'est recommandé qu'après l'ordre d'investigation (sitewide → relations entre domaines → ancres → contexte du lien) ; sur le réseau propre : corriger à la source, jamais désavouer.

`backlinkSection.ts` ajoute quatre blocs pédagogiques : « Pourquoi X % dofollow devient un signal dans ce contexte ? », « 1 lien ne vaut pas nécessairement 1 recommandation », « Autorité apparente vs autorité indépendante estimée », « Que se passerait-il si Google faisait le même constat ? », plus la note méthodologique et la règle de désaveu. La synthèse exécutive Marina ajoute un paragraphe « Profil de liens : vigilance élevée » uniquement quand `level !== 'faible'`.

Principe général applicable à tous les audits : faits → signaux → faisceau d'indices → niveau de risque → recommandation. Jamais métrique isolée → score → conclusion catégorique.
