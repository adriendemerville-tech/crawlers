import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMarketplaceMatches } from '@/lib/marketplace/marketplace.functions';
import { ObjectiveConfirmCard } from './ObjectiveConfirmCard';
import type { MatchRow } from '@/lib/marketplace/matchTypes';

const ATTRIBUTE_LABEL: Record<string, string> = {
  dofollow: 'Lien suivi',
  sponsored: 'Lien sponsorisé',
  nofollow: 'Lien non suivi',
};

function euros(cents: number): string {
  return `${(cents / 100).toFixed(0)} €`;
}

/**
 * Parcours d'achat en 4 temps (L2.7) : besoins détectés → étape bloquante
 * « Mon objectif » → emplacements filtrés par l'attribut réellement obtenable
 * → panier. Le panier reste local jusqu'au lot commande (L3).
 */
export function BuyTab() {
  const fetchMatches = useServerFn(getMarketplaceMatches);
  const [cart, setCart] = useState<MatchRow[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace', 'matches'],
    queryFn: () => fetchMatches(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const needs = data?.needs ?? [];
  const limits = data?.limits;
  const matches = data?.matches ?? [];
  const unconfirmed = needs.filter((n) => n.need_objective_confirmed_at === null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Garde-fous d'achat</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          {limits ? (
            <>
              <span>
                Liens acquis : {limits.links_7d}/{limits.links_7d_max} sur 7 jours ·{' '}
                {limits.links_30d}/{limits.links_30d_max} sur 30 jours
              </span>
              <span>
                Ancres exactes : {(limits.exact_anchor_ratio * 100).toFixed(0)} % (plafond{' '}
                {(limits.exact_anchor_max_ratio * 100).toFixed(0)} %)
              </span>
              <span>
                Cohérence thématique : {limits.topical_coherence.toFixed(2)} (minimum{' '}
                {limits.topical_coherence_min})
              </span>
              <span>Risque d'achat : {limits.buy_risk.toFixed(2)}</span>
              {limits.throttle_reason && (
                <span className="text-destructive sm:col-span-2">
                  {limits.throttle_reason}
                  {limits.next_allowed_at
                    ? ` · reprise possible le ${new Date(limits.next_allowed_at).toLocaleDateString('fr-FR')}`
                    : ''}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Aucun historique d'achat.</span>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Besoins détectés ({needs.length})
        </h3>
        {needs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun besoin dérivé pour l'instant. Les besoins proviennent des constats d'audit et du
            plan de travail, sans intervention d'un modèle de langage.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {needs.map((need) => (
              <ObjectiveConfirmCard key={need.id} need={need} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Emplacements compatibles ({matches.length})
        </h3>
        {unconfirmed.length > 0 && matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Confirmez d'abord un objectif : les emplacements affichés dépendent de l'attribut de lien
            réellement obtenable.
          </p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun emplacement compatible pour le moment. Le réseau s'étoffe progressivement.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => {
              const inCart = cart.some((c) => c.id === m.id);
              return (
                <Card key={m.id}>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.seller_url}</p>
                        <p className="text-xs text-muted-foreground">
                          Cible : {m.need_target_url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {ATTRIBUTE_LABEL[m.projected_attribute] ?? m.projected_attribute}
                        </Badge>
                        <Badge variant="outline">{m.price_tier ?? '—'}</Badge>
                        <span className="text-sm tabular-nums">{euros(m.price_cents)}</span>
                      </div>
                    </div>

                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      {m.factors.map((f) => (
                        <span key={f.key}>
                          {f.label} : {(f.value * 100).toFixed(0)} % · {f.detail}
                        </span>
                      ))}
                    </div>

                    {m.attribute_reasons.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Attribut : {m.attribute_reasons.join(' ; ')}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        Compatibilité {(m.compat_score * 100).toFixed(0)} % · proposition valable
                        jusqu'au {new Date(m.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={limits ? !limits.purchase_allowed : false}
                        onClick={() =>
                          setCart((prev) =>
                            inCart ? prev.filter((c) => c.id !== m.id) : [...prev, m],
                          )
                        }
                      >
                        {inCart ? 'Retirer du panier' : 'Ajouter au panier'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {cart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Panier ({cart.length}) ·{' '}
              {euros(cart.reduce((s, c) => s + c.price_cents, 0))}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{c.seller_url}</span>
                <span className="tabular-nums">{euros(c.price_cents)}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              La commande, le séquestre et le Studio de création arrivent au lot suivant.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
