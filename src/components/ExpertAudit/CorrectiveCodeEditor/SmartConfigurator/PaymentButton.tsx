import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { FixConfig } from './types';

interface PaymentButtonProps {
  siteUrl: string;
  calculatedPrice?: number;
  fixConfigs?: FixConfig[];
  disabled?: boolean;
  onPaymentSuccess?: () => void;
}

export function PaymentButton({ 
  siteUrl, 
  calculatedPrice = 3,
  fixConfigs = [],
  disabled = false,
  onPaymentSuccess
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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

      // Étape 1: Sauvegarder l'audit avec les valeurs figées
      const { data: auditData, error: saveError } = await supabase.functions.invoke('save-audit', {
        body: {
          url: siteUrl,
          domain,
          fixes_count: fixesCount,
          fixes_metadata: fixesMetadata,
          total_advanced_fixes: totalAdvancedFixes,
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
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-checkout', {
        body: {
          audit_id: auditId,
          usePaymentLink: false,
        },
      });

      if (checkoutError) throw checkoutError;

      if (checkoutData?.url) {
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

      {/* Price + explanation - Centered */}
      <div className="text-xs text-muted-foreground text-center">
        <span className="font-medium">{calculatedPrice.toFixed(2).replace('.', ',')}€</span>
        <span className="mx-1">•</span>
        <span>{enabledCount} correctif{enabledCount > 1 ? 's' : ''} sélectionné{enabledCount > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
