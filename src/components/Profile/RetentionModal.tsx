import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Crown, Gift, Loader2, Heart, ArrowRight, Send } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
    offerDescription: '-30% pendant 3 mois sur votre abonnement Pro Agency, soit 41€/mois au lieu de 29€.',
    offerPrice: '41€',
    offerPeriod: '/mois pendant 3 mois',
    offerOriginal: '29€',
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
    engagedFor: 'Vous êtes encore engagé pour',
    months: 'mois',
    cancelConfirmTitle: 'Résiliation confirmée',
    cancelConfirmMsg: (date: string) => `Votre abonnement prendra bien fin le ${date}. D'ici là vous pouvez profiter des services de Crawlers.`,
    feedbackLabel: 'Votre avis nous intéresse',
    feedbackPlaceholder: 'Dites-nous pourquoi vous partez, cela nous aide à nous améliorer…',
    feedbackSend: 'Envoyer',
    feedbackSent: 'Merci pour votre retour !',
    feedbackError: 'Erreur lors de l\'envoi',
  },
  en: {
    title: 'Before you go…',
    subtitle: 'We\'d hate to see you leave Pro Agency. How about a special deal?',
    offerTitle: 'Loyalty offer',
    offerDescription: '-30% for 3 months on your Pro Agency subscription: €41/month instead of €29.',
    offerPrice: '€41',
    offerPeriod: '/month for 3 months',
    offerOriginal: '€29',
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
    engagedFor: 'You are still committed for',
    months: 'months',
    cancelConfirmTitle: 'Cancellation confirmed',
    cancelConfirmMsg: (date: string) => `Your subscription will end on ${date}. Until then you can continue using Crawlers services.`,
    feedbackLabel: 'We value your feedback',
    feedbackPlaceholder: 'Tell us why you\'re leaving, it helps us improve…',
    feedbackSend: 'Send',
    feedbackSent: 'Thank you for your feedback!',
    feedbackError: 'Error sending feedback',
  },
  es: {
    title: 'Antes de irte…',
    subtitle: 'Nos encantaría que te quedaras en Pro Agency. ¿Qué tal una oferta especial?',
    offerTitle: 'Oferta de fidelidad',
    offerDescription: '-30% durante 3 meses en tu suscripción Pro Agency: 41€/mes en lugar de 29€.',
    offerPrice: '41€',
    offerPeriod: '/mes durante 3 meses',
    offerOriginal: '29€',
    acceptOffer: 'Aceptar oferta -30%',
    continueCancel: 'No gracias, quiero cancelar',
    offerApplied: 'Oferta aplicada! -30% durante 3 meses.',
    offerError: 'Error al aplicar la oferta',
    features: [
      'Informes y correctivos ilimitados',
      '30 URL seguidos incluidos',
      'Marca blanca',
      'Soporte prioritario',
    ],
    engagedFor: 'Aún tienes compromiso por',
    months: 'meses',
    cancelConfirmTitle: 'Cancelación confirmada',
    cancelConfirmMsg: (date: string) => `Tu suscripción finalizará el ${date}. Hasta entonces puedes seguir usando los servicios de Crawlers.`,
    feedbackLabel: 'Tu opinión nos interesa',
    feedbackPlaceholder: 'Dinos por qué te vas, nos ayuda a mejorar…',
    feedbackSend: 'Enviar',
    feedbackSent: 'Gracias por tu opinión!',
    feedbackError: 'Error al enviar',
  },
};

export function RetentionModal({ open, onOpenChange, onProceedToPortal }: RetentionModalProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { billingPeriod, subscriptionPeriodEnd, planType } = useCredits();
  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Calculate remaining months for annual engagement
  const remainingMonths = (() => {
    if (billingPeriod !== 'annual' || !subscriptionPeriodEnd) return 0;
    const end = new Date(subscriptionPeriodEnd);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (30 * 24 * 60 * 60 * 1000)));
  })();

  const periodEndFormatted = subscriptionPeriodEnd
    ? new Date(subscriptionPeriodEnd).toLocaleDateString(language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : '';

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

  const handleProceedCancel = () => {
    // For annual users, show confirmation with end date instead of going to portal
    if (billingPeriod === 'annual' && remainingMonths > 0) {
      setShowCancelConfirm(true);
      // Still proceed to portal to actually cancel the auto-renewal
      onProceedToPortal();
    } else {
      onOpenChange(false);
      onProceedToPortal();
    }
  };

  const handleSendFeedback = async () => {
    if (!feedback.trim() || !user) return;
    setFeedbackLoading(true);
    try {
      const { error } = await supabase.from('churn_feedback' as any).insert({
        user_id: user.id,
        message: feedback.trim().slice(0, 2000),
        plan_type: planType,
        billing_period: billingPeriod,
      });
      if (error) throw error;
      setFeedbackSent(true);
      toast.success(t.feedbackSent);
    } catch (err) {
      console.error('Feedback error:', err);
      toast.error(t.feedbackError);
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setShowCancelConfirm(false); setFeedback(''); setFeedbackSent(false); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Heart className="h-5 w-5 text-rose-500" />
            {showCancelConfirm ? t.cancelConfirmTitle : t.title}
          </DialogTitle>
          {!showCancelConfirm && (
            <DialogDescription className="text-base pt-1">
              {t.subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        {showCancelConfirm ? (
          <div className="space-y-4 pt-2">
            {/* Confirmation message for annual users */}
            <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
              <p className="text-sm text-foreground">
                {t.cancelConfirmMsg(periodEndFormatted)}
              </p>
            </div>

            {/* Feedback form */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t.feedbackLabel}</label>
              {feedbackSent ? (
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{t.feedbackSent}</p>
              ) : (
                <>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={t.feedbackPlaceholder}
                    rows={3}
                    maxLength={2000}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleSendFeedback}
                    disabled={feedbackLoading || !feedback.trim()}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {feedbackLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t.feedbackSend}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Annual engagement banner */}
            {billingPeriod === 'annual' && remainingMonths > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {t.engagedFor} {remainingMonths} {t.months}.
                </p>
              </div>
            )}

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
              onClick={handleProceedCancel}
            >
              {t.continueCancel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
