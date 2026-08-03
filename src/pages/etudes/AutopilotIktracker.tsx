import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Breadcrumb } from '@/components/SEO/Breadcrumb';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

const SLUG = 'autopilot-parmenion-iktracker';
const CANONICAL = `https://crawlers.fr/etudes/${SLUG}`;
const PUBLISHED = '2026-08-02';

/**
 * Étude de cas E-E-A-T — données réelles extraites de la base Crawlers.fr :
 *  - parmenion_decision_log (cycles, actions CMS exécutées)
 *  - gsc_history_log (Google Search Console, propriété sc-domain:iktracker.fr)
 * Période GSC couverte : 9 mars 2026 → 1er juin 2026 (13 semaines complètes).
 */

// Semaines GSC réelles (clics / impressions / CTR % / position moyenne)
const WEEKS = [
  { w: '09/03', clicks: 82, impressions: 7234, ctr: 1.13, pos: 9.4, phase: 'Baseline' },
  { w: '16/03', clicks: 94, impressions: 8170, ctr: 1.15, pos: 8.8, phase: 'Baseline' },
  { w: '23/03', clicks: 96, impressions: 7287, ctr: 1.32, pos: 8.8, phase: 'Démarrage' },
  { w: '30/03', clicks: 66, impressions: 5291, ctr: 1.25, pos: 8.6, phase: 'Démarrage' },
  { w: '06/04', clicks: 277, impressions: 17455, ctr: 1.59, pos: 8.1, phase: 'Autopilot' },
  { w: '13/04', clicks: 279, impressions: 16893, ctr: 1.65, pos: 8.1, phase: 'Autopilot' },
  { w: '20/04', clicks: 146, impressions: 18785, ctr: 0.78, pos: 8.6, phase: 'Autopilot' },
  { w: '27/04', clicks: 101, impressions: 10160, ctr: 0.99, pos: 8.6, phase: 'Autopilot' },
  { w: '04/05', clicks: 56, impressions: 6903, ctr: 0.81, pos: 8.9, phase: 'Autopilot' },
  { w: '11/05', clicks: 63, impressions: 6202, ctr: 1.02, pos: 10.1, phase: 'Autopilot' },
  { w: '18/05', clicks: 65, impressions: 7190, ctr: 0.9, pos: 9.0, phase: 'Autopilot' },
  { w: '25/05', clicks: 79, impressions: 5988, ctr: 1.32, pos: 9.4, phase: 'Autopilot' },
  { w: '01/06', clicks: 88, impressions: 8155, ctr: 1.08, pos: 9.9, phase: 'Autopilot' },
];

// Requêtes en progression : position moyenne baseline (≤ 30/03) vs fin de période (≥ 11/05)
const QUERY_GAINS = [
  { q: 'application frais kilometrique gratuit', before: 39.0, after: 22.5 },
  { q: 'application indemnité kilométrique', before: 43.0, after: 37.0 },
  { q: 'barème ik 2026 électrique', before: 9.7, after: 5.0 },
  { q: 'ik', before: 10.8, after: 7.6 },
  { q: 'barème fiscal km 2026', before: 11.0, after: 9.0 },
  { q: 'barème frais kilométrique 2026', before: 11.3, after: 9.3 },
];

const FAQS = [
  {
    q: "Combien d'articles l'Autopilot a-t-il réellement publiés sur iktracker.fr ?",
    a: "927 actions de publication CMS ont été exécutées avec succès entre le 24 mars et le 2 août 2026, sur 289 cycles Autopilot et 5 742 actions journalisées au total. Chaque action correspond à une création ou une mise à jour de contenu validée par le garde sémantique avant envoi au CMS.",
  },
  {
    q: "Sur combien de requêtes iktracker.fr a-t-il progressé ?",
    a: "Sur les 20 requêtes présentes à la fois dans la fenêtre de référence (9–30 mars) et en fin de période (11 mai–1er juin), 9 ont gagné des places. La position moyenne de ce sous-ensemble passe de 15,22 à 12,92, soit un gain moyen de 2,3 places. Au total, 175 requêtes distinctes ont été observées sur les 13 semaines.",
  },
  {
    q: "Le pic d'avril est-il dû à l'Autopilot ou à la saisonnalité ?",
    a: "Aux deux, et nous ne prétendons pas isoler les effets. iktracker.fr traite du barème kilométrique : la campagne de déclaration de revenus française gonfle mécaniquement la demande en avril. L'Autopilot a produit les pages qui ont capté ce pic — les impressions passent de 6 995 à 17 455 par semaine — mais il n'a pas créé la demande.",
  },
  {
    q: "Pourquoi le trafic est-il retombé en mai ?",
    a: "Fin de la période fiscale. Les clics reviennent à 56–88 par semaine, soit le niveau de la baseline, alors que les impressions restent supérieures. C'est le signe d'un socle d'indexation élargi mais d'une intention saisonnière éteinte, pas d'une pénalité.",
  },
  {
    q: "D'où viennent les chiffres de cette étude ?",
    a: "Les volumes de publication proviennent du journal de décisions de l'Autopilot (table parmenion_decision_log). Les données de performance proviennent de l'API Google Search Console sur la propriété sc-domain:iktracker.fr, agrégées par semaine. Aucun chiffre n'est modélisé ni extrapolé.",
  },
  {
    q: "Peut-on reproduire ce résultat sur n'importe quel site ?",
    a: "Non sans conditions. iktracker.fr disposait déjà d'une propriété Search Console connectée, d'un pont CMS fonctionnel et d'une thématique à intention claire. Sur un site sans historique ni saisonnalité porteuse, l'Autopilot élargit d'abord la surface d'indexation ; les clics suivent plus lentement.",
  },
];

const maxClicks = Math.max(...WEEKS.map(w => w.clicks));

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: "Étude de cas Autopilot : 927 publications automatisées sur iktracker.fr",
  description: "Étude de cas Crawlers.fr avec chiffres Google Search Console réels : 927 publications automatisées par l'Autopilot Parménion, 9 requêtes en progression sur 20 suivies, +230 % de clics au pic.",
  datePublished: PUBLISHED,
  dateModified: PUBLISHED,
  author: { '@type': 'Person', name: 'Adrien de Volontat', url: 'https://crawlers.fr/auteur/adrien-de-volontat' },
  publisher: { '@type': 'Organization', name: 'Crawlers.fr', url: 'https://crawlers.fr' },
  mainEntityOfPage: CANONICAL,
  about: { '@type': 'Thing', name: 'Automatisation SEO éditoriale' },
};

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: "Performance Search Console iktracker.fr sous Autopilot — 13 semaines",
  description: "Clics, impressions, CTR et position moyenne hebdomadaires de iktracker.fr du 9 mars au 1er juin 2026, mis en regard du volume de publications automatisées par l'Autopilot Parménion.",
  creator: { '@type': 'Organization', name: 'Crawlers.fr' },
  datePublished: PUBLISHED,
  temporalCoverage: '2026-03-09/2026-06-01',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  url: CANONICAL,
  variableMeasured: ['Clics GSC', 'Impressions GSC', 'CTR (%)', 'Position moyenne', 'Publications CMS exécutées'],
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

export default function AutopilotIktracker() {
  useCanonicalHreflang(`/etudes/${SLUG}`);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Étude de cas : 927 publications SEO automatisées — Autopilot</title>
        <meta name="description" content="Chiffres Search Console réels : l'Autopilot Crawlers a exécuté 927 publications sur iktracker.fr, fait progresser 9 requêtes sur 20 et triplé les impressions au pic." />
        <meta property="og:title" content="Autopilot : 927 publications automatisées, 9 requêtes en progression" />
        <meta property="og:description" content="Étude de cas Crawlers.fr avec données Google Search Console brutes, méthodologie complète et limites assumées." />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(datasetJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>

      <Header />
      <Breadcrumb currentLabel="Étude de cas Autopilot" />

      <main className="mx-auto max-w-4xl px-4 py-10 md:py-16">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-foreground/60 mb-3">Étude de cas Crawlers.fr — Août 2026</p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
            Comment l'Autopilot a exécuté 927 publications sur iktracker.fr et fait progresser 9 requêtes
          </h1>
          <p className="text-lg text-foreground/80 leading-relaxed">
            Entre mars et août 2026, l'Autopilot Parménion a piloté seul la production éditoriale
            de <strong>iktracker.fr</strong> : 289 cycles, 5 742 actions journalisées,
            <strong> 927 publications CMS exécutées</strong>. Sur les 13 semaines couvertes par
            Google Search Console, les impressions hebdomadaires ont été multipliées par 2,5 au pic
            et 9 des 20 requêtes comparables ont gagné des places. Voici les chiffres bruts, la
            méthode, et ce que ces données ne prouvent pas.
          </p>
        </header>

        <blockquote className="citable-passage mb-12 border-l-2 border-border pl-5 text-base text-foreground/85 italic">
          Sur iktracker.fr, l'Autopilot Parménion de Crawlers.fr a exécuté 927 publications CMS
          en 289 cycles entre le 24 mars et le 2 août 2026. Les données Google Search Console
          montrent un passage de 84,5 clics hebdomadaires en moyenne sur la baseline à 279 clics
          au pic d'avril 2026, avec une position moyenne améliorée de 2,3 places sur les requêtes
          comparables.
        </blockquote>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Les chiffres clés</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold">927</div>
              <div className="text-sm text-foreground/70 mt-1">publications CMS exécutées</div>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold">289</div>
              <div className="text-sm text-foreground/70 mt-1">cycles Autopilot autonomes</div>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold">9 / 20</div>
              <div className="text-sm text-foreground/70 mt-1">requêtes comparables en progression</div>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="text-3xl font-bold">×2,5</div>
              <div className="text-sm text-foreground/70 mt-1">impressions hebdo au pic vs baseline</div>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Le point de départ</h2>
          <p className="leading-relaxed text-foreground/85 mb-4">
            iktracker.fr est un outil de suivi des indemnités kilométriques. Avant l'Autopilot,
            le site tournait à <strong>84,5 clics par semaine en moyenne</strong> (fenêtre de
            référence du 9 au 30 mars 2026) pour environ 6 995 impressions hebdomadaires et une
            position moyenne de 8,9. La thématique est claire mais férocement saisonnière : la
            demande sur « barème kilométrique » explose pendant la campagne de déclaration de
            revenus, puis s'effondre.
          </p>
          <p className="leading-relaxed text-foreground/85">
            L'enjeu n'était donc pas de créer de la demande, mais d'avoir assez de pages
            pertinentes, publiées assez tôt et suffisamment maillées pour capter le pic quand il
            arrive. C'est exactement le travail qu'on a confié à l'Autopilot.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ce que l'Autopilot a fait, concrètement</h2>

          <h3 className="text-xl font-semibold mt-6 mb-2">Un cycle = un diagnostic, une décision, une publication</h3>
          <p className="leading-relaxed text-foreground/85">
            Chaque cycle Parménion enchaîne quatre phases : audit multi-dimensionnel du site,
            prescription d'un objectif éditorial déterministe, rédaction via le pipeline en quatre
            étages (briefing, stratège, rédacteur, tonalisateur), puis publication via le pont
            CMS. 289 cycles ont été journalisés sur iktracker.fr, avec 5 742 actions au total.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">927 publications validées, pas 927 tentatives</h3>
          <p className="leading-relaxed text-foreground/85">
            Le chiffre de 927 correspond aux seules actions CMS passées au statut
            <em> completed</em>. Les contenus rejetés par le garde sémantique — ceux qui
            s'écartaient trop de l'identité du site — n'y figurent pas. Ce garde a bloqué des
            publications, y compris quand la similarité manquait d'un seul point de pourcentage.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">Rythme de production réel</h3>
          <div className="overflow-x-auto rounded-xl border border-border mt-4">
            <table className="w-full text-sm">
              <caption className="sr-only">Publications CMS exécutées par mois sur iktracker.fr</caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Mois</th>
                  <th scope="col" className="p-3 font-semibold text-right">Publications exécutées</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Mars 2026 (à partir du 24)', 5],
                  ['Avril 2026', 338],
                  ['Mai 2026', 341],
                  ['Juin 2026', 141],
                  ['Juillet 2026', 28],
                  ['Août 2026 (au 2)', 74],
                ].map(([m, n]) => (
                  <tr key={m as string} className="border-t border-border">
                    <td className="p-3 font-medium">{m}</td>
                    <td className="p-3 text-right font-semibold">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/60 mt-3">
            Source : journal de décisions de l'Autopilot, actions CMS au statut <em>completed</em>,
            domaine iktracker.fr. Le creux de juillet correspond à une série de délais dépassés
            sur le pipeline éditorial, corrigée depuis.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Les données Search Console, semaine par semaine</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Clics, impressions, CTR et position moyenne hebdomadaires de iktracker.fr du 9 mars au 1er juin 2026
              </caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Semaine</th>
                  <th scope="col" className="p-3 font-semibold">Phase</th>
                  <th scope="col" className="p-3 font-semibold text-right">Clics</th>
                  <th scope="col" className="p-3 font-semibold text-right">Impressions</th>
                  <th scope="col" className="p-3 font-semibold text-right">CTR</th>
                  <th scope="col" className="p-3 font-semibold text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {WEEKS.map((w) => (
                  <tr key={w.w} className="border-t border-border">
                    <td className="p-3 font-medium whitespace-nowrap">{w.w}</td>
                    <td className="p-3 text-foreground/70">{w.phase}</td>
                    <td className="p-3 text-right font-semibold">{w.clicks}</td>
                    <td className="p-3 text-right">{w.impressions.toLocaleString('fr-FR')}</td>
                    <td className="p-3 text-right">{w.ctr.toFixed(2)} %</td>
                    <td className="p-3 text-right">{w.pos.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/60 mt-3">
            Source : API Google Search Console, propriété <code>sc-domain:iktracker.fr</code>,
            agrégation hebdomadaire. 13 semaines complètes du 9 mars au 1er juin 2026.
          </p>

          <div className="mt-8 rounded-xl border border-border bg-card/30 p-5">
            <h3 className="text-base font-semibold mb-4">Clics hebdomadaires</h3>
            <ul className="space-y-2 list-none p-0 m-0">
              {WEEKS.map((w) => (
                <li key={w.w} className="flex items-center gap-3 text-xs">
                  <span className="w-12 shrink-0 text-foreground/70">{w.w}</span>
                  <span
                    className="h-3 rounded-sm border border-foreground/40 bg-foreground/15"
                    style={{ width: `${(w.clicks / maxClicks) * 100}%` }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{w.clicks}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Les requêtes qui ont progressé</h2>
          <p className="leading-relaxed text-foreground/85 mb-4">
            Sur les 175 requêtes distinctes observées, 20 sont présentes à la fois dans la fenêtre
            de référence (9–30 mars) et en fin de période (11 mai–1er juin). Neuf d'entre elles
            gagnent des places, et la position moyenne de ce sous-ensemble passe de
            <strong> 15,22 à 12,92</strong>. Voici les gains les plus nets.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Requêtes iktracker.fr en progression de position</caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Requête</th>
                  <th scope="col" className="p-3 font-semibold text-right">Avant</th>
                  <th scope="col" className="p-3 font-semibold text-right">Après</th>
                  <th scope="col" className="p-3 font-semibold text-right">Gain</th>
                </tr>
              </thead>
              <tbody>
                {QUERY_GAINS.map((g) => (
                  <tr key={g.q} className="border-t border-border">
                    <td className="p-3 font-medium">{g.q}</td>
                    <td className="p-3 text-right">{g.before.toFixed(1)}</td>
                    <td className="p-3 text-right">{g.after.toFixed(1)}</td>
                    <td className="p-3 text-right font-semibold">
                      +{(g.before - g.after).toFixed(1)} places
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/60 mt-3">
            Positions moyennes Search Console. « application frais kilometrique gratuit » passe de
            la quatrième à la troisième page de résultats — encore insuffisant pour convertir,
            mais c'est la trajectoire qui compte à ce stade.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">De la visibilité aux inscriptions réelles</h2>
          <p className="leading-relaxed text-foreground/85 mb-4">
            Les positions ne paient pas les factures. Voici donc les chiffres produit, extraits de
            l'administration d'iktracker.fr au 2 août 2026 : <strong>372 comptes créés</strong>,
            dont 359 sur l'année 2026, et 31 sur les 30 derniers jours. Sur la même fenêtre,
            <strong> 56 utilisateurs ont saisi au moins un trajet</strong> (36 sur 7 jours), soit un
            taux d'activité de 15,1 %.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['372', 'comptes créés au total'],
              ['359', 'inscriptions sur 2026'],
              ['56', 'utilisateurs actifs sur 30 jours'],
              ['15,1 %', "taux d'activité des comptes"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-border bg-card/40 p-5">
                <div className="text-3xl font-bold">{v}</div>
                <div className="text-sm text-foreground/70 mt-1">{l}</div>
              </div>
            ))}
          </div>

          <h3 className="text-xl font-semibold mt-8 mb-3">Inscriptions mensuelles</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Nouveaux comptes iktracker.fr par mois en 2026</caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Mois</th>
                  <th scope="col" className="p-3 font-semibold text-right">Nouveaux comptes</th>
                  <th scope="col" className="p-3 font-semibold text-right">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {SIGNUPS.map((s) => (
                  <tr key={s.m} className="border-t border-border">
                    <td className="p-3 font-medium whitespace-nowrap">{s.m}</td>
                    <td className="p-3 text-right font-semibold">{s.n}</td>
                    <td className="p-3 text-right text-foreground/70">{s.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/60 mt-3">
            Source : table des comptes iktracker.fr, extraction du 2 août 2026 (UTC). Le pic d'avril
            (81 inscriptions) suit exactement le pic Search Console, et le repli de juillet
            (−52 %) suit la fin de la campagne fiscale.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Le résultat le plus contre-intuitif : ChatGPT devant Google</h2>
          <p className="leading-relaxed text-foreground/85 mb-4">
            À l'inscription, iktracker.fr demande à l'utilisateur comment il a découvert le service.
            Sur <strong>157 réponses exploitables</strong> (229 collectées, 72 « skip »),
            <strong> ChatGPT arrive premier avec 44,6 %</strong>, devant Google à 41,4 %.
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Origine déclarée par les utilisateurs à l'inscription</caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Origine déclarée</th>
                  <th scope="col" className="p-3 font-semibold text-right">Réponses</th>
                  <th scope="col" className="p-3 font-semibold text-right">Part</th>
                </tr>
              </thead>
              <tbody>
                {DECLARED_ORIGIN.map((o) => (
                  <tr key={o.src} className="border-t border-border">
                    <td className="p-3 font-medium">{o.src}</td>
                    <td className="p-3 text-right font-semibold">{o.n}</td>
                    <td className="p-3 text-right">{o.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-semibold mt-8 mb-2">Pourquoi les statistiques web affichent 1 %</h3>
          <p className="leading-relaxed text-foreground/85 mb-4">
            Mesuré au referrer HTTP, le canal « assistants IA » ne pèse que <strong>1,0 %</strong>
            des sessions (33 sur 3 223), tandis que « direct / interne » en concentre 70,7 %.
            L'explication est technique : ChatGPT n'envoie pas d'en-tête <code>Referer</code>
            exploitable — l'utilisateur copie l'URL ou clique depuis une réponse sans référent. Ces
            visites basculent en trafic direct.
          </p>
          <blockquote className="citable-passage mb-4 border-l-2 border-border pl-5 text-base text-foreground/85 italic">
            Sur iktracker.fr, 44,6 % des nouveaux inscrits déclarent avoir découvert le service via
            ChatGPT, contre 41,4 % via Google, alors que les statistiques de referrer HTTP
            n'attribuent que 1,0 % des sessions aux assistants IA. L'écart entre 1 % mesuré et
            44,6 % déclaré démontre que le trafic issu des assistants est massivement comptabilisé
            comme trafic direct.
          </blockquote>
          <h3 className="text-xl font-semibold mt-8 mb-3">Part de ChatGPT dans les origines déclarées, mois par mois</h3>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Évolution mensuelle ChatGPT vs Google dans les origines déclarées</caption>
              <thead className="bg-card/60 text-left">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Mois</th>
                  <th scope="col" className="p-3 font-semibold text-right">ChatGPT</th>
                  <th scope="col" className="p-3 font-semibold text-right">Google</th>
                  <th scope="col" className="p-3 font-semibold text-right">Part ChatGPT</th>
                </tr>
              </thead>
              <tbody>
                {ORIGIN_MONTHLY.map((o) => (
                  <tr key={o.m} className="border-t border-border">
                    <td className="p-3 font-medium whitespace-nowrap">{o.m}</td>
                    <td className="p-3 text-right font-semibold">{o.chatgpt}</td>
                    <td className="p-3 text-right">{o.google}</td>
                    <td className="p-3 text-right">{o.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/60 mt-3">
            Le canal IA se maintient au-dessus de 40 % depuis mai, et progresse même en juillet
            (53,8 %) alors que le trafic global baissait. Source : réponses à la question d'origine
            posée à l'inscription, hors « skip ».
          </p>
          <p className="leading-relaxed text-foreground/85 mt-4">
            C'est la justification opérationnelle du travail GEO mené en parallèle de l'Autopilot :
            fichier <code>llms.txt</code>, <code>knowledge.json</code>, désambiguïsation d'entité,
            pré-rendu pour les robots et JSON-LD structuré. Le contenu produit n'a pas seulement
            servi à ranker sur Google, il a servi de matière citable aux assistants.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Le funnel d'inscription</h2>
          <p className="leading-relaxed text-foreground/85">
            Le suivi de la page d'authentification n'a démarré que le 12 juillet 2026. Sur les trois
            semaines mesurées : <strong>398 vues</strong> de <code>/auth</code> pour 390 sessions
            uniques, 21 soumissions de formulaire, 24 démarrages OAuth Google et
            <strong> 19 inscriptions abouties</strong>, soit 4,8 % de conversion vue → compte, avec
            2 erreurs d'inscription. La page dédiée <code>/signup</code> ajoute 35 vues. Ce taux est
            à réévaluer sur un mois plein, et sur une période hors creux estival.
          </p>
        </section>


        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Méthodologie</h2>

          <h3 className="text-xl font-semibold mt-6 mb-2">1. Volumes de publication</h3>
          <p className="leading-relaxed text-foreground/85">
            Extraits du journal de décisions de l'Autopilot, filtrés sur le domaine iktracker.fr,
            le type d'action <em>cms</em> et le statut <em>completed</em>. Les actions en
            <em> degraded</em>, <em>skipped_stale</em> ou <em>dry_run</em> sont exclues du compte.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">2. Données de performance</h3>
          <p className="leading-relaxed text-foreground/85">
            Récupérées via l'API Google Search Console sur la propriété domaine, puis stockées en
            agrégats hebdomadaires (clics, impressions, CTR, position moyenne, top 30 requêtes).
            Aucun lissage, aucune extrapolation.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">3. Comparaison de positions</h3>
          <p className="leading-relaxed text-foreground/85">
            Fenêtre de référence : semaines du 9, 16, 23 et 30 mars 2026. Fenêtre finale :
            semaines du 11, 18, 25 mai et 1er juin 2026. Pour chaque requête présente dans les
            deux fenêtres, on retient la meilleure position observée, puis on compare. Les
            requêtes apparues ou disparues en cours de route ne sont pas comptées comme des gains.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">4. Ce qu'on n'a pas fait</h3>
          <p className="leading-relaxed text-foreground/85">
            Pas de groupe témoin, pas de test A/B, pas de désaisonnalisation. Cette étude décrit
            une trajectoire observée, pas une causalité démontrée.
          </p>
        </section>

        <section className="mb-12">
          <div className="rounded-xl border border-border bg-card/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-foreground/70" />
              <h2 className="text-2xl md:text-3xl font-bold m-0">Limites assumées</h2>
            </div>
            <ul className="list-disc pl-6 space-y-2 text-foreground/85">
              <li>
                <strong>Saisonnalité dominante.</strong> Le pic d'avril coïncide avec la campagne
                de déclaration de revenus française. Une part importante de la hausse serait
                survenue sans l'Autopilot.
              </li>
              <li>
                <strong>Absence de contrefactuel.</strong> Sans groupe témoin, on ne peut pas
                attribuer une part chiffrée du résultat à l'automatisation.
              </li>
              <li>
                <strong>Retour à la baseline en mai.</strong> Les clics redescendent à 56–88 par
                semaine. Le socle d'impressions reste plus large, mais l'effet sur les clics n'est
                pas permanent.
              </li>
              <li>
                <strong>Fenêtre GSC arrêtée au 1er juin 2026.</strong> Les publications de
                juin à août ne sont pas encore couvertes par les données de performance ici
                présentées.
              </li>
              <li>
                <strong>Volume n'est pas qualité.</strong> 927 publications incluent des mises à
                jour de pages existantes, pas uniquement des créations. Le CTR se dégrade sur
                certaines semaines à fort volume d'impressions — signe de requêtes captées mais
                mal servies.
              </li>
              <li>
                <strong>L'origine déclarée reste déclarative.</strong> Les 44,6 % attribués à
                ChatGPT proviennent d'une question posée à l'inscription, avec 31,4 % de non-réponses
                (72 « skip » sur 229). C'est la meilleure mesure disponible du canal IA, pas une
                mesure serveur.
              </li>
              <li>
                <strong>Attribution non chaînée.</strong> On ne peut pas relier une inscription
                précise à un article précis publié par l'Autopilot : le lien entre production
                éditoriale, citation par un assistant et création de compte reste corrélatif.
              </li>

            </ul>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ce qu'on en retient</h2>

          <h3 className="text-xl font-semibold mt-6 mb-2">L'automatisation gagne sur la préparation, pas sur le miracle</h3>
          <p className="leading-relaxed text-foreground/85">
            Le mérite de l'Autopilot sur ce cas n'est pas d'avoir créé un pic, c'est d'avoir
            produit assez de pages pertinentes avant le pic pour le capter. Les impressions
            passent de 6 995 à 17 455 par semaine : la surface d'indexation a bel et bien grandi.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">Le garde sémantique est le vrai différenciateur</h3>
          <p className="leading-relaxed text-foreground/85">
            Publier 927 fois sans dériver hors sujet suppose un filtre. Sans garde sémantique,
            une production automatisée à ce rythme dilue le site et finit par lui nuire.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">Le prochain chantier est le CTR</h3>
          <p className="leading-relaxed text-foreground/85">
            Un CTR à 0,78 % sur 18 785 impressions signale des positions atteintes mais des
            titres et métadonnées insuffisamment convaincants. C'est le levier suivant, et il ne
            demande pas de nouveau contenu.
          </p>
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
              <Link to="/etudes/cout-reponse-chatgpt-vs-google-ads" className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors">
                <span className="font-medium">Coût ChatGPT vs Google Ads</span>
                <ArrowRight className="h-4 w-4 text-foreground/60" />
              </Link>
            </li>
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
              <Link to="/auteur/adrien-de-volontat" className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-4 hover:border-foreground/40 transition-colors">
                <span className="font-medium">L'auteur de cette étude</span>
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
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Et sur votre site, que ferait l'Autopilot ?</h2>
          <p className="text-foreground/80 mb-6">
            Lancez un audit Crawlers.fr pour voir quelles pages manquent, quelles requêtes vous
            êtes à portée de gagner, et ce qu'un pilote éditorial automatisé produirait en
            priorité.
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
