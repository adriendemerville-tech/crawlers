import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Loader2, Shield, CheckCircle2, XCircle, AlertTriangle, Globe, ArrowRight, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UaTest {
  label: string;
  ua: string;
  status: number | null;
  ok: boolean;
  blocked: boolean;
  contentLength: number;
  redirected: boolean;
  finalUrl: string | null;
  server: string | null;
  cfRay: string | null;
  via: string | null;
  setCookie: string | null;
  error: string | null;
  durationMs: number;
}

interface DiagResult {
  url: string;
  origin: string;
  verdict: { level: 'ok' | 'warning' | 'error'; summary: string; recommendations: string[] };
  uaTests: UaTest[];
  redirectChain: { hops: Array<{ from: string; to: string; status: number }>; finalUrl: string; finalStatus: number | null; error: string | null };
  robots: { status: number | null; body: string | null; userAgentRules: Array<{ ua: string; disallow: string[]; allow: string[] }>; error: string | null };
  securityHeaders: Record<string, string | null>;
  wafDetected: string[];
  bodySnippet: string;
  scannedAt: string;
}

const STATUS_HELP: Record<number, { label: string; cause: string }> = {
  200: { label: 'OK', cause: 'Le site répond normalement.' },
  301: { label: 'Redirection permanente', cause: 'Le site redirige vers une nouvelle URL.' },
  302: { label: 'Redirection temporaire', cause: 'Le site redirige temporairement.' },
  401: { label: 'Authentification requise', cause: 'La page demande un login (HTTP Auth ou cookie).' },
  403: { label: 'Interdit', cause: 'Le pare-feu (WAF) ou un .htaccess bloque la requête. Souvent lié au User-Agent.' },
  404: { label: 'Page introuvable', cause: 'L\'URL demandée n\'existe pas sur le serveur.' },
  429: { label: 'Trop de requêtes', cause: 'Rate-limit déclenché. Attendre puis réessayer.' },
  500: { label: 'Erreur serveur', cause: 'Le code applicatif a planté. Voir les logs du serveur.' },
  502: { label: 'Bad Gateway', cause: 'Le reverse-proxy ne joint pas l\'origine (PHP/Node down).' },
  503: { label: 'Service indisponible', cause: 'Surcharge ou maintenance. Mode dégradé temporaire.' },
  504: { label: 'Timeout passerelle', cause: 'Le serveur d\'origine met trop de temps à répondre.' },
};

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <Badge variant="outline" className="font-mono">—</Badge>;
  const cls = status >= 200 && status < 300
    ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
    : status >= 300 && status < 400
    ? 'border-amber-500/40 text-amber-600 dark:text-amber-400'
    : 'border-destructive/40 text-destructive';
  return <Badge variant="outline" className={`font-mono ${cls}`}>{status}</Badge>;
}

function VerdictIcon({ level }: { level: 'ok' | 'warning' | 'error' }) {
  if (level === 'ok') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  if (level === 'warning') return <AlertTriangle className="w-5 h-5 text-amber-500" />;
  return <XCircle className="w-5 h-5 text-destructive" />;
}

export default function DiagnosticWaf() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [copied, setCopied] = useState(false);

  const runDiag = async () => {
    if (!url.trim()) {
      toast.error('Saisir une URL');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-waf', {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erreur inconnue');
      setResult(data.data);
    } catch (e: any) {
      toast.error(`Diagnostic échoué : ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!result) return;
    const lines: string[] = [
      `=== Diagnostic WAF — ${result.url} ===`,
      `Date : ${new Date(result.scannedAt).toLocaleString('fr-FR')}`,
      ``,
      `VERDICT : ${result.verdict.summary}`,
      ...(result.verdict.recommendations.length ? ['', 'Recommandations :', ...result.verdict.recommendations.map(r => `  • ${r}`)] : []),
      ``,
      `WAF détecté : ${result.wafDetected.length ? result.wafDetected.join(', ') : 'Aucun'}`,
      ``,
      `--- Tests par User-Agent ---`,
      ...result.uaTests.map(t => `  ${t.label.padEnd(35)} → ${t.status ?? 'ERR'} ${t.blocked ? '[BLOQUÉ]' : ''} ${t.error || ''}`),
      ``,
      `--- Redirections ---`,
      ...(result.redirectChain.hops.length ? result.redirectChain.hops.map(h => `  ${h.status} : ${h.from} → ${h.to}`) : ['  Aucune']),
      `  Final : ${result.redirectChain.finalUrl} (${result.redirectChain.finalStatus})`,
      ``,
      `--- robots.txt ---`,
      `  HTTP ${result.robots.status ?? 'ERR'}`,
      ...(result.robots.userAgentRules.slice(0, 5).map(r => `  User-Agent: ${r.ua}\n    Disallow: ${r.disallow.join(', ') || '(aucun)'}`)),
    ];
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    toast.success('Rapport copié');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Diagnostic WAF — Pourquoi mon site est-il bloqué ? | Crawlers.fr</title>
        <meta name="description" content="Outil de diagnostic gratuit pour comprendre pourquoi un scan échoue : codes HTTP, redirections, robots.txt, headers et User-Agent." />
        <link rel="canonical" href="https://crawlers.fr/diagnostic-waf" />
      </Helmet>

      <main className="container max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 text-primary text-xs font-medium mb-4">
            <Shield className="w-3.5 h-3.5" />
            Outil de diagnostic
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Diagnostic WAF
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprendre pourquoi un site bloque les scans : codes HTTP, redirections, robots.txt, pare-feu et User-Agent.
          </p>
        </div>

        {/* Input */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://exemple.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runDiag()}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              <Button
                onClick={runDiag}
                disabled={loading || !url.trim()}
                variant="outline"
                className="border-foreground text-foreground bg-transparent hover:bg-foreground/5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                {loading ? 'Analyse…' : 'Lancer le diagnostic'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              6 User-Agents testés (navigateur, Googlebot, GPTBot…), suivi de la chaîne de redirections, lecture du robots.txt et détection du WAF.
            </p>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">
                Test en cours — peut prendre jusqu'à 15 secondes…
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Verdict */}
            <Alert variant={result.verdict.level === 'error' ? 'destructive' : 'default'}>
              <VerdictIcon level={result.verdict.level} />
              <AlertTitle className="ml-2">
                {result.verdict.level === 'ok' ? 'Site accessible' : result.verdict.level === 'warning' ? 'Accès partiel' : 'Site bloqué'}
              </AlertTitle>
              <AlertDescription className="ml-2 space-y-2">
                <p>{result.verdict.summary}</p>
                {result.verdict.recommendations.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {result.verdict.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </AlertDescription>
            </Alert>

            {/* WAF detected */}
            {result.wafDetected.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Pare-feu / CDN détecté
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {result.wafDetected.map(w => (
                      <Badge key={w} variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">{w}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Ces services peuvent rejeter les requêtes des bots. Pour autoriser Crawlers, whitelister le User-Agent <code className="px-1 py-0.5 rounded bg-muted text-foreground">Mozilla/5.0</code> ou désactiver le challenge sur l'URL d'accueil.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* UA Tests */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tests par User-Agent</CardTitle>
                <CardDescription>Chaque ligne simule un client différent pour identifier la cause du blocage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.uaTests.map((t, i) => {
                  const help = t.status ? STATUS_HELP[t.status] : null;
                  return (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{t.label}</span>
                          <StatusBadge status={t.status} />
                          {t.blocked && <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">BLOQUÉ</Badge>}
                          {t.ok && !t.blocked && <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px]">OK</Badge>}
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">{t.durationMs}ms</span>
                      </div>
                      {(help || t.error) && (
                        <p className="text-xs text-muted-foreground">
                          {t.error ? <span className="text-destructive">{t.error}</span> : help && <><strong className="text-foreground">{help.label}</strong> — {help.cause}</>}
                        </p>
                      )}
                      <div className="flex gap-3 text-[10px] text-muted-foreground font-mono flex-wrap">
                        {t.contentLength > 0 && <span>{(t.contentLength / 1024).toFixed(1)} Ko</span>}
                        {t.redirected && <span>↪ redirigé</span>}
                        {t.server && <span>server: {t.server}</span>}
                        {t.cfRay && <span>cf-ray: {t.cfRay.slice(0, 12)}</span>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Redirect chain */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chaîne de redirections</CardTitle>
                <CardDescription>Suivi pas à pas (UA navigateur). {result.redirectChain.hops.length} saut(s).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.redirectChain.hops.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune redirection — l'URL répond directement.</p>
                ) : (
                  result.redirectChain.hops.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <StatusBadge status={h.status} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="font-mono break-all text-muted-foreground">{h.from}</div>
                        <div className="flex items-start gap-1">
                          <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="font-mono break-all">{h.to}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div className="pt-2 mt-2 border-t text-xs">
                  <span className="text-muted-foreground">URL finale : </span>
                  <span className="font-mono break-all">{result.redirectChain.finalUrl}</span>
                  {result.redirectChain.finalStatus && <> <StatusBadge status={result.redirectChain.finalStatus} /></>}
                </div>
              </CardContent>
            </Card>

            {/* robots.txt */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>robots.txt</span>
                  {result.robots.status && <StatusBadge status={result.robots.status} />}
                </CardTitle>
                <CardDescription>Règles déclarées pour les bots.</CardDescription>
              </CardHeader>
              <CardContent>
                {result.robots.error && <p className="text-xs text-destructive">{result.robots.error}</p>}
                {result.robots.body ? (
                  <>
                    <div className="space-y-2 mb-3">
                      {result.robots.userAgentRules.slice(0, 8).map((r, i) => (
                        <div key={i} className="rounded border p-2 text-xs">
                          <div className="font-mono text-foreground mb-1">User-Agent: <strong>{r.ua}</strong></div>
                          {r.disallow.length > 0 && (
                            <div className="font-mono text-muted-foreground">Disallow: {r.disallow.join(', ')}</div>
                          )}
                          {r.allow.length > 0 && (
                            <div className="font-mono text-muted-foreground">Allow: {r.allow.join(', ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Voir le contenu brut</summary>
                      <pre className="mt-2 p-3 bg-muted rounded font-mono overflow-x-auto whitespace-pre-wrap">{result.robots.body}</pre>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Pas de robots.txt accessible — par défaut, tout est autorisé.</p>
                )}
              </CardContent>
            </Card>

            {/* Security headers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">En-têtes HTTP de sécurité</CardTitle>
                <CardDescription>Indices sur la stack et les protections en place.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {Object.entries(result.securityHeaders).map(([k, v]) => (
                    <div key={k} className="flex gap-2 py-1 border-b last:border-0">
                      <span className="font-mono text-muted-foreground min-w-[180px]">{k}</span>
                      <span className="font-mono break-all">{v || <span className="text-muted-foreground/60">—</span>}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={copyReport} className="border-foreground text-foreground bg-transparent hover:bg-foreground/5">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copier le rapport
              </Button>
            </div>
          </div>
        )}

        {/* Help */}
        {!result && !loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comment lire les résultats ?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <strong className="text-foreground">Codes HTTP courants :</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><code className="text-foreground">200</code> — Tout va bien</li>
                  <li><code className="text-foreground">301/302</code> — Redirection (suivie automatiquement)</li>
                  <li><code className="text-foreground">403</code> — Pare-feu (WAF) bloque la requête</li>
                  <li><code className="text-foreground">429</code> — Rate-limit déclenché</li>
                  <li><code className="text-foreground">500/502/503</code> — Serveur en erreur</li>
                </ul>
              </div>
              <div>
                <strong className="text-foreground">Si un User-Agent passe et un autre est bloqué :</strong> le pare-feu filtre par signature. Whitelister Crawlers résout le problème.
              </div>
              <div>
                <strong className="text-foreground">WAF fréquents :</strong> Cloudflare, Sucuri, Imperva, OVH, AWS. Chacun a son interface pour ajouter une exception.
              </div>
              <div>
                <a href="https://developers.cloudflare.com/waf/custom-rules/" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                  Documentation Cloudflare WAF <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
