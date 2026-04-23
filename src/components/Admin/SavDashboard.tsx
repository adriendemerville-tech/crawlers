import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Phone, Clock, RefreshCw, User, ChevronDown, ChevronUp, Target, AlertTriangle, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface SavConversation {
  id: string;
  user_id: string;
  user_email: string | null;
  messages: any[];
  message_count: number;
  escalated: boolean;
  phone_callback: string | null;
  phone_callback_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QualityStats {
  avgScore: number | null;
  totalScored: number;
  escalations: number;
  repeatedIntents: number;
  avgMessages: number;
}

export function SavDashboard() {
  const [conversations, setConversations] = useState<SavConversation[]>([]);
  const [churnFeedbacks, setChurnFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qualityStats, setQualityStats] = useState<QualityStats>({
    avgScore: null, totalScored: 0, escalations: 0, repeatedIntents: 0, avgMessages: 0,
  });

  const fetchConversations = async () => {
    setLoading(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [convResult, qualityResult, feedbackResult] = await Promise.all([
      supabase
        .from('sav_conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100),
      supabase
        .from('sav_quality_scores' as any)
        .select('precision_score, escalated_to_phone, repeated_intent_count, user_message_count')
        .gte('scored_at', sevenDaysAgo),
      supabase
        .from('churn_feedback' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (!convResult.error && convResult.data) {
      setConversations(convResult.data as SavConversation[]);
    }

    if (!qualityResult.error && qualityResult.data) {
      const scores = qualityResult.data as any[];
      const scored = scores.length;
      const avgScore = scored > 0
        ? Math.round(scores.reduce((a, q) => a + (q.precision_score || 0), 0) / scored)
        : null;
      const escalations = scores.filter(q => q.escalated_to_phone).length;
      const repeatedIntents = scores.filter(q => q.repeated_intent_count > 0).length;
      const avgMessages = scored > 0
        ? Math.round(scores.reduce((a, q) => a + (q.user_message_count || 0), 0) / scored * 10) / 10
        : 0;
      setQualityStats({ avgScore, totalScored: scored, escalations, repeatedIntents, avgMessages });
    }

    if (!feedbackResult.error && feedbackResult.data) {
      setChurnFeedbacks(feedbackResult.data as any[]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchConversations(); }, []);

  const stats = {
    total: conversations.length,
    escalated: conversations.filter(c => c.escalated).length,
    phoneCallbacks: conversations.filter(c => c.phone_callback).length,
    today: conversations.filter(c => {
      const d = new Date(c.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Conversations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.today}</p>
            <p className="text-xs text-muted-foreground">Aujourd'hui</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{stats.escalated}</p>
            <p className="text-xs text-muted-foreground">Escaladées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.phoneCallbacks}</p>
            <p className="text-xs text-muted-foreground">Rappels demandés</p>
          </CardContent>
        </Card>
      </div>

      {/* Quality Scoring (7 derniers jours) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Scoring précision Félix (7 jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center">
              <p className={cn(
                'text-2xl font-bold',
                qualityStats.avgScore !== null && qualityStats.avgScore >= 70 ? 'text-emerald-500' :
                qualityStats.avgScore !== null && qualityStats.avgScore >= 50 ? 'text-amber-500' : 'text-destructive'
              )}>
                {qualityStats.avgScore !== null ? `${qualityStats.avgScore}%` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">Score moyen</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{qualityStats.totalScored}</p>
              <p className="text-xs text-muted-foreground">Évaluées</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{qualityStats.escalations}</p>
              <p className="text-xs text-muted-foreground">Escalades tél.</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{qualityStats.repeatedIntents}</p>
              <p className="text-xs text-muted-foreground">Intent répétés</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{qualityStats.avgMessages}</p>
              <p className="text-xs text-muted-foreground">Msg moy./conv</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversations list */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Registre des conversations SAV IA
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchConversations} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[600px]">
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Aucune conversation SAV enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {conversations.map(conv => (
                  <div key={conv.id} className="border rounded-lg overflow-hidden">
                    {/* Summary row */}
                    <button
                      onClick={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conv.user_email || conv.user_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conv.updated_at), 'dd MMM yyyy HH:mm', { locale: fr })} · {conv.message_count} msg
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {conv.phone_callback && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300 text-[10px] gap-1">
                            <Phone className="h-3 w-3" />
                            {conv.phone_callback}
                          </Badge>
                        )}
                        {conv.escalated && (
                          <Badge variant="destructive" className="text-[10px]">Escalade</Badge>
                        )}
                        {expandedId === conv.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {/* Expanded messages */}
                    {expandedId === conv.id && (
                      <div className="border-t bg-muted/20 p-3 space-y-2 max-h-80 overflow-y-auto">
                        {(conv.messages as any[]).map((msg: any, i: number) => (
                          <div key={i} className={cn('flex', msg.role === 'assistant' ? 'justify-start' : 'justify-end')}>
                            <div className={cn(
                              'max-w-[80%] rounded-lg px-3 py-2 text-xs',
                              msg.role === 'assistant'
                                ? 'bg-violet-100 dark:bg-violet-900/40'
                                : 'bg-primary/10'
                            )}>
                              <span className="font-medium block mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {msg.role === 'assistant' ? 'Crawler' : 'Utilisateur'}
                              </span>
                              <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:m-0">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      {/* Churn Feedback */}
      {churnFeedbacks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Avis de désabonnement ({churnFeedbacks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {churnFeedbacks.map((fb: any) => (
                  <div key={fb.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(fb.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </p>
                      <div className="flex gap-1">
                        {fb.plan_type && <Badge variant="outline" className="text-[10px]">{fb.plan_type}</Badge>}
                        {fb.billing_period === 'annual' && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">Annuel</Badge>}
                      </div>
                    </div>
                    <p className="text-sm text-foreground">{fb.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
