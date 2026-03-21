import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { 
  Link2, Copy, Check, ShieldCheck, ShieldAlert, AlertTriangle
} from 'lucide-react';

interface ScribeResultsPanelProps {
  result: any;
}

export function ScribeResultsPanel({ result }: ScribeResultsPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-4">
        {/* Coherence guardrail banner */}
        {result.coherence_check && (
          <Card className={`border ${
            result.coherence_check.innovation_level === 'disruptive' 
              ? 'border-amber-500/50 bg-amber-500/5' 
              : 'border-emerald-500/50 bg-emerald-500/5'
          }`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                {result.coherence_check.innovation_level === 'disruptive' ? (
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                )}
                <span className="text-xs font-medium">Garde-fous cohérence</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px]">
                  Innovation: {result.coherence_check.innovation_level}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Fit secteur: {result.coherence_check.sector_fit}%
                </Badge>
                {result.coherence_check.tone_continuity && (
                  <Badge variant="outline" className="text-[10px]">
                    Ton: {result.coherence_check.tone_continuity}%
                  </Badge>
                )}
              </div>
              {result.guardrail_warnings?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.guardrail_warnings.map((w: string, i: number) => (
                    <div key={i} className="flex items-start gap-1 text-[10px] text-amber-600">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recommended structure */}
        {result.recommended_structure && (
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Structure recommandée</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(result.recommended_structure, null, 2))}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap overflow-hidden font-mono bg-muted/50 p-2 rounded">
                {JSON.stringify(result.recommended_structure, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Schema.org / Metadata */}
        {result.recommended_metadata && (
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Métadonnées & Schema.org</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(result.recommended_metadata, null, 2))}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap overflow-hidden font-mono bg-muted/50 p-2 rounded">
                {JSON.stringify(result.recommended_metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Keywords */}
        {result.keyword_analysis && (
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <span className="text-sm font-medium block mb-2">Analyse mots-clés</span>
              <div className="flex flex-wrap gap-1">
                {(result.keyword_analysis.primary_keywords || []).map((kw: any, i: number) => (
                  <Badge key={i} className="text-[10px] bg-primary/10 text-primary">
                    {typeof kw === 'string' ? kw : kw.keyword} 
                    {kw.volume && <span className="ml-1 opacity-60">({kw.volume})</span>}
                  </Badge>
                ))}
                {(result.keyword_analysis.secondary_keywords || []).map((kw: any, i: number) => (
                  <Badge key={`s-${i}`} variant="outline" className="text-[10px]">
                    {typeof kw === 'string' ? kw : kw.keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Internal links (Cocoon) */}
        {result.internal_links && result.internal_links.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="p-3">
              <span className="text-sm font-medium block mb-2">🕸️ Maillage interne suggéré</span>
              <div className="space-y-1">
                {result.internal_links.map((link: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-primary truncate">{link.anchor || link.url}</span>
                    <span className="text-muted-foreground text-[10px]">→ {link.url}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
