import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Sparkles, Lock, ExternalLink } from 'lucide-react';
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
    <div className="space-y-3">
      {/* Premium Badge */}
      <div className="flex items-center justify-center gap-2">
        <Badge variant="outline" className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400">
          <Sparkles className="w-3 h-3 mr-1" />
          Pack Premium
        </Badge>
      </div>

      {/* Payment Button */}
      <Button
        onClick={handlePayment}
        disabled={disabled || isLoading || !siteUrl}
        className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        size="lg"
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <CreditCard className="w-4 h-4" />
            </motion.div>
            Préparation du paiement...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Obtenir le Pack Expert
            <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
          </>
        )}
      </Button>

      {/* Security & Info */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Lock className="w-3 h-3" />
          <span>Paiement sécurisé Stripe</span>
        </div>
        <span className="text-muted-foreground/50">•</span>
        <span>À partir de 2€</span>
      </div>

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
