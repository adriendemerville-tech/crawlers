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
- **Multi-silo** : audit technique, SEO éditorial, GEO, Google Business, netlinking et
  concurrentiel traités dans un seul outil (pas de boîte à outils éclatée).
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
- **Monétisation sur l'existant** : commission unique de 15 % sur chaque transaction (cash comme
  troc), sans coût d'acquisition supplémentaire (l'acheteur est déjà un utilisateur diagnostiqué).
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
| `link_for_link` | **autorisé, flaggé et bridé** : délai 21 j, décote d'équité, quota 1 réciprocité / trimestre / site, blocage si cycle détecté |
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

Prix indicatif = `base × Σ(poids × score normalisé)`, borné par un **plancher dur de 40 €** et un
**plafond dur de 350 €**. Aucun actif ne sort de ces bornes en v1, quelle que soit son autorité :
pas de dérogation, pas de file de validation admin. Le prix est recalculé à chaque rafraîchissement
des signaux et **figé au moment de la commande**.

**Grille de prix (détail retenu).** Le prix algorithmique choisit un **palier fixe**, il ne
l'invente pas : pas de prix continu, lisibilité acheteur/vendeur, pas de négociation au cas
par cas. Tous les paliers sont des **multiples de 10 €** (règle d'arrondi unique dans toute la
place d'échange, y compris pour les soultes et les valorisations d'actifs sociaux). Quatre
paliers calés **légèrement sous le marché** constaté (lien contextuel France, SEO/GEO) sans
casser la perception qualité :

| Palier | Prix | Profil vendeur (marché constaté) |
|---|---|---|
| P1 | **40 €** | Petit site / blog de niche (DR 20-40, faible trafic) — marché 40-80 € |
| P2 | **90 €** | Site SaaS / média spécialisé correct (DR 40-60, trafic qualifié) — marché 80-180 € |
| P3 | **150 €** | Site fort / média reconnu (DR 60+, trafic significatif) — marché 180-350 € |
| P4 | **250 €** | Premium / très forte autorité — marché 350 €+ |

Sélection du palier : le score normalisé global (`Σ(poids × score normalisé)`) mappe vers le
palier le plus proche. P1 vaut exactement le plancher, P4 reste sous le plafond : les bornes
40 € / 350 € encadrent aussi les prix ajustés par une soulte.
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
- lien déjà existant entre les deux domaines ;
- réciprocité détectée (A→B et B→A, même différée) ;
- même propriétaire / grappe de comptes liés (même IP, même CMS connecté, même Kbis) ;
- plafond de liens sortants atteint (page : 1 lien dofollow vendu ; domaine : 20/an) ;
- thématiques exclues (jeux d'argent, crypto, adulte).

Notification des deux faces au-delà d'un seuil (`compat ≥ 0.6`).

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

### 2.4 Attribut du lien

Trois modes techniquement supportés : `dofollow`, `rel="sponsored"`, choix vendeur.
Le mode retenu est stocké par annonce et affiché à l'acheteur avant paiement.
L'UI ne présente **jamais** de garantie de classement.

### 2.5 Rémunération

v1 : crédit du **wallet Crawlers** du vendeur (non convertible en euros), réutilisable sur la
plateforme — un lien vendu par mois rembourse l'abonnement. v2 : virement réel via
Stripe Connect (KYC, comptes connectés, reversement à J+30 après vérification du lien).

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

Cette clause figure aux CGVU (section 8.5).

### 2.7 Incentive : troc (barter)

Le frein principal n'est pas le prix mais l'absence de raison de vendre : un site sans excédent
d'autorité n'a pas d'intérêt monétaire à céder un lien. L'incentive retenu est donc l'**échange**,
avec la même commission Crawlers prélevée en crédits, et non un flux d'argent.

Cinq `trade_type` sont proposés **à égalité**, sans mode par défaut. Le moteur choisit celui qui
sert le mieux les besoins des deux parties (voir 2.7.1), pas celui qui plaît au produit.

| `trade_type` | Jambe A (acheteur reçoit) | Jambe B (vendeur reçoit) | Nature |
|---|---|---|---|
| `link_for_link` | lien A→B | lien B→A | même devise, réciproque direct |
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
| `link_for_link` | SEO | SEO | deux sites à besoin SEO symétrique et thématiques non concurrentes |
| `link_for_linkedin` | SEO | GEO | acheteur veut de l'autorité, vendeur veut être cité par les IA |
| `link_for_insta` | SEO | Conversion | vendeur B2C cherche du trafic et des ventes, pas du PageRank |
| `linkedin_for_linkedin` | GEO | GEO | deux marques B2B qui veulent exister dans les réponses génératives |
| `insta_for_insta` | Conversion | Conversion | échange d'audience pur, aucun gain SEO/GEO promis |

Règles :
- L'UI n'affiche **jamais** un gain SEO ou GEO pour une jambe Instagram : la valeur annoncée est
  strictement l'audience et le clic.
- `link_for_link` est **autorisé, signalé comme à risque et bridé**. Quatre garde-fous cumulés,
  tous appliqués serveur, aucun contournable depuis l'UI :
  1. **Flag de risque** visible des deux côtés avant acceptation (pattern de lien réciproque
     dévalué par Google), avec formulation explicite du risque encouru ;
  2. **Décorrélation temporelle** : délai minimum de 21 jours entre les deux jambes, jamais de
     publication simultanée, ordre de publication tiré au sort ;
  3. **Quota** : maximum **1 réciprocité directe par trimestre et par site**, dans les deux sens
     confondus, et jamais deux fois avec le même partenaire sur 12 mois glissants ;
  4. **Détection de cycle** : le graphe des liens échangés est parcouru avant validation ; toute
     boucle détectée (A→B→A, A→B→C→A, jusqu'à 4 sauts) **bloque** la proposition en 409, sans
     possibilité de forçage.
- La valeur d'une jambe LinkedIn est estimée sur les impressions et l'engagement des 10 derniers
  posts du vendeur, publication vérifiée via l'URN/URL stable du post. À défaut d'impressions
  exposées par l'API : followers × taux d'engagement observé sur les réactions publiques. La
  valeur obtenue est arrondie au palier de 10 € et bornée à 40 € – 350 € comme un lien.
- Commission Crawlers sur un troc : **15 %** de la valeur estimée de chaque côté, prélevée en
  crédits — **même taux que la vente cash**, aucune exception de devise ni de `deal_type`.
- Le troc suit le même workflow de prévisualisation (2.3) et de double feedback que la vente.
- Plafonds : maximum 2 échanges actifs par site sortant et par mois, dont **au plus 1
  `link_for_link` par trimestre** (règle 3 ci-dessus, la plus contraignante l'emporte).

#### 2.7.2 Sélection du `trade_type` et de la soulte

Le moteur ne demande pas aux parties de choisir : il propose. Séquence déterministe, sans LLM.

```
1. Besoins   : need(A), need(B) ∈ {seo, geo, conversion} (dominant + secondaire),
               dérivés de architect_workbench, du profil E-E-A-T et des actifs connectés.
2. Candidats : trade_types dont la jambe reçue par A couvre need(A)
               ET la jambe reçue par B couvre need(B)   → "besoins concordants"
3. Si candidats ≠ ∅ :
      juste échange → on retient le trade_type au meilleur couple
      (couverture_besoin × faisabilité des actifs connectés)
4. Si candidats = ∅ (besoins non concordants) :
      on retient le trade_type que le vendeur peut honorer,
      puis on équilibre par l'équité :
         value(jambe_A) et value(jambe_B) estimées dans la même unité (€)
         écart = value(jambe_A) − value(jambe_B)
         |écart| ≤ 15 %  → échange pur
         |écart| >  15 %  → soulte réglée par la partie avantagée,
                            uniquement sous deux formes :
                              a) cash : le prix en euros de la commande augmente
                                 du montant de l'écart (paliers P1–P4)
                              b) crédits : transfert de crédits Crawlers
                                 de wallet à wallet entre les deux users
5. Décote  : si trade_type = link_for_link, value de chaque jambe × facteur de décote
             réciproque avant calcul de l'écart.
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
              ou valeur du palier P1–P4 pour une jambe troquée),
              × facteur de décote réciproque si trade_type = link_for_link
   age_m(j) = mois écoulés depuis delivered_at
   w(j)     = max(0, 1 − age_m(j) / 24)          -- 0 au-delà de 24 mois

authority_balance(site)  = Σ sign(j) × value(j) × w(j)   pour j ∈ jambes link_*
visibility_balance(site) = Σ sign(j) × value(j) × w(j)   pour j ∈ jambes story / post LinkedIn
```

Les jambes cash et crédits n'entrent dans aucune des deux balances : ce sont des règlements, pas des
actifs de visibilité. Les deux balances sont indépendantes et ne se compensent jamais entre elles :
une story reçue ne comble pas un déficit d'autorité.

**Mise à jour**

- Un événement de balance est écrit **par jambe**, au passage au statut `delivered` (lien détecté
  live par le vérificateur, ou story/post constaté par le connecteur) — jamais à la commande.
- Une jambe annulée, remboursée, ou dont le lien disparaît au contrôle de vie (`link_health_queue`)
  génère un événement **inverse** de même valeur : la balance revient à son état antérieur.
- Le poids `w(j)` étant fonction du temps, les balances sont recalculées quotidiennement (cron) à
  partir du journal ; le journal reste la source de vérité, les balances sont un cache.
- Chaque vente ou achat touche **deux sites** : le site sortant (−) et le site cible du lien (+).

**File de passage à l'achat de liens (priorité au déficit)**

```
deficit(site)  = max(0, − authority_balance(site))            en centimes €
priority_score = deficit × ancienneté_en_file^0.5              (anti-famine)
```

1. À besoin équivalent et à budget équivalent, l'inventaire disponible est proposé d'abord aux
   sites au `priority_score` le plus élevé ; à `deficit = 0`, l'ordre est chronologique (FIFO).
2. Une jambe d'inventaire peut être **réservée** un temps borné (48 h) au site prioritaire avant
   d'être ouverte au reste de la file.
3. **Éligibilité vendeur** : sous un seuil de déficit, un site ne peut plus vendre de jambe `link_*`
   tant qu'il n'a pas reçu au moins un lien — protection anti-épuisement, pas une sanction.
4. **Alerte transparente** : un vendeur qui accepte `link_for_insta` voit affiché « vous cédez de
   l'autorité contre de la visibilité — vous serez prioritaire sur les prochains achats de lien ».
5. **Aucune dette Crawlers** : la priorité est un droit de passage dans la file, jamais un crédit
   offert. Le site prioritaire paie toujours son lien (euros, crédits ou troc).

**Ajouts DB**

- `marketplace_balance_events` — journal auditable, une ligne par jambe : `site_domain`, `order_id`,
  `leg` (`incoming` | `outgoing`), `currency_kind` (`link` | `story` | `linkedin`), `sign`,
  `value_cents`, `delivered_at`, `reversal_of` (jambe annulée), `risk_flags[]`.
- `marketplace_site_balances` — cache par site : `site_domain`, `authority_balance_cents`,
  `visibility_balance_cents`, `deficit_cents`, `can_sell_links` (bool), `recomputed_at`.
- `marketplace_link_queue` — file d'achat : `site_domain`, `need`, `budget_cents`, `priority_score`,
  `enqueued_at`, `reserved_offer_id`, `reserved_until`, `status`.


### 2.8 Autres contreparties pour équilibrer un lien

Deux règles : la contrepartie ne doit **jamais** être un lien retour vers le site acheteur, et elle
doit toujours être fournie par l'un des deux users — jamais par Crawlers.

| Contrepartie | Valeur pour l'acheteur | Vérifiable par Crawlers |
|---|---|---|
| Euros (hausse du prix de la commande) | règlement direct de l'écart, paliers P1–P4 | oui, natif |
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
| Empreinte / risque de pattern | Élevé (attribution uniforme) | Moyen (articles sponsorisés massifs) | Élevé (réciprocité directe) | `link_for_link` flaggé, décorrélation 21 j, décote d'équité |
| Appariement au besoin réel | Non | Filtres manuels (DR, trafic, thème) | Non | Matrice besoin ↔ devise (SEO / GEO / conversion) des deux parties |
| Équité de l'échange | Non calculée | Prix éditeur | Négociée à l'œil | Score d'équité, soulte en euros ou crédits (jamais financée par Crawlers) |
| Mémoire long terme | Non | Non | Non | Balance d'autorité par site amortie 24 mois + file de priorité |
| Production du contenu | IA générique, non validée | À la charge de l'acheteur ou option payante | Manuelle | Studio 3 versions (éditoriale / citable / action), veto vendeur, arbitrage acheteur |
| Ancrage GEO | Marginal | Revendiqué (citations IA) sans mesure | Non | Passage citable mesuré, Score GEO et rapports Marina |
| Vérification de la livraison | Interne opaque | Contrôle plateforme | Aucune | `link_health_queue`, événements inverses si retrait |

**Positionnement retenu.** Ni un réseau de liens en abonnement (empreinte), ni une régie
d'articles sponsorisés (cash uniquement) : une place d'échange instrumentée, où chaque
transaction est arbitrée par les besoins mesurés des deux sites et où l'autorité cédée est
comptabilisée. Les arguments différenciants à reprendre en landing : mesure du besoin,
troc multi-devises, balance d'autorité, studio de contenu, vérification post-publication.

**À éviter dans la communication** : promettre un volume de liens, afficher un « DR garanti »,
ou laisser croire qu'une jambe Instagram apporte du SEO ou du GEO.

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
prix_collab = base_format × f(reach_moyen) × g(engagement_réel)
            × h(affinité_thématique_audience ↔ acheteur) × k(qualité_créative)
```

Anti-fraude : détection de reach acheté (engagement/followers hors bornes), variations de
followers en escalier, audience géographique incohérente avec la cible.

Prévisualisation : même mécanique bilatérale que le backlink, appliquée au **brief créatif**
(accroche, légende, mention obligatoire, lien bio/sticker), avec 3 tours de feedback maximum.

Vérification post-publication : `media_id` récupéré via API, contrôle de la mention de
conformité, capture visuelle archivée, insights à J+7 pour le reporting acheteur.

---

## 4. Modèle de données (esquisse)

Tables `public.*`, RLS par `auth.uid()`, GRANT explicite (`authenticated`, `service_role`) :

- `marketplace_link_assets` — page vendeur, opt-in, signaux, prix calculé, plafonds.
- `marketplace_social_assets` — compte Instagram, formats, métriques, prix calculé.
- `marketplace_needs` — besoin acheteur dérivé de `architect_workbench` / E-E-A-T.
- `marketplace_matches` — couples besoin↔actif, `compat_score`, statut de notification.
- `marketplace_orders` — commande, prix figé, commission, statut, `approved_revision_id`, `deal_type` (`cash` | `credits` | `barter`), et si `barter` : `trade_type` (`link_for_link` | `link_for_linkedin` | `link_for_insta` | `linkedin_for_linkedin` | `insta_for_insta`), `soulte_cents`, `soulte_currency` (`eur` | `credits` uniquement), `soulte_payer_id`, `soulte_payee_id`, `risk_flags[]`.
- `marketplace_needs` porte `need_primary` / `need_secondary` (`seo` | `geo` | `conversion`) : entrée de la matrice 2.7.1 pour les deux parties.

- `marketplace_exchanges` — jambes d'un troc (2 jambes : le lien + la contrepartie), nature de la contrepartie, valeur estimée par jambe (arrondie au palier de 10 €, bornée 40–350 €), solde en crédits, commission 15 %, `reciprocity_quarter` (clé de quota `link_for_link`), `cycle_check_verdict`.
- `marketplace_ownership_verifications` — preuve de propriété par actif : `method` (`gsc` | `dns_txt` | `file` | `oauth_linkedin` | `oauth_meta`), `token`, `verified_at`, `last_checked_at`, `status` (`verified` | `unverified` | `revoked`). Unicité : un domaine vérifié par un seul compte.

- `marketplace_ownership_claims` — déclaration de responsabilité vendeur : horodatage, IP, texte accepté.
- `marketplace_link_revisions` — versions du paragraphe/brief, auteur, diff, verdicts des deux parties.
- `marketplace_feedback` — commentaires et motifs par révision.
- `marketplace_verifications` — contrôles récurrents (verdict lien, publication social).
- `marketplace_payouts` — mouvements wallet vendeur, commission Crawlers.


Écritures de prix, de commission et de statut : **server functions uniquement**
(`src/lib/marketplace/*.functions.ts`), jamais depuis le client.

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

- Route : `src/routes/marketplace-backlinks.tsx` (pilier), satellite `/collab-instagram`.
- `head()` propre : titre < 60 caractères, description < 160, og/twitter, JSON-LD `Service`
  + `FAQPage`, canonical via `pageHead.ts`.
- Structure : H1 unique, promesse (« vendez un lien par mois, votre abonnement est remboursé »),
  explication du pricing algorithmique (les 5 signaux), démonstration de la prévisualisation
  du paragraphe, garde-fous (anti-réciprocité, plafonds, conformité), grille de commission,
  `blockquote.citable-passage` pour la visibilité IA, CTA double (vendre / acheter).
- Contenu SSR complet, pas d'accordéon Radix pour les FAQ (`<details>` natif).
- Rattachement au silo netlinking/autorité, pas de nouveau pilier.

---

## 7. Plan gratuit « Jeune entreprise »

- Éligibilité : entreprise de **moins de 12 mois** (Kbis à l'appui), sur candidature,
  **30 comptes maximum**.
- Accès **complet à toute la plateforme** pendant 12 mois, avec **plafond dur de 60 crédits/mois**,
  non cumulables, reset au 1er du mois, blocage strict au dépassement.
- Actions chères bornées : Marina prospection (30 crédits) limitée à 1/mois.
- Crons dégradés (surveillance hebdomadaire au lieu de quotidienne).
- Routage LLM économique (Gemini Flash / Groq) sur les tâches non critiques de ces comptes.
- Support communautaire uniquement, mentionné explicitement dans les conditions.
- Technique : flag `startup_offer` + `startup_offer_expires_at` sur le profil, quota dédié dans
  le moteur de crédits, séquence de conversion automatique à M10.
- Économie : ~1,75 €/compte/mois, soit ~780 €/an pour 30 comptes ; largement couvert par les
  packs de crédits en dépassement et la commission marketplace.

---

## 8. Textes à modifier

### 8.1 Tarifs (`/tarifs`)
- Nouveau bloc « Jeune entreprise — 12 mois offerts » (60 crédits/mois, sur candidature,
  30 places), positionné avant Pro Agency.
- Mention marketplace sur chaque plan payant : « revendez des liens depuis vos pages,
  15 % de commission Crawlers — un lien vendu par mois peut rembourser votre abonnement ».
- Précision crédits : les crédits gagnés en vendant sont utilisables sur toute la plateforme.

### 8.2 Audit stratégique
- Le bloc Marché & Autorité passe d'un constat à une **proposition concrète** :
  page cible identifiée, ancre recommandée, fourchette de prix, nombre d'actifs correspondants
  disponibles, lien vers l’onglet Place d’échange.

### 8.3 Rapports Marina
- Section « Autorité » : quand le déficit est externe, afficher 2 à 3 **propositions de liens
  concrètes** (thématique, autorité, trafic de la page, prix indicatif) au lieu d'une
  recommandation générique.
- Idem pour le déficit de notoriété sociale : proposition de collab.
- Contraintes de rendu PDF respectées (espaces normaux, badges centrés, pas d'emoji).

### 8.4 Home
- Nouvelle section « Place d’échange d’autorité » : les deux faces (vendre / acheter), le pricing
  algorithmique, l'appariement automatique, la prévisualisation du paragraphe.
- Un seul CTA vers la landing marketplace ; respect strict du design system.

### 8.5 CGVU
Ajouts obligatoires :
- Statut de Crawlers : **intermédiaire technique**, pas éditeur du contenu vendu.
- Commission 25 %, base de calcul, moment de prélèvement.
- Obligations du vendeur : propriété du domaine/compte vérifiée, maintien du lien
  (durée minimale 12 mois), conformité éditoriale, mention de publicité pour le social.
- Obligations de l'acheteur : légalité de la page cible, absence de contenu prohibé.
- Attribut du lien : information de l'acheteur, absence de garantie de classement.
- Prévisualisation, feedback, 3 tours de révision, arbitrage et annulation sans frais.
- Retrait ou disparition du lien : suspension du paiement, remboursement au prorata.
- Wallet : crédits non convertibles en euros en v1, non remboursables, durée de validité.
- Données : partage limité et consenti des signaux de page entre les parties (RGPD).
- Interdictions : échanges réciproques, fermes de liens, achat d'engagement.
- Plan Jeune entreprise : conditions d'éligibilité, plafond de crédits, support communautaire,
  fin automatique à 12 mois.

---

## 9. Séquencement

| Lot | Contenu |
|---|---|
| L1 | Schéma + pricing serveur + inventaire opt-in + onglet « Je vends » |
| L2 | Appariement + besoins issus du workbench + onglet « Opportunités » / « J'achète » |
| L3 | Commande, génération du paragraphe, prévisualisation, feedback bilatéral, wallet |
| L4 | Vérification récurrente des liens + reporting |
| L5 | Landing page, home, tarifs, audits, Marina, CGVU |
| L6 | Plan Jeune entreprise (quota, flags, crons dégradés, routage LLM) |
| L7 | Collab Instagram (OAuth Meta, métriques, brief, vérification) |

## 10. Risques

- **Reversement en euros** : Stripe Connect + KYC, hors v1.
- **Conformité Google** : zone grise du lien payé ; position assumée et jamais présentée
  comme une garantie.
- **Dilution de l'E-E-A-T de crawlers.fr** : plafonds stricts, jamais depuis les 4 piliers.
- **Liquidité** : le maillon rare est la demande, pas l'offre — amorcer par les besoins
  déjà détectés dans les workbenches existants.
- **Support** : les comptes gratuits génèrent plus de sollicitations que les payants.
