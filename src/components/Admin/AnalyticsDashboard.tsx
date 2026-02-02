import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  BarChart3, Users, FileText, CreditCard, TrendingUp, TrendingDown,
  RefreshCw, Loader2, MousePointer, Eye, UserPlus, Zap, GripVertical
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
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
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KPICard {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: string;
}

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_data: unknown;
  url: string | null;
  created_at: string;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function SortableKPICard({ card, isLoading }: { card: KPICard; isLoading: boolean }) {
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

  const Icon = card.icon;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className={`relative ${isDragging ? 'ring-2 ring-primary' : ''}`}>
        <div 
          {...listeners}
          className="absolute top-2 right-2 p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${card.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.title}</p>
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mt-1" />
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{card.value}</p>
                  {card.change !== undefined && (
                    <span className={`text-xs flex items-center ${card.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {card.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(card.change)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);
  const [paymentCount, setPaymentCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  
  const [cardOrder, setCardOrder] = useState<string[]>([
    'users', 'signups', 'audits', 'revenue', 'pageviews', 'conversions'
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Fetch analytics events
      const { data: eventsData, error: eventsError } = await supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Fetch user count
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (usersError) throw usersError;
      setUserCount(usersCount || 0);

      // Fetch article count
      const { count: articlesCount, error: articlesError } = await supabase
        .from('blog_articles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'published');

      if (articlesError) throw articlesError;
      setArticleCount(articlesCount || 0);

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('stripe_payments')
        .select('amount_cents')
        .eq('status', 'paid')
        .gte('created_at', startDate.toISOString());

      if (paymentsError) throw paymentsError;
      
      setPaymentCount(paymentsData?.length || 0);
      setTotalRevenue((paymentsData || []).reduce((sum, p) => sum + p.amount_cents, 0) / 100);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Save card order preference
  const saveCardOrder = async (newOrder: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('admin_dashboard_config')
        .upsert({
          user_id: user.id,
          card_order: newOrder,
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Error saving card order:', error);
    }
  };

  // Load card order preference
  useEffect(() => {
    const loadCardOrder = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('admin_dashboard_config')
          .select('card_order')
          .eq('user_id', user.id)
          .single();

        if (data?.card_order && Array.isArray(data.card_order)) {
          setCardOrder(data.card_order as string[]);
        }
      } catch (error) {
        // Config doesn't exist yet, use default
      }
    };
    loadCardOrder();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCardOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        saveCardOrder(newOrder);
        return newOrder;
      });
    }
  };

  // Calculate metrics from events
  const signupEvents = events.filter(e => e.event_type === 'signup');
  const auditEvents = events.filter(e => e.event_type === 'audit_started' || e.event_type === 'audit_completed');
  const pageviewEvents = events.filter(e => e.event_type === 'pageview');

  const kpiCards: KPICard[] = [
    { id: 'users', title: 'Utilisateurs totaux', value: userCount, icon: Users, color: 'bg-primary/10 text-primary' },
    { id: 'signups', title: 'Inscriptions', value: signupEvents.length, change: 12, icon: UserPlus, color: 'bg-emerald-500/10 text-emerald-600' },
    { id: 'audits', title: 'Audits lancés', value: auditEvents.length, change: 8, icon: Zap, color: 'bg-amber-500/10 text-amber-600' },
    { id: 'revenue', title: 'Revenus', value: `${totalRevenue.toFixed(2)}€`, icon: CreditCard, color: 'bg-violet-500/10 text-violet-600' },
    { id: 'pageviews', title: 'Pages vues', value: pageviewEvents.length, icon: Eye, color: 'bg-blue-500/10 text-blue-600' },
    { id: 'conversions', title: 'Conversions', value: paymentCount, change: 5, icon: MousePointer, color: 'bg-rose-500/10 text-rose-600' },
  ];

  // Prepare chart data
  const dailyData = events.reduce((acc, event) => {
    const date = new Date(event.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    if (!acc[date]) {
      acc[date] = { date, pageviews: 0, signups: 0, audits: 0 };
    }
    if (event.event_type === 'pageview') acc[date].pageviews++;
    if (event.event_type === 'signup') acc[date].signups++;
    if (event.event_type === 'audit_started' || event.event_type === 'audit_completed') acc[date].audits++;
    return acc;
  }, {} as Record<string, { date: string; pageviews: number; signups: number; audits: number }>);

  const chartData = Object.values(dailyData).slice(-14);

  // Feature usage pie chart
  const featureUsage = events.reduce((acc, event) => {
    const feature = event.event_type;
    acc[feature] = (acc[feature] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(featureUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // URLs testées
  const testedUrls = events
    .filter(e => e.event_type === 'audit_started' && e.url)
    .slice(-10)
    .reverse();

  const orderedCards = cardOrder.map(id => kpiCards.find(c => c.id === id)).filter(Boolean) as KPICard[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tableau de bord analytique
              </CardTitle>
              <CardDescription>
                Statistiques et métriques de la plateforme
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 derniers jours</SelectItem>
                  <SelectItem value="30d">30 derniers jours</SelectItem>
                  <SelectItem value="90d">90 derniers jours</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* KPI Cards - Draggable */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {orderedCards.map((card) => (
                  <SortableKPICard key={card.id} card={card} isLoading={loading} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Over Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Activité quotidienne</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="pageviews" 
                        stackId="1"
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.3}
                        name="Pages vues"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="audits" 
                        stackId="2"
                        stroke="hsl(var(--chart-2))" 
                        fill="hsl(var(--chart-2))" 
                        fillOpacity={0.3}
                        name="Audits"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Signups Over Time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Inscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar 
                        dataKey="signups" 
                        fill="hsl(var(--chart-3))" 
                        radius={[4, 4, 0, 0]}
                        name="Inscriptions"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Feature Usage Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Répartition des événements</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pieData.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Aucune donnée disponible
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent URLs Tested */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">URLs récemment testées</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : testedUrls.length === 0 ? (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Aucune URL testée récemment
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto">
                    {testedUrls.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <span className="text-sm truncate max-w-[70%] font-mono">
                          {event.url}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
