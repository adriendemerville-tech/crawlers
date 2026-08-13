import { Suspense, lazy } from 'react';
import { Link } from '@/lib/router-compat';
import { ArrowRight, Bot, CheckCircle2, Quote, Search, Sparkles } from 'lucide-react';
import Header from '@/components/Header';

const Footer = lazy(() => import('@/components/Footer'));

const PILLARS = [
  {
    icon: Search,
    title: 'Être trouvé',
    body: "Les moteurs IA sélectionnent leurs sources via des crawlers dédiés (GPTBot, ClaudeBot, PerplexityBot, Google-Extended). Si ces robots sont bloqués ou n'atteignent pas vos pages, vous n'existez pas dans les réponses.",
  },
  {
    icon: Quote,
    title: 'Être cité',
    body: "Une réponse générative reprend des passages courts, factuels et attribuables. Les contenus structurés — définitions, chiffres sourcés, comparatifs, questions/réponses — sont cités bien plus souvent que les pages promotionnelles.",
  },
  {
    icon: Sparkles,
    title: 'Être recommandé',
    body: "Au-delà de la citation, l'objectif est d'être nommé comme solution. Cela dépend de la cohérence de vos mentions sur l'ensemble du web : site, presse, annuaires, forums, avis.",
  },
];

const STEPS = [
  {
    title: '1. Auditer votre visibilité IA actuelle',
    body: "Mesurez si votre marque apparaît dans les réponses de ChatGPT, Perplexity et Gemini sur vos requêtes métier, et à quelle position dans le raisonnement.",
  },
  {
    title: '2. Ouvrir l\u2019accès aux crawlers IA',
    body: "Vérifiez robots.txt, les règles CDN et le rendu serveur. Un contenu chargé uniquement en JavaScript côté client est souvent invisible pour les crawlers IA.",
  },
  {
    title: '3. Restructurer les contenus pour la citation',
    body: "Un passage citable fait 2 à 4 phrases, contient un fait vérifiable et se suffit hors contexte. Ajoutez des données structurées (Article, FAQPage, Organization) pour lever toute ambiguïté.",
  },
  {
    title: '4. Construire l\u2019autorité et la cohérence',
    body: "Les moteurs IA croisent les sources. Une même définition, un même positionnement et un même nom d\u2019auteur partout renforcent la confiance accordée à votre domaine.",
  },
  {
    title: '5. Mesurer en continu',
    body: "Suivez les passages de crawlers IA dans vos logs, le taux de citation par moteur et l\u2019évolution des réponses. Le référencement IA se pilote comme le SEO : par itérations mesurées.",
  },
];

const FAQ = [
  {
    q: "Qu'est-ce que le référencement IA ?",
    a: "Le référencement IA (aussi appelé GEO, Generative Engine Optimization) désigne l'ensemble des méthodes visant à faire apparaître un site dans les réponses des moteurs génératifs comme ChatGPT, Perplexity ou Gemini. Il complète le SEO classique : l'objectif n'est plus seulement d'obtenir un clic depuis une liste de résultats, mais d'être cité comme source dans une réponse rédigée.",
  },
  {
    q: 'Quelle différence entre SEO et référencement IA ?',
    a: "Le SEO optimise un classement dans une page de résultats ; le référencement IA optimise la probabilité d'être retenu comme source d'une réponse. Le SEO valorise la page entière et les signaux de popularité ; le référencement IA valorise le passage extractible, le fait vérifiable et la cohérence des mentions à travers le web.",
  },
  {
    q: 'Faut-il autoriser les crawlers des IA ?',
    a: "Oui si vous cherchez la visibilité dans les réponses générées : bloquer GPTBot, ClaudeBot ou PerplexityBot revient à se retirer de leur corpus. Le blocage se justifie uniquement pour protéger un contenu payant ou propriétaire que vous ne voulez pas voir reformulé.",
  },
  {
    q: 'Comment mesurer sa visibilité dans les moteurs IA ?',
    a: "Par deux signaux complémentaires : les logs serveur, qui montrent le passage effectif des crawlers IA sur vos pages, et l'interrogation régulière des moteurs sur vos requêtes métier, qui montre si votre marque est citée. Crawlers.fr combine les deux dans un score GEO.",
  },
  {
    q: 'Combien de temps avant de voir des résultats ?',
    a: "Les moteurs IA rafraîchissent leur index plus vite que le classement organique de Google : une page bien structurée peut être citée en quelques jours par Perplexity. En revanche, l'autorité de marque — être recommandé spontanément — se construit sur plusieurs mois.",
  },
];

export default function ReferencementIA() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {/* Hero */}
        <section className="border-b border-border py-16 md:py-24">
          <div className="container mx-auto max-w-4xl px-4">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
              Guide de référence · GEO / Generative Engine Optimization
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
              Référencement IA : être cité par ChatGPT, Perplexity et Gemini
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Le référencement IA prolonge le SEO à l'ère des réponses générées. Voici la méthode
              complète — accès des crawlers, passages citables, autorité, mesure — et les données
              réelles que nous observons sur le web francophone.
            </p>
            <blockquote className="citable-passage mt-8 border-l-2 border-primary/60 pl-4 text-foreground">
              Le référencement IA (GEO) consiste à rendre un site sélectionnable comme source par un
              moteur génératif. Il repose sur trois conditions cumulatives : l'accès des crawlers IA
              au contenu, la présence de passages factuels extractibles, et la cohérence des
              mentions de la marque sur le web.
            </blockquote>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/audit-geo"
                className="inline-flex items-center gap-2 rounded-md border border-foreground/30 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground"
              >
                Tester ma visibilité IA
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/observatoire"
                className="inline-flex items-center gap-2 rounded-md border border-foreground/30 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground"
              >
                Voir les domaines les plus cités
              </Link>
            </div>
          </div>
        </section>

        {/* Trois piliers */}
        <section className="container mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Les trois conditions d'un référencement IA efficace
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-lg border border-border p-5">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Méthode */}
        <section className="border-y border-border bg-muted/30 py-14">
          <div className="container mx-auto max-w-4xl px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Méthode en 5 étapes pour améliorer son référencement IA
            </h2>
            <ol className="mt-8 space-y-6">
              {STEPS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto max-w-4xl px-4 py-14">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            Questions fréquentes sur le référencement IA
          </h2>
          <div className="mt-8 space-y-6">
            {FAQ.map((item) => (
              <article key={item.q}>
                <h3 className="font-semibold text-foreground">{item.q}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Maillage */}
        <section className="border-t border-border py-14">
          <div className="container mx-auto max-w-4xl px-4">
            <h2 className="text-xl font-bold text-foreground">Pour aller plus loin</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li>
                <Link to="/observatoire" className="text-foreground underline-offset-4 hover:underline">
                  Observatoire des citations des moteurs IA
                </Link>
              </li>
              <li>
                <Link to="/site-crawl" className="text-foreground underline-offset-4 hover:underline">
                  Crawler SEO : analyser toutes ses pages
                </Link>
              </li>
              <li>
                <Link to="/audit-geo" className="text-foreground underline-offset-4 hover:underline">
                  Audit GEO gratuit
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-foreground underline-offset-4 hover:underline">
                  Blog SEO &amp; GEO
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}

export { FAQ as REFERENCEMENT_IA_FAQ };
