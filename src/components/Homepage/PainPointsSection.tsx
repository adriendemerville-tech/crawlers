import { AlertTriangle, Database, Clock, Copy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const painPoints = [
  {
    icon: AlertTriangle,
    title: 'Données SERP faussées',
    desc: 'L\'analyse de la SERP est de moins en moins fiable : Google personnalise, filtre et brouille les résultats. Les outils qui s\'y fient vous donnent une vision déformée de votre visibilité réelle.',
  },
  {
    icon: Clock,
    title: 'Temps perdu en vérifications',
    desc: 'Export CSV, recroisement manuel, vérification des positions une par une… Vous passez plus de temps à valider les données qu\'à agir dessus.',
  },
  {
    icon: Copy,
    title: 'Recommandations génériques',
    desc: 'Les mêmes checklists pour un e-commerce à 50 000 pages et un site vitrine de 12 pages. Aucune contextualisation, aucune priorisation business.',
  },
];

export const PainPointsSection = () => {
  const { language } = useLanguage();

  if (language !== 'fr') return null;

  return (
    <section className="relative border-b border-border bg-gradient-to-b from-destructive/5 via-background to-background py-14 sm:py-20">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="mb-10 text-center">
          <span className="mb-3 inline-block rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
            Freelances / Agences
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Les outils SEO classiques vous mentent
          </h2>
        </div>

        {/* Cards */}
        <div className="mb-10 grid gap-6 sm:grid-cols-3">
          {painPoints.map((p, i) => (
            <div
              key={i}
              className="group rounded-xl border border-destructive/15 bg-card/60 p-6 transition-colors hover:border-destructive/30"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <p.icon className="h-5 w-5 text-secondary" />
              </div>
              <h3 className="mb-2 text-base font-bold text-foreground">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Conclusion */}
        <div className="mx-auto max-w-3xl rounded-xl border border-primary/20 bg-primary/5 px-6 py-5 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-violet-700">
            <Database className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-violet-600">L'approche Crawlers</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            L'analyse de la SERP est de moins en moins fiable — les contre-mesures de Google piègent les outils de crawl classiques.{' '}
            <strong className="text-foreground">
              Crawlers base ses recommandations sur les données concrètes de vos sites et de leurs audiences
            </strong>{' '}
            : GSC, GA4, logs serveur, signaux E-E-A-T et comportements utilisateurs réels.
          </p>
        </div>
      </div>
    </section>
  );
};
