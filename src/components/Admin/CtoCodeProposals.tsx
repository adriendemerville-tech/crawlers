import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, Trash2, Loader2, Code2, ChevronDown, ChevronRight, Eye, RefreshCw, AlertTriangle, Rocket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CodeProposal {
  id: string;
  target_function: string;
  target_url: string | null;
  domain: string;
  proposal_type: string;
  title: string;
  description: string | null;
  diff_preview: string | null;
  original_code: string | null;
  proposed_code: string | null;
  confidence_score: number;
  source_diagnostic_id: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  deployed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  deployed: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const TYPE_LABELS: Record<string, string> = {
  bugfix: '🐛 Bugfix',
  optimization: '⚡ Optimisation',
  feature: '✨ Feature',
  refactor: '🔧 Refactor',
};

export function CtoCodeProposals() {
  const [proposals, setProposals] = useState<CodeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cto_code_proposals' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProposals((data as unknown as CodeProposal[]) || []);
    } catch (e) {
      console.error('Error fetching proposals:', e);
      toast.error('Impossible de charger les propositions');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('cto_code_proposals' as any)
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_note: reviewNotes[id] || null,
        } as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Proposition approuvée');
      fetchProposals();
    } catch (e) {
      console.error('Approve error:', e);
      toast.error('Erreur lors de l\'approbation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('cto_code_proposals' as any)
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          review_note: reviewNotes[id] || null,
        } as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Proposition rejetée');
      fetchProposals();
    } catch (e) {
      console.error('Reject error:', e);
      toast.error('Erreur lors du rejet');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (id: string) => {
    setActionLoading(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const { data, error } = await supabase.functions.invoke('deploy-code-proposal', {
        body: { proposal_id: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Déployé ! Commit: ${data.commit_sha?.substring(0, 7)}`, {
        description: 'Le build va se lancer automatiquement.',
        duration: 8000,
      });
      fetchProposals();
    } catch (e: any) {
      console.error('Deploy error:', e);
      toast.error(`Erreur déploiement: ${e.message || 'Erreur inconnue'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('cto_code_proposals' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Proposition supprimée');
      setProposals(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error('Delete error:', e);
      toast.error('Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Code2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Propositions de code CTO
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {pendingCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Dry-run → Validation manuelle → Déploiement
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchProposals} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mt-3">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setFilter(f)}
            >
              {f === 'pending' ? 'En attente' : f === 'approved' ? 'Approuvées' : f === 'rejected' ? 'Rejetées' : 'Toutes'}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucune proposition {filter !== 'all' ? `(${filter})` : ''}
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-3">
              {proposals.map(proposal => (
                <Collapsible
                  key={proposal.id}
                  open={expandedId === proposal.id}
                  onOpenChange={(open) => setExpandedId(open ? proposal.id : null)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="w-full p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left">
                      <div className="pt-0.5">
                        {expandedId === proposal.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{proposal.title}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 ${STATUS_COLORS[proposal.status] || ''}`}>
                            {proposal.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {TYPE_LABELS[proposal.proposal_type] || proposal.proposal_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono">{proposal.target_function}</span>
                          <span>·</span>
                          <span>{proposal.domain}</span>
                          <span>·</span>
                          <span className={proposal.confidence_score >= 85 ? 'text-emerald-500' : proposal.confidence_score >= 60 ? 'text-amber-500' : 'text-red-500'}>
                            {proposal.confidence_score}% confiance
                          </span>
                          <span>·</span>
                          <span>{format(new Date(proposal.created_at), 'dd MMM HH:mm', { locale: fr })}</span>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3 border-t pt-3">
                        {/* Description */}
                        {proposal.description && (
                          <div className="text-sm text-muted-foreground bg-muted/30 rounded p-2.5">
                            {proposal.description}
                          </div>
                        )}

                        {/* Diff preview */}
                        {proposal.diff_preview && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium flex items-center gap-1.5">
                              <Eye className="h-3.5 w-3.5" /> Aperçu du diff
                            </p>
                            <ScrollArea className="max-h-[300px]">
                              <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
                                {proposal.diff_preview}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Proposed code */}
                        {proposal.proposed_code && !proposal.diff_preview && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium flex items-center gap-1.5">
                              <Code2 className="h-3.5 w-3.5" /> Code proposé
                            </p>
                            <ScrollArea className="max-h-[300px]">
                              <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
                                {proposal.proposed_code}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}

                        {/* Low confidence warning */}
                        {proposal.confidence_score < 60 && proposal.status === 'pending' && (
                          <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/5 rounded p-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Confiance basse — vérification manuelle recommandée
                          </div>
                        )}

                        {/* Review note + actions for pending */}
                        {proposal.status === 'pending' && (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Note de review (optionnel)..."
                              value={reviewNotes[proposal.id] || ''}
                              onChange={(e) => setReviewNotes(prev => ({ ...prev, [proposal.id]: e.target.value }))}
                              className="text-xs h-16 resize-none"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => handleApprove(proposal.id)}
                                disabled={actionLoading === proposal.id}
                              >
                                {actionLoading === proposal.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5 text-xs"
                                onClick={() => handleDelete(proposal.id)}
                                disabled={actionLoading === proposal.id}
                              >
                                {actionLoading === proposal.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Review info for already reviewed */}
                        {proposal.review_note && proposal.status !== 'pending' && (
                          <div className="text-xs text-muted-foreground italic bg-muted/20 rounded p-2">
                            Note : {proposal.review_note}
                            {proposal.reviewed_at && (
                              <span className="ml-2">
                                — {format(new Date(proposal.reviewed_at), 'dd MMM HH:mm', { locale: fr })}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Deploy button for approved */}
                        {proposal.status === 'approved' && (
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleDeploy(proposal.id)}
                            disabled={actionLoading === proposal.id}
                          >
                            {actionLoading === proposal.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Rocket className="h-3.5 w-3.5" />
                            )}
                            Déployer sur GitHub
                          </Button>
                        )}

                        {/* Delete for non-pending too */}
                        {proposal.status !== 'pending' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleDelete(proposal.id)}
                            disabled={actionLoading === proposal.id}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
