import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Crown, Linkedin, Handshake, Infinity, FileText, Code, Users, Copy, Gift, Share2, Globe, Zap, Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
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
    name: 'Lite',
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
    title: 'Abonnement',
    titleFree: 'Tarifs',
    subtitle: 'Choisissez un pack de crédits',
    currentBalance: 'Solde actuel',
    credits: 'crédits',
    perCredit: '/ crédit',
    buy: 'Acheter',
    popular: '⭐ Populaire',
    savings: "d'économie",
    processing: 'Traitement...',
    error: 'Erreur',
    referralShare: 'Parrainez vos amis',
    referralShareDesc: 'Gagnez 20 crédits quand votre ami effectue son premier achat.',
    referralInput: 'Vous avez un code de parrainage ?',
    referralPlaceholder: 'Code...',
    referralValidate: 'Valider',
    referralValidating: '...',
    referralSuccess: '✨ Bienvenue ! +10 crédits offerts.',
    referralAlready: 'Code de parrainage déjà appliqué.',
    copied: 'Copié !',
    copy: 'Copier',
    linkedinOffer: 'Partager sur LinkedIn',
    linkedinDescription: 'Partagez votre audit et gagnez 50 crédits par clic.',
  },
  en: {
    title: 'Subscription',
    titleFree: 'Pricing',
    subtitle: 'Choose a credit pack',
    currentBalance: 'Current balance',
    credits: 'credits',
    perCredit: '/ credit',
    buy: 'Buy',
    popular: '⭐ Popular',
    savings: 'savings',
    processing: 'Processing...',
    error: 'Error',
    referralShare: 'Refer your friends',
    referralShareDesc: 'Earn 20 credits when your friend makes their first purchase.',
    referralInput: 'Have a referral code?',
    referralPlaceholder: 'Code...',
    referralValidate: 'Apply',
    referralValidating: '...',
    referralSuccess: '✨ Welcome! +10 bonus credits.',
    referralAlready: 'Referral code already applied.',
    copied: 'Copied!',
    copy: 'Copy',
    linkedinOffer: 'Share on LinkedIn',
    linkedinDescription: 'Share your audit and earn 50 credits per click.',
  },
  es: {
    title: 'Suscripción',
    titleFree: 'Tarifas',
    subtitle: 'Elige un paquete de créditos',
    currentBalance: 'Saldo actual',
    credits: 'créditos',
    perCredit: '/ crédito',
    buy: 'Comprar',
    popular: '⭐ Popular',
    savings: 'de ahorro',
    processing: 'Procesando...',
    error: 'Error',
    referralShare: 'Recomienda a tus amigos',
    referralShareDesc: 'Gana 20 créditos cuando tu amigo haga su primera compra.',
    referralInput: '¿Tienes un código de referido?',
    referralPlaceholder: 'Código...',
    referralValidate: 'Validar',
    referralValidating: '...',
    referralSuccess: '✨ ¡Bienvenido! +10 créditos de regalo.',
    referralAlready: 'Código de referido ya aplicado.',
    copied: '¡Copiado!',
    copy: 'Copiar',
    linkedinOffer: 'Compartir en LinkedIn',
    linkedinDescription: 'Comparta su auditoría y gane 50 créditos por clic.',
  },
};

export function CreditTopUpModal({ open, onOpenChange, currentBalance }: CreditTopUpModalProps) {
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [isReferred, setIsReferred] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { balance, isAgencyPro } = useCredits();
  const t = translations[language];
  const modalTitle = isAgencyPro ? t.title : (t as any).titleFree || t.title;

  useEffect(() => {
    if (!user || !open) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('referral_code, referred_by')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setMyReferralCode(data.referral_code);
        setIsReferred(!!data.referred_by);
      }
    };
    fetchProfile();
  }, [user, open]);

  const handleCopyCode = () => {
    if (myReferralCode) {
      navigator.clipboard.writeText(myReferralCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleApplyReferral = async () => {
    if (!referralCode.trim() || !user) return;
    setReferralLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('apply-referral', {
        body: { referral_code: referralCode.trim().toUpperCase() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReferralApplied(true);
      setIsReferred(true);
      // Credits will refresh on next page load
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
      const { data, error } = await supabase.functions.invoke('stripe-actions', {
        body: { action: 'credit-checkout', package_type: packageId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank', 'noopener');
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
      <DialogContent className="sm:max-w-[1200px] max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-lg font-semibold">
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        {/* Pro Agency Upsell */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
                  ? 'Rapports et correctifs illimités, 5 000 pages de crawl/mois incluses, marque blanche avec votre logo, et support prioritaire — 59€/mois sans engagement.'
                  : language === 'es'
                    ? 'Informes y correctivos ilimitados, 5 000 páginas de crawl/mes incluidas, marca blanca con su logo, y soporte prioritario — 59€/mes sin compromiso.'
                    : 'Unlimited reports & fixes, 5,000 crawl pages/month included, white-label reports with your logo, and priority support — €59/month, no commitment.'}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><FileText className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? 'Audits ∞' : language === 'es' ? 'Auditorías ∞' : 'Audits ∞'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Code className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? 'Correctifs ∞' : language === 'es' ? 'Correctivos ∞' : 'Fixes ∞'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Globe className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? '5 000 pages crawl/mois' : language === 'es' ? '5 000 páginas crawl/mes' : '5,000 crawl pages/mo'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Zap className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? '30 URL suivis inclus' : language === 'es' ? '30 URL seguidos' : '30 tracked URLs'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Users className="h-3.5 w-3.5 text-violet-500" />{language === 'fr' ? '3 comptes inclus' : language === 'es' ? '3 cuentas' : '3 accounts'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400"><Zap className="h-3.5 w-3.5 text-amber-400" />{language === 'fr' ? 'Indice IAS' : language === 'es' ? 'Índice IAS' : 'SAI Index'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400"><Network className="h-3.5 w-3.5 text-amber-400" />{language === 'fr' ? 'Architecte de Cocon & GEO' : language === 'es' ? 'Arquitecto Cocon & GEO' : 'Cocoon Architect & GEO'}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <p className="text-2xl font-bold text-foreground">59€<span className="text-sm font-normal text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span></p>
              <p className="text-[10px] font-medium text-violet-400">{language === 'fr' ? 'Sans engagement' : language === 'es' ? 'Sin compromiso' : 'No commitment'}</p>
              <Button
                onClick={async () => {
                  setSubscribeLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('stripe-actions', {
                      body: { action: 'subscription', returnUrl: window.location.href }
                    });
                    if (error) throw error;
                    if (data?.url) window.open(data.url, '_blank', 'noopener');
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

        {/* Pro Agency + Upsell */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="relative rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-5 overflow-hidden"
        >
          <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white gap-1 text-xs">
            <Crown className="h-3 w-3" />
            Premium
          </Badge>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 space-y-2">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-400" />
                Pro Agency +
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'fr'
                  ? 'Tout Pro Agency + 50 000 pages de crawl/mois, slider étendu à 50 pages par analyse. Conçu pour les grands sites et portefeuilles clients étendus.'
                  : language === 'es'
                    ? 'Todo Pro Agency + 50 000 páginas de crawl/mes, slider extendido a 50 páginas por análisis. Diseñado para grandes sitios y carteras de clientes amplias.'
                    : 'Everything in Pro Agency + 50,000 crawl pages/month, extended slider up to 50 pages per analysis. Built for large sites and extended client portfolios.'}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Globe className="h-3.5 w-3.5 text-amber-500" />{language === 'fr' ? '50 000 pages crawl/mois' : language === 'es' ? '50 000 páginas crawl/mes' : '50,000 crawl pages/mo'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><FileText className="h-3.5 w-3.5 text-amber-500" />{language === 'fr' ? 'Audits & correctifs ∞' : language === 'es' ? 'Auditorías & correctivos ∞' : 'Audits & fixes ∞'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Zap className="h-3.5 w-3.5 text-amber-500" />{language === 'fr' ? 'Slider 50 pages/crawl' : language === 'es' ? 'Slider 50 páginas/crawl' : 'Slider 50 pages/crawl'}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground"><Network className="h-3.5 w-3.5 text-amber-500" />{language === 'fr' ? 'Cocon & Stratège ∞' : language === 'es' ? 'Cocon & Estratega ∞' : 'Cocoon & Strategist ∞'}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <p className="text-2xl font-bold text-foreground">89€<span className="text-sm font-normal text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span></p>
              <p className="text-[10px] font-medium text-amber-400">{language === 'fr' ? 'Sans engagement' : language === 'es' ? 'Sin compromiso' : 'No commitment'}</p>
              <Button
                onClick={async () => {
                  setPremiumLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('stripe-actions', {
                      body: { action: 'subscription-premium', returnUrl: window.location.href }
                    });
                    if (error) throw error;
                    if (data?.url) window.open(data.url, '_blank', 'noopener');
                  } catch (err) {
                    toast({ title: t.error, description: String(err), variant: 'destructive' });
                  } finally {
                    setPremiumLoading(false);
                  }
                }}
                disabled={premiumLoading}
                className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white w-full border-0"
              >
                {premiumLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4 text-yellow-200" />}
                {language === 'fr' ? "S'abonner" : language === 'es' ? 'Suscribirse' : 'Subscribe'}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Credit Packs — bottom */}
        <div className="grid gap-3 pt-3 grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {packages.map((pkg, index) => {
              const isLoading = loadingPackage === pkg.id;

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className={`relative rounded-lg border-2 p-3 ${pkg.borderColor} ${
                    pkg.popular ? 'ring-2 ring-emerald-500/50' : ''
                  } bg-card hover:border-primary/50 transition-all duration-300`}
                >
                  {pkg.popular && (
                    <Badge 
                      className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-[10px] px-2 py-0.5"
                    >
                      {language === 'fr' ? 'Populaire' : language === 'es' ? 'Popular' : 'Popular'}
                    </Badge>
                  )}

                  <div className="flex flex-col items-center text-center h-full justify-between">
                    <div className="space-y-2">
                      <div>
                        <h3 className="font-semibold text-sm">{pkg.name}</h3>
                        <p className="text-xl font-bold mt-1 flex items-center justify-center gap-1.5">
                          {pkg.credits}
                          <CreditCoin size="sm" />
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-lg font-bold">{pkg.price}€</p>
                        <p className="text-[10px] text-muted-foreground">
                          {pkg.pricePerCredit.toFixed(2).replace('.', ',')}€ {t.perCredit}
                        </p>
                        {pkg.savings ? (
                          <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 px-1.5 py-0">
                            <Check className="h-2.5 w-2.5 mr-0.5" />
                            {pkg.savings} {t.savings}
                          </Badge>
                        ) : (
                          <div className="h-4" />
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={loadingPackage !== null}
                      className={`w-full bg-gradient-to-r ${pkg.color} hover:opacity-90 text-white border-0 mt-2 h-8 text-xs`}
                      size="sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3 mr-1" />
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

        {/* Referral & LinkedIn — compact row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Referral Section */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-sm">{t.referralShare}</h3>
              </div>

              {myReferralCode && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">{t.referralShareDesc}</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-center select-all">
                      {myReferralCode}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyCode} className="shrink-0 gap-1 h-7 text-xs px-2">
                      {codeCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      {codeCopied ? t.copied : t.copy}
                    </Button>
                  </div>
                </div>
              )}

              {!isReferred && !referralApplied ? (
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <p className="text-xs font-medium">{t.referralInput}</p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder={t.referralPlaceholder}
                      className="font-mono tracking-wider uppercase text-xs h-7"
                      maxLength={8}
                      disabled={referralLoading}
                    />
                    <Button
                      onClick={handleApplyReferral}
                      disabled={!referralCode.trim() || referralLoading}
                      size="sm"
                      className="shrink-0 gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 h-7 text-xs px-2"
                    >
                      {referralLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : t.referralValidate}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {referralApplied ? t.referralSuccess : t.referralAlready}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* LinkedIn share */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border-2 border-[#0A66C2]/30 bg-gradient-to-r from-[#0A66C2]/5 via-transparent to-transparent p-3 space-y-2 flex flex-col justify-between"
          >
            <div className="flex items-center gap-3">
              <Handshake className="h-4 w-4 text-[#0A66C2] shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm">{t.linkedinOffer}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{t.linkedinDescription}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-[#0A66C2]/50 text-[#0A66C2] hover:bg-[#0A66C2]/10"
                onClick={() => {
                  const shareUrl = user ? `https://crawlers.fr/temporarylink/demo?ref=${user.id}` : 'https://crawlers.fr';
                  const text = encodeURIComponent(`En moins de 5 minutes et sans expert, j'ai audité le référencement GEO de mon site. 🚀

Je ne suis ni développeur, ni un pro du marketing, mais j'ai vite compris que les règles du jeu ont changé.

Aujourd'hui, nos futurs clients ne "googlisent" plus seulement : ils interrogent ChatGPT, Perplexity ou Gemini. Si notre entreprise n'y est pas citée comme une référence, on devient tout simplement invisible pour une part croissante du marché. 📉

J'ai testé Crawlers.AI (crawlers.fr) pour voir où j'en étais. Ce qui a vraiment fait la différence pour moi ? La clarté du plan d'action.

D'habitude, les outils de diagnostic vous assomment avec des termes techniques comme "balises H1", "fichiers JSON" ou "backlinks". En tant que dirigeant, on veut des solutions, pas des devinettes.

Ici, j'ai obtenu une analyse en langage clair. L'outil m'a dit précisément : « Voici ce que l'IA comprend de votre activité, et voici le contenu spécifique à ajouter pour qu'elle vous recommande naturellement à vos prospects. » 💡

C'est concret, actionnable immédiatement et surtout : on n'a pas besoin de savoir coder pour améliorer sa visibilité.

Pour quelqu'un qui doit gérer 10 priorités à la fois, c'est un gain de sérénité précieux. ✅

${shareUrl}

#Entrepreneuriat #GEO #IA #DigitalMarketing #Strategie #TPE #PME`);
                  window.open(`https://www.linkedin.com/sharing/share-offsite/?text=${text}`, '_blank');
                }}
              >
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </Button>
              <p className="text-xs text-muted-foreground/80 italic">
                {language === 'fr' ? 'Max 200 crédits.' : language === 'es' ? 'Máx. 200 créditos.' : 'Max 200 credits.'}
              </p>
            </div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
