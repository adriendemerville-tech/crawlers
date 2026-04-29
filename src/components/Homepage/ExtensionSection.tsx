import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Chrome, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function ExtensionSection() {
  const { language } = useLanguage();

  const t = {
    fr: {
      eyebrow: 'Extension Chrome',
      title: 'Auditez n\'importe quelle page en 1 clic',
      desc: 'Mode Pilote sur vos sites trackés, mode Espion sur vos concurrents. Findings injectés directement dans votre Workbench.',
      cta: 'Télécharger l\'extension',
      bullets: ['Stratégique', 'E-E-A-T', 'Conversion', 'Machine Layer'],
    },
    es: {
      eyebrow: 'Extensión Chrome',
      title: 'Audita cualquier página en 1 clic',
      desc: 'Modo Piloto en tus sitios, modo Espía en competidores. Hallazgos inyectados en tu Workbench.',
      cta: 'Descargar la extensión',
      bullets: ['Estratégico', 'E-E-A-T', 'Conversión', 'Machine Layer'],
    },
    en: {
      eyebrow: 'Chrome Extension',
      title: 'Audit any page in 1 click',
      desc: 'Pilot mode on your tracked sites, Spy mode on competitors. Findings injected straight into your Workbench.',
      cta: 'Download the extension',
      bullets: ['Strategic', 'E-E-A-T', 'Conversion', 'Machine Layer'],
    },
  }[language as 'fr' | 'es' | 'en'] || {} as any;

  return (
    <section className="relative py-14 sm:py-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-violet)/0.05),transparent_60%)]" />
      <div className="relative mx-auto max-w-4xl px-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground mb-4">
          <Chrome className="h-3.5 w-3.5 text-[hsl(var(--brand-violet))]" />
          {t.eyebrow}
        </div>
        <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {t.title}
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-muted-foreground">{t.desc}</p>

        <div className="mx-auto mb-6 flex flex-wrap justify-center gap-2 max-w-lg">
          {t.bullets.map((b: string) => (
            <span
              key={b}
              className="rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-foreground"
            >
              {b}
            </span>
          ))}
        </div>

        <Link to="/extension">
          <Button variant="outline" size="lg" className="gap-2">
            <Chrome className="h-5 w-5" />
            {t.cta}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}
