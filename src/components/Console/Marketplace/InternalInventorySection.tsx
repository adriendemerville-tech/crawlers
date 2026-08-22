import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMarketplaceMatches } from '@/lib/marketplace/marketplace.functions';

const ATTRIBUTE_LABEL: Record<string, string> = {
  dofollow: 'Lien suivi',
  sponsored: 'Lien sponsorisé',
  nofollow: 'Lien non suivi',
};

/**
 * L2.9 — Inventaire interne de la Place d'échange affiché dans l'onglet
 * Netlinking, à la place des catalogues externes vides. Le prix et l'attribut
 * viennent du serveur ; rien n'est recalculé ici.
 */
export function InternalInventorySection({ onOpenMarketplace }: { onOpenMarketplace?: () => void }) {
  const fetchMatches = useServerFn(getMarketplaceMatches);
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'matches'],
    queryFn: () => fetchMatches(),
  });

  const matches = (data?.matches ?? []).slice(0, 5);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Inventaire interne — Place d'échange</h2>
          <p className="text-xs text-muted-foreground">
            Emplacements proposés par d'autres sites suivis par Crawlers, appariés à vos besoins
            détectés. Prix et attribut de lien calculés côté serveur.
          </p>
        </div>
        {onOpenMarketplace && (
          <Button variant="outline" size="sm" onClick={onOpenMarketplace}>
            Ouvrir la Place d'échange
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun emplacement interne compatible pour l'instant. Confirmez un objectif dans la Place
          d'échange pour lancer l'appariement.
        </p>
      ) : (
        <div className="space-y-2">
          {matches.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{m.seller_url}</span>
              <Badge variant="outline">
                {ATTRIBUTE_LABEL[m.projected_attribute] ?? m.projected_attribute}
              </Badge>
              <span className="text-xs text-muted-foreground">
                compatibilité {(m.compat_score * 100).toFixed(0)} %
              </span>
              <span className="tabular-nums">{(m.price_cents / 100).toFixed(0)} €</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
