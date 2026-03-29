import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeaSeoBridge } from '@/components/Console/SeaSeoBridge';
import { Loader2 } from 'lucide-react';

interface Site {
  id: string;
  domain: string;
  site_name: string | null;
}

export function SeaSeoBridgeTab() {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain, site_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data && data.length > 0) {
        setSites(data);
        setSelectedSiteId(data[0].id);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  if (sites.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Ajoutez un site dans l'onglet Tracking pour utiliser le SEA→SEO Bridge.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sites.length > 1 && (
        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.site_name || s.domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {selectedSite && (
        <SeaSeoBridge domain={selectedSite.domain} trackedSiteId={selectedSite.id} />
      )}
    </div>
  );
}
