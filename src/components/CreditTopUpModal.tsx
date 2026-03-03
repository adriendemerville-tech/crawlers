import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Crown, Linkedin, Handshake, Infinity, FileText, Code, Stamp, Users, Copy, Gift, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Separator } from '@/components/ui/separator';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { Input } from '@/components/ui/input';

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
    referralShare: 'Parrainez vos amis',
    referralShareDesc: 'Gagnez 20 crédits quand votre ami effectue son premier achat',
    copied: 'Copié !',
    copy: 'Copier',
    referralInput: 'Code de parrainage',
    referralPlaceholder: 'Entrez un code...',
    referralValidate: 'Valider',
    referralSuccess: 'Code appliqué ! +10 crédits offerts 🎉',
    referralAlready: 'Parrainage déjà activé ✓',
    referralSelfError: 'Vous ne pouvez pas utiliser votre propre code',
    referralValidating: 'Validation...',
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
    referralShare: 'Refer your friends',
    referralShareDesc: 'Earn 20 credits when your friend makes their first purchase',
    copied: 'Copied!',
    copy: 'Copy',
    referralInput: 'Referral code',
    referralPlaceholder: 'Enter a code...',
    referralValidate: 'Apply',
    referralSuccess: 'Code applied! +10 credits bonus 🎉',
    referralAlready: 'Referral already active ✓',
    referralSelfError: "You can't use your own code",
    referralValidating: 'Validating...',
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
    referralShare: 'Recomienda a tus amigos',
    referralShareDesc: 'Gana 20 créditos cuando tu amigo haga su primera compra',
    copied: '¡Copiado!',
    copy: 'Copiar',
    referralInput: 'Código de referido',
    referralPlaceholder: 'Introduce un código...',
    referralValidate: 'Validar',
    referralSuccess: '¡Código aplicado! +10 créditos de regalo 🎉',
    referralAlready: 'Referido ya activo ✓',
    referralSelfError: 'No puedes usar tu propio código',
    referralValidating: 'Validando...',
  },
};

export function CreditTopUpModal({ open, onOpenChange, currentBalance }: CreditTopUpModalProps) {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user, profile } = useAuth();
  const { refreshBalance } = useCredits();
  const t = translations[language];

  // Referral state
  const [referralCode, setReferralCode] = useState('');
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [isReferred, setIsReferred] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Fetch referral info
  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('referral_code, referred_by')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setMyReferralCode((data as any).referral_code || null);
        setIsReferred(!!(data as any).referred_by);
      }
    })();
  }, [user, open]);

  const handleCopyCode = async () => {
    if (!myReferralCode) return;
    await navigator.clipboard.writeText(myReferralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleApplyReferral = async () => {
    if (!referralCode.trim() || !user) return;
    
    // Client-side self-referral check
    if (referralCode.trim().toUpperCase() === myReferralCode) {
      toast({ title: t.referralSelfError, variant: 'destructive' });
      return;
    }

    setReferralLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-referral', {
        body: { referral_code: referralCode.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setReferralApplied(true);
      setIsReferred(true);
      await refreshBalance();
      toast({ title: t.referralSuccess });
    } catch (err) {
      toast({ title: t.error, description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setReferralLoading(false);
    }
  };

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
      <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto">
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

        {/* Referral Section */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-base">{t.referralShare}</h3>
            </div>

            {/* Share section */}
            {myReferralCode && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t.referralShareDesc}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/50 rounded-lg px-4 py-2.5 font-mono text-base font-bold tracking-widest text-center select-all">
                    {myReferralCode}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCode}
                    className="shrink-0 gap-1.5"
                  >
                    {codeCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    {codeCopied ? t.copied : t.copy}
                  </Button>
                </div>
              </div>
            )}

            {/* Input section */}
            {!isReferred && !referralApplied ? (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-sm font-medium">{t.referralInput}</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder={t.referralPlaceholder}
                    className="font-mono tracking-wider uppercase"
                    maxLength={8}
                    disabled={referralLoading}
                  />
                  <Button
                    onClick={handleApplyReferral}
                    disabled={!referralCode.trim() || referralLoading}
                    size="sm"
                    className="shrink-0 gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
                  >
                    {referralLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {t.referralValidating}</>
                    ) : (
                      t.referralValidate
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  {referralApplied ? t.referralSuccess : t.referralAlready}
                </p>
              </div>
            )}
          </motion.div>
        )}

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
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Users className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? '3 comptes inclus' : language === 'es' ? '3 cuentas' : '3 accounts'}</span>
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
          className="rounded-xl bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 p-4 space-y-3"
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
                // Build personalized share URL with ref tracking
                const shareUrl = user ? `https://crawlers.fr/temporaryreport/demo?ref=${user.id}` : 'https://crawlers.fr';
                const text = encodeURIComponent(`En moins de 5 minutes et sans expert, j'ai audité le référencement GEO de mon site. 🚀\n\nJe ne suis ni développeur, ni un pro du marketing, mais j'ai vite compris que les règles du jeu ont changé.\n\nAujourd'hui, nos futurs clients ne "googlisent" plus seulement : ils interrogent ChatGPT, Perplexity ou Gemini. Si notre entreprise n'y est pas citée comme une référence, on devient tout simplement invisible pour une part croissante du marché. 📉\n\nJ'ai testé Crawlers.AI (crawlers.fr) pour voir où j'en étais. Ce qui a vraiment fait la différence pour moi ? La clarté du plan d'action.\n\nD'habitude, les outils de diagnostic vous assomment avec des termes techniques comme "balises H1", "fichiers JSON" ou "backlinks". En tant que dirigeant, on veut des solutions, pas des devinettes.\n\nIci, j'ai obtenu une analyse en langage clair. L'outil m'a dit précisément : « Voici ce que l'IA comprend de votre activité, et voici le contenu spécifique à ajouter pour qu'elle vous recommande naturellement à vos prospects. » 💡\n\nC'est concret, actionnable immédiatement et surtout : on n'a pas besoin de savoir coder pour améliorer sa visibilité.\n\nPour quelqu'un qui doit gérer 10 priorités à la fois, c'est un gain de sérénité précieux. ✅\n\n${shareUrl}\n\n#Entrepreneuriat #GEO #IA #DigitalMarketing #Strategie #TPE #PME`);
                window.open(`https://www.linkedin.com/sharing/share-offsite/?text=${text}`, '_blank');
              }}
            >
              <Linkedin className="h-4 w-4" />
              LinkedIn
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/80 italic pl-9">
            {language === 'fr'
              ? 'Gagnez 50 crédits pour chaque nouveau visiteur unique qui consulte votre rapport via ce lien (max 200 crédits).'
              : language === 'es'
                ? 'Gane 50 créditos por cada nuevo visitante único que consulte su informe a través de este enlace (máx. 200 créditos).'
                : 'Earn 50 credits for each unique new visitor who views your report through this link (max 200 credits).'}
          </p>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
