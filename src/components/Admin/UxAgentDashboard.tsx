import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Palette, Play, Loader2, Eye, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UxCodeProposals } from './UxCodeProposals';

interface UxLog {
  id: string;
  page_analyzed: string;
  analysis_type: string;
  findings: any;
  proposals_generated: number;
  confidence_score: number;
  model_used: string;
  created_at: string;
}

const ANALYZABLE_PAGES = [
  { key: 'Index', label: 'Home', path: 'src/pages/Index.tsx' },
  { key: 'ProAgency', label: 'Pro Agency', path: 'src/pages/ProAgency.tsx' },
  { key: 'Tarifs', label: 'Tarifs', path: 'src/pages/Tarifs.tsx' },
  { key: 'ContentArchitect', label: 'Content Architect', path: 'src/pages/ContentArchitect.tsx' },
  { key: 'AuditExpert', label: 'Audit Expert', path: 'src/pages/AuditExpert.tsx' },
  { key: 'SiteCrawl', label: 'Site Crawl', path: 'src/pages/SiteCrawl.tsx' },
];

export function UxAgentDashboard() {
  const [logs, setLogs] = useState<UxLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data } = await supabase
        .from('agent_ux_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setLogs((data as any[]) || []);
    } catch (e) {
      console.error('Load UX logs error:', e);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (page: typeof ANALYZABLE_PAGES[0]) => {
    setAnalyzing(page.key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await supabase.functions.invoke('agent-ux', {
        body: {
          action: 'analyze',
          target_page: page.label,
          component_code: `// Page: ${page.path}\n// This is a placeholder — in production, the page source code would be injected here.`,
          analysis_type: 'full',
        },
      });

      if (resp.error) throw resp.error;

      toast({
        title: 'Analyse UX terminée',
        description: `${resp.data?.result?.findings?.length || 0} problèmes détectés, ${resp.data?.result?.proposals_count || 0} propositions créées.`,
      });
      loadLogs();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec analyse', variant: 'destructive' });
    } finally {
      setAnalyzing(null);
    }
  };

  const avgConfidence = logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + (l.confidence_score || 0), 0) / logs.length)
    : 0;
  const totalProposals = logs.reduce((sum, l) => sum + (l.proposals_generated || 0), 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-xs text-muted-foreground">Analyses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{totalProposals}</p>
            <p className="text-xs text-muted-foreground">Propositions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{avgConfidence}%</p>
            <p className="text-xs text-muted-foreground">Confiance moy.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{logs.filter(l => l.analysis_type === 'component_creation').length}</p>
            <p className="text-xs text-muted-foreground">Composants créés</p>
          </CardContent>
        </Card>
      </div>

      {/* Pages à analyser */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Pages analysables</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ANALYZABLE_PAGES.map((page) => (
              <Button
                key={page.key}
                variant="outline"
                size="sm"
                disabled={!!analyzing}
                onClick={() => runAnalysis(page)}
                className="justify-start gap-2"
              >
                {analyzing === page.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                {page.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* UX Code Proposals */}
      <UxCodeProposals />

      {/* Recent logs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Historique des analyses</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune analyse UX effectuée.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map((log) => {
                const findingsArr = Array.isArray(log.findings) ? log.findings : [];
                const criticals = findingsArr.filter((f: any) => f.severity === 'critical').length;
                const warnings = findingsArr.filter((f: any) => f.severity === 'warning').length;
                return (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{log.page_analyzed}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {log.analysis_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM HH:mm', { locale: fr })}
                        </span>
                        {criticals > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {criticals} critique{criticals > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {warnings > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {warnings} warning{warnings > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{log.proposals_generated} prop.</span>
                      <Badge variant={log.confidence_score >= 80 ? 'default' : 'secondary'} className="text-[10px]">
                        {Math.round(log.confidence_score)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
