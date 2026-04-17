/**
 * GeoFanOutClustersCard — couverture Fan-Out par cluster thématique.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Network } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props { trackedSiteId: string; }

interface ClusterCoverage {
  id: string;
  name: string;
  ring: number;
  coverage: number;
  maturity: number;
  gaps: number;
  gaps_volume: number;
}

export function GeoFanOutClustersCard({ trackedSiteId }: Props) {
  const [clusters, setClusters] = useState<ClusterCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) return;
    setLoading(true);
    supabase
      .from('geo_kpi_snapshots')
      .select('cluster_coverage')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const list = Array.isArray(data?.cluster_coverage) ? (data!.cluster_coverage as unknown as ClusterCoverage[]) : [];
        setClusters(list.sort((a, b) => a.coverage - b.coverage).slice(0, 8));
        setLoading(false);
      });
  }, [trackedSiteId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <Link to="/lexique/query-fan-out" className="hover:underline">Fan-Out par cluster</Link>
        </CardTitle>
        <CardDescription>Couverture des sous-requêtes RAG par thématique. Trie ascendant pour identifier les angles morts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : clusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun cluster défini. Lancez l'audit stratégique pour cartographier vos thématiques.
          </p>
        ) : (
          clusters.map((c) => (
            <div key={c.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate">
                  <span className="text-muted-foreground mr-1.5 font-mono text-[10px]">R{c.ring}</span>
                  {c.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {c.coverage.toFixed(0)}%
                  {c.gaps > 0 && <span className="ml-2 text-amber-500">{c.gaps} gaps</span>}
                </span>
              </div>
              <Progress value={c.coverage} className="h-1.5" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
