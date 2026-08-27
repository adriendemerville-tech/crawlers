import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { AuditedDomainsCounter } from '@/components/AuditedDomainsCounter';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import MarinaCitablePassage from '@/components/seo/MarinaCitablePassage';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

/** Les 11 sous-signaux du score GEO Crawlers (cf. moteur d'audit). */
export const GEO_SUB_SIGNALS: { label: string; detail: string }[] = [
  { label: 'Autorité de domaine', detail: 'Authority Score, profil de liens et réseau propre segmenté.' },
  { label: 'Présence SERP', detail: 'Positions et volumes réels sur vos requêtes métier.' },
  { label: 'Contenu accessible aux robots', detail: 'Texte servi sans JavaScript, détection de coquille JS.' },
  { label: 'Données structurées et nœud d’identité', detail: 'JSON-LD complet, Organization relié par @id stable.' },
  { label: 'Politique robots IA', detail: 'Directives explicites GPTBot, ClaudeBot, PerplexityBot, llms.txt.' },
  { label: 'Fraîcheur', detail: 'Dates de publication et de mise à jour réellement exposées.' },
  { label: 'Passages citables', detail: 'Blocs autoportants qu’un modèle peut reprendre tels quels.' },
  { label: 'Mise en forme des réponses', detail: 'Question → réponse directe, listes, tableaux, FAQ balisée.' },
  { label: 'Entité reconnue', detail: 'Cohérence des signaux de knowledge graph et des mentions.' },
  { label: 'Sources et attributions', detail: 'Citations sortantes, preuves chiffrées, données propriétaires.' },
  { label: 'Voix experte identifiée', detail: 'Auteur nommé, page auteur, balisage Person et ProfilePage.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Qui peut faire un audit GEO sérieux ?',
    a: "Un audit GEO sérieux ne repose pas sur l'avis d'un consultant : il repose sur des faits mesurés. Crawlers.fr recrawle la page comme un robot d'IA, vérifie le texte réellement servi sans JavaScript, contrôle le nœud d'identité JSON-LD, lit la politique robots pour GPTBot, ClaudeBot et PerplexityBot, puis interroge plusieurs modèles pour vérifier si la marque est citée. Chaque point du score est traçable jusqu'à la mesure qui l'a produit.",
  },
  {
    q: 'Comment savoir si mon entreprise apparaît dans ChatGPT ?',
    a: "L'audit pose des questions naturelles d'acheteur aux modèles (ChatGPT, Claude, Gemini, Perplexity, Mistral) sur votre activité et votre zone, puis compte les citations de votre marque et celles de vos concurrents. Une absence totale de citation applique une pénalité de 10 % au score GEO, explicitée dans le rapport.",
  },
  {
    q: 'L’audit GEO est-il gratuit ?',
    a: "Oui. Les deux premiers rapports sont offerts, sans carte bancaire, et le rapport d'exemple est consultable sans compte. Le rapport complet fait 40 pages et plus, exportable en PDF et partageable par lien.",
  },
  {
    q: 'Combien de points de contrôle ?',
    a: "232 points de contrôle techniques répartis sur 11 sous-signaux GEO, plus le volet SEO technique et sémantique. Chaque point est soit mesuré, soit marqué non mesuré : aucun score n'est estimé silencieusement.",
  },
  {
    q: 'Pourquoi ne pas demander directement un audit à ChatGPT ou Claude ?',
    a: "Parce qu'un modèle de langage n'a pas les moyens techniques de produire un audit : il ne crawle pas la page entière ni ses ressources, n'a pas accès aux SERP en temps réel, ne connaît pas le profil de backlinks, ne conserve aucune mémoire d'un audit à l'autre et change d'appréciation à chaque exécution. Le résultat est imprédictible. Crawlers.fr mesure d'abord la donnée réelle du site — rendu servi aux robots, contenu de chaque page, positions, backlinks — on la conserve en mémoire pour croiser les signaux et suivre l'évolution du référencement page par page, et l'IA n'intervient qu'ensuite, pour calculer des probabilités et mettre l'analyse en forme. L'IA est utile pour raisonner sur des faits ; elle n'est pas fiable pour aller chercher les faits.",
  },
  {
    q: "Quel est le rôle de l'IA dans un audit Crawlers ?",
    a: "L'IA n'est jamais la source de la donnée. Elle intervient en aval : pondération et probabilités, hiérarchisation des priorités, rédaction du verdict à partir de faits déjà mesurés. Toute valeur numérique du rapport vient d'une mesure tracée, jamais d'une estimation du modèle.",
  },
];

/** Ce qu'un LLM seul ne peut pas faire, et ce que Crawlers mesure à la place. */
const METHOD_ROWS: { axis: string; llm: string; crawlers: string }[] = [
  {
    axis: 'Lecture de la page',
    llm: "Lit un extrait tronqué du HTML, sans exécuter le JavaScript ni charger les ressources.",
    crawlers: "Crawl complet du rendu réellement servi aux robots, avec détection de coquille JS et densité de texte hors script.",
  },
  {
    axis: 'Positions SERP',
    llm: "Aucun accès aux résultats de recherche en temps réel ; les positions citées sont inventées.",
    crawlers: "Positions, volumes et concurrents issus de sources de données SERP, à la date de l'audit.",
  },
  {
    axis: 'Backlinks',
    llm: "Aucun index de liens ; l'autorité est devinée à partir de la notoriété apparente de la marque.",
    crawlers: "Authority Score, liens entrants segmentés (réseau propre, annuaires, éditorial tiers) et ancres analysées.",
  },
  {
    axis: 'Mémoire',
    llm: "Aucune mémoire entre deux audits : impossible de comparer, de suivre une évolution ou de vérifier un correctif.",
    crawlers: "Chaque audit est historisé par URL : comparaison dans le temps, delta de score, effet réel des corrections appliquées.",
  },
  {
    axis: 'Reproductibilité',
    llm: "Deux exécutions sur la même page donnent deux verdicts différents. Le diagnostic n'est pas opposable.",
    crawlers: "Score déterministe, plafonds de cohérence, mention « mesuré » ou « non mesuré » sur chaque point.",
  },
];

const AuditGeo = () => {
  useCanonicalHreflang('/audit-geo');

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <nav aria-label="Fil d'Ariane" className="mx-auto max-w-5xl px-4 pt-6">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <li>
              <Link to="/" className="hover:text-foreground">Accueil</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/generative-engine-optimization" className="hover:text-foreground">
                Generative Engine Optimization
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground/70 font-medium">Audit GEO</li>
          </ol>
        </nav>

        <section className="mx-auto max-w-4xl px-4 pt-10 pb-12 text-center">
          <p className="text-sm uppercase tracking-widest text-primary mb-4">Audit GEO automatisé</p>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-5">
            Audit GEO gratuit : votre visibilité dans les réponses des IA
          </h1>
          <h2 className="text-lg md:text-xl text-muted-foreground font-normal mb-8">
            Audit technique complet de votre référencement IA (232 points de contrôle)
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link to="/marina">
                Lancer mon audit GEO gratuit <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/audit-seo-geo">Voir la méthodologie</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Résultat en quelques minutes, sans compte pour le rapport d’exemple. 2 rapports offerts.
          </p>
        </section>

        {/* Preuve sociale : volume réel de domaines audités */}
        <AuditedDomainsCounter />



        <section className="mx-auto max-w-3xl px-4 pb-12" aria-labelledby="geo-definition">
          <h2 id="geo-definition" className="text-2xl font-semibold text-foreground mb-4">
            Qu’est-ce qu’un audit GEO ?
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary/60 pl-4 text-muted-foreground leading-relaxed">
            Un audit GEO (Generative Engine Optimization) mesure la probabilité qu’un moteur génératif —
            ChatGPT, Claude, Gemini, Perplexity — cite votre entreprise dans sa réponse. Il diffère d’un audit
            SEO : il ne regarde pas seulement le classement dans Google, mais{' '}
            <strong>l’accessibilité du contenu aux robots d’IA</strong>, la complétude du nœud d’identité,
            <strong>la présence de passages citables</strong> et la réalité des citations observées. Crawlers.fr
            le calcule sur 11 sous-signaux et 232 points de contrôle, chaque valeur étant soit mesurée, soit
            déclarée non mesurée.
          </blockquote>
          <p className="mt-3 text-sm text-muted-foreground">
            Source externe :{' '}
            <a
              href="https://blog.google/products/search/google-search-ai-overviews/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              comment Google construit ses réponses génératives
            </a>
            .
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-12" aria-labelledby="geo-signaux">
          <h2 id="geo-signaux" className="text-2xl font-semibold text-foreground mb-6">
            Les 11 sous-signaux du score GEO
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {GEO_SUB_SIGNALS.map((s) => (
              <Card key={s.label} className="border-border">
                <CardContent className="pt-6">
                  <h3 className="flex items-start gap-2 text-base font-semibold text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                    {s.label}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-12" aria-labelledby="geo-methode">
          <h2 id="geo-methode" className="text-2xl font-semibold text-foreground mb-4">
            La méthode Crawlers : la donnée d’abord, l’IA ensuite
          </h2>
          <blockquote className="citable-passage border-l-2 border-primary/60 pl-4 text-muted-foreground leading-relaxed mb-6">
            Confier son audit à une IA, c’est le confier à un outil qui n’a techniquement pas les moyens de
            crawler une page HTML entière et ses données : il n’exécute pas le JavaScript, n’accède pas aux
            SERP en temps réel, ne connaît pas le profil de backlinks, ne conserve aucune mémoire d’un audit à
            l’autre et change d’appréciation à chaque exécution. Le diagnostic est donc{' '}
            <strong>imprédictible</strong>. La méthode Crawlers.fr inverse l’ordre : on mesure d’abord la{' '}
            <strong>donnée réelle</strong> du site — rendu servi aux robots, contenu de chaque page, positions,
            backlinks — on la conserve en mémoire pour croiser les signaux et suivre l’évolution du référencement
            page par page, et l’IA n’intervient qu’ensuite, pour calculer des probabilités et mettre l’analyse
            en forme. L’IA est utile pour raisonner sur des faits ; elle n’est pas fiable pour aller chercher les
            faits.
          </blockquote>

          <p className="mb-6 text-sm text-muted-foreground">
            Référence externe :{' '}
            <a
              href="https://www.google.com/search/howsearchworks/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              le fonctionnement de l’index, du crawl et du classement Google
            </a>
            .
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <caption className="sr-only">
                Comparaison entre un audit demandé à un modèle de langage et la méthode Crawlers.fr
              </caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 pr-4 font-semibold text-foreground">Axe</th>
                  <th scope="col" className="py-3 pr-4 font-semibold text-foreground">Audit demandé à une IA</th>
                  <th scope="col" className="py-3 font-semibold text-foreground">Méthode Crawlers.fr</th>
                </tr>
              </thead>
              <tbody>
                {METHOD_ROWS.map((row) => (
                  <tr key={row.axis} className="border-b border-border/60 align-top">
                    <th scope="row" className="py-3 pr-4 font-medium text-foreground whitespace-nowrap">
                      {row.axis}
                    </th>
                    <td className="py-3 pr-4 text-muted-foreground">{row.llm}</td>
                    <td className="py-3 text-muted-foreground">{row.crawlers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-lg font-semibold text-foreground mb-3">
            Ce que l’IA fait bien, et ce qu’on ne lui confie pas
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border">
              <CardContent className="pt-6">
                <h4 className="text-base font-semibold text-foreground">Confié à l’IA</h4>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
                  <li>Calcul de probabilités de citation à partir de faits mesurés.</li>
                  <li>Hiérarchisation des priorités et rédaction du verdict.</li>
                  <li>Reformulation d’un contenu existant en passages citables.</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-6">
                <h4 className="text-base font-semibold text-foreground">Jamais confié à l’IA</h4>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5">
                  <li>La collecte du HTML, des balises et du texte réellement servi.</li>
                  <li>Les positions SERP, volumes et concurrents.</li>
                  <li>Le profil de backlinks et l’autorité de domaine.</li>
                  <li>Toute valeur chiffrée affichée dans le rapport.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-12" aria-labelledby="geo-difference">
          <h2 id="geo-difference" className="text-2xl font-semibold text-foreground mb-4">
            Pourquoi un outil plutôt qu’une prestation manuelle
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            La majorité des audits GEO vendus aujourd’hui sont des analyses manuelles livrées en plusieurs
            jours, sans <strong>mesure reproductible</strong>. Crawlers.fr produit le même diagnostic de façon
            automatisée : crawl du rendu servi aux robots, contrôle du balisage, interrogation multi-modèles,
            comparaison aux concurrents réellement identifiés sur votre zone. Le rapport indique la mesure
            derrière chaque point, et les <strong>plafonds de cohérence</strong> empêchent tout score flatteur
            non justifié.
          </p>
          <p className="mt-4 text-sm">
            <Link to="/generative-engine-optimization" className="text-primary hover:underline">
              Comprendre le GEO en détail
            </Link>
            {' · '}
            <Link to="/audit-seo-gratuit" className="text-primary hover:underline">
              Audit SEO gratuit
            </Link>
          </p>
        </section>

        <MarinaCitablePassage />

        <section className="mx-auto max-w-3xl px-4 pb-16" aria-labelledby="geo-faq">
          <h2 id="geo-faq" className="text-2xl font-semibold text-foreground mb-6">
            Questions fréquentes sur l’audit GEO
          </h2>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer font-medium text-foreground">{f.q}</summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline" size="lg">
              <Link to="/marina">
                Lancer mon audit GEO gratuit <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default AuditGeo;
