---
name: Conclusion stratégique de la synthèse exécutive Marina
description: Paragraphe en gras déterministe (posture SEO/GEO + fourchette de gain 12 mois) présent sur tous les rapports Marina, et PageSpeed toujours mesuré en profil mobile
type: feature
---
`supabase/functions/_shared/strategicVerdict.ts` (`buildStrategicVerdict`) produit, dans la **Synthèse exécutive** de tout rapport Marina, un paragraphe en gras structuré en trois temps, 0 token LLM :

1. **Posture** — diagnostic de la stratégie de fait : « stratégie de volume SEO » (≥200 URLs connues + cannibalisation/near-duplicate/thin), « périmètre large sans redondance », « périmètre restreint » (<40 URLs) ou « couverture intermédiaire ».
2. **Leviers SEO** — chaque levier n'apparaît que si son signal est mesuré : perf mobile PSI <80, clusters/gaps sémantiques, cannibalisation (page pivot par intention), pages fines, mots-clés secondaires (quick wins positions 4-20), doublon d'hôte www/apex.
3. **Leviers GEO** — citabilité (réponse directe, données factuelles), JSON-LD si `hasSchema` faux ou <2 types, contenus d'intention informationnelle depuis les content gaps.

**Fourchette de gain** : `estimateGain()` additionne des leviers bornés (PSI, cannibalisation, gaps, quick wins, GEO, thin, doublon d'hôte), arrondit à 5 %, plafonne à +60 %, et n'affiche rien si <2 signaux mesurés. Formulée « objectif raisonnable, conditionné à la mise en œuvre complète du plan ».

Verdict rétrogradé et blocages critiques : si `criticalCount > 0`, une phrase rappelle que les chantiers ne produisent effet qu'après traitement des blocages.

**PageSpeed** : tous les audits Crawlers (`marina`, `audit-expert-seo`, `expert-audit`, `matriceScoring`, `snapshot-audit-impact`) appellent PSI avec `strategy=mobile` uniquement — conformité mobile-first. Le rapport l'explicite : titre « Core Web Vitals (PageSpeed Insights — profil mobile) » et libellé « Performance mobile /100 ». Seul `audit-compare` interroge aussi le desktop (comparaison volontaire).
