import { useState, useEffect } from 'react';
import { History, Globe, Undo2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, es, enUS } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  rule_id: string;
  domain_id: string;
  url_pattern: string;
  payload_type: string;
  payload_data: Record<string, unknown>;
  version: number;
  created_at: string;
}

interface TrackedSite {
  id: string;
  domain: string;
  site_name: string;
}

const translations = {
  fr: {
    empty: 'Aucun historique de règles disponible',
    emptyDesc: 'L\'historique apparaîtra après modification de vos règles multi-pages',
    version: 'Version',
    restore: 'Restaurer cette version',
    restored: 'Version restaurée avec succès',
    restoreError: 'Erreur lors de la restauration',
    pattern: 'Pattern',
    type: 'Type',
    noSites: 'Aucun site suivi',
  },
  en: {
    empty: 'No rule history available',
    emptyDesc: 'History will appear after modifying your multi-page rules',
    version: 'Version',
    restore: 'Restore this version',
    restored: 'Version restored successfully',
    restoreError: 'Error restoring version',
    pattern: 'Pattern',
    type: 'Type',
    noSites: 'No tracked sites',
  },
  es: {
    empty: 'No hay historial de reglas disponible',
    emptyDesc: 'El historial aparecerá después de modificar sus reglas multi-página',
    version: 'Versión',
    restore: 'Restaurar esta versión',
    restored: 'Versión restaurada con éxito',
    restoreError: 'Error al restaurar la versión',
    pattern: 'Patrón',
    type: 'Tipo',
    noSites: 'Sin sitios rastreados',
  },
};

const PAYLOAD_TYPE_LABELS: Record<string, string> = {
  GLOBAL_FIXES: 'Global',
  FAQPage: 'FAQ',
  Article: 'Article',
  Organization: 'Organization',
  LocalBusiness: 'LocalBusiness',
  BreadcrumbList: 'Breadcrumbs',
  Product: 'Product',
  HTML_INJECTION: 'HTML',
};

export function MyScriptRulesHistory() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const dateLocale = language === 'fr' ? fr : language === 'es' ? es : enUS;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [historyBySite, setHistoryBySite] = useState<Record<string, HistoryEntry[]>>({});
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch tracked sites
    const { data: sitesData } = await supabase
      .from('tracked_sites')
      .select('id, domain, site_name')
      .eq('user_id', user.id)
      .order('domain');

    const trackedSites = (sitesData || []) as TrackedSite[];
    setSites(trackedSites);

    if (trackedSites.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch last 5 history entries per site
    const siteIds = trackedSites.map(s => s.id);
    const { data: historyData } = await supabase
      .from('site_script_rules_history')
      .select('*')
      .eq('user_id', user.id)
      .in('domain_id', siteIds)
      .order('created_at', { ascending: false })
      .limit(100); // fetch enough to get 5 per site

    // Group by domain_id, keep last 5 per site
    const grouped: Record<string, HistoryEntry[]> = {};
    for (const entry of (historyData || []) as any[]) {
      const key = entry.domain_id;
      if (!grouped[key]) grouped[key] = [];
      if (grouped[key].length < 5) {
        grouped[key].push(entry as HistoryEntry);
      }
    }
    setHistoryBySite(grouped);

    // Auto-expand first site with history
    const firstWithHistory = trackedSites.find(s => grouped[s.id]?.length > 0);
    if (firstWithHistory) {
      setExpandedSites(new Set([firstWithHistory.id]));
    }

    setLoading(false);
  };

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const handleRestore = async (entry: HistoryEntry) => {
    setRestoringId(entry.id);
    try {
      const { error } = await supabase
        .from('site_script_rules')
        .update({ payload_data: entry.payload_data as any })
        .eq('id', entry.rule_id);

      if (error) throw error;
      toast.success(t.restored);
      fetchData(); // refresh
    } catch (err) {
      console.error('[History] Restore error:', err);
      toast.error(t.restoreError);
    } finally {
      setRestoringId(null);
    }
  };

  const hasAnyHistory = Object.values(historyBySite).some(h => h.length > 0);

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (sites.length === 0 || !hasAnyHistory) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium">{t.empty}</p>
        <p className="text-sm mt-1">{t.emptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sites.map(site => {
        const history = historyBySite[site.id] || [];
        if (history.length === 0) return null;
        const isExpanded = expandedSites.has(site.id);

        return (
          <Card key={site.id} className="overflow-hidden">
            <button
              onClick={() => toggleSite(site.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <Globe className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate">{site.site_name || site.domain}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {history.length} {t.version.toLowerCase()}s
              </Badge>
            </button>

            {isExpanded && (
              <CardContent className="pt-0 pb-3 px-3 space-y-1.5">
                {history.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-xs bg-muted/30 rounded-md px-3 py-2 group"
                  >
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                      v{entry.version}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      {entry.url_pattern}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-[10px] font-medium">
                      {PAYLOAD_TYPE_LABELS[entry.payload_type] || entry.payload_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRestore(entry)}
                      disabled={restoringId === entry.id}
                    >
                      <Undo2 className="w-3 h-3" />
                      {t.restore}
                    </Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
