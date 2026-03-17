import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Gift, Loader2, Heart, ArrowRight, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RetentionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToPortal: () => void;
}

const translations = {
  fr: {
    title: 'Avant de partir…',
    subtitle: 'Nous serions tristes de vous voir quitter Pro Agency. Et si on trouvait un arrangement ?',
    offerTitle: 'Offre spéciale fidélité',
    offerDescription: '-30% pendant 3 mois sur votre abonnement Pro Agency, soit 41€/mois au lieu de 59€.',
    offerPrice: '41€',
    offerPeriod: '/mois pendant 3 mois',
    offerOriginal: '59€',
    acceptOffer: 'Accepter l\'offre -30%',
    continueCancel: 'Non merci, je souhaite résilier',
    offerApplied: 'Offre appliquée ! -30% pendant 3 mois.',
    offerError: 'Erreur lors de l\'application de l\'offre',
    features: [
      'Rapports & correctifs illimités',
      '30 URL suivis inclus',
      'Marque blanche',
      'Support prioritaire',
    ],
  },
  en: {
    title: 'Before you go…',
    subtitle: 'We\'d hate to see you leave Pro Agency. How about a special deal?',
    offerTitle: 'Loyalty offer',
    offerDescription: '-30% for 3 months on your Pro Agency subscription: €41/month instead of €59.',
    offerPrice: '€41',
    offerPeriod: '/month for 3 months',
    offerOriginal: '€59',
    acceptOffer: 'Accept -30% offer',
    continueCancel: 'No thanks, I want to cancel',
    offerApplied: 'Offer applied! -30% for 3 months.',
    offerError: 'Error applying the offer',
    features: [
      'Unlimited reports & fixes',
      '30 tracked URLs included',
      'White label',
      'Priority support',
    ],
  },
  es: {
    title: 'Antes de irte…',
    subtitle: 'Nos encantaría que te quedaras en Pro Agency. ¿Qué tal una oferta especial?',
    offerTitle: 'Oferta de fidelidad',
    offerDescription: '-30% durante 3 meses en tu suscripción Pro Agency: 41€/mes en lugar de 59€.',
    offerPrice: '41€',
    offerPeriod: '/mes durante 3 meses',
    offerOriginal: '59€',
    acceptOffer: 'Aceptar oferta -30%',
    continueCancel: 'No gracias, quiero cancelar',
    offerApplied: '¡Oferta aplicada! -30% durante 3 meses.',
    offerError: 'Error al aplicar la oferta',
    features: [
      'Informes y correctivos ilimitados',
      '30 URL seguidos incluidos',
      'Marca blanca',
      'Soporte prioritario',
    ],
  },
};

export function RetentionModal({ open, onOpenChange, onProceedToPortal }: RetentionModalProps) {
  const { language } = useLanguage();
  const t = translations[language];
  const [loading, setLoading] = useState(false);

  const handleAcceptOffer = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'retention' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t.offerApplied);
      onOpenChange(false);
    } catch (err) {
      console.error('Retention offer error:', err);
      toast.error(t.offerError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Heart className="h-5 w-5 text-rose-500" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-base pt-1">
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Offer card */}
          <div className="relative rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 space-y-3">
            <Badge className="absolute top-3 right-3 bg-emerald-600 text-white text-xs gap-1">
              <Gift className="h-3 w-3" />
              -30%
            </Badge>

            <h3 className="font-bold text-base flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" />
              {t.offerTitle}
            </h3>

            <p className="text-sm text-muted-foreground">{t.offerDescription}</p>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{t.offerPrice}</span>
              <span className="text-sm text-muted-foreground">{t.offerPeriod}</span>
              <span className="text-sm line-through text-muted-foreground/60">{t.offerOriginal}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {t.features.map((f, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {f}
                </Badge>
              ))}
            </div>

            <Button
              onClick={handleAcceptOffer}
              disabled={loading}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
              size="lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              {t.acceptOffer}
            </Button>
          </div>

          {/* Cancel anyway */}
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-destructive text-sm"
            onClick={() => {
              onOpenChange(false);
              onProceedToPortal();
            }}
          >
            {t.continueCancel}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
