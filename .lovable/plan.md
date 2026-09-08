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
   - Bloc preuve : capture ou courbe de Search Console clairement étiquetée comme démonstration jusqu'à ce que tu fournisses des données client réelles.
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

## Détails techniques

- `src/pages/VisibiliteIaEntreprise.tsx` + route `src/routes/visibilite-ia-entreprise.tsx`, avec `head()` via `src/lib/seo/pageHead.ts` (title, description, canonical, og).
- Réutilisation des composants existants : `LeadMagnetAudit`, `CompetitorMatrixCta`, `DirectAnswer`, `Footer`, `Header`.
- JSON-LD : `WebPage`, `FAQPage`, `BreadcrumbList` ; un bloc Direct Answer en tête.
- Sections lourdes chargées à la demande (`LazyVisible`) pour préserver le LCP mobile.
- Ajout au sitemap avec priorité 0,8.
- Aucun chiffre client, témoignage ou résultat inventé : les blocs de démonstration sont étiquetés comme tels.

## Après mise en ligne

Vérification de la page dans l'aperçu (mobile et desktop) et contrôle du poids de la page.
