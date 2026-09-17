import { memo } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';
import { SiloNav } from '@/components/seo/SiloNav';
import { CitablePassage } from '@/components/seo/CitablePassage';
import { SeoFaqList } from '@/components/seo/SeoFaqList';
import { ArrowRight, Bot, Layers, Search } from 'lucide-react';
import { GEO_VS_SEO_FAQ } from './GeoVsSeo.seo';

/** Ligne du tableau comparatif : mêmes travaux, lecture différente. */
const COMPARISON: Array<{ axis: string; seo: string; geo: string; shared: string }> = [
  {
    axis: 'Objectif',
    seo: 'Être classé dans les résultats Google',
    geo: 'Être cité dans une réponse rédigée par un modèle',
    shared: 'Être trouvé au moment de la recherche',
  },
  {
    axis: 'Unité de succès',
    seo: 'La position d’une URL sur une requête',
    geo: 'La mention de la marque ou la citation d’un passage',
    shared: 'La page reste le support du contenu',
  },
  {
    axis: 'Accès du robot',
    seo: 'Googlebot, rendu JavaScript possible',
    geo: 'GPTBot, ClaudeBot, PerplexityBot, rendu limité',
    shared: 'Un HTML servi sans JavaScript profite aux deux',
  },
  {
    axis: 'Structure attendue',
    seo: 'Titres hiérarchisés, maillage, données structurées',
    geo: 'Passages autonomes et citables, faits datés, sources',
    shared: 'Le même balisage sert les deux lectures',
  },
  {
    axis: 'Mesure',
    seo: 'Impressions, clics, positions (Search Console)',
    geo: 'Taux de citation par moteur, part de voix dans les réponses',
    shared: 'Les deux se mesurent par requête, pas au global',
  },
  {
    axis: 'Délai d’effet',
    seo: 'Plusieurs semaines à quelques mois',
    geo: 'Variable : dépend du cycle de rafraîchissement du modèle',
    shared: 'Aucun des deux ne produit d’effet immédiat',
  },
];

/** Les trois oppositions courantes et ce que montrent les faits. */
const MYTHS: Array<{ myth: string; reality: string }> = [
  {
    myth: '« Le SEO est mort, il faut passer au GEO. »',
    reality:
      'Les moteurs génératifs s’appuyent en grande partie sur des pages web indexées et sur des résultats de recherche pour construire leurs réponses. Abandonner le SEO revient à retirer la matière première du GEO.',
  },
  {
    myth: '« Le GEO est un buzzword, rien ne change. »',
    reality:
      'Ce qui change est réel et mesurable : une part des recherches se termine dans une réponse rédigée, sans clic. Le trafic peut baisser alors que la marque est plus visible qu’avant. Sans mesure des citations, cette visibilité reste invisible dans les rapports.',
  },
  {
    myth: '« Ce sont deux chantiers séparés, avec deux budgets. »',
    reality:
      'La majorité des correctifs sont communs : HTML servi côté serveur, structure des titres, données structurées, fraîcheur des contenus, autorité. Le GEO ajoute une exigence de rédaction — des passages autonomes et vérifiables — pas une seconde refonte.',
  },
];

/** Chantiers communs, ordonnés par effet réel. */
const SHARED_WORK: Array<{ title: string; text: string }> = [
  {
    title: 'Servir le contenu en HTML, sans dépendre du JavaScript',
    text: 'Googlebot sait exécuter du JavaScript, la plupart des robots de moteurs IA ne le font pas ou mal. Une page dont le texte n’apparaît qu’après hydratation est une coquille vide pour eux. C’est le correctif au rendement le plus élevé, et il sert les deux canaux.',
  },
  {
    title: 'Structurer avant de rédiger',
    text: 'Un seul H1, des H2 qui posent une question réelle, des paragraphes qui répondent sans dépendre du précédent. Cette structure améliore la lecture humaine, les extraits Google et la reprise par un modèle.',
  },
  {
    title: 'Écrire des passages autonomes et datés',
    text: 'Un passage citable tient seul : il nomme le sujet, donne un fait, précise la source ou la date. C’est l’unique exigence proprement GEO — et elle ne dégrade jamais le SEO.',
  },
  {
    title: 'Déclarer l’identité et les entités',
    text: 'Données structurées Organization, auteur identifié, pages de référence stables. Google y voit un signal d’autorité, les modèles y trouvent de quoi attribuer une affirmation à une source.',
  },
  {
    title: 'Mesurer les deux côtés sur les mêmes requêtes',
    text: 'Comparer les positions Google et le taux de citation IA sur le même jeu de requêtes est la seule façon de savoir si une action a produit un gain, une perte, ou un simple déplacement du canal.',
  },
];

function GeoVsSeoPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background">
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-10 md:pt-20">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Silo GEO</p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            GEO et SEO : pourquoi il ne faut pas les opposer en 2027
          </h1>
          <p className="mt-5 text-base md:text-lg leading-relaxed text-muted-foreground">
            Le SEO cherche une position dans les résultats de Google. Le GEO cherche une citation
            dans la réponse d’un modèle génératif. Les deux se disputent la même attention, mais
            reposent sur le même travail : un contenu accessible, structuré et vérifiable.
          </p>

          <CitablePassage className="mt-8" source="Crawlers.fr">
            Le GEO (Generative Engine Optimization) ne remplace pas le SEO : il en dépend. Les
            moteurs génératifs construisent leurs réponses à partir de pages indexées et de
            résultats de recherche. Un site invisible pour Googlebot est, dans la grande majorité
            des cas, également absent des réponses de ChatGPT, Claude ou Perplexity.
          </CitablePassage>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm" className="w-auto">
              <Link to="/audit-geo-seo">Auditer les deux canaux</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-auto">
              <Link to="/generative-engine-optimization">
                Comprendre le GEO en détail
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Tableau comparatif */}
        <section className="border-t border-border py-14 md:py-16">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Ce qui diffère réellement, ligne par ligne
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              La troisième colonne est la plus importante : elle indique ce que les deux disciplines
              partagent, et donc ce qu’il est inutile de faire deux fois.
            </p>
            <div className="mt-6 -mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 pr-4 font-semibold text-foreground">Axe</th>
                    <th className="py-3 pr-4 font-semibold text-foreground">SEO (Google)</th>
                    <th className="py-3 pr-4 font-semibold text-foreground">GEO (moteurs IA)</th>
                    <th className="py-3 font-semibold text-foreground">Travail commun</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.axis} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-4 font-medium text-foreground">{row.axis}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.seo}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{row.geo}</td>
                      <td className="py-3 text-foreground/80">{row.shared}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Les oppositions et ce qu'elles coûtent */}
        <section className="border-t border-border py-14 md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Trois oppositions courantes, et ce qu’elles coûtent
            </h2>
            <div className="mt-8 space-y-8">
              {MYTHS.map((item) => (
                <article key={item.myth}>
                  <h3 className="text-lg font-medium text-foreground">{item.myth}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.reality}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Chantiers communs */}
        <section className="border-t border-border py-14 md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Le travail commun, par ordre d’effet
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun de ces cinq chantiers n’est propre au SEO ou au GEO. Les traiter dans cet ordre
              évite de payer deux fois la même optimisation.
            </p>
            <ol className="mt-8 space-y-6 list-none p-0">
              {SHARED_WORK.map((item, index) => (
                <li key={item.title} className="border-l border-border pl-4">
                  <h3 className="text-base font-medium text-foreground">
                    {index + 1}. {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Comment décider où investir */}
        <section className="border-t border-border py-14 md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Comment savoir où investir sur votre site
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-5">
                <Search className="h-5 w-5 text-foreground/70" />
                <h3 className="mt-3 text-base font-medium text-foreground">
                  Positions faibles sur Google
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  La priorité reste le SEO : accessibilité, structure, contenus manquants. Sans
                  indexation solide, le GEO n’a rien à citer.
                </p>
              </div>
              <div className="rounded-xl border border-border p-5">
                <Bot className="h-5 w-5 text-foreground/70" />
                <h3 className="mt-3 text-base font-medium text-foreground">
                  Bien classé, jamais cité
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Le manque est éditorial : peu de passages autonomes, pas de faits datés, pas de
                  source identifiable. C’est le cas typique où le GEO apporte le plus.
                </p>
              </div>
              <div className="rounded-xl border border-border p-5">
                <Layers className="h-5 w-5 text-foreground/70" />
                <h3 className="mt-3 text-base font-medium text-foreground">
                  Trafic en baisse, marque stable
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Une partie des recherches se conclut sans clic. Avant de conclure à une perte,
                  mesurez les citations : le canal a peut-être seulement changé.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Conversion */}
        <section className="border-t border-border py-14 md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Mesurer les deux dans un seul audit
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Crawlers analyse le site pour Google et pour les moteurs génératifs dans la même
              passe : accessibilité du HTML, structure, passages citables, données structurées,
              positions et taux de citation par requête. Vous obtenez une liste de correctifs
              ordonnée par effet, sans avoir à trancher entre les deux disciplines.
            </p>
            <ul className="mt-6 space-y-2 text-sm leading-relaxed text-muted-foreground list-none p-0">
              <li className="border-l border-border pl-3">
                Un diagnostic unique couvrant SEO technique et citabilité IA
              </li>
              <li className="border-l border-border pl-3">
                Les correctifs classés par gain attendu, pas par catégorie théorique
              </li>
              <li className="border-l border-border pl-3">
                La mesure des citations dans ChatGPT, Claude, Perplexity et Gemini
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm" className="w-auto">
                <Link to="/audit-geo-seo">Lancer l’audit SEO et GEO</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-auto">
                <Link to="/prix-audit-seo">Voir les tarifs</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border py-14 md:py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
              Questions fréquentes
            </h2>
            <SeoFaqList
              className="mt-6"
              items={GEO_VS_SEO_FAQ.map(([question, answer]) => ({ question, answer }))}
            />
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 pb-16">
          <SiloNav silo="geo" currentPath="/geo-vs-seo" />
        </div>
      </main>
      <Footer />
    </>
  );
}

export default memo(GeoVsSeoPage);
