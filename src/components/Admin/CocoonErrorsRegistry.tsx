import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Eye, CheckCircle2, XCircle, Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CocoonError {
  id: string;
  created_at: string;
  user_id: string;
  domain: string;
  url_crawled: string | null;
  is_crawled: boolean;
  problem_description: string;
  screenshot_url: string | null;
  user_question: string | null;
  ai_response: string | null;
  status: string;
}

export function CocoonErrorsRegistry() {
  const [errors, setErrors] = useState<CocoonError[]>([]);
  const [loading, setLoading] = useState(true);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cocoon_errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100) as { data: CocoonError[] | null };
      if (data) setErrors(data);
      setLoading(false);
    })();
  }, []);

  const markResolved = async (id: string) => {
    await supabase.from('cocoon_errors').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
    setErrors(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4.5 w-4.5 text-violet-500" />
            Erreurs Cocoon
            <Badge variant="secondary" className="text-xs">{errors.filter(e => e.status === 'open').length} ouvertes</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune erreur Cocoon signalée.</p>
          ) : (
            <div className="space-y-2">
              {errors.map(err => (
                <div key={err.id} className={`p-3 rounded-lg border text-sm space-y-1.5 ${err.status === 'resolved' ? 'opacity-50 bg-muted/30' : 'bg-card'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {err.status === 'open' ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      )}
                      <span className="font-medium truncate">{err.domain}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {err.is_crawled ? 'Crawlé' : 'Non crawlé'}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(err.created_at).toLocaleDateString('fr-FR')} {new Date(err.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {err.url_crawled && (
                    <p className="text-[11px] text-muted-foreground truncate">URL: {err.url_crawled}</p>
                  )}

                  <p className="text-xs">{err.problem_description}</p>

                  {err.user_question && (
                    <div className="p-2 rounded bg-violet-500/10 text-[11px]">
                      <span className="font-medium text-violet-400">Question :</span> {err.user_question}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    {err.screenshot_url && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setScreenshotUrl(err.screenshot_url)}>
                        <Eye className="h-3 w-3" />
                        Capture
                      </Button>
                    )}
                    {err.status === 'open' && (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-success" onClick={() => markResolved(err.id)}>
                        <CheckCircle2 className="h-3 w-3" />
                        Résolu
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!screenshotUrl} onOpenChange={() => setScreenshotUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Capture d'écran Cocoon</DialogTitle>
          </DialogHeader>
          {screenshotUrl && (
            <img src={screenshotUrl} alt="Cocoon screenshot" className="w-full rounded-lg border" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
