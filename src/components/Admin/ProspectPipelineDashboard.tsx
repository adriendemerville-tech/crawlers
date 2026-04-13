import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Users, Target, Send, Copy, Check, RefreshCw, Loader2, Globe, Linkedin,
  ArrowUpRight, MessageSquare, FileText, Upload, Play, Filter, Star,
  CheckCircle2, Clock, AlertTriangle, XCircle, TrendingUp, Shield, Timer,
  SkipForward, Ban
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Prospect {
  id: string;
  first_name: string;
  last_name: string;
  linkedin_url: string | null;
  job_title: string | null;
  company: string | null;
  industry: string | null;
  website_url: string | null;
  language: string;
  source: string | null;
  score: number;
  score_details: Record<string, number>;
  status: string;
  marina_audit_id: string | null;
  marina_report_url: string | null;
  notes: string | null;
  created_at: string;
  prospect_outreach_queue: OutreachItem[];
}

interface OutreachItem {
  id: string;
  message_type: string;
  message_content: string | null;
  message_language: string;
  report_share_url: string | null;
  status: string;
  sent_at: string | null;
  replied_at: string | null;
  step_number: number;
  channel: string;
  next_action_at: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: 'Nouveau', color: 'bg-muted text-muted-foreground', icon: Clock },
  qualified: { label: 'Qualifié', color: 'bg-blue-500/15 text-blue-600', icon: Target },
  low_score: { label: 'Score faible', color: 'bg-orange-500/15 text-orange-600', icon: AlertTriangle },
  contacted: { label: 'Contacté', color: 'bg-purple-500/15 text-purple-600', icon: Send },
  replied: { label: 'Répondu', color: 'bg-green-500/15 text-green-600', icon: MessageSquare },
  converted: { label: 'Converti', color: 'bg-emerald-500/15 text-emerald-600', icon: CheckCircle2 },
  lost: { label: 'Perdu', color: 'bg-destructive/15 text-destructive', icon: XCircle },
};

const stepLabels: Record<string, string> = {
  invitation: '📨 Invitation',
  pitch: '💬 Pitch',
  followup_1: '🔄 Relance 1',
  followup_2: '👋 Dernier rappel',
};

const outreachStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente (audit)', color: 'bg-amber-500/15 text-amber-600' },
  ready: { label: 'À envoyer', color: 'bg-green-500/15 text-green-600' },
  sent: { label: 'Envoyé', color: 'bg-blue-500/15 text-blue-600' },
  replied: { label: 'Répondu', color: 'bg-emerald-500/15 text-emerald-600' },
  advanced: { label: 'Avancé', color: 'bg-muted text-muted-foreground' },
  sequence_complete: { label: 'Séquence terminée', color: 'bg-muted text-muted-foreground' },
  paused_reply: { label: 'Pausé (réponse)', color: 'bg-green-500/15 text-green-600' },
  expired: { label: 'Expiré (cooldown)', color: 'bg-destructive/15 text-destructive' },
};

export function ProspectPipelineDashboard() {
  const { toast } = useToast();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [quotas, setQuotas] = useState<{ invitations_sent: number; messages_sent: number } | null>(null);
  const [limits, setLimits] = useState<{ max_invitations: number; max_messages: number }>({ max_invitations: 20, max_messages: 40 });
  const [isBusinessHours, setIsBusinessHours] = useState(true);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('marina_prospects' as any)
        .select('*, prospect_outreach_queue(*)')
        .order('score', { ascending: false })
        .limit(100);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      setProspects((data as any[]) || []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  const fetchQuotas = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.functions.invoke('prospect-pipeline', {
        body: { action: 'get_quotas', user_id: user.id },
      });
      if (data?.quotas) setQuotas(data.quotas);
      if (data?.limits) setLimits(data.limits);
      if (data?.is_business_hours !== undefined) setIsBusinessHours(data.is_business_hours);
    } catch {}
  }, []);

  useEffect(() => { fetchProspects(); fetchQuotas(); }, [fetchProspects, fetchQuotas]);

  const runNightlyPipeline = async () => {
    setRunningPipeline(true);
    try {
      const { data, error } = await supabase.functions.invoke('prospect-pipeline', {
        body: { action: 'nightly_run' },
      });
      if (error) throw error;
      const r = data?.nightly_run;
      toast({
        title: '🌙 Pipeline exécuté',
        description: `Qualifié: ${r?.qualify_batch?.qualified || 0}, Préparé: ${r?.prepare_outreach?.prepared || 0}, Avancé: ${r?.advance_sequence?.advanced || 0}`,
      });
      fetchProspects();
      fetchQuotas();
    } catch (e: any) {
      toast({ title: 'Erreur pipeline', description: e.message, variant: 'destructive' });
    } finally {
      setRunningPipeline(false);
    }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markAsSent = async (outreachId: string, prospectId: string, stepAction: string) => {
    // Check quotas first
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const quotaType = stepAction === 'invitation' ? 'invitation' : 'message';
      const { data } = await supabase.functions.invoke('prospect-pipeline', {
        body: { action: 'increment_quota', user_id: user.id, type: quotaType },
      });
      if (data?.quota_exceeded) {
        toast({ title: '🛑 Quota atteint', description: `Limite quotidienne atteinte. Reprends demain.`, variant: 'destructive' });
        return;
      }
      if (data?.blocked) {
        toast({ title: '⏰ Hors horaires', description: `Envoie uniquement en heures ouvrées (8h-19h).`, variant: 'destructive' });
        return;
      }
    }

    await supabase.functions.invoke('prospect-pipeline', {
      body: { action: 'update_status', outreach_id: outreachId, prospect_id: prospectId, status: 'sent' },
    });
    fetchProspects();
    fetchQuotas();
  };

  const markAsReplied = async (outreachId: string, prospectId: string) => {
    await supabase.functions.invoke('prospect-pipeline', {
      body: { action: 'update_status', outreach_id: outreachId, prospect_id: prospectId, status: 'replied' },
    });
    toast({ title: '✅ Séquence pausée', description: 'Le prospect a répondu — relances automatiques stoppées.' });
    fetchProspects();
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV vide');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const prospects = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return {
          first_name: obj['first_name'] || obj['prenom'] || obj['firstname'] || 'Unknown',
          last_name: obj['last_name'] || obj['nom'] || obj['lastname'] || 'Unknown',
          linkedin_url: obj['linkedin_url'] || obj['linkedin'] || obj['profileurl'] || null,
          job_title: obj['job_title'] || obj['titre'] || obj['headline'] || null,
          company: obj['company'] || obj['entreprise'] || null,
          industry: obj['industry'] || obj['secteur'] || null,
          website_url: obj['website_url'] || obj['website'] || obj['site'] || null,
          language: obj['language'] || obj['langue'] || 'fr',
        };
      });
      const { data, error } = await supabase.functions.invoke('prospect-pipeline', {
        body: { action: 'webhook_import', prospects, source: 'csv_import' },
      });
      if (error) throw error;
      toast({ title: '📥 Import réussi', description: `${data?.imported || 0} prospects importés` });
      fetchProspects();
    } catch (err: any) {
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    } finally { setCsvImporting(false); e.target.value = ''; }
  };

  // Stats
  const stats = {
    total: prospects.length,
    qualified: prospects.filter(p => p.status === 'qualified').length,
    ready: prospects.reduce((c, p) => c + (p.prospect_outreach_queue || []).filter(o => o.status === 'ready').length, 0),
    sent: prospects.filter(p => p.status === 'contacted').length,
    replied: prospects.filter(p => p.status === 'replied').length,
    converted: prospects.filter(p => p.status === 'converted').length,
  };

  const invPct = quotas ? Math.round((quotas.invitations_sent / limits.max_invitations) * 100) : 0;
  const msgPct = quotas ? Math.round((quotas.messages_sent / limits.max_messages) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Anti-bot shield + quotas */}
      <Card className={cn('border-border/40', !isBusinessHours && 'border-amber-500/50')}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-green-500" />
            <span className="text-xs font-semibold">Mode Anti-Détection LinkedIn</span>
            {!isBusinessHours && (
              <Badge className="text-[10px] bg-amber-500/15 text-amber-600 gap-0.5">
                <Timer className="h-2.5 w-2.5" /> Hors horaires
              </Badge>
            )}
            {isBusinessHours && (
              <Badge className="text-[10px] bg-green-500/15 text-green-600 gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> Actif
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>Invitations</span>
                <span className={cn(invPct >= 80 && 'text-destructive font-bold')}>
                  {quotas?.invitations_sent || 0}/{limits.max_invitations}
                </span>
              </div>
              <Progress value={invPct} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>Messages</span>
                <span className={cn(msgPct >= 80 && 'text-destructive font-bold')}>
                  {quotas?.messages_sent || 0}/{limits.max_messages}
                </span>
              </div>
              <Progress value={msgPct} className="h-1.5" />
            </div>
          </div>
          <div className="text-[9px] text-muted-foreground mt-1.5 flex items-center gap-3">
            <span>📅 Pas de weekend</span>
            <span>⏰ 8h-19h uniquement</span>
            <span>🎲 Quotas aléatoires/jour</span>
            <span>❄️ Cooldown 21j</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-muted-foreground' },
          { label: 'Qualifiés', value: stats.qualified, icon: Target, color: 'text-blue-500' },
          { label: 'À envoyer', value: stats.ready, icon: Send, color: 'text-green-500' },
          { label: 'Contactés', value: stats.sent, icon: Linkedin, color: 'text-purple-500' },
          { label: 'Répondus', value: stats.replied, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Convertis', value: stats.converted, icon: TrendingUp, color: 'text-amber-500' },
        ].map(stat => (
          <Card key={stat.label} className="border-border/40">
            <CardContent className="p-3 text-center">
              <stat.icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
              <div className="text-lg font-bold">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={runNightlyPipeline} disabled={runningPipeline} className="gap-1.5">
          {runningPipeline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Pipeline nocturne
        </Button>
        <label>
          <Button size="sm" variant="outline" className="gap-1.5 cursor-pointer" asChild>
            <span>
              {csvImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import CSV
            </span>
          </Button>
          <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
        </label>
        <Button size="sm" variant="outline" onClick={() => { fetchProspects(); fetchQuotas(); }} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="new">Nouveaux</SelectItem>
            <SelectItem value="qualified">Qualifiés</SelectItem>
            <SelectItem value="contacted">Contactés</SelectItem>
            <SelectItem value="replied">Répondus</SelectItem>
            <SelectItem value="converted">Convertis</SelectItem>
            <SelectItem value="low_score">Score faible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Webhook hint */}
      <Card className="border-border/40 bg-card/50">
        <CardContent className="p-3 text-xs text-muted-foreground flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span>
            Webhook : <code className="bg-muted px-1 rounded text-[10px]">POST /functions/v1/prospect-pipeline</code> body: <code className="bg-muted px-1 rounded text-[10px]">{`{ "action": "webhook_import", "prospects": [...] }`}</code>
          </span>
        </CardContent>
      </Card>

      {/* Prospect list */}
      <ScrollArea className="h-[calc(100vh-480px)]">
        <div className="space-y-2">
          {prospects.map(prospect => {
            const sc = statusConfig[prospect.status] || statusConfig.new;
            const StatusIcon = sc.icon;
            // Get the latest active outreach item (not advanced/expired)
            const allOutreach = (prospect.prospect_outreach_queue || []) as OutreachItem[];
            const activeOutreach = allOutreach
              .filter(o => !['advanced', 'expired', 'sequence_complete', 'paused_reply'].includes(o.status))
              .sort((a, b) => (b.step_number || 1) - (a.step_number || 1));
            const outreach = activeOutreach[0];
            const osc = outreach ? (outreachStatusConfig[outreach.status] || outreachStatusConfig.pending) : null;
            const maxStep = Math.max(...allOutreach.map(o => o.step_number || 1), 0);

            return (
              <Card key={prospect.id} className="border-border/40">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {prospect.first_name} {prospect.last_name}
                        </span>
                        <Badge className={cn('text-[10px] px-1.5 py-0', sc.color)}>
                          <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                          {sc.label}
                        </Badge>
                        {prospect.score > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Star className="h-2.5 w-2.5" />{prospect.score}
                          </Badge>
                        )}
                        {maxStep > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <SkipForward className="h-2.5 w-2.5" />Étape {maxStep}/4
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {prospect.job_title && (
                          <div className="truncate">{prospect.job_title}{prospect.company ? ` · ${prospect.company}` : ''}</div>
                        )}
                        <div className="flex items-center gap-2">
                          {prospect.linkedin_url && (
                            <a href={prospect.linkedin_url} target="_blank" rel="noopener" className="text-blue-500 hover:underline flex items-center gap-0.5">
                              <Linkedin className="h-3 w-3" /> LinkedIn
                            </a>
                          )}
                          {prospect.website_url && (
                            <a href={prospect.website_url} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-0.5">
                              <Globe className="h-3 w-3" /> Site
                            </a>
                          )}
                          <span className="uppercase text-[10px]">{prospect.language}</span>
                        </div>
                      </div>
                    </div>

                    {prospect.score_details && Object.keys(prospect.score_details).length > 0 && (
                      <div className="text-[10px] text-muted-foreground space-y-0.5 text-right shrink-0">
                        {Object.entries(prospect.score_details).map(([k, v]) => (
                          <div key={k}>
                            <span className="capitalize">{k.replace(/_/g, ' ')}</span>: <span className="font-mono">{v as number}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {outreach && (
                    <>
                      <Separator className="my-2" />
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn('text-[10px] px-1.5 py-0', osc?.color)}>
                            {osc?.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {stepLabels[outreach.message_type] || outreach.message_type}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Linkedin className="h-2.5 w-2.5" /> LinkedIn
                          </Badge>
                          {outreach.next_action_at && outreach.status === 'sent' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-muted-foreground">
                              <Timer className="h-2.5 w-2.5" />
                              Prochaine étape : {new Date(outreach.next_action_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Badge>
                          )}
                        </div>

                        {outreach.message_content && (
                          <div className="bg-muted/50 rounded p-2 text-xs relative group">
                            <p className="whitespace-pre-wrap pr-8">{outreach.message_content}</p>
                            <Button
                              size="sm" variant="ghost"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={() => copyMessage(outreach.id, outreach.message_content || '')}
                            >
                              {copiedId === outreach.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        )}

                        {outreach.report_share_url && (
                          <a href={outreach.report_share_url} target="_blank" rel="noopener"
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Rapport Marina <ArrowUpRight className="h-3 w-3" />
                          </a>
                        )}

                        {outreach.status === 'ready' && (
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                              disabled={!isBusinessHours}
                              onClick={() => markAsSent(outreach.id, prospect.id, outreach.message_type)}>
                              <Send className="h-2.5 w-2.5" />
                              {outreach.message_type === 'invitation' ? 'Invitation envoyée' : 'Message envoyé'}
                            </Button>
                            {!isBusinessHours && (
                              <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                                <Ban className="h-2.5 w-2.5" /> Hors horaires
                              </span>
                            )}
                          </div>
                        )}
                        {outreach.status === 'sent' && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                            onClick={() => markAsReplied(outreach.id, prospect.id)}>
                            <MessageSquare className="h-2.5 w-2.5" /> A répondu
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {prospects.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucun prospect. Importe un CSV ou configure un webhook.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
