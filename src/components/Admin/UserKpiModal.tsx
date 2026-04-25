import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Activity, Clock, FileText, Globe, CreditCard, Calendar, BarChart3, MousePointer, TrendingUp, User, ExternalLink, Search, AlertTriangle, Bug, ShieldCheck, Trash2, Crown, Eye, EyeOff, FileSearch, ChevronDown, Pencil, Radio, Pause, Play, RefreshCw, Network, Plug } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  credits_balance: number;
  created_at: string;
  plan_type?: string;
  persona_type?: string | null;
  updated_at?: string;
  affiliate_code_used?: string | null;
}

interface UserKpis {
  totalSessions: number;
  lastSessionAt: string | null;
  avgSessionDurationMin: number;
  totalAudits: number;
  totalUrlsTested: number;
  totalReportsSaved: number;
  totalEvents: number;
  totalCorrectiveCodes: number;
  totalActionPlans: number;
  totalBackendErrors: number;
  totalFrontendErrors: number;
  planType: string;
  bundleApiCount: number;
  bundleMonthlyEur: number;
  totalTrackedSites: number;
  totalCmsConnected: number;
}

interface ScannedUrl {
  url: string;
  event_type: string;
  created_at: string;
}

interface UserKpiModalProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteUser?: (user: UserProfile) => void;
  onToggleRole?: (userId: string, role: string) => void;
  onManageCredits?: (user: UserProfile) => void;
  onStripPro?: (user: UserProfile) => void;
  onEditProfile?: (user: UserProfile) => void;
  adminUserIds?: Set<string>;
  viewerUserIds?: Set<string>;
  viewer2UserIds?: Set<string>;
  auditorUserIds?: Set<string>;
}

interface LogEntry {
  id: string;
  event_type: string;
  event_data: any;
  target_url: string | null;
  created_at: string;
}

export function UserKpiModal({ user, open, onOpenChange, onDeleteUser, onToggleRole, onManageCredits, onStripPro, onEditProfile, adminUserIds, viewerUserIds, viewer2UserIds, auditorUserIds }: UserKpiModalProps) {
  const [kpis, setKpis] = useState<UserKpis | null>(null);
  const [scannedUrls, setScannedUrls] = useState<ScannedUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [urlsLoading, setUrlsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [livePolling, setLivePolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    fetchKpis(user.user_id);
    fetchScannedUrls(user.user_id);
    fetchLogs(user.user_id, true);
  }, [open, user]);

  // Cleanup polling on unmount or close
  useEffect(() => {
    if (!open) {
      setLivePolling(false);
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [open]);

  // Live polling effect
  useEffect(() => {
    if (livePolling && user) {
      pollingRef.current = setInterval(() => fetchLogs(user.user_id, false), 5000);
      return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    }
  }, [livePolling, user]);

  const fetchLogs = useCallback(async (userId: string, initial: boolean) => {
    if (initial) setLogsLoading(true);
    try {
      const query = supabase
        .from('analytics_events')
        .select('id, event_type, event_data, target_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);

      const { data } = await query;
      if (data) {
        setLogs(data as LogEntry[]);
        if (data.length > 0 && data[0].id !== lastLogIdRef.current) {
          lastLogIdRef.current = data[0].id;
          // Auto-scroll on new entries
          setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }
    } catch { /* silent */ } finally {
      if (initial) setLogsLoading(false);
    }
  }, []);

  const fetchKpis = async (userId: string) => {
    try {
      const [
        sessionsRes,
        reportsRes,
        auditsRes,
        codesRes,
        plansRes,
        eventsRes,
        backendErrorsRes,
        frontendErrorsRes,
      ] = await Promise.all([
        // Sessions & activity from analytics_events
        supabase
          .from('analytics_events')
          .select('session_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        // Saved reports
        supabase
          .from('saved_reports')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        // Audits
        supabase
          .from('audits')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        // Corrective codes
        supabase
          .from('saved_corrective_codes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        // Workbench items (replaces action_plans)
        supabase
          .from('architect_workbench')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        // Total events
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        // Backend errors (silent_error, edge_function_error, browserless_error, scan_error, scan_error_final)
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('event_type', ['silent_error', 'edge_function_error', 'browserless_error', 'scan_error', 'scan_error_final']),
        // Frontend errors
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('event_type', 'error'),
      ]);

      // Calculate sessions
      const events = sessionsRes.data || [];
      const sessionIds = new Set(events.map(e => e.session_id).filter(Boolean));
      const totalSessions = sessionIds.size || (events.length > 0 ? 1 : 0);
      const lastSessionAt = events.length > 0 ? events[0].created_at : null;

      // Estimate avg session duration from events
      let avgSessionDurationMin = 0;
      if (sessionIds.size > 0) {
        const sessionDurations: number[] = [];
        const sessionEvents = new Map<string, string[]>();
        events.forEach(e => {
          if (e.session_id) {
            const arr = sessionEvents.get(e.session_id) || [];
            arr.push(e.created_at);
            sessionEvents.set(e.session_id, arr);
          }
        });
        sessionEvents.forEach(timestamps => {
          if (timestamps.length >= 2) {
            const sorted = timestamps.sort();
            const dur = (new Date(sorted[sorted.length - 1]).getTime() - new Date(sorted[0]).getTime()) / 60000;
            if (dur > 0 && dur < 120) sessionDurations.push(dur);
          }
        });
        if (sessionDurations.length > 0) {
          avgSessionDurationMin = Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length * 10) / 10;
        }
      }

      // URLs tested + bundle data + tracked sites + CMS connections
      const [urlCountRes, bundleRes, trackedSitesRes, cmsConnectionsRes] = await Promise.all([
        supabase
          .from('analytics_events')
          .select('target_url', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('target_url', 'is', null),
        supabase
          .from('bundle_subscriptions' as any)
          .select('selected_apis, monthly_price_cents')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle() as any,
        supabase
          .from('tracked_sites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('cms_connections')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active'),
      ]);

      const bundleData = bundleRes.data;
      const bundleApiCount = bundleData?.selected_apis?.length || 0;
      const bundleMonthlyEur = (bundleData?.monthly_price_cents || 0) / 100;

      setKpis({
        totalSessions,
        lastSessionAt,
        avgSessionDurationMin,
        totalAudits: auditsRes.count || 0,
        totalUrlsTested: urlCountRes.count || 0,
        totalReportsSaved: reportsRes.count || 0,
        totalEvents: eventsRes.count || 0,
        totalCorrectiveCodes: codesRes.count || 0,
        totalActionPlans: plansRes.count || 0,
        totalBackendErrors: backendErrorsRes.count || 0,
        totalFrontendErrors: frontendErrorsRes.count || 0,
        planType: (user as any).plan_type || 'free',
        bundleApiCount,
        bundleMonthlyEur,
        totalTrackedSites: trackedSitesRes.count || 0,
        totalCmsConnected: cmsConnectionsRes.count || 0,
      });
    } catch (err) {
      console.error('Error fetching KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchScannedUrls = async (userId: string) => {
    setUrlsLoading(true);
    try {
      const { data } = await supabase
        .from('analytics_events')
        .select('target_url, event_type, created_at')
        .eq('user_id', userId)
        .not('target_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      const urls: ScannedUrl[] = (data || []).map(e => ({
        url: e.target_url!,
        event_type: e.event_type,
        created_at: e.created_at,
      }));
      setScannedUrls(urls);
    } catch {
      setScannedUrls([]);
    } finally {
      setUrlsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const eventLabel = (type: string) => {
    if (type.includes('crawl')) return 'Crawl';
    if (type.includes('audit') || type.includes('strategic')) return 'Audit';
    if (type.includes('magnet') || type.includes('check-crawlers')) return 'Magnet';
    if (type.includes('cocoon')) return 'Cocoon';
    return type;
  };

  const eventColor = (type: string) => {
    if (type.includes('crawl')) return 'bg-amber-500/10 text-amber-600';
    if (type.includes('audit') || type.includes('strategic')) return 'bg-purple-500/10 text-purple-600';
    if (type.includes('magnet') || type.includes('check-crawlers')) return 'bg-blue-500/10 text-blue-600';
    if (type.includes('cocoon')) return 'bg-emerald-500/10 text-emerald-600';
    return 'bg-muted text-muted-foreground';
  };

  const kpiItems = kpis ? [
    { icon: Calendar, label: 'Dernière session', value: formatDate(kpis.lastSessionAt), color: 'text-blue-500' },
    { icon: Activity, label: 'Sessions totales', value: kpis.totalSessions, color: 'text-green-500' },
    { icon: Clock, label: 'Durée moy. session', value: `${kpis.avgSessionDurationMin} min`, color: 'text-amber-500' },
    { icon: BarChart3, label: 'Audits lancés', value: kpis.totalAudits, color: 'text-purple-500' },
    { icon: Globe, label: 'URLs testées', value: kpis.totalUrlsTested, color: 'text-cyan-500' },
    { icon: FileText, label: 'Rapports sauvés', value: kpis.totalReportsSaved, color: 'text-indigo-500' },
    { icon: MousePointer, label: 'Événements totaux', value: kpis.totalEvents, color: 'text-rose-500' },
    { icon: TrendingUp, label: 'Codes correctifs', value: kpis.totalCorrectiveCodes, color: 'text-orange-500' },
    { icon: FileText, label: "Plans d'action", value: kpis.totalActionPlans, color: 'text-teal-500' },
    { icon: AlertTriangle, label: 'Erreurs back-end', value: kpis.totalBackendErrors, color: 'text-red-500' },
    { icon: Bug, label: 'Erreurs front-end', value: kpis.totalFrontendErrors, color: 'text-orange-600' },
    { icon: Network, label: 'Sites trackés', value: kpis.totalTrackedSites, color: 'text-violet-500' },
    { icon: Plug, label: 'CMS connectés', value: kpis.totalCmsConnected, color: 'text-yellow-500' },
    { icon: CreditCard, label: 'Plan', value: <Badge variant="outline">{kpis.planType}</Badge>, color: 'text-primary' },
    { icon: CreditCard, label: 'Bundle APIs', value: kpis.bundleApiCount > 0 ? <Badge variant="default" className="text-[10px]">{kpis.bundleApiCount} API{kpis.bundleApiCount > 1 ? 's' : ''} · {kpis.bundleMonthlyEur}€/mois</Badge> : '—', color: 'text-fuchsia-500' },
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {user?.first_name} {user?.last_name}
          </DialogTitle>
          <DialogDescription>
            {user?.email} · Inscrit le {user ? new Date(user.created_at).toLocaleDateString('fr-FR') : ''}
            {' · '}<Badge variant={user && user.credits_balance > 0 ? 'default' : 'secondary'}>{user?.credits_balance} crédits</Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Action buttons row */}
        {user && (onDeleteUser || onToggleRole || onManageCredits) && (
          <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-border">
            {onToggleRole && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Rôle
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Rôles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onToggleRole(user.user_id, 'admin')}>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {adminUserIds?.has(user.user_id) ? '✓ Créateur' : 'Créateur'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onToggleRole(user.user_id, 'viewer')}>
                    <Eye className="h-4 w-4 mr-2" />
                    {viewerUserIds?.has(user.user_id) ? '✓ Viewer' : 'Viewer'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onToggleRole(user.user_id, 'viewer_level2')}>
                    <EyeOff className="h-4 w-4 mr-2" />
                    {viewer2UserIds?.has(user.user_id) ? '✓ Viewer L2' : 'Viewer L2'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Cumulable (2h)</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onToggleRole(user.user_id, 'auditor')}>
                    <FileSearch className="h-4 w-4 mr-2" />
                    {auditorUserIds?.has(user.user_id) ? '✓ Auditeur' : 'Auditeur'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onManageCredits && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onManageCredits(user)}>
                <CreditCard className="h-3.5 w-3.5" />
                Crédits
              </Button>
            )}
            {onStripPro && (user as any).plan_type === 'agency_pro' && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500 text-amber-600" onClick={() => onStripPro(user)}>
                <Crown className="h-3.5 w-3.5" />
                Retirer Pro
              </Button>
            )}
            {onEditProfile && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onEditProfile(user)}>
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Button>
            )}
            {onDeleteUser && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto" onClick={() => onDeleteUser(user)}>
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            )}
          </div>
        )}

        <Tabs defaultValue="kpis" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="kpis" className="gap-1.5 flex-1">
              <BarChart3 className="h-3.5 w-3.5" />
              KPIs
            </TabsTrigger>
            <TabsTrigger value="urls" className="gap-1.5 flex-1">
              <Search className="h-3.5 w-3.5" />
              URLs
              {scannedUrls.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{scannedUrls.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 flex-1">
              <Radio className="h-3.5 w-3.5" />
              Logs
              {livePolling && <span className="ml-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kpis" className="overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : kpis ? (
              <div className="grid grid-cols-2 gap-3 py-2">
                {kpiItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
                    <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                      <p className="text-sm font-semibold truncate">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Aucune donnée disponible</p>
            )}
          </TabsContent>

          <TabsContent value="urls" className="overflow-y-auto max-h-[50vh]">
            {urlsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : scannedUrls.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune URL scannée</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">URL</TableHead>
                    <TableHead className="text-xs w-24">Type</TableHead>
                    <TableHead className="text-xs w-36">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannedUrls.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-mono max-w-[300px] truncate">
                        <a
                          href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          {item.url}
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${eventColor(item.event_type)}`}>
                          {eventLabel(item.event_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="logs" className="overflow-hidden flex flex-col flex-1">
            <div className="flex items-center gap-2 py-2 border-b border-border">
              <Button
                variant={livePolling ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setLivePolling(!livePolling)}
              >
                {livePolling ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {livePolling ? 'Pause' : 'Live'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => user && fetchLogs(user.user_id, true)}
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">{logs.length} événements</span>
            </div>
            <ScrollArea className="flex-1 max-h-[50vh]">
              {logsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun log</p>
              ) : (
                <div className="space-y-1 py-2 font-mono text-[11px]">
                  {logs.map((log) => {
                    const isError = log.event_type.includes('error');
                    const isFairUse = log.event_type.startsWith('fair_use:');
                    const isAudit = log.event_type.includes('audit') || log.event_type.includes('strategic');
                    const isCrawl = log.event_type.includes('crawl');
                    const colorClass = isError
                      ? 'text-red-500'
                      : isFairUse
                      ? 'text-amber-500'
                      : isAudit
                      ? 'text-purple-500'
                      : isCrawl
                      ? 'text-cyan-500'
                      : 'text-muted-foreground';

                    const time = new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const date = new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

                    // Extract useful info from event_data
                    let detail = '';
                    if (log.target_url) detail = log.target_url;
                    else if (log.event_data) {
                      const d = log.event_data as Record<string, any>;
                      detail = d.action || d.function_name || d.error_message || d.url || d.domain || '';
                      if (typeof detail !== 'string') detail = JSON.stringify(detail).slice(0, 120);
                    }

                    return (
                      <div key={log.id} className={`flex items-start gap-2 px-2 py-0.5 hover:bg-muted/50 rounded ${isError ? 'bg-red-500/5' : ''}`}>
                        <span className="text-muted-foreground/60 shrink-0 w-[70px]">{date} {time}</span>
                        <span className={`shrink-0 w-[180px] truncate ${colorClass}`}>{log.event_type}</span>
                        <span className="text-muted-foreground truncate">{detail}</span>
                      </div>
                    );
                  })}
                  <div ref={logsEndRef} />
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
