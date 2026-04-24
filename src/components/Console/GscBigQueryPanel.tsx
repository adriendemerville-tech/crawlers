/**
 * Console > GSC BigQuery — combines per-site settings and the read-only explorer.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe } from 'lucide-react';
import { GscBigQuerySettings } from './GscBigQuerySettings';
import { GscBigQueryExplorer } from './GscBigQueryExplorer';

interface TrackedSite {
  id: string;
  domain: string;
}

export function GscBigQueryPanel() {
  const { user } = useAuth();
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', user.id)
        .order('domain');
      if (!active) return;
      const list = (data ?? []) as TrackedSite[];
      setSites(list);
      if (list.length > 0 && !selectedSiteId) setSelectedSiteId(list[0].id);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sites.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Aucun site tracké. Ajoutez d'abord un site pour configurer son export BigQuery.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Site :</span>
        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sites.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.domain}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSiteId && (
        <>
          <GscBigQuerySettings siteId={selectedSiteId} />
          <GscBigQueryExplorer siteId={selectedSiteId} />
        </>
      )}
    </div>
  );
}
