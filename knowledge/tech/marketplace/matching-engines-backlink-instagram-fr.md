# Place d’échange Crawlers — Moteurs d'appariement liens, LinkedIn & Instagram

Document conceptuel et technique. Statut : cadrage (non implémenté).
Date : 2026-08-21 · Auteur : Lovable · Périmètre : v1 backlink, v1.5 collab Instagram.

---

## 0. Présentation de Crawlers

### 0.1 Positionnement et proposition de valeur

Crawlers est une **plateforme de référencement SEO/GEO tout-en-un** pensée pour les
agences, consultants et éditeurs de sites qui veulent piloter leur visibilité à la fois sur
les moteurs de recherche classiques **et** sur les réponses génératives (LLM, GEO).

Proposition de valeur : transformer des **données de terrain réelles** (Search Console,
crawl technique, benchmarks LLM, E-E-A-T) en **diagnostics actionnables et en code
correctif prêt à l'emploi**, sans compétences techniques lourdes côté client.

Positionnement distinctif :
- **Multi-domaine** : audit technique, SEO éditorial, GEO, Google Business, autorité / netlinking
  et concurrentiel traités dans un seul outil (pas de boîte à outils éclatée). Côté architecture
  éditoriale, cela reste **4 piliers** (crawler, GEO, outil-crawl, comparatifs) : l'autorité et le
  netlinking sont des satellites du pilier GEO, jamais un 5ᵉ pilier.

- **IA agentique contrôlée** : des agents (Parménion, Félix, Code Architecte, Marina) qui
  produisent du contenu et des correctifs, **jamais** de code sans validation humaine.
- **Marque blanche & multi-compte** : adapté aux agences qui revendent les rapports.
- **Géographique** : ancré marché francophone (crawlers.fr), modèles anglais/espagnol disponibles.

### 0.2 Outils et tarifs

| Offre | Prix | Positionnement |
|---|---|---|
| **Freemium / à l'unité** | crédits ou paiement unique 3 € – 12 € par module | Découverte, audit ponctuel |
| **Pro Agency** | **29 €/mois** (26,10 €/an) | Agences/consultants : 5 000 pages/mois, 10 pages/scan, audits & code illimités, benchmark LLM, GMB, marque blanche + 2 comptes, benchmark rank SERP |
| **Pro Agency+** | **79 €/mois** (71,10 €/an) | Scaling : 50 000 pages/mois, 50 pages/scan, benchmark LLM & profondeur illimités, GMB, marque blanche + 3 comptes, Conversion Optimizer, API Marina, analyse des logs, stratégie concurrentielle |
| **Enterprise** | Sur devis | Tout illimité, comptes sur mesure, serveur dédié et isolé, SLA, SSO SAML, rôles admin/auditeur/éditeur |

Packs de crédits complémentaires (10 / 50 / 150 crédits, de ~0,44 € à 0,30 € l'unité selon
volume) pour les modules stratégiques sans abonnement.

Outils couverts : audit stratégique (Marina), Cocoon (maillage & cannibalisation),
benchmark LLM/GEO multi-modèles, E-E-A-T v3, Content Architect + agents éditoriaux,
Code Architecte (correctifs techniques), Conversion Optimizer, Google Business (GMB),
Observatoire sectoriel, dictadevi (génération de contenu).

### 0.3 Pourquoi ajouter la Place d'échange

La plateforme diagnostique déjà des **besoins** (déficit d'autorité, backlinks minces,
notoriété externe faible) et dispose des **données de valorisation** de chaque page
(autorité, trafic réel, qualité de contenu, visibilité IA) via les comptes GSC connectés.
La Place d'échange ferme la boucle : au lieu de s'arrêter au diagnostic « il vous faut des
liens ou de la visibilité », Crawlers permet de **satisfaire ce besoin en interne**.

Bénéfices pour Crawlers :
- **Monétisation sur l'existant** : commission unique de 15 % sur chaque transaction — prélevée en cash sur le flux quand il y a
  paiement, en crédits Crawlers sur le troc —, sans coût d'acquisition supplémentaire (l'acheteur est déjà un utilisateur diagnostiqué).
- **Données de pricing uniques** : aucun acteur ne tarifie des liens à partir de signaux
  GSC + visibilité IA ; c'est un avantage concurrentiel difficile à copier.
- **Effet de réseau** : chaque vendeur est aussi un acheteur potentiel (et inversement) ;
  la liquidité de la place croît avec le nombre de sites connectés.
- **Rétention** : l'utilisateur ne quitte plus la plateforme pour aller chercher un
  netlinker ou un influenceur ailleurs.

Bénéfices pour les utilisateurs :
- **Un seul écosystème** : diagnostiquer, corriger et acquérir de la visibilité au même endroit.
- **Troc possible** : pas uniquement de l'achat cash — lien contre lien, lien contre
  post LinkedIn/Instagram, post contre post (voir §2.7) — utile aux sites sans budget.
- **Prix transparents** : grille de paliers calculée serveur, pas de négociation opaque.

---

## 1. Principe général

Crawlers ne construit pas un catalogue à parcourir mais un **moteur d'appariement**
alimenté par des diagnostics déjà produits par la plateforme.

- Côté **demande** : les besoins sont déjà écrits dans `architect_workbench`
  (`low_authority`, `thin_backlinks`, `backlink_target`, `remediation_channel='netlinking'`),
  avec page cible et ancres suggérées. Pour le social, le déficit de notoriété externe
  détecté par l'E-E-A-T v3 déclenche une offre « collab ».
- Côté **offre** : toute page d'un compte ayant connecté GSC est valorisable sans
  déclaration du vendeur (clics/impressions/position par page + autorité domaine +
  qualité de contenu + thématique + visibilité IA).

**Décisions structurantes de la v1 (valables dans tout le document, aucune exception) :**

| Règle | Valeur v1 |
|---|---|
| Commission Crawlers | **15 %**, taux unique sur les deux verticales et sur tous les `deal_type` (`cash`, `credits`, `barter`) |
| `link_chain` (A→B→C→A) | **mode d'échange sans cash privilégié** : boucle déclarée de 3-4 participants, 7 j entre jambes, aucune décote |
| `link_for_link` | **dernier recours, flaggé et bridé** : proposé seulement si aucune boucle constructible ; délai 21 j, décote d'équité 0,70, quota 1 réciprocité / trimestre / site, blocage des cycles non déclarés |
| Propriété du vendeur | **vérification obligatoire avant mise en vente** (GSC/DNS pour un domaine, OAuth pour LinkedIn/Instagram) |
| Bornes de prix | **40 € plancher, 350 € plafond, dures**, paliers multiples de **10 €**, toutes devises et tous actifs |

Invariant transversal : **le prix est toujours calculé serveur**, jamais transmis par le client.
Aucune mise en vente sans **opt-in explicite** du vendeur (les données GSC sont personnelles) **et
sans propriété vérifiée** (voir §2.6).

---

## 2. Moteur d'appariement Backlink

### 2.1 Inventaire (offre)

Une unité vendable = **une page** (`marketplace_link_assets`), pas un domaine.

Signaux collectés par page :

| Signal | Source | Poids pricing |
|---|---|---|
| Autorité du domaine (domain rank, referring domains, diversité IP/ancres) | `check-backlinks` (DataForSEO) | 30 % |
| Proximité sémantique page vendeur ↔ thématique acheteur | empreinte lexicale Cocoon | 25 % |
| Trafic réel de la page (clics/impressions/position 90j) | `gscPages.ts` | 20 % |
| Qualité de contenu | `computeSeoScoreV2` + E-E-A-T v3 + fraîcheur | 15 % |
| Visibilité IA (citations, benchmark GEO) | benchmark SERP multi-providers + scoring GEO | 10 % |

Ces signaux servent **au calcul serveur**. Ce qui est *affiché* est régi par §2.1.1.

Prix indicatif = `base × Σ(poids × score normalisé)`, borné par un **plancher dur de 40 €** et un
**plafond dur de 350 €**. Aucun actif ne sort de ces bornes en v1, quelle que soit son autorité :
pas de dérogation, pas de file de validation admin. Le prix est recalculé à chaque rafraîchissement
des signaux et **figé au moment de la commande**.

### 2.1.1 Confidentialité des signaux GSC — ce qui est exposé

Les données GSC d'un vendeur sont des **données commerciales personnelles**. Montrer les clics,
impressions ou positions exacts d'une page à un acheteur (même prospect) est une fuite : cela
révèle le chiffre d'affaires potentiel, la saisonnalité et les requêtes rentables du vendeur.

**Règle d'exposition (invariante).** À un acheteur, l'API et l'UI ne renvoient **jamais** de valeur
GSC exacte : uniquement des **fourchettes** (buckets) et des scores normalisés 0–100. Les valeurs
exactes restent visibles **du seul propriétaire de l'actif**. Un admin peut y accéder pour le
support, mais uniquement via un accès journalisé (voir « Accès admin tracé » ci-dessous).

| Donnée | Vendeur (propriétaire) | Acheteur / prospect | Public (page d'annonce) |
|---|---|---|---|
| Clics 90 j | valeur exacte | fourchette | fourchette |
| Impressions 90 j | valeur exacte | fourchette | fourchette |
| Position moyenne | valeur exacte | fourchette (`1-3`, `4-10`, `11-20`, `21+`) | fourchette |
| Requêtes / mots-clés déclencheurs | liste complète | **jamais** — seulement 1 à 3 **thématiques** (clusters) | thématiques |
| Pays / device | détail | top pays uniquement, sans part de trafic | top pays |
| Courbe temporelle (par jour/semaine) | oui | **jamais** — seulement une tendance `hausse` / `stable` / `baisse` | tendance |
| Trafic du domaine entier | oui | **jamais** (agrégat de niveau site non exposé) | non |
| Score de trafic normalisé (0–100) | oui | oui | oui |

**Fourchettes retenues (échelle unique, bornes fermées, jamais recalculées côté client).**

```
clics_90j        : trafic faible / non significatif (0–10) | 11-50 | 51-200 | 201-1 000 | 1 001-5 000 | 5 000+
impressions_90j  : 0-100 | 101-1 000 | 1 001-10 000 | 10 001-50 000 | 50 001-250 000 | 250 000+
position_moyenne : 1-3 | 4-10 | 11-20 | 21+
```

La première classe de `clics_90j` **n'est jamais rendue sous forme numérique** : elle agrège
`0` et `1-10` sous le libellé neutre « trafic faible / non significatif ». Aucun bucket `0` ni
`1-10` n'existe donc côté acheteur ou public : une fourchette `1-10` sur une page unique serait
presque une valeur exacte.

Garde-fous complémentaires :

- **Seuil de k-anonymat inversé** : appliqué par construction dans l'échelle ci-dessus (première
  classe fusionnée et non numérique) ; aucune exception.

- **Pas de dé-anonymisation par différence** : les fourchettes sont calculées sur la fenêtre 90 j
  figée du dernier rafraîchissement (au plus une fois par 7 j) ; on ne sert pas d'historique de
  fourchettes permettant de reconstituer les deltas.
- **Pas d'agrégat inférable** : aucune API acheteur ne renvoie plusieurs pages d'un même vendeur
  avec leurs fourchettes dans la même réponse au-delà de 5 pages, ni de total domaine.
- **Après commande** : l'acheteur ne gagne aucun accès supplémentaire aux données GSC du vendeur ;
  le suivi post-publication (§2.13) porte sur la **présence du lien**, pas sur son trafic.
- **Implémentation** : la conversion valeur → bucket se fait **serveur**, dans une vue/fonction
  dédiée (`marketplace_asset_public_signals`) ; les tables portant les valeurs brutes ont un
  `SELECT` réservé au propriétaire (RLS `auth.uid()`) et à `service_role`. Aucune valeur exacte ne
  transite dans un payload destiné à un non-propriétaire, même « non affichée ».
- **Consentement** : l'opt-in de mise en vente précise explicitement *ce qui sera visible*
  (fourchettes + thématiques + scores) et *ce qui ne le sera jamais* (requêtes, courbes, valeurs
  exactes, trafic domaine). Retrait de l'opt-in → retrait immédiat de l'annonce.
- **Accès admin tracé** : un admin n'a **aucun accès implicite** aux valeurs exactes. La lecture
  passe par une server function dédiée qui exige (a) un motif de support saisi, (b) un ticket ou un
  identifiant de conversation, (c) une durée d'accès limitée à 60 minutes. Chaque appel écrit une
  ligne dans `marketplace_gsc_access_log` (`id`, `admin_user_id`, `asset_id`, `owner_user_id`,
  `fields_read[]`, `reason`, `ticket_ref`, `ip`, `created_at`, `expires_at`) — insertion faite par
  la fonction, jamais par le client, table en `SELECT` admin + `service_role` uniquement et
  **non modifiable ni supprimable** (append-only, pas de policy `UPDATE`/`DELETE`). Le propriétaire
  de l'actif voit dans sa console l'historique des accès admin à ses données exactes (date, motif),
  et une alerte est envoyée au-delà de 3 accès sur 30 j pour un même actif. Rétention du journal :
  24 mois.



**Grille de prix (détail retenu).** Le prix algorithmique choisit un **palier fixe**, il ne
l'invente pas : pas de prix continu, lisibilité acheteur/vendeur, pas de négociation au cas
par cas. Tous les paliers sont des **multiples de 10 €** (règle d'arrondi unique dans toute la
place d'échange, y compris pour les soultes et les valorisations d'actifs sociaux). Cinq
paliers calés **légèrement sous le marché** constaté (lien contextuel France, SEO/GEO) sans
casser la perception qualité :

| Palier | Prix | Profil vendeur (marché constaté) |
|---|---|---|
| P1 | **40 €** | Petit site / blog de niche (DR 20-40, faible trafic) — marché 40-80 € |
| P2 | **90 €** | Site SaaS / média spécialisé correct (DR 40-60, trafic qualifié) — marché 80-180 € |
| P3 | **150 €** | Site fort / média reconnu (DR 60+, trafic significatif) — marché 180-350 € |
| P4 | **250 €** | Premium / très forte autorité — marché 350 €+ |
| P5 | **350 €** | Exceptionnel : autorité de référence sur la thématique, trafic GSC élevé et visibilité IA constatée — marché 500 €+ |

Sélection du palier : le score normalisé global (`Σ(poids × score normalisé)`) mappe vers le
palier le plus proche. P1 vaut exactement le plancher **et P5 exactement le plafond** : les bornes
40 € / 350 € sont donc atteignables par le pricing lui-même, et encadrent aussi les prix ajustés
par une soulte. P5 n'est attribué que si l'actif est `verified`, dispose d'au moins 90 jours de
signaux GSC opt-in et d'un `sell_risk` faible (§2.12) ; sinon le moteur redescend à P4.
Conséquence sur la soulte : lorsque la jambe est déjà à P5, aucune soulte cash ne peut être
ajoutée (le total serait hors plafond) — l'écart est alors réglé en crédits ou l'échange est
rééquilibré sur un autre actif.
**Différenciation data** : seul acteur du marché à pricer la page à l'unité sur des faits
mesurés (autorité + sémantique + trafic GSC réel + qualité + visibilité IA), là où
Rocketlinks / Getfluence s'appuient sur du déclaratif.


### 2.2 Score de compatibilité (appariement)

Pour un couple (besoin acheteur, page vendeur) :

```
compat = 0.35 × proximité_sémantique
       + 0.25 × écart_autorité_positif   (vendeur > acheteur, sinon 0)
       + 0.20 × trafic_page_normalisé
       + 0.10 × qualité_contenu
       + 0.10 × visibilité_IA
```

Exclusions dures (compat = 0) :
- lien déjà existant entre les deux domaines — **sauf** s'il s'agit de la 2ᵉ jambe d'un troc
  `link_for_link` déjà accepté (`marketplace_exchanges.status = accepted`, même `exchange_id`) :
  cette jambe est attendue par construction et n'est donc jamais bloquée par cette règle ;
- **cycle** détecté dans le graphe des liens échangés jusqu'à 4 sauts, **hors** boucle d'échange
  explicitement enregistrée : une chaîne `A→B→C→A` portée par un `exchange_id` de type
  `link_chain` est légitime (c'est le mode privilégié, cf. ci-dessous) ; seuls les cycles
  **non déclarés** (liens qui se ferment de fait, sans troc enregistré) restent exclus ;
- réciprocité directe hors quota : quota `link_for_link` du trimestre déjà consommé, ou même
  partenaire déjà servi sur 12 mois glissants ;
- même propriétaire réel : **même Kbis / même SIREN**, ou même compte CMS connecté ;
- plafond de liens sortants atteint — **deux plafonds distincts, cf. §2.4** : page : 1 lien
  `dofollow` vendu **et** 3 insertions `sponsored` vendues ; domaine : 20 liens `dofollow` / an ;
- thématiques exclues (jeux d'argent, crypto, adulte).

**IP partagée ≠ même propriétaire (profil agence).** Crawlers cible explicitement les agences en
marque blanche pilotant plusieurs comptes clients depuis un même réseau (§0.1) : une IP sortante
commune est donc le cas normal, pas un signal de fraude. Règle retenue :

| Situation | Traitement |
|---|---|
| Deux **Kbis / SIREN distincts vérifiés** des deux côtés, IP commune | **pas d'exclusion** — simple `risk_flag` « IP partagée », contrôle manuel asynchrone, transaction autorisée |
| Kbis distincts non vérifiés (un côté ou les deux) + IP commune | **exclusion dure** (compat = 0) jusqu'à vérification |
| Même Kbis / SIREN, ou même compte CMS connecté | **exclusion dure**, sans dérogation |

Le signal de propriété réelle (SIREN vérifié, §2.6) prime toujours sur le signal réseau (IP).

**Hiérarchie des modes d'échange sans cash.** La réciprocité directe reste possible, mais elle
n'est jamais le premier choix du moteur. Ordre de préférence, appliqué à l'appariement :

1. **Chaîne à 3 sauts ou plus (`link_chain`, A→B→C→A)** — mode privilégié : aucun lien réciproque
   direct, empreinte beaucoup plus naturelle, autorité équilibrée à l'échelle du réseau. Pas de
   décote (`compat` inchangé), publication des jambes échelonnée (7 j minimum entre deux jambes
   de la même boucle), boucle enregistrée sous un `exchange_id` unique.
2. **Troc cross-média** (`link_for_linkedin`, `link_for_insta`) — pas de réciprocité de liens du
   tout, donc pas de décote.
3. **`link_for_link` direct** — solution de dernier recours, uniquement si aucune chaîne ni troc
   cross-média n'est constructible pour ce besoin. Flaggé aux deux parties, décorrélé de 21 jours,
   quota 1 / trimestre / site, et pénalisé :

```
compat_link_for_link = compat × 0.70
```

Conséquence pratique : le moteur tente d'abord de fermer une boucle à 3 (ou 4) participants avant
de proposer un `link_for_link`. Ce dernier n'est présenté que si la recherche de chaîne échoue.

Notification des deux faces au-delà d'un seuil (`compat ≥ 0.6`).

#### 2.2.1 Garde-fous côté acheteur (empreinte entrante)

Le vendeur borne son empreinte sortante (1 lien dofollow par page, 20/an/domaine), mais c'est
l'acheteur qui encaisse le risque de pénalité sur son propre profil de liens. Les mêmes bornes
existent donc côté entrant, appliquées **serveur** au moment de la commande (409 avec motif
explicite, jamais un blocage silencieux) :

| Garde-fou | Borne v1 | Portée |
|---|---|---|
| **Vitesse d'acquisition** | ≤ 4 liens entrants achetés par **30 jours glissants** / domaine acheteur, et ≤ 2 sur 7 jours glissants (fenêtres glissantes, jamais mois calendaire — cf. `marketplace_buyer_limits`, §4.2) | anti-pic de vélocité |
| **Rampe nouvel entrant** | jours 1-30 depuis la 1ʳᵉ commande : max 2 liens ; jours 31-60 : 3 ; à partir de J+61 : 4 (tranches glissantes depuis la 1ʳᵉ commande, pas des mois calendaires) | un domaine jeune ne construit pas 12 liens en 30 jours |
| **Concentration par vendeur** | ≤ 2 liens du même domaine vendeur sur 12 mois glissants | diversité des sources — cette seule borne implique déjà la part maximale du vendeur dominant et un minimum de vendeurs distincts, aucune règle de pourcentage ni de seuil au 5ᵉ lien n'est ajoutée |
| **Concentration par page cible** | ≤ 3 liens achetés vers la même URL cible sur 12 mois | anti-suroptimisation d'une page |
| **Diversité d'ancre** | ≤ 1 ancre exacte (mot-clé cible strict) par tranche de 4 liens achetés vers le même domaine ; le reste en ancre de marque, URL nue ou semi-générique | anti-pattern d'ancres |
| **Cohérence thématique** | au moins 60 % des liens achetés sur 12 mois dans le champ sémantique du domaine acheteur | anti-profil incohérent |

Règles d'application :

1. Les compteurs sont dérivés des commandes livrées (`marketplace_verifications` à l'état
   `verified` ou `maintained`), pas des commandes créées : une commande annulée ne consomme rien.
2. Les liens acquis **hors Crawlers** et détectés au crawl (profil de backlinks connu du domaine)
   alimentent le compteur de vitesse à titre indicatif et déclenchent un avertissement, sans
   bloquer — Crawlers ne borne durement que ce qu'il a lui-même vendu.
3. Un dépassement n'est pas un refus définitif : l'appariement passe en `throttled`, l'offre reste
   réservée et la commande devient possible à la date affichée (« disponible le JJ/MM »).
4. La console affiche en permanence, côté « J'achète », un bandeau **Empreinte entrante** :
   liens sur 30 jours glissants / plafond, liens déjà achetés au vendeur pressenti (0, 1 ou 2 sur
   12 mois), répartition des ancres, avec le motif du prochain déblocage — aucun indicateur de part
   en pourcentage, qui n'ajouterait rien à la borne de 2 liens par vendeur.
5. Ces bornes sont **cumulatives** avec les garde-fous vendeur et avec le quota `link_for_link` :
   la contrainte la plus stricte l'emporte, aucune dérogation admin en v1.
6. `sell_risk` (§2.12) protège les pages du vendeur ; le symétrique côté acheteur est un
   `buy_risk` calculé sur les **six dimensions du tableau ci-dessus** (vitesse, rampe nouvel
   entrant, concentration vendeur, concentration page cible, diversité d'ancre, cohérence
   thématique) et affiché avant validation du panier.


**Ajout DB** — `marketplace_buyer_limits` (§4) : cache par domaine acheteur des compteurs de
vitesse, de concentration, de diversité d'ancre et de cohérence, avec `next_allowed_at` et
`buy_risk`.



### 2.3 Prévisualisation du paragraphe d'accueil du lien

Point central du produit : le lien n'est pas posé « quelque part », il est inséré dans un
**paragraphe rédigé par Crawlers** (Parménion), prévisualisé et validé par les deux parties.

Workflow :

1. **Génération** — à la commande, Parménion produit un bloc d'insertion à partir du contexte
   réel de la page vendeur (`paragraph_html`, position d'insertion, ancre, attribut du lien).
   Contraintes reprises des règles éditoriales : pas d'emoji, une seule ancre, cohérence de
   voix avec le contenu existant, aucune promesse de classement, tactique SEO ≠ sujet.
2. **Prévisualisation** — rendu côte à côte : page originale / page avec insertion mise en
   surbrillance (diff visuel). Vue mobile et desktop.
3. **Feedback bilatéral** — chaque partie peut demander une révision (commentaire libre +
   motifs prédéfinis : ancre inadaptée, ton, position, longueur, imprécision factuelle).
   Chaque tour de révision est journalisé (`marketplace_link_revisions`).
   Limite : **3 tours** par commande, puis arbitrage Crawlers ou annulation sans frais.
4. **Double validation** — l'ordre passe en `approved` seulement quand vendeur ET acheteur
   ont validé la même version (`revision_id`).
5. **Publication** — push CMS via le bridge existant (HTML obligatoire, conversion défensive
   Markdown→HTML) ou insertion manuelle par le vendeur avec preuve.
6. **Vérification** — crawl de contrôle : présence de l'ancre, de l'URL cible, de l'attribut
   attendu, statut HTTP via `_shared/linkVerdictShared.ts`. Contrôle récurrent mensuel ;
   disparition du lien → suspension du paiement / remboursement au prorata.

### 2.4 Attribut du lien — `sponsored` par défaut, `dofollow` en exception gatée

**Décision v1 : `rel="sponsored"` est l'attribut par défaut de toute transaction, quel que soit le
`deal_type` (`cash`, `credits`, `barter`).** Il n'existe pas de « choix vendeur » libre : l'attribut
est imposé par le serveur au figeage de la commande, et `dofollow` n'est accessible que si toutes
les conditions de gating ci-dessous sont réunies.

Justification :
- **Cohérence juridique** : la place d'échange qualifie déjà chaque jambe de prestation à titre
  onéreux soumise à TVA (§2.5.2). Une prestation onéreuse déclarée à l'administration et déclarée
  `dofollow` à Google est une contradiction indéfendable.
- **Le prix ne dépend pas de l'attribut** (§2.1) : sans gating, l'acheteur demande systématiquement
  `dofollow` et le vendeur n'a aucune raison économique de refuser. Le « choix vendeur »
  convergerait donc vers `dofollow` par défaut de fait.
- **Valeur réelle peu corrélée à l'attribut côté GEO** : les corrélations observées entre
  visibilité en recherche générative et liens `nofollow` / `dofollow` sont quasi identiques.
  La valeur d'une jambe vient du trafic qualifié, de la citabilité et de la marque.
- **Empreinte** : `dofollow` généralisé sur une place centralisée reproduit exactement l'empreinte
  homogène reprochée aux réseaux d'échange automatisés (§2.10).

#### Conditions cumulatives pour autoriser `dofollow`

Toutes requises, **aucune dérogation admin** :

1. page en classe `sell_risk` **Sûr** (≤ 0.20) — jamais « Modéré » ;
2. actif au **palier P3 minimum** ;
3. **flag de risque explicite** affiché et accepté par les deux parties avant validation
   (même mécanique que le flag `link_for_link`, §2.2) ;
4. imputation stricte sur le plafond existant **1 lien `dofollow` vendu / page, 20 / an / domaine**
   (plafond inchangé).

#### Plafond dédié aux insertions `sponsored`

La dilution d'équité au niveau page existe aussi pour un lien `nofollow`/`sponsored` : sa part
n'est pas redistribuée aux liens `dofollow` restants, elle est perdue (fin du PageRank sculpting).
Un plafond propre est donc appliqué, sinon le `sponsored` devient un angle mort illimité :

| Plafond | Borne v1 |
|---|---|
| Liens `dofollow` vendus / page | 1 |
| Liens `dofollow` vendus / domaine / an | 20 |
| Insertions `sponsored` vendues / page / an | **3** |

#### Narratif UI

L'onglet « J'achète » ne laisse **jamais** deviner de hiérarchie implicite `dofollow > sponsored` :
`sponsored` est présenté comme la norme saine (valeur = trafic qualifié + citabilité IA),
`dofollow` comme une option à part, plus risquée, disponible rarement — même logique que celle
déjà appliquée à LinkedIn (§2.7.1). L'UI ne présente **jamais** de garantie de classement.

### 2.5 Rémunération

**Décision v1 : reversement réel en euros via Stripe Connect, dès le lancement.** Le paiement en
crédits Crawlers reste disponible, mais comme **option choisie par le vendeur**, jamais comme seul
support. Motif : payer un vendeur exclusivement en monnaie interne non convertible réserve de fait
la vente aux comptes déjà abonnés et contredit la promesse d'ouverture du §1 (« toute page d'un
compte ayant connecté GSC est valorisable »), au moment précis où l'amorçage de l'offre est le
point faible (§9).

| Support de reversement | Régime v1 |
|---|---|
| **Euros (défaut)** | Stripe Connect, compte connecté au nom du vendeur, **KYC bloquant avant la première mise en vente** (au même titre que la vérification de propriété, §2.6). Séquestre puis déblocage par tranches (§2.5.1). |
| **Crédits Crawlers (option)** | Choix explicite du vendeur par actif ou par commande ; crédits non convertibles, mêmes tranches de déblocage. Seul support possible pour une jambe de troc, qui ne porte aucun flux d'argent. |

Conséquence : un vendeur sans compte Stripe Connect vérifié ne peut vendre que **contre crédits ou
en troc** ; l'inventaire cash lui reste fermé jusqu'au KYC. Cette règle est affichée dans l'onglet
« Je vends », pas découverte au moment du paiement.

**Mode de règlement de la commission (règle v1).** Le taux est de 15 % dans tous les cas ; seul le
**support de paiement** varie selon la présence ou non d'un flux d'argent.

| `deal_type` de la commande | Support de la commission | Mécanique |
|---|---|---|
| `cash` (carte) | **Cash, prélevé sur le flux** (défaut) | La commission est retenue sur le paiement de l'acheteur ; le vendeur est crédité du net (`price_cents − commission_cents`). Aucun solde de crédits requis. |
| `cash`, option vendeur | Crédits | Le vendeur peut choisir de régler la commission en crédits et d'être crédité du brut. Option, jamais imposée. |
| `credits` (acheteur paie intégralement en crédits transférés) | **Crédits, obligatoire** | Aucun flux d'argent à prélever : la commission est débitée du wallet du vendeur au figeage, comme sur un troc. Le solde vendeur est contrôlé avant figeage. |
| `barter` (`link_chain`, `link_for_link`, cross-média) | **Crédits, obligatoire** | Chaque partie paie sa commission en crédits sur la valeur de sa propre jambe. |
| Soulte en crédits sur une commande `cash` | Crédits pour la part soulte, cash pour la part cash | Deux lignes de commission distinctes sur la même commande, chacune au régime de son support. |


Règles communes :

- **Qui paie.** La commission porte sur chaque **jambe vendue**, à la charge du vendeur de cette
  jambe. Sur un troc, les deux parties vendent une jambe : **chacune paie la sienne**.
- **Origine des crédits indifférente.** Crédits achetés, offerts (bienvenue, parrainage, plan
  Jeune entreprise), gagnés ou versés en dédommagement : tous paient la commission, sans poche
  distincte ni ordre de consommation particulier. L'exposition maximale d'une dotation offerte
  est de quelques dizaines de crédits, très inférieure au coût d'implémentation et de support
  d'un solde à deux poches.
- **Vérification avant figeage (dès qu'une commission est en crédits).** Sur `barter`, `credits`
  et sur l'option crédits d'une commande `cash`, les soldes de crédits des parties concernées sont
  contrôlés **avant** le figeage. Solde insuffisant → la commande n'est pas figée (message
  explicite, proposition de recharge). Aucun figeage à crédit, aucun solde négatif. Sur une
  commande `cash` au régime par défaut, aucun solde n'est requis : un vendeur ne peut jamais être
  bloqué faute de crédits.

- **Taux figé.** Dès qu'une commission est réglée en crédits, le taux crédits→euros est **écrit sur
  la commande au figeage** (`credit_eur_rate_at_freeze`) et repris sur la facture. Il n'est jamais
  recalculé après coup, même si la grille de crédits évolue.
- **TVA en euros, toujours.** La commission est une prestation Crawlers taxable : la facture porte
  la contre-valeur en euros figée et la TVA de 20 % (§2.5.2), due en euros à l'État. Le règlement
  en crédits ne change ni la base d'imposition ni le montant de TVA.


#### 2.5.1 Séquestre, acquisition progressive et récupération (clawback)

Le prorata de §2.13 n'est pas un remboursement rétroactif improvisé : il est rendu possible par
un **séquestre avec acquisition progressive**, de sorte que le cas normal ne nécessite jamais de
reprendre des crédits déjà dépensés.

1. **Séquestre à la commande.** Au figeage, le **montant séquestré** est le montant réellement dû
   au vendeur, qui dépend du support de commission (§2.5) :
   `escrow_cents = price_cents − commission_cash_cents`, où `commission_cash_cents` vaut la
   commission quand elle est retenue sur le flux (`cash` par défaut) et **0** quand elle est réglée
   en crédits (`barter`, `credits`, option vendeur) — dans ce dernier cas le séquestre porte le
   **brut**, la commission ayant déjà été débitée du wallet. Le montant est inscrit au wallet du
   vendeur en état `held` : visible, **non dépensable**. La commission n'est jamais séquestrée et
   n'est jamais remboursée par cette cascade.
2. **Déblocage.** Première tranche débloquée à **J+30** après preuve de publication confirmée
   (§2.13), puis une tranche par mois d'engagement tenu :
   `tranche = escrow_cents / commitment_months` (12 pour un lien, 1 pour un post LinkedIn ou un
   Reel). Chaque tranche passe `held` → `available` seulement si le dernier contrôle de maintien est
   `maintained`. Un contrôle `broken` **gèle** le calendrier : aucune tranche ne se débloque
   pendant la fenêtre de remise en conformité de 7 jours.
   **Cas particulier story Instagram (24 h)** : aucun engagement de maintien n'est possible, donc
   `commitment_months = 0`, aucun prorata et **une seule tranche** libérée à J+2 sur la seule preuve
   d'affichage de la fenêtre de 24 h (§2.13). Une story non publiée ou publiée sans la mention de
   conformité est un défaut total : séquestre annulé, remboursement intégral.
3. **Rupture non corrigée.** La totalité du reste en `held` est annulée (`cancelled`) et remboursée
   à l'acheteur **dans le support qu'il a lui-même utilisé** : remboursement cash (avoirs Stripe /
   remboursement du paiement) pour une commande `cash`, crédits pour `credits` et pour la soulte en
   crédits, crédits sur la valeur de la jambe pour un `barter`. Aucun remboursement d'un paiement
   cash en crédits sans accord écrit de l'acheteur. Dans la très grande majorité des cas, le
   remboursement est intégralement couvert par le séquestre : rien à reprendre au vendeur.

4. **Récupération quand le séquestre ne suffit pas** (rupture détectée tardivement, correctif
   frauduleux, litige tranché en faveur de l'acheteur), dans cet ordre strict :
   a. reste `held` de la commande concernée ;
   b. solde `available` du wallet vendeur ;
   c. reste `held` des **autres** commandes du même vendeur, de la plus récente à la plus ancienne ;
   d. solde insuffisant → **le solde du wallet ne devient jamais négatif**. Le reliquat est
   inscrit comme **dette de wallet** (`marketplace_wallet_debts`), qui : gèle la mise en vente et
   l'achat sur la place d'échange, s'apure automatiquement sur les prochains crédits perçus
   (100 % des entrées y passent avant d'être `available`), et peut être réglée volontairement par
   paiement. Aucun débit forcé du moyen de paiement en v1.
5. **Plafond et prescription.** La récupération est plafonnée au net réellement perçu par le
   vendeur sur la commande concernée — jamais plus, jamais de pénalité additionnelle. Aucun
   clawback n'est ouvert après `commitment_ends_at + 30 jours`.
6. **Standing plutôt que sanction financière.** Au-delà du plafond, la conséquence est
   réputationnelle et opérationnelle : baisse du standing vendeur, sortie de la file de priorité,
   événement de balance inverse (§2.7.3), et suspension d'inventaire au 2ᵉ clawback sur 12 mois.
7. **v2 Stripe Connect.** Le séquestre est porté par le solde de la plateforme et le versement au
   compte connecté suit le même calendrier de tranches ; la récupération après versement utilise
   le reversal Stripe, puis retombe sur la dette de wallet si le reversal échoue.

#### 2.5.2 Fiscalité du troc — TVA 20 % et facturation réciproque

Un échange lien / story / post **n'est pas neutre fiscalement** : c'est un double
échange de services à titre onéreux. Chaque jambe est une prestation imposable, valorisée à sa
propre valeur, même si aucun euro ne circule. La plateforme est conçue pour produire les pièces
correspondantes automatiquement.

**Règle centrale.** Pour un troc entre deux assujettis établis en France : deux prestations,
deux factures, **TVA à 20 %** de part et d'autre, base = `marketplace_exchanges.value_cents` de la
jambe fournie (HT). Les TVA se compensent économiquement mais doivent être facturées et déclarées
chacune de son côté. La soulte suit le même régime : elle est un complément de prix de la jambe la
plus faible, TVA 20 % incluse dans sa facture, jamais un flux « hors taxe ».

| Flux | Émetteur → destinataire | Base | TVA v1 |
|---|---|---|---|
| Jambe A (lien, story, post) | vendeur A → bénéficiaire B | `value_cents` de la jambe A | 20 % si A assujetti FR |
| Jambe B | vendeur B → bénéficiaire A | `value_cents` de la jambe B | 20 % si B assujetti FR |
| Soulte | payeur → bénéficiaire | `soulte_cents` | même régime que la jambe qu'elle complète |
| Commission Crawlers 15 % | Crawlers → les deux parties, au prorata des jambes | 15 % de la valeur de chaque jambe | 20 % (prestation d'entremise FR) |
| Crédit wallet | Crawlers → vendeur | — | pas une opération TVA : simple moyen de règlement d'une prestation déjà facturée |

**Statut fiscal déclaré, bloquant à la mise en vente.** Le profil vendeur porte
`tax_status` (`assujetti_fr` | `assujetti_ue` | `assujetti_hors_ue` | `franchise` |
`non_assujetti`), un numéro de TVA intracommunautaire validé via VIES quand il est renseigné, et
le pays d'établissement. Conséquences :
- `assujetti_fr` → TVA 20 % sur la jambe et sur la commission ;
- `assujetti_ue` avec numéro VIES valide → autoliquidation : jambe **hors TVA** avec mention
  « autoliquidation par le preneur, art. 283-2 du CGI » ; la commission Crawlers suit le même
  régime B2B intracommunautaire ;
- `franchise` (micro-entreprise en franchise en base) → mention « TVA non applicable,
  art. 293 B du CGI », pas de TVA collectée, TVA de la commission non déductible ;
- `non_assujetti` (particulier) → **la vente et le troc de liens sont refusés en v1** : impossible
  d'émettre la facture réciproque exigée. Seuls des professionnels peuvent vendre.

**Facturation réciproque (self-billing).** Crawlers émet les factures **au nom et pour le compte**
de chaque partie, sous mandat de facturation accepté à l'onboarding (CGVU) : une facture par jambe,
une facture de commission, numérotation continue par mandant, PDF archivé 10 ans, mentions
obligatoires complètes (identités, TVA, date d'exécution = date de preuve de publication de §2.13,
nature « insertion de lien éditorial » ou « publication sponsorisée », valeur HT, taux, montant de
TVA). La date d'exigibilité retenue est la **date de la première preuve de publication**, pas la
date d'acceptation du match. En cas de remboursement au prorata (§2.13), un **avoir** est émis sur
la même base, TVA incluse, et rattaché à la commande.

**Obligations déclaratives.** Déclaration d'échange de services (DES) pour les jambes
intracommunautaires ; **DAC7** : Crawlers, en tant qu'opérateur de plateforme, collecte
l'identification des vendeurs (identité, TVA/SIREN, pays) et déclare annuellement les
contreparties perçues — **y compris les jambes en troc, valorisées à `value_cents`**, et les
crédits wallet. Le rapport annuel est mis à disposition du vendeur dans la Console.

**Implémentation.** Tables ajoutées en §4 : `marketplace_tax_profiles` (statut, TVA, pays,
validation VIES, mandat de self-billing accepté) et `marketplace_invoices` (une ligne par pièce :
`order_id`, `leg_id`, `kind` `leg` | `soulte` | `commission` | `credit_note`, `issuer_id`,
`recipient_id`, `base_cents`, `vat_rate`, `vat_cents`, `total_cents`, `number`, `issued_at`,
`pdf_path`). La TVA n'est jamais recalculée à l'affichage : elle est figée sur la pièce.

*Cadre de mise en œuvre, pas un conseil fiscal : à faire valider par l'expert-comptable avant
ouverture du troc.*


### 2.6 Vérification de propriété et responsabilité du vendeur

**Aucune mise en vente n'est possible sans propriété vérifiée.** La vérification est un
prérequis technique bloquant, pas une déclaration : un actif reste en statut `unverified` et
n'entre ni dans l'inventaire, ni dans l'appariement, ni dans un troc.

| Type d'actif | Preuve acceptée | Contrôle |
|---|---|---|
| Domaine / page | propriété GSC confirmée sur le compte connecté, ou enregistrement DNS `TXT crawlers-verify=<token>`, ou fichier `/.well-known/crawlers-verify.txt` | automatique, revérifié tous les 30 j |
| Compte LinkedIn | OAuth LinkedIn du compte qui publiera (URN de l'auteur) | automatique |
| Compte Instagram | OAuth Meta du compte professionnel | automatique |

Règles :
- Perte de la preuve (GSC déconnecté, TXT supprimé, OAuth révoqué) → actif repassé
  `unverified`, retiré de l'inventaire ; les commandes en cours sont honorées ou remboursées.
- La vérification s'ajoute à la déclaration de responsabilité (« je suis autorisé à publier un
  lien sur ce site »), tracée avec horodatage et IP dans `marketplace_ownership_claims` : la
  preuve technique établit le contrôle du site, pas le mandat juridique.
- Toute contestation d'un tiers entraîne le retrait immédiat de l'annonce et le remboursement
  de l'acheteur ; la responsabilité juridique reste au vendeur.
- Un domaine ne peut être vérifié que par **un seul compte** à la fois ; en cas de conflit, le
  premier vérifié conserve l'actif et le second est refusé (même logique que
  `ownershipCheck.ts` côté injection).

Cette clause figure aux CGVU (section 7.5).

### 2.7 Incentive : troc (barter)

Le frein principal n'est pas le prix mais l'absence de raison de vendre : un site sans excédent
d'autorité n'a pas d'intérêt monétaire à céder un lien. L'incentive retenu est donc l'**échange**,
avec la même commission Crawlers de 15 %, prélevée en crédits faute de flux d'argent à retenir.

Six `trade_type` sont proposés. Ils ne sont **pas à égalité** : le moteur applique la hiérarchie
de §2.2 (chaîne > cross-média > réciprocité directe) et choisit, à l'intérieur de ce cadre, celui
qui sert le mieux les besoins des deux parties (voir 2.7.1).

| `trade_type` | Jambe A (acheteur reçoit) | Jambe B (vendeur reçoit) | Nature |
|---|---|---|---|
| `link_chain` | lien A→B | lien B→C, puis C→A | **mode privilégié** : boucle 3+ participants, aucune réciprocité directe |
| `link_for_link` | lien A→B | lien B→A | même devise, réciproque direct — **dernier recours** |
| `link_for_linkedin` | lien A→B | post LinkedIn de B citant A | cross-média |
| `link_for_insta` | lien A→B | post/story Instagram de B mentionnant A | cross-média |
| `linkedin_for_linkedin` | post LinkedIn croisé | post LinkedIn croisé | même devise sociale |
| `insta_for_insta` | mention Instagram croisée | mention Instagram croisée | même devise sociale |

#### 2.7.1 Matrice besoin ↔ devise

Trois besoins possibles par site : **SEO** (autorité, classement organique), **GEO** (citabilité
par les moteurs génératifs), **conversion** (trafic qualifié immédiat). La matrice se lit pour
chaque partie séparément — un `trade_type` est pertinent quand la jambe reçue couvre le besoin
dominant de la partie qui la reçoit.

| Jambe reçue | SEO | GEO | Conversion | Commentaire |
|---|---|---|---|---|
| Lien dofollow éditorial | fort | moyen | faible à moyen | seul actif qui transmet de l'autorité ; décoté si réciproque direct |
| Post LinkedIn citant la marque | faible (nofollow) | fort | moyen | page publique indexée, texte servi en SSR, forte reprise dans les corpus et les réponses génératives B2B |
| Post / reel Instagram | quasi nul | faible | fort | peu crawlé, peu cité par les LLM ; valeur réelle = audience et clic bio |
| Story Instagram (24 h) | nul | nul | fort mais éphémère | pic de trafic, aucune trace indexable |

Lecture par `trade_type`, besoin dominant servi de chaque côté :

| `trade_type` | Acheteur sert | Vendeur sert | Cas d'usage type |
|---|---|---|---|
| `link_chain` | SEO | SEO | besoin SEO des deux côtés — **retenu en premier** dès qu'un tiers C ferme la boucle |
| `link_for_link` | SEO | SEO | deux sites à besoin SEO symétrique, seulement si aucune chaîne n'est constructible |
| `link_for_linkedin` | SEO | GEO | acheteur veut de l'autorité, vendeur veut être cité par les IA |
| `link_for_insta` | SEO | Conversion | vendeur B2C cherche du trafic et des ventes, pas du PageRank |
| `linkedin_for_linkedin` | GEO | GEO | deux marques B2B qui veulent exister dans les réponses génératives |
| `insta_for_insta` | Conversion | Conversion | échange d'audience pur, aucun gain SEO/GEO promis |

Règles :
- L'UI n'affiche **jamais** un gain SEO ou GEO pour une jambe Instagram : la valeur annoncée est
  strictement l'audience et le clic.
- `link_chain` est le **mode par défaut pour un besoin SEO symétrique**. Cadre :
  1. Boucle de 3 ou 4 participants (`A→B→C→A`), enregistrée sous un `exchange_id` unique avec une
     jambe par arête et un ordre de publication fixé ;
  2. **7 jours minimum** entre deux jambes de la même boucle, aucune publication simultanée ;
  3. Aucune décote : la valeur de chaque jambe reste la valeur pleine (pas de facteur 0,70) ;
  4. Un site ne participe pas à deux boucles actives contenant le même partenaire direct ;
  5. Si une jambe n'est pas publiée dans le délai, la boucle est annulée : les jambes déjà
     publiées sont requalifiées en vente au prix de l'actif, à la charge du bénéficiaire, sous
     **trois garde-fous** — le bénéficiaire n'est pas responsable de la défaillance d'un tiers :
     a) **consentement explicite** à ce risque au moment de l'acceptation de la boucle (case
        dédiée, texte spécifique, journalisée sur l'`exchange_id`) — jamais un simple renvoi aux
        CGVU génériques ;
     b) **plafond dur** : la requalification ne peut jamais dépasser le prix initialement convenu
        pour la jambe reçue ;
     c) **ordre des supports** : débit des crédits disponibles en priorité, proposition de
        recharge ensuite, débit carte seulement sur accord explicite — aucun prélèvement carte
        surprise. À défaut d'accord, la valeur passe en dette de wallet (§2.5.1).
- `link_for_link` est **autorisé mais en dernier recours**, signalé comme à risque et bridé. Le
  moteur ne le propose que si la recherche de `link_chain` n'a trouvé aucun tiers compatible.
  Quatre garde-fous cumulés, tous appliqués serveur, aucun contournable depuis l'UI :
  1. **Flag de risque** visible des deux côtés avant acceptation (pattern de lien réciproque
     dévalué par Google), avec formulation explicite du risque encouru ;
  2. **Décorrélation temporelle** : délai minimum de 21 jours entre les deux jambes, jamais de
     publication simultanée, ordre de publication tiré au sort. La 2ᵉ jambe d'un troc accepté
     n'est **jamais** bloquée par la règle « lien déjà existant » ni par la détection de cycle
     (exemption explicite de §2.2, portée par le `exchange_id`) ;
  3. **Quota** : maximum **1 réciprocité directe par trimestre et par site**, dans les deux sens
     confondus, et jamais deux fois avec le même partenaire sur 12 mois glissants ;
  4. **Détection de cycle** : le graphe des liens échangés est parcouru avant validation ; toute
     boucle **non déclarée** (fermée de fait, sans `exchange_id` de type `link_chain` ou
     `link_for_link` accepté) **bloque** la proposition en 409, sans possibilité de forçage.
- La valeur d'une jambe LinkedIn est estimée sur les impressions et l'engagement des 10 derniers
  posts du vendeur, publication vérifiée via l'URN/URL stable du post. À défaut d'impressions
  exposées par l'API : followers × taux d'engagement observé sur les réactions publiques. La
  valeur obtenue est arrondie au palier de 10 € et bornée à 40 € – 350 € comme un lien.
- Commission Crawlers sur un troc : **15 %** de la valeur estimée de chaque côté, prélevée en
  crédits — **même taux que la vente cash**, aucune exception de devise ni de `deal_type`.
- Le troc suit le même workflow de prévisualisation (2.3) et de double feedback que la vente.
- Plafonds : maximum 2 échanges actifs par site sortant et par mois, dont **au plus 1
  `link_for_link` par trimestre** (règle 3 ci-dessus, la plus contraignante l'emporte). Les
  boucles `link_chain` comptent dans les 2 échanges actifs mais pas dans le quota trimestriel.

#### 2.7.2 Sélection du `trade_type` et de la soulte

Le moteur ne demande pas aux parties de choisir : il propose. Séquence déterministe, sans LLM.

```
1. Besoins   : need(A), need(B) ∈ {seo, geo, conversion} (dominant + secondaire),
               dérivés de architect_workbench, du profil E-E-A-T et des actifs connectés.
2. Candidats : trade_types dont la jambe reçue par A couvre need(A)
               ET la jambe reçue par B couvre need(B)   → "besoins concordants"
2b. Priorité : si need(A) = need(B) = seo, on cherche d'abord un tiers C
               (voire D) fermant une boucle A→B→C→A : compat(B,C) ≥ 0.6
               et compat(C,A) ≥ 0.6, aucun lien préexistant sur les arêtes.
               Trouvé → trade_type = link_chain, on saute l'étape 5.
               Non trouvé → link_for_link reste candidat, en dernier rang.
3. Si candidats ≠ ∅ :
      juste échange → on retient le trade_type au meilleur couple
      (couverture_besoin × faisabilité des actifs connectés), l'ordre de
      préférence de §2.2 départageant les ex æquo
      (link_chain > cross-média > link_for_link)
4. Si candidats = ∅ (besoins non concordants) :
      on retient le trade_type que le vendeur peut honorer,
      puis on équilibre par l'équité :
         value(jambe_A) et value(jambe_B) estimées dans la même unité (€)
         écart = value(jambe_A) − value(jambe_B)
         |écart| ≤ 15 %  → échange pur
         |écart| >  15 %  → soulte réglée par la partie avantagée,
                            uniquement sous deux formes :
                              a) cash : le prix en euros de la commande augmente
                                 du montant de l'écart, arrondi au palier de 10 €
                                 et borné de sorte que le total reste dans 40–350 €
                              b) crédits : transfert de crédits Crawlers
                                 de wallet à wallet entre les deux users
                                 (⚠ validation juridique paiement obligatoire
                                  avant implémentation, cf. §2.16)
                                 (même arrondi 10 €, 1 crédit = 1 € pour l'équité)
0. Garde   : les deux actifs doivent être en statut `verified` (§2.6),
             sinon la proposition n'est pas générée.
5. Décote  : si trade_type = link_for_link, value de chaque jambe × 0,70
             (facteur de décote réciproque v1) avant calcul de l'écart,
             puis contrôle du quota trimestriel et de l'absence de cycle non
             déclaré : échec → proposition bloquée, pas de repli sur un autre
             trade_type. link_chain n'est jamais décoté.
6. Sortie  : { trade_type, jambe_A, jambe_B, soulte, devise_soulte, risk_flags[] }
             présenté aux deux parties, acceptation explicite des deux côtés requise.
```

Autrement dit : **quand les besoins matchent, on optimise le juste échange (troc pur) ; quand ils
ne matchent pas, on choisit le `trade_type` réalisable et on rétablit l'équité par le prix.**

**Règle non négociable : Crawlers ne finance jamais la soulte.** La soulte est toujours payée par
l'un des deux users à l'autre — en euros (hausse du prix de la commande) ou en crédits Crawlers
transférés de wallet à wallet. Aucun mois d'abonnement offert, aucun audit offert, aucune remise
plateforme n'entre dans le calcul d'équité : ce serait Crawlers qui paierait l'écart entre deux
tiers. Crawlers ne prélève que sa commission.

#### 2.7.3 Équilibrage réseau long terme (balance d'autorité)

L'équité par échange ne suffit pas : un site qui vend un lien contre une story cède de l'autorité
(devise rare, effet durable) contre de la visibilité (devise périssable). Répété, ce schéma appauvrit
les meilleurs vendeurs et vide la marketplace de ses inventaires de qualité. On tient donc, en plus
de l'équité par transaction, une **balance d'autorité par site**, cumulée dans le temps.

**Formule (amortissement linéaire 24 mois)**

```
Pour chaque jambe j livrée et vérifiée :
   sign(j)  = +1 si le site REÇOIT de l'autorité (achat / jambe entrante)
              −1 si le site CÈDE de l'autorité   (vente / jambe sortante)
   value(j) = valeur € estimée de la jambe au moment du deal (prix figé,
              ou valeur du palier P1–P5 pour une jambe troquée),
              × facteur de décote réciproque si trade_type = link_for_link
   age_m(j) = mois écoulés depuis delivered_at
   w(j)     = max(0, 1 − age_m(j) / 24)          -- 0 au-delà de 24 mois

authority_balance(site)  = Σ sign(j) × value(j) × w(j)   pour j ∈ jambes link_*
visibility_balance(site) = Σ sign(j) × value(j) × w(j)   pour j ∈ jambes story / post LinkedIn
```

Ce qui n'entre dans aucune balance, ce sont les **règlements** (euros encaissés, crédits
transférés, soulte) : un flux monétaire n'est ni un transfert d'autorité ni une exposition. En
revanche, **toute jambe livrée compte, quel que soit le `deal_type`** : un lien vendu en cash
transfère autant d'autorité qu'un lien troqué, donc il est inscrit avec le même `sign` et la même
valeur. La distinction est jambe (comptée) vs règlement (jamais compté). Les deux balances sont
indépendantes et ne se compensent jamais entre elles : une story reçue ne comble pas un déficit
d'autorité.


**Mise à jour**

- Un événement de balance est écrit **par jambe**, au passage au statut `delivered` (lien détecté
  live par le vérificateur, ou story/post constaté par le connecteur) — jamais à la commande.
- Une jambe annulée, remboursée, ou dont le lien disparaît au contrôle de vie (`marketplace_verifications`)
  génère un événement **inverse** de même valeur : la balance revient à son état antérieur.
- Le poids `w(j)` étant fonction du temps, les balances sont recalculées quotidiennement (cron) à
  partir du journal ; le journal reste la source de vérité, les balances sont un cache.
- Chaque vente ou achat touche **deux sites** : le site sortant (−) et le site cible du lien (+).

**File de passage à l'achat de liens (déficit cédé + besoin diagnostiqué)**

La priorité ne récompense pas seulement l'autorité cédée : elle sert aussi le besoin objectivé et non
encore servi. Sans quoi un acheteur pur ou un nouvel entrant, dont la balance est ≥ 0, resterait
structurellement en fin de file — l'inverse de l'intention.

```
deficit_cede(site) = max(0, − authority_balance(site))                    centimes €
besoin_non_servi(site) = Σ valeur_acheteur_cents(besoins ouverts)         centimes €
                         − Σ value_cents(jambes link_* entrantes servies sur 90 j)
besoin_non_servi(site) = max(0, besoin_non_servi(site))

need_score     = min(besoin_non_servi, plafond_besoin)        plafond 350 € × 3
priority_score = (deficit_cede + 0,6 × need_score) × ancienneté_en_file^0.5
```

1. `deficit_cede` capte l'autorité déjà donnée (troc `link_for_insta`, vente nette) ; `need_score`
   capte le besoin diagnostiqué par les audits (`marketplace_needs`, §2.11) et non encore couvert par
   des liens reçus. Le coefficient 0,6 garde la dette réelle prioritaire sur le besoin déclaratif.
2. `need_score` n'existe que sur des besoins **diagnostiqués** — issus de `architect_workbench` /
   E-E-A-T / Marina — jamais d'une simple déclaration d'intention dans l'UI : pas de gonflage.
3. **Nouvel entrant** : ses besoins ouverts sont valorisés dès le premier audit, donc son
   `priority_score` est immédiatement > 0 même sans historique de vente. Un plafond
   (`plafond_besoin`) empêche qu'un très gros besoin monopolise la file.
4. À `priority_score` égal (typiquement deux sites sans dette ni besoin ouvert), l'ordre est
   chronologique (FIFO).
5. **Décroissance** : chaque lien entrant servi retire sa valeur de `besoin_non_servi`, donc fait
   baisser la priorité du site — rotation garantie, pas de capture de la file.
6. Une jambe d'inventaire peut être **réservée** un temps borné (48 h) au site prioritaire avant
   d'être ouverte au reste de la file.
7. **Éligibilité vendeur** : sous un seuil de déficit, un site ne peut plus vendre de jambe `link_*`
   tant qu'il n'a pas reçu au moins un lien — protection anti-épuisement, pas une sanction.
8. **Alerte transparente** : un vendeur qui accepte `link_for_insta` voit affiché « vous cédez de
   l'autorité contre de la visibilité — vous serez prioritaire sur les prochains achats de lien ».
9. **Aucune dette Crawlers** : la priorité est un droit de passage dans la file, jamais un crédit
   offert. Le site prioritaire paie toujours son lien (euros, crédits ou troc).

**Ajouts DB** : `marketplace_balance_events`, `marketplace_site_balances` et
`marketplace_link_queue` — définition unique en §4 (aucun schéma n'est décrit ailleurs dans ce
document). Point clé : un événement de balance ne stocke pas de montant propre, il pointe la jambe
(`leg_id`) et n'en porte que le signe ; `need_score` et `priority_score` sont des colonnes de
`marketplace_link_queue`, recalculées par cron depuis `marketplace_needs` et le journal.




### 2.8 Autres contreparties pour équilibrer un lien

Deux règles : la contrepartie ne doit **jamais** être un lien retour vers le site acheteur, et elle
doit toujours être fournie par l'un des deux users — jamais par Crawlers.

| Contrepartie | Valeur pour l'acheteur | Vérifiable par Crawlers |
|---|---|---|
| Euros (hausse du prix de la commande) | règlement direct de l'écart, paliers P1–P5 | oui, natif |
| Crédits Crawlers transférés d'un wallet à l'autre | le vendeur est payé en usage plateforme, sans sortie de cash côté acheteur | oui, natif |
| Post LinkedIn ou story Instagram | cf. 2.7 | oui, via connecteurs |
| Newsletter : mention dans un envoi | audience qualifiée, non indexable, aucun signal SEO | partiellement (capture d'écran + nombre d'abonnés déclaré) |
| Citation dans un contenu tiers (podcast, interview, étude co-signée) | E-E-A-T réel, mention de marque exploitée par les LLM | manuel |
| Donnée / étude exclusive fournie par l'acheteur au vendeur | le vendeur reçoit un contenu à publier, l'acheteur obtient la citation de source | manuel |

Les deux seules devises de soulte en v1 sont donc **les euros** et **les crédits Crawlers transférés
entre users**. Les mois d'abonnement offerts, remises et audits offerts sont exclus : ils feraient
supporter par Crawlers l'écart de valeur entre deux tiers. Les contreparties sociales (jambes
LinkedIn et Instagram, cf. 2.7) arrivent avec les connecteurs. Les contreparties non vérifiables
automatiquement (newsletter, podcast, étude) restent hors v1 et hors garantie.


### 2.9 Studio de création (générateur de livrables, 3 versions)

Aucun livrable n'est rédigé par les users : **Crawlers produit le contenu**, en 3 versions,
et les deux parties s'accordent sur celle qui sera publiée. Le studio couvre les quatre formats
de jambe : section ou page d'accueil du lien, post LinkedIn (+ média), reel Instagram, story
Instagram.

#### Entrées du générateur (toutes déterministes, calculées avant tout appel LLM)

| Entrée | Source |
|---|---|
| Besoin acheteur (`seo` / `geo` / `conversion`) | `marketplace_needs.need_primary`, dérivé de `architect_workbench` |
| Page cible, ancre, mot-clé, intention | tâche workbench + `keyword_universe` (SSOT) |
| Cible/audience du vendeur | GSC (requêtes, pays, device) ou insights Meta / LinkedIn |
| Ton et distance de jargon du vendeur | Voice DNA + `jargon_distance` de la carte d'identité du site vendeur |
| Standing du vendeur | autorité de domaine, `authority_balance`, qualité éditoriale, format (média, marque, satellite) |
| Contexte réel de la page hôte | contenu crawlé de la page vendeur (`crawl_pages`), pour l'insertion |
| Contraintes de conformité | attribut du lien, mention #pub / #sponso, mentions ARPP/FTC |

Le brief est construit par `buildContentBrief()` (pipeline déterministe pré-LLM) puis passé au
pipeline éditorial 4 étapes (briefing → stratégiste → rédacteur → tonaliseur). Règles reprises
sans exception : aucun emoji, une seule ancre par livrable, aucune promesse de classement,
tactique SEO ≠ sujet, HTML pour tout push CMS.

#### Les 3 versions

Chaque commande génère exactement trois variantes, différenciées par **angle et registre**, pas
par de simples reformulations :

| Version | Axe | Usage typique |
|---|---|---|
| A — Éditoriale | contexte métier du vendeur, lien contextuel discret | standing élevé, média, ton neutre |
| B — Utilitaire | réponse à une question concrète, passage citable de 40–80 mots | besoin GEO de l'acheteur |
| C — Orientée action | bénéfice explicite + CTA sobre | besoin conversion, jambe LinkedIn / reel |

Le standing du vendeur borne les versions proposées : au-delà d'un seuil d'autorité, la version C
est retirée (elle abîme la page hôte et fait tomber la jambe dans le publicitaire brut).

#### Arbitrage et dernier mot

1. Génération des 3 versions par Crawlers (coût LLM mutualisé, cache par commande).
2. Le **vendeur** classe / écarte : il peut refuser une version pour incompatibilité avec sa page,
   sa ligne éditoriale ou son audience — motif obligatoire, journalisé.
3. L'**acheteur tranche** parmi les versions restées acceptables : son choix est décisif.
4. Si le vendeur écarte les trois, un seul cycle de régénération est déclenché (nouveau brief
   contraint par les motifs de refus), puis arbitrage Crawlers ou annulation sans frais.
5. Les tours de révision restent plafonnés à **3** (cf. 2.3) et sont partagés avec le studio :
   les révisions ne sont pas un canal de rédaction gratuit.

#### Contrôle d'homogénéité stylistique (avant volume)

Un pipeline éditorial unique appliqué à des milliers d'insertions peut développer une empreinte
statistique détectable (longueur de phrase, structure, tournures récurrentes) — exactement le
reproche adressé aux réseaux automatisés en §2.10. La diversité perçue par les deux parties d'une
même commande ne prouve rien à l'échelle du corpus. Test obligatoire **avant L3**, peu coûteux :

- échantillon de **quelques centaines de générations simulées** couvrant plusieurs Voice DNA,
  paliers et secteurs ;
- mesures : recouvrement de n-grammes (3-5), distribution des longueurs de phrase, similarité
  syntaxique inter-livrables, fréquence des amorces de paragraphe ;
- seuil de rejet à fixer avec les premières mesures, versionné comme constante (§2.15) ;
- au-delà du seuil : diversification des gabarits de brief avant ouverture au volume.

Traçabilité : chaque version est une ligne `marketplace_content_variants` (variante A/B/C, brief
figé, sortie, modèle utilisé, coût), les refus dans `marketplace_feedback`, la version retenue
référencée par `marketplace_orders.approved_revision_id`.

---

### 2.10 Paysage concurrentiel — services analogues

Trois familles existent déjà. Aucune ne combine troc multi-devises, balance d'autorité et
génération de livrables adossée à un audit du site hôte.

**Famille A — réseaux d'échange automatisés en abonnement.** BabyLoveGrowth (~99 $/mois) publie
des articles quotidiens sur le blog du client et redistribue des liens entre ses abonnés ; même
modèle chez Keytomic (~99 $/mois, « 30 opportunités de liens DR élevé »), RankYak (49–299 $) et
AutoSEO. Faiblesses documentées : empreinte machine uniforme (une même phrase d'attribution sur
plusieurs milliers de domaines référents), absence de filtrage du voisinage thématique, et
confusion volume d'articles / autorité gagnée.

**Famille B — marketplaces d'articles sponsorisés (achat cash).** RocketLinks (200 000+ sites),
Getfluence (~45 000 médias, positionnement premium), Collaborator/Collaba (40 000+ sites),
Linkhouse, Adsy, Prnews.io. Inventaire large, prix fixé par l'éditeur, commission plateforme,
paiement en euros uniquement. Pas de troc, pas de réciprocité, pas de mesure de ce que le
vendeur cède en autorité.

**Famille C — outils de mise en relation / échange manuel** (groupes Slack, annuaires,
« link swap » entre pairs) : gratuit, non instrumenté, non traçable, réciprocité directe donc
schéma dévalué.

| Critère | BabyLoveGrowth / Keytomic | RocketLinks / Getfluence / Collaborator | Échange manuel entre pairs | Place d'échange Crawlers |
|---|---|---|---|---|
| Modèle | Abonnement, liens distribués automatiquement | Achat à l'unité, commission | Gré à gré | Achat cash **et** troc, commission unique 15 % |
| Devises d'échange | Aucune (bundle) | Euros | Lien contre lien | Lien, LinkedIn, Instagram, crédits, euros |
| Contrôle du voisinage | Faible (base non filtrée) | Éditorial (curation Getfluence) | Aucun | Filtrage thématique + standing vendeur |
| Empreinte / risque de pattern | Élevé (attribution uniforme) | Moyen (articles sponsorisés massifs) | Élevé (réciprocité directe) | boucles `link_chain` privilégiées, `link_for_link` en dernier recours, flaggé, décorrélation 21 j, décote d'équité |
| Appariement au besoin réel | Non | Filtres manuels (DR, trafic, thème) | Non | Matrice besoin ↔ devise (SEO / GEO / conversion) des deux parties |
| Équité de l'échange | Non calculée | Prix éditeur | Négociée à l'œil | Score d'équité, soulte en euros ou crédits (jamais financée par Crawlers) |
| Mémoire long terme | Non | Non | Non | Balance d'autorité par site amortie 24 mois + file de priorité |
| Production du contenu | IA générique, non validée | À la charge de l'acheteur ou option payante | Manuelle | Studio 3 versions (éditoriale / citable / action), veto vendeur, arbitrage acheteur |
| Ancrage GEO | Marginal | Revendiqué (citations IA) sans mesure | Non | Passage citable mesuré, Score GEO et rapports Marina |
| Vérification de la livraison | Interne opaque | Contrôle plateforme | Aucune | `marketplace_verifications`, événements inverses si retrait |

**Positionnement retenu.** Ni un réseau de liens en abonnement (empreinte), ni une régie
d'articles sponsorisés (cash uniquement) : une place d'échange instrumentée, où chaque
transaction est arbitrée par les besoins mesurés des deux sites et où l'autorité cédée est
comptabilisée. Les arguments différenciants à reprendre en landing : mesure du besoin,
troc multi-devises, balance d'autorité, studio de contenu, vérification post-publication.

**À éviter dans la communication** : promettre un volume de liens, afficher un « DR garanti »,
ou laisser croire qu'une jambe Instagram apporte du SEO ou du GEO.

---

### 2.11 Valeur d'appariement exposée dans les audits (page et domaine)

La Place d'échange n'est pas un module isolé : sa métrique cœur, la **valeur d'appariement**, est
affichée là où l'utilisateur constate son déficit — l'Audit stratégique GEO et les rapports Marina.

**Niveau page — `match_value(page)`** (audit d'une URL) :

```
match_value(page) = valeur_vendeur(page)   // ce que cette page peut rapporter en la vendant
                  ⊕ valeur_acheteur(page)  // ce qu'un lien entrant vers cette page rapporterait
```

- `valeur_vendeur(page)` = prix serveur borné 40–350 € (paliers de 10 €), calculé par le moteur de
  pricing (§2.1), + nombre de besoins acheteurs actifs dont `compat ≥ 0.6` avec cette page.
- `valeur_acheteur(page)` = gain de position attendu (ETV potentiel), nombre d'actifs vendeurs
  disponibles à `compat ≥ 0.6`, fourchette de prix constatée et ancre recommandée.
- Affichage : bloc unique « Valeur d'appariement » avec les deux faces, la source de chaque chiffre
  (mesuré / estimé, badges centrés) et un lien vers l'onglet Place d'échange pré-filtré sur la page.
- Aucune valeur n'est affichée si la propriété du domaine n'est pas vérifiée : le bloc invite alors à
  vérifier (§2.6) au lieu d'annoncer un prix non commercialisable.

**Niveau domaine — `global_match_value(site)`** (audit de domaine, Marina multipages) :

```
global_match_value(site) = Σ valeur_vendeur(p) sur les pages éligibles à la vente (§2.12)
                         + Σ valeur_acheteur(p) sur les pages en déficit d'autorité
                         − plafonds appliqués (1 lien dofollow/page, 20/an/domaine)
```

Restitué en trois chiffres, jamais en score composite opaque :
1. **Potentiel de vente** (€/an, plafonds inclus) et nombre de pages éligibles ;
2. **Besoin d'achat** (€ estimé pour combler le déficit) et nombre de pages concernées ;
3. **Solde d'appariement** = potentiel de vente − besoin d'achat, avec la lecture métier
   (« votre domaine est net vendeur / net acheteur d'autorité »).

Règles de restitution : mêmes garde-fous que le reste des audits — pas de promesse de classement,
disclosure méthodologique (mutualisation, fraîcheur des données), fourchettes plutôt que chiffres
faussement exacts, cache site-scoped 24 h aligné sur Marina. Aucun appel LLM supplémentaire :
la valeur d'appariement est **entièrement déterministe**, calculée par server function à partir du
pricing, du graphe de liens et des besoins déjà présents dans `architect_workbench`.

### 2.12 Ciblage des pages présentant le moins de risque d'autorité à la vente

Vendre un lien coûte de l'autorité. Le moteur ne propose donc à la vente que les pages dont la
cession est **la moins pénalisante pour le site vendeur**, avec un score de risque explicite :

```
sell_risk(page) = 0.30 × poids_stratégique      (pilier, page de conversion, page money)
                + 0.25 × dépendance_interne     (part du PageRank interne transitant par la page)
                + 0.20 × momentum_GSC           (progression récente de positions / impressions)
                + 0.15 × saturation_sortante    (tous les liens externes déjà présents sur la page,
                                                 y compris les insertions vendues via la place
                                                 d'échange en `sponsored` / `nofollow` — pas
                                                 seulement l'historique `dofollow`)
                + 0.10 × fragilité_technique    (page récente, thin, non indexée, instable)
```

Éligibilité à la vente : `sell_risk ≤ 0.35`. Trois classes affichées côté vendeur :
**Sûr** (≤ 0.20) · **Modéré** (0.20–0.35, avertissement) · **Déconseillé** (> 0.35, opt-in bloqué).

Exclusions dures, indépendantes du score :
- pages piliers des 4 silos et pages de conversion (devis, tarifs, contact) ;
- pages sous surveillance du Drop Detector ou en cours de pruning / consolidation ;
- pages générées par l'agent SEO depuis moins de 90 jours (historique GSC insuffisant) ;
- pages hors du périmètre de propriété vérifiée.

Le classement de l'inventaire « Je vends » est trié par `valeur_vendeur / sell_risk` décroissant :
le meilleur revenu au moindre coût d'autorité, avec la raison affichée pour chaque page.
Le score est recalculé à chaque crawl et un passage en « Déconseillé » retire automatiquement la
page de l'inventaire (les commandes en cours sont honorées).

### 2.13 Vérification de publication et de maintien de publication

Une jambe n'est réputée livrée que **prouvée**, et elle doit le rester pendant la durée engagée,
portée par `marketplace_orders.commitment_months` : **12** pour un lien, **1** (30 jours) pour un
post LinkedIn ou un Reel permanent, **0** pour une story Instagram — un format qui expire en 24 h
ne peut porter aucun engagement de maintien, donc ni prorata ni contrôle mensuel : la preuve
d'affichage sur la fenêtre de 24 h vaut livraison définitive (§2.5.1, tranche unique à J+2).
`commitment_ends_at` matérialise la durée (égal à `published_at + 24 h` pour une story). C'est cette
colonne, et elle seule, qui sert de base au calcul de prorata en cas de retrait anticipé.


| Actif | Preuve de publication | Maintien |
|---|---|---|
| Lien / page | crawl de la page : ancre attendue, URL cible, attribut (`dofollow` / `sponsored`), statut HTTP et verdict via `_shared/linkVerdictShared.ts` ; capture visuelle archivée | recrawl J+1, J+7 puis mensuel jusqu'à la fin de l'engagement |
| Post LinkedIn | API LinkedIn : URN du post, auteur, texte, présence du lien et de la mention de conformité | contrôle J+1, J+7, J+30 puis mensuel ; suppression détectée = disparition |
| Story / Reel Instagram | API Meta : `media_id`, type de média, sticker/lien, mention de conformité, insights J+7 | story : preuve d'affichage sur la fenêtre de 24 h, archivage de la capture ; Reel : contrôle mensuel |

Machine à états d'une jambe : `pending` → `published` (première preuve) → `verified` (preuve
confirmée à J+7) → `maintained` (contrôles récurrents OK) → `broken` (preuve perdue) →
`resolved` | `refunded`.

Conséquences d'une rupture, appliquées côté serveur sans intervention manuelle :
- verdict `hard_broken` / lien absent / `nofollow` ajouté à la place de l'attribut convenu →
  jambe `broken`, **calendrier de déblocage du séquestre gelé** (§2.5.1), fenêtre de remise en
  conformité de 7 jours ;
- non-corrigé après la fenêtre → remboursement au prorata du temps restant, prélevé d'abord sur le
  séquestre `held` puis selon la cascade de récupération de §2.5.1 (jamais de solde négatif : le
  reliquat devient une dette de wallet), **événement de balance inverse** (§2.7.3) et impact sur le
  standing du vendeur ;
- OAuth révoqué (LinkedIn / Meta) → impossibilité de vérifier assimilée à une rupture, l'actif
  repasse `unverified` (§2.6) ;
- blocage de crawl (403 bot, robots.txt, coquille JS non-SSR) → escalade de rendu avant tout verdict
  négatif : jamais de rupture prononcée sur un simple échec de récupération.

Tous les contrôles sont journalisés dans `marketplace_verifications` (une ligne par contrôle :
méthode, verdict, preuve, capture) — c'est cette table qui sert de preuve en cas de litige.

### 2.14 Balance d'autorité comme produit de rétention

La balance d'autorité (§2.7.3) n'est pas qu'un garde-fou d'équité : c'est le **mécanisme de
rétention** de la Place d'échange, parce qu'elle crée une dette réciproque qui n'a de valeur qu'à
l'intérieur de la plateforme.

Leviers de rétention :
- **Un actif qui ne se transporte pas** : un déficit d'autorité et sa priorité d'achat associée
  n'existent que dans Crawlers ; partir revient à renoncer à la contrepartie déjà cédée.
- **Priorité d'achat comme récompense** : plus un site a cédé d'autorité, plus il passe devant sur
  les actifs rares (§2.7.3), file recalculée quotidiennement — bénéfice visible et périssable.
- **Amortissement 24 mois** : le solde décroît avec le temps, donc l'avantage se consomme si le site
  reste inactif. Rappel explicite : « votre priorité d'achat expire dans X jours ».
- **Historique long** : le journal `marketplace_balance_events` constitue une mémoire de deux ans
  (autorité cédée, reçue, partenaires) qu'aucun concurrent ne restitue (§2.10).
- **Lecture dans les audits** : la balance et le solde d'appariement (§2.11) apparaissent dans
  l'Audit stratégique et Marina, donc à chaque rapport, pas seulement dans le module marketplace.

Restitution UI (onglet Place d'échange, bloc « Ma balance ») : solde d'autorité et solde de
visibilité séparés (ils ne se compensent jamais), courbe sur 24 mois, rang dans la file de
priorité, prochaine échéance d'amortissement, et les trois dernières jambes ayant bougé la balance.

Garde-fous : aucune gamification (pas de badge, pas de classement public entre utilisateurs), aucune
promesse de gain SEO liée au solde, et un déficit ne bloque jamais l'achat — il ne fait que
prioriser. La balance est une comptabilité lisible, pas un score de fidélité.


### 2.15 Constantes de pricing et de seuils — table versionnée

Toutes les formules du document laissent des paramètres à calibrer : `base` du prix indicatif
(§2.1), seuils de mapping score → palier, seuil de déficit d'éligibilité vendeur (§2.7.3, point 7),
seuil d'autorité au-delà duquel la version C du Studio disparaît (§2.9), `base_format` et les
fonctions `f`, `g`, `h`, `k` du pricing Collab (§3), seuils de similarité du contrôle
d'homogénéité (§2.9).

**Règle d'architecture : aucun de ces paramètres n'est un magic number dans une server function.**
Ils vivent dans une table de constantes versionnée, lue par les server functions au calcul, et
recalibrable sans migration de schéma ni déploiement :

```sql
create table public.marketplace_pricing_constants (
  id uuid primary key default gen_random_uuid(),
  version int not null,                  -- version active = max(version) where active
  key text not null,                     -- 'price_base_cents', 'tier_thresholds',
                                         -- 'seller_deficit_min', 'studio_version_c_max_authority',
                                         -- 'insta_base_format', 'insta_curve_f', ...
  value jsonb not null,                  -- scalaire ou courbe (points d'interpolation)
  active boolean not null default false,
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (version, key)
);
```

- Lecture serveur uniquement (`GRANT SELECT ON public.marketplace_pricing_constants TO
  authenticated` seulement si une valeur doit être affichée ; sinon aucun accès client),
  `GRANT ALL ... TO service_role`, RLS activée, écriture réservée aux admins.
- Chaque commande figée stocke `constants_version` : un prix est toujours rejouable à l'identique.
- Les seuils sont **testables séparément du code** (jeu de cas de référence : entrée → palier
  attendu), condition d'un recalibrage sûr après les premières semaines de données réelles.

### 2.16 Validations externes bloquantes et arbitrage des litiges

#### 2.16.1 Validation juridique paiement — crédits transférables entre utilisateurs

La soulte réglée par **transfert de crédits de wallet à wallet** (§2.7.2, §2.8) sort de la boucle
fermée émetteur ↔ utilisateur : un crédit circulant de A vers B se rapproche d'un instrument de
paiement entre tiers, cas qui a déjà entraîné des requalifications de systèmes de points en
monnaie électronique (agrément ACPR, DSP2).

Décision : la fonctionnalité est **conservée mais gelée en implémentation** jusqu'à validation
écrite d'un juriste spécialisé paiement — même niveau d'exigence que la validation du cadrage
fiscal par l'expert-comptable (§2.5.2), et **avant L1** puisqu'elle touche le modèle de données du
wallet. Repli sans risque si la validation est négative : soulte en cash uniquement, ou soulte
absorbée par un ajustement de palier des deux jambes.

#### 2.16.2 Arbitrage Crawlers — processus minimal

« Arbitrage Crawlers » est l'issue finale après 3 tours de révision infructueux (§2.3, §2.9) ou
sur litige de maintien (§2.13). Processus v1, à livrer **avec L3** :

| Élément | Règle v1 |
|---|---|
| Nature | **humain** (support Crawlers), assisté par un dossier automatique : brief figé, versions générées, motifs de refus, journaux de crawl et captures (§2.13) |
| Déclencheurs | 3 tours de révision épuisés · désaccord sur la conformité d'une insertion · verdict de rupture contesté |
| Critères de décision, dans cet ordre | 1. preuve technique (verdict `_shared/linkVerdictShared.ts`, capture, statut HTTP) · 2. conformité au brief figé et aux règles éditoriales · 3. respect des délais contractuels par chaque partie |
| Issues possibles | maintien de la commande · annulation sans frais (aucune commission) · remboursement au prorata (§2.13) · exécution forcée de la jambe restante dans un délai imparti |
| SLA | accusé de réception 24 h ouvrées · décision motivée sous **5 jours ouvrés** · une seule contestation possible, tranchée sous 5 jours ouvrés supplémentaires |
| Traçabilité | table `marketplace_disputes` (commande, ouvrant, motif, pièces, décision, motivation, décideur, horodatage) ; décision et motivation visibles des deux parties |

Aucune décision d'arbitrage ne peut créer une commission supplémentaire ni modifier le prix figé.

---

## 3. Moteur d'appariement Collab Instagram (v1.5)

Deuxième type d'offre dans la même place d’échange, même wallet, même commission, logique
d'évaluation distincte.

| Backlink | Collab Instagram |
|---|---|
| Actif : une page | Actif : un compte + un format (feed / reel / story) |
| Valeur : autorité, trafic, sémantique | Valeur : reach, engagement, affinité d'audience |
| Vérification : présence du lien au crawl | Vérification : publication + mention via API Meta |
| Conformité : `sponsored` / dofollow | Conformité : mention #pub / #sponso (ARPP, FTC) |
| Livrable permanent | Story éphémère (24 h) ou feed/reel permanent |

Le vendeur connecte un compte **Business ou Creator** (scopes `instagram_basic`,
`instagram_manage_insights`, `instagram_content_publish`, `pages_read_engagement`) :
followers, reach, impressions, engagement, démographie d'audience, insights par média
deviennent disponibles et servent au pricing.

```
-- base_format, f, g, h, k : constantes versionnées, cf. §2.15 (jamais en dur dans le code)
prix_collab = base_format × f(reach_moyen) × g(engagement_réel)
            × h(affinité_thématique_audience ↔ acheteur) × k(qualité_créative)
prix_final  = palier(clamp(prix_collab, 40 €, 350 €))     -- mêmes bornes et mêmes paliers
                                                          -- P1 40 · P2 90 · P3 150 · P4 250 · P5 350
```

Le résultat est **borné et arrondi exactement comme un lien** (§2.1) : bornes dures 40 € – 350 €,
arrondi au palier de 10 €, aucun prix hors grille, aucune dérogation. Une valeur calculée sous
40 € rend l'actif non vendable (affiché « valeur insuffisante ») plutôt que vendu sous la borne.


Anti-fraude : détection de reach acheté (engagement/followers hors bornes), variations de
followers en escalier, audience géographique incohérente avec la cible.

Prévisualisation : même mécanique bilatérale que le backlink, appliquée au **brief créatif**
(accroche, légende, mention obligatoire, lien bio/sticker), avec 3 tours de feedback maximum.

Vérification post-publication : `media_id` récupéré via API, contrôle de la mention de
conformité, capture visuelle archivée, insights à J+7 pour le reporting acheteur.

---

## 4. Modèle de données (source unique)

Cette section est la **seule** définition de schéma du document : toute table citée ailleurs (§2.7,
§2.11, §2.12, §2.13, §3) y renvoie et n'y ajoute aucun champ.

Tables `public.*`, RLS par `auth.uid()`, GRANT explicite (`authenticated`, `service_role`).
Écritures de prix, de commission, de valeur de jambe et de statut : **server functions uniquement**
(`src/lib/marketplace/*.functions.ts`), jamais depuis le client.

### 4.1 Règle d'unicité de la valeur

Une seule table porte un montant de jambe : `marketplace_exchanges.value_cents`.

| Chiffre | Table propriétaire | Ailleurs |
|---|---|---|
| Valeur d'une jambe (lien, story, post) | `marketplace_exchanges.value_cents` | référencée par `leg_id`, jamais recopiée |
| Prix figé de la commande et commission 15 % | `marketplace_orders` | dérivé des jambes au moment du figeage, jamais recalculé après |
| Soulte (écart entre les deux jambes) | `marketplace_orders.soulte_cents` | **valeur écrite** par la server function au figeage de la commande, jamais une colonne générée : elle dépend de la décote 0,70 (`link_for_link`), de l'arrondi au palier de 10 € et du plafond total de 350 €, donc elle n'est pas recalculable par simple différence des jambes. Immuable après figeage |
| Impact sur la balance d'autorité | `marketplace_balance_events` | ne stocke **aucun** montant : `leg_id` + `sign` ; la valeur est lue par jointure |
| Soldes agrégés | `marketplace_site_balances` | cache recalculable, jamais autoritaire |
| Valeur d'appariement (estimation, pas transaction) | `marketplace_match_values` | cache TTL 24 h, sans lien avec les montants réels |

### 4.2 Actifs, besoins, appariement

- `marketplace_link_assets` — page vendeur, opt-in, signaux, prix calculé, plafonds.
  `SELECT` des colonnes de signaux brutes (clics/impressions/position/requêtes) réservé au
  propriétaire (`auth.uid()`) et à `service_role`.
- `marketplace_asset_public_signals` (vue) — projection exposable d'un actif : scores normalisés
  0–100, **fourchettes** de clics/impressions/position, thématiques (clusters), tendance,
  top pays. Aucune valeur GSC exacte, aucune requête, aucun agrégat domaine (§2.1.1).
  C'est la **seule** source lue par les écrans et API acheteur.
- `marketplace_social_assets` — compte Instagram / LinkedIn, formats, métriques, prix calculé.
- `marketplace_needs` — besoin acheteur dérivé de `architect_workbench` / E-E-A-T, avec
  `need_primary` / `need_secondary` (`seo` | `geo` | `conversion`) : entrée de la matrice §2.7.1.
- `marketplace_matches` — couples besoin↔actif, `compat_score`, statut de notification.
- `marketplace_match_values` — cache par page et par domaine (§2.11) : `valeur_vendeur_cents`,
  `valeur_acheteur_cents`, `global_match_value_cents`, `matches_count`, `computed_at` (TTL 24 h,
  site-scoped comme Marina).
- `marketplace_page_sell_risk` — cache par page (§2.12) : `sell_risk`, composantes, classe
  (`safe` | `moderate` | `discouraged`), motif d'exclusion dure, `recomputed_at` (à chaque crawl).
- `marketplace_buyer_limits` — cache par domaine acheteur (§2.2.1) : `links_bought_30d`,
  `links_bought_7d`, `seller_counts_12m` (jsonb : liens par domaine vendeur, borne 2),
  `exact_anchor_ratio`, `target_url_counts` (jsonb), `topical_coherence_ratio`, `buy_risk`,
  `next_allowed_at`, `throttle_reason`, `recomputed_at`. Dérivé des jambes livrées, jamais des
  commandes créées. Pas de `top_seller_share` ni de `distinct_sellers_12m` : ces indicateurs sont
  redondants avec la borne de 2 liens par vendeur sur 12 mois.
  **Fenêtres glissantes, pas de mois calendaire** : `links_bought_30d` compte les jambes livrées
  sur les 30 derniers jours et `links_bought_7d` sur les 7 derniers (bornes : 4 et 2). La
  formulation « 4 par mois » de §2.2.1 se lit donc « 4 sur 30 jours glissants » — un acheteur ne
  peut pas remettre son compteur à zéro en attendant le 1er du mois.

### 4.3 Transaction

- `marketplace_orders` — commande. Identité et objet :
  `buyer_id`, `seller_id` (uuid → `auth.users`), `buyer_domain`, `seller_domain`,
  `asset_id` (→ `marketplace_link_assets` ou `marketplace_social_assets`, avec `asset_kind`),
  `need_id` (→ `marketplace_needs`), `target_url` (URL cible chez l'acheteur),
  `anchor` (ancre validée), `anchor_kind` (`brand` | `exact` | `semi` | `url` | `natural`),
  `link_attribute` (`dofollow` | `nofollow` | `sponsored`).
  Économie : `deal_type` (`cash` | `credits` | `barter`), `price_cents` (prix figé),
  `commission_cents` (15 %, contre-valeur euros figée), `commission_settlement`
  (`cash` | `credits` — cash par défaut sur commande payée, `credits` obligatoire sur troc, §2.5),
  `commission_credits` (montant débité, NULL si règlement cash), `credit_eur_rate_at_freeze` (taux
  figé au figeage quand le règlement est en crédits, base de la facture et de la TVA),
  `soulte_cents`, `soulte_currency` (`eur` | `credits`),
  `soulte_payer_id`, `soulte_payee_id`.
  Sur un troc, la commission est portée **par jambe** (`marketplace_exchanges`) : `commission_credits` de la
  commande est la somme des commissions de jambe.
  `commission_support` (`cash` | `credits`) et `buyer_payment_support` (`cash` | `credits` |
  `barter`) : le premier pilote le calcul de `escrow_cents`, le second **le support de
  remboursement** en cas de rupture (§2.5.1, jamais de cash remboursé en crédits).

  Engagement et cycle de vie : `commitment_months` (12 lien · 1 post LinkedIn ou Reel · 0 story,
  base du prorata de §2.13), `escrow_cents` (montant séquestré au figeage, §2.5.1),
  `published_at`, `commitment_ends_at` (= `published_at` + `commitment_months`, ou +24 h si 0),
  `status`, `approved_revision_id`, `risk_flags[]`, `frozen_at` (figeage), `created_at`.
  Contraintes : `price_cents + soulte_cents ≤ 35000`, multiples de 1000 (paliers de 10 €).
  Aucune valeur de jambe stockée ici (§4.1).
- `marketplace_exchanges` — **jambes** de la commande (2 pour un troc, 3 ou 4 pour une boucle
  `link_chain`, 1 pour un achat cash) : `order_id`, `exchange_id` (identifiant du troc ou de la
  boucle, partagé par toutes ses jambes), `leg_index`, `publish_after` (décorrélation : +21 j pour
  `link_for_link`, +7 j entre jambes d'une boucle), `currency_kind` (`link` | `story` |
  `linkedin`), `value_cents` (palier de 10 €, borné 40–350 €), `trade_type` (`link_chain` |
  `link_for_link` | `link_for_linkedin` | `link_for_insta` | `linkedin_for_linkedin` |
  `insta_for_insta`), `reciprocity_quarter` (quota `link_for_link` uniquement),
  `cycle_check_verdict` (les cycles déclarés portant un `exchange_id` accepté sont exemptés, cf.
  §2.2), `delivered_at`.
  Commission : `commission_payer_id` (le vendeur de la jambe), `commission_cents` (15 % de
  `value_cents`, contre-valeur euros figée) et `commission_credits` (débit en crédits — sur une
  jambe de troc le règlement en crédits est obligatoire, §2.5). Le débit est écrit au figeage,
  après contrôle du solde de chaque payeur.
- `marketplace_payouts` — mouvements wallet vendeur, commission Crawlers (support `cash` ou
  `credits` selon `commission_settlement`), référence `order_id` et `leg_id`.

### 4.4 Balance d'autorité et file d'achat

- `marketplace_balance_events` — journal auditable, une ligne par jambe livrée : `site_domain`,
  `leg_id` (FK `marketplace_exchanges`), `direction` (`incoming` | `outgoing`), `sign`,
  `occurred_at`, `reversal_of` (jambe annulée), `risk_flags[]`. Pas de `value_cents`.
- `marketplace_site_balances` — cache par site : `site_domain`, `authority_balance_cents`,
  `visibility_balance_cents`, `deficit_cents`, `can_sell_links` (bool), `recomputed_at`
  (amortissement 24 mois, recalculable à 100 % depuis `marketplace_balance_events`).
- `marketplace_link_queue` — file d'achat : `site_domain`, `need`, `budget_cents`,
  `unserved_need_cents`, `need_score`, `deficit_cede_cents`, `priority_score`, `enqueued_at`,
  `reserved_offer_id`, `reserved_until`, `status`, `recomputed_at` (cron : besoin non servi dérivé de
  `marketplace_needs` moins les jambes `link_*` entrantes servies sur 90 j).

### 4.5 Propriété, contenu, vérification

- `marketplace_ownership_verifications` — preuve de propriété par actif : `method` (`gsc` |
  `dns_txt` | `file` | `oauth_linkedin` | `oauth_meta`), `token`, `verified_at`, `last_checked_at`,
  `status` (`verified` | `unverified` | `revoked`). Unicité : un domaine vérifié par un seul compte.
- `marketplace_ownership_claims` — déclaration de responsabilité vendeur : horodatage, IP, texte accepté.
- `marketplace_gsc_access_log` — journal append-only des accès admin aux valeurs GSC exactes
  (§2.1.1) : `admin_user_id`, `asset_id`, `owner_user_id`, `fields_read[]`, `reason`, `ticket_ref`,
  `ip`, `created_at`, `expires_at`. Écrit uniquement par la server function d'accès support ;
  aucune policy `UPDATE`/`DELETE` ; visible du propriétaire de l'actif (date + motif) et des admins.
  Rétention 24 mois.
- `marketplace_content_variants` — variantes générées par le Studio (§2.9) : `order_id`, `variant`
  (`editoriale` | `utilitaire` | `action`), brief figé, sortie, modèle utilisé, coût, `selected`.
- `marketplace_link_revisions` — versions du paragraphe/brief, auteur, diff, verdicts des deux parties.
- `marketplace_feedback` — commentaires et motifs par révision ou par variante refusée.
- `marketplace_verifications` — contrôles de publication et de maintien (§2.13) : `leg_id`, `method`
  (`crawl` | `linkedin_api` | `meta_api`), `verdict`, preuve, capture, `checked_at`, `next_check_at`,
  état de la jambe (`published` | `verified` | `maintained` | `broken` | `resolved` | `refunded`).
- `marketplace_wallet_entries` — séquestre et acquisition progressive du net vendeur (§2.5.1) :
  `order_id`, `leg_id`, `seller_id`, `amount_cents` (tranche), `tranche_index`, `vest_at`,
  `state` (`held` | `available` | `cancelled` | `clawed_back`), `state_changed_at`, `reason`.
  Une ligne par tranche ; le net vendeur d'une commande est la somme des tranches, aucune valeur
  de jambe n'est recopiée (§4.1). Le solde dépensable d'un vendeur = somme des tranches
  `available` moins la dette ouverte.
- `marketplace_wallet_debts` — dette de wallet quand la récupération excède le séquestre et le
  solde (§2.5.1) : `seller_id`, `order_id` (origine), `amount_cents`, `recovered_cents`,
  `status` (`open` | `settled` | `written_off`), `opened_at`, `settled_at`.
  Une dette `open` gèle la mise en vente et l'achat, et absorbe 100 % des crédits entrants avant
  tout passage en `available`. Le solde du wallet ne peut jamais être négatif.
- `marketplace_tax_profiles` — statut fiscal du vendeur (§2.5.2) : `user_id`, `tax_status`
  (`assujetti_fr` | `assujetti_ue` | `assujetti_hors_ue` | `franchise` | `non_assujetti`),
  `vat_number`, `vies_valid_at`, `country`, `legal_name`, `siren`,
  `self_billing_mandate_accepted_at`. Sans profil complet et mandat accepté, aucune mise en vente.
- `marketplace_invoices` — pièces comptables (§2.5.2), une ligne par pièce : `order_id`, `leg_id`,
  `kind` (`leg` | `soulte` | `commission` | `credit_note`), `issuer_id`, `recipient_id`,
  `base_cents` (HT), `vat_rate` (2000 = 20 %), `vat_cents`, `total_cents`, `number` (série continue
  par mandant), `issued_at`, `exigibility_date` (= 1ʳᵉ preuve de publication, §2.13), `pdf_path`,
  `credit_note_of` (auto-référence pour les avoirs). Montants et TVA **figés** à l'émission,
  jamais recalculés à l'affichage.




---

## 5. Modifications front — Console

1. **Nouveau module « Place d’échange »** dans `ConsoleSidebar.tsx` (réordonnable et masquable
   comme les autres, persistance `user_console_preferences`).
2. Quatre onglets :
   - **Opportunités** — appariements entrants, filtrés par `compat_score`, avec « pourquoi ce match ».
   - **Je vends** — inventaire de mes pages avec prix estimé, opt-in par page, plafonds,
     revenus cumulés, message « 1 lien vendu ce mois = abonnement remboursé ».
   - **J'achète** — besoins détectés automatiquement (page cible + ancre suggérée),
     actifs proposés, panier, paiement.
   - **Commandes** — suivi de cycle de vie, prévisualisation, feedback, validations, vérifications.
3. **Composant `LinkInsertionPreview`** — diff visuel avant/après, surbrillance du paragraphe
   inséré, bascule mobile/desktop, panneau de feedback latéral, historique des révisions.
4. **Composant `CollabBriefPreview`** — maquette de post/story, légende, mention de conformité,
   même panneau de feedback.
5. **Intégrations dans l'existant** :
   - onglet Netlinking : remplacement des offres externes vides par l'inventaire interne ;
   - `architect_workbench` : bouton « Trouver un lien » sur les tâches `remediation_channel='netlinking'` ;
   - wallet : ligne « revenus place d’échange » et solde vendeur.
6. **Gating** : `useTeamPermissions().can('marketplace_manage')` pour vendre/acheter ;
   auditeur en lecture seule.
7. **Design** : violet / or / noir / blanc, boutons bordure + texte, aucun emoji, aucun bleu IA.

---

## 6. Landing page dédiée

- Route : `src/routes/marketplace-backlinks.tsx` (**satellite du pilier GEO**, pas un nouveau
  pilier), satellite secondaire `/collab-instagram`.

- `head()` propre : titre < 60 caractères, description < 160, og/twitter, JSON-LD `Service`
  + `FAQPage`, canonical via `pageHead.ts`.
- Structure : H1 unique, promesse (« vendez un lien par mois, votre abonnement est remboursé »),
  explication du pricing algorithmique (les 5 signaux), démonstration de la prévisualisation
  du paragraphe, garde-fous (anti-réciprocité, plafonds, conformité), grille de commission,
  `blockquote.citable-passage` pour la visibilité IA, CTA double (vendre / acheter).
- Contenu SSR complet, pas d'accordéon Radix pour les FAQ (`<details>` natif).
- **Rattachement : satellite du pilier GEO** (autorité et citations). L'architecture reste à
  4 piliers (crawler, GEO, outil-crawl, comparatifs) : aucun silo « netlinking » n'est créé, les
  pages Place d'échange maillent vers le pilier GEO et sont référencées depuis son hub.


---

## 7. Textes à modifier

### 7.1 Tarifs (`/tarifs`)
- Mention marketplace sur chaque plan payant : « revendez des liens depuis vos pages,
  15 % de commission Crawlers — un lien vendu par mois peut rembourser votre abonnement ».
- Précision crédits : les crédits gagnés en vendant sont utilisables sur toute la plateforme.

### 7.2 Audit stratégique
- Le bloc Marché & Autorité passe d'un constat à une **proposition concrète** :
  page cible identifiée, ancre recommandée, fourchette de prix, nombre d'actifs correspondants
  disponibles, lien vers l’onglet Place d’échange.
- Nouveau bloc **« Valeur d'appariement »** (§2.11) : face vendeur / face acheteur pour la page
  auditée, et pour un audit de domaine les trois chiffres globaux (potentiel de vente, besoin
  d'achat, solde d'appariement) plus le rappel de la balance d'autorité (§2.14).
- Les pages proposées à la vente sont filtrées par `sell_risk` (§2.12) : jamais un pilier, jamais
  une page de conversion, jamais une page en momentum.

### 7.3 Rapports Marina
- Section « Autorité » : quand le déficit est externe, afficher 2 à 3 **propositions de liens
  concrètes** (thématique, autorité, trafic de la page, prix indicatif) au lieu d'une
  recommandation générique.
- Rapport page : valeur d'appariement de la page. Rapport multipages : **valeur globale
  d'appariement** du domaine et liste des pages les moins risquées à vendre (§2.11, §2.12).
- Idem pour le déficit de notoriété sociale : proposition de collab.
- Contraintes de rendu PDF respectées (espaces normaux, badges centrés, pas d'emoji), badges
  « mesuré » / « estimé » sur chaque chiffre d'appariement.


### 7.4 Home
- Nouvelle section « Place d’échange d’autorité » : les deux faces (vendre / acheter), le pricing
  algorithmique, l'appariement automatique, la prévisualisation du paragraphe.
- Un seul CTA vers la landing marketplace ; respect strict du design system.

### 7.5 CGVU
Ajouts obligatoires :
- Statut de Crawlers : **intermédiaire technique**, pas éditeur du contenu vendu.
- Commission **15 %**, taux unique cash et troc, base de calcul, moment de prélèvement.
- Obligations du vendeur : **propriété du domaine ou du compte vérifiée par Crawlers avant toute
  mise en vente** (GSC/DNS/fichier, OAuth pour le social), maintien du lien (durée minimale
  12 mois), conformité éditoriale, mention de publicité pour le social.
- Obligations de l'acheteur : légalité de la page cible, absence de contenu prohibé.
- **Attribut du lien (§2.4)** : `rel="sponsored"` par défaut sur **toute** transaction
  (cash, crédits, troc) ; `dofollow` disponible uniquement en exception gatée (page `sell_risk`
  Sûr, palier P3 minimum, plafonds page/domaine inchangés), risque assumé et documenté par les
  deux parties ; plafond propre de 3 insertions `sponsored` vendues par page et par an ;
  aucune garantie de classement.
- Prévisualisation, feedback, 3 tours de révision, arbitrage et annulation sans frais.
- Retrait ou disparition du lien : suspension du paiement, remboursement au prorata.
- **Reversement (§2.5)** : euros via Stripe Connect par défaut (compte connecté au nom du vendeur,
  KYC bloquant avant la première mise en vente cash) ; crédits Crawlers en option du vendeur, seul
  support possible sur une jambe de troc.
- Wallet : crédits non convertibles en euros, non remboursables, durée de validité ;
  séquestre et acquisition par tranches, cascade de récupération et dette de wallet (§2.5.1).
- **Fiscalité du troc (§2.5.2)** : chaque jambe est une prestation imposable valorisée à sa propre
  valeur, TVA 20 % pour les assujettis FR, autoliquidation UE sur numéro VIES valide, franchise en
  base mentionnée ; **mandat de facturation au nom et pour le compte du vendeur** accepté à
  l'onboarding ; avoir émis en cas de remboursement au prorata ; déclaration DAC7 incluant les
  jambes en troc et les crédits ; vente réservée aux professionnels.
- Données : partage limité et consenti des signaux de page entre les parties (RGPD). L'acheteur
  reçoit uniquement des **fourchettes** et des scores normalisés ; les valeurs GSC exactes, les
  requêtes, les courbes temporelles et les agrégats de domaine ne sont jamais exposés (§2.1.1).
- **Échanges en boucle (`link_chain`, A→B→C→A) : mode d'échange sans cash privilégié** — jambes
  publiées à 7 jours d'écart minimum, boucle déclarée et traçable, aucune décote ; **consentement
  spécifique** au risque de requalification en cas de boucle rompue, plafonné au prix convenu de la
  jambe reçue, réglé en crédits en priorité (§2.7).
- **Arbitrage Crawlers (§2.16.2)** : arbitrage humain, critères de décision, SLA 5 jours ouvrés,
  une seule contestation, décision motivée communiquée aux deux parties.
- **Échanges réciproques directs (`link_for_link`) : autorisés en dernier recours et encadrés** —
  proposés seulement si aucune boucle n'est constructible, délai de 21 jours entre les deux
  publications, une seule réciprocité par trimestre et par site, jamais deux fois avec le même
  partenaire sur 12 mois, refus automatique en cas de boucle de liens **non déclarée** (la 2ᵉ jambe
  d'un troc accepté n'est jamais bloquée à ce titre). Le risque de dévaluation par les moteurs est
  porté à la connaissance des deux parties et assumé par elles.
- Interdictions fermes : fermes de liens, réseaux de sites détenus par un même bénéficiaire,
  achat d'engagement, revente d'un actif dont la propriété n'est pas vérifiée.

---

## 8. Séquencement

| Lot | Contenu |
|---|---|
| L1 | Schéma + **table de constantes versionnée (§2.15)** + **attribut `sponsored` par défaut et gating `dofollow` (§2.4)** + **onboarding Stripe Connect / KYC vendeur (§2.5)** + **règle Kbis > IP sur les grappes de comptes (§2.2)** + **validation juridique des crédits transférables (§2.16.1)** + **vérification de propriété bloquante** (GSC/DNS/fichier, OAuth social) + pricing serveur borné 40–350 € par paliers de 10 € (**P1 40 € · P2 90 € · P3 150 € · P4 250 € · P5 350 €**) + **`sell_risk` et éligibilité à la vente (§2.12)** + inventaire opt-in + **vue `marketplace_asset_public_signals` (fourchettes, §2.1.1)** + onglet « Je vends » |
| L2 | Appariement + besoins issus du workbench + onglet « Opportunités » / « J'achète » + **calcul de la valeur d'appariement page et domaine (§2.11)** |
| L3 | Commande, génération du paragraphe, prévisualisation, feedback bilatéral, wallet, commission unique 15 % (cash retenue sur le flux, crédits obligatoires sur le troc avec contrôle des soldes avant figeage et taux figé), **recherche de boucle `link_chain` prioritaire, quota `link_for_link` en dernier recours + détection de cycles non déclarés** + **arbitrage des litiges (§2.16.2)** + **test d'homogénéité stylistique du Studio avant ouverture au volume (§2.9)** |
| L4 | **Vérification de publication et de maintien (§2.13)** : crawl + API LinkedIn + API Meta, machine à états des jambes, remboursement au prorata, événements de balance inverses, reporting |
| L5 | Landing page, home, tarifs, **valeur d'appariement dans l'Audit stratégique et Marina (page + domaine)**, bloc « Ma balance » comme produit de rétention (§2.14), CGVU |
| L6 | Collab Instagram (OAuth Meta, métriques, brief, vérification) |


## 9. Risques

- **Reversement en euros** : Stripe Connect + KYC **dès la v1** — le coût est l'onboarding
  (vérification d'identité, délais Stripe) ; sans lui, l'offre se limite aux comptes abonnés.
- **Requalification en monnaie électronique** : les crédits transférables entre utilisateurs
  doivent être validés juridiquement avant tout code (§2.16.1) ; repli = soulte cash uniquement.
- **Faux positif « grappe de comptes »** : une IP partagée d'agence ne bloque plus une
  transaction dès lors que deux SIREN distincts sont vérifiés (§2.2).
- **Conformité Google** : position assumée et documentée, plus une zone grise — `sponsored` par
  défaut sur toute transaction onéreuse, `dofollow` en exception gatée et plafonnée (§2.4),
  jamais présenté comme une garantie de classement.
- **Empreinte éditoriale du Studio** : pipeline unique à volume ; audit de similarité
  inter-livrables avant L3 (§2.9).
- **Dilution de l'E-E-A-T de crawlers.fr** : plafonds stricts, jamais depuis les 4 piliers.
- **Liquidité** : le maillon rare est la demande, pas l'offre — amorcer par les besoins
  déjà détectés dans les workbenches existants.
- **Litiges de publication** : une rupture de maintien mal diagnostiquée (blocage de crawl, coquille
  JS) déclencherait un remboursement injustifié — d'où l'escalade de rendu avant tout verdict (§2.13).

