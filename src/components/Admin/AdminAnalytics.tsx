import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { DndContext, closestCenter, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Users, MousePointer, TrendingUp, Eye, UserPlus, Link2, Loader2, GripVertical } from 'lucide-react';

interface AdminAnalyticsProps {
  language: 'fr' | 'en' | 'es';
}

interface KPICard {
  id: string;
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const translations = {
  fr: {
    loading: 'Chargement...',
    pageViews: 'Visites',
    signups: 'Inscriptions',
    signupClicks: 'Clics inscription',
    urlsTested: 'URLs testées',
    conversionRate: 'Taux de conversion',
    clicksByFeature: 'Clics par fonction',
    recentUrls: 'Dernières URLs testées',
    dailyStats: 'Statistiques quotidiennes',
    noData: 'Aucune donnée',
    dragToReorder: 'Glissez pour réorganiser',
  },
  en: {
    loading: 'Loading...',
    pageViews: 'Page Views',
    signups: 'Signups',
    signupClicks: 'Signup Clicks',
    urlsTested: 'URLs Tested',
    conversionRate: 'Conversion Rate',
    clicksByFeature: 'Clicks by Feature',
    recentUrls: 'Recent URLs Tested',
    dailyStats: 'Daily Statistics',
    noData: 'No data',
    dragToReorder: 'Drag to reorder',
  },
  es: {
    loading: 'Cargando...',
    pageViews: 'Visitas',
    signups: 'Registros',
    signupClicks: 'Clics en registro',
    urlsTested: 'URLs probadas',
    conversionRate: 'Tasa de conversión',
    clicksByFeature: 'Clics por función',
    recentUrls: 'URLs recientes probadas',
    dailyStats: 'Estadísticas diarias',
    noData: 'Sin datos',
    dragToReorder: 'Arrastra para reordenar',
  },
};

function SortableKPICard({ card }: { card: KPICard }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="cursor-move hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
          </span>
          {card.title}
        </CardTitle>
        <div className={`p-2 rounded-full ${card.color}`}>
          {card.icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{card.value}</div>
      </CardContent>
    </Card>
  );
}

export function AdminAnalytics({ language }: AdminAnalyticsProps) {
  const t = translations[language];
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<{
    pageViews: number;
    signups: number;
    signupClicks: number;
    urlsTested: number;
    conversionRate: string;
    recentUrls: string[];
    clicksByFeature: { name: string; count: number }[];
    dailyStats: { date: string; views: number; signups: number }[];
  }>({
    pageViews: 0,
    signups: 0,
    signupClicks: 0,
    urlsTested: 0,
    conversionRate: '0%',
    recentUrls: [],
    clicksByFeature: [],
    dailyStats: [],
  });

  const [cardOrder, setCardOrder] = useState(['pageViews', 'signups', 'signupClicks', 'urlsTested', 'conversionRate']);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);

      try {
        // Fetch analytics events
        const { data: events } = await supabase
          .from('analytics_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (events) {
          const pageViews = events.filter(e => e.event_type === 'page_view').length;
          const signups = events.filter(e => e.event_type === 'signup_complete').length;
          const signupClicks = events.filter(e => e.event_type === 'signup_click').length;
          const urlsTested = events.filter(e => e.event_type === 'url_tested').length;
          const conversionRate = signupClicks > 0 ? ((signups / signupClicks) * 100).toFixed(1) + '%' : '0%';

          // Get recent URLs
          const recentUrls = events
            .filter(e => e.event_type === 'url_tested' && e.event_data)
            .slice(0, 10)
            .map(e => (e.event_data as { url?: string })?.url || '')
            .filter(Boolean);

          // Clicks by feature
          const featureClicks = events.filter(e => e.event_type === 'button_click');
          const featureMap: Record<string, number> = {};
          featureClicks.forEach(e => {
            const feature = (e.event_data as { feature?: string })?.feature || 'unknown';
            featureMap[feature] = (featureMap[feature] || 0) + 1;
          });
          const clicksByFeature = Object.entries(featureMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          // Daily stats (last 7 days)
          const last7Days: { date: string; views: number; signups: number }[] = [];
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayEvents = events.filter(e => e.created_at.startsWith(dateStr));
            last7Days.push({
              date: date.toLocaleDateString(language, { weekday: 'short' }),
              views: dayEvents.filter(e => e.event_type === 'page_view').length,
              signups: dayEvents.filter(e => e.event_type === 'signup_complete').length,
            });
          }

          setAnalytics({
            pageViews,
            signups,
            signupClicks,
            urlsTested,
            conversionRate,
            recentUrls,
            clicksByFeature,
            dailyStats: last7Days,
          });
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }

      setLoading(false);
    };

    fetchAnalytics();
  }, [language]);

  const kpiCards: KPICard[] = useMemo(() => [
    { id: 'pageViews', title: t.pageViews, value: analytics.pageViews, icon: <Eye className="h-4 w-4 text-white" />, color: 'bg-blue-500' },
    { id: 'signups', title: t.signups, value: analytics.signups, icon: <UserPlus className="h-4 w-4 text-white" />, color: 'bg-emerald-500' },
    { id: 'signupClicks', title: t.signupClicks, value: analytics.signupClicks, icon: <MousePointer className="h-4 w-4 text-white" />, color: 'bg-amber-500' },
    { id: 'urlsTested', title: t.urlsTested, value: analytics.urlsTested, icon: <Link2 className="h-4 w-4 text-white" />, color: 'bg-purple-500' },
    { id: 'conversionRate', title: t.conversionRate, value: analytics.conversionRate, icon: <TrendingUp className="h-4 w-4 text-white" />, color: 'bg-rose-500' },
  ], [analytics, t]);

  const orderedCards = cardOrder.map(id => kpiCards.find(card => card.id === id)).filter(Boolean) as KPICard[];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cardOrder.indexOf(active.id as string);
      const newIndex = cardOrder.indexOf(over.id as string);
      setCardOrder(arrayMove(cardOrder, oldIndex, newIndex));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Draggable KPI Cards */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">{t.dragToReorder}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {orderedCards.map(card => (
                <SortableKPICard key={card.id} card={card} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Stats Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t.dailyStats}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ views: { label: t.pageViews, color: 'hsl(var(--primary))' }, signups: { label: t.signups, color: 'hsl(142, 76%, 36%)' } }} className="h-[250px]">
              <LineChart data={analytics.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="signups" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Clicks by Feature Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t.clicksByFeature}</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.clicksByFeature.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                {t.noData}
              </div>
            ) : (
              <ChartContainer config={{ count: { label: 'Clicks', color: 'hsl(var(--primary))' } }} className="h-[250px]">
                <BarChart data={analytics.clicksByFeature}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent URLs */}
      <Card>
        <CardHeader>
          <CardTitle>{t.recentUrls}</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.recentUrls.length === 0 ? (
            <p className="text-muted-foreground">{t.noData}</p>
          ) : (
            <ul className="space-y-2">
              {analytics.recentUrls.map((url, i) => (
                <li key={i} className="text-sm p-2 rounded bg-muted/50 truncate font-mono">
                  {url}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
