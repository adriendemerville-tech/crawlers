import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, CreditCard, History, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

const translations = {
  fr: {
    title: 'Mon Portefeuille',
    description: 'Gérez vos crédits et consultez votre historique',
    currentBalance: 'Solde actuel',
    credits: 'crédits',
    topUp: 'Recharger',
    history: 'Historique des transactions',
    noTransactions: 'Aucune transaction pour le moment',
    purchase: 'Achat',
    usage: 'Utilisation',
    loading: 'Chargement...',
  },
  en: {
    title: 'My Wallet',
    description: 'Manage your credits and view your history',
    currentBalance: 'Current balance',
    credits: 'credits',
    topUp: 'Top up',
    history: 'Transaction history',
    noTransactions: 'No transactions yet',
    purchase: 'Purchase',
    usage: 'Usage',
    loading: 'Loading...',
  },
  es: {
    title: 'Mi Billetera',
    description: 'Administra tus créditos y consulta tu historial',
    currentBalance: 'Saldo actual',
    credits: 'créditos',
    topUp: 'Recargar',
    history: 'Historial de transacciones',
    noTransactions: 'Sin transacciones por el momento',
    purchase: 'Compra',
    usage: 'Uso',
    loading: 'Cargando...',
  },
};

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

export function MyWallet() {
  const { balance } = useCredits();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const t = translations[language];

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['credit-transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    );
  };

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            {t.currentBalance}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                {balance}
                <span className="text-lg font-normal text-muted-foreground ml-2">
                  {t.credits}
                </span>
              </p>
            </div>
            <Button 
              onClick={() => setShowTopUpModal(true)}
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
            >
              <CreditCard className="h-4 w-4" />
              {t.topUp}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t.history}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{t.loading}</span>
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      tx.amount > 0 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}>
                      {tx.amount > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {tx.transaction_type === 'purchase' ? t.purchase : t.usage}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.description || (tx.transaction_type === 'purchase' ? 'Achat de crédits' : 'Utilisation')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={tx.amount > 0 
                      ? 'text-emerald-600 border-emerald-500/30' 
                      : 'text-rose-600 border-rose-500/30'
                    }
                  >
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </Badge>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {t.noTransactions}
            </p>
          )}
        </CardContent>
      </Card>

      <CreditTopUpModal
        open={showTopUpModal}
        onOpenChange={setShowTopUpModal}
        currentBalance={balance}
      />
    </div>
  );
}
