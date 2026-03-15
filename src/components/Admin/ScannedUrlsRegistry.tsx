import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

interface AnalyzedUrl {
  id: string;
  url: string;
  domain: string;
  analysis_count: number;
  first_analyzed_at: string;
  last_analyzed_at: string;
}

export function ScannedUrlsRegistry() {
  const [urls, setUrls] = useState<AnalyzedUrl[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  const fetchUrls = useCallback(async () => {
    setIsLoading(true);
    try {
      // Exclude tracked_sites domains (automatic monitoring)
      const { data: trackedSites } = await supabase
        .from('tracked_sites')
        .select('domain');
      const trackedDomains = new Set(
        (trackedSites || []).map(s => s.domain?.toLowerCase()).filter(Boolean)
      );

      const { data } = await supabase
        .from('analyzed_urls')
        .select('*')
        .order('last_analyzed_at', { ascending: false })
        .limit(500);

      const filtered = (data || []).filter(
        u => !trackedDomains.has(u.domain?.toLowerCase())
      );
      setTotalCount(filtered.length);
      setUrls(filtered);
    } catch (err) {
      console.error('Error fetching scanned URLs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  const displayed = urls.filter(u =>
    !search || u.url.toLowerCase().includes(search.toLowerCase()) || u.domain.toLowerCase().includes(search.toLowerCase())
  );
  const visible = showAll ? displayed : displayed.slice(0, 25);

  // Stats
  const uniqueDomains = new Set(urls.map(u => u.domain?.toLowerCase())).size;
  const totalScans = urls.reduce((s, u) => s + u.analysis_count, 0);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>URLs uniques</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{totalCount.toLocaleString('fr-FR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Domaines distincts</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{uniqueDomains.toLocaleString('fr-FR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scans totaux</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{totalScans.toLocaleString('fr-FR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* URL List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Registre des URLs scannées
              </CardTitle>
              <CardDescription>Sites testés par les utilisateurs (hors suivi automatique)</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchUrls} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par URL ou domaine…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Chargement…</p>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune URL trouvée</p>
          ) : (
            <>
              <ScrollArea className={showAll ? 'h-[500px]' : 'h-auto'}>
                <div className="space-y-2">
                  {visible.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm truncate block text-primary hover:underline flex items-center gap-1"
                          >
                            {item.url}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Domaine : {item.domain}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <span className="font-semibold text-primary">{item.analysis_count}×</span>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(item.last_analyzed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {displayed.length > 25 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Voir moins' : `Voir tout (${displayed.length})`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
