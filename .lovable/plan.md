# Nouvelle landing page dirigeants (TPE/PME)

Une page dédiée aux dirigeants de TPE/PME, inspirée de la structure et de l'esthétique noir & blanc de got_the_ref, sans reprise de son contenu ni de ses visuels. La Home actuelle reste inchangée et garde son intention (plateforme SEO/GEO).

URL proposée : `/etre-cite-par-les-ia` — intention « mon entreprise est-elle citée quand un client interroge une IA », distincte des pages existantes.

## Ce qui est perfectible dans l'approche — à trancher avant d'écrire

1. **Chevauchement avec des pages existantes.** Il existe déjà `/generative-engine-optimization` (guide GEO), `/marina` (audit), `/visibilite-llm`, `/audit-geo`, `/score-geo`. Une page « visibilité IA » de plus se cannibaliserait. La page ne se justifie que si elle prend un angle différent : le dirigeant qui veut des clients, pas le praticien qui veut une méthode. Le vocabulaire doit donc être commercial, jamais méthodologique, et les pages existantes doivent pointer vers elle plutôt que traiter le même sujet.
2. **La porte d'entrée à l'acte.** Leur carte annonce « 49 € pour une passe complète, ou 79 € par mois pour le suivi continu », et affiche « coût minimal : 49 € une fois ». Autrement dit, l'abonnement n'est pas obligatoire pour commencer. Notre grille, elle, est uniquement par abonnement, ce qui est un frein pour une TPE sans culture SEO. Équivalent possible chez nous, avec les briques déjà en place : un achat unique « audit complet + une passe de corrections appliquées et revérifiées », l'abonnement servant ensuite au suivi dans le temps. Décision à trancher : on crée cette offre à l'acte, ou on assume l'abonnement seul en mettant en avant l'essai 14 jours sans carte et les 12 mois offerts aux jeunes entreprises.
3. **La preuve est notre vrai point faible.** Sans clients, des courbes « de démonstration » se retournent contre nous. Bien plus solide : un vrai rapport Marina réalisé sur un site public, anonymisé, avec ses chiffres réels. Une preuve véritable vaut mieux que trois graphiques illustratifs.
4. **La comparaison à l'agence SEO doit être sourcée.** Pas de tarif d'agence inventé : soit une fourchette avec source citée, soit une comparaison qualitative (engagement, délai, corrections appliquées ou non).
5. **Une landing page ne crée pas son trafic.** Elle n'a de valeur que comme destination de la prospection (LinkedIn, groupes Facebook, e-mails) et comme cible de liens depuis nos pages existantes. À prévoir dans le même mouvement.

## Séquence en 4 temps

1. **L'urgence** — « Vos clients posent leurs questions aux IA. Êtes-vous cité ? »
   - Bandeau de requêtes qui défilent, en noir & blanc.
   - Champ URL + CTA unique « Lancer mon analyse gratuite » → lead magnet visibilité LLM existant.
   - Carte montrant, question par question, où l'entreprise est citée et où elle ne l'est pas.

2. **Le GEO : ce qu'on fait, et combien ça coûte**
   - 3 bénéfices concrets : savoir sur quelles questions vous êtes cité, corriger les pages, remesurer.
   - Prix réels : Gratuit, Pro Agency 29 €/mois, Pro Agency+ 79 €/mois, essai 14 jours sans carte, 12 mois offerts aux entreprises de moins d'un an (lien vers `/offre-jeune-entreprise`). Ajout d'une offre ponctuelle si tu la valides au point 2 ci-dessus.
   - Comparaison agence SEO vs Crawlers, sur critères vérifiables et sourcés.

3. **Le SEO : pas de bon GEO sans bon SEO**
   - Les IA citent ce qu'elles trouvent et comprennent ; structure, données structurées et Search Console restent la base.
   - Bloc preuve : extrait d'un vrai rapport Marina anonymisé.
   - Second lead magnet : CTA vers `/matrice-concurrence`.

4. **Preuve, objections, passage à l'action**
   - À qui ça s'adresse : commerce local, prestataire de services, e-commerce, SaaS.
   - Objections : sans engagement, résiliable, pas de refonte de site, rapport lisible sans expertise SEO.
   - FAQ en passages citables + JSON-LD FAQPage.
   - CTA final identique au premier.

## Design

- Noir & blanc dominant, violet et jaune d'or réservés aux états et micro-signaux.
- Boutons sans fond : bordure + texte.
- Cartes à grands rayons, typographie large, une idée par écran, mobile d'abord.
- CTA sticky en bas sur mobile.
- Aucun emoji, aucun bleu IA.

## Cahier des charges technique (performance mobile et référencement)

Reprise des mécanismes déjà en place sur la Home.

**Rendu et cache**
- Rendu serveur, sans donnée utilisateur nécessaire au premier écran.
- Ajout de la route au cache HTML serveur (`HTML_CACHE_PATHS`) : 15 min de fraîcheur, 6 h de service en arrière-plan.
- Aucun appel réseau bloquant au premier rendu ; tout appel part après affichage, délai court, échec silencieux.

**LCP et premier affichage**
- Élément LCP = titre + champ URL, en texte, dans le HTML servi. Pas d'image lourde en haut de page.
- Aucun nouveau CSS global, pour ne pas gonfler le CSS critique inliné (~28 Ko).
- Toute image éventuelle : WebP, largeur 600–960 px, dimensions déclarées, `fetchPriority="high"` uniquement sur l'élément principal.

**JS et découpage**
- Seuls les deux premiers écrans dans le rendu initial ; toutes les sections suivantes en `React.lazy` + `LazyVisible` (montage à 300 px de la viewport).
- Aucune librairie de graphiques, carte ou 3D au premier rendu ; le bloc preuve en SVG léger.
- Aucune nouvelle dépendance npm.

**CLS et stabilité**
- Hauteur réservée sur chaque bloc différé et chaque visuel.
- `content-visibility` sur les sections basses.
- Bandeau animé en transformation CSS, désactivé si l'utilisateur demande moins d'animations.

**INP**
- Aucun calcul lourd au clic ; le CTA valide l'URL et déclenche l'analyse existante.
- Animation en CSS, pas en boucle JavaScript.

**Référencement**
- `head()` via `src/lib/seo/pageHead.ts` : title unique (< 60 caractères), description (< 160), canonical auto-référencé, og:title/description, og:type website. Pas d'og:image sans image absolue pertinente.
- Un seul H1, hiérarchie propre, une intention principale unique.
- JSON-LD : `WebPage`, `FAQPage`, `BreadcrumbList`.
- Bloc Direct Answer en tête + passages citables.
- Alt text partout, liens internes vers `/tarifs`, `/offre-jeune-entreprise`, `/matrice-concurrence`, `/marina`.
- Ajout au sitemap (priorité 0,8) et liens entrants depuis les pages GEO existantes.

**Contrôles avant livraison**
- LCP mesuré en conditions mobiles simulées (4G, CPU ×4) : cible sous 3,5 s.
- Poids total et nombre de requêtes au premier rendu.
- Vérification mobile et desktop dans l'aperçu, console sans erreur.

## Détails techniques

- `src/pages/EtreCiteParLesIa.tsx` + route `src/routes/etre-cite-par-les-ia.tsx`.
- Réutilisation de `LeadMagnetAudit`, `CompetitorMatrixCta`, `DirectAnswer`, `LazyVisible`, `Header`, `Footer`.
- Aucun chiffre client, témoignage ou résultat inventé.
