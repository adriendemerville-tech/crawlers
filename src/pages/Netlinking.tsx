// Utilitaires Tailwind des espaces applicatifs (hors feuille critique publique).
import { CompetitorMatrixCta } from '@/components/seo/CompetitorMatrixCta';
import { Header } from "@/components/Header";
import "@/styles.app.css";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Link2, ExternalLink, Search, X, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { InternalInventorySection } from "@/components/Console/Marketplace/InternalInventorySection";

const PROVIDERS = [
  { slug: "accesslink", label: "Accesslink.ai" },
  { slug: "rocketlinks", label: "Rocketlinks" },
  { slug: "getfluence", label: "Getfluence" },
] as const;

type ProviderSlug = (typeof PROVIDERS)[number]["slug"];

type Offer = {
  provider_slug: ProviderSlug;
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

const eur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function statusBadgeVariant(status: string) {
  switch (status) {
    case "live":
      return "secondary";
    case "pending":
    case "in_progress":
      return "outline";
    case "rejected":
    case "lost":
    case "cancelled":
      return "destructive";
    case "refunded":
      return "outline";
    default:
      return "outline";
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Brouillon",
    pending: "En attente",
    in_progress: "En cours",
    live: "En ligne",
    rejected: "Refusé",
    lost: "Lien perdu",
    cancelled: "Annulé",
    refunded: "Remboursé",
  };
  return map[status] ?? status;
}

export default function Netlinking() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [topic, setTopic] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [anchor, setAnchor] = useState("");
  const [minDr, setMinDr] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<ProviderSlug[]>(["accesslink"]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const providersQuery = useQuery({
    queryKey: ["netlinking-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("netlinking_providers")
        .select("slug,name,status,supports_search,supports_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const availability = useMemo(() => {
    const map = new Map<string, boolean>();
    (providersQuery.data ?? []).forEach((p: any) => {
      map.set(p.slug, p.status === "active" && p.supports_search === true);
    });
    return map;
  }, [providersQuery.data]);

  // Pre-fill from query params (e.g. deep-link from Stratège Cocoon)
  useEffect(() => {
    const urlTopic = searchParams.get("topic");
    const urlTarget = searchParams.get("target_url");
    const urlAnchor = searchParams.get("anchor");
    const urlProviders = searchParams.get("providers");

    if (urlTopic) setTopic(urlTopic);
    if (urlTarget) setTargetUrl(urlTarget);
    if (urlAnchor) setAnchor(urlAnchor);
    if (urlProviders) {
      const parsed = urlProviders
        .split(",")
        .map((p) => p.trim())
        .filter((p): p is ProviderSlug => PROVIDERS.some((x) => x.slug === p));
      if (parsed.length) setSelectedProviders(parsed);
    }
  }, [searchParams]);

  // Opportunités issues du diagnostic (Cocoon / Stratège) : findings d'autorité
  // off-site écrits dans le workbench avec ancres suggérées et URL cible.
  const opportunitiesQuery = useQuery({
    queryKey: ["netlinking-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("architect_workbench")
        .select("id,title,domain,target_url,severity,finding_category,payload,created_at")
        .in("finding_category", ["low_authority", "thin_backlinks", "backlink_target"])
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const applyOpportunity = (item: any) => {
    const anchors: string[] = Array.isArray(item?.payload?.suggested_anchors)
      ? item.payload.suggested_anchors
      : [];
    if (item.target_url) setTargetUrl(item.target_url);
    else if (item.domain) setTargetUrl(`https://${item.domain}`);
    if (anchors[0]) setAnchor(anchors[0]);
    const t = item?.payload?.topic ?? item?.payload?.cluster ?? item.finding_category;
    if (typeof t === "string" && t.length > 2) setTopic(t);
    toast({ title: "Opportunité chargée", description: "Vérifie l'ancre puis lance la recherche." });
  };

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
          providers: selectedProviders,
        },
      });
      if (error) throw error;
      setOffers(data?.offers ?? []);
      if (!data?.offers?.length) {
        toast({
          title: "Aucune offre trouvée",
          description: "Ajuste les critères ou vérifie que les clés provider sont configurées.",
        });
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

  const clearFilters = () => {
    setTopic("");
    setTargetUrl("");
    setAnchor("");
    setMinDr("");
    setBudgetMax("");
    setSelectedProviders(["accesslink"]);
    setOffers([]);
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = useMemo(
    () => topic || targetUrl || anchor || minDr || budgetMax || offers.length > 0,
    [topic, targetUrl, anchor, minDr, budgetMax, offers.length]
  );

  const toggleProvider = (slug: ProviderSlug) => {
    if (availability.get(slug) === false) return;
    setSelectedProviders((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
  };


  return (
    <div className="container max-w-6xl mx-auto pb-8 pt-28 px-4">
      <Header />
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Link2 className="h-8 w-8 text-primary" />
          Netlinking
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Renforce l'autorité de tes pages via les marketplaces de backlinks raccordées.
          Commission Crawlers de 10% sur chaque commande, débitée du wallet développeur.
        </p>

      </div>

      <Tabs defaultValue="search">
        <TabsList className="mb-6">
          <TabsTrigger value="search">Recherche d'opportunités</TabsTrigger>
          <TabsTrigger value="orders">Mes commandes</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          {(opportunitiesQuery.data?.length ?? 0) > 0 && (
            <Card className="p-6 space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Opportunités issues du diagnostic</h2>
                <p className="text-sm text-muted-foreground">
                  Pages identifiées comme faibles en autorité off-site par le Stratège Cocoon,
                  avec les ancres cohérentes avec ton maillage interne.
                </p>
              </div>
              <div className="space-y-2">
                {(opportunitiesQuery.data ?? []).map((item: any) => {
                  const anchors: string[] = Array.isArray(item?.payload?.suggested_anchors)
                    ? item.payload.suggested_anchors
                    : [];
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 border rounded-md p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.target_url || item.domain}
                        </p>
                        {anchors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {anchors.map((a) => (
                              <Badge key={a} variant="outline" className="text-[10px]">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => applyOpportunity(item)}>
                        Préparer la commande
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="topic">Sujet / thématique *</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex. audit SEO IA"
                />
              </div>
              <div>
                <Label htmlFor="target">URL cible *</Label>
                <Input
                  id="target"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://crawlers.fr/…"
                />
              </div>
              <div>
                <Label htmlFor="anchor">Ancre du lien *</Label>
                <Input
                  id="anchor"
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  placeholder="outil audit SEO GEO"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="dr">DR min</Label>
                  <Input
                    id="dr"
                    type="number"
                    value={minDr}
                    onChange={(e) => setMinDr(e.target.value)}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label htmlFor="budget">Budget max (€)</Label>
                  <Input
                    id="budget"
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="300"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Providers</Label>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => {
                  const unavailable = availability.get(p.slug) === false;
                  const active = !unavailable && selectedProviders.includes(p.slug);
                  return (
                    <button
                      key={p.slug}
                      type="button"
                      disabled={unavailable}
                      title={unavailable ? "Marketplace pas encore raccordée" : undefined}
                      onClick={() => toggleProvider(p.slug)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        unavailable
                          ? "border-border/60 text-muted-foreground/60 cursor-not-allowed line-through"
                          : active
                            ? "border-primary text-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                      }`}
                    >
                      {p.label}
                      {unavailable ? " — indisponible" : ""}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Seules les marketplaces réellement raccordées sont interrogeables. Module réservé aux plans Premium et plus.
              </p>
            </div>


            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={runSearch} disabled={loading} variant="outline">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Rechercher
              </Button>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              )}
            </div>

            {selectedProviders.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4" />
                Sélectionne au moins un provider.
              </div>
            )}
          </Card>

          {offers.length > 0 && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{offers.length} offre(s) trouvée(s)</h2>
                <p className="text-xs text-muted-foreground">Prix TTC hors taxes — commission Crawlers incluse</p>
              </div>
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
                        <td className="p-2">
                          <Badge variant="outline">{o.provider_slug}</Badge>
                        </td>
                        <td className="p-2">{o.metrics.dr ?? "–"}</td>
                        <td className="p-2">
                          {o.metrics.monthly_traffic?.toLocaleString("fr-FR") ?? "–"}
                        </td>
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

          <InternalInventorySection />

          {offers.length === 0 && !loading && hasActiveFilters && (
            <Card className="p-10 text-center">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Search className="h-10 w-10 text-primary/60" />
                <p className="font-medium">Aucune offre ne correspond à tes critères.</p>
                <p className="text-xs max-w-md">
                  Essaie d'élargir le sujet, de baisser le DR minimum ou d'augmenter le budget.
                  Sans clés API provider, le catalogue sera vide.
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-6">
            {ordersQuery.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : !ordersQuery.data?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                <Link2 className="h-10 w-10 mx-auto mb-3 text-primary/60" />
                <p>Aucune commande pour le moment.</p>
                <p className="text-xs mt-1">Les commandes passées apparaîtront ici avec leur statut et le lien live.</p>
              </div>
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
                        <td className="p-2">
                          <Badge variant="outline">{o.provider_slug}</Badge>
                        </td>
                        <td className="p-2">{eur(o.total_ht_cents)}</td>
                        <td className="p-2">
                          <Badge variant={statusBadgeVariant(o.status)}>{statusLabel(o.status)}</Badge>
                        </td>
                        <td className="p-2">
                          {o.live_url ? (
                            <a
                              href={o.live_url}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              Voir <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "–"
                          )}
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

      <CompetitorMatrixCta intro="Un gap de backlinks se lit mieux face au marché : comparez vos concurrents et vous sur 20 requêtes clés, dans la SERP Google et dans les réponses des IA génératives." />
    </div>

  );
}
