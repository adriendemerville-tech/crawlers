// Stripe Tax helpers — les prix doivent porter un tax_behavior explicite
// sinon Checkout refuse automatic_tax. Les tarifs affichés sont TTC → 'inclusive'.

// deno-lint-ignore no-explicit-any
type StripeLike = any;

export const AUTOMATIC_TAX_SESSION_PARAMS = {
  automatic_tax: { enabled: true },
  tax_id_collection: { enabled: true },
  customer_update: { address: "auto" as const, name: "auto" as const },
};

/**
 * Retourne un price id avec tax_behavior défini (inclusive).
 * Si le prix d'origine n'en a pas, un prix miroir est créé/réutilisé via lookup_key.
 */
export async function ensureTaxablePrice(stripe: StripeLike, priceId: string): Promise<string> {
  const price = await stripe.prices.retrieve(priceId);
  if (price.tax_behavior && price.tax_behavior !== "unspecified") return price.id;

  const lookupKey = `taxincl_${price.id}`;
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const mirrored = await stripe.prices.create({
    product: typeof price.product === "string" ? price.product : price.product.id,
    unit_amount: price.unit_amount,
    currency: price.currency,
    recurring: price.recurring
      ? { interval: price.recurring.interval, interval_count: price.recurring.interval_count }
      : undefined,
    tax_behavior: "inclusive",
    lookup_key: lookupKey,
    metadata: { ...(price.metadata || {}), mirrored_from: price.id, tax_behavior: "inclusive" },
  });
  console.log(`[stripeTax] mirrored price ${price.id} -> ${mirrored.id} (inclusive)`);
  return mirrored.id;
}
