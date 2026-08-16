# Critique consolidée — rapport Marina avenir-renovations.fr (job 7fede96a, 16/08/2026)

Deux relectures indépendantes : Lovable (lecture intégrale du PDF + code source) et Claude
(lecture intégrale + vérification contradictoire sur le site en ligne). Ce document fusionne
les deux, dédoublonne, et attribue une cause racine technique à chaque défaut.

## 1. Défauts par gravité

### P0 — Affirmations fausses vérifiables (disqualifiantes en remise client)

| # | Constat | Source | Cause racine probable |
|---|---|---|---|
| 1 | « Signaux Google Business Profile inexistants (0 avis, note 0/5) », `has_reviews: false`, `has_testimonials: false`, « absence totale de preuve sociale ». Le site affiche 1 979 avis Google (4,5/5), 347 avis Eldo, 3 748 avis Qualibox, 3 témoignages signés, et une note par agence (4,54 / 4,67 / 4,76). La capture d'écran incluse dans le rapport le montre. | Claude (vérifié en ligne) | `social_proof` est jugé par LLM dans `_shared/strategicPrompts.ts` à partir du contenu de page transmis. Ce contenu était vide (voir #2) → le LLM a répondu `false`. Aucun garde-fou : pas de vérification déterministe du `AggregateRating` JSON-LD déjà détecté par le crawl, pas de statut « non concluant » |
| 2 | Fuite de prompt dans la section Quotabilité : « CONTENU PAGE: , , Utilise ces informations pour identifier le core business » | Lovable | Contenu de page vide sérialisé puis rendu tel quel ; aucune validation de sortie avant écriture du rapport |
| 3 | « Le premier paragraphe fait 727 mots » — le texte cité est le méga-menu de navigation. Les exemples de réécriture concatènent des titres d'articles sans rapport (« dalle extérieure en béton », « aménager un bar dans sa cuisine ») | Lovable | Extraction du premier paragraphe sans retrait du boilerplate, alors que `_shared/contentIntegrity/` sait déjà le faire |
| 4 | Schema.org jugé absent (score 10/100, action « intégrer des balises Schema.org complètes ») alors que le crawl liste 7 types en place : Organization, ContactPoint, WebSite, SearchAction, Product, Brand, AggregateRating | Claude | Le score GEO schema n'est pas alimenté par le résultat du crawl ; deux modules mesurent la même chose sans se parler |

### P1 — Incohérences internes (crédibilité)

| # | Constat | Source |
|---|---|---|
| 5 | « Technique 55/50 » — score supérieur à son propre maximum | Claude |
| 6 | SEO technique 98/100 alors que trois constats sont critiques (LCP 3,8 s, TBT 408 ms, ratio texte 7 %) | Lovable |
| 7 | Périmètre : mode de crawl choisi sur « 103 URL découvertes », puis pondération du mix de pages sur « sitemap (925 URL) ». Couverture annoncée 80 % du périmètre connu | Lovable + Claude |
| 8 | 10 pages orphelines listées contre 28 annoncées par le stratège | Lovable |
| 9 | Profil de backlinks « sain, aucun désaveu nécessaire » alors que le GEO parle d'empreinte artificielle et qu'une action demande d'assainir (100 % dofollow, rank moyen 7,1/100, 32,9 liens/domaine d'annuaires) | Lovable |
| 10 | Modèle d'affaires et concurrents « Non résolu » dans la carte d'identité, mais utilisés ensuite pour arbitrer le mix de gabarits et citer 4 concurrents | Lovable + Claude |
| 11 | Chiffres flottants : position moyenne 22 vs 22,1 ; 3 899 vs « 3 800 » mots-clés ; visibilité IA 0/5 LLM mais probabilité 52 % | Lovable |

### P2 — Plan d'action et discrimination

| # | Constat | Source |
|---|---|---|
| 12 | Les 12 actions sont toutes « Critique » avec « impact 100/100 » — l'échelle ne sépare rien | Lovable |
| 13 | 4 à 5 des 12 actions sont la même consigne (« reformuler le paragraphe d'ouverture ») déclinée par gabarit ; répétée aussi 3 fois dans la synthèse | Lovable + Claude |
| 14 | « 12 actions prioritaires — 12 déjà dans votre Workbench, 0 nouvellement détectée » : contenu recyclé présenté comme livrable neuf | Claude |
| 15 | Ni propriétaire, ni KPI de suivi, ni estimation de trafic par action | Lovable |

### P3 — Finition rédactionnelle

| # | Constat | Source |
|---|---|---|
| 16 | Étiquettes de sévérité collées en fin de phrase : « …à 80/100 en trois mois. High », « …digne de confiance. Medium » | Claude |
| 17 | Champs bruts anglais / `snake_case` livrés tels quels : `readiness level: developing`, `toxicity score`, `Missing Terms`, `Quotes`, `Red Team (Adversarial)` | Lovable |
| 18 | Tableaux de remplissage : 100 URL tronquées avec autorité 0 et liens entrants 0 partout, 205 liens sémantiques listés sans usage, 65 clusters dont une majorité à 1 page nommés `cluster_23` | Lovable |
| 19 | Recommandations calées sur 2024 / 2025 dans un rapport d'août 2026 | Lovable |

## 2. Ce qui tient réellement le niveau agence

- Section « Portée et limites » : sources, non-déterminisme des tests IA, échantillon partiel, autorité présentée comme estimation propriétaire. Plus transparente que la majorité des rapports commerciaux (les deux relectures concordent).
- Détection du réseau de sites satellites (`.be`, `.lu`, `.ch`, `avenir-reformas.es`) comme source de liens non naturels : confirmée en ligne.
- Extraits avant/après réellement tirés du site, pas des généralités.
- Couverture GEO/AEO absente des audits d'agence classiques : citabilité IA, risque zéro-clic, intention conversationnelle, red team, classification concurrentielle.
- Pistes de fond probablement justes : cocon sémantique, pages orphelines « salle de bains », content gaps à volume (« prix rénovation m2 » 1 300, « aide pour rénover une maison ancienne » 1 000).

## 3. Notation consolidée

Deux grilles ont été appliquées indépendamment. Elles convergent.

| Grille | Axes | Score |
|---|---|---|
| Lovable (`report-quality-rubric-fr.md`) | fiabilité/cohérence 25, couverture 15, priorisation 20, éditorialisation 15, sourcing 10, discrimination 10, différenciation 5, moins pénalités | 38/100 |
| Claude | fiabilité factuelle 30 → 9, cohérence interne 15 → 6, méthodologie/transparence 15 → 12, actionabilité 20 → 14, finition 10 → 3, valeur ajoutée réelle 10 → 4 | 48/100 |

Écart expliqué : la grille Lovable applique des pénalités forfaitaires (fuite de prompt,
recommandation inapplicable, année périmée) que la grille Claude absorbe déjà dans l'axe
fiabilité. Grille de référence retenue : **la grille Claude pour la pondération** (l'axe
fiabilité factuelle à 30 points est le bon arbitre : un client agit ou n'agit pas), **complétée
par les pénalités forfaitaires Lovable**.

**Note consolidée : 43/100** — catégorie « bon brouillon algorithmique » : exploitable en
interne comme détecteur de pistes, non remissible à un client sans relecture humaine.

## 4. Correctifs par ordre de rendement

| # | Correctif | Défauts couverts | Gain estimé |
|---|---|---|---|
| 1 | Preuve sociale déterministe : lire `AggregateRating`/`Review` JSON-LD et les compteurs d'avis du crawl ; le LLM ne peut que qualifier, jamais nier. Statut « non concluant » si contenu vide | 1, 4 | +12 |
| 2 | Garde-fou de sortie : contenu de page vide → module marqué non concluant, jamais d'appel LLM ; interdiction de toute chaîne de prompt dans le rapport | 2 | +5 |
| 3 | Retrait du boilerplate avant analyse du premier paragraphe (réutiliser `contentIntegrity`) | 3 | +5 |
| 4 | Réconciliation des compteurs entre modules (périmètre sitemap vs crawl, orphelines, toxicité, schema) + clamp de tous les scores à leur maximum | 5, 6, 7, 8, 9, 11 | +8 |
| 5 | Déduplication du plan d'action par empreinte de recommandation, regroupement par gabarit | 13, 14 | +6 |
| 6 | Sévérité et impact calculés à partir du signal mesuré, pas constants | 12, 15 | +7 |
| 7 | Éditorialisation : traduction des champs bruts, suppression des étiquettes de sévérité en fin de phrase, suppression des tableaux de remplissage, clusters à 1 page regroupés | 16, 17, 18 | +8 |
| 8 | Interdiction de toute année codée en dur dans les prompts et modèles | 19 | +2 |

Cible après correctifs : 85-90/100 sur la grille consolidée.
