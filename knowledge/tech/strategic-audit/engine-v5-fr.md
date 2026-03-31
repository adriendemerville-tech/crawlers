# Memory: tech/strategic-audit/engine-v5-fr
Updated: 2026-03-29

L'Audit Stratégique GEO (v5) intègre une analyse profonde de la SERP et de l'audience :

1. **Lacunes sémantiques** : Identification des termes clés manquants (missing_terms) et calcul de la densité sémantique comparative.
2. **Recommandations** : Actions concrètes pour progresser dans les classements.
3. **Stratégie alternative** : Suggestion optionnelle (RP, partenariats, vidéo, événement) pour les sites en position très défavorable (>50), précisant le 'quoi/comment/combien' et rappelant l'impact des actions offsite sur le ranking.
4. **Classification concurrentielle** : Système à 4 niveaux (Goliath, Direct, Challenger, Inspiration) basé sur la similarité identitaire (entreprise/produit) et la position SERP.
5. **Analyse des Cibles Clients** : Détection des segments prioritaires, secondaires et inexploités (B2B/B2C). La branche B2B inclut la taille, le secteur, le rôle, la périodicité d'achat et le mode de paiement ; le B2C détaille le genre, l'âge, la CSP, le pouvoir d'achat, la périodicité et le mode de paiement. Persisté dans `tracked_sites.client_targets`.
6. **Empreinte Lexicale v2 — Distance sémantique relative** :
   - Mesure la distance entre le vocabulaire du contenu et le niveau de compréhension de chaque cible (primaire, secondaire, potentielle). Un terme n'est "jargon" que s'il dépasse la compréhension de la cible visée.
   - **Appel LLM séparé** (Gemini Flash, ~3k tokens, <0.001€) pour éviter la circularité avec la détection des cibles.
   - **Score d'intentionnalité hybride** (4 composantes) : CTA agressivité (30%, algorithmique), alignement SEO balises (30%, algorithmique), assertivité du ton (20%, LLM), cohérence structurelle (20%, LLM).
   - Labels : "Spécialisation assumée" (>0.65) | "Positionnement ambigu" (0.35-0.65) | "Distance non maîtrisée" (<0.35).
   - Persisté dans `tracked_sites.jargon_distance` (jsonb).
   - Front-end : 3 jauges (primaire/secondaire/potentielle) + badge d'intentionnalité + interprétation contextuelle croisée.
7. **Audio** : Le lecteur Spotify inclut des boutons de navigation 'Précédent' et 'Suivant'.
8. **Pré-Crawl intelligent** (v5.2 — 2026-03-31) :
   - Vérifie si un crawl complet récent (< 7 jours) existe dans `site_crawls` → réutilise les données.
   - Sinon, crawl intermédiaire : scan sitemap XML, croisement avec GA4 (top pages par trafic), puis crawl des 10 pages les plus importantes.
   - Sélection par priorité : pages GA4 (trafic réel) > pages sitemap courtes (profondeur URL faible).
   - Crawl par batch de 3 avec extraction : Title, H1, Meta Desc, Schema.org, liens int/ext, word count, noindex.
   - Contexte injecté dans le prompt LLM pour diagnostiquer les hallucinations (croisement assertions LLM vs données crawlées réelles).
   - Données partagées entre audit technique et stratégique via `cachedContextOut.preCrawlData`.
   - Helper : `_shared/preCrawlForAudit.ts` (fonctions `preCrawlForAudit`, `formatPreCrawlForPrompt`).

## Corrections rapport PDF (v5.1 — 2026-03-29)
- **Fix `undefined`** : Tous les champs GAP, Empreinte Lexicale utilisent des fallbacks (`?? '—'`) pour éviter l'affichage de valeurs `undefined` dans l'export PDF.
- **Ratios Jargon/Concret** : Les ratios absurdes (2000%/8000%) sont maintenant capés et formatés en pourcentages lisibles avec référentiel.
- **Méthodologie du score** : Un encadré "Méthodologie du scoring" est ajouté au rapport expliquant les 5 piliers (Performance, Sécurité, SEO, Accessibilité, Bonnes Pratiques) et la pondération /200.
- **AEO détaillé** : Chaque critère AEO affiche désormais une explication + conseil correctif (dans le PDF et dans l'UI `AEOScoreCard`), au lieu d'une simple checklist binaire ❌/✅.

## Diagnostic d'hallucinations (v5.2 — 2026-03-31)
La fonction `diagnose-hallucination` charge TOUTES les données factuelles avant d'analyser :
- **Crawl data** : `site_crawls` + `crawl_pages` (< 30 jours)
- **Audit data** : `audit_raw_data` (brand_perception, scores)
- **Ranking data** : keyword_positioning depuis audit stratégique
- **Identity card** : `tracked_sites.identity_card` via `getSiteContext`
- **Corrections précédentes** : `hallucination_corrections`

4 verdicts par incohérence :
- 🔴 `misleading_data` — donnée trompeuse dans le site
- 🟡 `absent_data` — donnée absente, LLM comble le vide
- 🟠 `training_bias` — LLM ignore les données claires du site
- 🔵 `reasoning_error` — bonne donnée, mauvaise conclusion

Le `verdictSummary` agrège le comptage par type. Le `factualContext` complet est retourné au front pour transparence.

## Tables impactées
- `tracked_sites.client_targets` (jsonb) — cibles B2B/B2C
- `tracked_sites.jargon_distance` (jsonb) — scores de distance + intentionnalité
- `tracked_sites.identity_card` (jsonb) — carte d'identité enrichie par micro/audio

## Types front-end
- `JargonTargetScore` : { distance, qualifier, terms_causing_distance, confidence }
- `JargonIntentionality` : { score, label, components: { cta_aggressiveness, seo_pattern_alignment, tone_assertiveness, structural_consistency } }
- `JargonDistance` : { primary, secondary, untapped, intentionality }
- `LexicalFootprint` : { score?, jargonRatio, concreteRatio, jargon_distance? }
