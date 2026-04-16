import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Alert {
  id: string;
  domain: string;
  alert_type: string;
  severity: string;
  message: string;
  observed_value: number | null;
  threshold_value: number | null;
  is_acknowledged: boolean;
  created_at: string;
}

export function EditorialPipelineAlerts({ externalDomain }: { externalDomain?: string | null }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let q = (supabase as any)
      .from('editorial_pipeline_alerts')
      .select('*')
      .eq('is_acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (externalDomain) q = q.eq('domain', externalDomain);
    const { data } = await q;
    setAlerts((data ?? []) as Alert[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [externalDomain]);

  async function acknowledge(id: string) {
    await (supabase as any)
      .from('editorial_pipeline_alerts')
      .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading || alerts.length === 0) return null;

  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Alertes pipeline ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 border rounded-md p-2 text-xs">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={a.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
                  {a.severity}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{a.alert_type}</Badge>
                <span className="text-muted-foreground">{a.domain}</span>
              </div>
              <p>{a.message}</p>
              <p className="text-muted-foreground text-[10px]">
                {new Date(a.created_at).toLocaleString()}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => acknowledge(a.id)}
              className="gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              OK
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
