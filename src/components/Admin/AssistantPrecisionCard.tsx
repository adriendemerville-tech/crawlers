import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Phone, RotateCcw, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AssistantStats {
  total: number;
  scored: number;
  avgScore: number | null;
  escalationRate: number;
  repeatedIntentRate: number;
  routeMatchRate: number;
  avgUserMessages: number;
}

export function AssistantPrecisionCard() {
  const [stats, setStats] = useState<AssistantStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: scores }, { data: convos }] = await Promise.all([
      supabase
        .from('sav_quality_scores' as any)
        .select('precision_score, escalated_to_phone, repeated_intent_count, route_match, user_message_count')
        .gte('scored_at', sevenDaysAgo),
      supabase
        .from('sav_conversations')
        .select('id')
        .gte('created_at', sevenDaysAgo),
    ]);

    const s = (scores as any[]) || [];
    const total = (convos as any[])?.length || 0;
    const scored = s.length;
    const avgScore = scored > 0 ? Math.round(s.reduce((a, q) => a + (q.precision_score || 0), 0) / scored) : null;
    const escalations = s.filter(q => q.escalated_to_phone).length;
    const repeated = s.filter(q => q.repeated_intent_count > 0).length;
    const routeMatches = s.filter(q => q.route_match === true).length;
    const avgMsgs = scored > 0 ? Math.round((s.reduce((a, q) => a + (q.user_message_count || 0), 0) / scored) * 10) / 10 : 0;

    setStats({
      total,
      scored,
      avgScore,
      escalationRate: total > 0 ? Math.round((escalations / total) * 100) : 0,
      repeatedIntentRate: scored > 0 ? Math.round((repeated / scored) * 100) : 0,
      routeMatchRate: scored > 0 ? Math.round((routeMatches / scored) * 100) : 0,
      avgUserMessages: avgMsgs,
    });
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const scoreColor = stats.avgScore === null
    ? 'text-muted-foreground'
    : stats.avgScore >= 70 ? 'text-emerald-500'
    : stats.avgScore >= 40 ? 'text-orange-400'
    : 'text-destructive';

  const statusLabel = stats.avgScore === null
    ? 'Pas de données'
    : stats.avgScore >= 70 ? 'Sain'
    : stats.avgScore >= 40 ? 'À surveiller'
    : 'Critique';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4.5 w-4.5 text-primary" />
          Précision Assistant SAV
          <Badge variant="secondary" className="text-xs">{statusLabel}</Badge>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchStats}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">7 derniers jours</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Score moyen */}
          <div className="text-center space-y-1">
            <p className={cn('text-3xl font-bold', scoreColor)}>
              {stats.avgScore !== null ? `${stats.avgScore}` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score moyen /100</p>
          </div>

          {/* Conversations */}
          <div className="text-center space-y-1">
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conversations</p>
          </div>

          {/* Route match */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Target className="h-4 w-4 text-emerald-500" />
              <p className="text-3xl font-bold text-foreground">{stats.routeMatchRate}%</p>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Navigation correcte</p>
          </div>

          {/* Escalation */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Phone className="h-4 w-4 text-orange-400" />
              <p className="text-3xl font-bold text-foreground">{stats.escalationRate}%</p>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Escalade téléphone</p>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {stats.repeatedIntentRate > 20 ? (
              <TrendingDown className="h-3 w-3 text-destructive" />
            ) : (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            )}
            <span>Intentions répétées : <strong className="text-foreground">{stats.repeatedIntentRate}%</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>Msg moy./conv. : <strong className="text-foreground">{stats.avgUserMessages}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Target className="h-3 w-3" />
            <span>Scorées : <strong className="text-foreground">{stats.scored}/{stats.total}</strong></span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
