/**
 * GeoQualityCard — Quotability + Chunkability + AEO agrégés.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Quote, Layers, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  trackedSiteId: string;
}

interface Snapshot {
  quotability_avg: number | null;
  chunkability_avg: number | null;
  aeo_avg: number | null;
  position_zero_eligible_pages: number | null;
}

const Row = ({ icon, label, value, slug }: { icon: React.ReactNode; label: string; value: number | null; slug: string }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-foreground">
        {icon}
        <Link to={`/lexique/${slug}`} className="hover:underline">{label}</Link>
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        {value !== null && value !== undefined ? `${value.toFixed(0)}/100` : '—'}
      </span>
    </div>
    <Progress value={value ?? 0} className="h-1.5" />
  </div>
);

export function GeoQualityCard({ trackedSiteId }: Props) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) return;
    setLoading(true);
    supabase
      .from('geo_kpi_snapshots')
      .select('quotability_avg, chunkability_avg, aeo_avg, position_zero_eligible_pages')
      .eq('tracked_site_id', trackedSiteId)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => {
        setData(row as Snapshot | null);
        setLoading(false);
      });
  }, [trackedSiteId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          Qualité GEO du contenu
        </CardTitle>
        <CardDescription>Moyennes calculées sur le top 10 des pages stratégiques.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            <Row icon={<Quote className="h-3.5 w-3.5 text-muted-foreground" />} label="Quotability Index" value={data?.quotability_avg ?? null} slug="quotability-index" />
            <Row icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />} label="Chunkability Score" value={data?.chunkability_avg ?? null} slug="chunkability-score" />
            <Row icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />} label="AEO Score" value={data?.aeo_avg ?? null} slug="aeo-answer-engine-optimization" />
            <div className="pt-2 mt-3 border-t border-border text-sm flex items-center justify-between">
              <Link to="/lexique/position-zero" className="text-muted-foreground hover:underline">Pages éligibles Position Zéro</Link>
              <span className="font-mono text-xs text-foreground">{data?.position_zero_eligible_pages ?? 0}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
