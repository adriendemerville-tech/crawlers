import { useState, useCallback } from 'react';
import { Bot, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeUrl } from '@/hooks/useUrlValidation';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface BotResult {
  name: string;
  status: 'allowed' | 'blocked' | 'unknown';
  userAgent?: string;
}

const i18n = {
  fr: {
    placeholder: 'https://votre-site.fr',
    cta: 'Analyser',
    title: 'Vos pages sont-elles accessibles aux IA ?',
    subtitle: 'Vérifiez en 10 secondes si les crawlers IA peuvent lire votre site.',
    allowed: 'Autorisé',
    blocked: 'Bloqué',
    summary_all: 'Tous les bots IA peuvent accéder à votre site ✓',
    summary_some: 'bots IA bloqués sur votre site',
    deepAudit: 'Audit complet gratuit',
  },
  en: {
    placeholder: 'https://your-site.com',
    cta: 'Analyze',
    title: 'Can AI crawlers read your pages?',
    subtitle: 'Check in 10 seconds if AI bots can access your site.',
    allowed: 'Allowed',
    blocked: 'Blocked',
    summary_all: 'All AI bots can access your site ✓',
    summary_some: 'AI bots blocked on your site',
    deepAudit: 'Free full audit',
  },
  es: {
    placeholder: 'https://tu-sitio.es',
    cta: 'Analizar',
    title: '¿Los bots IA pueden leer tus páginas?',
    subtitle: 'Verifica en 10 segundos si los crawlers IA pueden acceder a tu sitio.',
    allowed: 'Permitido',
    blocked: 'Bloqueado',
    summary_all: 'Todos los bots IA pueden acceder a tu sitio ✓',
    summary_some: 'bots IA bloqueados en tu sitio',
    deepAudit: 'Auditoría completa gratis',
  },
};

export function AIBotsLeadMagnet() {
  const { language } = useLanguage();
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState<BotResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    const normalized = normalizeUrl(url);
    if (!normalized || normalized === 'https://') return;

    setLoading(true);
    setError(null);
    setBots(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-crawlers', {
        body: { url: normalized },
      });
      if (fnError) throw fnError;
      if (data?.success && data.data?.bots) {
        setBots(data.data.bots);
      } else {
        setError(data?.error || 'Error');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const blockedCount = bots?.filter((b) => b.status === 'blocked').length || 0;
  const isAllowed = (bot: BotResult) => bot.status !== 'blocked';

  return (
    <div className="mt-10 max-w-xl mx-auto">
      {/* Title */}
      <div className="text-center mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
          <Bot className="h-4 w-4 text-brand-violet" />
          {t.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{t.subtitle}</p>
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
            className="w-full h-10 px-4 text-sm bg-background border-2 border-[hsl(263,70%,50%)/0.4] rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[hsl(263,70%,50%)] transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          className="h-10 px-5 rounded-lg text-sm font-semibold bg-[hsl(263,70%,50%)] text-white hover:bg-[hsl(263,70%,42%)] disabled:opacity-40 transition-colors flex items-center gap-2 shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          {t.cta}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive mt-2 text-center">{error}</p>
      )}

      {/* Results */}
      {bots && (
        <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Summary */}
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

          {/* Bot grid */}
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

          {/* CTA deeper audit */}
          <div className="text-center mt-4">
            <a
              href={`/?tab=crawlers`}
              className="text-xs text-brand-violet hover:underline inline-flex items-center gap-1"
            >
              {t.deepAudit}
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
