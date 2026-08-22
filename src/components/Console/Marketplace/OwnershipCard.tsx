import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  acceptOwnershipClaim,
  getOwnershipToken,
  verifyMarketplaceOwnership,
} from '@/lib/marketplace/marketplace.functions';

const CLAIM_TEXT =
  "Je déclare être propriétaire du domaine ci-dessus, ou disposer d'un mandat écrit du propriétaire m'autorisant à céder un emplacement de lien sur ce domaine. Je reconnais que toute fausse déclaration engage ma responsabilité et entraîne la fermeture de mon accès à la Place d'échange.";

export function OwnershipCard() {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState('');
  const [claimAccepted, setClaimAccepted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const fetchToken = useServerFn(getOwnershipToken);
  const acceptClaim = useServerFn(acceptOwnershipClaim);
  const verify = useServerFn(verifyMarketplaceOwnership);

  const tokenMutation = useMutation({
    mutationFn: async () => fetchToken({ data: { domain } }),
    onSuccess: (res) => setToken(res.token),
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async (method: 'dns_txt' | 'gsc') => {
      if (claimAccepted) {
        await acceptClaim({ data: { domain, claimText: CLAIM_TEXT } });
      }
      return verify({ data: { domain, method } });
    },
    onSuccess: (res) => {
      if (res.status === 'verified') toast.success('Propriété vérifiée');
      else toast.error(res.message);
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'inventory'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canVerify = domain.trim().length > 3 && claimAccepted;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vérification de propriété</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Aucun emplacement ne peut être mis en vente avant vérification. Deux méthodes : un
          enregistrement TXT dans la zone DNS, ou une propriété Search Console déjà connectée à ce
          compte.
        </p>

        <div className="space-y-2">
          <Label htmlFor="mp-domain">Domaine</Label>
          <Input
            id="mp-domain"
            placeholder="exemple.fr"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <Checkbox
            id="mp-claim"
            checked={claimAccepted}
            onCheckedChange={(v) => setClaimAccepted(v === true)}
          />
          <Label htmlFor="mp-claim" className="text-xs font-normal leading-relaxed">
            {CLAIM_TEXT}
          </Label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={domain.trim().length < 4 || tokenMutation.isPending}
            onClick={() => tokenMutation.mutate()}
          >
            Obtenir mon jeton DNS
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canVerify || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate('dns_txt')}
          >
            Vérifier par DNS
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canVerify || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate('gsc')}
          >
            Vérifier par Search Console
          </Button>
        </div>

        {token && (
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="mb-1 text-muted-foreground">Enregistrement TXT à publier à la racine :</p>
            <code className="break-all font-mono text-xs">crawlers-marketplace={token}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
