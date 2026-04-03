import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, Globe, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface TrackedSiteShare {
  id: string;
  domain: string;
  shared_with_team: boolean;
}

export function TeamSharingSettings() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [sites, setSites] = useState<TrackedSiteShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sitesRes, teamRes] = await Promise.all([
        supabase
          .from('tracked_sites')
          .select('id, domain, shared_with_team')
          .eq('user_id', user.id)
          .order('domain'),
        supabase
          .from('agency_team_members')
          .select('id')
          .eq('owner_user_id', user.id),
      ]);
      setSites((sitesRes.data as TrackedSiteShare[]) || []);
      setTeamCount(teamRes.data?.length || 0);
      setLoading(false);
    })();
  }, [user]);

  const toggleShare = async (siteId: string, newValue: boolean) => {
    setUpdating(siteId);
    const { error } = await supabase
      .from('tracked_sites')
      .update({ shared_with_team: newValue })
      .eq('id', siteId)
      .eq('user_id', user!.id);

    if (error) {
      toast.error(language === 'fr' ? 'Erreur de mise à jour' : 'Update error');
    } else {
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, shared_with_team: newValue } : s));
      toast.success(
        newValue
          ? (language === 'fr' ? 'Site partagé avec l\'équipe' : 'Site shared with team')
          : (language === 'fr' ? 'Partage désactivé' : 'Sharing disabled')
      );
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sites.length === 0) return null;

  const sharedCount = sites.filter(s => s.shared_with_team).length;

  return (
    <Card className="border-violet-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Share2 className="h-4 w-4 text-violet-500" />
          {language === 'fr' ? 'Partage des données par site' : 'Per-site data sharing'}
        </CardTitle>
        <CardDescription className="text-xs">
          {language === 'fr'
            ? `Choisissez quels sites sont accessibles à vos ${teamCount} collaborateur${teamCount > 1 ? 's' : ''} (Félix, Stratège, données de crawl et audits).`
            : `Choose which sites are accessible to your ${teamCount} collaborator${teamCount > 1 ? 's' : ''} (Félix, Strategist, crawl data and audits).`}
          {teamCount === 0 && (
            <span className="block mt-1 text-amber-600">
              {language === 'fr' 
                ? 'Aucun collaborateur invité pour le moment.' 
                : 'No collaborators invited yet.'}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sites.map(site => (
            <div
              key={site.id}
              className="flex items-center justify-between py-2 px-3 rounded-md border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{site.domain}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {site.shared_with_team ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/5">
                    {language === 'fr' ? 'Partagé' : 'Shared'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-muted-foreground/20 text-muted-foreground">
                    <Lock className="h-2.5 w-2.5 mr-0.5" />
                    {language === 'fr' ? 'Privé' : 'Private'}
                  </Badge>
                )}
                <Switch
                  checked={site.shared_with_team}
                  onCheckedChange={(val) => toggleShare(site.id, val)}
                  disabled={updating === site.id}
                />
              </div>
            </div>
          ))}
        </div>
        {sharedCount > 0 && (
          <p className="text-[11px] text-muted-foreground mt-3">
            {language === 'fr'
              ? `${sharedCount} site${sharedCount > 1 ? 's' : ''} partagé${sharedCount > 1 ? 's' : ''} — vos collaborateurs pourront interroger Félix et le Stratège sur ces sites.`
              : `${sharedCount} site${sharedCount > 1 ? 's' : ''} shared — your collaborators can ask Félix and the Strategist about these sites.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}