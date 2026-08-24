import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Loader2, Instagram, Linkedin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  getMarketplaceSocialAssets,
  syncMarketplaceSocialAsset,
  setMarketplaceSocialOptIn,
  revokeMarketplaceSocialAsset,
} from '@/lib/marketplace/marketplace.functions';
import type { SocialFormat } from '@/lib/marketplace/socialPricing';
import { CollabBriefPreview } from './CollabBriefPreview';

interface AssetRow {
  id: string;
  platform: 'instagram' | 'linkedin';
  account_id: string;
  account_name: string | null;
  formats: SocialFormat[];
  followers: number | null;
  reach_avg: number | null;
  engagement_rate: number | null;
  opted_in: boolean;
  ownership_status: 'verified' | 'unverified' | 'revoked';
  vendable: boolean;
  unvendable_reason: string | null;
  price_cents: number | null;
  price_tier: string | null;
  prices_by_format: Record<string, { price_cents: number | null; tier: string | null; reason: string | null }>;
  fraud_flags: string[];
  last_synced_at: string | null;
}

interface AccountRow {
  id: string;
  platform: 'instagram' | 'linkedin';
  account_id: string | null;
  account_name: string | null;
}

const eur = (cents: number | null) => (cents === null ? '—' : `${(cents / 100).toFixed(0)} €`);

const FORMAT_LABEL: Record<string, string> = {
  feed: 'Post feed',
  reel: 'Reel',
  story: 'Story',
  linkedin_post: 'Post LinkedIn',
};

/**
 * Onglet Collab (L6) — mise en collaboration d'un compte Instagram ou LinkedIn.
 * Le prix est calculé côté serveur par le même barème borné que les liens
 * (40–350 €, paliers de 10 €) : aucune valeur n'est saisie par le vendeur.
 */
export function CollabTab() {
  const queryClient = useQueryClient();
  const fetchAssets = useServerFn(getMarketplaceSocialAssets);
  const sync = useServerFn(syncMarketplaceSocialAsset);
  const setOptIn = useServerFn(setMarketplaceSocialOptIn);
  const revoke = useServerFn(revokeMarketplaceSocialAsset);
  const [preview, setPreview] = useState<AssetRow | null>(null);

  const data = useQuery({
    queryKey: ['marketplace', 'social-assets'],
    queryFn: () => fetchAssets() as Promise<{ assets: AssetRow[]; accounts: AccountRow[] }>,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['marketplace', 'social-assets'] });

  const syncMutation = useMutation({
    mutationFn: async (vars: { socialAccountId: string; formats: SocialFormat[] }) =>
      sync({ data: vars }),
    onSuccess: () => {
      toast.success('Métriques relevées et prix recalculés');
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const optInMutation = useMutation({
    mutationFn: async (vars: { assetId: string; optIn: boolean }) => setOptIn({ data: vars }),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async (assetId: string) => revoke({ data: { assetId } }) as Promise<{ message: string }>,
    onSuccess: (res) => {
      toast.success(res.message);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const assets = data.data?.assets ?? [];
  const accounts = data.data?.accounts ?? [];
  const attachedAccountIds = new Set(assets.map((a) => a.account_id));
  const available = accounts.filter((a) => !a.account_id || !attachedAccountIds.has(a.account_id));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comptes en collaboration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Un compte Instagram Business ou Creator, ou une page LinkedIn, devient un actif de la
            place d'échange. Le prix suit la portée moyenne, l'engagement réel, l'affinité d'audience
            et la qualité créative, borné entre 40 € et 350 € comme un lien. Sous 40 €, l'actif reste
            non vendable plutôt que vendu hors grille.
          </p>

          {available.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Comptes connectés non encore rattachés</p>
              {available.map((account) => (
                <div key={account.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm">
                    {account.platform === 'linkedin' ? (
                      <Linkedin className="h-4 w-4 text-primary" />
                    ) : (
                      <Instagram className="h-4 w-4 text-primary" />
                    )}
                    {account.account_name ?? account.account_id ?? 'Compte sans nom'}
                  </span>
                  <div className="flex gap-2">
                    {(account.platform === 'linkedin'
                      ? (['linkedin_post'] as SocialFormat[])
                      : (['feed', 'reel', 'story'] as SocialFormat[])
                    ).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={syncMutation.isPending}
                        onClick={() =>
                          syncMutation.mutate({
                            socialAccountId: account.id,
                            formats:
                              account.platform === 'linkedin'
                                ? (['linkedin_post'] as SocialFormat[])
                                : (['feed', 'reel', 'story'] as SocialFormat[]),
                          })
                        }
                      >
                        Rattacher et tarifer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {assets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun compte rattaché. Connectez un compte Instagram Business ou LinkedIn depuis le hub
              social, puis rattachez-le ici.
            </p>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <div key={asset.id} className="space-y-3 rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {asset.platform === 'linkedin' ? (
                          <Linkedin className="h-4 w-4 text-primary" />
                        ) : (
                          <Instagram className="h-4 w-4 text-primary" />
                        )}
                        {asset.account_name ?? asset.account_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {asset.followers ?? 0} abonnés · portée moyenne {asset.reach_avg ?? 0} ·
                        engagement{' '}
                        {asset.engagement_rate !== null ? `${(asset.engagement_rate * 100).toFixed(1)} %` : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {asset.vendable ? `${eur(asset.price_cents)} · ${asset.price_tier}` : 'non vendable'}
                      </Badge>
                      <Badge variant="outline">
                        {asset.ownership_status === 'verified' ? 'compte vérifié' : asset.ownership_status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {Object.entries(asset.prices_by_format ?? {}).map(([format, p]) => (
                      <span key={format} className="rounded border border-border px-2 py-1">
                        {FORMAT_LABEL[format] ?? format} : {p.price_cents !== null ? eur(p.price_cents) : (p.reason ?? '—')}
                      </span>
                    ))}
                  </div>

                  {asset.fraud_flags.length > 0 && (
                    <ul className="list-inside list-disc text-xs text-muted-foreground">
                      {asset.fraud_flags.map((flag) => (
                        <li key={flag}>{flag}</li>
                      ))}
                    </ul>
                  )}

                  {!asset.vendable && asset.unvendable_reason && (
                    <p className="text-xs text-muted-foreground">{asset.unvendable_reason}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={asset.opted_in}
                        disabled={!asset.vendable || optInMutation.isPending}
                        onCheckedChange={(checked) =>
                          optInMutation.mutate({ assetId: asset.id, optIn: checked })
                        }
                      />
                      Proposer ce compte aux acheteurs
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreview(preview?.id === asset.id ? null : asset)}
                      >
                        {preview?.id === asset.id ? 'Masquer le brief' : 'Voir un brief type'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={syncMutation.isPending}
                        onClick={() =>
                          syncMutation.mutate({
                            socialAccountId: asset.id,
                            formats: asset.formats,
                          })
                        }
                      >
                        Recalculer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(asset.id)}
                      >
                        Retirer et révoquer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <CollabBriefPreview
          brief={{
            format: (preview.formats?.[0] ?? 'feed') as SocialFormat,
            accountName: preview.account_name ?? preview.account_id,
            hook: 'Une accroche de 1 à 2 phrases, écrite par l\u2019acheteur et validée par vous.',
            caption:
              'Corps de légende décrivant l\u2019usage réel du produit ou du service, sans promesse chiffrée non vérifiable.\n\n#pub',
            linkLabel: 'Lien en bio',
            linkUrl: 'https://exemple.fr/page-cible',
          }}
          roundsRemaining={3}
        />
      )}
    </div>
  );
}

export default CollabTab;
