import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getMarketplaceIncomingMatches } from '@/lib/marketplace/marketplace.functions';

const ATTRIBUTE_LABEL: Record<string, string> = {
  dofollow: 'Lien suivi',
  sponsored: 'Lien sponsorisé',
  nofollow: 'Lien non suivi',
};

/**
 * Appariements entrants sur mes emplacements (L2.6), triés par compatibilité.
 * L'identité de la page cible acheteur reste masquée avant commande : seul le
 * domaine est annoncé.
 */
export function OpportunitiesTab() {
  const fetchIncoming = useServerFn(getMarketplaceIncomingMatches);
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'incoming'],
    queryFn: () => fetchIncoming(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Aucune demande entrante pour l'instant. Vos emplacements mis en vente apparaissent auprès des
        acheteurs dont le besoin correspond réellement.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((m) => (
        <Card key={m.id}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium">Demande depuis {m.need_target_url}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {ATTRIBUTE_LABEL[m.projected_attribute] ?? m.projected_attribute}
                </Badge>
                <Badge variant="outline">{m.price_tier ?? '—'}</Badge>
                <span className="text-sm tabular-nums">{(m.price_cents / 100).toFixed(0)} €</span>
              </div>
            </div>

            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              {m.factors.map((f) => (
                <span key={f.key}>
                  {f.label} : {(f.value * 100).toFixed(0)} % · {f.detail}
                </span>
              ))}
            </div>

            <span className="block text-xs text-muted-foreground">
              Compatibilité {(m.compat_score * 100).toFixed(0)} % · valable jusqu'au{' '}
              {new Date(m.expires_at).toLocaleDateString('fr-FR')}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
