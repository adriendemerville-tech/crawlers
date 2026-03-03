import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Crown, Linkedin, Handshake, Infinity, FileText, Code, Stamp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Separator } from '@/components/ui/separator';
import { CreditCoin } from '@/components/ui/CreditCoin';

interface CreditTopUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
}

const packages = [
  {
    id: 'essential',
    name: 'Essentiel',
    credits: 10,
    price: 5,
    pricePerCredit: 0.50,
    color: 'from-blue-500 to-cyan-500',
    borderColor: 'border-blue-500/30',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    price: 19,
    pricePerCredit: 0.38,
    color: 'from-emerald-500 to-green-500',
    borderColor: 'border-emerald-500/50',
    popular: true,
    savings: '24%',
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 150,
    price: 45,
    pricePerCredit: 0.30,
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/30',
    popular: false,
    savings: '40%',
  },
];

const translations = {
  fr: {
    title: 'Recharger mes crédits',
    subtitle: 'Choisissez le pack qui vous convient',
    currentBalance: 'Solde actuel',
    credits: 'crédits',
    perCredit: '/ crédit',
    savings: "d'économie",
    popular: 'Populaire',
    buy: 'Acheter',
    processing: 'Redirection...',
    error: 'Une erreur est survenue',
    linkedinOffer: 'Vous aimez Crawlers.AI ?',
    linkedinDescription: 'Publiez votre rapport sur LinkedIn et recevez 50 crédits gratuits !',
    linkedinCta: 'Publier',
  },
  en: {
    title: 'Top up my credits',
    subtitle: 'Choose the pack that suits you',
    currentBalance: 'Current balance',
    credits: 'credits',
    perCredit: '/ credit',
    savings: 'savings',
    popular: 'Popular',
    buy: 'Buy',
    processing: 'Redirecting...',
    error: 'An error occurred',
    linkedinOffer: 'Do you like Crawlers.AI?',
    linkedinDescription: 'Share your report on LinkedIn and get 50 free credits!',
    linkedinCta: 'Share',
  },
  es: {
    title: 'Recargar mis créditos',
    subtitle: 'Elige el paquete que te convenga',
    currentBalance: 'Saldo actual',
    credits: 'créditos',
    perCredit: '/ crédito',
    savings: 'de ahorro',
    popular: 'Popular',
    buy: 'Comprar',
    processing: 'Redirigiendo...',
    error: 'Ocurrió un error',
    linkedinOffer: '¿Te gusta Crawlers.AI?',
    linkedinDescription: '¡Publica tu informe en LinkedIn y recibe 50 créditos gratis!',
    linkedinCta: 'Publicar',
  },
};

export function CreditTopUpModal({ open, onOpenChange, currentBalance }: CreditTopUpModalProps) {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = translations[language];

  const handlePurchase = async (packageId: string) => {
    setLoadingPackage(packageId);

    try {
      const { data, error } = await supabase.functions.invoke('create-credit-checkout', {
        body: { package_type: packageId },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Credit purchase error:', error);
      toast({
        title: t.error,
        description: error instanceof Error ? error.message : t.error,
        variant: 'destructive',
      });
      setLoadingPackage(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t.title}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>{t.subtitle}</span>
            <Badge variant="secondary">
              {t.currentBalance}: {currentBalance} {t.credits}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-3">
          <AnimatePresence>
            {packages.map((pkg, index) => {
              const isLoading = loadingPackage === pkg.id;

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative rounded-xl border-2 p-4 ${pkg.borderColor} ${
                    pkg.popular ? 'ring-2 ring-emerald-500/50' : ''
                  } bg-card hover:border-primary/50 transition-all duration-300`}
                >
                  {pkg.popular && (
                    <Badge 
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0"
                    >
                      {t.popular}
                    </Badge>
                  )}

                  <div className="flex flex-col items-center text-center space-y-3">
                    <div>
                      <h3 className="font-semibold text-base">{pkg.name}</h3>
                      <p className="text-2xl font-bold mt-1 flex items-center justify-center gap-1.5">
                        {pkg.credits}
                        <CreditCoin size="md" />
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xl font-bold">{pkg.price}€</p>
                      <p className="text-xs text-muted-foreground">
                        {pkg.pricePerCredit.toFixed(2).replace('.', ',')}€ {t.perCredit}
                      </p>
                      {pkg.savings && (
                        <Badge variant="secondary" className="text-xs text-emerald-600 dark:text-emerald-400">
                          <Check className="h-3 w-3 mr-1" />
                          {pkg.savings} {t.savings}
                        </Badge>
                      )}
                    </div>

                    <Button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={loadingPackage !== null}
                      className={`w-full bg-gradient-to-r ${pkg.color} hover:opacity-90 text-white border-0`}
                      size="sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          {t.buy}
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Pro Agency Upsell */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="relative rounded-xl border-2 border-violet-500/40 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-5 overflow-hidden"
        >
          <Badge className="absolute top-3 right-3 bg-violet-600 text-white gap-1 text-xs">
            <Infinity className="h-3 w-3" />
            {language === 'fr' ? 'Illimité' : language === 'es' ? 'Ilimitado' : 'Unlimited'}
          </Badge>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                {language === 'fr' ? 'Passez en forfait illimité avec Pro Agency' : language === 'es' ? 'Pase al plan ilimitado Pro Agency' : 'Go unlimited with Pro Agency'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'fr'
                  ? 'Plus de limites. Rapports et correctifs illimités, rapports en marque blanche avec votre logo, et support prioritaire — tout inclus.'
                  : language === 'es'
                    ? 'Sin límites. Informes y correctivos ilimitados, informes en marca blanca con su logo, y soporte prioritario — todo incluido.'
                    : 'No limits. Unlimited reports & fixes, white-label reports with your logo, and priority support — all included.'}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><FileText className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? 'Rapports ∞' : 'Reports ∞'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Code className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? 'Correctifs ∞' : 'Fixes ∞'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Stamp className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? 'Marque blanche' : 'White label'}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <p className="text-2xl font-bold text-foreground">49€<span className="text-sm font-normal text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span></p>
              <Button
                onClick={async () => {
                  setSubscribeLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('create-subscription-session', {
                      body: { returnUrl: window.location.href }
                    });
                    if (error) throw error;
                    if (data?.url) window.location.href = data.url;
                  } catch (err) {
                    toast({ title: t.error, description: String(err), variant: 'destructive' });
                  } finally {
                    setSubscribeLoading(false);
                  }
                }}
                disabled={subscribeLoading}
                className="gap-2 bg-gradient-to-r from-violet-600 via-purple-500 to-amber-400 hover:from-violet-700 hover:via-purple-600 hover:to-amber-500 text-white w-full border-0"
              >
                {subscribeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4 text-amber-300" />}
                {language === 'fr' ? "S'abonner" : language === 'es' ? 'Suscribirse' : 'Subscribe'}
              </Button>
            </div>
          </div>
        </motion.div>

        <Separator className="my-4" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 p-4"
        >
          <div className="flex items-center gap-4">
            <Handshake className="h-5 w-5 text-[#0A66C2] shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">{t.linkedinOffer}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.linkedinDescription}
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 gap-2 border-[#0A66C2]/50 text-[#0A66C2] hover:bg-[#0A66C2]/10 px-4"
              onClick={() => {
                const text = encodeURIComponent("En 10 minutes, j'ai obtenu une expertise SEO et un plan d'action stratégique pour mon marketing grâce à Crawlers.AI 🚀\n\nL'outil analyse la visibilité de votre site auprès des moteurs de recherche IA (ChatGPT, Perplexity, Gemini...) et génère des recommandations concrètes.\n\nLe plus ? C'est gratuit pour commencer, et les packs de crédits sont très accessibles (à partir de 5€ pour 10 audits).\n\nJe recommande à tous les marketeurs et entrepreneurs !");
                window.open(`https://www.linkedin.com/sharing/share-offsite/?text=${text}`, '_blank');
              }}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
