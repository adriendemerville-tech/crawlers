/**
 * Contenu SEO partagé de /geo-vs-seo : la FAQ est rendue dans la page ET
 * sérialisée en FAQPage JSON-LD par la route, sans duplication de texte.
 */
export const GEO_VS_SEO_FAQ: Array<[string, string]> = [
  [
    'Quelle est la différence entre le SEO et le GEO ?',
    'Le SEO (Search Engine Optimization) vise une position dans les résultats de Google. Le GEO (Generative Engine Optimization) vise une citation dans la réponse rédigée d’un moteur génératif comme ChatGPT, Claude ou Perplexity. Le premier se mesure en positions et en clics, le second en mentions et en part de voix dans les réponses.',
  ],
  [
    'Le GEO remplace-t-il le SEO ?',
    'Non. Les moteurs génératifs s’appuient largement sur des pages indexées et sur des résultats de recherche pour construire leurs réponses. Un site inaccessible à Googlebot est le plus souvent absent des réponses IA. Le GEO s’ajoute au SEO, il ne s’y substitue pas.',
  ],
  [
    'Faut-il deux budgets, un pour le SEO et un pour le GEO ?',
    'Rarement. La majorité des chantiers sont communs : HTML servi côté serveur, structure des titres, données structurées, fraîcheur et autorité des contenus. La seule exigence proprement GEO est éditoriale : rédiger des passages autonomes, datés et attribuables.',
  ],
  [
    'Pourquoi mon trafic baisse-t-il alors que ma marque semble plus visible ?',
    'Une partie des recherches se conclut désormais dans une réponse rédigée, sans clic vers le site. La marque peut être citée plus souvent tout en recevant moins de visites. Sans mesure des citations, ce déplacement de canal ressemble à une simple perte de trafic.',
  ],
  [
    'Quel chantier a le plus d’effet sur les deux canaux à la fois ?',
    'Servir le contenu en HTML sans dépendre du JavaScript. Googlebot sait exécuter du JavaScript, la plupart des robots de moteurs IA ne le font pas ou mal : une page dont le texte n’apparaît qu’après hydratation est une coquille vide pour eux.',
  ],
  [
    'Comment savoir si mon problème est SEO ou GEO ?',
    'Comparez les deux mesures sur le même jeu de requêtes. Positions faibles sur Google : le problème est SEO. Bonnes positions mais aucune citation dans les réponses IA : le problème est éditorial, donc GEO. Les deux se diagnostiquent dans une même passe d’audit.',
  ],
  [
    'Qu’est-ce qu’un passage citable ?',
    'Un extrait qui tient seul, sans contexte préalable : il nomme le sujet, énonce un fait et précise la source ou la date. C’est la forme qu’un modèle génératif peut reprendre sans risque d’erreur, et elle améliore aussi les extraits affichés par Google.',
  ],
];
