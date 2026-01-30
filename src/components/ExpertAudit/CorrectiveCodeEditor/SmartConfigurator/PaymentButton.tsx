import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface PaymentButtonProps {
  siteUrl: string;
  fixesCount: number;
  sector?: string;
  disabled?: boolean;
  onPaymentSuccess?: () => void;
  calculatedPrice?: number;
}

export function PaymentButton({ 
  siteUrl, 
  fixesCount, 
  sector = 'default',
  disabled = false,
  onPaymentSuccess,
  calculatedPrice = 3
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
              <CreditCard className="w-3 h-3" />
            </motion.div>
            Préparation...
          </>
        ) : (
          <>
            Obtenir le script complet
          </>
        )}
      </Button>

      {/* Price + explanation - Centered */}
      <div className="text-xs text-muted-foreground text-center">
        <span className="font-medium">{calculatedPrice.toFixed(2).replace('.', ',')}€</span>
        <span className="mx-1">•</span>
        <span>Prix adapté au nombre de correctifs sélectionnés</span>
      </div>
    </div>
  );
}
