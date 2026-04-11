import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, Zap, Search, Loader2 } from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface FanOutCardProps {
  analysis: StrategicAnalysis;
  domain?: string;
  trackedSiteId?: string;
  userId?: string;
}

interface FanOutAxis {
  axis: string;
  sub_query: string;
  source: 'llm_simulation' | 'citation_reverse';
  confidence: number;
}

/**
 * Brief card showing RAG fan-out decomposition — placed below Profondeur LLM.
 */
export function FanOutCard({ analysis, domain, trackedSiteId, userId }: FanOutCardProps) {
  const [axes, setAxes] = useState<FanOutAxis[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Determine the best query to analyze (not just the homepage)
  const targetQuery = useMemo(() => {
    // Priority 1: main keyword from strategic analysis
    const mainKw = analysis.keywords?.[0]?.keyword 
      || analysis.mainKeywords?.[0]
      || analysis.keyword_positioning?.[0]?.keyword;
    if (mainKw) return mainKw;

    // Priority 2: brand + sector from identity
    const brand = analysis.brandPerception?.brandName || domain;
    const sector = analysis.brandPerception?.marketPosition || '';
    return `${brand} ${sector}`.trim();
  }, [analysis, domain]);

  // Check for existing fan-out data
  useEffect(() => {
    if (!domain || !trackedSiteId) return;
    (async () => {
      const { data } = await supabase
        .from('keyword_universe')
        .select('keyword, source_details')
        .eq('domain', domain)
        .eq('tracked_site_id', trackedSiteId)
        .contains('sources', ['fan_out'])
        .not('parent_query_id', 'is', null)
        .limit(10);

      if (data?.length) {
        setAxes(data.map((d: any) => ({
          axis: d.source_details?.fan_out_axis || d.keyword,
          sub_query: d.keyword,
          source: d.source_details?.fan_out_source || 'llm_simulation',
          confidence: d.source_details?.fan_out_confidence || 0.5,
        })));
        setHasRun(true);
      }
    })();
  }, [domain, trackedSiteId]);

  const runFanOut = async () => {
    if (!domain || !trackedSiteId || !userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('detect-fan-out', {
        body: {
          domain,
          query: targetQuery,
          trackedSiteId,
          userId,
          identityCard: analysis.brandPerception || null,
        },
      });
      if (error) throw error;
      if (data?.axes) {
        setAxes(data.axes);
        setHasRun(true);
        toast.success(`${data.axes.length} axes sémantiques détectés`);
      }
    } catch (err) {
      console.error('[FanOutCard] error:', err);
      toast.error('Erreur lors de la détection fan-out');
    } finally {
      setLoading(false);
    }
  };

  const sourceIcon = (s: string) => s === 'citation_reverse' ? <Search className="h-3 w-3" /> : <Zap className="h-3 w-3" />;
  const sourceColor = (s: string) => s === 'citation_reverse' ? 'text-blue-500' : 'text-amber-500';

  return (
    <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
            <Network className="h-4.5 w-4.5 text-indigo-500" />
          </div>
          Décomposition RAG
          {axes.length > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              {axes.length} axes
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Comment les moteurs IA décomposent la requête « {targetQuery} »
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasRun && !loading && (
          <Button
            variant="outline"
            size="sm"
            onClick={runFanOut}
            className="w-full gap-2 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/10"
          >
            <Network className="h-4 w-4" />
            Détecter les axes fan-out
          </Button>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse hybride en cours…
          </div>
        )}

        {hasRun && axes.length > 0 && (
          <div className="space-y-1.5">
            {axes.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                <span className={`shrink-0 ${sourceColor(a.source)}`}>
                  {sourceIcon(a.source)}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium capitalize">{a.axis}</span>
                  <p className="text-[11px] text-muted-foreground truncate">{a.sub_query}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {Math.round(a.confidence * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        )}

        {hasRun && axes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Aucun axe fan-out détecté pour cette requête.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
