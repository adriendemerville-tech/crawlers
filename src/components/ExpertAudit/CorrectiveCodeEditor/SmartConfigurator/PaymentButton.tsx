import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentButtonProps {
  siteUrl: string;
  fixesCount: number;
  sector?: string;
  disabled?: boolean;
  onPaymentSuccess?: () => void;
}

export function PaymentButton({ 
  siteUrl, 
  fixesCount, 
  sector = 'default',
  disabled = false,
  onPaymentSuccess 
}: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
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

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          siteUrl,
          sector,
          fixesCount,
          userId: user?.id || null,
          usePaymentLink: false, // Use dynamic pricing
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Store price for display
        if (data.price) {
          setEstimatedPrice(data.price);
        }
        
        // Redirect to Stripe Checkout
        window.location.href = data.url;
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

  return (
    <div className="space-y-1">
      {/* Payment Button - Compact & Elegant */}
      <Button
        onClick={handlePayment}
        disabled={disabled || isLoading || !siteUrl}
        variant="outline"
        className="w-full gap-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300"
        size="sm"
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <CreditCard className="w-3 h-3" />
            </motion.div>
            Préparation...
          </>
        ) : (
          <>
            <Lock className="w-3 h-3 opacity-70" />
            Obtenir le script complet
          </>
        )}
      </Button>

      {/* Price below button */}
      <p className="text-center text-xs text-muted-foreground">3,00€</p>

      {/* Features List */}
      <div className="text-xs text-muted-foreground space-y-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3">
        <p className="font-medium text-foreground mb-2">Inclus dans le pack :</p>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            Script correctif personnalisé
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            {fixesCount} améliorations activées
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            Guide d'implémentation
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            Support technique inclus
          </li>
        </ul>
      </div>
    </div>
  );
}
