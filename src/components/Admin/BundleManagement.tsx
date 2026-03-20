import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Package, TrendingUp, AlertTriangle, RefreshCw, Users, Coins, ExternalLink, Cpu } from 'lucide-react';

interface BundleSub {
  id: string;
  user_id: string;
  selected_apis: string[];
  api_count: number;
  monthly_price_cents: number;
  status: string;
  created_at: string;
  stripe_subscription_id: string | null;
}

interface CatalogApi {
  id: string;
  api_name: string;
  seo_segment: string;
}

interface BundleError {
  id: string;
  user_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

interface ApiCostEntry {
  function_name: string;
  total_tokens: number;
  call_count: number;
}

export function BundleManagement() {
  const [subs, setSubs] = useState<BundleSub[]>([]);
  const [catalog, setCatalog] = useState<CatalogApi[]>([]);
  const [errors, setErrors] = useState<BundleError[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async () => {
    setRefreshing(true);
    try {
      const [subsRes, catalogRes, errorsRes] = await Promise.all([
        supabase
          .from('bundle_subscriptions')
          .select('id, user_id, selected_apis, api_count, monthly_price_cents, status, created_at, stripe_subscription_id')
          .order('created_at', { ascending: false }),
        supabase
          .from('bundle_api_catalog')
          .select('id, api_name, seo_segment')
          .eq('is_active', true),
        supabase
          .from('analytics_events')
          .select('id, user_id, event_type, event_data, created_at')
          .like('event_type', '%bundle%error%')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (subsRes.data) setSubs(subsRes.data as unknown as BundleSub[]);
      if (catalogRes.data) setCatalog(catalogRes.data as unknown as CatalogApi[]);
      if (errorsRes.data) setErrors(errorsRes.data as unknown as BundleError[]);
    } catch (err) {
      console.error('BundleManagement fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const activeSubs = subs.filter(s => s.status === 'active');
  const totalActiveApis = activeSubs.reduce((sum, s) => sum + (s.api_count || s.selected_apis?.length || 0), 0);
  const totalRevenueCents = activeSubs.reduce((sum, s) => sum + (s.monthly_price_cents || 0), 0);
  const totalRevenueEur = totalRevenueCents / 100;

  // Estimated cost: ~0€ for now (APIs are pass-through, no hosting cost per API)
  const estimatedCostEur = 0;
  const marginEur = totalRevenueEur - estimatedCostEur;

  const apiNameMap = new Map(catalog.map(c => [c.id, c.api_name]));

  // API popularity
  const apiPopularity: Record<string, number> = {};
  activeSubs.forEach(s => {
    (s.selected_apis || []).forEach(apiId => {
      apiPopularity[apiId] = (apiPopularity[apiId] || 0) + 1;
    });
  });
  const popularApis = Object.entries(apiPopularity)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bundle Option</h2>
          <p className="text-xs text-muted-foreground">Suivi des abonnements API tierces</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">APIs activées</CardTitle>
            <Package className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold">{totalActiveApis}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{activeSubs.length} abonnement{activeSubs.length > 1 ? 's' : ''} actif{activeSubs.length > 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">CA Bundle</CardTitle>
            <Coins className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalRevenueEur.toLocaleString('fr-FR')} €</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">MRR bundle mensuel</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30">
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Coûts estimés</CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{estimatedCostEur.toLocaleString('fr-FR')} €</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Marge: {marginEur.toLocaleString('fr-FR')} €</p>
          </CardContent>
        </Card>

        <Card className={errors.length > 0 ? 'border-rose-500/30' : 'border-border'}>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Erreurs</CardTitle>
            <AlertTriangle className={`h-3.5 w-3.5 ${errors.length > 0 ? 'text-rose-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className={`text-lg font-bold ${errors.length > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>{errors.length}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Dernières 50 erreurs bundle</p>
          </CardContent>
        </Card>
      </div>

      {/* Popular APIs */}
      {popularApis.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              APIs les plus populaires
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {popularApis.map(([apiId, count]) => {
              const maxCount = popularApis[0][1] as number;
              const pct = (count / maxCount) * 100;
              return (
                <div key={apiId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{apiNameMap.get(apiId) || apiId.slice(0, 8)}</span>
                    <span className="text-[11px] text-muted-foreground">{count} abonné{count > 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active Subscriptions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Abonnements actifs
          </CardTitle>
          <CardDescription>Liste des utilisateurs avec un bundle actif</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSubs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun abonnement bundle actif</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User ID</TableHead>
                  <TableHead className="text-xs">APIs</TableHead>
                  <TableHead className="text-xs">Prix/mois</TableHead>
                  <TableHead className="text-xs">Stripe</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSubs.map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell className="text-xs font-mono">{sub.user_id.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(sub.selected_apis || []).slice(0, 3).map(apiId => (
                          <Badge key={apiId} variant="outline" className="text-[9px]">
                            {apiNameMap.get(apiId) || apiId.slice(0, 6)}
                          </Badge>
                        ))}
                        {(sub.selected_apis?.length || 0) > 3 && (
                          <Badge variant="secondary" className="text-[9px]">+{sub.selected_apis.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{(sub.monthly_price_cents / 100).toFixed(0)} €</TableCell>
                    <TableCell>
                      {sub.stripe_subscription_id ? (
                        <Badge variant="default" className="text-[9px]">Stripe</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px]">Manuel</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(sub.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Error Registry */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Registre d'erreurs Bundle
          </CardTitle>
          <CardDescription>Erreurs liées aux opérations bundle (50 dernières)</CardDescription>
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune erreur enregistrée ✅</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map(err => (
                  <TableRow key={err.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(err.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-[9px]">{err.event_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{err.user_id?.slice(0, 8) || '—'}…</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {err.event_data ? JSON.stringify(err.event_data).slice(0, 80) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
