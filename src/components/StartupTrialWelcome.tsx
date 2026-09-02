import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Loader2, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from '@/lib/router-compat';
import { redeemStartupTrialToken } from '@/lib/startupTrial.functions';

const STORAGE_KEY = 'startup_trial_token';

/**
 * Consomme le jeton de gratuité « jeune entreprise » dès qu'une session existe
 * (inscription email ou Google), puis affiche la modale de bienvenue 12 mois.
 * Le jeton est capté depuis l'URL (?startup=) et conservé en sessionStorage pour
 * survivre à l'aller-retour OAuth.
 */
export function StartupTrialWelcome() {
  const { user, refreshProfile } = useAuth();
  const redeem = useServerFn(redeemStartupTrialToken);
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [legalName, setLegalName] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('startup');
    if (fromUrl && fromUrl.length >= 32) sessionStorage.setItem(STORAGE_KEY, fromUrl);
  }, []);

  useEffect(() => {
    if (!user || started.current) return;
    const token = typeof window === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY);
    if (!token) return;
    started.current = true;
    setState('pending');
    void (async () => {
      try {
        const result = await redeem({ data: { token } });
        sessionStorage.removeItem(STORAGE_KEY);
        setLegalName(result.legalName);
        setExpiresAt(result.expiresAt);
        setState('done');
        await refreshProfile();
      } catch (err) {
        sessionStorage.removeItem(STORAGE_KEY);
        setMessage(err instanceof Error ? err.message : 'Activation impossible.');
        setState('error');
      }
    })();
  }, [user, redeem, refreshProfile]);

  if (state === 'idle') return null;

  return (
    <Dialog open onOpenChange={() => setState('idle')}>
      <DialogContent className="sm:max-w-md">
        {state === 'pending' ? (
          <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Activation de votre année Pro Agency offerte…
          </div>
        ) : state === 'error' ? (
          <>
            <DialogHeader>
              <DialogTitle>Activation impossible</DialogTitle>
              <DialogDescription>{message}</DialogDescription>
            </DialogHeader>
            <Button asChild variant="outline" className="bg-transparent hover:bg-transparent">
              <Link to="/offre-jeune-entreprise">Recommencer la vérification</Link>
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center border border-brand-gold/60">
                <PartyPopper className="h-5 w-5 text-brand-gold" aria-hidden="true" />
              </div>
              <DialogTitle>Bienvenue — 12 mois offerts</DialogTitle>
              <DialogDescription>
                {legalName ? `${legalName} : ` : ''}votre plan Pro Agency est actif gratuitement pendant
                un an{expiresAt ? `, jusqu’au ${new Date(expiresAt).toLocaleDateString('fr-FR')}` : ''}, sans
                carte bancaire et sans engagement.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Audits SEO techniques et audits stratégiques GEO illimités</li>
              <li>Crawl multi-pages, cocon sémantique et matrice de concurrence</li>
              <li>Content Architect et publication directe vers votre CMS</li>
            </ul>
            <Button asChild variant="outline" className="bg-transparent hover:bg-transparent">
              <Link to="/app/console">Ouvrir ma console</Link>
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
