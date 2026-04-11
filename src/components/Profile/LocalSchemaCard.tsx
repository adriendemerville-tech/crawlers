import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, CheckCircle2, AlertTriangle, XCircle, Copy, RefreshCw, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocalSchemaCardProps {
  trackedSiteId: string;
  domain: string;
  userId: string;
}

interface SchemaSignal {
  key: string;
  label: string;
  status: 'ok' | 'missing' | 'generic';
  recommendation: string;
  priority: 'critical' | 'high' | 'medium';
}

interface LocalSchemaAudit {
  score: number;
  status: 'unknown' | 'missing' | 'partial' | 'complete';
  signals: SchemaSignal[];
  recommended_type: string;
  detection_confidence: number;
  gmb_connected: boolean;
  audited_at: string;
}

const STATUS_COLORS: Record<string, { badge: string; icon: typeof CheckCircle2 }> = {
  complete: { badge: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: CheckCircle2 },
  partial: { badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30', icon: AlertTriangle },
  missing: { badge: 'bg-red-500/15 text-red-500 border-red-500/30', icon: XCircle },
  unknown: { badge: 'bg-muted text-muted-foreground border-border', icon: Store },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-amber-500',
  medium: 'text-muted-foreground',
};

export function LocalSchemaCard({ trackedSiteId, domain, userId }: LocalSchemaCardProps) {
  const [audit, setAudit] = useState<LocalSchemaAudit | null>(null);
  const [isLocal, setIsLocal] = useState<boolean | null>(null);
  const [generatedSchema, setGeneratedSchema] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load existing data from tracked_sites
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tracked_sites')
        .select('is_local_business, local_schema_status, local_schema_audit')
        .eq('id', trackedSiteId)
        .single();

      if (data) {
        setIsLocal((data as any).is_local_business ?? null);
        const auditData = (data as any).local_schema_audit as LocalSchemaAudit | null;
        if (auditData) setAudit(auditData);
      }
      setInitialLoaded(true);
    })();
  }, [trackedSiteId]);

  const runAudit = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-local-schema', {
        body: { tracked_site_id: trackedSiteId, user_id: userId },
      });

      if (error) throw error;

      setIsLocal(data.is_local_business);
      setAudit(data.schema_audit ? {
        score: data.schema_audit.score,
        status: data.schema_audit.status,
        signals: data.schema_audit.signals,
        recommended_type: data.schema_audit.recommended_type,
        detection_confidence: data.detection_confidence,
        gmb_connected: data.gmb_data_used,
        audited_at: new Date().toISOString(),
      } : null);
      setGeneratedSchema(data.generated_schema);

      toast.success(data.is_local_business
        ? `Business local détecté (confiance ${data.detection_confidence}%) — Schema ${data.schema_audit?.status}`
        : 'Ce site ne semble pas être un business local'
      );
    } catch (err) {
      console.error('Local schema audit error:', err);
      toast.error('Erreur lors de l\'audit LocalBusiness');
    } finally {
      setLoading(false);
    }
  }, [trackedSiteId, userId]);

  const copySchema = useCallback(() => {
    if (!generatedSchema) return;
    const script = `<script type="application/ld+json">\n${JSON.stringify(generatedSchema, null, 2)}\n</script>`;
    navigator.clipboard.writeText(script);
    toast.success('Schema JSON-LD copié dans le presse-papiers');
  }, [generatedSchema]);

  if (!initialLoaded) return null;

  // If not a local business and never audited, show a compact trigger
  if (isLocal === null || (isLocal === false && !audit)) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Schema LocalBusiness</p>
            <p className="text-xs text-muted-foreground">Détectez si ce site est un business local et auditez son schema structuré</p>
          </div>
          <Button variant="outline" size="sm" onClick={runAudit} disabled={loading} className="shrink-0 gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Store className="h-3.5 w-3.5" />}
            Analyser
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not a local business
  if (isLocal === false) {
    return (
      <Card className="border-dashed opacity-60">
        <CardContent className="py-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Ce site n'est pas détecté comme un business local</p>
          <Button variant="ghost" size="sm" onClick={runAudit} disabled={loading} className="shrink-0 ml-auto">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Local business with audit data
  const statusConfig = STATUS_COLORS[audit?.status || 'unknown'];
  const StatusIcon = statusConfig.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary shrink-0" />
          <CardTitle className="text-sm">Schema LocalBusiness</CardTitle>
          {audit && (
            <Badge variant="outline" className={`ml-auto text-[10px] ${statusConfig.badge}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {audit.score}/100
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={runAudit} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {audit && (
          <>
            {/* Recommended type */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Type recommandé :</span>
              <Badge variant="secondary" className="text-[10px]">{audit.recommended_type}</Badge>
              {audit.gmb_connected && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                  GMB ✓
                </Badge>
              )}
            </div>

            {/* 6 signals audit */}
            <div className="space-y-1.5">
              {audit.signals.map(signal => (
                <div key={signal.key} className="flex items-start gap-2 text-xs">
                  {signal.status === 'ok' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : signal.status === 'generic' ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium ${PRIORITY_COLORS[signal.priority]}`}>{signal.label}</span>
                    <p className="text-muted-foreground leading-tight">{signal.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Generated schema */}
            {generatedSchema && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium">Schema JSON-LD généré</span>
                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1 ml-auto" onClick={copySchema}>
                    <Copy className="h-3 w-3" /> Copier
                  </Button>
                </div>
                <pre className="text-[10px] bg-muted/50 rounded-md p-3 overflow-auto max-h-48 text-muted-foreground font-mono leading-relaxed">
                  {JSON.stringify(generatedSchema, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
