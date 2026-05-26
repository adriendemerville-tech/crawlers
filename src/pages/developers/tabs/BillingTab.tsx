export default function BillingTab() {
  return (
    <div className="max-w-2xl">
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <h2 className="text-xl font-light mb-2">Facturation Stripe</h2>
        <p className="text-sm text-muted-foreground mb-6">
          La facturation pay-as-you-go arrive au Sprint 3 :<br />
          metered billing Stripe, méthode de paiement, factures PDF, hard cap mensuel.
        </p>
        <div className="inline-block text-xs px-3 py-1 border border-border rounded text-muted-foreground">
          Pour l'instant : 100 jobs/mois offerts, pas de carte requise.
        </div>
      </div>
    </div>
  );
}
