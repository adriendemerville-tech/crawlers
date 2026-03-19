import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MatrixError {
  id: string;
  user_email: string | null;
  error_type: string;
  title: string;
  description: string | null;
  status: string;
  context_data: any;
  created_at: string;
  admin_notes: string | null;
}

const statusIcon: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  resolved: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
};

export function MatrixErrorsRegistry() {
  const [errors, setErrors] = useState<MatrixError[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('matrix_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setErrors(data as MatrixError[]);
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    const { error } = await supabase.from('matrix_errors').update(updates).eq('id', id);
    if (error) { toast.error('Erreur de mise à jour'); return; }
    setErrors(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    toast.success('Statut mis à jour');
  };

  const filtered = filter === 'all' ? errors : errors.filter(e => e.status === filter);
  const counts = { open: errors.filter(e => e.status === 'open').length, in_progress: errors.filter(e => e.status === 'in_progress').length, resolved: errors.filter(e => e.status === 'resolved').length };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Erreurs Matrice de Prompts</h2>
        <Badge variant="outline">{errors.length} total</Badge>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(['all', 'open', 'in_progress', 'resolved'] as const).map(s => (
            <Button
              key={s}
              variant={filter === s ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'Tout' : s === 'open' ? `Ouvert (${counts.open})` : s === 'in_progress' ? `En cours (${counts.in_progress})` : `Résolu (${counts.resolved})`}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune erreur signalée.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Titre</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-40">Utilisateur</TableHead>
                <TableHead className="w-32">Date</TableHead>
                <TableHead className="w-32">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(err => (
                <TableRow key={err.id}>
                  <TableCell>{statusIcon[err.status] || statusIcon.open}</TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{err.title}</p>
                    {err.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{err.description}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {err.error_type === 'user_report' ? 'Signalement' : err.error_type === 'auto' ? 'Auto' : err.error_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{err.user_email || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(err.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <Select value={err.status} onValueChange={(v) => updateStatus(err.id, v)}>
                      <SelectTrigger className="h-7 text-[11px] w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Ouvert</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="resolved">Résolu</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
