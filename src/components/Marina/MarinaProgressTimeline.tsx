import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, IdCard, Search, Brain, Network, FileText } from 'lucide-react';

type Lang = 'fr' | 'en' | 'es';

interface StepDef {
  key: string;
  icon: typeof Search;
  /** Progression atteinte quand l'étape est terminée */
  end: number;
  label: Record<Lang, string>;
  detail: Record<Lang, string>;
}

const STEPS: StepDef[] = [
  {
    key: 'identity',
    icon: IdCard,
    end: 10,
    label: { fr: "Carte d'identité du site", en: 'Site identity card', es: 'Tarjeta de identidad' },
    detail: {
      fr: 'Secteur, modèle commercial, audience cible',
      en: 'Sector, business model, target audience',
      es: 'Sector, modelo comercial, audiencia',
    },
  },
  {
    key: 'phase1',
    icon: Search,
    end: 40,
    label: { fr: 'Audit SEO technique', en: 'Technical SEO audit', es: 'Auditoría SEO técnica' },
    detail: {
      fr: '200 critères : balises, statuts, vitesse, indexation',
      en: '200 criteria: tags, statuses, speed, indexing',
      es: '200 criterios: etiquetas, estados, velocidad',
    },
  },
  {
    key: 'phase2',
    icon: Brain,
    end: 65,
    label: { fr: 'Audit stratégique GEO', en: 'Strategic GEO audit', es: 'Auditoría estratégica GEO' },
    detail: {
      fr: 'Citabilité, visibilité ChatGPT / Gemini / Perplexity',
      en: 'Citability, ChatGPT / Gemini / Perplexity visibility',
      es: 'Citabilidad, visibilidad ChatGPT / Gemini',
    },
  },
  {
    key: 'phase3',
    icon: Network,
    end: 88,
    label: { fr: 'Crawl sémantique & Cocoon', en: 'Semantic crawl & Cocoon', es: 'Crawl semántico & Cocoon' },
    detail: {
      fr: 'Maillage interne, archétypes de pages, doublons',
      en: 'Internal linking, page archetypes, duplicates',
      es: 'Enlazado interno, arquetipos, duplicados',
    },
  },
  {
    key: 'generating_report',
    icon: FileText,
    end: 100,
    label: { fr: 'Génération du rapport', en: 'Report generation', es: 'Generación del informe' },
    detail: {
      fr: 'Synthèse pédagogique, portée et limites, export',
      en: 'Pedagogical synthesis, scope and limits, export',
      es: 'Síntesis pedagógica, alcance y límites',
    },
  },
];

const COPY = {
  fr: {
    title: 'Audit en cours',
    elapsed: 'Temps écoulé',
    eta: 'Durée habituelle : 3 à 12 minutes selon la taille du site',
    pages: 'pages analysées',
    keep: 'Vous pouvez garder cet onglet ouvert, la progression se met à jour automatiquement.',
  },
  en: {
    title: 'Audit in progress',
    elapsed: 'Elapsed',
    eta: 'Usual duration: 3 to 12 minutes depending on site size',
    pages: 'pages analysed',
    keep: 'You can keep this tab open, progress updates automatically.',
  },
  es: {
    title: 'Auditoría en curso',
    elapsed: 'Tiempo transcurrido',
    eta: 'Duración habitual: 3 a 12 minutos según el tamaño del sitio',
    pages: 'páginas analizadas',
    keep: 'Puede mantener esta pestaña abierta, el progreso se actualiza solo.',
  },
} as const;

interface Props {
  /** Clé de phase renvoyée par l'edge function (phase1, phase2, ...) */
  phase: string;
  /** 0 → 100 */
  progress: number;
  language?: string;
  pagesCrawled?: number | null;
  scanModeLabel?: string | null;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MarinaProgressTimeline({
  phase,
  progress,
  language = 'fr',
  pagesCrawled,
  scanModeLabel,
}: Props) {
  const lang: Lang = language === 'en' ? 'en' : language === 'es' ? 'es' : 'fr';
  const c = COPY[lang];

  // Progression lissée : évite les sauts brusques et avance légèrement
  // entre deux polls pour que l'utilisateur voie toujours du mouvement.
  const [smooth, setSmooth] = useState(0);
  const targetRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    targetRef.current = Math.max(0, Math.min(100, progress));
  }, [progress]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSmooth((prev) => {
        const target = targetRef.current;
        if (prev >= target) {
          // Micro-avance (max +2 pts) pour l'effet d'attente active
          const ceiling = Math.min(target + 2, 99);
          return prev < ceiling ? prev + 0.15 : prev;
        }
        return Math.min(target, prev + Math.max(0.3, (target - prev) * 0.08));
      });
    }, 120);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const explicitIndex = STEPS.findIndex((s) => s.key === phase);
  const derivedIndex = STEPS.findIndex((s) => smooth < s.end);
  const activeIndex =
    explicitIndex >= 0 ? explicitIndex : derivedIndex >= 0 ? derivedIndex : STEPS.length - 1;

  const pct = Math.round(smooth);

  return (
    <div className="mt-4 max-w-xl mx-auto text-left animate-fade-in">
      <div className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden />
            <span className="text-sm font-semibold text-foreground">{c.title}</span>
            {scanModeLabel && (
              <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded border border-border text-muted-foreground">
                {scanModeLabel}
              </span>
            )}
          </div>
          <span className="text-sm font-mono text-primary tabular-nums">{pct}%</span>
        </div>

        {/* Barre de progression */}
        <div
          className="h-2 w-full bg-border/60 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={c.title}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-violet to-brand-gold transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(1, smooth))}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {c.elapsed} {formatElapsed(elapsed)}
          </span>
          {typeof pagesCrawled === 'number' && pagesCrawled > 0 && (
            <span className="tabular-nums">
              {pagesCrawled} {c.pages}
            </span>
          )}
        </div>

        {/* Étapes */}
        <ol className="mt-5 space-y-3">
          {STEPS.map((step, i) => {
            const done = i < activeIndex || pct >= 100;
            const active = i === activeIndex && pct < 100;
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className={`flex items-start gap-3 transition-opacity duration-500 ${
                  done || active ? 'opacity-100' : 'opacity-45'
                }`}
              >
                <span
                  className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                    done
                      ? 'border-primary text-primary'
                      : active
                        ? 'border-primary text-primary animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm leading-tight ${
                      active ? 'text-foreground font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label[lang]}
                  </p>
                  {active && (
                    <p className="text-xs text-muted-foreground mt-0.5 animate-fade-in">
                      {step.detail[lang]}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          {c.eta}. {c.keep}
        </p>
      </div>

    </div>
  );
}
