import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Anchor, Play, RefreshCw, Key, Copy, CheckCircle2, Clock, AlertTriangle, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
  strategic_audit: '🎯 Audit stratégique GEO…',
  cocoon: '🕸️ Cocon sémantique…',
  generating_report: '📄 Génération du rapport…',
  initializing: '⏳ Initialisation…',
};

export function MarinaDashboard() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<MarinaJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

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
    // Poll every 10s for active jobs
    const interval = setInterval(fetchJobs, 10_000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

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
        <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
          Actualiser
        </Button>
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
                    <div key={job.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={cn("h-4 w-4 shrink-0", job.status === 'processing' && 'animate-spin')} />
                            <Badge variant="outline" className={cn("text-xs", config.color)}>
                              {config.label}
                            </Badge>
                            {job.progress != null && job.status === 'processing' && (
                              <span className="text-xs text-muted-foreground">{job.progress}%</span>
                            )}
                          </div>
                          <div className="text-sm font-medium truncate">
                            {payload?.url || result?.url || 'URL inconnue'}
                          </div>
                          {phase && job.status === 'processing' && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {phaseLabels[phase] || phase}
                            </div>
                          )}
                          {job.error_message && (
                            <div className="text-xs text-destructive mt-1 truncate">{job.error_message}</div>
                          )}
                          {result && (
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {result.expert_seo_score != null && (
                                <span>SEO: <strong className="text-foreground">{result.expert_seo_score}/{result.expert_seo_max}</strong></span>
                              )}
                              {result.strategic_score != null && (
                                <span>GEO: <strong className="text-foreground">{result.strategic_score}/100</strong></span>
                              )}
                              {result.cocoon_nodes != null && (
                                <span>Cocon: <strong className="text-foreground">{result.cocoon_nodes} pages</strong></span>
                              )}
                              {result.language && (
                                <Badge variant="outline" className="text-[10px]">{result.language.toUpperCase()}</Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(job.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {result?.report_url && (
                            <a
                              href={result.report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary flex items-center gap-1 hover:underline"
                            >
                              <FileText className="h-3 w-3" />
                              Rapport
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      {job.progress != null && job.status === 'processing' && (
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          />
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
    </div>
  );
}
