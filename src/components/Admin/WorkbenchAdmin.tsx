import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, RefreshCw, Search, Archive, Merge, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WorkbenchStats {
  total: number;
  pending: number;
  in_progress: number;
  deployed: number;
  done: number;
  duplicates: number;
  domains: { domain: string; count: number }[];
}

interface WorkbenchItem {
  id: string;
  title: string;
  domain: string;
  status: string;
  severity: string;
  finding_category: string;
  spiral_score: number | null;
  target_url: string | null;
  source_type: string;
  created_at: string;
  manual_priority: number | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500',
  high: 'bg-orange-500/10 text-orange-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-blue-500/10 text-blue-500',
  in_progress: 'bg-amber-500/10 text-amber-500',
  assigned: 'bg-purple-500/10 text-purple-500',
  deployed: 'bg-green-500/10 text-green-500',
  done: 'bg-green-500/10 text-green-500',
  cancelled: 'bg-muted text-muted-foreground',
};

export function WorkbenchAdmin() {
  const [items, setItems] = useState<WorkbenchItem[]>([]);
  const [stats, setStats] = useState<WorkbenchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const loadStats = useCallback(async () => {
    const { data, error } = await supabase
      .from('architect_workbench')
      .select('id, domain, status, title')
      .limit(1000);

    if (error || !data) return;

    const domainMap = new Map<string, number>();
    const statusMap: Record<string, number> = {};
    const titleCount = new Map<string, number>();

    for (const row of data) {
      domainMap.set(row.domain, (domainMap.get(row.domain) || 0) + 1);
      statusMap[row.status] = (statusMap[row.status] || 0) + 1;
      const key = `${row.domain}::${(row.title || '').trim().toLowerCase()}`;
      titleCount.set(key, (titleCount.get(key) || 0) + 1);
    }

    const duplicates = Array.from(titleCount.values()).filter(c => c > 1).reduce((sum, c) => sum + (c - 1), 0);

    setStats({
      total: data.length,
      pending: statusMap['pending'] || 0,
      in_progress: statusMap['in_progress'] || 0,
      deployed: statusMap['deployed'] || 0,
      done: statusMap['done'] || 0,
      duplicates,
      domains: Array.from(domainMap.entries()).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count),
    });
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
      let query = supabase
      .from('architect_workbench')
      .select('id, title, domain, status, severity, finding_category, spiral_score, target_url, source_type, created_at, manual_priority')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filterDomain !== 'all') query = query.eq('domain', filterDomain);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus as any);

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      let filtered = data || [];
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(i => i.title.toLowerCase().includes(q) || (i.target_url || '').toLowerCase().includes(q));
      }
      setItems(filtered);
    }
    setLoading(false);
  }, [filterDomain, filterStatus, searchQuery, toast]);

  useEffect(() => { loadStats(); loadItems(); }, [loadStats, loadItems]);

  const handlePurgeDuplicates = async () => {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke('workbench-hygiene', {
        body: { action: 'purge_duplicates' },
      });
      if (error) throw error;
      toast({ title: '✅ Doublons purgés', description: `${data?.deleted || 0} doublons supprimés` });
      loadStats();
      loadItems();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const handleArchiveStale = async () => {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke('workbench-hygiene', {
        body: { action: 'archive_stale' },
      });
      if (error) throw error;
      toast({ title: '✅ Tâches obsolètes archivées', description: `${data?.archived || 0} tâches archivées` });
      loadStats();
      loadItems();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const handleRecalcScores = async () => {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke('workbench-hygiene', {
        body: { action: 'recalc_scores' },
      });
      if (error) throw error;
      toast({ title: '✅ Scores recalculés', description: `${data?.updated || 0} tâches mises à jour` });
      loadItems();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const handleBulkStatus = async (newStatus: string) => {
    const selectedIds = items.filter(i => filterStatus !== 'all' && i.status === filterStatus).map(i => i.id);
    if (!selectedIds.length) {
      toast({ title: 'Aucun item filtré', variant: 'destructive' });
      return;
    }
    setActing(true);
    try {
      const { error } = await supabase
        .from('architect_workbench')
        .update({ status: newStatus } as any)
        .in('id', selectedIds.slice(0, 50));
      if (error) throw error;
      toast({ title: `✅ ${selectedIds.length} items → ${newStatus}` });
      loadStats();
      loadItems();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const { error } = await supabase.from('architect_workbench').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setItems(prev => prev.filter(i => i.id !== id));
      toast({ title: '✅ Supprimé' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: 'Total', value: stats?.total || 0, color: 'text-foreground' },
          { label: 'Pending', value: stats?.pending || 0, color: 'text-blue-500' },
          { label: 'In Progress', value: stats?.in_progress || 0, color: 'text-amber-500' },
          { label: 'Deployed', value: stats?.deployed || 0, color: 'text-green-500' },
          { label: 'Done', value: stats?.done || 0, color: 'text-green-400' },
          { label: 'Doublons', value: stats?.duplicates || 0, color: stats?.duplicates ? 'text-red-500' : 'text-muted-foreground' },
          { label: 'Domaines', value: stats?.domains.length || 0, color: 'text-purple-500' },
        ].map(s => (
          <Card key={s.label} className="py-2 px-3">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Actions admin */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Administration Workbench</CardTitle>
          <CardDescription className="text-xs">Actions de maintenance sur architect_workbench</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handlePurgeDuplicates} disabled={acting}>
              <Merge className="h-3.5 w-3.5 mr-1.5" />
              Purger doublons {stats?.duplicates ? `(${stats.duplicates})` : ''}
            </Button>
            <Button size="sm" variant="outline" onClick={handleArchiveStale} disabled={acting}>
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archiver obsolètes
            </Button>
            <Button size="sm" variant="outline" onClick={handleRecalcScores} disabled={acting}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Recalculer scores
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus('done')} disabled={acting || filterStatus === 'all'}>
              Bulk → done
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatus('cancelled')} disabled={acting || filterStatus === 'all'}>
              Bulk → cancelled
            </Button>
            {acting && <Loader2 className="h-4 w-4 animate-spin self-center" />}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre ou URL..."
            className="pl-8 h-9 text-xs"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterDomain} onValueChange={setFilterDomain}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les domaines</SelectItem>
            {stats?.domains.map(d => (
              <SelectItem key={d.domain} value={d.domain}>{d.domain} ({d.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="deployed">Deployed</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={() => { loadStats(); loadItems(); }} className="h-9">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Items list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun item trouvé.</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto divide-y divide-border">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-2 p-2.5 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[item.status] || ''}`}>
                        {item.status}
                      </Badge>
                      <Badge variant="outline" className={`text-[9px] ${SEVERITY_COLORS[item.severity] || ''}`}>
                        {item.severity}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground">{item.domain}</span>
                      <span className="text-[9px] text-muted-foreground">{item.finding_category}</span>
                      {item.spiral_score != null && (
                        <span className="text-[9px] text-muted-foreground">{item.spiral_score}pts</span>
                      )}
                    </div>
                    {item.target_url && (
                      <p className="text-[9px] text-muted-foreground truncate mt-0.5">{item.target_url}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(item.created_at), 'dd/MM', { locale: fr })}
                    </span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
