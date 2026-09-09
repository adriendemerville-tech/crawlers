/**
 * Délégation unique : l'utilisateur voit la liste complète des correctifs,
 * peut en retirer, puis autorise une seule fois. Aucune nouvelle demande
 * ensuite, y compris au déploiement.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  buildPasseFixPlan,
  getPasseFixes,
  grantPasseDelegation,
} from '@/lib/parmenion/passeFixes.functions';
import { NEVER_AUTOMATED } from '@/lib/parmenion/passeFixCatalog';

interface FixRow {
  id: string;
  family: string;
  fix_key: string;
  label: string;
  detail: string;
  page_url: string | null;
  channel: string;
  seo_impact: string;
  status: string;
}

interface Consent {
  granted_at: string;
  authorized_fix_ids: string[];
  declined_fix_ids: string[];
}

const btn =
  'gap-2 border border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background';

const IMPACT_LABEL: Record<string, string> = {
  high: 'Impact fort',
  medium: 'Impact moyen',
  low: 'Impact faible',
};

export function PasseDelegation({ orderId }: { orderId: string }) {
  const [fixes, setFixes] = useState<FixRow[]>([]);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = (await getPasseFixes({ data: { orderId } })) as {
      fixes: FixRow[];
      consent: Consent | null;
    };
    setFixes(res.fixes ?? []);
    setConsent(res.consent ?? null);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void (async () => {
      await buildPasseFixPlan({ data: { orderId } });
      await load();
    })();
  }, [orderId, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, FixRow[]>();
    for (const f of fixes) {
      const list = map.get(f.family) ?? [];
      list.push(f);
      map.set(f.family, list);
    }
    return [...map.entries()];
  }, [fixes]);

  const authorizedCount = fixes.length - excluded.size;

  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doGrant = async () => {
    setBusy(true);
    const ids = fixes.filter((f) => !excluded.has(f.id)).map((f) => f.id);
    const res = (await grantPasseDelegation({ data: { orderId, authorizedFixIds: ids } })) as {
      granted?: boolean;
      alreadyGranted?: boolean;
      error?: string;
    };
    setBusy(false);
    if (res.error) {
      toast.error("L'autorisation n'a pas pu être enregistrée.");
      return;
    }
    toast.success('Autorisation enregistrée. Elle ne vous sera plus demandée.');
    await load();
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Préparation de la liste des correctifs
      </p>
    );
  }

  if (fixes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun correctif à autoriser pour le moment : la liste apparaît après le diagnostic.
      </p>
    );
  }

  if (consent) {
    const deployed = fixes.filter((f) => f.status === 'deployed').length;
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2 text-primary">
          <Check className="h-4 w-4" />
          Autorisation donnée le {new Date(consent.granted_at).toLocaleDateString('fr-FR')} pour{' '}
          {consent.authorized_fix_ids.length} correctifs
        </p>
        <p className="text-muted-foreground">
          {deployed} appliqués · {consent.declined_fix_ids.length} écartés par vous. Nous ne vous
          redemanderons rien.
        </p>
        <ul className="space-y-1">
          {fixes
            .filter((f) => f.status !== 'declined')
            .map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 border-b border-border py-1">
                <span>{f.label}</span>
                <span className="text-xs text-muted-foreground">
                  {f.status === 'deployed'
                    ? 'appliqué'
                    : f.status === 'failed'
                      ? 'échec, repris automatiquement'
                      : f.status === 'not_applicable'
                        ? 'livré à copier'
                        : 'en attente'}
                </span>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Voici tout ce que nous appliquerons sur votre site et votre fiche. Décochez ce que vous ne
        voulez pas. Ensuite, une seule autorisation suffit : nous ne vous redemanderons rien.
      </p>

      <div className="space-y-5">
        {grouped.map(([family, list]) => (
          <div key={family}>
            <p className="mb-2 text-sm font-medium">{family}</p>
            <ul className="space-y-2">
              {list.map((f) => (
                <li key={f.id} className="flex items-start gap-3 rounded border border-border p-3">
                  <Checkbox
                    checked={!excluded.has(f.id)}
                    onCheckedChange={() => toggle(f.id)}
                    id={`fix-${f.id}`}
                    className="mt-0.5"
                  />
                  <label htmlFor={`fix-${f.id}`} className="flex-1 cursor-pointer text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {IMPACT_LABEL[f.seo_impact] ?? ''}
                    </span>
                    <span className="block text-xs text-muted-foreground">{f.detail}</span>
                    {f.page_url ? (
                      <span className="block truncate text-xs text-muted-foreground">{f.page_url}</span>
                    ) : null}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="rounded border border-border p-4 text-xs text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">Ce que nous ne ferons jamais sans vous</p>
        <ul className="list-disc space-y-1 pl-4">
          {NEVER_AUTOMATED.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <Button onClick={() => void doGrant()} disabled={busy || authorizedCount === 0} className={btn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          J'autorise ces {authorizedCount} correctifs
        </Button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" /> Chaque modification est enregistrée avec son état avant et
          après, et peut être annulée.
        </p>
      </div>
    </div>
  );
}
