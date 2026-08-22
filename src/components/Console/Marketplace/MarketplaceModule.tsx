import { InventoryTable } from './InventoryTable';
import { OwnershipCard } from './OwnershipCard';
import { TaxProfileCard } from './TaxProfileCard';
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

/**
 * Place d'échange — vue vendeur (lot L1a).
 * L'achat, l'appariement et le Studio arrivent aux lots L2 et L3.
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

      <div className="grid gap-6 lg:grid-cols-2">
        <OwnershipCard />
        <TaxProfileCard />
      </div>

      <InventoryTable />
    </div>
  );
}

export default MarketplaceModule;
