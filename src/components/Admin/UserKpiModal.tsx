import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Activity, Clock, FileText, Globe, CreditCard, Calendar, BarChart3, MousePointer, TrendingUp, User, ExternalLink, Search } from 'lucide-react';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  credits_balance: number;
  created_at: string;
  plan_type?: string;
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
  planType: string;
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
}

export function UserKpiModal({ user, open, onOpenChange }: UserKpiModalProps) {
  const [kpis, setKpis] = useState<UserKpis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    fetchKpis(user.user_id);
  }, [open, user]);

  const fetchKpis = async (userId: string) => {
    try {
      const [
        sessionsRes,
        reportsRes,
        auditsRes,
        codesRes,
        plansRes,
        eventsRes,
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
        // Action plans
        supabase
          .from('action_plans')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        // Total events
        supabase
          .from('analytics_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
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

      // URLs tested — count from analytics events with target_url
      const { count: urlCount } = await supabase
        .from('analytics_events')
        .select('target_url', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('target_url', 'is', null);

      setKpis({
        totalSessions,
        lastSessionAt,
        avgSessionDurationMin,
        totalAudits: auditsRes.count || 0,
        totalUrlsTested: urlCount || 0,
        totalReportsSaved: reportsRes.count || 0,
        totalEvents: eventsRes.count || 0,
        totalCorrectiveCodes: codesRes.count || 0,
        totalActionPlans: plansRes.count || 0,
        planType: (user as any).plan_type || 'free',
      });
    } catch (err) {
      console.error('Error fetching KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
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
    { icon: CreditCard, label: 'Plan', value: <Badge variant="outline">{kpis.planType}</Badge>, color: 'text-primary' },
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
      </DialogContent>
    </Dialog>
  );
}
