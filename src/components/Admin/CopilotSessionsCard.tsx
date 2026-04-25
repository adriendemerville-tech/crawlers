/**
 * CopilotSessionsCard — vue admin des sessions Copilot Félix.
 *
 * Source : tables `copilot_sessions` + `copilot_actions` (architecture 1 backend / N personas).
 * Coexiste avec le legacy `sav_conversations` (toujours affiché tant que la migration
 * fonctionnelle n'est pas finalisée — escalades phone/quality scores).
 *
 * Sprint Q4.6 — clôture du chantier "Refactor Admin/SavDashboard sur copilot_*".
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, ChevronDown, ChevronUp, RefreshCw, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface SessionRow {
  id: string;
  user_id: string;
  title: string | null;
  status: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface ActionRow {
  id: string;
  session_id: string;
  skill: string;
  input: any;
  output: any;
  status: string;
  created_at: string;
}

export function CopilotSessionsCard() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionsBySession, setActionsBySession] = useState<Record<string, ActionRow[]>>({});
  const [loadingActions, setLoadingActions] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('copilot_sessions')
      .select('id, user_id, title, status, last_message_at, created_at')
      .eq('persona', 'felix')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50);
    if (!error && data) {
      setSessions(data as SessionRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const toggle = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    if (!actionsBySession[sessionId]) {
      setLoadingActions(sessionId);
      const { data } = await supabase
        .from('copilot_actions')
        .select('id, session_id, skill, input, output, status, created_at')
        .eq('session_id', sessionId)
        .in('skill', ['_user_message', '_assistant_reply'])
        .order('created_at', { ascending: true })
        .limit(200);
      setActionsBySession((prev) => ({ ...prev, [sessionId]: (data as ActionRow[] | null) ?? [] }));
      setLoadingActions(null);
    }
  };

  const totals = {
    total: sessions.length,
    processing: sessions.filter((s) => s.status === 'processing').length,
    today: sessions.filter((s) => {
      const ref = s.last_message_at || s.created_at;
      return new Date(ref).toDateString() === new Date().toDateString();
    }).length,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Copilot Félix — sessions (nouvelle architecture)
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchSessions} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
        <div className="flex gap-3 pt-1 text-[11px] text-muted-foreground">
          <span>Total : <span className="font-medium text-foreground">{totals.total}</span></span>
          <span>Aujourd'hui : <span className="font-medium text-foreground">{totals.today}</span></span>
          <span>En cours : <span className="font-medium text-foreground">{totals.processing}</span></span>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[600px]">
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {loading ? 'Chargement…' : 'Aucune session Copilot Félix enregistrée.'}
            </p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const actions = actionsBySession[s.id] ?? [];
                const isOpen = expandedId === s.id;
                return (
                  <div key={s.id} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggle(s.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.title || `Session ${s.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.last_message_at || s.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          {' · '}
                          <span className="font-mono">{s.user_id.slice(0, 8)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.status === 'processing' && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                            En cours
                          </Badge>
                        )}
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t bg-muted/20 p-3 space-y-2 max-h-80 overflow-y-auto">
                        {loadingActions === s.id ? (
                          <p className="text-xs text-muted-foreground">Chargement des messages…</p>
                        ) : actions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Aucun message persisté pour cette session.</p>
                        ) : (
                          actions.map((a) => {
                            const isUser = a.skill === '_user_message';
                            const text = isUser
                              ? (a.input?.message ?? '')
                              : (a.output?.reply ?? '');
                            return (
                              <div key={a.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                                <div className={cn(
                                  'max-w-[80%] rounded-lg px-3 py-2 text-xs border border-border',
                                  isUser ? 'bg-primary/5' : 'bg-background',
                                )}>
                                  <span className="font-medium block mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {isUser ? 'Utilisateur' : 'Félix'}
                                  </span>
                                  <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:m-0">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
