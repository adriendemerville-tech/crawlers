import { InventoryTable } from './InventoryTable';
import { OwnershipCard } from './OwnershipCard';
import { TaxProfileCard } from './TaxProfileCard';
import { BuyTab } from './BuyTab';
import { OpportunitiesTab } from './OpportunitiesTab';
import { OrdersTab } from './OrdersTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

/**
 * Place d'échange — vente (L1a), appariement et achat (L2).
 * La commande, le séquestre et le Studio arrivent au lot L3.
 */
export function MarketplaceModule() {
  const { can } = useTeamPermissions();

  if (!can('marketplace_manage')) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Votre rôle ne permet pas de gérer la Place d'échange.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Place d'échange</h2>
        <p className="text-sm text-muted-foreground">
          Cédez un emplacement de lien sur vos pages les moins stratégiques, au prix calculé par
          Crawlers. Chaque décision reste déterministe : palier de prix, coût d'autorité et plafonds
          d'insertion sont recalculés à chaque affichage.
        </p>
      </header>

      <Tabs defaultValue="sell">
        <TabsList>
          <TabsTrigger value="sell">Vendre</TabsTrigger>
          <TabsTrigger value="opportunities">Demandes reçues</TabsTrigger>
          <TabsTrigger value="buy">Acheter</TabsTrigger>
        </TabsList>

        <TabsContent value="sell" className="space-y-6 pt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <OwnershipCard />
            <TaxProfileCard />
          </div>
          <InventoryTable />
        </TabsContent>

        <TabsContent value="opportunities" className="pt-6">
          <OpportunitiesTab />
        </TabsContent>

        <TabsContent value="buy" className="pt-6">
          <BuyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MarketplaceModule;
