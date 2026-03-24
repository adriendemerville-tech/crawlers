import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Crown, Infinity } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { useNavigate } from 'react-router-dom';

// Lazy load the heavy modal (contains framer-motion)
const CreditTopUpModal = lazy(() => import('./CreditTopUpModal').then(m => ({ default: m.CreditTopUpModal })));

const translations = {
  fr: { recharge: 'Recharger' },
  en: { recharge: 'Top up' },
  es: { recharge: 'Recargar' },
};

interface CreditRechargeButtonProps {
  showZeroForGuest?: boolean;
}

export function CreditRechargeButton({ showZeroForGuest = false }: CreditRechargeButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { balance, loading, isAgencyPro } = useCredits();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const t = translations[language];

  // Show loading state only for logged in users
  if (loading && user) return null;

  // Pro Agency users & admins: show golden badge instead of credit counter
  if (user && (isAgencyPro || isAdmin)) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/app/console?tab=wallet')}
        className="gap-1 border-yellow-500/40 hover:border-yellow-500/60 hover:bg-yellow-500/10 px-3"
      >
        <Infinity className="h-5 w-5 text-yellow-500" />
      </Button>
    );
  }

  // For guests, show 0 balance and redirect to auth on click
  const displayBalance = user ? balance : 0;

  const handleClick = () => {
    if (user) {
      setModalOpen(true);
    } else {
      navigate('/auth');
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-1.5 border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10"
      >
        <span className="font-medium text-amber-600 dark:text-amber-400">{displayBalance}</span>
        <CreditCoin size="sm" />
        <Plus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      </Button>

      {modalOpen && user && (
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
