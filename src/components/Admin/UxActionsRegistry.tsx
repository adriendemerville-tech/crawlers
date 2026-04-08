import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Palette, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UxDirective {
  id: string;
  directive_text: string;
  status: string;
  target_component: string | null;
  target_url: string | null;
  consumed_at: string | null;
  created_at: string;
}

export function UxActionsRegistry() {
  const [directives, setDirectives] = useState<UxDirective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDirectives();
  }, []);

  const loadDirectives = async () => {
    try {
      const { data } = await supabase
        .from('agent_ux_directives')
        .select('id, directive_text, status, target_component, target_url, consumed_at, created_at')
        .in('status', ['consumed', 'done', 'completed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(50);
      setDirectives((data as any[]) || []);
    } catch (e) {
      console.error('Load UX directives error:', e);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'consumed' || s === 'done' || s === 'completed') return 'default';
    if (s === 'failed') return 'destructive';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Historique actions Agent UX</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : directives.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune action UX passée.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {directives.map((d) => (
              <div key={d.id} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{d.directive_text}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(d.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                    {d.target_component && (
                      <Badge variant="outline" className="text-[10px]">{d.target_component}</Badge>
                    )}
                    {d.target_url && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{d.target_url}</span>
                    )}
                  </div>
                </div>
                <Badge variant={statusColor(d.status)} className="text-[10px] shrink-0">
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
