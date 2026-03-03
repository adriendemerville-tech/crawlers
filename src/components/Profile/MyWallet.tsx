import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, History, TrendingUp, TrendingDown, Loader2, ShoppingCart, Activity, Crown, Infinity, FileText, Code, Headphones, ExternalLink, AlertTriangle, Receipt, User } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { Palette } from 'lucide-react';
import { BrandingTab } from '@/components/Profile/BrandingTab';
import { ProfileSettings } from '@/components/Profile/ProfileSettings';
import { AccountManager } from '@/components/Profile/AccountManager';

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
    invoices: 'Factures',
    noTransactions: 'Aucune transaction pour le moment',
    noPurchases: 'Aucun achat pour le moment',
    noUsage: 'Aucune dépense pour le moment',
    noInvoices: 'Aucune facture disponible',
    invoicesDescription: 'Accédez à vos factures depuis le portail de paiement',
    viewInvoices: 'Voir mes factures',
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
    invoices: 'Invoices',
    noTransactions: 'No transactions yet',
    noPurchases: 'No purchases yet',
    noUsage: 'No spending yet',
    noInvoices: 'No invoices available',
    invoicesDescription: 'Access your invoices from the payment portal',
    viewInvoices: 'View my invoices',
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
    invoices: 'Facturas',
    noTransactions: 'Sin transacciones por el momento',
    noPurchases: 'Sin compras por el momento',
    noUsage: 'Sin gastos por el momento',
    noInvoices: 'Sin facturas disponibles',
    invoicesDescription: 'Acceda a sus facturas desde el portal de pagos',
    viewInvoices: 'Ver mis facturas',
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
  const { balance, isAgencyPro, subscriptionStatus, loading: creditsLoading } = useCredits();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const t = translations[language];

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-customer-portal');
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

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

  // Show loader while credits context resolves to prevent flash
  if (creditsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pro Agency: dedicated subscription page with sub-tabs
  if (isAgencyPro || isAdmin) {
    return (
      <div className="space-y-6">
        {/* Active Subscription Card — violet theme */}
        <Card className="border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Crown className="h-5 w-5 text-yellow-500" style={{ filter: 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.6))' }} />
                <span className="text-yellow-500 font-bold" style={{ filter: 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.4))' }}>Pro Agency</span>
                <Badge className="bg-violet-600 text-white text-xs">
                  {subscriptionStatus === 'canceling'
                    ? (language === 'fr' ? 'Résiliation en cours' : language === 'es' ? 'Cancelación en curso' : 'Canceling')
                    : (language === 'fr' ? 'Actif' : language === 'es' ? 'Activo' : 'Active')}
                </Badge>
              </CardTitle>
            </div>
            {subscriptionStatus === 'canceling' && (
              <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {language === 'fr' 
                  ? "Votre abonnement reste actif jusqu'à la fin de la période en cours, puis sera résilié."
                  : language === 'es'
                    ? 'Su suscripción permanece activa hasta el final del período actual.'
                    : 'Your subscription remains active until the end of the current billing period.'}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <FileText className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Rapports illimités' : language === 'es' ? 'Informes ilimitados' : 'Unlimited reports'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <Code className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Correctifs illimités' : language === 'es' ? 'Correctivos ilimitados' : 'Unlimited fixes'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <Palette className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Rapports marque blanche' : language === 'es' ? 'Informes marca blanca' : 'White label reports'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <User className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? '3 comptes inclus' : language === 'es' ? '3 cuentas incluidas' : '3 accounts included'}
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/5 border border-violet-500/20">
                <Headphones className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-sm font-medium">
                  {language === 'fr' ? 'Support prioritaire' : language === 'es' ? 'Soporte prioritario' : 'Priority support'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-2xl font-bold text-foreground">
                49€<span className="text-sm font-normal text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'month'}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="gap-2 border-violet-500/30 hover:bg-violet-500/10"
              >
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                {language === 'fr' ? 'Gérer mon abonnement' : language === 'es' ? 'Gestionar suscripción' : 'Manage subscription'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sub-menu tabs */}
        <Tabs defaultValue="branding" className="space-y-4">
          <TabsList className="w-full grid grid-cols-5 bg-muted/50 border">
            <TabsTrigger value="branding" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:border-violet-500 data-[state=active]:border data-[state=active]:shadow-none">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Branding</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:border-violet-500 data-[state=active]:border data-[state=active]:shadow-none">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:border-violet-500 data-[state=active]:border data-[state=active]:shadow-none">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Factures' : language === 'es' ? 'Facturas' : 'Invoices'}</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:border-violet-500 data-[state=active]:border data-[state=active]:shadow-none">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Paiement' : language === 'es' ? 'Pago' : 'Payment'}</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:border-violet-500 data-[state=active]:border data-[state=active]:shadow-none">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'fr' ? 'Comptes' : language === 'es' ? 'Cuentas' : 'Accounts'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-violet-500" />
                  {language === 'fr' ? 'Marque blanche' : language === 'es' ? 'Marca blanca' : 'White Label'}
                </CardTitle>
                <CardDescription>
                  {language === 'fr' 
                    ? 'Personnalisez vos rapports avec votre identité visuelle' 
                    : language === 'es' 
                      ? 'Personalice sus informes con su identidad visual'
                      : 'Customize your reports with your brand identity'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BrandingTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-violet-500" />
                  Clients
                </CardTitle>
                <CardDescription>
                  {language === 'fr' 
                    ? 'Gérez vos clients et leurs rapports' 
                    : language === 'es' 
                      ? 'Gestione sus clientes y sus informes'
                      : 'Manage your clients and their reports'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                  <div className="p-3 rounded-full bg-violet-500/10">
                    <Activity className="h-8 w-8 text-violet-400" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {language === 'fr' ? 'La gestion des clients sera bientôt disponible.' : language === 'es' ? 'La gestión de clientes estará disponible pronto.' : 'Client management coming soon.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-violet-500" />
                  {t.invoices}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                  <div className="p-3 rounded-full bg-violet-500/10">
                    <Receipt className="h-8 w-8 text-violet-400" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {t.invoicesDescription}
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleOpenPortal}
                    disabled={portalLoading}
                    className="gap-2 border-violet-500/30 hover:bg-violet-500/10"
                  >
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {t.viewInvoices}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-violet-500" />
                  {language === 'fr' ? 'Moyen de paiement' : language === 'es' ? 'Método de pago' : 'Payment method'}
                </CardTitle>
                <CardDescription>
                  {language === 'fr' 
                    ? 'Gérez votre carte bancaire et vos informations de facturation' 
                    : language === 'es' 
                      ? 'Gestione su tarjeta y datos de facturación'
                      : 'Manage your card and billing information'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-violet-500/10">
                      <CreditCard className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {language === 'fr' ? 'Carte enregistrée' : language === 'es' ? 'Tarjeta registrada' : 'Card on file'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'fr' ? 'Modifier via le portail de paiement' : language === 'es' ? 'Modificar a través del portal de pagos' : 'Update via the billing portal'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPortal}
                    disabled={portalLoading}
                    className="gap-2 border-violet-500/30 hover:bg-violet-500/10"
                  >
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                    {language === 'fr' ? 'Modifier' : language === 'es' ? 'Modificar' : 'Update'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="profile">
            <AccountManager />
            <div className="mt-6">
              <ProfileSettings />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Free users: full wallet with credits, upsell, and transaction history
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
              49€<span className="text-sm font-normal text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'month'}</span>
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

      {/* Transaction History */}
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
            <TabsList className="grid w-full grid-cols-4 mb-4">
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
              <TabsTrigger value="invoices" className="gap-2">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">{t.invoices}</span>
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

            <TabsContent value="invoices">
              <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                <div className="p-3 rounded-full bg-muted">
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {t.invoicesDescription}
                </p>
                <Button
                  variant="outline"
                  onClick={handleOpenPortal}
                  disabled={portalLoading}
                  className="gap-2"
                >
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  {t.viewInvoices}
                </Button>
              </div>
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