import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditCoin } from '@/components/ui/CreditCoin';

// Lazy load the heavy modal (contains framer-motion)
const CreditTopUpModal = lazy(() => import('./CreditTopUpModal').then(m => ({ default: m.CreditTopUpModal })));

const translations = {
  fr: { recharge: 'Recharger' },
  en: { recharge: 'Top up' },
  es: { recharge: 'Recargar' },
};

export function CreditRechargeButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const { balance, loading } = useCredits();
  const { language } = useLanguage();
  const t = translations[language];

  if (loading) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setModalOpen(true)}
        className="gap-1.5 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10"
      >
        <span className="font-medium text-amber-600 dark:text-amber-400">{balance}</span>
        <CreditCoin size="sm" />
        <Plus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      </Button>

      {modalOpen && (
        <Suspense fallback={null}>
          <CreditTopUpModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            currentBalance={balance}
          />
        </Suspense>
      )}
    </>
  );
}
