import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bug, CheckCircle2, Search, Clock, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface BugReport {
  id: string;
  user_id: string;
  raw_message: string;
  translated_message: string | null;
  category: string;
  route: string | null;
  context_data: any;
  status: string;
  cto_response: string | null;
  resolved_at: string | null;
  notified_user: boolean;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'Ouvert', color: 'bg-red-500/10 text-red-600 border-red-200', icon: Bug },
  investigating: { label: 'En cours', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Search },
  resolved: { label: 'Résolu', color: 'bg-green-500/10 text-green-600 border-green-200', icon: CheckCircle2 },
};

const CATEGORY_LABELS: Record<string, string> = {
  bug_ui: 'Bug UI',
  bug_data: 'Bug Data',
  bug_function: 'Bug Fonction',
  feature_request: 'Feature Request',
  question: 'Question',
};

export function RecettageTab() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchReports = async () => {
    setLoading(true);
    let query = supabase
      .from('user_bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [filter]);

  const updateStatus = async (id: string, newStatus: string, response?: string) => {
    setSaving(true);
    const updates: any = { status: newStatus };
    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString();
      updates.notified_user = false; // Will be read at next user login
    }
    if (response) updates.cto_response = response;

    const { error } = await supabase
      .from('user_bug_reports')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mis à jour', description: `Statut → ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
      setExpandedId(null);
      setResponseText('');
      fetchReports();
    }
    setSaving(false);
  };

  const counts = {
    open: reports.filter(r => r.status === 'open').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter(key)}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', cfg.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts[key as keyof typeof counts]}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="open">Ouverts</SelectItem>
            <SelectItem value="investigating">En cours</SelectItem>
            <SelectItem value="resolved">Résolus</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchReports}>
          Rafraîchir
        </Button>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Bug className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucun signalement</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => {
            const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.open;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === report.id;

            return (
              <Card key={report.id} className="overflow-hidden">
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  <div className={cn('p-1.5 rounded', statusCfg.color)}>
                    <StatusIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {CATEGORY_LABELS[report.category] || report.category}
                      </Badge>
                      {report.route && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate">{report.route}</span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(report.created_at), 'dd/MM HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{report.translated_message || report.raw_message}</p>
                    {report.translated_message && report.translated_message !== report.raw_message && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 italic line-clamp-1">
                        Original : {report.raw_message}
                      </p>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2 space-y-3 bg-muted/10">
                    {/* Context */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contexte</p>
                      <pre className="text-[10px] bg-muted/40 rounded p-2 overflow-x-auto max-h-32">
                        {JSON.stringify(report.context_data, null, 2)}
                      </pre>
                    </div>

                    {/* CTO Response */}
                    {report.cto_response && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Réponse CTO</p>
                        <p className="text-xs bg-green-50 dark:bg-green-900/20 rounded p-2">{report.cto_response}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {report.status !== 'resolved' && (
                      <div className="space-y-2">
                        <Textarea
                          value={responseText}
                          onChange={e => setResponseText(e.target.value)}
                          placeholder="Réponse pour l'utilisateur (optionnel)..."
                          className="text-xs min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          {report.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={saving}
                              onClick={() => updateStatus(report.id, 'investigating', responseText || undefined)}
                            >
                              <Search className="h-3 w-3 mr-1" /> En cours
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            disabled={saving}
                            onClick={() => updateStatus(report.id, 'resolved', responseText || undefined)}
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                            Résolu
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
