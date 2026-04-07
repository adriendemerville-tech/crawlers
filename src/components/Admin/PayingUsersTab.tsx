import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Crown, TrendingUp, AlertTriangle } from 'lucide-react';

interface PayingUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  plan_type: string;
  credits_balance: number;
  created_at: string;
  // Crawl stats
  totalCrawledPages: number;
  crawlCount: number;
  estimatedCost: number;
  lastCrawlAt: string | null;
}

const SPIDER_COST_PER_PAGE = 0.001; // $0.001
const EUR_USD = 0.92; // approximate

export function PayingUsersTab() {
  const [users, setUsers] = useState<PayingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ totalPages: 0, totalCost: 0, userCount: 0 });

  const fetchPayingUsers = async () => {
    setLoading(true);
    try {
      // 1. Get all paying users
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, plan_type, credits_balance, created_at')
        .in('plan_type', ['agency_pro', 'agency_premium']);

      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        setUsers([]);
        setTotals({ totalPages: 0, totalCost: 0, userCount: 0 });
        setLoading(false);
        return;
      }

      // 2. Get crawl data for all paying users (current month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const userIds = profiles.map(p => p.user_id);
      
      const { data: crawls } = await supabase
        .from('site_crawls')
        .select('user_id, crawled_pages, created_at')
        .in('user_id', userIds)
        .gte('created_at', monthStart)
        .eq('status', 'completed');

      // Aggregate crawl data per user
      const crawlMap = new Map<string, { totalPages: number; count: number; lastAt: string | null }>();
      (crawls || []).forEach(c => {
        const existing = crawlMap.get(c.user_id) || { totalPages: 0, count: 0, lastAt: null };
        existing.totalPages += c.crawled_pages || 0;
        existing.count += 1;
        if (!existing.lastAt || c.created_at > existing.lastAt) existing.lastAt = c.created_at;
        crawlMap.set(c.user_id, existing);
      });

      const enriched: PayingUser[] = profiles.map(p => {
        const crawlData = crawlMap.get(p.user_id) || { totalPages: 0, count: 0, lastAt: null };
        const costUsd = crawlData.totalPages * SPIDER_COST_PER_PAGE;
        const costEur = costUsd * EUR_USD;
        return {
          ...p,
          totalCrawledPages: crawlData.totalPages,
          crawlCount: crawlData.count,
          estimatedCost: Math.round(costEur * 100) / 100,
          lastCrawlAt: crawlData.lastAt,
        };
      }).sort((a, b) => b.totalCrawledPages - a.totalCrawledPages);

      const totalPages = enriched.reduce((s, u) => s + u.totalCrawledPages, 0);
      const totalCost = enriched.reduce((s, u) => s + u.estimatedCost, 0);

      setUsers(enriched);
      setTotals({ totalPages, totalCost: Math.round(totalCost * 100) / 100, userCount: enriched.length });
    } catch (err) {
      console.error('Error fetching paying users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayingUsers(); }, []);

  const getPlanLabel = (plan: string) => {
    if (plan === 'agency_premium') return { label: 'Pro Agency +', color: 'border-amber-500 text-amber-500' };
    return { label: 'Pro Agency', color: 'border-violet-500 text-violet-500' };
  };

  const getMarginColor = (user: PayingUser) => {
    const price = user.plan_type === 'agency_premium' ? 79 : 29;
    const margin = price - user.estimatedCost;
    const pct = (margin / price) * 100;
    if (pct < 10) return 'text-red-500';
    if (pct < 30) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getMarginPct = (user: PayingUser) => {
    const price = user.plan_type === 'agency_premium' ? 79 : 29;
    const margin = price - user.estimatedCost;
    return Math.round((margin / price) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{totals.userCount}</div>
          <div className="text-xs text-muted-foreground">Abonnés payants</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{totals.totalPages.toLocaleString('fr-FR')}</div>
          <div className="text-xs text-muted-foreground">Pages crawlées (mois)</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className="text-2xl font-bold text-amber-500">{totals.totalCost.toFixed(2)}€</div>
          <div className="text-xs text-muted-foreground">Coût crawl total (mois)</div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
          <div className={`text-2xl font-bold ${totals.userCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
            {totals.userCount > 0 ? (totals.totalCost / totals.userCount).toFixed(2) : '0.00'}€
          </div>
          <div className="text-xs text-muted-foreground">Coût moyen/user</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          Utilisateurs payants — Monitoring crawl
        </h3>
        <Button variant="ghost" size="sm" onClick={fetchPayingUsers} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Aucun utilisateur payant
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs py-1.5">Utilisateur</TableHead>
                <TableHead className="text-xs py-1.5">Plan</TableHead>
                <TableHead className="text-xs py-1.5 text-right">Pages crawlées</TableHead>
                <TableHead className="text-xs py-1.5 text-right">Crawls</TableHead>
                <TableHead className="text-xs py-1.5 text-right">Coût estimé</TableHead>
                <TableHead className="text-xs py-1.5 text-right">Marge</TableHead>
                <TableHead className="text-xs py-1.5">Dernier crawl</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const plan = getPlanLabel(user.plan_type);
                const price = user.plan_type === 'agency_premium' ? 79 : 29;
                const marginPct = getMarginPct(user);
                const marginColor = getMarginColor(user);
                
                return (
                  <TableRow key={user.user_id}>
                    <TableCell className="py-2">
                      <div>
                        <div className="text-xs font-medium">{user.first_name} {user.last_name}</div>
                        <div className="text-[10px] text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className={`text-[10px] font-medium ${user.plan_type === 'agency_premium' ? 'text-amber-500' : 'text-violet-500'}`}>
                        {plan.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-xs font-mono font-semibold">
                        {user.totalCrawledPages.toLocaleString('fr-FR')}
                      </span>
                      {user.plan_type === 'agency_premium' && user.totalCrawledPages > 40000 && (
                        <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1" />
                      )}
                      {user.plan_type === 'agency_pro' && user.totalCrawledPages > 4000 && (
                        <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1" />
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs text-muted-foreground">
                      {user.crawlCount}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <span className="text-xs font-mono font-semibold text-amber-500">
                        {user.estimatedCost.toFixed(2)}€
                      </span>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingUp className={`h-3 w-3 ${marginColor}`} />
                        <span className={`text-xs font-bold ${marginColor}`}>
                          {marginPct}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({(price - user.estimatedCost).toFixed(2)}€)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {user.lastCrawlAt 
                        ? new Date(user.lastCrawlAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-right">
        Estimation basée sur Spider API ($0.001/page) • Mois en cours • Taux EUR/USD ≈ 0.92
      </div>
    </div>
  );
}
