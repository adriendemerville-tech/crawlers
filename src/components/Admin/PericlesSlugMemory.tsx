import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RefreshCw, Trash2, Search, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SlugStatus = 'published' | 'blacklisted' | 'skipped' | 'duplicate' | 'error';

interface SlugMemoryRow {
  slug: string;
  domain: string;
  status: SlugStatus;
  reason: string | null;
  hash_content: string | null;
  iktracker_post_id: string | null;
  attempts_count: number;
  blocked_until: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

const STATUS_VARIANT: Record<SlugStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  published: 'default',
  blacklisted: 'destructive',
  skipped: 'outline',
  duplicate: 'secondary',
  error: 'destructive',
};

const STATUS_LABEL: Record<SlugStatus, string> = {
  published: 'Publié',
  blacklisted: 'Blacklisté',
  skipped: 'Ignoré',
  duplicate: 'Doublon',
  error: 'Erreur',
};

export function ParmenionSlugMemory() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SlugMemoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SlugStatus>('all');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('iktracker_slug_memory')
      .select('slug, domain, status, reason, hash_content, iktracker_post_id, attempts_count, blocked_until, first_seen_at, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(500);
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast({
        title: 'Erreur de chargement',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }
    setRows((data ?? []) as SlugMemoryRow[]);
  }, [statusFilter, toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter(
      (r) =>
        r.slug.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        (r.reason ?? '').toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const handleDelete = async (slug: string, domain: string) => {
    const { error } = await supabase
      .from('iktracker_slug_memory')
      .delete()
      .eq('slug', slug)
      .eq('domain', domain);
    if (error) {
      toast({ title: 'Suppression échouée', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Slug purgé', description: `${slug} retiré de la mémoire` });
    fetchRows();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Mémoire des slugs IKtracker
            </CardTitle>
            <CardDescription>
              Verdicts persistés des appels API. Bloque les republications en boucle après rejet admin.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer slug, domaine ou raison…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous ({counts.all ?? 0})</SelectItem>
              <SelectItem value="published">Publié ({counts.published ?? 0})</SelectItem>
              <SelectItem value="blacklisted">Blacklisté ({counts.blacklisted ?? 0})</SelectItem>
              <SelectItem value="skipped">Ignoré ({counts.skipped ?? 0})</SelectItem>
              <SelectItem value="duplicate">Doublon ({counts.duplicate ?? 0})</SelectItem>
              <SelectItem value="error">Erreur ({counts.error ?? 0})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Domaine</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead className="text-right">Tentatives</TableHead>
                <TableHead>Dernière activité</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {loading ? 'Chargement…' : 'Aucun slug en mémoire'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={`${row.domain}::${row.slug}`}>
                    <TableCell className="font-mono text-xs max-w-[280px] truncate" title={row.slug}>
                      {row.slug}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.domain}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate" title={row.reason ?? ''}>
                      {row.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.attempts_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.last_seen_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Purger ce slug">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Purger ce slug de la mémoire ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <span className="font-mono text-sm block mb-2">{row.slug}</span>
                              L'agent pourra à nouveau tenter de publier ce slug. Action irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(row.slug, row.domain)}>
                              Purger
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
