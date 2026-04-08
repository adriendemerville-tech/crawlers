import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type AuditType = 'robots' | 'llm' | 'pagespeed';

interface LeadMagnetAuditProps {
  type: AuditType;
  placeholder?: string;
  ctaLabel?: string;
  accentColor?: string;
}

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { new URL(url); return url; } catch { return ''; }
}

const FUNCTION_MAP: Record<AuditType, string> = {
  robots: 'check-robots-indexation',
  llm: 'check-llm',
  pagespeed: 'check-pagespeed',
};

const LABELS: Record<AuditType, { resultTitle: string }> = {
  robots: { resultTitle: 'Accessibilité Bots IA' },
  llm: { resultTitle: 'Visibilité LLM' },
  pagespeed: { resultTitle: 'Performance PageSpeed' },
};

export function LeadMagnetAudit({ type, placeholder = 'https://example.com', ctaLabel = 'Analyser', accentColor = 'primary' }: LeadMagnetAuditProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      toast.error('Veuillez entrer une URL valide');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(FUNCTION_MAP[type], {
        body: { url: normalized, async: false },
      });

      if (fnError) throw fnError;
      setResult(data);
    } catch (err: any) {
      console.error('Audit error:', err);
      setError('Une erreur est survenue. Essayez l\'audit complet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="url"
            placeholder={placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
            className="pl-10 h-12 text-base"
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={loading || !url.trim()}
          size="lg"
          className={`h-12 px-8 text-base bg-gradient-to-r from-${accentColor} to-${accentColor}/80 hover:from-${accentColor}/90 hover:to-${accentColor}/70`}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
          {loading ? 'Analyse en cours…' : ctaLabel}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/audit-expert')}>
              Lancer un audit complet →
            </Button>
          </div>
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="mt-6 p-5 rounded-xl border border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <h3 className="font-semibold text-foreground">{LABELS[type].resultTitle}</h3>
          </div>
          
          {type === 'robots' && <RobotsResult data={result} />}
          {type === 'llm' && <LlmResult data={result} />}
          {type === 'pagespeed' && <PageSpeedResult data={result} />}

          <div className="mt-4 pt-4 border-t border-border">
            <Button onClick={() => navigate('/audit-expert')} variant="outline" className="w-full">
              Obtenir l'audit complet gratuit →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RobotsResult({ data }: { data: any }) {
  const robotsTxt = data?.robotsTxt || data?.robots_txt;
  const botsBlocked = data?.botsBlocked || data?.bots_blocked || [];
  const botsAllowed = data?.botsAllowed || data?.bots_allowed || [];
  const score = data?.score ?? data?.accessibility_score;

  return (
    <div className="space-y-3">
      {score != null && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Score d'accessibilité :</span>
          <span className={`text-2xl font-bold ${score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
            {score}/100
          </span>
        </div>
      )}
      {botsBlocked.length > 0 && (
        <div>
          <p className="text-sm font-medium text-rose-500 mb-1">🚫 Bots bloqués ({botsBlocked.length})</p>
          <p className="text-xs text-muted-foreground">{botsBlocked.slice(0, 6).join(', ')}</p>
        </div>
      )}
      {botsAllowed.length > 0 && (
        <div>
          <p className="text-sm font-medium text-emerald-500 mb-1">✅ Bots autorisés ({botsAllowed.length})</p>
          <p className="text-xs text-muted-foreground">{botsAllowed.slice(0, 6).join(', ')}</p>
        </div>
      )}
      {!score && botsBlocked.length === 0 && botsAllowed.length === 0 && (
        <p className="text-sm text-muted-foreground">Résultat reçu. Consultez l'audit complet pour les détails.</p>
      )}
    </div>
  );
}

function LlmResult({ data }: { data: any }) {
  const score = data?.citability_score ?? data?.score ?? data?.visibility_score;
  const mentions = data?.mentions || data?.brand_mentions || [];
  const llms = data?.llm_results || data?.results || [];

  return (
    <div className="space-y-3">
      {score != null && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Score de citabilité :</span>
          <span className={`text-2xl font-bold ${score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
            {score}/100
          </span>
        </div>
      )}
      {Array.isArray(llms) && llms.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {llms.slice(0, 4).map((r: any, i: number) => (
            <div key={i} className="p-2 rounded bg-muted/30 text-xs">
              <span className="font-medium text-foreground">{r.provider || r.model || `LLM ${i + 1}`}</span>
              <span className="ml-1 text-muted-foreground">— {r.mentioned ? '✅ Cité' : '❌ Non cité'}</span>
            </div>
          ))}
        </div>
      )}
      {!score && llms.length === 0 && (
        <p className="text-sm text-muted-foreground">Résultat reçu. Consultez l'audit complet pour les détails.</p>
      )}
    </div>
  );
}

function PageSpeedResult({ data }: { data: any }) {
  const mobile = data?.mobile || data?.performance_mobile;
  const desktop = data?.desktop || data?.performance_desktop;
  const lcp = data?.lcp || data?.lcp_ms;
  const cls = data?.cls;
  const ttfb = data?.ttfb || data?.ttfb_ms;

  const scoreColor = (s: number) => s >= 90 ? 'text-emerald-500' : s >= 50 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        {mobile != null && (
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className={`text-3xl font-bold ${scoreColor(mobile)}`}>{mobile}</p>
            <p className="text-xs text-muted-foreground">Mobile</p>
          </div>
        )}
        {desktop != null && (
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className={`text-3xl font-bold ${scoreColor(desktop)}`}>{desktop}</p>
            <p className="text-xs text-muted-foreground">Desktop</p>
          </div>
        )}
      </div>
      {(lcp || cls != null || ttfb) && (
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          {lcp && <div className="p-2 rounded bg-muted/30"><span className="font-medium text-foreground">{typeof lcp === 'number' ? (lcp / 1000).toFixed(1) + 's' : lcp}</span><br /><span className="text-muted-foreground">LCP</span></div>}
          {cls != null && <div className="p-2 rounded bg-muted/30"><span className="font-medium text-foreground">{cls}</span><br /><span className="text-muted-foreground">CLS</span></div>}
          {ttfb && <div className="p-2 rounded bg-muted/30"><span className="font-medium text-foreground">{typeof ttfb === 'number' ? ttfb + 'ms' : ttfb}</span><br /><span className="text-muted-foreground">TTFB</span></div>}
        </div>
      )}
      {mobile == null && desktop == null && (
        <p className="text-sm text-muted-foreground">Résultat reçu. Consultez l'audit complet pour les détails.</p>
      )}
    </div>
  );
}
