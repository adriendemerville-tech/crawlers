import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, History, TrendingUp, TrendingDown, Loader2, ShoppingCart, Activity, Crown, Infinity, FileText, Code, Headphones } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { useToast } from '@/hooks/use-toast';

const translations = {
  fr: {
    title: 'Mon Portefeuille',
    description: 'Gérez vos crédits et consultez votre historique',
    currentBalance: 'Solde actuel',
    credits: 'crédits',
    topUp: 'Recharger',
    allHistory: 'Tout',
    purchases: 'Achats',
    usage: 'Dépenses',
    noTransactions: 'Aucune transaction pour le moment',
    noPurchases: 'Aucun achat pour le moment',
    noUsage: 'Aucune dépense pour le moment',
    purchase: 'Achat',
    usageLabel: 'Utilisation',
    loading: 'Chargement...',
    creditsPurchased: 'crédits achetés',
    creditUsed: 'crédit utilisé',
    creditsUsed: 'crédits utilisés',
  },
  en: {
    title: 'My Wallet',
    description: 'Manage your credits and view your history',
    currentBalance: 'Current balance',
    credits: 'credits',
    topUp: 'Top up',
    allHistory: 'All',
    purchases: 'Purchases',
    usage: 'Spending',
    noTransactions: 'No transactions yet',
    noPurchases: 'No purchases yet',
    noUsage: 'No spending yet',
    purchase: 'Purchase',
    usageLabel: 'Usage',
    loading: 'Loading...',
    creditsPurchased: 'credits purchased',
    creditUsed: 'credit used',
    creditsUsed: 'credits used',
  },
  es: {
    title: 'Mi Billetera',
    description: 'Administra tus créditos y consulta tu historial',
    currentBalance: 'Saldo actual',
    credits: 'créditos',
    topUp: 'Recargar',
    allHistory: 'Todo',
    purchases: 'Compras',
    usage: 'Gastos',
    noTransactions: 'Sin transacciones por el momento',
    noPurchases: 'Sin compras por el momento',
    noUsage: 'Sin gastos por el momento',
    purchase: 'Compra',
    usageLabel: 'Uso',
    loading: 'Cargando...',
    creditsPurchased: 'créditos comprados',
    creditUsed: 'crédito utilizado',
    creditsUsed: 'créditos utilizados',
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
  const { balance, isAgencyPro } = useCredits();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
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
        .limit(50);

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });

  const purchases = transactions?.filter(tx => tx.amount > 0) || [];
  const usages = transactions?.filter(tx => tx.amount < 0) || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    );
  };

  const TransactionList = ({ 
    items, 
    emptyMessage 
  }: { 
    items: Transaction[]; 
    emptyMessage: string;
  }) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">{t.loading}</span>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((tx, index) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
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
                  {tx.amount > 0 
                    ? `${Math.abs(tx.amount)} ${t.creditsPurchased}`
                    : `${Math.abs(tx.amount)} ${Math.abs(tx.amount) === 1 ? t.creditUsed : t.creditsUsed}`
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {tx.description || (tx.transaction_type === 'purchase' ? t.purchase : t.usageLabel)}
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <CreditCoin size="md" />
            {t.currentBalance}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">
                {balance}
              </p>
              <CreditCoin size="lg" />
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

      {/* Pro Agency Upsell Card */}
      {!isAgencyPro && (
        <Card className="border-primary/40 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent relative overflow-hidden">
          <div className="absolute top-3 right-3">
            <Badge className="bg-primary/90 text-primary-foreground gap-1 text-xs">
              <Infinity className="h-3 w-3" />
              {language === 'fr' ? 'Illimité' : language === 'es' ? 'Ilimitado' : 'Unlimited'}
            </Badge>
          </div>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-primary" />
              {language === 'fr' ? 'Passer au plan Pro Agency' : language === 'es' ? 'Cambiar al plan Pro Agency' : 'Upgrade to Pro Agency'}
            </CardTitle>
            <CardDescription>
              {language === 'fr' 
                ? 'Tout illimité pour 49€/mois — idéal pour les professionnels et agences.' 
                : language === 'es' 
                  ? 'Todo ilimitado por 49€/mes — ideal para profesionales y agencias.'
                  : 'Everything unlimited for €49/month — ideal for professionals and agencies.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Rapports illimités' : language === 'es' ? 'Informes ilimitados' : 'Unlimited reports'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <Code className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Correctifs illimités' : language === 'es' ? 'Correctivos ilimitados' : 'Unlimited fixes'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <Headphones className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Support prioritaire' : language === 'es' ? 'Soporte prioritario' : 'Priority support'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-2xl font-bold text-foreground">
                49€<span className="text-sm font-normal text-muted-foreground">/
                  {language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'month'}
                </span>
              </p>
              <Button
                onClick={async () => {
                  setSubscribeLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('create-subscription-session', {
                      body: { returnUrl: window.location.href }
                    });
                    if (error) throw error;
                    if (data?.url) window.location.href = data.url;
                  } catch (err) {
                    toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
                  } finally {
                    setSubscribeLoading(false);
                  }
                }}
                disabled={subscribeLoading}
                className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground"
              >
                {subscribeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                {language === 'fr' ? "S'abonner" : language === 'es' ? 'Suscribirse' : 'Subscribe'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">{t.allHistory}</span>
              </TabsTrigger>
              <TabsTrigger value="purchases" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">{t.purchases}</span>
                {purchases.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {purchases.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="usage" className="gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">{t.usage}</span>
                {usages.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {usages.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <TransactionList 
                items={transactions || []} 
                emptyMessage={t.noTransactions}
              />
            </TabsContent>

            <TabsContent value="purchases">
              <TransactionList 
                items={purchases} 
                emptyMessage={t.noPurchases}
              />
            </TabsContent>

            <TabsContent value="usage">
              <TransactionList 
                items={usages} 
                emptyMessage={t.noUsage}
              />
            </TabsContent>
          </Tabs>
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