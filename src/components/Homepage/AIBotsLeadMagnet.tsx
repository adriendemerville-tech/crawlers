import { useState, useCallback } from 'react';
import { Bot, CheckCircle2, XCircle, Loader2, ArrowRight, Gauge, Shield, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeUrl } from '@/hooks/useUrlValidation';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface BotResult {
  name: string;
  status: 'allowed' | 'blocked' | 'unknown';
  userAgent?: string;
}

interface GeoFactor {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'good' | 'warning' | 'error';
}

interface LlmResult {
  llm_name: string;
  cited: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
  excerpt?: string;
  error?: boolean;
}

type TabMode = 'bots' | 'geo' | 'llm';

const i18n = {
  fr: {
    placeholder: 'https://votre-site.fr',
    cta: 'Analyser',
    tabBots: 'Bots IA',
    tabGeo: 'Score GEO',
    tabLlm: 'Visibilité LLM',
    titleBots: 'Vos pages sont-elles accessibles aux IA ?',
    titleGeo: 'Quel est votre Score GEO ?',
    titleLlm: 'Les LLMs parlent-ils de vous ?',
    subtitleBots: 'Vérifiez en 10 secondes si les crawlers IA peuvent lire votre site.',
    subtitleGeo: 'Mesurez votre optimisation pour les moteurs de réponse IA.',
    subtitleLlm: 'Découvrez si les IA vous citent quand on parle de votre secteur.',
    allowed: 'Autorisé',
    blocked: 'Bloqué',
    summary_all: 'Tous les bots IA peuvent accéder à votre site ✓',
    summary_some: 'bots IA bloqués sur votre site',
    geoScoreLabel: 'Score GEO',
    geoOut: '/ 100',
    deepAudit: 'Audit complet gratuit',
    cited: 'Cité',
    notCited: 'Non cité',
    positive: 'Positif',
    neutral: 'Neutre',
    negative: 'Négatif',
    llmSummary: 'LLMs vous citent',
    llmNone: 'Aucun LLM ne vous cite encore',
  },
  en: {
    placeholder: 'https://your-site.com',
    cta: 'Analyze',
    tabBots: 'AI Bots',
    tabGeo: 'GEO Score',
    tabLlm: 'LLM Visibility',
    titleBots: 'Can AI crawlers read your pages?',
    titleGeo: 'What is your GEO Score?',
    titleLlm: 'Do LLMs talk about you?',
    subtitleBots: 'Check in 10 seconds if AI bots can access your site.',
    subtitleGeo: 'Measure your optimization for AI answer engines.',
    subtitleLlm: 'Discover if AIs mention you when discussing your industry.',
    allowed: 'Allowed',
    blocked: 'Blocked',
    summary_all: 'All AI bots can access your site ✓',
    summary_some: 'AI bots blocked on your site',
    geoScoreLabel: 'GEO Score',
    geoOut: '/ 100',
    deepAudit: 'Free full audit',
    cited: 'Cited',
    notCited: 'Not cited',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    llmSummary: 'LLMs cite you',
    llmNone: 'No LLM cites you yet',
  },
  es: {
    placeholder: 'https://tu-sitio.es',
    cta: 'Analizar',
    tabBots: 'Bots IA',
    tabGeo: 'Score GEO',
    tabLlm: 'Visibilidad LLM',
    titleBots: '¿Los bots IA pueden leer tus páginas?',
    titleGeo: '¿Cuál es tu Score GEO?',
    titleLlm: '¿Los LLMs hablan de ti?',
    subtitleBots: 'Verifica en 10 segundos si los crawlers IA pueden acceder a tu sitio.',
    subtitleGeo: 'Mide tu optimización para los motores de respuesta IA.',
    subtitleLlm: 'Descubre si las IAs te mencionan cuando hablan de tu sector.',
    allowed: 'Permitido',
    blocked: 'Bloqueado',
    summary_all: 'Todos los bots IA pueden acceder a tu sitio ✓',
    summary_some: 'bots IA bloqueados en tu sitio',
    geoScoreLabel: 'Score GEO',
    geoOut: '/ 100',
    deepAudit: 'Auditoría completa gratis',
    cited: 'Citado',
    notCited: 'No citado',
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
    llmSummary: 'LLMs te citan',
    llmNone: 'Ningún LLM te cita aún',
  },
};

function getScoreColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-destructive';
}

function getScoreRingColor(score: number) {
  if (score >= 70) return 'stroke-emerald-500';
  if (score >= 40) return 'stroke-amber-500';
  return 'stroke-destructive';
}

function getStatusColor(status: string) {
  if (status === 'good') return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500';
  if (status === 'warning') return 'border-amber-500/20 bg-amber-500/5 text-amber-500';
  return 'border-destructive/20 bg-destructive/5 text-destructive';
}

function ScoreRing({ score }: { score: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" strokeWidth="6" className="stroke-muted/20" />
        <circle
          cx="48" cy="48" r={radius} fill="none" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-all duration-1000 ease-out', getScoreRingColor(score))}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-2xl font-bold', getScoreColor(score))}>{score}</span>
      </div>
    </div>
  );
}

const LLM_ICONS: Record<string, string> = {
  ChatGPT: '🤖',
  Gemini: '✨',
  Perplexity: '🔍',
  Claude: '🧠',
  Mistral: '🌊',
  'Meta Llama': '🦙',
};

export function AIBotsLeadMagnet() {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  const [tab, setTab] = useState<TabMode>('geo');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState<BotResult[] | null>(null);
  const [geoScore, setGeoScore] = useState<number | null>(null);
  const [geoFactors, setGeoFactors] = useState<GeoFactor[] | null>(null);
  const [llmResults, setLlmResults] = useState<LlmResult[] | null>(null);
  const [llmBrand, setLlmBrand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    const normalized = normalizeUrl(url);
    if (!normalized || normalized === 'https://') return;

    setLoading(true);
    setError(null);

    try {
      if (tab === 'bots') {
        const { data, error: fnError } = await supabase.functions.invoke('check-crawlers', {
          body: { url: normalized },
        });
        if (fnError) throw fnError;
        if (data?.success && data.data?.bots) {
          setBots(data.data.bots);
        } else {
          setError(data?.error || 'Error');
        }
      } else if (tab === 'llm') {
        const { data, error: fnError } = await supabase.functions.invoke('llm-visibility-lite', {
          body: { url: normalized },
        });
        if (fnError) throw fnError;
        if (data?.success && data.data) {
          setLlmResults(data.data.results);
          setLlmBrand(data.data.brand);
        } else {
          setError(data?.error || 'Error');
        }
      } else {
        const { data, error: fnError } = await supabase.functions.invoke('check-geo', {
          body: { url: normalized },
        });
        if (fnError) throw fnError;
        if (data?.success && data.data) {
          setGeoScore(data.data.totalScore ?? 0);
          setGeoFactors(data.data.factors ?? []);
        } else {
          setError(data?.error || 'Error');
        }
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [url, tab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const blockedCount = bots?.filter((b) => b.status === 'blocked').length || 0;
  const isAllowed = (bot: BotResult) => bot.status !== 'blocked';

  const handleTabSwitch = (newTab: TabMode) => {
    setTab(newTab);
    setError(null);
  };

  const citedCount = llmResults?.filter(r => r.cited).length || 0;

  return (
    <div className="mt-10 max-w-xl mx-auto">
      {/* Tabs */}
      <div className="flex justify-center gap-1 mb-4">
        <button
          onClick={() => handleTabSwitch('geo')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
            tab === 'geo'
              ? 'bg-brand-violet/15 text-brand-violet border border-brand-violet/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <Gauge className="h-3.5 w-3.5" />
          {t.tabGeo}
        </button>
        <button
          onClick={() => handleTabSwitch('bots')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
            tab === 'bots'
              ? 'bg-brand-violet/15 text-brand-violet border border-brand-violet/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <Shield className="h-3.5 w-3.5" />
          {t.tabBots}
        </button>
        <button
          onClick={() => handleTabSwitch('llm')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
            tab === 'llm'
              ? 'bg-brand-violet/15 text-brand-violet border border-brand-violet/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          {t.tabLlm}
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
          {tab === 'geo' ? (
            <Gauge className="h-4 w-4 text-brand-violet" />
          ) : tab === 'bots' ? (
            <Bot className="h-4 w-4 text-brand-violet" />
          ) : (
            <Eye className="h-4 w-4 text-brand-violet" />
          )}
          {tab === 'geo' ? t.titleGeo : tab === 'bots' ? t.titleBots : t.titleLlm}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {tab === 'geo' ? t.subtitleGeo : tab === 'bots' ? t.subtitleBots : t.subtitleLlm}
        </p>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            className="w-full h-10 px-4 text-sm bg-background border-2 border-brand-violet/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-brand-violet transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          className="h-10 px-5 rounded-lg text-sm font-semibold bg-brand-violet text-white hover:opacity-90 disabled:opacity-40 transition-colors flex items-center gap-2 shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          {t.cta}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive mt-2 text-center">{error}</p>
      )}

      {/* Results: Bots */}
      {tab === 'bots' && bots && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className={cn(
            "text-center text-xs font-medium mb-3 py-1.5 px-3 rounded-full inline-flex items-center gap-1.5 mx-auto",
            blockedCount === 0
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}>
            {blockedCount === 0 ? (
              <><CheckCircle2 className="h-3 w-3" />{t.summary_all}</>
            ) : (
              <><XCircle className="h-3 w-3" />{blockedCount} {t.summary_some}</>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
            {bots.map((bot) => (
              <div
                key={bot.name}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
                  isAllowed(bot)
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                )}
              >
                {isAllowed(bot) ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                )}
                <span className="text-foreground font-medium truncate">{bot.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results: GEO Score */}
      {tab === 'geo' && geoScore !== null && geoFactors && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ScoreRing score={geoScore} />
          <p className="text-center text-xs text-muted-foreground mt-1">
            {t.geoScoreLabel} <span className={cn('font-bold text-sm', getScoreColor(geoScore))}>{geoScore}</span> {t.geoOut}
          </p>

          {/* Top factors */}
          <div className="grid grid-cols-2 gap-1.5 mt-4">
            {geoFactors.slice(0, 6).map((f) => (
              <div
                key={f.id}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs",
                  getStatusColor(f.status)
                )}
              >
                <span className="text-foreground font-medium truncate">{f.name}</span>
                <span className="font-bold shrink-0">{f.score}/{f.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results: LLM Visibility */}
      {tab === 'llm' && llmResults && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Summary badge */}
          <div className={cn(
            "text-center text-xs font-medium mb-3 py-1.5 px-3 rounded-full inline-flex items-center gap-1.5 mx-auto",
            citedCount > 0
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-destructive/10 text-destructive"
          )}>
            {citedCount > 0 ? (
              <><CheckCircle2 className="h-3 w-3" />{citedCount}/{llmResults.length} {t.llmSummary}</>
            ) : (
              <><XCircle className="h-3 w-3" />{t.llmNone}</>
            )}
          </div>
          {llmBrand && (
            <p className="text-center text-[10px] text-muted-foreground mb-3">
              Marque détectée : <span className="font-semibold text-foreground">{llmBrand}</span>
            </p>
          )}

          {/* 6 cards, 2 rows of 3 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {llmResults.map((r) => (
              <div
                key={r.llm_name}
                className={cn(
                  "rounded-xl border p-3 text-center space-y-1.5 transition-colors",
                  r.cited
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="text-lg">{LLM_ICONS[r.llm_name] || '🤖'}</div>
                <div className="text-xs font-semibold text-foreground">{r.llm_name}</div>
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  r.cited ? "text-emerald-500" : "text-destructive"
                )}>
                  {r.cited ? t.cited : t.notCited}
                </div>
                {r.cited && (
                  <div className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full inline-block",
                    r.sentiment === 'positive' ? "bg-emerald-500/15 text-emerald-400"
                      : r.sentiment === 'negative' ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {r.sentiment === 'positive' ? t.positive : r.sentiment === 'negative' ? t.negative : t.neutral}
                  </div>
                )}
                {r.error && (
                  <div className="text-[10px] text-muted-foreground">Timeout</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA deeper audit */}
      {(bots || geoScore !== null || llmResults) && (
        <div className="text-center mt-4">
          <a
            href="/audit"
            className="text-xs text-brand-violet hover:underline inline-flex items-center gap-1"
          >
            {t.deepAudit}
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
