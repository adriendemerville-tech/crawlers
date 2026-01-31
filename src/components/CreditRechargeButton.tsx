import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Plus } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { CreditTopUpModal } from './CreditTopUpModal';
import { useLanguage } from '@/contexts/LanguageContext';

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
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="font-medium">{balance}</span>
        <Badge 
          variant="secondary" 
          className="h-5 w-5 p-0 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30"
        >
          <Plus className="h-3 w-3" />
        </Badge>
      </Button>

      <CreditTopUpModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentBalance={balance}
      />
    </>
  );
}
