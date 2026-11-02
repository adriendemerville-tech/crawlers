/**
 * Guides métier servis par /guide/$slug quand la base n'a pas encore la page.
 * Source unique pour le site (SSR), le pré-rendu render-page et le sitemap.
 *
 * Pas de chiffre inventé, pas de nombre de critères, pas de limite de plan
 * ni de condition d'essai : ces points sont harmonisés ailleurs.
 */

export interface ProfessionFaq {
  question: string;
  answer: string;
}

export interface ProfessionLink {
  slug: string;
  title: string;
  description: string;
}

export interface ProfessionExternalLink {
  label: string;
  href: string;
  source: string;
}

export interface ProfessionGuideSource {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  targetKeyword: string;
  category: "bloc_a" | "bloc_b";
  subtitle: string;
  publishedAt: string;
  content: string;
  faqs: ProfessionFaq[];
  lateralLinks: ProfessionLink[];
  externalLinks: ProfessionExternalLink[];
}

const PUBLISHED_AT = "2026-11-02T00:00:00.000Z";

const GOOGLE_HELPFUL = {
  label: "Créer un contenu utile, fiable et people-first",
  href: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
  source: "Google Search Central",
};

const GOOGLE_JS = {
  label: "Comprendre les bases du JavaScript pour la recherche",
  href: "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
  source: "Google Search Central",
};

const SCHEMA_INTRO = {
  label: "Introduction aux données structurées",
  href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
  source: "Google Search Central",
};

export const PROFESSION_GUIDES: ProfessionGuideSource[] = [
  {
    slug: "artisan-seo",
    title: "SEO et GEO pour les artisans",
    metaTitle: "SEO artisan : Google et assistants IA | Crawlers.fr",
    metaDescription:
      "Guide pratique pour un site d'artisan : pages de service, zone d'intervention, fiche établissement et visibilité dans les réponses des assistants IA.",
    targetKeyword: "seo artisan",
    category: "bloc_a",
    subtitle:
      "Ce qu'un site d'artisan doit rendre lisible pour Google et pour les assistants IA : l'offre, la zone, les preuves, sans jargon technique.",
    publishedAt: PUBLISHED_AT,
    externalLinks: [
      GOOGLE_HELPFUL,
      {
        label: "LocalBusiness",
        href: "https://schema.org/LocalBusiness",
        source: "Schema.org",
      },
      GOOGLE_JS,
    ],
    lateralLinks: [
      {
        slug: "ecommerce-seo",
        title: "SEO e-commerce",
        description: "Fiches produit, catégories et citations dans les guides d'achat.",
      },
      {
        slug: "agence-seo",
        title: "SEO pour agences",
        description: "Méthode de mesure et de restitution pour plusieurs sites clients.",
      },
      {
        slug: "saas-seo",
        title: "SEO SaaS",
        description: "Pages d'intention, documentation et visibilité d'un logiciel.",
      },
    ],
    faqs: [
      {
        question: "Un artisan a-t-il besoin d'un site en plus de sa fiche établissement ?",
        answer:
          "La fiche établissement porte la présence locale. Le site porte les pages de service, la zone d'intervention et les preuves que ni la fiche ni un annuaire ne détaillent. Les deux doivent dire la même chose : nom, métier, ville, téléphone.",
      },
      {
        question: "Que faut-il écrire sur une page de prestation ?",
        answer:
          "Le métier, le type de chantier ou d'intervention, la zone couverte, ce qui est inclus, ce qui ne l'est pas, et comment demander un devis. Une page qui ne répète que le nom de l'entreprise ne répond à aucune question.",
      },
      {
        question: "Pourquoi un assistant IA ne cite-t-il pas un site d'artisan ?",
        answer:
          "Souvent parce que le texte n'est pas dans le HTML servi : il n'apparaît qu'après l'exécution du JavaScript, ou il est trop vague pour être repris. Un passage qui dit qui intervient, où, et pour quel type de travail peut être cité. Une formule publicitaire ne l'est pas.",
      },
      {
        question: "Faut-il une page par ville ?",
        answer:
          "Seulement si la page décrit une réalité différente : équipe, délais, types de chantiers, contraintes locales. Copier la même page en changeant le nom de la ville produit des doublons, pas de la visibilité.",
      },
      {
        question: "Par où commencer si le site existe déjà ?",
        answer:
          "Lire le HTML de la page d'accueil et d'une page de service, comparer avec la fiche établissement, puis lancer un audit gratuit pour voir ce qui est réellement accessible. Les tarifs de la plateforme sont sur la page Tarifs, sans que ce guide ne décrive les limites des offres.",
      },
    ],
    content: `## Ce que le HTML doit déjà dire

Un visiteur, Google et un assistant IA lisent d'abord le HTML servi, pas la plaquette que vous avez en tête. Sur la page d'accueil, on doit pouvoir répondre sans cliquer : quel métier, quelle zone, quel type d'intervention, comment vous joindre.

> Un site d'artisan est lisible quand le HTML de la page d'accueil nomme le métier, la zone d'intervention et le moyen de contact, sans dépendre d'un menu ou d'une animation.

Vérifiez en affichant la source, ou avec un [audit gratuit](/audit-expert) qui lit la page telle qu'elle est servie. Si le texte principal n'existe qu'une fois le JavaScript exécuté, une partie des robots et des assistants repart avec une page vide. Google documente ce point dans ses [bases sur le JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

### À contrôler en premier

- Le titre de la page et le H1 disent le métier et le lieu, pas seulement le nom commercial.
- L'adresse, le téléphone et les horaires sont dans le HTML, identiques à la fiche établissement.
- Le premier écran n'est pas une image sans texte alternatif qui décrit l'activité.

## Pages de service et zone d'intervention

Une seule page « Nos services » qui liste dix métiers en une phrase ne permet pas de répondre à « plombier pour une fuite à tel endroit » ou « couvreur pour un toit en ardoise ». Créez une page par prestation réelle, avec le vocabulaire que les clients utilisent.

Chaque page précise le périmètre : type de bâtiment, urgence ou rendez-vous, matériaux, ce que vous ne faites pas. La zone d'intervention est écrite en toutes lettres (communes, rayon, départements), pas seulement sur une carte.

> Une page de prestation utile nomme le travail, la zone et la limite de l'offre. Changer uniquement le nom de la ville sur un texte identique ne crée pas une nouvelle page.

Reliez ces pages depuis l'accueil et depuis le pied de page. Une page sans lien interne est une page que les robots découvrent mal.

## Fiche établissement et cohérence

La fiche Google Business et le site ne doivent pas se contredire. Nom, catégorie, téléphone, adresse et zone sont les mêmes. Une catégorie trop large (« entrepreneur ») est moins claire qu'un métier précis.

Sur le site, une page de contact reprend ces informations en texte, pas seulement dans une image. Le type [LocalBusiness](https://schema.org/LocalBusiness) peut les structurer, à condition que le JSON-LD répète ce qui est déjà visible. Des données structurées qui contredisent la page ne servent personne.

Les avis se répondent sur la fiche. Le site peut montrer des réalisations, pas recopier des avis inventés. Une photo de chantier avec une légende (lieu, type de travail, année) vaut mieux qu'un stock d'étoiles sans contexte.

## Preuves qu'on peut vérifier

Les assistants IA et les visiteurs se méfient des phrases du type « leader sur le secteur ». Ils peuvent reprendre un fait autonome : un type d'ouvrage, une contrainte technique expliquée, une étape de chantier.

Montrez des réalisations classées par prestation, pas un mur de photos sans légende. Expliquez une méthode en trois ou quatre étapes que vous appliquez vraiment (visite, devis, travaux, réception). N'inventez pas de volume d'activité, de note moyenne ni de délai garanti si vous ne pouvez pas le tenir.

Le maillage interne relie la réalisation à la page de prestation correspondante. C'est ce lien qui dit à un robot de quoi parle la photo.

## Visibilité dans les réponses des assistants

ChatGPT, Claude, Perplexity ou Gemini ne « classent » pas un artisan comme une fiche locale. Ils citent un passage quand il répond seul à une question : qui intervient, où, pour quel problème, avec quelle limite.

Relisez vos pages en cherchant une phrase que l'on pourrait citer sans le reste du site. Si aucune ne tient debout, la page est une brochure, pas une source. Le guide [contenu utile](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) de Google va dans le même sens pour la recherche classique : décrire l'expérience réelle, pas accumuler des mots-clés.

Évitez de bloquer les robots des assistants dans le robots.txt si vous souhaitez être lu. Une page en noindex ne sera pas une source. Ce réglage se vérifie dans le HTML et le fichier robots, pas dans un slogan du pied de page.

## Ordre de vérification

Inutile de tout refaire. Tenez cet ordre :

1. HTML de l'accueil et d'une page de service : métier, zone, contact présents sans JavaScript.
2. Cohérence avec la fiche établissement.
3. Une page par prestation réelle, reliée depuis l'accueil.
4. Réalisations légendées, reliées à la bonne prestation.
5. Un passage autonome par page importante, que l'on peut citer tel quel.

Ensuite, lancez un [audit gratuit](/audit-expert) pour voir l'écart entre ce que vous croyez publié et ce qui est servi. Les offres de la plateforme sont décrites sur la page [Tarifs](/tarifs). Les autres métiers ont leur propre guide : [e-commerce](/guide/ecommerce-seo), [agences](/guide/agence-seo), [SaaS](/guide/saas-seo), et l'ensemble est listé sur [Guides](/guides).
`,
  },
  {
    slug: "ecommerce-seo",
    title: "SEO et GEO pour une boutique en ligne",
    metaTitle: "SEO e-commerce : fiches, données, IA | Crawlers.fr",
    metaDescription:
      "Guide e-commerce : fiches produit lisibles, catégories, données structurées et visibilité dans les réponses des assistants IA.",
    targetKeyword: "seo e-commerce",
    category: "bloc_a",
    subtitle:
      "Comment rendre une boutique lisible par Google et par les assistants IA : fiches, catégories, variantes et pages qui peuvent être citées.",
    publishedAt: PUBLISHED_AT,
    externalLinks: [
      GOOGLE_JS,
      SCHEMA_INTRO,
      {
        label: "Product",
        href: "https://schema.org/Product",
        source: "Schema.org",
      },
    ],
    lateralLinks: [
      {
        slug: "artisan-seo",
        title: "SEO artisan",
        description: "Présence locale, pages de service et fiche établissement.",
      },
      {
        slug: "saas-seo",
        title: "SEO SaaS",
        description: "Pages d'intention et documentation d'un logiciel.",
      },
      {
        slug: "agence-seo",
        title: "SEO pour agences",
        description: "Mesurer plusieurs boutiques sans mélanger les constats.",
      },
    ],
    faqs: [
      {
        question: "Pourquoi une fiche produit peut-elle être invisible alors que la page s'affiche ?",
        answer:
          "Si le nom, le prix et la description n'arrivent qu'après le JavaScript, une partie des robots lit une coquille vide. Le test utile est de regarder le HTML servi, pas seulement l'écran une fois la page chargée.",
      },
      {
        question: "Faut-il une page par variante ?",
        answer:
          "Une variante qui change l'usage (taille, couleur, capacité) peut avoir sa propre URL si le contenu décrit cette différence. Une URL qui ne change qu'un paramètre de tri ou de filtre, avec le même texte, se canonise vers la page principale.",
      },
      {
        question: "Les données structurées Product suffisent-elles ?",
        answer:
          "Elles décrivent ce qui est déjà visible : nom, image, marque, offre. Elles ne remplacent pas un texte. Si le JSON-LD contredit le prix ou la disponibilité affichés, il faut corriger la source, pas empiler un second balisage.",
      },
      {
        question: "Comment une boutique apparaît-elle dans une réponse d'assistant IA ?",
        answer:
          "Quand une page répond à une question d'achat : pour qui est le produit, en quoi il diffère, quelles limites d'usage. Un catalogue qui ne contient que des intitulés et des prix donne peu de matière à citer.",
      },
      {
        question: "Par quoi remplacer un texte dupliqué fournisseur ?",
        answer:
          "Par ce que le fournisseur ne dit pas : le conseil d'usage, la compatibilité, le contexte de livraison, la différence entre deux références de votre catalogue. Le texte copié tel quel sur dix sites n'est pas une source.",
      },
    ],
    content: `## Fiches produit lisibles sans attendre le JavaScript

Le nom, le prix, la disponibilité et le texte de la fiche doivent être dans le HTML servi. Beaucoup de thèmes affichent ces blocs seulement après un appel d'interface. Le visiteur les voit. Un robot qui n'exécute pas le script, non.

> Une fiche produit est exploitable quand le HTML contient déjà le nom, le prix, la disponibilité et une description propre au produit, avant toute exécution de script.

Contrôlez une fiche réelle, pas la page d'accueil. Comparez le code source et la page affichée. Google décrit le principe dans ses [bases JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). Un [audit gratuit](/audit-expert) lit la même chose à votre place sur l'URL que vous soumettez.

### Ce qui doit être spécifique

- Un texte qui distingue ce produit des autres références, pas la phrase générique du fabricant collée partout.
- Les caractéristiques utiles à l'achat (dimensions, matière, compatibilité, entretien), en texte, pas seulement dans un pictogramme.
- Les images avec un attribut alt qui dit ce que la photo montre.

## Catégories, filtres et doublons

La page catégorie explique l'assortiment : pour qui, dans quel usage, comment choisir. Une grille de produits sans texte ne répond à aucune question.

Les filtres et les tris créent des URL. Si le contenu reste identique, indiquez une canonique vers la catégorie, ou bloquez l'exploration des combinaisons inutiles. À l'inverse, une sous-catégorie qui a un vrai conseil (guide de taille, usage professionnel, entretien) mérite sa page et un lien depuis la catégorie mère.

Les pages trop minces — une ligne de catalogue, aucun texte — se repèrent en les lisant à voix haute. Si vous ne sauriez pas les citer, un assistant non plus.

## Données structurées sans les détacher de la page

Le type [Product](https://schema.org/Product) reprend le nom, l'image, la marque et l'offre tels qu'ils sont affichés. L'introduction de Google aux [données structurées](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) rappelle qu'elles décrivent la page, elles ne la remplacent pas.

Vérifiez trois écarts fréquents : un prix du balisage différent du prix affiché, une devise implicite, une disponibilité « en stock » alors que le bouton dit rupture. Corrigez la source unique (la fiche), puis le balisage.

N'ajoutez pas d'avis dans le JSON-LD s'ils ne sont pas visibles sur la page. Un balisage d'avis sans avis affiché est une contradiction, pas un raccourci.

## Vitesse perçue et contenu masqué

Un carrousel, une pop-up ou un bloc « vous aimerez aussi » ne doit pas être le seul endroit où se trouve la description. Le texte principal reste dans le flux de la page.

Les images produit pèsent lourd. Servez-les à la taille affichée, avec des dimensions dans le HTML pour éviter que la mise en page saute. Le détail des mesures de performance se fait sur l'URL réelle, pas sur une moyenne de boutique inventée.

Les pages panier et compte client n'ont pas vocation à être indexées. La fiche, la catégorie et le guide d'achat, si.

## Être cité dans un guide d'achat

Un assistant qui répond à « quel produit pour tel usage » cherche un passage comparable : critère, limite, alternative. Une fiche qui ne dit que « qualité premium » n'entre pas dans la réponse.

Rédigez, sur les catégories qui le méritent, un court guide : comment choisir, ce qui change entre deux gammes, ce qui n'est pas adapté. Ce texte vit sur votre domaine, avec un auteur ou une signature d'équipe identifiable, et des liens vers les fiches concernées.

> Un guide d'achat citable compare des critères réels du catalogue. Il ne promet pas une place dans les réponses des assistants.

Ne fabriquez pas de classement chiffré ni de part de marché. Décrivez les différences que vous pouvez montrer.

## Pages à relier

Depuis l'accueil : les catégories principales, pas seulement les promotions. Depuis chaque fiche : la catégorie, les produits réellement complémentaires, le guide d'achat s'il existe. Depuis le pied de page : les pages d'aide (livraison, retours, contact) en texte.

Passez ensuite un [audit gratuit](/audit-expert) sur une fiche et sur une catégorie. La page [Tarifs](/tarifs) présente les offres. Pour un autre contexte : [artisans](/guide/artisan-seo), [SaaS](/guide/saas-seo), [agences](/guide/agence-seo), index sur [Guides](/guides).
`,
  },
  {
    slug: "agence-seo",
    title: "SEO et GEO pour les agences et les consultants",
    metaTitle: "SEO agence : méthode et visibilité IA | Crawlers.fr",
    metaDescription:
      "Guide agences et consultants : mesurer un site avant le plan, séparer les dossiers, et ne dire de la visibilité IA que ce qui est observé.",
    targetKeyword: "seo agence",
    category: "bloc_b",
    subtitle:
      "Une méthode de travail pour plusieurs sites : ce que l'on mesure, ce que l'on peut montrer au client, et ce qu'il ne faut pas inventer sur la visibilité IA.",
    publishedAt: PUBLISHED_AT,
    externalLinks: [
      GOOGLE_HELPFUL,
      GOOGLE_JS,
      SCHEMA_INTRO,
    ],
    lateralLinks: [
      {
        slug: "artisan-seo",
        title: "SEO artisan",
        description: "Le cas d'un site local : services, zone, fiche établissement.",
      },
      {
        slug: "ecommerce-seo",
        title: "SEO e-commerce",
        description: "Fiches, catégories et contenu dupliqué fournisseur.",
      },
      {
        slug: "saas-seo",
        title: "SEO SaaS",
        description: "Pages d'intention et documentation citables.",
      },
    ],
    faqs: [
      {
        question: "Que montrer à un client lors du premier rendez-vous ?",
        answer:
          "Ce que le HTML contient vraiment, les pages importantes sans lien, les contradictions entre le site et les fiches publiques, et les passages trop vagues pour être cités. Pas une projection de trafic.",
      },
      {
        question: "Comment ne pas mélanger deux clients ?",
        answer:
          "Un audit, un export et un plan par domaine. Les exemples d'un site ne s'appliquent pas à l'autre. Le nom de domaine figure sur chaque capture et chaque recommandation.",
      },
      {
        question: "Peut-on garantir une citation dans un assistant IA ?",
        answer:
          "Non. On peut rendre une page lisible et citable : HTML complet, fait autonome, source cohérente. La citation elle-même dépend de la question et du modèle. L'écrire dans une proposition commerciale comme un résultat acquis est faux.",
      },
      {
        question: "Faut-il un guide différent par métier client ?",
        answer:
          "La base technique est la même. Les exemples changent : un artisan parle de zone et de fiche établissement, une boutique de fiches produit, un logiciel de pages d'usage et de documentation. Partir du métier évite le plan type.",
      },
      {
        question: "Où décrire l'offre de l'agence elle-même ?",
        answer:
          "Sur des pages qui disent pour qui vous travaillez, ce que le livrable contient, et ce que vous ne faites pas. Le même niveau d'exigence que pour un client. Les tarifs Crawlers, eux, sont sur la page Tarifs du site.",
      },
    ],
    content: `## Un livrable que le client peut relire

Le client n'achète pas un score. Il doit pouvoir relire, page par page, ce qui a été observé et ce qui est proposé. Chaque constat pointe une URL, un extrait du HTML ou une capture datée. Une recommandation sans URL n'est pas vérifiable.

> Un livrable d'agence tient quand chaque constat est rattaché à une URL et à un extrait, et quand aucune recommandation ne promet un classement ou une citation.

Séparez trois blocs : ce qui est mesuré, ce qui est une hypothèse, ce qui est une tâche. Les hypothèses ne se rédigent pas comme des faits. C'est aussi ce que Google demande aux contenus qui se disent utiles : [montrer l'expérience réelle](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), pas l'enrober.

## Mesurer avant d'écrire le plan

Avant le calendrier éditorial, lisez le HTML des modèles qui comptent : accueil, un service ou une fiche, une page d'aide. Notez ce qui manque dans la source (titre, H1, texte, canonique, données structurées) et ce qui n'apparaît qu'après script.

L'[audit gratuit](/audit-expert) sert de premier passage sur une URL. Il ne remplace pas la lecture du site. Le détail des offres est sur la page [Tarifs](/tarifs), pas dans ce guide.

Classez les constats par effet sur la lecture de la page, pas par mode. Une canonique qui pointe vers la mauvaise URL passe avant une reformulation de titre.

## Séparer les sites, garder la même méthode

Chaque domaine a son dossier : exports, URL, décisions. Réutiliser une phrase d'audit d'un client sur un autre est une erreur de fait, pas un gain de temps.

La méthode, elle, se répète :

1. HTML servi des pages modèles.
2. Indexation voulue ou non (canonique, noindex, robots.txt).
3. Maillage : les pages business sont-elles liées depuis l'accueil ?
4. Passages citables : une phrase autonome par page importante.
5. Cohérence avec les profils publics (fiche établissement, annuaires, page « à propos »).

Les exemples se prennent dans le guide du métier du client : [artisan](/guide/artisan-seo), [e-commerce](/guide/ecommerce-seo), [SaaS](/guide/saas-seo).

## Ce que l'on peut dire de la visibilité IA

On peut montrer qu'une page est lisible, qu'un passage répond à une question précise, que les robots ne sont pas bloqués, que les informations de l'entreprise sont les mêmes d'une source à l'autre. On ne peut pas montrer qu'un modèle citera la marque la semaine prochaine.

Dans le rapport, écrivez les questions testées, la date, et ce qui a été observé ce jour-là. Une observation datée est un fait. Une tendance sans période ne l'est pas.

Si le texte n'est présent qu'après JavaScript, dites-le avec le lien vers les [bases JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). Si le JSON-LD contredit la page, dites-le avec l'[introduction aux données structurées](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data). Le client peut vérifier.

## Suivi sans indicateur fantôme

Un suivi utile reprend les mêmes URL et les mêmes questions. On note ce qui a changé dans le HTML, pas un indice composite dont personne ne connaît la formule.

Le compte rendu tient en peu de lignes : pages modifiées, constats encore ouverts, nouveau fait observé. Évitez d'ajouter un graphique qui n'a pas de définition. Si un chiffre vient d'un outil, citez l'outil, la date et l'URL. S'il ne vient de nulle part, ne l'écrivez pas.

## Le site de l'agence

Les pages de l'agence suivent la même règle. Dites pour qui vous travaillez, ce que contient un accompagnement, ce que vous ne promettez pas. Une page « résultats » sans méthode ni période n'est pas une preuve.

Liez votre propre offre en interne comme vous le demandez aux clients. Pour l'outillage Crawlers, partez de l'[audit gratuit](/audit-expert) et de la page [Tarifs](/tarifs). L'index des guides métier est sur [Guides](/guides).
`,
  },
  {
    slug: "saas-seo",
    title: "SEO et GEO pour un logiciel SaaS",
    metaTitle: "SEO SaaS : pages, docs et citations IA | Crawlers.fr",
    metaDescription:
      "Guide pratique pour un site SaaS : pages d'usage, documentation citable, rendu HTML et visibilité dans les assistants IA, sans chiffre inventé.",
    targetKeyword: "seo saas",
    category: "bloc_a",
    subtitle:
      "Rendre un logiciel trouvable sur Google et citable par les assistants : pages d'usage, documentation, preuves et HTML réellement servi.",
    publishedAt: PUBLISHED_AT,
    externalLinks: [
      GOOGLE_HELPFUL,
      GOOGLE_JS,
      SCHEMA_INTRO,
    ],
    lateralLinks: [
      {
        slug: "agence-seo",
        title: "SEO pour agences",
        description: "Méthode de mesure et de restitution multi-sites.",
      },
      {
        slug: "ecommerce-seo",
        title: "SEO e-commerce",
        description: "Quand le SaaS vend aussi un catalogue ou un paiement en ligne.",
      },
      {
        slug: "artisan-seo",
        title: "SEO artisan",
        description: "Le cas d'une offre locale, utile si vous visez ce métier.",
      },
    ],
    faqs: [
      {
        question: "Quelle page créer en premier pour un SaaS ?",
        answer:
          "La page qui répond à un usage précis : pour qui, quel problème, ce que le produit fait et ne fait pas. La page d'accueil qui enchaîne les slogans ne suffit pas à être cité ni à être compris.",
      },
      {
        question: "La documentation peut-elle être une source pour les assistants ?",
        answer:
          "Oui, si une page répond à une question entière sans renvoyer à dix autres. Un paragraphe autonome, avec le vocabulaire exact de l'interface, se cite mieux qu'une capture sans texte.",
      },
      {
        question: "Faut-il indexer l'application connectée ?",
        answer:
          "En général non. Les écrans derrière un compte n'apportent rien à quelqu'un qui découvre le produit. On indexe le marketing, les usages, la documentation publique et les pages d'aide. On exclut le reste avec une canonique, un noindex ou une règle robots cohérente.",
      },
      {
        question: "Comment parler des résultats clients sans inventer ?",
        answer:
          "Décrivez le contexte et ce qui a été fait, avec l'accord du client. Si vous n'avez pas de chiffre sourcé, n'en écrivez pas. Un extrait d'interface ou une étape de mise en place vérifiable vaut mieux qu'un pourcentage sans période.",
      },
      {
        question: "Où enchaîner après ce guide ?",
        answer:
          "Sur un audit gratuit d'une page d'usage et d'une page de documentation, puis sur la page Tarifs pour les offres. Le guide ne fixe ni le périmètre de l'audit ni les conditions des plans.",
      },
    ],
    content: `## Des pages qui portent une intention

« Plateforme tout-en-un » n'est pas une requête ni une question. Découpez le site par usage : le problème, le métier visé, la tâche dans le produit. Chaque page dit à qui elle s'adresse et à qui elle ne s'adresse pas.

> Une page SaaS citable nomme l'usage, la limite du produit et le vocabulaire réel de l'interface. Un slogan ne se cite pas.

Le titre et le H1 reprennent cet usage. Le premier paragraphe répond, sans renvoyer à une démo pour comprendre de quoi il s'agit. La démo vient après, comme preuve, pas comme substitut du texte.

Comparez deux offres du marché seulement si vous décrivez des différences vérifiables (fonction présente ou absente, mode de déploiement, public). Un tableau de notes sans méthode n'a pas sa place.

## Documentation et passages autonomes

La documentation publique est souvent la meilleure source pour un assistant : elle répond à « comment faire X ». Encore faut-il qu'une page tienne seule. Un tutoriel qui commence par « comme vu plus haut » n'est pas reprenable.

Rédigez le résultat attendu, les prérequis et les étapes dans le HTML. Une capture d'écran a un texte alternatif et une légende. Le nom des boutons est celui de l'interface, pas une périphrase.

Reliez la page d'usage marketing vers la page de documentation correspondante, et l'inverse. Ce lien dit que les deux parlent du même sujet.

## Ce que les assistants peuvent reprendre

Ils reprennent un fait qu'ils n'ont pas besoin d'interpréter : une définition du produit, une limite, une étape, un cas d'usage. Ils ne reprennent pas « la solution préférée des équipes ».

Passez chaque page importante au test de la citation : existe-t-il une phrase qui reste vraie hors du site ? Si non, réécrivez cette phrase avant d'en ajouter d'autres. Le rappel de Google sur le [contenu utile](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) s'applique aussi ici : l'expérience du produit doit se voir dans le texte.

Ne bloquez pas les robots des assistants sur les pages que vous voulez voir citées. Vérifiez le robots.txt et les balises robots des modèles de pages, pas seulement de l'accueil.

## Rendu, canoniques, pages de compte

Le même piège que sur une boutique : le texte marketing injecté seulement après JavaScript. Contrôlez le code source d'une page d'usage. Les [bases JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) décrivent pourquoi le HTML initial compte.

Les variantes (langue, campagne, paramètre de tracking) pointent vers une canonique unique quand le contenu est le même. Les pages de connexion, de réinitialisation et l'application elle-même ne sont pas des landing pages : excluez-les de façon explicite.

Si vous ajoutez des données structurées, elles répètent le visible (logiciel, organisation, FAQ réellement affichée). L'[introduction de Google](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) suffit comme cadre. Un balisage FAQ sur des questions absentes de la page est à retirer.

## Preuves sans chiffre fabriqué

Un extrait de produit, un parcours de mise en place, une liste de ce qui est inclus dans un usage : voilà des preuves. Un pourcentage de gain, un nombre de clients ou une note moyenne, seulement si la source, la date et le périmètre sont écrits à côté. Sinon, taisez le chiffre.

Les études de cas suivent la même règle. Décrivez la situation de départ et ce qui a été livré. Le client nommé l'est avec son accord. Pas d'identité floue du type « une scale-up du CAC 40 » qui ne permet aucune vérification.

## Maillage vers l'offre

L'accueil lie les pages d'usage, pas seulement le bouton d'inscription. Chaque page d'usage lie la documentation, la page qui explique l'offre, et le contact. Le pied de page reprend ces mêmes destinations en texte.

Pour mesurer une URL précise, utilisez l'[audit gratuit](/audit-expert). Les offres Crawlers sont sur [Tarifs](/tarifs) ; ce guide ne les résume pas, pour ne pas diverger de cette page. Autres contextes : [agences](/guide/agence-seo), [e-commerce](/guide/ecommerce-seo), [artisans](/guide/artisan-seo), index [Guides](/guides).
`,
  },
];

const BY_SLUG = new Map(PROFESSION_GUIDES.map((guide) => [guide.slug, guide]));

export function getProfessionGuide(slug: string): ProfessionGuideSource | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Ligne compatible avec parseGuideFromDb (seo_page_drafts). */
export function getBuiltinGuideRow(slug: string) {
  const guide = getProfessionGuide(slug);
  if (!guide) return null;
  return {
    slug: guide.slug,
    title: guide.title,
    meta_title: guide.metaTitle,
    meta_description: guide.metaDescription,
    target_keyword: guide.targetKeyword,
    content: guide.content,
    published_at: guide.publishedAt,
    created_at: guide.publishedAt,
    updated_at: guide.publishedAt,
    generation_context: {
      faqs: guide.faqs,
      guide_category: guide.category,
      hero_cta_label: "Lancer un audit gratuit",
      hero_cta_href: "/audit-expert",
      external_links: guide.externalLinks,
      lateral_links: guide.lateralLinks,
      tools: [
        {
          name: "Audit gratuit",
          href: "/audit-expert",
          description: "Lire une URL telle qu'elle est servie, avant de corriger.",
        },
        {
          name: "Tarifs",
          href: "/tarifs",
          description: "Voir les offres Crawlers.",
        },
      ],
    },
  };
}

export function listBuiltinGuideEntries(): Array<{
  slug: string;
  title: string;
  meta_description: string;
  guide_category: string;
}> {
  return PROFESSION_GUIDES.map((guide) => ({
    slug: guide.slug,
    title: guide.title,
    meta_description: guide.metaDescription,
    guide_category: guide.category,
  }));
}

export const PROFESSION_GUIDE_SITEMAP = PROFESSION_GUIDES.map((guide) => ({
  loc: `https://crawlers.fr/guide/${guide.slug}`,
  lastmod: null as string | null,
  changefreq: "monthly" as const,
  priority: 0.7,
}));

export function appendProfessionGuideEntries<T extends { loc: string }>(
  entries: T[],
): Array<T | (typeof PROFESSION_GUIDE_SITEMAP)[number]> {
  const have = new Set(entries.map((entry) => entry.loc.replace(/\/$/, "")));
  const extra = PROFESSION_GUIDE_SITEMAP.filter((entry) => !have.has(entry.loc));
  return extra.length ? [...entries, ...extra] : entries;
}

/** Forme lue par render-page quand la base n'a pas le guide. */
export function getBuiltinPrerenderGuide(slug: string) {
  const guide = getProfessionGuide(slug);
  if (!guide) return null;
  return {
    title: guide.title,
    slug: guide.slug,
    meta_title: guide.metaTitle,
    meta_description: guide.metaDescription,
    content: guide.content,
    target_keyword: guide.targetKeyword,
    published_at: guide.publishedAt,
    guide_category: guide.category,
    guide_target: guide.slug,
    faqs: guide.faqs,
  };
}
