import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Quote, Copy, Check } from 'lucide-react';
import type { QuotabilityIndex } from '@/types/newAuditMetrics';
import { MethodologyPopover } from './MethodologyPopover';

interface QuotabilityCardProps {
  data: QuotabilityIndex;
}

function CopyableQuote({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <blockquote className="relative border-l-2 border-primary/40 pl-3 py-2 text-sm text-foreground/90 italic bg-muted/30 rounded-r-lg pr-8">
      "{text}"
      <button 
        onClick={handleCopy} 
        className="absolute top-2 right-2 p-1 rounded hover:bg-muted transition-colors"
        title="Copier"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </blockquote>
  );
}

export function QuotabilityCard({ data }: QuotabilityCardProps) {
  const scoreColor = data.score >= 80 ? 'text-success' : data.score >= 50 ? 'text-warning' : 'text-destructive';

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Quote className="h-4.5 w-4.5 text-primary" />
            </div>
            Indice de Citabilité (Quotability)
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.quotes.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground">{data.quotes.length} phrase(s) citable(s) par les LLM :</p>
            <div className="space-y-2">
              {data.quotes.map((quote, i) => (
                <CopyableQuote key={i} text={quote} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucune phrase suffisamment factuelle et autonome pour être citée par un LLM.</p>
        )}
      </CardContent>
    </Card>
  );
}
