import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Copy, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface ScanRecommendation {
  family: string;
  severity: 'critical' | 'important' | 'minor';
  key: string;
  title: string;
  explanation: string;
  ready_to_paste: string;
  payload_type: string;
  url_pattern: string;
}

export interface SignalCardProps {
  family: string;
  label: string;
  score: number;
  max: number;
  detected: Record<string, unknown>;
  recommendations: ScanRecommendation[];
}

function severityIcon(s: ScanRecommendation['severity']) {
  if (s === 'critical') return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (s === 'important') return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

function severityLabel(s: ScanRecommendation['severity']) {
  if (s === 'critical') return 'Critique';
  if (s === 'important') return 'Important';
  return 'Mineur';
}

export function SignalCard({ family, label, score, max, detected, recommendations }: SignalCardProps) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((score / Math.max(1, max)) * 100);
  const ringColor = pct >= 80 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-destructive';

  const hasRecos = recommendations.length > 0;

  const detectedEntries = Object.entries(detected).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && Object.keys(v as object).length === 0) return false;
    return true;
  });

  return (
    <Card className="border-border/60 bg-card/40 backdrop-blur-sm transition-all">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-muted/20"
        aria-expanded={open}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2', ringColor, 'border-current')}>
            <span className="text-sm font-bold">{score}<span className="text-xs opacity-60">/{max}</span></span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{label}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {detectedEntries.length} signal{detectedEntries.length > 1 ? 'aux' : ''} détecté{detectedEntries.length > 1 ? 's' : ''}
              {hasRecos && ` · ${recommendations.length} recommandation${recommendations.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasRecos && (
            <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">
              {recommendations.length} à corriger
            </Badge>
          )}
          {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 py-4 space-y-4">
          {/* Détecté */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Détecté sur la page
            </h4>
            {detectedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Rien détecté.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detectedEntries.map(([k, v]) => {
                  const isComplex = Array.isArray(v) || (typeof v === 'object' && v !== null);
                  const rendered = typeof v === 'string'
                    ? v
                    : isComplex
                      ? JSON.stringify(v, null, 2)
                      : String(v);
                  return (
                    <li key={k} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                      <span className="text-muted-foreground font-mono text-xs shrink-0 w-full sm:w-44 break-all sm:break-normal sm:truncate" title={k}>{k}</span>
                      {isComplex ? (
                        <pre className="flex-1 overflow-x-auto rounded bg-muted/40 p-2 text-[11px] leading-snug text-foreground/90 font-mono whitespace-pre-wrap break-all">
                          <code>{rendered}</code>
                        </pre>
                      ) : (
                        <span className="text-foreground font-mono text-xs break-all whitespace-pre-wrap">{rendered}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recommandations */}
          {hasRecos && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Recommandations rédigées
              </h4>
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-background/60 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {severityIcon(r.severity)}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{r.title}</p>
                          {r.explanation && <p className="text-xs text-muted-foreground mt-0.5">{r.explanation}</p>}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">{severityLabel(r.severity)}</Badge>
                    </div>
                    {r.ready_to_paste && (
                      <div className="relative mt-2">
                        <pre className="overflow-x-auto rounded bg-muted/40 p-2.5 text-[11px] leading-snug text-foreground/90 max-h-40">
                          <code>{r.ready_to_paste}</code>
                        </pre>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="absolute top-1.5 right-1.5 h-7 px-2"
                          onClick={() => {
                            navigator.clipboard.writeText(r.ready_to_paste);
                            toast.success('Copié dans le presse-papiers');
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copier
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
