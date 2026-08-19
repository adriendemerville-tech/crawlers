import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { createMarinaPaidPass, getMarinaPassStatus, startMarinaPaidAudit } from '@/lib/marinaFree.functions';

const PASS_STORAGE_KEY = 'marina_paid_pass_token';
export const MARINA_ONESHOT_PRICE_EUR = 15;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  email: string;
  language?: string;
  /** Appelé quand l'audit payé a démarré : la page prend le relais du polling. */
  onAuditStarted: (jobId: string) => void;
}

/**
 * Quota gratuit épuisé (2 rapports par IP) : propose de débloquer le rapport
 * suivant à 15 €. Le paiement crée un "pass" à usage unique côté serveur ;
 * dès qu'il est validé, l'audit est lancé automatiquement.
 */
export function MarinaPaidUnlockModal({ open, onOpenChange, url, email, language, onAuditStarted }: Props) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [localEmail, setLocalEmail] = useState(email);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => { setLocalEmail(email); }, [email]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const launchWithPass = useCallback(async (passToken: string) => {
    const res = await startMarinaPaidAudit({ data: { url, passToken, lang: language || 'fr' } });
    if ('error' in res) {
      if (res.error === 'pass_pending') return false;
      toast.error(res.message);
      setWaiting(false);
      return true;
    }
    localStorage.removeItem(PASS_STORAGE_KEY);
    setWaiting(false);
    onOpenChange(false);
    onAuditStarted(res.jobId);
    toast.success('Paiement confirmé — audit lancé');
    return true;
  }, [url, language, onAuditStarted, onOpenChange]);

  const watchPass = useCallback((passToken: string) => {
    setWaiting(true);
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const status = await getMarinaPassStatus({ data: { passToken } });
        if (status.status === 'granted') {
          const done = await launchWithPass(passToken);
          if (done) stopPolling();
        }
      } catch { /* réseau : on retente au tick suivant */ }
    }, 3000);
  }, [launchWithPass, stopPolling]);

  // Retour de checkout (onglet rechargé) : on reprend un pass déjà payé.
  useEffect(() => {
    if (!open) return;
    const existing = localStorage.getItem(PASS_STORAGE_KEY);
    if (existing) watchPass(existing);
  }, [open, watchPass]);

  const handlePay = async () => {
    if (!url.trim()) { toast.error('Renseignez d\'abord l\'URL à auditer'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(localEmail.trim())) {
      toast.error('Adresse email invalide');
      return;
    }
    const pass = await createMarinaPaidPass({ data: { email: localEmail.trim() } });
    if ('error' in pass) { toast.error(pass.message); return; }
    localStorage.setItem(PASS_STORAGE_KEY, pass.passToken);
    setCheckoutLoading(true);
    try {
      // Stripe Checkout (même circuit que les crédits et abonnements)
      const { data, error } = await supabase.functions.invoke('stripe-actions', {
        body: {
          action: 'marina-oneshot',
          pass_token: pass.passToken,
          email: localEmail.trim(),
          url: url.trim(),
        },
      });
      if (error || !data?.url) throw new Error(data?.error || error?.message || 'checkout_failed');
      // Le pass reste en localStorage : au retour sur /marina, le polling reprend.
      window.location.href = data.url as string;
    } catch {
      setCheckoutLoading(false);
      toast.error('Impossible d\'ouvrir le paiement');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Mince, vous avez déjà utilisé vos deux audits gratuits
          </DialogTitle>
          <DialogDescription>
            Le prochain audit Marina vous sera facturé {MARINA_ONESHOT_PRICE_EUR} euros. Rapport complet
            SEO + GEO, PDF exportable, sans abonnement ni création de compte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="text-muted-foreground">Site à auditer</p>
            <p className="font-medium text-foreground break-all">{url || '—'}</p>
          </div>
          <Input
            type="email"
            value={localEmail}
            onChange={e => setLocalEmail(e.target.value)}
            placeholder="votre@email.com"
            className="h-11 bg-card border-border"
            disabled={waiting}
          />
          <Button
            onClick={handlePay}
            disabled={checkoutLoading || waiting}
            className="w-full h-11 bg-transparent border border-foreground text-foreground hover:bg-foreground/10 font-semibold"
          >
            {(checkoutLoading || waiting) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {waiting
              ? 'Validation du paiement…'
              : `Débloquer l'audit — ${MARINA_ONESHOT_PRICE_EUR} €`}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Créer un compte reste gratuit : 5 crédits offerts, soit un rapport Marina inclus.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
