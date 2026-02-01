import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPICard } from './KPICard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Users,
  MousePointerClick,
  TrendingUp,
  FileText,
  Eye,
  UserPlus,
  Globe,
  BarChart3,
  Loader2,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

interface AnalyticsData {
  visits: number;
  signups: number;
  signupClicks: number;
  conversionRate: number;
  featureClicks: Record<string, number>;
  recentUrls: { url: string; created_at: string }[];
  dailyData: { date: string; visits: number; signups: number }[];
}

const defaultKpiOrder = [
  'visits',
  'signups',
  'signupClicks',
  'conversionRate',
  'auditsRun',
  'reportsGenerated',
];

export function StatsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    visits: 0,
    signups: 0,
    signupClicks: 0,
    conversionRate: 0,
    featureClicks: {},
    recentUrls: [],
    dailyData: [],
  });
  const [kpiOrder, setKpiOrder] = useState<string[]>(defaultKpiOrder);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch analytics events
      const { data: events, error } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      // Process events
      const visits = events?.filter(e => e.event_type === 'page_view').length || 0;
      const signups = events?.filter(e => e.event_type === 'signup_complete').length || 0;
      const signupClicks = events?.filter(e => e.event_type === 'signup_click').length || 0;
      const conversionRate = visits > 0 ? Math.round((signups / visits) * 100 * 10) / 10 : 0;

      // Feature clicks
      const featureClicks: Record<string, number> = {};
      events?.filter(e => e.event_type === 'feature_click').forEach(e => {
        const feature = (e.event_data as any)?.feature || 'unknown';
        featureClicks[feature] = (featureClicks[feature] || 0) + 1;
      });

      // Recent URLs
      const recentUrls = events
        ?.filter(e => e.event_type === 'audit_start' && e.url)
        .slice(0, 10)
        .map(e => ({ url: e.url!, created_at: e.created_at })) || [];

      // Daily data for charts
      const dailyMap = new Map<string, { visits: number; signups: number }>();
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      last7Days.forEach(date => dailyMap.set(date, { visits: 0, signups: 0 }));

      events?.forEach(e => {
        const date = e.created_at.split('T')[0];
        if (dailyMap.has(date)) {
          const current = dailyMap.get(date)!;
          if (e.event_type === 'page_view') current.visits++;
          if (e.event_type === 'signup_complete') current.signups++;
        }
      });

      const dailyData = last7Days.map(date => ({
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
        ...dailyMap.get(date)!,
      }));

      setAnalytics({
        visits,
        signups,
        signupClicks,
        conversionRate,
        featureClicks,
        recentUrls,
        dailyData,
      });

      // Load saved KPI order
      if (user) {
        const { data: config } = await supabase
          .from('admin_dashboard_config')
          .select('card_order')
          .eq('user_id', user.id)
          .maybeSingle();

        if (config?.card_order) {
          setKpiOrder(config.card_order as string[]);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = kpiOrder.indexOf(active.id as string);
      const newIndex = kpiOrder.indexOf(over.id as string);
      const newOrder = arrayMove(kpiOrder, oldIndex, newIndex);
      setKpiOrder(newOrder);

      // Save to database
      if (user) {
        await supabase
          .from('admin_dashboard_config')
          .upsert({
            user_id: user.id,
            card_order: newOrder,
          }, { onConflict: 'user_id' });
      }
    }
  };

  const kpiData: Record<string, { title: string; value: string | number; icon: any; color: any; change?: number }> = {
    visits: { title: 'Visites', value: analytics.visits, icon: Eye, color: 'default', change: 12 },
    signups: { title: 'Inscriptions', value: analytics.signups, icon: UserPlus, color: 'success', change: 8 },
    signupClicks: { title: 'Clics inscription', value: analytics.signupClicks, icon: MousePointerClick, color: 'warning' },
    conversionRate: { title: 'Taux de conversion', value: `${analytics.conversionRate}%`, icon: TrendingUp, color: 'success', change: 2 },
    auditsRun: { title: 'Audits lancés', value: analytics.recentUrls.length, icon: Globe, color: 'default' },
    reportsGenerated: { title: 'Rapports générés', value: 0, icon: FileText, color: 'default' },
  };

  const chartConfig = {
    visits: { label: 'Visites', color: 'hsl(var(--primary))' },
    signups: { label: 'Inscriptions', color: 'hsl(var(--chart-2))' },
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={kpiOrder} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpiOrder.map((id) => {
              const data = kpiData[id];
              if (!data) return null;
              return (
                <KPICard
                  key={id}
                  id={id}
                  title={data.title}
                  value={data.value}
                  icon={data.icon}
                  color={data.color}
                  change={data.change}
                  changeLabel="7j"
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Charts */}
      <Tabs defaultValue="bar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bar" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Histogramme
          </TabsTrigger>
          <TabsTrigger value="line" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Courbes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bar">
          <Card>
            <CardHeader>
              <CardTitle>Visites et inscriptions (7 derniers jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dailyData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="visits" fill="var(--color-visits)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="signups" fill="var(--color-signups)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="line">
          <Card>
            <CardHeader>
              <CardTitle>Évolution des visites et inscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.dailyData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="visits" stroke="var(--color-visits)" strokeWidth={2} />
                    <Line type="monotone" dataKey="signups" stroke="var(--color-signups)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature Clicks & Recent URLs */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              Clics par fonctionnalité
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.featureClicks).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(analytics.featureClicks)
                  .sort(([, a], [, b]) => b - a)
                  .map(([feature, count]) => (
                    <div key={feature} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune donnée</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Dernières URLs testées
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.recentUrls.length > 0 ? (
              <div className="space-y-2">
                {analytics.recentUrls.map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                    <span className="truncate max-w-[200px]">{item.url}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(item.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">Aucune URL testée</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
