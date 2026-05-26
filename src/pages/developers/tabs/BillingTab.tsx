import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";

type Tx = {
  id: string;
  type: "credit" | "debit" | "refund" | "adjustment";
  amount_cents: number;
  balance_after_cents: number;
  source: string;
  description: string | null;
  created_at: string;
};

const PRESETS = [
  { priceId: "topup_20", label: "20 €", cents: 2000, jobs: 200 },
  { priceId: "topup_50", label: "50 €", cents: 5000, jobs: 500 },
  { priceId: "topup_100", label: "100 €", cents: 10000, jobs: 1000 },
  { priceId: "topup_250", label: "250 €", cents: 25000, jobs: 2500 },
];

const PRICE_PER_JOB_CENTS = 10;
const fmt = (cents: number) => `${(cents / 100).toFixed(2)} €`;

export default function BillingTab() {
  const [balance, setBalance] = useState<number>(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("30");
  const [loading, setLoading] = useState(true);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [params, setParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    setUserId(u.user.id);
    setEmail(u.user.email || "");
    const [{ data: w }, { data: t }] = await Promise.all([
      supabase.from("dev_wallets").select("balance_cents").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("dev_wallet_transactions").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    setBalance(w?.balance_cents ?? 0);
    setTxs((t as Tx[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Retour de checkout — refresh + toast
  useEffect(() => {
    if (params.get("checkout") === "success") {
      toast.success("Paiement reçu. Le solde sera mis à jour dans quelques secondes.");
      const t = setTimeout(load, 4000);
      const t2 = setTimeout(load, 12000);
      params.delete("checkout");
      setParams(params, { replace: true });
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [params]);

  const buy = async (priceId: string, quantity = 1) => {
    if (!userId) return toast.error("Connexion requise");
    try {
      await openCheckout({
        priceId,
        quantity,
        customerEmail: email,
        customData: { userId },
      });
    } catch (e: any) {
      toast.error(e.message || "Échec ouverture checkout");
    }
  };

  const buyCustom = () => {
    const eur = parseFloat(customAmount.replace(",", "."));
    if (!isFinite(eur) || eur < 5) return toast.error("Montant minimum : 5 €");
    if (eur > 10000) return toast.error("Montant maximum : 10 000 €");
    // price topup_custom_eur = 1 € l'unité, quantity = nb d'euros
    buy("topup_custom_eur", Math.round(eur));
  };

  const isSandbox = getPaddleEnvironment() === "sandbox";
  const jobsRemaining = Math.floor(balance / PRICE_PER_JOB_CENTS);

  return (
    <div className="space-y-10 max-w-4xl">
      {isSandbox && (
        <div className="border border-border rounded px-4 py-2.5 text-sm text-muted-foreground">
          Mode test : utilise une carte de test Paddle (ex. <code className="text-foreground">4242 4242 4242 4242</code>) — aucun débit réel.
        </div>
      )}

      {/* Solde */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Solde</div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="text-5xl font-light tabular-nums">{fmt(balance)}</div>
          <div className="text-sm text-muted-foreground">
            ≈ <span className="text-foreground font-medium">{jobsRemaining.toLocaleString("fr-FR")}</span> jobs restants
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          Pay-as-you-go : <span className="text-foreground">0,10 €/job</span>. Le solde est débité quand un job est créé. Aucun abonnement, aucune carte stockée.
        </p>
      </section>

      {/* Recharge */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Recharger</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {PRESETS.map(p => (
            <button
              key={p.priceId}
              onClick={() => buy(p.priceId)}
              disabled={checkoutLoading || !userId}
              className="border border-border rounded-lg p-4 text-left hover:border-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-2xl font-light">{p.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{p.jobs.toLocaleString("fr-FR")} jobs</div>
            </button>
          ))}
        </div>

        <div className="border border-border rounded-lg p-4">
          <div className="text-sm font-medium mb-2">Montant personnalisé</div>
          <div className="text-xs text-muted-foreground mb-3">Min. 5 € — Max. 10 000 € — 1 € = 10 jobs</div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <input
                type="number"
                min={5}
                max={10000}
                step={1}
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                className="bg-transparent border border-border rounded px-3 py-2 pr-10 w-32 tabular-nums focus:outline-none focus:border-foreground"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
            </div>
            <button
              onClick={buyCustom}
              disabled={checkoutLoading || !userId}
              className="border border-border rounded px-4 py-2 text-sm hover:border-foreground transition-colors disabled:opacity-50"
            >
              {checkoutLoading ? "Ouverture…" : "Recharger"}
            </button>
          </div>
        </div>
      </section>

      {/* Historique */}
      <section>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Historique (30 dernières opérations)</div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : txs.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">
            Aucune opération pour le moment.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-normal">Date</th>
                  <th className="px-4 py-2.5 font-normal">Type</th>
                  <th className="px-4 py-2.5 font-normal">Description</th>
                  <th className="px-4 py-2.5 font-normal text-right">Montant</th>
                  <th className="px-4 py-2.5 font-normal text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => {
                  const isCredit = tx.type === "credit" || tx.type === "refund";
                  return (
                    <tr key={tx.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {new Date(tx.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-2.5">{tx.type === "credit" ? "Recharge" : tx.type === "debit" ? "Job" : tx.type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{tx.description || "—"}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums ${isCredit ? "text-foreground" : "text-muted-foreground"}`}>
                        {isCredit ? "+" : "−"}{fmt(tx.amount_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(tx.balance_after_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
