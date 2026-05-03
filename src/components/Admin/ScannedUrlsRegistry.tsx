import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Globe, ExternalLink, RefreshCw, Search, Magnet, FileSearch, ScanSearch, Network, ArrowUpDown, User, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { CrawlPagesStatsCard } from './CrawlPagesStatsCard';

interface MergedUrl {
  id: string;
  url: string;
  domain: string;
  analysis_count: number;
  first_analyzed_at: string;
  last_analyzed_at: string;
  source: 'analyzed' | 'tracked' | 'both';
  userName?: string;
  userEmail?: string;
}

interface TypeCounts {
  magnet: number;
  audit: number;
  crawl: number;
  cocoon: number;
}

type LastAuditType = 'magnet' | 'audit' | 'crawl' | 'cocoon' | null;

function getLastAuditIcon(type: LastAuditType) {
  switch (type) {
    case 'magnet': return <span title="Lead Magnet"><Magnet className="h-3.5 w-3.5 text-blue-500" /></span>;
    case 'audit': return <span title="Audit Stratégique"><FileSearch className="h-3.5 w-3.5 text-violet-500" /></span>;
    case 'crawl': return <span title="Crawl"><ScanSearch className="h-3.5 w-3.5 text-amber-500" /></span>;
    case 'cocoon': return <span title="Cocoon"><Network className="h-3.5 w-3.5 text-emerald-500" /></span>;
    default: return null;
  }
}

function getSourceBadge(source: MergedUrl['source']) {
  switch (source) {
    case 'tracked': return <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400">Suivi</Badge>;
    case 'both': return <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/30 text-primary">Scan + Suivi</Badge>;
    default: return <Badge variant="outline" className="text-[9px] px-1 py-0 border-muted-foreground/30 text-muted-foreground">Scan</Badge>;
  }
}

export function ScannedUrlsRegistry() {
  const [urls, setUrls] = useState<MergedUrl[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [sortByScans, setSortByScans] = useState(false);
  const [typeCounts, setTypeCounts] = useState<TypeCounts>({ magnet: 0, audit: 0, crawl: 0, cocoon: 0 });
  const [lastAuditMap, setLastAuditMap] = useState<Record<string, LastAuditType>>({});

  const fetchUrls = useCallback(async () => {
    setIsLoading(true);
    try {
      const [urlsRes, trackedRes, eventsRes, crawlsRes, cocoonRes, lastEventsRes] = await Promise.all([
        supabase.from('analyzed_urls').select('*').order('last_analyzed_at', { ascending: false }).limit(500),
        supabase.from('tracked_sites').select('id, domain, user_id, created_at'),
        supabase.from('analytics_events').select('event_type, target_url, user_id')
          .in('event_type', [
            'free_analysis_crawlers', 'free_analysis_geo', 'free_analysis_llm', 'free_analysis_pagespeed',
            'expert_audit_launched', 'expert_audit_step_1', 'expert_audit_step_2', 'expert_audit_step_3',
          ]),
        supabase.from('site_crawls').select('id', { count: 'exact', head: true }),
        supabase.from('cocoon_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('analytics_events').select('event_type, target_url, created_at')
          .in('event_type', [
            'free_analysis_crawlers', 'free_analysis_geo', 'free_analysis_llm', 'free_analysis_pagespeed',
            'expert_audit_launched', 'expert_audit_step_1', 'expert_audit_step_2', 'expert_audit_step_3',
          ])
          .not('target_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);

      // Collect all user_ids we need to resolve
      const trackedSites = trackedRes.data || [];
      const trackedUserIds = new Set(trackedSites.map(s => s.user_id).filter(Boolean));
      
      // Also find user_ids from analytics_events for analyzed_urls
      const eventsByUrl: Record<string, string> = {};
      for (const evt of (eventsRes.data || [])) {
        if (evt.target_url && evt.user_id && !eventsByUrl[evt.target_url]) {
          eventsByUrl[evt.target_url] = evt.user_id;
        }
      }
      const analyzedUserIds = new Set(Object.values(eventsByUrl));
      
      // Fetch all relevant profiles
      const allUserIds = [...new Set([...trackedUserIds, ...analyzedUserIds])];
      const profileMap: Record<string, { name: string; email: string }> = {};
      
      if (allUserIds.length > 0) {
        // Batch fetch profiles (max 100 at a time)
        for (let i = 0; i < allUserIds.length; i += 100) {
          const batch = allUserIds.slice(i, i + 100);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, email')
            .in('user_id', batch);
          for (const p of (profiles || [])) {
            profileMap[p.user_id] = {
              name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Utilisateur',
              email: p.email || '',
            };
          }
        }
      }

      // Build tracked domains map: domain → { user info, created_at }
      const trackedDomainsMap: Record<string, { userId: string; createdAt: string }> = {};
      for (const ts of trackedSites) {
        const d = ts.domain?.toLowerCase();
        if (d) trackedDomainsMap[d] = { userId: ts.user_id, createdAt: ts.created_at };
      }

      // Merge: start with analyzed_urls — but EXCLUDE any URL whose domain is tracked
      // (tracked sites are monitored scans, they would falsify the public scan registry)
      const mergedMap: Record<string, MergedUrl> = {};

      for (const u of (urlsRes.data || [])) {
        const d = u.domain?.toLowerCase();
        if (d && trackedDomainsMap[d]) continue; // skip — will be added from tracked_sites below
        const userId = eventsByUrl[u.url];
        const profile = userId ? profileMap[userId] : undefined;

        mergedMap[d || u.url] = {
          id: u.id,
          url: u.url,
          domain: u.domain,
          analysis_count: u.analysis_count,
          first_analyzed_at: u.first_analyzed_at,
          last_analyzed_at: u.last_analyzed_at,
          source: 'analyzed',
          userName: profile?.name,
          userEmail: profile?.email,
        };
      }

      // Add tracked_sites domains (always shown as 'tracked', never mixed with scan counts)
      for (const ts of trackedSites) {
        const d = ts.domain?.toLowerCase();
        if (!d || mergedMap[d]) continue;
        const profile = profileMap[ts.user_id];
        mergedMap[d] = {
          id: ts.id,
          url: `https://${ts.domain}`,
          domain: ts.domain,
          analysis_count: 0,
          first_analyzed_at: ts.created_at,
          last_analyzed_at: ts.created_at,
          source: 'tracked',
          userName: profile?.name,
          userEmail: profile?.email,
        };
      }

      const merged = Object.values(mergedMap).sort(
        (a, b) => new Date(b.last_analyzed_at).getTime() - new Date(a.last_analyzed_at).getTime()
      );
      
      setUrls(merged);
      setTotalCount(merged.length);

      // Type counts
      const events = eventsRes.data || [];
      setTypeCounts({
        magnet: events.filter(e => e.event_type.startsWith('free_analysis_')).length,
        audit: events.filter(e => e.event_type.startsWith('expert_audit_')).length,
        crawl: crawlsRes.count || 0,
        cocoon: cocoonRes.count || 0,
      });

      // Last audit type map
      const auditMap: Record<string, LastAuditType> = {};
      for (const evt of (lastEventsRes.data || [])) {
        const url = evt.target_url;
        if (!url || auditMap[url]) continue;
        if (evt.event_type.startsWith('free_analysis_')) auditMap[url] = 'magnet';
        else if (evt.event_type.startsWith('expert_audit_')) auditMap[url] = 'audit';
      }
      setLastAuditMap(auditMap);
    } catch (err) {
      console.error('Error fetching scanned URLs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUrls(); }, [fetchUrls]);

  const displayed = urls.filter(u =>
    !search || u.url.toLowerCase().includes(search.toLowerCase()) || u.domain.toLowerCase().includes(search.toLowerCase())
      || u.userName?.toLowerCase().includes(search.toLowerCase()) || u.userEmail?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = sortByScans
    ? [...displayed].sort((a, b) => b.analysis_count - a.analysis_count)
    : displayed;

  const visible = showAll ? sorted : sorted.slice(0, 25);

  const uniqueDomains = new Set(urls.map(u => u.domain?.toLowerCase())).size;
  const totalScans = urls.reduce((s, u) => s + u.analysis_count, 0);
  const trackedCount = urls.filter(u => u.source === 'tracked' || u.source === 'both').length;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <CrawlPagesStatsCard />

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>URLs uniques</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{totalCount.toLocaleString('fr-FR')}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Domaines distincts</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{uniqueDomains.toLocaleString('fr-FR')}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Scans totaux</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold text-primary">{totalScans.toLocaleString('fr-FR')}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Sites suivis</CardDescription></CardHeader>
            <CardContent><p className="text-2xl font-bold text-emerald-400">{trackedCount.toLocaleString('fr-FR')}</p></CardContent>
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
                  Registre des URLs scannées & suivies
                </CardTitle>
                <CardDescription>Toutes les URLs testées ou suivies par les utilisateurs</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Toggle pressed={sortByScans} onPressedChange={setSortByScans} size="sm" className="gap-1.5 text-xs">
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
              <Input placeholder="Rechercher par URL, domaine ou utilisateur…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
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
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {lastAuditMap[item.url] && (
                            <div className="shrink-0">{getLastAuditIcon(lastAuditMap[item.url])}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <a href={item.url} target="_blank" rel="noopener noreferrer"
                                className="font-mono text-sm truncate text-primary hover:underline flex items-center gap-1">
                                {item.url}
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                              {getSourceBadge(item.source)}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">Domaine : {item.domain}</p>
                              {item.userName && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70 cursor-default">
                                      <User className="h-3 w-3" />
                                      {item.userName}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <p className="font-medium">{item.userName}</p>
                                    {item.userEmail && <p className="text-muted-foreground">{item.userEmail}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          {item.analysis_count > 0 && <span className="font-semibold text-primary">{item.analysis_count}×</span>}
                          {item.source === 'tracked' && item.analysis_count === 0 && (
                            <span className="text-xs text-emerald-400 flex items-center gap-1 justify-end"><Eye className="h-3 w-3" /> Suivi</span>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(item.last_analyzed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {sorted.length > 25 && (
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setShowAll(!showAll)}>
                    {showAll ? 'Voir moins' : `Voir tout (${sorted.length})`}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
