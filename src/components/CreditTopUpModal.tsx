import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, Loader2, Sparkles, Crown, Star, Linkedin, Handshake, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Separator } from '@/components/ui/separator';

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
    icon: Zap,
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
    icon: Sparkles,
    color: 'from-violet-500 to-purple-500',
    borderColor: 'border-violet-500/50',
    popular: true,
    savings: '24%',
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 150,
    price: 45,
    pricePerCredit: 0.30,
    icon: Crown,
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
      <DialogContent className="sm:max-w-[740px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-amber-500" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span>{t.subtitle}</span>
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {t.currentBalance}: {currentBalance} {t.credits}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-3">
          <AnimatePresence>
            {packages.map((pkg, index) => {
              const Icon = pkg.icon;
              const isLoading = loadingPackage === pkg.id;

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative rounded-xl border-2 p-4 ${pkg.borderColor} ${
                    pkg.popular ? 'ring-2 ring-violet-500/50' : ''
                  } bg-card hover:border-primary/50 transition-all duration-300`}
                >
                  {pkg.popular && (
                    <Badge 
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0"
                    >
                      {t.popular}
                    </Badge>
                  )}

                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${pkg.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-semibold text-base">{pkg.name}</h3>
                      <p className="text-2xl font-bold mt-1">
                        {pkg.credits}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          {t.credits}
                        </span>
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

        {/* LinkedIn Offer Section */}
        <Separator className="my-4" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border-2 border-dashed border-[#0A66C2]/30 bg-[#0A66C2]/5 p-4"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#0A66C2] text-white shrink-0">
              <Handshake className="h-5 w-5" />
            </div>
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
