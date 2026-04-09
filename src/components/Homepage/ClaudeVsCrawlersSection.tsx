import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, X, Check, Zap, AlertTriangle, Bot, Wrench } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

function ClaudeVsCrawlersSectionComponent() {
  const { language } = useLanguage();

  const comparisons = language === 'fr' ? [
    { claude: 'Plafonne vos requêtes sans prévenir', crawlers: 'Travaillez sans limites artificielles', icon: AlertTriangle },
    { claude: 'Nécessite de maîtriser les automations', crawlers: 'Intégrations préconfigurées, zéro setup', icon: Wrench },
    { claude: 'Déduit le SEO depuis un LLM', crawlers: 'Crawle réellement vos pages', icon: Bot },
    { claude: 'Un cerveau sans bras ni jambes', crawlers: 'Diagnostic + code correctif en 1 clic', icon: Zap },
  ] : language === 'es' ? [
    { claude: 'Limita sus solicitudes sin aviso', crawlers: 'Trabaje sin límites artificiales', icon: AlertTriangle },
    { claude: 'Requiere dominar las automatizaciones', crawlers: 'Integraciones preconfiguradas, cero setup', icon: Wrench },
    { claude: 'Deduce el SEO desde un LLM', crawlers: 'Rastrea realmente sus páginas', icon: Bot },
    { claude: 'Un cerebro sin brazos ni piernas', crawlers: 'Diagnóstico + código correctivo en 1 clic', icon: Zap },
  ] : [
    { claude: 'Throttles your requests without warning', crawlers: 'Work without artificial limits', icon: AlertTriangle },
    { claude: 'Requires mastering automations', crawlers: 'Pre-configured integrations, zero setup', icon: Wrench },
    { claude: 'Deduces SEO from an LLM', crawlers: 'Actually crawls your pages', icon: Bot },
    { claude: 'A brain without arms or legs', crawlers: 'Diagnosis + corrective code in 1 click', icon: Zap },
  ];

  return (
    <section className="py-16 md:py-24 border-y border-border bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <span className="inline-flex items-center gap-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            {language === 'fr' ? 'Comparatif' : language === 'es' ? 'Comparativo' : 'Comparison'}
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
            {language === 'fr'
              ? <>Claude Code + Cowork <span className="text-primary-foreground">vs</span> Crawlers.fr</>
              : language === 'es'
              ? <>Claude Code + Cowork <span className="text-primary-foreground">vs</span> Crawlers.fr</>
              : <>Claude Code + Cowork <span className="text-primary-foreground">vs</span> Crawlers.fr</>
            }
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            {language === 'fr'
              ? 'L\'IA généraliste devine. Un outil spécialisé mesure, crawle et corrige.'
              : language === 'es'
              ? 'La IA generalista adivina. Una herramienta especializada mide, rastrea y corrige.'
              : 'Generalist AI guesses. A specialized tool measures, crawls, and fixes.'}
          </p>
        </div>

        {/* Comparison grid */}
        <div className="grid gap-3 sm:gap-4">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr] sm:grid-cols-[2fr_3fr_3fr] gap-3 sm:gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            <span className="hidden sm:block" />
            <span className="text-center opacity-50">Claude Code / Cowork</span>
            <span className="text-center text-violet-600 dark:text-violet-400">Crawlers.fr</span>
          </div>

          {comparisons.map((row, i) => {
            const Icon = row.icon;
            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr] sm:grid-cols-[2fr_3fr_3fr] gap-3 sm:gap-4 items-stretch"
              >
                {/* Icon label — desktop only */}
                <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                {/* Claude */}
                <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-2.5 text-sm text-muted-foreground">
                  <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <span>{row.claude}</span>
                </div>
                {/* Crawlers */}
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 flex items-start gap-2.5 text-sm text-foreground font-medium">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{row.crawlers}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Punchline + CTA */}
        <div className="mt-10 text-center space-y-4">
          <p className="text-lg sm:text-xl font-semibold text-foreground italic">
            {language === 'fr'
              ? '« L\'IA est un cerveau sans membre. Crawlers lui donne des mains. »'
              : language === 'es'
              ? '« La IA es un cerebro sin miembros. Crawlers le da manos. »'
              : '"AI is a brain without limbs. Crawlers gives it hands."'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/comparatif-claude-vs-crawlers">
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-8 shadow-lg"
              >
                {language === 'fr' ? 'Voir le comparatif complet' : language === 'es' ? 'Ver el comparativo completo' : 'See full comparison'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="lg" className="gap-2 border-violet-500/30 hover:bg-violet-500/5">
                {language === 'fr' ? 'Essayer gratuitement' : language === 'es' ? 'Probar gratis' : 'Try for free'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export const ClaudeVsCrawlersSection = memo(ClaudeVsCrawlersSectionComponent);
