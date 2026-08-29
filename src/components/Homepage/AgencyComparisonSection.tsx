import { Link } from '@/lib/router-compat';
import { ArrowRight, Check, X } from 'lucide-react';

interface ComparisonRow {
  criterion: string;
  agency: string;
  crawlers: string;
}

const ROWS: ComparisonRow[] = [
  {
    criterion: 'Coût mensuel',
    agency: '2 000 € à 9 000 €',
    crawlers: 'à partir de 29 €/mois',
  },
  {
    criterion: 'Délai du premier audit',
    agency: '2 à 4 semaines de cadrage',
    crawlers: 'Immédiat, en quelques minutes',
  },
  {
    criterion: 'Crawl et suivi continu',
    agency: 'Prestation ponctuelle, refacturée à chaque intervention',
    crawlers: 'Crawl quotidien automatique, 5 000 pages/mois',
  },
  {
    criterion: 'Rapports',
    agency: 'PDF envoyé par e-mail, format figé',
    crawlers: 'Rapports SSR en ligne, marque blanche, exportables',
  },
  {
    criterion: 'Visibilité dans les IA (GEO)',
    agency: 'Rarement couvert',
    crawlers: 'Score GEO, visibilité LLM et agents IA inclus',
  },
  {
    criterion: 'Maillage interne',
    agency: 'Étude manuelle, facturée au forfait',
    crawlers: 'Cocoon : graphe 3D, maillage auto-optimisé',
  },
  {
    criterion: 'Correctifs',
    agency: 'Développements à la charge du client',
    crawlers: 'Correctifs auto-déployés selon plan',
  },
  {
    criterion: 'Engagement contractuel',
    agency: 'Contrat 6 à 12 mois',
    crawlers: 'Sans engagement, essai gratuit sans carte bancaire',
  },
];

const AgencyComparisonSection = () => (
  <section className="relative py-14 sm:py-20 cv-auto" aria-labelledby="vs-agence-title">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-violet)/0.05),transparent_65%)]" />
    <div className="relative mx-auto max-w-4xl px-4">
      <header className="mb-8 text-center">
        <h2 id="vs-agence-title" className="mb-3 t-h2 font-extrabold tracking-tight text-foreground">
          Agence SEO ou Crawlers : le comparatif
        </h2>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Une agence SEO traditionnelle mobilise des consultants facturés au forfait.
          Crawlers automatise l'audit, le crawl, le maillage et la correction — pour le prix d'un déjeuner par jour.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40 shadow-lg">
        <table className="w-full min-w-[28rem] border-collapse text-left text-[13px] sm:text-base">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">Critère</th>
              <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">Agence SEO</th>
              <th scope="col" className="px-4 py-3 font-extrabold text-foreground">
                <span className="bg-gradient-to-r from-violet-400 to-amber-400 bg-clip-text text-transparent">Crawlers</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.criterion} className={i % 2 === 1 ? 'bg-muted/20' : undefined}>
                <th scope="row" className="px-4 py-3 align-top font-semibold text-foreground">
                  {row.criterion}
                </th>
                <td className="px-4 py-3 align-top text-muted-foreground">
                  <span className="flex items-start gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                    {row.agency}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-foreground">
                  <span className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                    {row.crawlers}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        À partir de 29 €/mois, sans engagement — essai gratuit sans carte bancaire.
      </p>
      <div className="mt-6 flex justify-center">
        <Link to="/pro-agency">
          <span className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:border-amber-400 hover:text-amber-300">
            Voir les plans
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </div>
  </section>
);

export default AgencyComparisonSection;
