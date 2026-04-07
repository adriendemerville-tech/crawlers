import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Palette, FileCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UxProposal {
  id: string;
  title: string;
  description: string;
  file_path: string;
  proposed_code: string;
  status: string;
  confidence_score: number;
  created_at: string;
}

export function UxCodeProposals() {
  const [proposals, setProposals] = useState<UxProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadProposals(); }, []);

  const loadProposals = async () => {
    try {
      const { data } = await supabase
        .from('cto_code_proposals')
        .select('id, title, description, file_path, proposed_code, status, confidence_score, created_at')
        .eq('agent_source', 'ux')
        .order('created_at', { ascending: false })
        .limit(30);
      setProposals((data as any[]) || []);
    } catch (e) {
      console.error('Load UX proposals error:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      await supabase.from('cto_code_proposals').update({ status }).eq('id', id);
      toast({ title: status === 'approved' ? '✅ Approuvée' : '❌ Rejetée' });
      loadProposals();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const pending = proposals.filter(p => p.status === 'pending');
  const resolved = proposals.filter(p => p.status !== 'pending');

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Propositions UX</CardTitle>
          </div>
          {pending.length > 0 && (
            <Badge variant="destructive">{pending.length} en attente</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune proposition UX.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {proposals.map((p) => (
              <div key={p.id} className="border border-border/50 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.file_path}</p>
                  </div>
                  <Badge variant={
                    p.status === 'pending' ? 'secondary' :
                    p.status === 'approved' ? 'default' : 'destructive'
                  } className="text-[10px] shrink-0">
                    {p.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                {p.proposed_code && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-primary flex items-center gap-1">
                      <FileCode className="h-3 w-3" /> Voir le code
                    </summary>
                    <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-x-auto max-h-40">
                      {p.proposed_code.slice(0, 1000)}
                      {p.proposed_code.length > 1000 && '\n...'}
                    </pre>
                  </details>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(p.created_at), 'dd MMM HH:mm', { locale: fr })} • {Math.round(p.confidence_score)}% confiance
                  </span>
                  {p.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                        disabled={processingId === p.id}
                        onClick={() => updateStatus(p.id, 'approved')}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Valider
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive"
                        disabled={processingId === p.id}
                        onClick={() => updateStatus(p.id, 'rejected')}>
                        <XCircle className="h-3 w-3 mr-1" /> Rejeter
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
