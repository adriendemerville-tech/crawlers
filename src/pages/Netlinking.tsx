import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Link2, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Offer = {
  provider_slug: string;
  provider_offer_id: string;
  publisher_domain: string;
  language: string;
  topic_match: number;
  metrics: { dr?: number; tf?: number; monthly_traffic?: number };
  cost_ht_cents: number;
  commission_cents: number;
  total_ht_cents: number;
  currency: string;
  turnaround_days?: number;
};

const eur = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function Netlinking() {
  const [topic, setTopic] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [anchor, setAnchor] = useState("");
  const [minDr, setMinDr] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["netlinking-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("netlinking_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const runSearch = async () => {
    if (!topic.trim()) {
      toast({ title: "Renseigne un sujet", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("netlinking-search", {
        body: {
          topic,
          target_url: targetUrl || undefined,
          min_dr: minDr ? Number(minDr) : undefined,
          budget_max_cents: budgetMax ? Number(budgetMax) * 100 : undefined,
          language: "fr",
        },
      });
      if (error) throw error;
      setOffers(data?.offers ?? []);
      if (!data?.offers?.length) {
        toast({ title: "Aucune offre trouvée", description: "Ajuste les critères ou vérifie que les clés provider sont configurées." });
      }
    } catch (err: any) {
      toast({ title: "Erreur recherche", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const orderMutation = useMutation({
    mutationFn: async (offer: Offer) => {
      if (!targetUrl || !anchor) {
        throw new Error("Renseigne l'URL cible et le texte d'ancre");
      }
      const { data, error } = await supabase.functions.invoke("netlinking-order", {
        body: {
          provider_slug: offer.provider_slug,
          provider_offer_id: offer.provider_offer_id,
          target_url: targetUrl,
          anchor_text: anchor,
          topic,
          publisher_domain: offer.publisher_domain,
          publisher_metrics: offer.metrics,
          cost_ht_cents: offer.cost_ht_cents,
          commission_cents: offer.commission_cents,
          total_ht_cents: offer.total_ht_cents,
          currency: offer.currency,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Commande passée", description: "Le lien est en cours de placement." });
      qc.invalidateQueries({ queryKey: ["netlinking-orders"] });
    },
    onError: (err: any) => {
      toast({ title: "Commande refusée", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <Helmet>
        <title>Netlinking multi-provider — Crawlers</title>
        <meta name="description" content="Recherche et commande de backlinks via Accesslink.ai, Rocketlinks et Getfluence. Commission Crawlers de 10%." />
      </Helmet>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Link2 className="h-8 w-8 text-primary" />
          Netlinking
        </h1>
        <p className="text-muted-foreground mt-2">
          Renforce l'autorité de tes pages via 3 marketplaces de backlinks. Commission Crawlers de 10% sur chaque commande, débitée du wallet développeur.
        </p>
      </div>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search">Recherche d'opportunités</TabsTrigger>
          <TabsTrigger value="orders">Mes commandes</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="topic">Sujet / thématique *</Label>
                <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex. audit SEO IA" />
              </div>
              <div>
                <Label htmlFor="target">URL cible *</Label>
                <Input id="target" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://crawlers.fr/…" />
              </div>
              <div>
                <Label htmlFor="anchor">Ancre du lien *</Label>
                <Input id="anchor" value={anchor} onChange={(e) => setAnchor(e.target.value)} placeholder="outil audit SEO GEO" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="dr">DR min</Label>
                  <Input id="dr" type="number" value={minDr} onChange={(e) => setMinDr(e.target.value)} placeholder="30" />
                </div>
                <div>
                  <Label htmlFor="budget">Budget max (€)</Label>
                  <Input id="budget" type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="300" />
                </div>
              </div>
            </div>
            <Button onClick={runSearch} disabled={loading} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Rechercher
            </Button>
          </Card>

          {offers.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">{offers.length} offre(s) trouvée(s)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="p-2">Éditeur</th>
                      <th className="p-2">Provider</th>
                      <th className="p-2">DR</th>
                      <th className="p-2">Trafic</th>
                      <th className="p-2">Prix HT</th>
                      <th className="p-2">Commission</th>
                      <th className="p-2">Total</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={`${o.provider_slug}-${o.provider_offer_id}`} className="border-b border-border/50">
                        <td className="p-2 font-medium">{o.publisher_domain}</td>
                        <td className="p-2"><Badge variant="outline">{o.provider_slug}</Badge></td>
                        <td className="p-2">{o.metrics.dr ?? "–"}</td>
                        <td className="p-2">{o.metrics.monthly_traffic?.toLocaleString("fr-FR") ?? "–"}</td>
                        <td className="p-2">{eur(o.cost_ht_cents)}</td>
                        <td className="p-2 text-muted-foreground">{eur(o.commission_cents)}</td>
                        <td className="p-2 font-semibold">{eur(o.total_ht_cents)}</td>
                        <td className="p-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => orderMutation.mutate(o)}
                            disabled={orderMutation.isPending}
                          >
                            Commander
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-6">
            {ordersQuery.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : !ordersQuery.data?.length ? (
              <p className="text-muted-foreground">Aucune commande pour le moment.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border">
                      <th className="p-2">Date</th>
                      <th className="p-2">Éditeur</th>
                      <th className="p-2">Ancre</th>
                      <th className="p-2">Provider</th>
                      <th className="p-2">Total</th>
                      <th className="p-2">Statut</th>
                      <th className="p-2">Lien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersQuery.data.map((o: any) => (
                      <tr key={o.id} className="border-b border-border/50">
                        <td className="p-2">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                        <td className="p-2">{o.publisher_domain}</td>
                        <td className="p-2 max-w-[200px] truncate">{o.anchor_text}</td>
                        <td className="p-2"><Badge variant="outline">{o.provider_slug}</Badge></td>
                        <td className="p-2">{eur(o.total_ht_cents)}</td>
                        <td className="p-2"><Badge>{o.status}</Badge></td>
                        <td className="p-2">
                          {o.live_url ? (
                            <a href={o.live_url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                              Voir <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
