import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Gift, X } from 'lucide-react';

export function FreeTrialBanner() {
  const { profile } = useAuth();
  const { isAgencyPro } = useCredits();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('free_trial_banner_dismissed') === 'true';
  });

  if (!profile || !isAgencyPro || dismissed) return null;

  const expiresAt = profile.subscription_expires_at;
  const stripeSubId = profile.stripe_subscription_id;
  
  if (stripeSubId) return null;
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  if (expiry <= now) return null;

  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const remainingMonths = Math.floor(diffDays / 30);

  let label: string;
  if (remainingMonths >= 6) {
    label = '6 mois d\'abonnement Pro Agency gratuit';
  } else if (remainingMonths >= 1) {
    label = `${remainingMonths} mois d'abonnement Pro Agency gratuit`;
  } else if (diffDays > 1) {
    label = `${diffDays} jours d'abonnement Pro Agency gratuit`;
  } else {
    label = 'Dernier jour d\'abonnement Pro Agency gratuit';
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('free_trial_banner_dismissed', 'true');
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/40 px-4 py-2.5 mb-4">
      <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
        🎉 {label}
      </p>
      <button onClick={handleDismiss} className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
