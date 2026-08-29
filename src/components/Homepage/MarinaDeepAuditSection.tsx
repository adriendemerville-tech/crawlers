import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileSearch, Layers, Gauge, Bot } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClaudeVerdictBlock } from '@/components/Marina/ClaudeVerdictBlock';

/**
 * Section home : audit profond gratuit (Marina).
 * 2 rapports offerts sans compte, puis conversion vers les plans.
 */
export function MarinaDeepAuditSection() {
  const { language } = useLanguage();

  const t = {
    fr: {
      badge: 'Audit profond — 2 rapports offerts',
      title: 'Audit SEO & GEO gratuit de 40 pages',
      lead:
        "Marina teste votre visibilité dans ChatGPT, Gemini et Perplexity, puis livre un rapport actionnable avec plan d'action priorisé.",
      items: [
        { icon: Layers, k: '~20', l: 'sous-audits : technique, sémantique, maillage, autorité' },
        { icon: Bot, k: '9', l: 'questions posées aux moteurs de réponse IA' },
        { icon: Gauge, k: '40+', l: 'pages de rapport, exportable en PDF' },
        { icon: FileSearch, k: '0 €', l: '2 audits offerts, puis 30 crédits par rapport' },
      ],
      cta: 'Lancer mon audit profond gratuit',
      secondary: 'Voir un rapport type',
    },
    es: {
      badge: 'Auditoría profunda — 2 informes gratis',
      title: 'Auditoría SEO y GEO gratuita de 40 páginas',
      lead:
        'Marina prueba su visibilidad en ChatGPT, Gemini y Perplexity, y entrega un informe accionable con plan de acción priorizado.',
      items: [
        { icon: Layers, k: '~20', l: 'sub-auditorías: técnica, semántica, enlazado, autoridad' },
        { icon: Bot, k: '9', l: 'preguntas hechas a los motores de respuesta IA' },
        { icon: Gauge, k: '40+', l: 'páginas de informe, exportable en PDF' },
        { icon: FileSearch, k: '0 €', l: '2 auditorías gratis, luego 30 créditos por informe' },
      ],
      cta: 'Lanzar mi auditoría profunda gratis',
      secondary: 'Ver un informe tipo',
    },
    en: {
      badge: 'Deep audit — 2 free reports',
      title: 'Free 40-page SEO & GEO audit',
      lead:
        'Marina tests your visibility in ChatGPT, Gemini and Perplexity, then delivers an actionable report with a prioritised action plan.',
      items: [
        { icon: Layers, k: '~20', l: 'sub-audits: technical, semantic, internal links, authority' },
        { icon: Bot, k: '9', l: 'questions asked to AI answer engines' },
        { icon: Gauge, k: '40+', l: 'report pages, exportable as PDF' },
        { icon: FileSearch, k: '0 €', l: '2 free audits, then 30 credits per report' },
      ],
      cta: 'Run my free deep audit',
      secondary: 'See a sample report',
    },
  }[language === 'es' ? 'es' : language === 'en' ? 'en' : 'fr'];

  return (
    <section className="relative overflow-hidden py-14 sm:py-20" aria-labelledby="marina-free-audit-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,hsl(var(--brand-violet)/0.10),transparent_65%)]" />
      <div className="relative mx-auto grid max-w-6xl items-start gap-8 px-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-10 backdrop-blur-sm">
          <span className="inline-flex items-center rounded-full border border-amber-500/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
            {t.badge}
          </span>

          <h2 id="marina-free-audit-title" className="mt-4 text-balance t-h2 font-extrabold tracking-tight text-foreground">
            {t.title}
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t.lead}
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {t.items.map(({ icon: Icon, k, l }) => (
              <li key={k + l} className="flex items-start gap-3 rounded-xl border border-border/50 px-4 py-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--brand-violet))]" aria-hidden="true" />
                <div>
                  <div className="text-lg font-extrabold text-foreground">{k}</div>
                  <div className="text-xs text-muted-foreground">{l}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link to="/marina">
              <Button size="lg" variant="outline" className="gap-2 font-semibold">
                {t.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="/api/public/marina-report?id=11f1145d-adc8-4ba7-a9bb-d4647b95bd47"
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {t.secondary}
            </a>
          </div>
        </div>

        <ClaudeVerdictBlock className="mt-0" showSubtitle={false} />
      </div>
    </section>
  );
}
