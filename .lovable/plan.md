# Nouvelle landing page dirigeants (TPE/PME)

Une page dédiée aux dirigeants de TPE/PME, inspirée de la structure et de l'esthétique noir & blanc de got_the_ref, sans reprise de son contenu ni de ses visuels. La Home actuelle reste inchangée et garde son intention (plateforme SEO/GEO).

URL : `/visibilite-ia-entreprise`

## Séquence en 4 temps

1. **L'urgence** — « Vos clients posent leurs questions aux IA. Êtes-vous cité ? »
   - Bandeau de requêtes réelles qui défilent (type « quelle agence web choisir à Bordeaux »), en noir & blanc.
   - Champ URL + CTA unique « Lancer mon analyse gratuite » → lead magnet visibilité LLM déjà en place.
   - Carte de démonstration : 3 requêtes, dont une où l'entreprise est citée et deux où elle ne l'est pas (mention explicite « exemple de démonstration »).

2. **Le GEO : ce qu'on fait, et combien ça coûte**
   - 3 bénéfices concrets : savoir sur quelles questions vous êtes cité, corriger les pages, remesurer.
   - Carte tarifaire sobre reprenant les prix réels : Gratuit, Pro Agency 29 €/mois, Pro Agency+ 79 €/mois, essai 14 jours sans carte, 12 mois offerts aux entreprises de moins d'un an (lien vers `/offre-jeune-entreprise`).
   - Comparaison « agence SEO vs Crawlers » sur les critères vérifiables (engagement, délai de premier livrable, corrections appliquées ou non). Aucun tarif d'agence inventé : soit une fourchette sourcée, soit formulation qualitative.

3. **Le SEO : pas de bon GEO sans bon SEO**
   - Explication courte : les IA citent ce qu'elles trouvent et comprennent ; structure, données structurées et Search Console restent la base.
   - Bloc preuve : courbe de type Search Console clairement étiquetée comme démonstration jusqu'à ce que tu fournisses des données client réelles.
   - Second lead magnet : CTA vers `/matrice-concurrence`.

4. **Preuve, objections, passage à l'action**
   - À qui ça s'adresse : commerce local, prestataire de services, e-commerce, SaaS.
   - Lever les objections : sans engagement, résiliable, pas de refonte de site nécessaire, rapport lisible sans expertise SEO.
   - FAQ en passages citables (`blockquote.citable-passage`) + JSON-LD FAQPage.
   - CTA final identique au premier.

## Design

- Noir & blanc dominant, accent violet et jaune d'or réservés aux états et micro-signaux, conformément à la charte.
- Boutons sans fond : bordure + texte, selon la règle du projet.
- Cartes à grands rayons, typographie large, une idée par écran, lecture mobile d'abord.
- CTA sticky en bas sur mobile.
- Aucun emoji, aucun bleu IA.

## Cahier des charges technique (performance mobile et référencement)

Reprise des mécanismes déjà en place sur la Home, appliqués systématiquement.

**Rendu et cache**
- Page rendue côté serveur (SSR), sans dépendance à une donnée utilisateur pour le premier écran.
- Ajout de la route à la liste des pages mises en cache HTML côté serveur (`HTML_CACHE_PATHS`), soit 15 min de fraîcheur et 6 h de service en arrière-plan. Objectif : premier octet quasi instantané en cache HIT.
- Aucun appel réseau bloquant au premier rendu ; tout appel (analyse, compteurs, analytics) part après affichage, avec délai maximal court et échec silencieux.

**LCP et premier affichage**
- Élément LCP = le titre et le champ URL, en texte, présents dans le HTML servi ; pas d'image lourde en haut de page.
- Aucun nouveau CSS global : réutilisation des classes existantes pour ne pas gonfler le CSS critique déjà inliné (~28 Ko).
- Si un visuel de haut de page est ajouté : format WebP, largeur maximale 600–960 px, dimensions déclarées, `fetchPriority="high"` et aucune image décorative avant le titre.

**JS et découpage**
- Seuls les deux premiers écrans sont dans le rendu initial. Toutes les sections suivantes en `React.lazy` + `LazyVisible` (montage à 300 px de la viewport), comme la Home.
- Aucune librairie de graphiques, carte ou 3D chargée au premier rendu ; le bloc preuve utilise un tracé léger (SVG) plutôt qu'une librairie.
- Pas de nouvelle dépendance npm.

**CLS et stabilité**
- Hauteur réservée sur chaque bloc différé (`minHeight`) et sur toute image ou graphique.
- `content-visibility` sur les sections basses, comme la Home.
- Bandeau de requêtes animé en transformation CSS uniquement, désactivé si l'utilisateur demande moins d'animations.

**INP**
- Aucun calcul lourd au clic : le CTA ne fait que valider l'URL et déclencher l'analyse existante.
- Animation du bandeau en CSS, pas en boucle JavaScript.

**Référencement**
- `head()` via `src/lib/seo/pageHead.ts` : title unique (< 60 caractères), description (< 160), canonical auto-référencé, og:title/description, og:type website. Pas d'og:image tant qu'il n'y a pas d'image absolue pertinente.
- Un seul H1, hiérarchie H2/H3 propre, une intention principale unique pour ne pas concurrencer la Home (les autres intentions restent sur leurs pages).
- JSON-LD : `WebPage`, `FAQPage`, `BreadcrumbList`.
- Bloc Direct Answer en tête (question en H3 + réponse de 2-3 phrases), passages citables pour la visibilité IA.
- Alt text sur toute image, liens internes vers `/tarifs`, `/offre-jeune-entreprise`, `/matrice-concurrence`, `/marina`.
- Ajout au sitemap (priorité 0,8) et lien entrant depuis au moins une page existante.

**Contrôles avant livraison**
- Mesure du LCP en conditions mobiles simulées (4G, CPU ×4) : cible sous 3,5 s.
- Contrôle du poids total de la page et du nombre de requêtes au premier rendu.
- Vérification visuelle mobile et desktop dans l'aperçu, console sans erreur.

## Détails techniques

- `src/pages/VisibiliteIaEntreprise.tsx` + route `src/routes/visibilite-ia-entreprise.tsx`.
- Réutilisation des composants existants : `LeadMagnetAudit`, `CompetitorMatrixCta`, `DirectAnswer`, `LazyVisible`, `Header`, `Footer`.
- Aucun chiffre client, témoignage ou résultat inventé : les blocs de démonstration sont étiquetés comme tels.
