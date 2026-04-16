import { useLanguage } from '@/contexts/LanguageContext';

const painPoints = [
  {
    title: 'Données SERP faussées',
    desc: 'L\'analyse de la SERP est de moins en moins fiable : Google personnalise, filtre et brouille les résultats. ',
  },
  {
    title: 'Temps perdu en vérifications',
    desc: 'Export CSV, recroisement manuel, vérification des positions une par une… ',
  },
  {
    title: 'Recommandations génériques',
    desc: 'Les mêmes checklists pour un e-commerce à 50 000 pages et un site vitrine de 12 pages. ',
  },
];

export const PainPointsSection = () => {
  const { language } = useLanguage();

  if (language !== 'fr') return null;

  return (
    <section className="relative pt-20 pb-14 sm:py-20 font-medium shadow-none opacity-100 text-secondary">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="mb-10 text-center">
          <span className="mb-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider border-primary/20 text-destructive bg-secondary-foreground">
            Freelances / Agences
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            On le sait : les outils SEO classiques galèrent
          </h2>
        </div>

        {/* Cards */}
        <div className="mb-10 grid gap-6 sm:grid-cols-3">
          {painPoints.map((p, i) => (
            <div
              key={i}
              className="group rounded-xl border-none border-destructive/15 bg-card/60 p-6 transition-colors hover:border-destructive/30 px-[18px] py-[10px]"
            >
              <h3 className="mb-2 text-base font-bold text-foreground">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Conclusion */}
        <div className="mx-auto max-w-3xl rounded-xl px-6 py-6 text-center font-medium border-primary/20 dark:border-violet-600 dark:border-dashed bg-popover border-0">
          <span className="block mb-3 text-sm font-bold text-primary-foreground">L'approche Crawlers</span>
          <p className="text-sm leading-relaxed text-muted-foreground">
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
