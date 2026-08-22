import { useCallback, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getMarketplaceVerifications } from '@/lib/marketplace/marketplace.functions';

interface Check {
  id: string;
  method: string;
  verdict: string;
  link_present: boolean | null;
  observed_attribute: string | null;
  observed_anchor: string | null;
  http_status: number | null;
  render_escalated: boolean;
  shell_detected: boolean;
  leg_state: string;
  checked_at: string;
}

const VERDICT_LABEL: Record<string, string> = {
  ok: 'Lien présent et conforme',
  hard_broken: 'Rupture constatée',
  soft_broken: 'Rupture probable, à reconfirmer',
  blocked: 'Contrôle bloqué par le serveur',
  inconclusive: 'Contrôle non concluant',
};

const STATE_LABEL: Record<string, string> = {
  published: 'Publiée',
  verified: 'Vérifiée',
  maintained: 'Maintenue',
  broken: 'Lien rompu',
  resolved: 'Litige tranché',
  refunded: 'Remboursée',
};

/**
 * Journal des contrôles de maintien d'une commande (L4).
 * Chaque ligne dit ce qui a été observé et pourquoi le verdict a été retenu :
 * un blocage serveur ou une coquille JS ne valent jamais rupture.
 */
export function VerificationTimeline({ orderId }: { orderId: string }) {
  const fetchChecks = useServerFn(getMarketplaceVerifications);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setChecks((await fetchChecks({ data: { orderId } })) as Check[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Contrôles indisponibles');
    } finally {
      setLoading(false);
    }
  }, [fetchChecks, orderId]);

  if (checks === null) {
    return (
      <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
        {loading ? 'Chargement…' : 'Voir les contrôles de maintien'}
      </Button>
    );
  }

  if (checks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucun contrôle encore effectué. Le premier a lieu le lendemain de la publication, puis à J+7,
        puis chaque mois jusqu'à la fin de l'engagement.
      </p>
    );
  }

  return (
    <ul className="space-y-2 border-t border-border pt-3">
      {checks.map((c) => (
        <li key={c.id} className="text-xs text-muted-foreground">
          <span className="text-foreground">
            {new Date(c.checked_at).toLocaleString('fr-FR')} — {VERDICT_LABEL[c.verdict] ?? c.verdict}
          </span>
          {' · '}
          état {STATE_LABEL[c.leg_state] ?? c.leg_state}
          {c.http_status ? ` · HTTP ${c.http_status}` : ''}
          {c.observed_attribute ? ` · attribut observé ${c.observed_attribute}` : ''}
          {c.render_escalated ? ' · rendu JavaScript forcé' : ''}
          {c.shell_detected ? ' · page servie sans contenu rendu' : ''}
        </li>
      ))}
    </ul>
  );
}

export default VerificationTimeline;
