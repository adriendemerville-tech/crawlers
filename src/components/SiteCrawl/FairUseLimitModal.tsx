import { useState } from 'react';
import { Loader2, CheckCircle2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CREDIT_PACKAGES } from './types';

interface FairUseLimitModalProps {
  language: string;
  crawlPagesThisMonth: number;
  fairUseLimit: number;
  onClose: () => void;
}

export function FairUseLimitModal({ language, crawlPagesThisMonth, fairUseLimit, onClose }: FairUseLimitModalProps) {
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    setLoadingPkg(packageId);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', {
        body: { action: 'credit-checkout', package_type: packageId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener');
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
      setLoadingPkg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border-2 border-amber-500/50 bg-card shadow-2xl shadow-amber-500/10 p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
            <Bot className="h-7 w-7 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {language === 'fr' ? '5 000 pages déjà consommées' : language === 'es' ? '5 000 páginas ya consumidas' : '5,000 pages already consumed'}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {language === 'fr'
              ? `Vous avez utilisé ${crawlPagesThisMonth.toLocaleString()} pages sur vos 5 000 incluses ce mois-ci. Rechargez des crédits pour continuer.`
              : language === 'es'
              ? `Ha utilizado ${crawlPagesThisMonth.toLocaleString()} páginas de sus 5 000 incluidas este mes.`
              : `You've used ${crawlPagesThisMonth.toLocaleString()} pages out of your 5,000 included this month.`}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/5 to-amber-600/10 border border-amber-500/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{language === 'fr' ? 'Pages utilisées' : 'Pages used'}</span>
            <span className="font-bold text-amber-500">{crawlPagesThisMonth.toLocaleString()} / 5 000</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, (crawlPagesThisMonth / fairUseLimit) * 100)}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKAGES.map((pkg) => (
            <div key={pkg.id} className={`relative rounded-xl border-2 p-3 ${pkg.border} ${pkg.popular ? 'ring-2 ring-emerald-500/50' : ''} bg-card hover:border-primary/50 transition-all`}>
              {pkg.popular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-[10px]">
                  ⭐ {language === 'fr' ? 'Populaire' : 'Popular'}
                </Badge>
              )}
              <div className="flex flex-col items-center text-center h-full justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm">{pkg.name}</h4>
                  <p className="text-xl font-bold mt-1 flex items-center justify-center gap-1">
                    {pkg.credits} <CreditCoin size="sm" />
                  </p>
                  <p className="text-lg font-bold">{pkg.price}€</p>
                  {pkg.savings && (
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{pkg.savings}
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loadingPkg !== null}
                  size="sm"
                  className={`w-full bg-gradient-to-r ${pkg.color} hover:opacity-90 text-white border-0`}
                >
                  {loadingPkg === pkg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (language === 'fr' ? 'Acheter' : 'Buy')}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
          {language === 'fr' ? 'Fermer' : language === 'es' ? 'Cerrar' : 'Close'}
        </Button>
      </div>
    </div>
  );
}
