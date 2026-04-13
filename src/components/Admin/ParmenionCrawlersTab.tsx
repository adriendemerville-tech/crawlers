import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Globe, CheckCircle, XCircle, HelpCircle, FileText, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CrawlResult, BotResult } from '@/types/crawler';

function BotStatusCard({ bot }: { bot: BotResult }) {
  const config = {
    allowed: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', label: 'Autorisé' },
    blocked: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', label: 'Bloqué' },
    unknown: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: 'Inconnu' },
  }[bot.status];
  const Icon = config.icon;

  return (
    <Card className={cn('p-4 transition-all hover:shadow-md', config.border)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{bot.name}</h3>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
              <Icon className="h-3 w-3" />
              {config.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{bot.company}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70 font-mono">{bot.userAgent}</p>
          {bot.reason && <p className="mt-2 text-xs text-muted-foreground">{bot.reason}</p>}
          {bot.blockSource && (
            <p className="mt-1 text-xs text-muted-foreground/60">
              Source: {bot.blockSource}{bot.lineNumber ? ` (ligne ${bot.lineNumber})` : ''}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ParmenionCrawlersTab() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [history, setHistory] = useState<Array<{ url: string; result: CrawlResult; timestamp: string }>>([]);

  const handleScan = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('check-crawlers', {
        body: { url: url.trim() }
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Échec du scan');

      const crawlResult = data.data as CrawlResult;
      setResult(crawlResult);
      setHistory(prev => [{ url: url.trim(), result: crawlResult, timestamp: new Date().toISOString() }, ...prev].slice(0, 10));
      toast({ title: 'Scan terminé', description: `${crawlResult.bots.length} bots vérifiés pour ${url}` });
    } catch (err: any) {
      console.error('[parmenion-crawlers]', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const allowedCount = result?.bots.filter(b => b.status === 'allowed').length ?? 0;
  const blockedCount = result?.bots.filter(b => b.status === 'blocked').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Scan input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Vérification des crawlers IA
          </CardTitle>
          <CardDescription>
            Analysez robots.txt, meta tags et statuts HTTP pour détecter les blocages de crawlers IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              className="flex-1"
            />
            <Button onClick={handleScan} disabled={isLoading || !url.trim()} className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Scanner
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-3 rounded-full bg-primary/10 px-6 py-3">
            <div className="relative h-5 w-5">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/50" />
              <div className="relative h-5 w-5 rounded-full bg-primary" />
            </div>
            <span className="text-lg font-medium text-primary">Scan en cours…</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <>
          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      {result.url}
                      <a href={result.url.startsWith('http') ? result.url : `https://${result.url}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> HTTP {result.httpStatus}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(result.scannedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="rounded-lg bg-success/10 px-4 py-2 text-center">
                    <div className="text-2xl font-bold text-success">{allowedCount}</div>
                    <div className="text-xs text-success/80">Autorisés</div>
                  </div>
                  <div className="rounded-lg bg-destructive/10 px-4 py-2 text-center">
                    <div className="text-2xl font-bold text-destructive">{blockedCount}</div>
                    <div className="text-xs text-destructive/80">Bloqués</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bot cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.bots.map((bot, i) => (
              <BotStatusCard key={bot.name} bot={bot} />
            ))}
          </div>

          {/* Robots.txt raw */}
          {result.robotsTxt && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">robots.txt</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap font-mono">
                  {result.robotsTxt}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historique de session</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h, i) => {
                const blocked = h.result.bots.filter(b => b.status === 'blocked').length;
                return (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                    <button onClick={() => { setUrl(h.url); setResult(h.result); }} className="text-primary hover:underline truncate max-w-[60%] text-left">
                      {h.url}
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge variant={blocked > 0 ? 'destructive' : 'secondary'} className="text-xs">
                        {blocked > 0 ? `${blocked} bloqué${blocked > 1 ? 's' : ''}` : 'OK'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
