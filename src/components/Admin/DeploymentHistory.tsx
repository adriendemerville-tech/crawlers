import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, Undo2, Loader2, ChevronDown, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Deployment {
  id: string;
  proposal_id: string;
  agent_source: string;
  file_path: string;
  previous_content: string | null;
  deployed_content: string;
  commit_sha: string | null;
  rollback_commit_sha: string | null;
  is_rolled_back: boolean;
  rolled_back_at: string | null;
  deployed_at: string;
}

export function DeploymentHistory() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  const fetchDeployments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('code_deployment_history' as any)
        .select('*')
        .order('deployed_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setDeployments((data as unknown as Deployment[]) || []);
    } catch (e) {
      console.error('Error fetching deployments:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeployments(); }, [fetchDeployments]);

  const handleRollback = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir restaurer la version précédente ? Un commit de rollback sera créé sur GitHub.')) return;

    setRollbackLoading(id);
    try {
      const { data, error } = await supabase.functions.invoke('rollback-code-proposal', {
        body: { deployment_id: id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Rollback effectué ! Commit: ${data.rollback_commit_sha?.substring(0, 7)}`, {
        description: 'Le build va se relancer automatiquement.',
        duration: 8000,
      });
      fetchDeployments();
    } catch (e: any) {
      console.error('Rollback error:', e);
      toast.error(`Erreur rollback: ${e.message || 'Erreur inconnue'}`);
    } finally {
      setRollbackLoading(null);
    }
  };

  const activeCount = deployments.filter(d => !d.is_rolled_back).length;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <History className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Historique des déploiements
                {activeCount > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {activeCount} actifs
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Rollback possible vers la version précédente
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchDeployments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucun déploiement enregistré
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {deployments.map(dep => (
                <Collapsible
                  key={dep.id}
                  open={expandedId === dep.id}
                  onOpenChange={(open) => setExpandedId(open ? dep.id : null)}
                >
                  <div className={`border rounded-lg overflow-hidden ${dep.is_rolled_back ? 'opacity-60' : ''}`}>
                    <CollapsibleTrigger className="w-full p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left">
                      <div className="pt-0.5">
                        {expandedId === dep.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm truncate">{dep.file_path}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 ${
                            dep.is_rolled_back
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}>
                            {dep.is_rolled_back ? 'rollback' : 'actif'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {dep.agent_source?.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {dep.commit_sha && <span className="font-mono">{dep.commit_sha.substring(0, 7)}</span>}
                          <span>·</span>
                          <span>{format(new Date(dep.deployed_at), 'dd MMM HH:mm', { locale: fr })}</span>
                          {dep.is_rolled_back && dep.rolled_back_at && (
                            <>
                              <span>·</span>
                              <span className="text-amber-500">
                                rollback {format(new Date(dep.rolled_back_at), 'dd MMM HH:mm', { locale: fr })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3 border-t pt-3">
                        {dep.previous_content && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Contenu précédent (extrait)</p>
                            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-auto whitespace-pre-wrap break-words">
                              {dep.previous_content.substring(0, 500)}{dep.previous_content.length > 500 ? '...' : ''}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Contenu déployé (extrait)</p>
                          <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-auto whitespace-pre-wrap break-words">
                            {dep.deployed_content.substring(0, 500)}{dep.deployed_content.length > 500 ? '...' : ''}
                          </pre>
                        </div>

                        {!dep.is_rolled_back && dep.previous_content && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5 text-xs"
                            onClick={() => handleRollback(dep.id)}
                            disabled={rollbackLoading === dep.id}
                          >
                            {rollbackLoading === dep.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="h-3.5 w-3.5" />
                            )}
                            Rollback vers la version précédente
                          </Button>
                        )}

                        {!dep.is_rolled_back && !dep.previous_content && (
                          <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Nouveau fichier — pas de version précédente disponible
                          </div>
                        )}

                        {dep.is_rolled_back && (
                          <div className="text-xs text-amber-500 italic flex items-center gap-1.5">
                            <Undo2 className="h-3.5 w-3.5" />
                            Déjà restauré
                            {dep.rollback_commit_sha && (
                              <span className="font-mono">({dep.rollback_commit_sha.substring(0, 7)})</span>
                            )}
                          </div>
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
