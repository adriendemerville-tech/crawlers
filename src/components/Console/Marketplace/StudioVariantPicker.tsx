import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeHtmlDeterministic } from '@/lib/security/sanitizeHtml';
import {
  getMarketplaceStudio,
  generateMarketplaceVariants,
  approveMarketplaceVariant,
  selectMarketplaceVariant,
} from '@/lib/marketplace/marketplace.functions';
import { VARIANT_INTENT, VARIANT_LABEL, type StudioState } from '@/lib/marketplace/studioTypes';

/**
 * Studio (L3.11) : le vendeur approuve les variantes qui peuvent paraître sur
 * sa page, l'acheteur choisit la version finale parmi celles approuvées.
 */
export function StudioVariantPicker({ orderId, role }: { orderId: string; role: 'buyer' | 'seller' }) {
  const fetchStudio = useServerFn(getMarketplaceStudio);
  const generate = useServerFn(generateMarketplaceVariants);
  const approve = useServerFn(approveMarketplaceVariant);
  const select = useServerFn(selectMarketplaceVariant);

  const [state, setState] = useState<StudioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState((await fetchStudio({ data: { orderId } })) as StudioState);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Studio indisponible');
    } finally {
      setLoading(false);
    }
  }, [fetchStudio, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action refusée');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="py-4 text-sm text-muted-foreground">Chargement du Studio…</p>;
  }

  const variants = state?.variants ?? [];
  const latestRound = variants.length > 0 ? Math.max(...variants.map((v) => v.round_index)) : 0;
  const current = variants.filter((v) => v.round_index === latestRound);

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-medium">Studio de création</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{state?.rounds_remaining ?? 0} tour(s) restant(s)</Badge>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || (state?.rounds_remaining ?? 0) === 0}
              onClick={() => run(() => generate({ data: { orderId } }), 'Variantes générées')}
            >
              {variants.length === 0 ? 'Générer les variantes' : 'Nouvelle passe'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {state?.action_variant_reason && (
          <p className="text-muted-foreground">{state.action_variant_reason}</p>
        )}

        {current.length === 0 ? (
          <p className="text-muted-foreground">
            Aucune variante. Le brief est figé sur les conditions de la commande : une seule passe par
            variante, coût borné.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {current.map((v) => (
              <div key={v.id} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{VARIANT_LABEL[v.variant]}</p>
                  {v.buyer_selected_at ? (
                    <Badge variant="outline">Retenue</Badge>
                  ) : v.seller_approved_at ? (
                    <Badge variant="outline">Approuvée</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{VARIANT_INTENT[v.variant]}</p>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlDeterministic(v.output) }}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {role === 'seller' && !v.seller_approved_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(() => approve({ data: { variantId: v.id } }), 'Variante approuvée')}
                    >
                      Approuver
                    </Button>
                  )}
                  {role === 'buyer' && v.seller_approved_at && !v.buyer_selected_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(() => select({ data: { variantId: v.id } }), 'Version retenue')}
                    >
                      Retenir cette version
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StudioVariantPicker;
