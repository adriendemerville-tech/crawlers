import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, CheckCircle2, AlertTriangle, XCircle, Copy, ChevronDown, Store, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SchemaSignal {
  key: string;
  label: string;
  status: 'ok' | 'missing' | 'generic';
  recommendation: string;
  priority: 'critical' | 'high' | 'medium';
}

interface AuditResult {
  is_local_business: boolean;
  detection_confidence: number;
  schema_audit: {
    score: number;
    status: 'missing' | 'partial' | 'complete';
    signals: SchemaSignal[];
    recommended_type: string;
  };
  generated_schema: Record<string, unknown> | null;
  gmb_data_used: boolean;
}

interface Props {
  url: string;
  domain: string;
  schemaTypes: string[];
  /** Pass raw HTML if available from the audit data */
  htmlContent?: string;
}

const LOCAL_TYPES = new Set([
  'LocalBusiness', 'Restaurant', 'Store', 'Hotel', 'Dentist', 'Physician',
  'HairSalon', 'BeautySalon', 'Bakery', 'CafeOrCoffeeShop', 'BarOrPub',
  'AutoRepair', 'ExerciseGym', 'Florist', 'Pharmacy', 'Attorney',
  'RealEstateAgent', 'Plumber', 'Electrician', 'VeterinaryCare',
  'ClothingStore', 'FurnitureStore', 'JewelryStore',
]);

/** Checks if any detected schema type is a LocalBusiness subtype */
function hasLocalSchemaType(types: string[]): boolean {
  return types.some(t => LOCAL_TYPES.has(t));
}

export function LocalBusinessDiagnosticCard({ url, domain, schemaTypes, htmlContent }: Props) {
  const { user } = useAuth();
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const hasLocalType = hasLocalSchemaType(schemaTypes);

  // Auto-trigger for sites with local schema detected
  const runDiagnostic = useCallback(async () => {
    if (loading || !user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('audit-local-schema', {
        body: {
          tracked_site_id: null, // Will use URL-based detection
          user_id: user.id,
          html_content: htmlContent || '',
          url,
          domain,
        },
      });
      if (error) throw error;
      setResult(data);
      if (data.is_local_business) setOpen(true);
    } catch (err) {
      console.error('LocalBusiness diagnostic error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, url, domain, htmlContent, loading]);

  // Auto-trigger when local signals detected via schema types
  useEffect(() => {
    if (hasLocalType && !autoTriggered && user?.id) {
      setAutoTriggered(true);
      runDiagnostic();
    }
  }, [hasLocalType, autoTriggered, user?.id, runDiagnostic]);

  const copySchema = useCallback(() => {
    if (!result?.generated_schema) return;
    const script = `<script type="application/ld+json">\n${JSON.stringify(result.generated_schema, null, 2)}\n</script>`;
    navigator.clipboard.writeText(script);
    toast.success('Schema JSON-LD copié !');
  }, [result]);

  // Don't render if no local type detected and no result yet
  if (!hasLocalType && !result) return null;
  // If explicitly not local, don't show
  if (result && !result.is_local_business) return null;

  const audit = result?.schema_audit;
  const statusColor = !audit ? 'border-border' :
    audit.status === 'complete' ? 'border-emerald-500/40' :
    audit.status === 'partial' ? 'border-amber-500/40' : 'border-red-500/40';

  return (
    <Card className={cn('transition-colors', statusColor)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-2 hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-sm flex-1">Schema LocalBusiness</CardTitle>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {audit && (
                <Badge variant="outline" className={cn(
                  'text-[10px]',
                  audit.status === 'complete' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' :
                  audit.status === 'partial' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' :
                  'bg-red-500/15 text-red-500 border-red-500/30'
                )}>
                  {audit.score}/100
                </Badge>
              )}
              {!result && !loading && (
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={(e) => { e.stopPropagation(); runDiagnostic(); }}>
                  <Store className="h-3 w-3" /> Diagnostiquer
                </Button>
              )}
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {audit && (
              <>
                {/* Type & GMB status */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-muted-foreground">Type recommandé :</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">{audit.recommended_type}</Badge>
                  {result?.gmb_data_used && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                      Google Business ✓
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    Confiance {result?.detection_confidence}%
                  </Badge>
                </div>

                {/* 6 signals */}
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
                        <span className={cn(
                          'font-medium',
                          signal.priority === 'critical' ? 'text-red-500' :
                          signal.priority === 'high' ? 'text-amber-500' : 'text-muted-foreground'
                        )}>{signal.label}</span>
                        <p className="text-muted-foreground leading-tight">{signal.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Generated schema */}
                {result?.generated_schema && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium">Schema JSON-LD pré-rempli</span>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1 ml-auto" onClick={copySchema}>
                        <Copy className="h-3 w-3" /> Copier
                      </Button>
                    </div>
                    <pre className="text-[10px] bg-muted/50 rounded-md p-3 overflow-auto max-h-48 text-muted-foreground font-mono leading-relaxed">
                      {JSON.stringify(result.generated_schema, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
