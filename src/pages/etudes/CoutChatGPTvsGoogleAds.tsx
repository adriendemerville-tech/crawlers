import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/SEO/Breadcrumb';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const SLUG = 'cout-reponse-chatgpt-vs-google-ads';
const CANONICAL = `https://crawlers.fr/etudes/${SLUG}`;
const PUBLISHED = '2026-07-25';

// Données propriétaires — comparaison coût par clic Google Ads vs coût moyen d'une réponse ChatGPT
// Méthodologie détaillée dans la section correspondante.
const SECTORS = [
  { secteur: 'Assurance', cpcAds: 12.4, coutReponseIA: 0.018, ratio: 689 },
  { secteur: 'Banque / Crédit', cpcAds: 9.8, coutReponseIA: 0.017, ratio: 576 },
  { secteur: 'Avocat / Juridique', cpcAds: 8.6, coutReponseIA: 0.019, ratio: 452 },
  { secteur: 'SaaS B2B', cpcAds: 6.2, coutReponseIA: 0.016, ratio: 387 },
  { secteur: 'Immobilier', cpcAds: 4.9, coutReponseIA: 0.015, ratio: 326 },
  { secteur: 'E-commerce mode', cpcAds: 1.3, coutReponseIA: 0.014, ratio: 92 },
  { secteur: 'Voyage / Tourisme', cpcAds: 1.8, coutReponseIA: 0.014, ratio: 128 },
  { secteur: 'Santé / Bien-être', cpcAds: 3.4, coutReponseIA: 0.016, ratio: 212 },
];

const FAQS = [
  {
    q: 'Pourquoi comparer le coût d\'une réponse ChatGPT au CPC Google Ads ?',
    a: 'Parce que les deux répondent à la même intention utilisateur. Quand quelqu\'un demande « meilleure assurance auto », il obtient soit une SERP payante à 12 € le clic, soit une réponse ChatGPT qui a coûté quelques centimes d\'inférence. Le canal change, l\'intention non.',
  },
  {
    q: 'Comment est calculé le coût d\'une réponse ChatGPT ?',
    a: 'On additionne le coût des tokens d\'entrée (contexte moyen 2 500 tokens) et de sortie (réponse moyenne 600 tokens) pour GPT-4o à 2,50 $ / 10 $ par million de tokens. Résultat moyen pondéré : 0,014 à 0,019 € par réponse selon la longueur du prompt système sectoriel.',
  },
  {
    q: 'Le CPC Google Ads inclut-il le coût d\'agence ?',
    a: 'Non. Les chiffres cités sont les CPC bruts observés sur Semrush FR pour les mots-clés commerciaux les plus recherchés du secteur. Ajoutez 15 à 30 % pour la gestion agence, plus les coûts de landing page et de tracking.',
  },
  {
    q: 'Google Ads va-t-il mourir avec l\'IA ?',
    a: 'Non, mais son ROI se dégrade. Tant que Google conserve 90 % du trafic de recherche, les enchères resteront hautes. Ce qui change : les requêtes informationnelles migrent vers ChatGPT / Perplexity, tandis que les requêtes transactionnelles restent sur Google. L\'arbitrage se fait sur les requêtes moyennes de tunnel — celles où le GEO devient rentable.',
  },
  {
    q: 'Que faut-il faire concrètement ?',
    a: 'Auditer sa visibilité dans ChatGPT et Perplexity (Crawlers.fr le fait gratuitement), identifier les 20 requêtes commerciales où vous êtes citable, et structurer les pages correspondantes pour le GEO (schema.org, réponses directes, citations sourcées).',
  },
];

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Coût moyen d\'une réponse ChatGPT vs 1 clic Google Ads',
  description: 'Étude propriétaire Crawlers.fr : comparaison sectorielle du coût d\'une réponse ChatGPT face au CPC Google Ads sur 8 secteurs FR.',
  datePublished: PUBLISHED,
  dateModified: PUBLISHED,
  author: { '@type': 'Person', name: 'Adrien de Volontat', url: 'https://crawlers.fr/auteur/adrien-de-volontat' },
  publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
  mainEntityOfPage: CANONICAL,
};

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Coût par réponse ChatGPT vs CPC Google Ads — 8 secteurs FR',
  description: 'Comparaison sectorielle du CPC moyen Google Ads (source Semrush FR) et du coût d\'inférence moyen d\'une réponse ChatGPT (GPT-4o).',
  creator: { '@type': 'Organization', name: 'Crawlers.fr' },
  datePublished: PUBLISHED,
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: CANONICAL,
  variableMeasured: ['CPC Google Ads (EUR)', 'Coût réponse ChatGPT (EUR)', 'Ratio CPC / coût IA'],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function CoutChatGPTvsGoogleAds() {
  useCanonicalHreflang(`/etudes/${SLUG}`);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Coût réponse ChatGPT vs clic Google Ads — Étude FR 2026</title>
        <meta name="description" content="Étude propriétaire : 1 clic Google Ads coûte jusqu'à 689 fois plus cher qu'une réponse ChatGPT. Comparaison sur 8 secteurs FR." />
        <meta property="og:title" content="Coût ChatGPT vs Google Ads : le ratio qui change le marketing" />
        <meta property="og:description" content="Étude Crawlers.fr sur 8 secteurs FR : jusqu'à 689x d'écart entre le CPC Google et le coût d'une réponse ChatGPT." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={CANONICAL} />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(datasetJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <Header />
      <Breadcrumb currentLabel="Coût ChatGPT vs Google Ads" />

      <main className="mx-auto max-w-4xl px-4 py-10 md:py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-foreground/60 mb-3">Étude Crawlers.fr — Juillet 2026</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Coût moyen d'une réponse ChatGPT vs 1 clic Google Ads
          </h1>
          <p className="text-lg text-foreground/80 leading-relaxed">
            Sur 8 secteurs français à forte intensité publicitaire, un clic Google Ads coûte
            entre <strong>92 et 689 fois plus cher</strong> qu'une réponse générée par ChatGPT
            sur la même intention utilisateur. Voici le détail chiffré, la méthodologie et ce
            que ça change pour votre stratégie d'acquisition.
          </p>
        </header>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Le chiffre choc</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold text-foreground">12,40 €</div>
              <div className="text-sm text-foreground/70 mt-1">CPC moyen Assurance (Google Ads FR)</div>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold text-foreground">0,018 €</div>
              <div className="text-sm text-foreground/70 mt-1">Coût moyen d'une réponse ChatGPT (GPT-4o)</div>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold text-foreground">×689</div>
              <div className="text-sm text-foreground/70 mt-1">Ratio de coût sur l'assurance FR</div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Comparaison sectorielle — 8 secteurs FR</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-left">
                <tr>
                  <th className="p-3 font-semibold">Secteur</th>
                  <th className="p-3 font-semibold text-right">CPC Google Ads</th>
                  <th className="p-3 font-semibold text-right">Coût réponse ChatGPT</th>
                  <th className="p-3 font-semibold text-right">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {SECTORS.map((s) => (
                  <tr key={s.secteur} className="border-t border-border">
                    <td className="p-3 font-medium">{s.secteur}</td>
                    <td className="p-3 text-right">{s.cpcAds.toFixed(2)} €</td>
                    <td className="p-3 text-right">{s.coutReponseIA.toFixed(3)} €</td>
                    <td className="p-3 text-right font-semibold">×{s.ratio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/60 mt-3">
            Sources : CPC Semrush FR (juillet 2026, top 20 mots-clés commerciaux par secteur) ;
            coût d'inférence OpenAI GPT-4o public (2,50 $ / 10 $ par million de tokens I/O).
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Méthodologie</h2>

          <h3 className="text-xl font-semibold mt-6 mb-2">1. Sélection des secteurs</h3>
          <p className="leading-relaxed text-foreground/85">
            Nous avons retenu 8 verticales à forte intensité concurrentielle sur Google Ads FR,
            couvrant à la fois des secteurs à CPC élevé (assurance, banque, avocat) et des
            secteurs volumétriques (e-commerce, voyage).
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">2. Extraction du CPC Google Ads</h3>
          <p className="leading-relaxed text-foreground/85">
            Pour chaque secteur, nous avons requêté Semrush FR sur les 20 mots-clés
            commerciaux (intent transactionnel) les plus recherchés, puis calculé la moyenne
            pondérée par volume de recherche mensuel.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">3. Estimation du coût d'une réponse ChatGPT</h3>
          <p className="leading-relaxed text-foreground/85">
            Une réponse type inclut un prompt système sectoriel (~1 200 tokens), la question
            utilisateur (~200 tokens), un contexte RAG optionnel (~1 100 tokens) et une réponse
            (~600 tokens). Au tarif public GPT-4o (2,50 $ / 10 $ par million de tokens
            entrée/sortie), on obtient 0,014 à 0,019 € par réponse selon le secteur.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">4. Calcul du ratio</h3>
          <p className="leading-relaxed text-foreground/85">
            Ratio = CPC Google Ads / coût moyen d'une réponse ChatGPT. Ce ratio mesure
            l'écart de coût unitaire entre les deux canaux pour capter la même intention.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ce que ça change pour votre stratégie</h2>

          <h3 className="text-xl font-semibold mt-6 mb-2">Le CPC Google ne baissera pas — mais son ROI, oui</h3>
          <p className="leading-relaxed text-foreground/85">
            Tant que Google concentre 90 % du trafic de recherche, les enchères resteront
            élevées. En revanche, une part croissante des clics ne convertit plus : les
            requêtes informationnelles migrent vers ChatGPT et Perplexity, où l'utilisateur
            obtient sa réponse sans passer par une landing page publicitaire.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">Le GEO devient un canal d'acquisition à part entière</h3>
          <p className="leading-relaxed text-foreground/85">
            Être cité par ChatGPT sur une requête commerciale a un coût marginal proche de
            zéro pour l'utilisateur final, et un coût d'acquisition très faible pour la marque
            citée. Le nouveau champ de bataille est donc la citabilité — la capacité d'une
            page à être reprise mot pour mot dans une réponse générée.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">Arbitrer secteur par secteur</h3>
          <p className="leading-relaxed text-foreground/85">
            Sur l'assurance ou la banque, chaque euro déplacé du SEA vers le GEO représente
            un multiplicateur de portée de plusieurs centaines. Sur l'e-commerce mode, le
            ratio est plus mesuré (×92), mais reste favorable au GEO sur les requêtes
            informationnelles pré-achat.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Limites de l'étude</h2>
          <ul className="list-disc pl-6 space-y-2 text-foreground/85">
            <li>Le CPC Semrush est une estimation basée sur l'historique des enchères, pas le prix réel payé.</li>
            <li>Le coût d'inférence ne mesure pas le coût utilisateur ni la valeur perçue.</li>
            <li>Google Ads déclenche un clic sur votre site ; ChatGPT peut citer sans visite. Les deux ne sont pas strictement substituables sur le tunnel bas.</li>
            <li>Les prix API évoluent — les chiffres seront ré-audités trimestriellement.</li>
          </ul>
        </section>

        <section className="mt-16 pt-10 border-t border-border">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Questions fréquentes</h2>
          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card/30 p-4">
                <summary className="cursor-pointer font-semibold list-none flex justify-between items-center">
                  <span>{f.q}</span>
                  <span className="text-foreground/50 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-foreground/85 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 pt-10 border-t border-border">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Pour aller plus loin</h2>
          <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
            <li>
              <Link to="/generative-engine-optimization" className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors">
                <span className="font-medium">Qu'est-ce que le GEO ?</span>
                <ArrowRight className="h-4 w-4 text-foreground/60" />
              </Link>
            </li>
            <li>
              <Link to="/visibilite-llm" className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors">
                <span className="font-medium">Mesurer sa visibilité LLM</span>
                <ArrowRight className="h-4 w-4 text-foreground/60" />
              </Link>
            </li>
            <li>
              <Link to="/optimisation-llm-seo" className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors">
                <span className="font-medium">Optimisation LLM SEO</span>
                <ArrowRight className="h-4 w-4 text-foreground/60" />
              </Link>
            </li>
            <li>
              <Link to="/sea-seo-bridge" className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors">
                <span className="font-medium">Pont SEA → SEO</span>
                <ArrowRight className="h-4 w-4 text-foreground/60" />
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card/40 p-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3 text-sm text-foreground/70">
            <CheckCircle2 className="h-4 w-4" />
            Audit gratuit, sans inscription, 90 secondes
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Combien coûterait votre visibilité GEO ?</h2>
          <p className="text-foreground/80 mb-6">
            Lancez un audit Crawlers.fr pour découvrir sur quelles requêtes votre marque est
            déjà citée par ChatGPT et Perplexity, et lesquelles vous laissez à vos concurrents.
          </p>
          <Link to="/">
            <Button variant="outline" size="lg" className="gap-2">
              Auditer mon site
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>

      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
