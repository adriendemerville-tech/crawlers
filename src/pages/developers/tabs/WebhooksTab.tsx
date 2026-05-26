import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Trash2, Send, Copy, Check } from "lucide-react";

interface Webhook {
  id: string;
  api: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  last_ping_at: string | null;
  last_status: number | null;
  created_at: string;
}

interface Delivery {
  id: string;
  webhook_id: string;
  event: string;
  status: string;
  response_status: number | null;
  created_at: string;
}

const APIS = [
  { id: "crawlers", label: "Crawlers" },
  { id: "marina", label: "Marina (à venir)" },
  { id: "parmenion", label: "Parménion (à venir)" },
];

export default function WebhooksTab() {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [api, setApi] = useState("crawlers");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [{ data: h }, { data: d }] = await Promise.all([
      supabase.from("developer_webhooks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("webhook_deliveries").select("id, webhook_id, event, status, response_status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    setHooks((h as Webhook[]) || []);
    setDeliveries((d as Delivery[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const create = async () => {
    if (!user || !url.trim()) return;
    try {
      new URL(url);
    } catch {
      toast({ title: "URL invalide", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("developer_webhooks").insert({
      user_id: user.id, api, url: url.trim(),
    });
    setCreating(false);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    setUrl("");
    toast({ title: "Webhook créé" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce webhook ?")) return;
    await supabase.from("developer_webhooks").delete().eq("id", id);
    load();
  };

  const toggle = async (h: Webhook) => {
    await supabase.from("developer_webhooks").update({ active: !h.active }).eq("id", h.id);
    load();
  };

  const ping = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("developer-webhook-ping", { body: { webhook_id: id } });
    if (error) { toast({ title: "Échec du ping", description: error.message, variant: "destructive" }); return; }
    toast({
      title: data?.ok ? `Ping reçu (${data.status})` : `Échec ping`,
      description: data?.error || data?.body?.slice(0, 80) || `HTTP ${data?.status}`,
      variant: data?.ok ? "default" : "destructive",
    });
    load();
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-8">
      <section className="border border-border rounded p-5 space-y-3">
        <h2 className="text-lg font-medium">Nouveau webhook</h2>
        <p className="text-sm text-muted-foreground">
          Reçois un POST signé HMAC SHA-256 à chaque job complété ou échoué. Header : <code className="text-xs">X-Crawlers-Signature: sha256=...</code>
        </p>
        <div className="flex gap-2 flex-wrap">
          <select
            value={api}
            onChange={(e) => setApi(e.target.value)}
            className="h-10 px-3 rounded border border-input bg-background text-sm"
          >
            {APIS.map(a => <option key={a.id} value={a.id} disabled={a.id !== "crawlers"}>{a.label}</option>)}
          </select>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/crawlers"
            className="flex-1 min-w-[280px] h-10 px-3 rounded border border-input bg-background text-sm"
          />
          <button
            onClick={create}
            disabled={creating || !url.trim()}
            className="h-10 px-4 rounded border border-foreground text-foreground text-sm hover:bg-foreground/5 disabled:opacity-50"
          >
            {creating ? "Création…" : "Créer"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Webhooks configurés</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : hooks.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucun webhook. Ajoute-en un ci-dessus.
          </div>
        ) : (
          <div className="space-y-3">
            {hooks.map(h => (
              <div key={h.id} className="border border-border rounded p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="uppercase tracking-wider">{h.api}</span>
                      <span>•</span>
                      <span className={h.active ? "text-[hsl(48_95%_55%)]" : ""}>{h.active ? "actif" : "désactivé"}</span>
                      {h.last_status !== null && (
                        <>
                          <span>•</span>
                          <span>dernier code : {h.last_status}</span>
                        </>
                      )}
                    </div>
                    <code className="text-sm break-all">{h.url}</code>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => ping(h.id)} title="Envoyer un ping de test"
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border hover:bg-foreground/5">
                      <Send className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => toggle(h)} title={h.active ? "Désactiver" : "Activer"}
                      className="h-8 px-3 text-xs rounded border border-border hover:bg-foreground/5">
                      {h.active ? "Pause" : "Activer"}
                    </button>
                    <button onClick={() => remove(h.id)} title="Supprimer"
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-border hover:bg-foreground/5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16">Secret</span>
                  <code className="flex-1 text-xs font-mono px-2 py-1.5 rounded bg-muted/30 break-all">
                    {revealed[h.id] ? h.secret : "•".repeat(48)}
                  </code>
                  <button onClick={() => setRevealed(s => ({ ...s, [h.id]: !s[h.id] }))}
                    className="h-7 px-2 text-xs rounded border border-border hover:bg-foreground/5">
                    {revealed[h.id] ? "Cacher" : "Voir"}
                  </button>
                  <button onClick={() => copy(h.id, h.secret)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-border hover:bg-foreground/5">
                    {copied === h.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Événements : {h.events.join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Dernières livraisons</h2>
        {deliveries.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucune livraison.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <span>Événement</span>
              <span>HTTP</span>
              <span>Statut</span>
              <span>Date</span>
            </div>
            {deliveries.map(d => (
              <div key={d.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm border-t border-border first:border-t-0">
                <code className="text-xs">{d.event}</code>
                <span className="text-xs">{d.response_status ?? "—"}</span>
                <span className={`text-xs ${d.status === "delivered" ? "text-[hsl(48_95%_55%)]" : "text-muted-foreground"}`}>{d.status}</span>
                <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
