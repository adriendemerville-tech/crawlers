/**
 * FAQ visible de /blog/crawler-definition-seo-geo.
 * Le même texte alimente le JSON-LD FAQPage (les réponses doivent correspondre
 * au HTML). Aucun chiffre : uniquement la définition et la traduction.
 */
export const CRAWLER_DEFINITION_FAQS: { q: string; a: string }[] = [
  {
    q: 'Que veut dire crawler ?',
    a: "Crawler veut dire robot d'indexation. C'est un programme automatisé qui parcourt les pages d'un site en suivant les liens, pour en collecter le contenu au service d'un moteur de recherche ou d'un modèle d'IA.",
  },
  {
    q: 'Quelle est la traduction de crawler en français ?',
    a: "La traduction usuelle de crawler est « robot d'indexation ». On dit aussi « araignée du web » (de l'anglais web spider). Le verbe to crawl signifie « ramper, avancer pas à pas » : le robot passe d'une page à la suivante en suivant les liens.",
  },
  {
    q: "Quelle est la définition d'un crawler ?",
    a: "Un crawler est un robot d'indexation : il découvre des URL, télécharge leur contenu et le transmet à un index. L'indexation est l'étape suivante. Une page peut donc être crawlée sans être indexée.",
  },
  {
    q: 'Crawler, crawl et crawling : quelle différence ?',
    a: "Le crawler est le robot. Le crawl, ou crawling, est l'action de parcourir le site. L'indexation enregistre ensuite le contenu collecté pour qu'il puisse apparaître dans un résultat ou une réponse.",
  },
  {
    q: "Un crawler et un bot, c'est la même chose ?",
    a: "Tous les crawlers sont des bots, mais tous les bots ne sont pas des crawlers. Un crawler découvre et parcourt des pages. Un bot peut se limiter à vérifier un lien, à extraire une donnée (scraper) ou à dialoguer.",
  },
  {
    q: 'Faut-il bloquer les crawlers IA comme GPTBot ?',
    a: "Cela dépend de la stratégie. Bloquer GPTBot limite l'usage des pages pour les collectes d'OpenAI, et retire aussi ces pages des passages qui peuvent alimenter une citation. Le choix se fait dans le robots.txt, crawler par crawler.",
  },
  {
    q: 'Comment savoir quels crawlers visitent un site ?',
    a: "Trois lectures complémentaires : les journaux du serveur, une analyse de logs, et un contrôle de la politique robots (quels bots sont autorisés à lire le HTML). Une visite dans les logs et une autorisation dans le robots.txt ne disent pas la même chose.",
  },
];
