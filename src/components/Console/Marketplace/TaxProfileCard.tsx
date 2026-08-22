import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getMarketplaceTaxProfile,
  saveMarketplaceTaxProfile,
} from '@/lib/marketplace/marketplace.functions';
import type { TaxStatus } from '@/lib/marketplace/types';

const STATUS_LABELS: Record<TaxStatus, string> = {
  company_vat: 'Société assujettie à la TVA',
  company_no_vat: 'Société non assujettie',
  micro: 'Micro-entreprise',
  individual: 'Particulier',
  association: 'Association',
};

export function TaxProfileCard() {
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMarketplaceTaxProfile);
  const persist = useServerFn(saveMarketplaceTaxProfile);

  const { data } = useQuery({
    queryKey: ['marketplace', 'tax-profile'],
    queryFn: () => fetchProfile(),
  });

  const [status, setStatus] = useState<TaxStatus>('company_vat');
  const [legalName, setLegalName] = useState('');
  const [address, setAddress] = useState('');
  const [siren, setSiren] = useState('');
  const [vat, setVat] = useState('');
  const [mandate, setMandate] = useState(false);

  useEffect(() => {
    if (!data) return;
    setStatus((data.tax_status ?? 'company_vat') as TaxStatus);
    setLegalName(data.legal_name ?? '');
    setAddress(data.address ?? '');
    setSiren(data.siren_siret ?? '');
    setVat(data.vat_number ?? '');
    setMandate(Boolean(data.self_billing_mandate_accepted_at));
  }, [data]);

  const save = useMutation({
    mutationFn: async () =>
      persist({
        data: {
          tax_status: status,
          legal_name: legalName,
          address: address || undefined,
          country_code: 'FR',
          siren_siret: siren || undefined,
          vat_number: vat || undefined,
          accept_self_billing: mandate,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.is_complete ? 'Profil fiscal complet' : 'Profil enregistré, encore incomplet');
      void queryClient.invalidateQueries({ queryKey: ['marketplace', 'tax-profile'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profil fiscal du vendeur</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Obligatoire avant toute mise en vente : Crawlers établit la facture au nom du vendeur, ce
          qui exige un mandat d'auto-facturation accepté.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TaxStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as TaxStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {STATUS_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mp-legal">Raison sociale</Label>
            <Input id="mp-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mp-siren">SIREN / SIRET</Label>
            <Input id="mp-siren" value={siren} onChange={(e) => setSiren(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mp-vat">Numéro de TVA</Label>
            <Input id="mp-vat" value={vat} onChange={(e) => setVat(e.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="mp-address">Adresse</Label>
            <Input id="mp-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border p-3">
          <Checkbox
            id="mp-mandate"
            checked={mandate}
            onCheckedChange={(v) => setMandate(v === true)}
          />
          <Label htmlFor="mp-mandate" className="text-xs font-normal leading-relaxed">
            J'autorise Crawlers à émettre en mon nom les factures correspondant aux ventes réalisées
            sur la Place d'échange (mandat d'auto-facturation).
          </Label>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {data?.is_complete ? 'Profil complet' : 'Profil incomplet : mise en vente bloquée'}
          </span>
          <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
