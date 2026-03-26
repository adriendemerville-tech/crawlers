import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Anchor, Play, RefreshCw, Key, Copy, CheckCircle2, Clock, AlertTriangle, FileText, Loader2, Trash2, Check, Euro, StopCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { MarinaReportPreviewModal } from './MarinaReportPreviewModal';
import { toast as sonnerToast } from 'sonner';

// Model pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-pro': { input: 1.25, output: 10.0 },
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
  'google/gemini-3-flash-preview': { input: 0.15, output: 0.60 },
  'google/gemini-3-pro-preview': { input: 1.25, output: 10.0 },
  'openai/gpt-5': { input: 10.0, output: 30.0 },
  'openai/gpt-5-mini': { input: 1.10, output: 4.40 },
  'openai/gpt-5-nano': { input: 0.10, output: 0.40 },
};
const API_COST_PER_CALL: Record<string, number> = {
  browserless: 0.008, spider: 0.001, firecrawl: 0.005, dataforseo: 0.01, 'fly-playwright': 0.0001,
};
const USD_TO_EUR = 0.92;

interface MarinaJob {
  id: string;
  status: string;
  progress: number | null;
  result_data: any;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  input_payload: any;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'En attente', color: 'bg-muted text-muted-foreground', icon: Clock },
  processing: { label: 'En cours…', color: 'bg-blue-500/15 text-blue-600', icon: Loader2 },
  completed: { label: 'Terminé', color: 'bg-green-500/15 text-green-600', icon: CheckCircle2 },
  failed: { label: 'Échoué', color: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
};

const phaseLabels: Record<string, string> = {
  crawling: '🔍 Crawl technique…',
  multi_crawl: '🔍 Crawl multi-pages…',
  strategic_audit: '🎯 Audit stratégique GEO…',
  cocoon: '🕸️ Cocon sémantique…',
  generating_report: '📄 Génération du rapport…',
  initializing: '⏳ Initialisation…',
};

function CopyTemporaryLinkButton({ reportUrl, domain }: { reportUrl: string; domain: string }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cachedLink, setCachedLink] = useState<string | null>(null);

  const handleCopy = async () => {
    if (cachedLink) {
      await navigator.clipboard.writeText(cachedLink);
      setCopied(true);
      sonnerToast.success('Lien temporaire copié !');
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    setLoading(true);
    try {
      // Fetch the HTML content from the report URL to create a share
      const res = await fetch(reportUrl);
      if (!res.ok) throw new Error('Failed to fetch report');
      const html = await res.text();

      const { data, error } = await supabase.functions.invoke('share-actions', {
        body: {
          action: 'create',
          type: 'marina',
          url: domain,
          data: {},
          language: 'fr',
          preRenderedHtml: html,
        },
      });
      if (error) throw error;

      const shareId = data?.shareId || data?.shareUrl?.split('/').pop();
      if (!shareId) throw new Error('No share ID');

      const link = `https://crawlers.fr/temporarylink/${shareId}`;
      setCachedLink(link);
      await navigator.clipboard.writeText(link);
      setCopied(true);
      sonnerToast.success('Lien temporaire copié !');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy link error:', err);
      // Fallback: copy the raw report URL
      await navigator.clipboard.writeText(reportUrl);
      sonnerToast.info('Lien direct copié (fallback)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      title="Copier le lien temporaire du rapport"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function MarinaDashboard() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<MarinaJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [reportModal, setReportModal] = useState<{ html: string; domain: string } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [totalCostEur, setTotalCostEur] = useState<number | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<{ llm: number; api: number; jobs: number }>({ llm: 0, api: 0, jobs: 0 });
  const [jobStats, setJobStats] = useState<{ total: number; failed: number }>({ total: 0, failed: 0 });

  // Fetch Marina costs from analytics_events (LLM tokens + paid API calls linked to marina functions)
  const fetchCosts = useCallback(async () => {
    try {
      const [tokenRes, apiRes, jobCountRes, failedCountRes] = await Promise.all([
        supabase
          .from('analytics_events')
          .select('event_data')
          .eq('event_type', 'ai_token_usage')
          .limit(1000) as any,
        supabase
          .from('analytics_events')
          .select('event_data')
          .eq('event_type', 'paid_api_call')
          .limit(1000) as any,
        // Count ALL marina jobs ever (including deleted ones won't work, but count current)
        supabase
          .from('async_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('function_name', 'marina') as any,
        supabase
          .from('async_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('function_name', 'marina')
          .eq('status', 'failed') as any,
      ]);

      const marinaFns = new Set(['marina', 'audit-expert-seo', 'audit-strategique-ia', 'calculate-cocoon-logic', 'calculate-llm-visibility', 'process-crawl-queue', 'crawl-site', 'fetch-external-site']);

      let llmCostUsd = 0;
      let marinaLlmCallCount = 0;
      (tokenRes.data || []).forEach((e: any) => {
        const d = e.event_data;
        if (!d || !marinaFns.has(d.function_name)) return;
        marinaLlmCallCount++;
        const model = d.model || 'unknown';
        const pricing = MODEL_PRICING[model];
        if (pricing) {
          llmCostUsd += ((d.prompt_tokens || 0) / 1_000_000) * pricing.input;
          llmCostUsd += ((d.completion_tokens || 0) / 1_000_000) * pricing.output;
        }
      });

      let apiCostUsd = 0;
      let marinaApiCallCount = 0;
      (apiRes.data || []).forEach((e: any) => {
        const d = e.event_data;
        if (!d || !marinaFns.has(d.function_name)) return;
        marinaApiCallCount++;
        const service = d.api_service || 'unknown';
        apiCostUsd += API_COST_PER_CALL[service] || 0.005;
      });

      const totalUsd = llmCostUsd + apiCostUsd;
      const totalEur = totalUsd * USD_TO_EUR;
      setTotalCostEur(totalEur);
      setCostBreakdown({
        llm: llmCostUsd * USD_TO_EUR,
        api: apiCostUsd * USD_TO_EUR,
        jobs: marinaLlmCallCount + marinaApiCallCount,
      });

      // Count marina errors from analytics_events (more reliable than async_jobs which can be deleted)
      const dbJobTotal = jobCountRes?.count || 0;
      const dbJobFailed = failedCountRes?.count || 0;

      // Also count marina errors from analytics_events
      const { count: errorCount } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'edge_function_error')
        .filter('event_data->>function_name', 'in', '("marina","audit-expert-seo","audit-strategique-ia","calculate-cocoon-logic","calculate-llm-visibility")') as any;

      // Use whichever source has more data — DB jobs or inferred from cost events
      // Estimate unique job runs: each marina run triggers ~5 audit-expert-seo calls + others
      // A rough estimate: count unique date windows of marina function calls
      const inferredJobCount = Math.max(dbJobTotal, Math.ceil(marinaLlmCallCount / 50)); // ~50 LLM calls per marina run
      const inferredFailedCount = Math.max(dbJobFailed, errorCount || 0);

      setJobStats({ total: inferredJobCount, failed: inferredFailedCount });
    } catch (err) {
      console.error('Failed to fetch Marina costs:', err);
    }
  }, []);

  const handleOpenReport = async (reportUrl: string, domain: string) => {
    setLoadingReport(true);
    try {
      const response = await fetch(reportUrl);
      if (!response.ok) throw new Error('Failed to load report');
      const html = await response.text();
      const cleanDomain = (() => { try { return new URL(domain.startsWith('http') ? domain : `https://${domain}`).hostname; } catch { return domain; } })();
      setReportModal({ html, domain: cleanDomain });
    } catch (e) {
      console.error('Error loading report:', e);
      toast({ title: 'Erreur', description: 'Impossible de charger le rapport', variant: 'destructive' });
    } finally {
      setLoadingReport(false);
    }
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('marina', {
        body: { action: 'list_jobs' },
      });
      if (data?.jobs) setJobs(data.jobs);
      if (error) console.error('Failed to fetch jobs:', error);
    } catch (e) {
      console.error('Error fetching Marina jobs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchCosts();
    const interval = setInterval(fetchJobs, 10_000);
    return () => clearInterval(interval);
  }, [fetchJobs, fetchCosts]);

  // Fetch existing API key
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_config' as any)
        .select('value')
        .eq('key', 'marina_api_key')
        .single();
      if (data) setApiKey((data as any).value);
    })();
  }, []);

  const handleSubmit = async () => {
    if (!newUrl.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('marina', {
        body: { url: newUrl.trim() },
      });
      if (error) throw error;
      if (data?.job_id) {
        toast({ title: '🚀 Pipeline lancé', description: `Job ${data.job_id.slice(0, 8)}… créé pour ${newUrl}` });
        setNewUrl('');
        fetchJobs();
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina?action=generate_key`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      const result = await res.json();
      if (result?.api_key) {
        setApiKey(result.api_key);
        setShowKey(true);
        toast({ title: '🔑 Clé API générée', description: 'Copiez-la, elle ne sera plus visible en clair.' });
      } else {
        throw new Error(result?.error || 'Failed');
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast({ title: 'Copié !' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cost Counter */}
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
          <Euro className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground font-medium">Coût total Marina</div>
          <div className="text-2xl font-bold tabular-nums">
            {totalCostEur !== null ? `${totalCostEur.toFixed(2)} €` : '—'}
          </div>
        </div>
        <div className="flex gap-6 text-xs text-muted-foreground">
          <div className="text-center">
            <div className="font-mono font-semibold text-foreground">{costBreakdown.llm.toFixed(2)} €</div>
            <div>LLM</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-semibold text-foreground">{costBreakdown.api.toFixed(2)} €</div>
            <div>APIs</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-semibold text-foreground">{costBreakdown.jobs}</div>
            <div>Appels</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="font-mono font-semibold text-foreground">{jobStats.total}</div>
            <div>Jobs total</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-semibold text-destructive">{jobStats.failed}</div>
            <div>Échoués</div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Anchor className="h-6 w-6 text-primary" />
            Marina
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Pipeline automatisé de prospection : Crawl → Audit SEO → Audit GEO → Cocon → Rapport HTML
          </p>
        </div>
        <div className="flex items-center gap-2">
          {jobs.some(j => j.status === 'processing' || j.status === 'pending') && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={async () => {
                const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending');
                setJobs(prev => prev.map(j =>
                  (j.status === 'processing' || j.status === 'pending')
                    ? { ...j, status: 'failed', error_message: 'Interrompu manuellement' }
                    : j
                ));
                for (const job of activeJobs) {
                  try {
                    await supabase.functions.invoke('marina', {
                      body: { action: 'cancel_job', job_id: job.id },
                    });
                  } catch (e) {
                    console.error('Failed to cancel job:', e);
                  }
                }
                sonnerToast.success(`${activeJobs.length} job(s) interrompu(s)`);
              }}
            >
              <StopCircle className="h-4 w-4 mr-1" />
              Tout stopper
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* API Key Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" />
            Clé API Marina
          </CardTitle>
          <CardDescription className="text-xs">
            Pour les appels externes (LinkedIn automation, n8n, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {apiKey ? (
              <>
                <code className="flex-1 bg-muted px-3 py-2 rounded text-xs font-mono truncate">
                  {showKey ? apiKey : `${apiKey.slice(0, 12)}${'•'.repeat(30)}`}
                </code>
                <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Masquer' : 'Voir'}
                </Button>
                <Button variant="ghost" size="sm" onClick={copyKey}>
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">Aucune clé générée</span>
            )}
            <Button variant="outline" size="sm" onClick={handleGenerateKey} disabled={generatingKey}>
              {generatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4 mr-1" />}
              {apiKey ? 'Régénérer' : 'Générer'}
            </Button>
          </div>
          {apiKey && (
            <div className="mt-3 p-3 bg-muted/50 rounded text-xs font-mono text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">Exemple d'appel :</div>
              <pre className="whitespace-pre-wrap">
{`curl -X POST \\
  ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina \\
  -H "Content-Type: application/json" \\
  -H "x-marina-key: ${apiKey.slice(0, 12)}..." \\
  -d '{"url": "https://example.com"}'`}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Job */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Lancer un audit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1"
            />
            <Button onClick={handleSubmit} disabled={submitting || !newUrl.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Lancer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Jobs récents</CardTitle>
          <CardDescription className="text-xs">{jobs.length} jobs</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Aucun job Marina lancé
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((job) => {
                  const config = statusConfig[job.status] || statusConfig.pending;
                  const Icon = config.icon;
                  const payload = job.input_payload || {};
                  const result = job.result_data;
                  const phase = payload?.phase;
                  
                  return (
                    <div key={job.id} className="group relative px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", job.status === 'processing' && 'animate-spin')} />
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.color)}>
                            {config.label}
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {payload?.url || result?.url || 'URL inconnue'}
                          </span>
                          {phase && (job.status === 'processing' || job.status === 'pending') && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                              {phaseLabels[phase] || phase}
                            </span>
                          )}
                          {job.progress != null && (job.status === 'processing' || job.status === 'pending') && (
                            <span className="text-[10px] text-muted-foreground">{job.progress}%</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {result && (
                            <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
                              {result.expert_seo_score != null && (
                                <span>SEO: <strong className="text-foreground">{result.expert_seo_score}/{result.expert_seo_max}</strong></span>
                              )}
                              {result.strategic_score != null && (
                                <span>GEO: <strong className="text-foreground">{result.strategic_score}/100</strong></span>
                              )}
                              {result.cocoon_nodes != null && (
                                <span>Cocon: <strong className="text-foreground">{result.cocoon_nodes}p</strong></span>
                              )}
                            </div>
                          )}
                          {result?.report_url && (
                            <>
                              <CopyTemporaryLinkButton reportUrl={result.report_url} domain={payload?.url || result?.url || result?.domain || ''} />
                              <button
                                onClick={() => handleOpenReport(result.report_url, payload?.url || result?.url || 'rapport')}
                                className="text-[10px] text-primary flex items-center gap-1 hover:underline"
                              >
                                <FileText className="h-3 w-3" />
                                Rapport
                              </button>
                            </>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(job.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(job.status === 'processing' || job.status === 'pending') && (
                            <button
                              onClick={async () => {
                                setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'failed', error_message: 'Interrompu manuellement' } : j));
                                try {
                                  await supabase.functions.invoke('marina', {
                                    body: { action: 'cancel_job', job_id: job.id },
                                  });
                                } catch (e) {
                                  console.error('Failed to cancel job:', e);
                                }
                              }}
                              className="p-1 rounded hover:bg-destructive/10 text-destructive/70 hover:text-destructive transition-colors"
                              title="Interrompre"
                            >
                              <StopCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              setJobs(prev => prev.filter(j => j.id !== job.id));
                              try {
                                await supabase.functions.invoke('marina', {
                                  body: { action: 'delete_job', job_id: job.id },
                                });
                              } catch (e) {
                                console.error('Failed to delete job:', e);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {job.error_message && (
                        <div className="text-[10px] text-destructive mt-0.5 ml-5 truncate">{job.error_message}</div>
                      )}
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <div className="mt-1 ml-5 h-1 bg-muted rounded-full overflow-hidden max-w-xs">
                          {job.progress != null && job.progress > 0 ? (
                            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
                          ) : (
                            <div className="h-full w-1/3 bg-primary/60 rounded-full animate-pulse" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {reportModal && (
        <MarinaReportPreviewModal
          isOpen={!!reportModal}
          onClose={() => setReportModal(null)}
          htmlContent={reportModal.html}
          domain={reportModal.domain}
        />
      )}
    </div>
  );
}
