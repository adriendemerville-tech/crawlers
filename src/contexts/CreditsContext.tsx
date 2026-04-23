import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CreditsContextType {
  balance: number;
  loading: boolean;
  planType: string;
  subscriptionStatus: string | null;
  billingPeriod: string;
  subscriptionPeriodEnd: string | null;
  isAgencyPro: boolean;
  isAgencyPremium: boolean;
  refreshBalance: () => Promise<void>;
  useCredit: (description?: string, amount?: number) => Promise<{ success: boolean; newBalance?: number; error?: string }>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [planType, setPlanType] = useState('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits_balance, plan_type, subscription_status, subscription_expires_at')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setBalance(data?.credits_balance || 0);
      setPlanType((data as any)?.plan_type || 'free');
      setSubscriptionStatus((data as any)?.subscription_status || null);
      setSubscriptionExpiresAt((data as any)?.subscription_expires_at || null);
    } catch (error) {
      console.error('Error fetching credits balance:', error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and when profile changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, profile]);

  // Listen for realtime updates on profiles
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('credits-balance')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && 'credits_balance' in payload.new) {
            setBalance(payload.new.credits_balance as number);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshBalance = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  const useCredit = useCallback(async (description = 'Code generation', amount = 1): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase.rpc('use_credit', {
        p_user_id: user.id,
        p_description: description,
        p_amount: amount,
      });

      if (error) throw error;

      const result = data as { success: boolean; new_balance?: number; error?: string };

      if (result.success && result.new_balance !== undefined) {
        setBalance(result.new_balance);
        return { success: true, newBalance: result.new_balance };
      } else {
        return { success: false, error: result.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('Error using credit:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, [user]);

  const isAgencyPro = ['agency_pro', 'agency_premium'].includes(planType) && (subscriptionStatus === 'active' || subscriptionStatus === 'canceling') && (!subscriptionExpiresAt || new Date(subscriptionExpiresAt) > new Date());
  const isAgencyPremium = planType === 'agency_premium' && (subscriptionStatus === 'active' || subscriptionStatus === 'canceling') && (!subscriptionExpiresAt || new Date(subscriptionExpiresAt) > new Date());

  return (
    <CreditsContext.Provider value={{ balance, loading, planType, subscriptionStatus, isAgencyPro, isAgencyPremium, refreshBalance, useCredit }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
