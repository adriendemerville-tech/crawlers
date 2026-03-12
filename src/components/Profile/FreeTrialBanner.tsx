import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Crown, Gift } from 'lucide-react';

export function FreeTrialBanner() {
  const { profile } = useAuth();
  const { isAgencyPro, planType } = useCredits();

  if (!profile || !isAgencyPro) return null;

  // Detect if user is on a gifted 6-month trial:
  // The welcome trigger sets subscription_expires_at = created_at + 6 months
  // and stripe_subscription_id remains null (no Stripe sub)
  const profileData = profile as any;
  const expiresAt = profileData.subscription_expires_at;
  const stripeSubId = profileData.stripe_subscription_id;
  
  // If user has a Stripe subscription, it's a paid plan — no banner
  if (stripeSubId) return null;
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = new Date(expiresAt);
  
  // If expired, no banner
  if (expiry <= now) return null;

  // Calculate remaining full months
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

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-700/40 px-4 py-2.5 mb-4">
      <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
        🎉 {label}
      </p>
    </div>
  );
}
