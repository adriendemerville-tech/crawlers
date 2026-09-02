import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CreditCard, Crown, ExternalLink, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SubscriptionManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: 'agency_pro' | 'agency_premium';
  upgradeLoading?: boolean;
  onUpgrade: () => void;
  onManagePayment: () => void;
  onCancel: () => void;
}

const copy = {
  fr: {
    title: 'Gérer mon abonnement',
    description: 'Choisissez l’action souhaitée pour votre abonnement.',
    upgrade: 'Passer à Pro Agency +',
    upgradeDescription: 'Plus de volume et de capacités pour les équipes structurées.',
    payment: 'Modifier le paiement',
    paymentDescription: 'Mettre à jour votre carte ou vos informations de facturation.',
    cancel: 'Résilier mon abonnement',
    cancelDescription: 'Accéder au parcours de résiliation et à l’offre de fidélité.',
    current: 'Offre actuelle',
    alreadyPremium: 'Vous êtes déjà sur l’offre Pro Agency +.',
    close: 'Fermer',
  },
  en: {
    title: 'Manage my subscription',
    description: 'Choose what you want to do with your subscription.',
    upgrade: 'Upgrade to Pro Agency +',
    upgradeDescription: 'More volume and capabilities for structured teams.',
    payment: 'Update payment',
    paymentDescription: 'Update your card or billing information.',
    cancel: 'Cancel my subscription',
    cancelDescription: 'Open the cancellation flow and loyalty offer.',
    current: 'Current plan',
    alreadyPremium: 'You are already on the Pro Agency + plan.',
    close: 'Close',
  },
  es: {
    title: 'Gestionar mi suscripción',
    description: 'Elija qué desea hacer con su suscripción.',
    upgrade: 'Pasar a Pro Agency +',
    upgradeDescription: 'Más volumen y capacidades para equipos estructurados.',
    payment: 'Modificar el pago',
    paymentDescription: 'Actualice su tarjeta o sus datos de facturación.',
    cancel: 'Cancelar mi suscripción',
    cancelDescription: 'Abrir el proceso de cancelación y la oferta de fidelidad.',
    current: 'Plan actual',
    alreadyPremium: 'Ya tiene el plan Pro Agency +.',
    close: 'Cerrar',
  },
};

export function SubscriptionManagementModal({
  open,
  onOpenChange,
  currentPlan,
  upgradeLoading = false,
  onUpgrade,
  onManagePayment,
  onCancel,
}: SubscriptionManagementModalProps) {
  const { language } = useLanguage();
  const t = copy[language];
  const isPremium = currentPlan === 'agency_premium';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-xs text-muted-foreground">
            {t.current}: <span className="font-medium text-foreground">{isPremium ? 'Pro Agency +' : 'Pro Agency'}</span>
          </p>

          {!isPremium && (
            <Button
              variant="outline"
              className="h-auto w-full justify-start gap-3 whitespace-normal border-yellow-500/50 py-3 text-left hover:bg-yellow-500/10"
              onClick={onUpgrade}
              disabled={upgradeLoading}
            >
              <Crown className="h-5 w-5 shrink-0 text-yellow-500" />
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span>{upgradeLoading ? 'Redirection…' : t.upgrade}</span>
                <span className="text-xs font-normal text-muted-foreground">{t.upgradeDescription}</span>
              </span>
              {!upgradeLoading && <ExternalLink className="h-4 w-4 shrink-0" />}
            </Button>
          )}

          {isPremium && <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">{t.alreadyPremium}</p>}

          <Button
            variant="outline"
            className="h-auto w-full justify-start gap-3 whitespace-normal py-3 text-left"
            onClick={onManagePayment}
          >
            <CreditCard className="h-5 w-5 shrink-0 text-violet-400" />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span>{t.payment}</span>
              <span className="text-xs font-normal text-muted-foreground">{t.paymentDescription}</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0" />
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full justify-start gap-3 whitespace-normal border-destructive/40 py-3 text-left text-destructive hover:bg-destructive/10"
            onClick={onCancel}
          >
            <X className="h-5 w-5 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span>{t.cancel}</span>
              <span className="text-xs font-normal text-muted-foreground">{t.cancelDescription}</span>
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
