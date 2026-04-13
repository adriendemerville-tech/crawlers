import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Globe, CheckCircle, XCircle, HelpCircle, FileText, Clock, ExternalLink, Loader2, RefreshCw, Bot, LayoutList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { CrawlResult, BotResult } from '@/types/crawler';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Shared bot card ──
function BotStatusCard({ bot }: { bot: BotResult }) {
  const config = {
    allowed: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20', label: 'Autorisé' },
    blocked: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', label: 'Bloqué' },
    unknown: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', label: 'Inconnu' },
  }[bot.status];
  const Icon = config.icon;

  return (
    <Card className={cn('p-3 transition-all hover:shadow-md', config.border)}>
      <div className="flex items-center gap-2">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.bg, config.color)}>
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
        <span className="font-semibold text-sm text-foreground">{bot.name}</span>
        <span className="text-xs text-muted-foreground">({bot.company})</span>
      </div>
      {bot.reason && <p className="mt-1 text-xs text-muted-foreground pl-1">{bot.reason}</p>}
    </Card>
  );
}

// ── Shared summary bar ──
function ScanSummary({ result }: { result: CrawlResult }) {
  const allowed = result.bots.filter(b => b.status === 'allowed').length;
  const blocked = result.bots.filter(b => b.status === 'blocked').length;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-sm">
        <Globe className="h-4 w-4 text-primary" />
        <span className="font-medium truncate max-w-[300px]">{result.url}</span>
        <span className="text-xs text-muted-foreground">HTTP {result.httpStatus}</span>
      </div>
      <div className="flex gap-3 text-xs font-medium">
        <span className="text-success">{allowed} ✓</span>
        <span className="text-destructive">{blocked} ✗</span>
      </div>
    </div>
  );
}

// ── URL list item ──
interface PageItem {
  url: string;
  title: string;
  type: 'page' | 'post' | 'article' | 'landing';
}

interface ScanResult {
  page: PageItem;
  result: CrawlResult | null;
  status: 'pending' | 'scanning' | 'done' | 'error';
  error?: string;
}

// ── Crawler panel (reused for both sources) ──
function CrawlerPanel({
  label,
  pages,
  loading,
  onRefresh,
}: {
  label: string;
  pages: PageItem[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  // Reset scans when pages change
  useEffect(() => {
    setScans(pages.map(p => ({ page: p, result: null, status: 'pending' })));
    setSelectedUrl(null);
  }, [pages]);

  const scanAll = async () => {
    setScanning(true);
    const updated = [...scans];

    for (let i = 0; i < updated.length; i++) {
      updated[i] = { ...updated[i], status: 'scanning' };
      setScans([...updated]);

      try {
        const { data, error } = await supabase.functions.invoke('check-crawlers', {
          body: { url: updated[i].page.url }
        });
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error || 'Échec');
        updated[i] = { ...updated[i], status: 'done', result: data.data };
      } catch (err: any) {
        updated[i] = { ...updated[i], status: 'error', error: err.message };
      }
      setScans([...updated]);
    }

    setScanning(false);
    const done = updated.filter(s => s.status === 'done').length;
    const blocked = updated.filter(s => s.result?.bots.some(b => b.status === 'blocked')).length;
    toast({
      title: `Scan ${label} terminé`,
      description: `${done}/${updated.length} pages scannées, ${blocked} avec blocage(s)`,
    });
  };

  const scanSingle = async (index: number) => {
    const updated = [...scans];
    updated[index] = { ...updated[index], status: 'scanning' };
    setScans(updated);

    try {
      const { data, error } = await supabase.functions.invoke('check-crawlers', {
        body: { url: updated[index].page.url }
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || 'Échec');
      updated[index] = { ...updated[index], status: 'done', result: data.data };
    } catch (err: any) {
      updated[index] = { ...updated[index], status: 'error', error: err.message };
    }
    setScans([...updated]);
  };

  const selectedScan = scans.find(s => s.page.url === selectedUrl);
  const doneCount = scans.filter(s => s.status === 'done').length;
  const blockedPages = scans.filter(s => s.result?.bots.some(b => b.status === 'blocked'));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading ? 'Chargement des pages…' : `${pages.length} page(s) détectée(s)`}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Rafraîchir
          </Button>
          <Button size="sm" onClick={scanAll} disabled={scanning || pages.length === 0} className="gap-1.5">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Scanner tout ({pages.length})
          </Button>
        </div>
      </div>

      {/* Progress */}
      {scanning && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${(doneCount / Math.max(scans.length, 1)) * 100}%` }}
          />
        </div>
      )}

      {/* Summary badges */}
      {doneCount > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3 text-success" />
            {doneCount} scannée(s)
          </Badge>
          {blockedPages.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {blockedPages.length} avec blocage(s)
            </Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Page list */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutList className="h-4 w-4" />
              Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border">
                {scans.map((scan, i) => (
                  <button
                    key={scan.page.url}
                    onClick={() => setSelectedUrl(scan.page.url)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/50 transition-colors",
                      selectedUrl === scan.page.url && "bg-muted"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{scan.page.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{scan.page.url}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {scan.page.type}
                      </Badge>
                      {scan.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); scanSingle(i); }}>
                          <Search className="h-3 w-3" />
                        </Button>
                      )}
                      {scan.status === 'scanning' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {scan.status === 'done' && (
                        scan.result?.bots.some(b => b.status === 'blocked')
                          ? <XCircle className="h-4 w-4 text-destructive" />
                          : <CheckCircle className="h-4 w-4 text-success" />
                      )}
                      {scan.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </button>
                ))}
                {pages.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune page trouvée
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail panel */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Détail des bots
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px] px-4 pb-4">
              {!selectedScan ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Sélectionnez une page pour voir les résultats
                </div>
              ) : selectedScan.status === 'pending' ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Page non encore scannée
                </div>
              ) : selectedScan.status === 'scanning' ? (
                <div className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground mt-2">Scan en cours…</p>
                </div>
              ) : selectedScan.status === 'error' ? (
                <div className="text-center py-12 text-destructive text-sm">
                  Erreur : {selectedScan.error}
                </div>
              ) : selectedScan.result ? (
                <div className="space-y-2 pt-2">
                  <ScanSummary result={selectedScan.result} />
                  {selectedScan.result.bots.map(bot => (
                    <BotStatusCard key={bot.name} bot={bot} />
                  ))}
                  {selectedScan.result.robotsTxt && (
                    <details className="mt-3">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Voir robots.txt
                      </summary>
                      <pre className="text-[10px] bg-muted p-3 rounded-lg mt-1 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                        {selectedScan.result.robotsTxt}
                      </pre>
                    </details>
                  )}
                </div>
              ) : null}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main component ──
export function ParmenionCrawlersTab() {
  const [ikPages, setIkPages] = useState<PageItem[]>([]);
  const [cmsPages, setCmsPages] = useState<PageItem[]>([]);
  const [ikLoading, setIkLoading] = useState(false);
  const [cmsLoading, setCmsLoading] = useState(false);

  // Fetch IKTracker pages via edge function
  const fetchIkPages = useCallback(async () => {
    setIkLoading(true);
    try {
      // Get the IKTracker base URL from tracked_sites with cms_connections
      const { data: conn } = await supabase
        .from('cms_connections')
        .select('site_url')
        .eq('platform', 'iktracker' as any)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      const baseUrl = conn?.site_url || 'https://iktracker.fr';

      const { data, error } = await supabase.functions.invoke('iktracker-actions', {
        body: { action: 'list-pages' }
      });

      const pages: PageItem[] = [];

      if (!error && data?.success && Array.isArray(data.data)) {
        for (const p of data.data) {
          const slug = p.slug || p.page_key || p.key || '';
          pages.push({
            url: slug.startsWith('http') ? slug : `${baseUrl}/${slug}`.replace(/\/+$/, ''),
            title: p.title || p.name || slug,
            type: 'page',
          });
        }
      }

      // Also fetch posts
      const { data: postsData } = await supabase.functions.invoke('iktracker-actions', {
        body: { action: 'list-posts', limit: 100 }
      });

      if (postsData?.success && Array.isArray(postsData.data)) {
        for (const p of postsData.data) {
          const slug = p.slug || '';
          pages.push({
            url: slug.startsWith('http') ? slug : `${baseUrl}/blog/${slug}`.replace(/\/+$/, ''),
            title: p.title || slug,
            type: 'post',
          });
        }
      }

      setIkPages(pages);
    } catch (err) {
      console.error('[parmenion-crawlers] IK fetch error:', err);
      setIkPages([]);
    }
    setIkLoading(false);
  }, []);

  // Fetch CMS Crawlers pages from DB
  const fetchCmsPages = useCallback(async () => {
    setCmsLoading(true);
    try {
      const pages: PageItem[] = [];
      const baseUrl = 'https://crawlers.fr';

      // Blog articles
      const { data: articles } = await supabase
        .from('blog_articles')
        .select('slug, title, status')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (articles) {
        for (const a of articles) {
          pages.push({
            url: `${baseUrl}/blog/${a.slug}`,
            title: a.title,
            type: 'article',
          });
        }
      }

      // Landing pages (seo_page_drafts)
      const { data: landings } = await supabase
        .from('seo_page_drafts' as any)
        .select('slug, title, status')
        .eq('page_type', 'landing')
        .eq('status', 'published');

      if (landings) {
        for (const l of landings as any[]) {
          pages.push({
            url: `${baseUrl}/landing/${l.slug}`,
            title: l.title,
            type: 'landing',
          });
        }
      }

      setCmsPages(pages);
    } catch (err) {
      console.error('[parmenion-crawlers] CMS fetch error:', err);
      setCmsPages([]);
    }
    setCmsLoading(false);
  }, []);

  useEffect(() => {
    fetchIkPages();
    fetchCmsPages();
  }, [fetchIkPages, fetchCmsPages]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Vérification des crawlers IA
          </CardTitle>
          <CardDescription>
            Scannez les pages IKTracker et Crawlers.fr pour détecter les blocages de bots IA (robots.txt, meta tags, HTTP).
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="iktracker" className="space-y-4">
        <TabsList>
          <TabsTrigger value="iktracker" className="gap-2">
            <Globe className="h-4 w-4" />
            IKTracker
          </TabsTrigger>
          <TabsTrigger value="crawlers-cms" className="gap-2">
            <FileText className="h-4 w-4" />
            CMS Crawlers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="iktracker">
          <CrawlerPanel
            label="IKTracker"
            pages={ikPages}
            loading={ikLoading}
            onRefresh={fetchIkPages}
          />
        </TabsContent>

        <TabsContent value="crawlers-cms">
          <CrawlerPanel
            label="CMS Crawlers"
            pages={cmsPages}
            loading={cmsLoading}
            onRefresh={fetchCmsPages}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
