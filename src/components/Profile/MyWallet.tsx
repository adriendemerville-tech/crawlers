import { useState, lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, History, TrendingUp, TrendingDown, Loader2, ShoppingCart, Activity, Crown, Infinity, FileText, Code, Headphones, ExternalLink, AlertTriangle, Receipt, User, Terminal, Monitor, Radar, Globe, Bot, Store, PenTool } from 'lucide-react';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CreditTopUpModal } from '@/components/CreditTopUpModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';
import { Palette, Network, Plug } from 'lucide-react';
import { BrandingTab } from '@/components/Profile/BrandingTab';
import { CocoonTab } from '@/components/Profile/CocoonTab';
import { ClientsTab } from '@/components/Profile/ClientsTab';
import { ExternalApisTab } from '@/components/Profile/ExternalApisTab';
import { ProfileSettings } from '@/components/Profile/ProfileSettings';
import { AccountManager } from '@/components/Profile/AccountManager';
import { TeamSharingSettings } from '@/components/Profile/TeamSharingSettings';
import { TeamRoleManager } from '@/components/Profile/TeamRoleManager';
import { RetentionModal } from '@/components/Profile/RetentionModal';
const MyReports = lazy(() => import('@/components/Profile/MyReports').then(m => ({ default: m.MyReports })));
import { CrawlQuotaCard } from '@/components/Profile/CrawlQuotaCard';
import { ContentQuotaCard } from '@/components/Profile/ContentQuotaCard';
import { ProAgencyPaywallModal } from '@/components/Profile/ProAgencyPaywallModal';

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
  const { balance, isAgencyPro, subscriptionStatus, planType, loading: creditsLoading } = useCredits();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [walletBilling, setWalletBilling] = useState<'monthly' | 'annual'>('monthly');
  const [portalLoading, setPortalLoading] = useState(false);
  const [showFreeOfferModal, setShowFreeOfferModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const t = translations[language];

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-actions', { body: { action: 'portal' } });
      if (error) {
        // Check if this is a "no Stripe account" error (free offer user)
        const errorMsg = typeof error === 'object' && 'message' in error ? (error as any).message : String(error);
        if (errorMsg.includes('404') || errorMsg.includes('Aucun compte Stripe') || errorMsg.includes('non-2xx')) {
          setShowFreeOfferModal(true);
          return;
        }
        throw error;
      }
      if (data?.error) {
        // Edge function returned an error in the body (e.g. 404 wrapped)
        setShowFreeOfferModal(true);
        return;
      }
      if (data?.url) window.open(data.url, '_blank', 'noopener');
    } catch (err) {
      // Fallback: if any error, show the free offer modal for Pro users without Stripe
      if (isAgencyPro) {
        setShowFreeOfferModal(true);
      } else {
        toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
      }
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
  if (creditsLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pro Agency: dedicated subscription page with sub-tabs
  if (isAgencyPro || isAdmin) {
    return (
      <>
      <div className="space-y-6">
        {subscriptionStatus === 'canceling' && (
          <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {language === 'fr' 
              ? "Votre abonnement reste actif jusqu'à la fin de la période en cours, puis sera résilié."
              : language === 'es'
                ? 'Su suscripción permanece activa hasta el final del período actual.'
                : 'Your subscription remains active until the end of the current billing period.'}
          </div>
        )}

        {/* Sub-menu tabs — vertical left layout */}
        <Tabs defaultValue="branding" className="-mt-2" orientation="vertical">
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="overflow-hidden shrink-0"
            >
              <div className="mb-2" />
              <TabsList className="flex flex-col h-fit w-48 bg-muted/50 border-2 border-violet-500/40 rounded-lg p-1.5 gap-1 sticky top-20">
                {[
                  { value: 'reports', icon: FileText, label: language === 'fr' ? 'Rapports' : language === 'es' ? 'Informes' : 'Reports' },
                  { value: 'branding', icon: Palette, label: 'Branding' },
                  { value: 'cocoon', icon: Network, label: 'Cocoon' },
                  { value: 'clients', icon: Activity, label: 'Clients' },
                  { value: 'counters', icon: Monitor, label: language === 'fr' ? 'Compteurs' : language === 'es' ? 'Contadores' : 'Counters' },
                  { value: 'invoices', icon: Receipt, label: language === 'fr' ? 'Factures' : language === 'es' ? 'Facturas' : 'Invoices' },
                  { value: 'payment', icon: CreditCard, label: language === 'fr' ? 'Paiement' : language === 'es' ? 'Pago' : 'Payment' },
                  { value: 'profile', icon: User, label: language === 'fr' ? 'Comptes' : language === 'es' ? 'Cuentas' : 'Accounts' },
                  { value: 'credits', icon: Bot, label: language === 'fr' ? 'Crédits' : language === 'es' ? 'Créditos' : 'Credits', color: 'text-amber-500' },
                  { value: 'apis', icon: Plug, label: language === 'fr' ? 'API externe' : language === 'es' ? 'API externa' : 'External API', color: 'text-blue-500' },
                ].map((item, i) => (
                  <motion.div
                    key={item.value}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.25, ease: 'easeOut' }}
                  >
                    <TabsTrigger value={item.value} className="w-full justify-start gap-2 py-2 text-sm data-[state=active]:bg-transparent data-[state=active]:text-violet-600 data-[state=active]:border-violet-500 data-[state=active]:border data-[state=active]:shadow-none">
                      <item.icon className={`h-4 w-4 ${'color' in item && item.color ? item.color : ''}`} />
                      <span className={'color' in item && item.color ? item.color : ''}>{item.label}</span>
                    </TabsTrigger>
                  </motion.div>
                ))}
              </TabsList>
            </motion.div>

            <div className="flex-1 min-w-0 space-y-4">
              {/* Reports Tab */}
              <TabsContent value="reports" className="mt-0">
                <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                  <MyReports />
                </Suspense>
              </TabsContent>

              {/* Branding Tab */}
              <TabsContent value="branding" className="mt-0">
                <BrandingTab />
              </TabsContent>

              {/* Cocoon Tab */}
              <TabsContent value="cocoon" className="mt-0">
                <CocoonTab />
              </TabsContent>

              <TabsContent value="clients" className="mt-0">
                <ClientsTab />
              </TabsContent>

              {/* Counters Tab */}
              <TabsContent value="counters" className="mt-0 space-y-4">
                <CrawlQuotaCard />
                <ContentQuotaCard />
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="mt-0">
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
                      {purchases.length === 0 ? (
                        <p className="text-sm text-muted-foreground max-w-xs">
                          {language === 'fr' ? 'Pas d\'achat, pas de facture.' : language === 'es' ? 'Sin compra, sin factura.' : 'No purchase, no invoice.'}
                        </p>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payment Tab */}
              <TabsContent value="payment" className="mt-0">
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
                  <CardContent className="space-y-4">
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

                    <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-violet-500/10">
                          <Crown className="h-5 w-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {planType === 'agency_premium' ? 'Pro Agency +' : 'Pro Agency'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {language === 'fr' ? 'Gérer, modifier ou résilier votre abonnement' : language === 'es' ? 'Gestionar, modificar o cancelar su suscripción' : 'Manage, update or cancel your subscription'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRetentionModal(true)}
                        disabled={portalLoading}
                        className="gap-2 border-violet-500/30 hover:bg-violet-500/10"
                      >
                        {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        {language === 'fr' ? 'Gérer mon abonnement' : language === 'es' ? 'Gestionar suscripción' : 'Manage subscription'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Accounts Tab */}
              <TabsContent value="profile" className="mt-0">
                <AccountManager />
                <div className="mt-6">
                  <TeamRoleManager />
                </div>
                <div className="mt-6">
                  <TeamSharingSettings />
                </div>
                <div className="mt-6">
                  <ProfileSettings />
                </div>
              </TabsContent>

              {/* Credits Tab */}
              <TabsContent value="credits" className="mt-0">
                <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-amber-500" />
                      {language === 'fr' ? 'Crédits' : language === 'es' ? 'Créditos' : 'Credits'}
                    </CardTitle>
                    <CardDescription>
                      {language === 'fr' ? 'Rechargez vos crédits pour les audits et crawls' : language === 'es' ? 'Recargue sus créditos para auditorías y crawls' : 'Top up credits for audits and crawls'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCoin size="lg" />
                        <div>
                          <p className="text-3xl font-bold">{balance}</p>
                          <p className="text-sm text-muted-foreground">{t.credits}</p>
                        </div>
                      </div>
                      <Button onClick={() => setShowTopUpModal(true)} className="gap-2 bg-amber-500 hover:bg-amber-600 text-white">
                        <ShoppingCart className="h-4 w-4" />
                        {t.topUp}
                      </Button>
                    </div>

                    {/* Transaction history */}
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-semibold mb-3">{t.allHistory}</h3>
                      <TransactionList items={transactions || []} emptyMessage={t.noTransactions} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* External APIs Tab */}
              <TabsContent value="apis" className="mt-0">
                <ExternalApisTab />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      <Dialog open={showFreeOfferModal} onOpenChange={setShowFreeOfferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              {language === 'fr' ? 'Offre gratuite active' : language === 'es' ? 'Oferta gratuita activa' : 'Free offer active'}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {language === 'fr'
                ? 'Votre abonnement Pro Agency est actuellement offert. Aucun moyen de paiement n\'est associé à votre compte. Si vous souhaitez modifier votre offre, contactez-nous via le support.'
                : language === 'es'
                ? 'Su suscripción Pro Agency es actualmente gratuita. No hay método de pago asociado a su cuenta. Si desea modificar su oferta, contáctenos a través del soporte.'
                : 'Your Pro Agency subscription is currently free. No payment method is associated with your account. If you wish to change your plan, contact us through support.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowFreeOfferModal(false)}>
              {language === 'fr' ? 'Compris' : language === 'es' ? 'Entendido' : 'Got it'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <CreditTopUpModal
        open={showTopUpModal}
        onOpenChange={setShowTopUpModal}
        currentBalance={balance}
      />
      <RetentionModal
        open={showRetentionModal}
        onOpenChange={setShowRetentionModal}
        onProceedToPortal={handleOpenPortal}
      />
      </>
    );
  }

  // Free users: full wallet with credits, upsell, and transaction history
  // + paywall différé (modal bloquante après quelques secondes) car ils accèdent à l'onglet "Pro Agency"
  return (
    <div className="space-y-6">
      <ProAgencyPaywallModal delayMs={6000} />
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
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent relative overflow-hidden">
        <div className="absolute top-3 right-3">
          <Badge className="bg-violet-600 text-white gap-1 text-xs">
            <span className="text-yellow-400 font-bold text-sm">∞</span>
            {language === 'fr' ? 'Illimité' : language === 'es' ? 'Ilimitado' : 'Unlimited'}
          </Badge>
        </div>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-yellow-500" />
            {language === 'fr' ? 'Passer au plan Pro Agency' : language === 'es' ? 'Cambiar al plan Pro Agency' : 'Upgrade to Pro Agency'}
          </CardTitle>
          <CardDescription>
            {language === 'fr' 
              ? 'Idéal pour les professionnels et agences.' 
              : language === 'es' 
                ? 'Ideal para profesionales y agencias.'
                : 'Ideal for professionals and agencies.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { icon: FileText, label: language === 'fr' ? 'Audit expert & code correctif illimités' : language === 'es' ? 'Auditoría & código ilimitados' : 'Unlimited audit & corrective code' },
              { icon: Globe, label: language === 'fr' ? 'Crawl multi-pages (5 000/mois)' : language === 'es' ? 'Crawl multi-página (5 000/mes)' : 'Multi-page crawl (5,000/mo)' },
              { icon: PenTool, label: language === 'fr' ? 'Content Architect (80/mois)' : language === 'es' ? 'Content Architect (80/mes)' : 'Content Architect (80/mo)' },
              { icon: TrendingUp, label: language === 'fr' ? '30 URL suivis' : language === 'es' ? '30 URL seguidos' : '30 tracked URLs' },
              { icon: Palette, label: language === 'fr' ? 'Marque blanche' : language === 'es' ? 'Marca blanca' : 'White label' },
              { icon: Monitor, label: language === 'fr' ? '2 comptes (1 collab.)' : language === 'es' ? '2 cuentas (1 colab.)' : '2 accounts (1 collab.)' },
              { icon: Radar, label: language === 'fr' ? 'Benchmark rank SERP' : language === 'es' ? 'Benchmark rank SERP' : 'SERP rank benchmark' },
              { icon: Headphones, label: language === 'fr' ? 'Support prioritaire' : language === 'es' ? 'Soporte prioritario' : 'Priority support' },
              { icon: Store, label: language === 'fr' ? 'Google Business' : 'Google Business' },
              { icon: Network, label: language === 'fr' ? 'Cocoon sémantique' : language === 'es' ? 'Cocoon semántico' : 'Semantic cocoon' },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg bg-muted/50 border text-center">
                <item.icon className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
          {/* Billing toggle */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setWalletBilling('monthly')}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                walletBilling === 'monthly'
                  ? 'border-violet-500 text-foreground bg-violet-500/10'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {language === 'fr' ? 'Mensuel' : language === 'es' ? 'Mensual' : 'Monthly'}
            </button>
            <button
              onClick={() => setWalletBilling('annual')}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors relative ${
                walletBilling === 'annual'
                  ? 'border-violet-500 text-foreground bg-violet-500/10'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {language === 'fr' ? 'Annuel' : language === 'es' ? 'Anual' : 'Annual'}
              <span className="absolute -top-2 -right-1.5 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-1 py-0.5 leading-none">
                -10%
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {walletBilling === 'annual' ? '26,10' : '29'}€<span className="text-sm font-normal text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'month'}</span>
              </p>
              {walletBilling === 'annual' && (
                <p className="text-[10px] text-muted-foreground">
                  {language === 'fr' ? 'Facturé 313,20€/an' : language === 'es' ? 'Facturado 313,20€/año' : 'Billed €313.20/year'}
                </p>
              )}
            </div>
            <Button
              onClick={async () => {
                setSubscribeLoading(true);
                try {
                  const resp = await supabase.functions.invoke('stripe-actions', {
                    body: { action: 'subscription', billing: walletBilling, returnUrl: window.location.href }
                  });
                  if (resp.error) {
                    let msg = String(resp.error);
                    try { const ctx = await (resp.error as any).context?.json(); if (ctx?.error) msg = ctx.error; } catch {}
                    throw new Error(msg);
                  }
                  if (resp.data?.url) window.open(resp.data.url, '_blank', 'noopener');
                  else throw new Error(resp.data?.error || 'Aucune URL de paiement reçue');
                } catch (err) {
                  toast({ title: 'Erreur', description: String(err), variant: 'destructive' });
                } finally {
                  setSubscribeLoading(false);
                }
              }}
              disabled={subscribeLoading}
              className="gap-2 bg-gradient-to-r from-violet-600 via-purple-500 to-amber-400 hover:from-violet-700 hover:via-purple-600 hover:to-amber-500 text-white border-0"
            >
              {subscribeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4 text-yellow-300" />}
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
                {purchases.length === 0 ? (
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {language === 'fr' ? 'Pas d\'achat, pas de facture.' : language === 'es' ? 'Sin compra, sin factura.' : 'No purchase, no invoice.'}
                  </p>
                ) : (
                  <>
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
                  </>
                )}
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