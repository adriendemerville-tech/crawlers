/**
 * GeoDropDetectorCard — alertes de chute sur citation_rate (z-score hebdo).
 * Lit anomaly_alerts filtrées par metric_source='geo'.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface Props { trackedSiteId: string; }

interface Alert {
  id: string;
  metric_name: string;
  z_score: number;
  change_pct: number | null;
  severity: string;
  description: string;
  detected_at: string;
}

export function GeoDropDetectorCard({ trackedSiteId }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackedSiteId) return;
    setLoading(true);
    supabase
      .from('anomaly_alerts')
      .select('id, metric_name, z_score, change_pct, severity, description, detected_at')
      .eq('tracked_site_id', trackedSiteId)
      .eq('metric_source', 'geo')
      .eq('is_dismissed', false)
      .order('detected_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setAlerts((data as Alert[]) || []);
        setLoading(false);
      });
  }, [trackedSiteId]);

  const sevColor = (s: string) =>
    s === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/30' :
    s === 'warning' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' :
    'bg-muted text-muted-foreground border-border';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <Link to="/lexique/drop-detector" className="hover:underline">Drop Detector GEO</Link>
        </CardTitle>
        <CardDescription>Détection automatique des chutes de citation LLM (z-score hebdomadaire).</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Aucune chute détectée cette semaine.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className={sevColor(a.severity)}>
                  {a.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground truncate">{a.description}</p>
                  <p className="text-xs text-muted-foreground">
                    z={a.z_score.toFixed(1)}
                    {a.change_pct !== null && ` · ${a.change_pct > 0 ? '+' : ''}${a.change_pct.toFixed(0)}%`}
                    {' · '}
                    {new Date(a.detected_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
