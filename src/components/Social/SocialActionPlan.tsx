/**
 * Social Action Plan — Shows prioritized workbench items for social content creation.
 */
import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, ArrowRight, TrendingUp, Target, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SocialActionPlanProps {
  domain: string;
  trackedSiteId: string;
  onCreateFromItem?: (item: any) => void;
}

export const SocialActionPlan = memo(function SocialActionPlan({ domain, trackedSiteId, onCreateFromItem }: SocialActionPlanProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domain) return;
    supabase.rpc('score_workbench_priority', {
      p_domain: domain,
      p_user_id: (supabase as any).auth?.user?.()?.id,
      p_limit: 15,
      p_lane: 'content',
    }).then(({ data }) => {
      setItems(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [domain]);

  const severityColor = (s: string) => {
    if (s === 'critical') return 'bg-destructive/20 text-destructive';
    if (s === 'high') return 'bg-orange-500/20 text-orange-600';
    if (s === 'medium') return 'bg-yellow-500/20 text-yellow-600';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" /> Plan d'actions social
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Lancez un audit pour alimenter le plan d'actions</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors group">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <Badge className={`text-[10px] ${severityColor(item.severity)}`}>{item.severity}</Badge>
                      {item.priority_tag === 'seasonal' && <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/30"><TrendingUp className="h-3 w-3 mr-0.5" /> Saisonnier</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{item.finding_category}</span>
                      <span className="text-[10px] text-primary font-medium">Score: {item.total_score}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onCreateFromItem?.(item)}>
                    <Sparkles className="h-4 w-4 mr-1" /> Créer post
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
});
