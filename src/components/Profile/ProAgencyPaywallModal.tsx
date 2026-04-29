import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  /** Delay in ms before the blocking modal appears. Default 6000. */
  delayMs?: number;
}

const t = {
  fr: {
    title: 'Espace Pro Agency réservé aux abonnés',
    desc: "Vous consultez l'aperçu de la console Pro Agency. Pour l'utiliser pleinement (multi-clients, partage d'équipe, quotas étendus), souscrivez à l'offre Pro Agency.",
    cta: 'Voir les offres Pro Agency',
    secondary: 'Plus tard',
  },
  en: {
    title: 'Pro Agency area — subscribers only',
    desc: 'You are viewing a preview of the Pro Agency console. To unlock multi-client dashboards, team sharing and extended quotas, subscribe to Pro Agency.',
    cta: 'See Pro Agency plans',
    secondary: 'Later',
  },
  es: {
    title: 'Espacio Pro Agency reservado a suscriptores',
    desc: 'Está viendo una vista previa de la consola Pro Agency. Para desbloquear el modo multi-cliente, suscríbase a Pro Agency.',
    cta: 'Ver planes Pro Agency',
    secondary: 'Más tarde',
  },
};

export function ProAgencyPaywallModal({ delayMs = 6000 }: Props) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const tr = t[language as 'fr' | 'en' | 'es'] ?? t.fr;

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-yellow-500/40 bg-yellow-500/10">
            <Crown className="h-6 w-6 text-yellow-500" />
          </div>
          <DialogTitle className="text-center">{tr.title}</DialogTitle>
          <DialogDescription className="text-center">{tr.desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            className="w-full gap-2 border-yellow-500/60 text-foreground hover:bg-yellow-500/10"
            onClick={() => navigate('/tarifs#pro-agency')}
          >
            <Lock className="h-4 w-4" />
            {tr.cta}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            {tr.secondary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
