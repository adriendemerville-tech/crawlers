import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getMarketplaceOrders,
  acceptMarketplaceOrder,
  cancelMarketplaceOrder,
  declareMarketplacePublication,
} from '@/lib/marketplace/marketplace.functions';
import { DEAL_TYPE_LABEL, ORDER_STATUS_LABEL, type OrderRow } from '@/lib/marketplace/orderTypes';

const eur = (cents: number) => `${(cents / 100).toFixed(0)} €`;

const ATTRIBUTE_LABEL: Record<string, string> = {
  dofollow: 'Lien transmettant l’autorité',
  sponsored: 'Lien sponsorisé',
  nofollow: 'Lien non suivi',
};

export function OrdersTab() {
  const fetchOrders = useServerFn(getMarketplaceOrders);
  const accept = useServerFn(acceptMarketplaceOrder);
  const cancel = useServerFn(cancelMarketplaceOrder);
  const declare = useServerFn(declareMarketplacePublication);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders((await fetchOrders()) as OrderRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Commandes indisponibles');
    } finally {
      setLoading(false);
    }
  }, [fetchOrders]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action refusée');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="py-8 text-sm text-muted-foreground">Chargement des commandes…</p>;
  }

  if (orders.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        Aucune commande. Une commande est créée depuis l'onglet « Acheter », après confirmation de
        votre objectif : les conditions (prix, type de lien, durée d'engagement) sont alors gelées.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <Card key={o.id} className="border-border">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-medium">
                {o.role === 'buyer' ? 'Achat sur' : 'Vente à'} {o.counterpart_domain}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ORDER_STATUS_LABEL[o.status]}</Badge>
                <Badge variant="outline">{DEAL_TYPE_LABEL[o.deal_type]}</Badge>
                <Badge variant="outline">{ATTRIBUTE_LABEL[o.link_attribute] ?? o.link_attribute}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Page cible</dt>
                <dd className="break-all">{o.target_url}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ancre</dt>
                <dd>{o.anchor ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valeur / commission</dt>
                <dd>
                  {eur(o.price_cents)} · commission {eur(o.commission_cents)}
                  {o.soulte_cents > 0 ? ` · soulte ${eur(o.soulte_cents)}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Engagement de maintien</dt>
                <dd>
                  {o.commitment_months} mois
                  {o.commitment_ends_at
                    ? ` — jusqu'au ${new Date(o.commitment_ends_at).toLocaleDateString('fr-FR')}`
                    : ''}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              {o.role === 'seller' && o.status === 'frozen' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === o.id}
                  onClick={() => run(o.id, () => accept({ data: { orderId: o.id } }), 'Commande acceptée')}
                >
                  Accepter la commande
                </Button>
              )}
              {o.role === 'seller' && o.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === o.id}
                  onClick={() =>
                    run(o.id, () => declare({ data: { orderId: o.id } }), 'Publication déclarée')
                  }
                >
                  Déclarer la publication
                </Button>
              )}
              {['draft', 'frozen', 'pending'].includes(o.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy === o.id}
                  onClick={() =>
                    run(
                      o.id,
                      () => cancel({ data: { orderId: o.id, reason: 'annulation avant publication' } }),
                      'Commande annulée',
                    )
                  }
                >
                  Annuler
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default OrdersTab;
