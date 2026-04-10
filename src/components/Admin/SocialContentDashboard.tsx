import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw, MessageSquare, Calendar, Globe, Languages, ImageIcon,
  TrendingUp, Zap, Users, Hash, Link2, ArrowUpRight, BarChart3
} from 'lucide-react';
import { subDays, format, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const SOCIAL_FUNCTIONS = [
  'generate-social-content',
  'generate-social-image',
  'translate-social-post',
  'resolve-social-link',
  'shorten-social-link',
  'publish-to-social',
  'export-social-zip',
];

const FUNCTION_LABELS: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  'generate-social-content': { label: 'Génération contenu', icon: MessageSquare, color: '#8b5cf6' },
  'generate-social-image': { label: 'Génération image', icon: ImageIcon, color: '#f59e0b' },
  'translate-social-post': { label: 'Traduction', icon: Languages, color: '#06b6d4' },
  'resolve-social-link': { label: 'Smart Link', icon: Link2, color: '#10b981' },
  'shorten-social-link': { label: 'Raccourcisseur', icon: Link2, color: '#6366f1' },
  'publish-to-social': { label: 'Publication', icon: Globe, color: '#ec4899' },
  'export-social-zip': { label: 'Export ZIP', icon: ArrowUpRight, color: '#f97316' },
};

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'google/gemini-2.5-flash-lite': { input: 0.075, output: 0.30 },
};

function estimateCostEur(model: string, pt: number, ct: number): number {
  const p = MODEL_PRICING[model] || { input: 0.50, output: 2.00 };
  return ((pt * p.input + ct * p.output) / 1_000_000) * 0.92;
}

const PIE_COLORS = ['#8b5cf6', '#f59e0b', '#06b6d4', '#10b981', '#6366f1', '#ec4899', '#f97316'];

export function SocialContentDashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');
  const [stats, setStats] = useState({
    totalPosts: 0,
    published: 0,
    drafts: 0,
    scheduled: 0,
    byPlatform: {} as Record<string, number>,
    totalGenerations: 0,
    totalTranslations: 0,
    totalImages: 0,
    totalSmartLinks: 0,
    totalExports: 0,
    totalPublications: 0,
    totalTokens: 0,
    totalCostEur: 0,
    byFunction: {} as Record<string, { calls: number; tokens: number; cost: number }>,
    uniqueUsers: 0,
    dailyData: [] as { date: string; label: string; generations: number; cost: number }[],
    topUsers: [] as { user_id: string; email: string; count: number }[],
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const sinceDate = period === '7d' ? subDays(new Date(), 7).toISOString()
        : period === '30d' ? subDays(new Date(), 30).toISOString()
        : undefined;

      // Fetch social posts
      let postsQuery = supabase.from('social_posts').select('id, status, publish_platforms, created_at, user_id');
      if (sinceDate) postsQuery = postsQuery.gte('created_at', sinceDate);
      const { data: posts } = await postsQuery;

      // Fetch AI usage for social functions
      let usageQuery = supabase.from('ai_gateway_usage').select('*')
        .in('edge_function', SOCIAL_FUNCTIONS);
      if (sinceDate) usageQuery = usageQuery.gte('created_at', sinceDate);
      const { data: usage } = await usageQuery;

      // Fetch analytics events for social functions
      let eventsQuery = supabase.from('analytics_events').select('event_type, event_data, created_at, user_id')
        .eq('event_type', 'ai_token_usage');
      if (sinceDate) eventsQuery = eventsQuery.gte('created_at', sinceDate);
      const { data: events } = await eventsQuery;

      // Filter events to social functions only
      const socialEvents = (events || []).filter(e => {
        const fn = (e.event_data as Record<string, unknown>)?.function_name as string;
        return SOCIAL_FUNCTIONS.includes(fn);
      });

      // Process posts
      const allPosts = posts || [];
      const published = allPosts.filter(p => p.status === 'published').length;
      const drafts = allPosts.filter(p => p.status === 'draft').length;
      const scheduled = allPosts.filter(p => p.status === 'scheduled').length;

      const byPlatform: Record<string, number> = {};
      allPosts.forEach(p => {
        const pls = (p.publish_platforms || []) as string[];
        pls.forEach(pl => { byPlatform[pl] = (byPlatform[pl] || 0) + 1; });
      });

      // Process AI usage
      const byFunction: Record<string, { calls: number; tokens: number; cost: number }> = {};
      let totalTokens = 0;
      let totalCostEur = 0;

      (usage || []).forEach(u => {
        const fn = u.edge_function || 'unknown';
        if (!byFunction[fn]) byFunction[fn] = { calls: 0, tokens: 0, cost: 0 };
        byFunction[fn].calls++;
        byFunction[fn].tokens += u.total_tokens || 0;
        const cost = estimateCostEur(u.model, u.prompt_tokens || 0, u.completion_tokens || 0);
        byFunction[fn].cost += cost;
        totalTokens += u.total_tokens || 0;
        totalCostEur += cost;
      });

      // Daily breakdown from events
      const dailyMap = new Map<string, { generations: number; cost: number }>();
      socialEvents.forEach(e => {
        const day = format(startOfDay(new Date(e.created_at)), 'yyyy-MM-dd');
        const data = e.event_data as Record<string, unknown>;
        const model = (data?.model as string) || 'google/gemini-2.5-flash';
        const pt = Number(data?.prompt_tokens) || 0;
        const ct = Number(data?.completion_tokens) || 0;
        const entry = dailyMap.get(day) || { generations: 0, cost: 0 };
        entry.generations++;
        entry.cost += estimateCostEur(model, pt, ct);
        dailyMap.set(day, entry);
      });

      const dailyData = [...dailyMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, d]) => ({
          date,
          label: format(new Date(date), 'dd MMM', { locale: fr }),
          generations: d.generations,
          cost: Math.round(d.cost * 10000) / 10000,
        }));

      // Unique users
      const userSet = new Set<string>();
      allPosts.forEach(p => { if (p.user_id) userSet.add(p.user_id); });
      socialEvents.forEach(e => { if (e.user_id) userSet.add(e.user_id); });

      // Top users by generation count
      const userCounts: Record<string, number> = {};
      socialEvents.forEach(e => {
        if (e.user_id) userCounts[e.user_id] = (userCounts[e.user_id] || 0) + 1;
      });

      const topUserIds = Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      let topUsers: { user_id: string; email: string; count: number }[] = [];
      if (topUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, first_name')
          .in('user_id', topUserIds.map(u => u[0]));

        topUsers = topUserIds.map(([uid, count]) => {
          const p = profiles?.find(pr => pr.user_id === uid);
          return { user_id: uid, email: p?.email || p?.first_name || uid.slice(0, 8), count };
        });
      }

      setStats({
        totalPosts: allPosts.length,
        published,
        drafts,
        scheduled,
        byPlatform,
        totalGenerations: byFunction['generate-social-content']?.calls || 0,
        totalTranslations: byFunction['translate-social-post']?.calls || 0,
        totalImages: byFunction['generate-social-image']?.calls || 0,
        totalSmartLinks: byFunction['resolve-social-link']?.calls || 0,
        totalExports: byFunction['export-social-zip']?.calls || 0,
        totalPublications: byFunction['publish-to-social']?.calls || 0,
        totalTokens,
        totalCostEur,
        byFunction,
        uniqueUsers: userSet.size,
        dailyData,
        topUsers,
      });
    } catch (err) {
      console.error('SocialContentDashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const functionPieData = useMemo(() => {
    return Object.entries(stats.byFunction)
      .filter(([, v]) => v.calls > 0)
      .map(([fn, v]) => ({
        name: FUNCTION_LABELS[fn]?.label || fn,
        value: v.calls,
        color: FUNCTION_LABELS[fn]?.color || '#888',
      }));
  }, [stats.byFunction]);

  const platformPieData = useMemo(() => {
    return Object.entries(stats.byPlatform).map(([platform, count], i) => ({
      name: platform.charAt(0).toUpperCase() + platform.slice(1),
      value: count,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [stats.byPlatform]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Social Content Hub — Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">Statistiques d'usage et coûts de production</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as '7d' | '30d' | 'all')}>
            <ToggleGroupItem value="7d" size="sm" className="text-xs">7j</ToggleGroupItem>
            <ToggleGroupItem value="30d" size="sm" className="text-xs">30j</ToggleGroupItem>
            <ToggleGroupItem value="all" size="sm" className="text-xs">Tout</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Posts créés</span>
              <MessageSquare className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div className="text-lg font-bold">{stats.totalPosts}</div>
            <div className="flex gap-1 mt-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0">{stats.published} publiés</Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0">{stats.drafts} brouillons</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Générations IA</span>
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-bold">{stats.totalGenerations}</div>
            <p className="text-[9px] text-muted-foreground">contenu texte</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Images IA</span>
              <ImageIcon className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <div className="text-lg font-bold">{stats.totalImages}</div>
            <p className="text-[9px] text-muted-foreground">canvas générés</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Traductions</span>
              <Languages className="h-3.5 w-3.5 text-cyan-500" />
            </div>
            <div className="text-lg font-bold">{stats.totalTranslations}</div>
            <p className="text-[9px] text-muted-foreground">posts traduits</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Utilisateurs</span>
              <Users className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold">{stats.uniqueUsers}</div>
            <p className="text-[9px] text-muted-foreground">utilisateurs actifs</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Coût production</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-lg font-bold">
              {stats.totalCostEur.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €
            </div>
            <p className="text-[9px] text-muted-foreground">{stats.totalTokens.toLocaleString('fr-FR')} tokens</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Activity Chart */}
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Activité quotidienne</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {stats.dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(value: number, name: string) =>
                      name === 'cost' ? [`${value.toFixed(4)} €`, 'Coût'] : [value, 'Générations']
                    }
                  />
                  <Area type="monotone" dataKey="generations" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">Aucune donnée</div>
            )}
          </CardContent>
        </Card>

        {/* Function Breakdown Pie */}
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Répartition par fonction</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {functionPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={functionPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                      {functionPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 text-xs">
                  {functionPieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-medium ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">Aucune donnée</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cost per function */}
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Coûts par fonction</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {Object.entries(stats.byFunction)
                .sort((a, b) => b[1].cost - a[1].cost)
                .map(([fn, data]) => {
                  const meta = FUNCTION_LABELS[fn];
                  return (
                    <div key={fn} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color || '#888' }} />
                        <span>{meta?.label || fn}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{data.calls} appels</span>
                        <span className="font-mono font-medium">{data.cost.toFixed(4)} €</span>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(stats.byFunction).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun appel enregistré</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform distribution */}
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Posts par plateforme</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {platformPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={platformPieData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                      {platformPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 text-xs">
                  {platformPieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}</span>
                      <span className="font-medium ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground">Aucun post</div>
            )}
          </CardContent>
        </Card>

        {/* Top users */}
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm">Top utilisateurs</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {stats.topUsers.map((u, i) => (
                <div key={u.user_id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 w-5 justify-center">{i + 1}</Badge>
                    <span className="truncate max-w-[120px]">{u.email}</span>
                  </div>
                  <span className="font-medium">{u.count} générations</span>
                </div>
              ))}
              {stats.topUsers.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun utilisateur</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost estimation info */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <BarChart3 className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Coût estimé par génération de contenu social</p>
              <ul className="space-y-0.5">
                <li>• <strong>Génération texte</strong> (Gemini 2.5 Flash) : ~2000 tokens → ~0.0005€ par post</li>
                <li>• <strong>Génération image</strong> (Gemini 2.5 Flash) : ~2000 tokens → ~0.0005€ par canvas</li>
                <li>• <strong>Traduction</strong> (Gemini 2.5 Flash Lite) : ~1500 tokens → ~0.0002€ par traduction</li>
                <li>• <strong>Smart Link / Export / Publication</strong> : pas de coût LLM (requêtes DB uniquement)</li>
              </ul>
              <p className="mt-1">Coût moyen d'un post complet (texte + image + traduction) ≈ <strong>0.0012€</strong></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
