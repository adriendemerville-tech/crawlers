import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, ExternalLink, RefreshCw, Search, Magnet, FileSearch, ScanSearch, Network, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';

interface AnalyzedUrl {
  id: string;
  url: string;
  domain: string;
  analysis_count: number;
  first_analyzed_at: string;
  last_analyzed_at: string;
}

interface TypeCounts {
  magnet: number;
  audit: number;
  crawl: number;
  cocoon: number;
}

export function ScannedUrlsRegistry() {
  const [urls, setUrls] = useState<AnalyzedUrl[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [sortByScans, setSortByScans] = useState(false);
  const [typeCounts, setTypeCounts] = useState<TypeCounts>({ magnet: 0, audit: 0, crawl: 0, cocoon: 0 });

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

      const [urlsRes, eventsRes, crawlsRes, cocoonRes] = await Promise.all([
        supabase
          .from('analyzed_urls')
          .select('*')
          .order('last_analyzed_at', { ascending: false })
          .limit(500),
        // Count analytics events by type (magnet = free_analysis_*, audit = expert_audit_*)
        supabase
          .from('analytics_events')
          .select('event_type')
          .in('event_type', [
            'free_analysis_crawlers', 'free_analysis_geo', 'free_analysis_llm', 'free_analysis_pagespeed',
            'expert_audit_launched', 'expert_audit_step_1', 'expert_audit_step_2', 'expert_audit_step_3',
          ]),
        // Count crawls
        supabase
          .from('site_crawls')
          .select('id', { count: 'exact', head: true }),
        // Count cocoon sessions
        supabase
          .from('cocoon_sessions')
          .select('id', { count: 'exact', head: true }),
      ]);

      const filtered = (urlsRes.data || []).filter(
        u => !trackedDomains.has(u.domain?.toLowerCase())
      );
      setTotalCount(filtered.length);
      setUrls(filtered);

      // Compute type counts
      const events = eventsRes.data || [];
      const magnetCount = events.filter(e =>
        e.event_type.startsWith('free_analysis_')
      ).length;
      const auditCount = events.filter(e =>
        e.event_type.startsWith('expert_audit_')
      ).length;

      setTypeCounts({
        magnet: magnetCount,
        audit: auditCount,
        crawl: crawlsRes.count || 0,
        cocoon: cocoonRes.count || 0,
      });
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

  // Sort: by total scans desc or by date desc (default)
  const sorted = sortByScans
    ? [...displayed].sort((a, b) => b.analysis_count - a.analysis_count)
    : displayed;

  const visible = showAll ? sorted : sorted.slice(0, 25);

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

      {/* Type-specific KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between px-3 py-2 pb-0">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Lead Magnet (Home)</CardTitle>
            <Magnet className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3 py-2 pt-0.5">
            <div className="text-lg font-bold">{typeCounts.magnet.toLocaleString('fr-FR')}</div>
            <p className="text-[9px] text-muted-foreground">Analyses gratuites</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between px-3 py-2 pb-0">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Audit Stratégique</CardTitle>
            <FileSearch className="h-3.5 w-3.5 text-violet-500" />
          </CardHeader>
          <CardContent className="px-3 py-2 pt-0.5">
            <div className="text-lg font-bold">{typeCounts.audit.toLocaleString('fr-FR')}</div>
            <p className="text-[9px] text-muted-foreground">Audits experts lancés</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between px-3 py-2 pb-0">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Crawl Multi-pages</CardTitle>
            <ScanSearch className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="px-3 py-2 pt-0.5">
            <div className="text-lg font-bold">{typeCounts.crawl.toLocaleString('fr-FR')}</div>
            <p className="text-[9px] text-muted-foreground">Sites crawlés</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between px-3 py-2 pb-0">
            <CardTitle className="text-[11px] font-medium text-muted-foreground">Cocoon</CardTitle>
            <Network className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-3 py-2 pt-0.5">
            <div className="text-lg font-bold">{typeCounts.cocoon.toLocaleString('fr-FR')}</div>
            <p className="text-[9px] text-muted-foreground">Graphes sémantiques</p>
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
              <Toggle
                pressed={sortByScans}
                onPressedChange={setSortByScans}
                size="sm"
                aria-label="Trier par nombre de scans"
                className="gap-1.5 text-xs"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortByScans ? 'Par scans' : 'Par date'}
              </Toggle>
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
              {sorted.length > 25 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Voir moins' : `Voir tout (${sorted.length})`}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
