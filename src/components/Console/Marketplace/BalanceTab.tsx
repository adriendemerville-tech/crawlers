import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Loader2, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getMarketplaceBalances,
  getMarketplaceBuyQueue,
  refreshMarketplaceBuyQueue,
} from '@/lib/marketplace/marketplace.functions';

interface BalanceRow {
  site_domain: string;
  authority_balance_cents: number;
  visibility_balance_cents: number;
  authority_given_cents: number;
  authority_received_cents: number;
  legs_count: number;
  can_sell_link: boolean;
  buyer_priority_score: number;
  computed_at: string | null;
}

interface QueueRow {
  site_domain: string;
  need_id: string;
  need_score: number;
  deficit_cede_cents: number;
  priority_score: number;
  unserved_since: string | null;
}

const eur = (cents: number) => `${cents < 0 ? '−' : ''}${Math.abs(cents / 100).toFixed(0)} €`;

/**
 * Bloc « Ma balance » (L5.8) — produit de rétention.
 * Tout est déterministe et déjà calculé côté serveur : la valeur d'un échange
 * s'amortit linéairement, un site trop déficitaire en autorité ne peut plus
 * céder de lien, et la file d'achat classe les besoins par déficit constaté.
 */
export function BalanceTab() {
  const queryClient = useQueryClient();
  const fetchBalances = useServerFn(getMarketplaceBalances);
  const fetchQueue = useServerFn(getMarketplaceBuyQueue);
  const refresh = useServerFn(refreshMarketplaceBuyQueue);

  const balances = useQuery({
    queryKey: ['marketplace', 'balances'],
    queryFn: () => fetchBalances() as Promise<BalanceRow[]>,
  });

  const queue = useQuery({
    queryKey: ['marketplace', 'buy-queue'],
    queryFn: () => fetchQueue() as Promise<QueueRow[]>,
  });

  const rebuild = useMutation({
    mutationFn: async () => refresh(),
    onSuccess: () => {
      toast.success("File d'achat recalculée");
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'buy-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'balances'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (balances.isLoading || queue.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const rows = balances.data ?? [];
  const queueRows = queue.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            Ma balance d'autorité
          </CardTitle>
          <Button variant="outline" size="sm" disabled={rebuild.isPending} onClick={() => rebuild.mutate()}>
            Recalculer
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Chaque jambe livrée est enregistrée : céder un lien débite votre balance, en recevoir la
            crédite. La valeur s'amortit linéairement sur 24 mois — un échange ancien ne pèse plus
            dans la priorité d'aujourd'hui. Une balance trop déficitaire suspend la vente de liens
            jusqu'à reconstitution.
          </p>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune balance pour l'instant : elle s'ouvre à la première jambe livrée (vente, achat ou
              troc).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Domaine</th>
                    <th className="py-2 pr-3 font-medium">Balance autorité</th>
                    <th className="py-2 pr-3 font-medium">Cédé / reçu</th>
                    <th className="py-2 pr-3 font-medium">Balance visibilité</th>
                    <th className="py-2 pr-3 font-medium">Jambes</th>
                    <th className="py-2 font-medium">Vente de liens</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.site_domain} className="border-b border-border/50">
                      <td className="py-3 pr-3 font-medium">{row.site_domain}</td>
                      <td className="py-3 pr-3 tabular-nums">
                        {eur(row.authority_balance_cents)}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          amorti sur 24 mois
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs tabular-nums text-muted-foreground">
                        {eur(row.authority_given_cents)} cédé · {eur(row.authority_received_cents)} reçu
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{eur(row.visibility_balance_cents)}</td>
                      <td className="py-3 pr-3 tabular-nums">{row.legs_count}</td>
                      <td className="py-3">
                        {row.can_sell_link ? (
                          <Badge variant="outline">Autorisée</Badge>
                        ) : (
                          <span className="text-xs text-destructive">
                            Suspendue — déficit d'autorité trop élevé
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ma file d'achat</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Priorité = 50 % déficit d'autorité amorti, 35 % gravité du besoin diagnostiqué, 15 %
            ancienneté du besoin non servi. Un besoin ne réserve qu'un emplacement à la fois.
          </p>
          {queueRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun besoin en file. Confirmez un besoin dans l'onglet « Acheter » pour l'y placer.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Domaine</th>
                    <th className="py-2 pr-3 font-medium">Priorité</th>
                    <th className="py-2 pr-3 font-medium">Déficit</th>
                    <th className="py-2 pr-3 font-medium">Gravité du besoin</th>
                    <th className="py-2 font-medium">Non servi depuis</th>
                  </tr>
                </thead>
                <tbody>
                  {queueRows.map((row) => (
                    <tr key={row.need_id} className="border-b border-border/50">
                      <td className="py-3 pr-3 font-medium">{row.site_domain}</td>
                      <td className="py-3 pr-3 tabular-nums">{row.priority_score}/100</td>
                      <td className="py-3 pr-3 tabular-nums">{eur(row.deficit_cede_cents)}</td>
                      <td className="py-3 pr-3 tabular-nums">{Math.round(row.need_score)}/100</td>
                      <td className="py-3 text-xs text-muted-foreground">
                        {row.unserved_since ? row.unserved_since.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
