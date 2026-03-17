import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2, AlertCircle, Linkedin, Infinity as InfinityIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { CreditCoin } from '@/components/ui/CreditCoin';
import type { FixConfig } from './types';

interface PaymentButtonProps {
  siteUrl: string;
  calculatedPrice?: number;
  fixConfigs?: FixConfig[];
  generatedCode?: string;
  disabled?: boolean;
  onPaymentSuccess?: () => void;
  onUnlockWithCredit?: () => void;
}

export function PaymentButton({ 
  siteUrl, 
  calculatedPrice = 3,
  fixConfigs = [],
  generatedCode = '',
  disabled = false,
  onPaymentSuccess,
  onUnlockWithCredit
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { balance, useCredit, refreshBalance, isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();

  const isUnlimited = isAgencyPro || isAdmin;

  // Determine credit cost from calculatedPrice (1 credit = 0.50€)
  const enabledFixesCount = fixConfigs.filter(f => f.enabled).length;
  const creditCost = enabledFixesCount === 0 ? 0 : Math.max(1, Math.round(calculatedPrice / 0.5));
  const hasEnoughCredits = isUnlimited || balance >= creditCost;

  const handleCreditUnlock = async () => {
    if (!user) {
      toast({
        title: 'Connexion requise',
        description: 'Veuillez vous connecter pour utiliser vos crédits',
        variant: 'destructive',
      });
      return;
    }

    if (!hasEnoughCredits) {
      setShowTopUpModal(true);
      return;
    }

    setIsLoading(true);

    try {
      const result = await useCredit('Déblocage script correctif - ' + siteUrl, creditCost);

      if (result.success) {
        
        // Call the unlock callback
        onUnlockWithCredit?.();
      } else {
        if (result.error === 'Insufficient credits') {
          setShowTopUpModal(true);
        } else {
          toast({
            title: 'Erreur',
            description: result.error || 'Une erreur est survenue',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Credit unlock error:', error);
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!siteUrl) {
      toast({
        title: 'URL manquante',
        description: 'Veuillez d\'abord analyser un site',
        variant: 'destructive',
      });
      return;
    }

    let domain = '';
    try {
      domain = new URL(siteUrl).hostname;
    } catch {
      domain = '';
    }

    if (!domain) {
      toast({
        title: 'URL invalide',
        description: "Impossible d'extraire le domaine. Vérifiez que l'URL commence par https://",
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // 🔒 Calcul des valeurs AU MOMENT DU CLIC (snapshot)
      const enabledFixes = fixConfigs.filter(f => f.enabled);
      const fixesMetadata = enabledFixes.map(f => ({
        id: f.id,
        label: f.label,
        category: f.category
      }));
      const fixesCount = enabledFixes.length;
      const totalAdvancedFixes = fixConfigs.filter(f => 
        ['strategic', 'generative'].includes(f.category)
      ).length;

      console.log('🔒 Snapshot au moment du clic:');
      console.log(`   - Fixes activés: ${fixesCount}`);
      console.log(`   - Total fixes avancés disponibles: ${totalAdvancedFixes}`);
      console.log(`   - Prix affiché: ${calculatedPrice}€`);

      // Étape 1: Sauvegarder l'audit avec les valeurs figées ET le code généré
      const { data: auditData, error: saveError } = await supabase.functions.invoke('save-audit', {
        body: {
          url: siteUrl,
          domain,
          fixes_count: fixesCount,
          fixes_metadata: fixesMetadata,
          total_advanced_fixes: totalAdvancedFixes,
          generated_code: generatedCode || null,
          user_id: user?.id ?? null,
        },
      });

      if (saveError) throw saveError;

      const auditId = auditData?.data?.audit_id;
      const serverPrice = auditData?.data?.dynamic_price;
      
      console.log(`✅ Audit sauvegardé: ${auditId}`);
      console.log(`   Prix serveur: ${serverPrice}€ (attendu: ${calculatedPrice}€)`);

      if (!auditId) {
        throw new Error('Échec de la création de l\'audit');
      }

      // Étape 2: Créer la session Stripe avec l'audit_id
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('stripe-actions', {
        body: {
          action: 'checkout',
          audit_id: auditId,
          usePaymentLink: false,
        },
      });

      if (checkoutError) throw checkoutError;

      if (checkoutData?.url) {
        // Sauvegarder l'état avant redirection vers Stripe
        // Permet de restaurer l'état après le retour de paiement
        console.log('💾 Saving session state before Stripe redirect...');
        
        // Rediriger vers Stripe Checkout
        window.location.href = checkoutData.url;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Erreur de paiement',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const enabledCount = fixConfigs.filter(f => f.enabled).length;

  // If advanced options are enabled, show credit-based button
  if (user) {
    return (
      <>
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={hasEnoughCredits ? handleCreditUnlock : () => setShowTopUpModal(true)}
              disabled={disabled || isLoading || !siteUrl}
              variant={hasEnoughCredits ? "default" : "outline"}
              className={`gap-2 ${
                hasEnoughCredits 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0' 
                  : 'border-destructive/50 text-destructive hover:bg-destructive/10'
              } transition-all duration-300`}
              size="sm"
            >
              {isLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Loader2 className="w-3 h-3" />
                  </motion.div>
                  Déblocage...
                </>
               ) : hasEnoughCredits ? (
                <>
                  {isUnlimited ? (
                    <>
                      <InfinityIcon className="w-4 h-4 text-amber-500" />
                      Débloquer
                    </>
                  ) : (
                    <>
                      <CreditCoin size="sm" />
                      Débloquer avec {creditCost} crédit{creditCost > 1 ? 's' : ''}
                    </>
                  )}
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Crédits insuffisants
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-[#0A66C2]/50 text-[#0A66C2] hover:bg-[#0A66C2]/10 text-xs"
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
              <Linkedin className="h-3.5 w-3.5" />
              Gagner des crédits gratuits
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {isUnlimited ? (
              <span className="flex items-center justify-center gap-1 text-amber-500 font-medium">
                <InfinityIcon className="w-4 h-4" /> Illimité
              </span>
            ) : (
              <span>
                Solde : {balance} crédit{balance > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <CreditTopUpModal
          open={showTopUpModal}
          onOpenChange={setShowTopUpModal}
          currentBalance={balance}
        />
      </>
    );
  }

  // Default: standard payment flow
  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Payment Button - Centered */}
      <Button
        onClick={handlePayment}
        disabled={disabled || isLoading || !siteUrl}
        variant="outline"
        className="gap-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300"
        size="sm"
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Loader2 className="w-3 h-3" />
            </motion.div>
            Préparation...
          </>
        ) : (
          <>
            <CreditCard className="w-3 h-3" />
            Obtenir le script complet
          </>
        )}
      </Button>

      {/* Price in credits + explanation - Centered */}
      <div className="text-xs text-muted-foreground text-center">
        <span className="font-medium text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1.5">
          {(calculatedPrice / 0.5).toFixed(0)}
          <CreditCoin size="sm" />
          <span className="text-muted-foreground font-normal">({calculatedPrice.toFixed(2).replace('.', ',')}€)</span>
        </span>
        <span className="block mt-0.5">{enabledCount} correctif{enabledCount > 1 ? 's' : ''} sélectionné{enabledCount > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
