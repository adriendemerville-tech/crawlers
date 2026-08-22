import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getMarketplaceInventory,
  setMarketplaceOptIn,
} from '@/lib/marketplace/marketplace.functions';
import type { SellRiskClass } from '@/lib/marketplace/types';

const RISK_LABEL: Record<SellRiskClass, string> = {
  safe: 'Risque faible',
  moderate: 'Risque modéré',
  discouraged: 'Déconseillé',
};

function euros(cents: number | null): string {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(0)} €`;
}

export function InventoryTable() {
  const queryClient = useQueryClient();
  const fetchInventory = useServerFn(getMarketplaceInventory);
  const toggleOptIn = useServerFn(setMarketplaceOptIn);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'inventory'],
    queryFn: () => fetchInventory(),
  });

  const mutate = useMutation({
    mutationFn: async (vars: { assetId: string; optIn: boolean }) =>
      toggleOptIn({ data: vars }),
    onSuccess: (_res, vars) => {
      toast.success(vars.optIn ? 'Emplacement mis en vente' : 'Emplacement retiré de la vente');
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'inventory'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mes emplacements</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucun emplacement éligible pour l'instant. Les pages apparaissent après un crawl et le
            calcul du coût d'autorité.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Page</th>
                  <th className="py-2 pr-3 font-medium">Palier</th>
                  <th className="py-2 pr-3 font-medium">Prix</th>
                  <th className="py-2 pr-3 font-medium">Coût d'autorité</th>
                  <th className="py-2 pr-3 font-medium">Plafonds</th>
                  <th className="py-2 pr-3 font-medium">Revenus</th>
                  <th className="py-2 font-medium">Vente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 align-top">
                    <td className="max-w-[280px] py-3 pr-3">
                      <span className="block truncate font-medium">{row.url}</span>
                      <span className="text-xs text-muted-foreground">{row.domain}</span>
                      {row.ownership_status !== 'verified' && (
                        <span className="mt-1 block text-xs text-destructive">
                          Propriété non vérifiée
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">{row.price_tier ?? '—'}</td>
                    <td className="py-3 pr-3 tabular-nums">{euros(row.price_cents)}</td>
                    <td className="py-3 pr-3">
                      {row.risk_class ? (
                        <Badge variant="outline">{RISK_LABEL[row.risk_class]}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">non calculé</span>
                      )}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {row.risk_reason}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      <span className="block">
                        dofollow : {row.caps.dofollow_page_lifetime_used}/
                        {row.caps.dofollow_page_lifetime_max} à vie
                      </span>
                      <span className="block">
                        insertions : {row.caps.insertions_page_12m_used}/
                        {row.caps.insertions_page_12m_max} sur 12 mois
                      </span>
                      {row.caps.blocking_reason && (
                        <span className="block text-destructive">{row.caps.blocking_reason}</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">{euros(row.revenue_cents)}</td>
                    <td className="py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={mutate.isPending}
                        onClick={() => mutate.mutate({ assetId: row.id, optIn: !row.opted_in })}
                      >
                        {row.opted_in ? 'Retirer' : 'Mettre en vente'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
