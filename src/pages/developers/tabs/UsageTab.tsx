import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UsageRow {
  user_id: string;
  api: string;
  feature: string;
  day: string;
  total: number;
  succeeded: number;
  failed: number;
}

const API_LABELS: Record<string, string> = {
  crawlers: "Crawlers",
  parmenion: "Parménion",
  marina: "Marina",
};

export default function UsageTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterApi, setFilterApi] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("developer_usage_daily" as any)
        .select("*")
        .eq("user_id", user.id)
        .gte("day", since)
        .order("day", { ascending: false })
        .limit(2000);
      setRows(((data as unknown) as UsageRow[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = filterApi === "all" ? rows : rows.filter(r => r.api === filterApi);
  const total = filtered.reduce((s, r) => s + r.total, 0);
  const succeeded = filtered.reduce((s, r) => s + r.succeeded, 0);
  const failed = filtered.reduce((s, r) => s + r.failed, 0);

  // Agrégation par jour pour le graphe
  const byDay = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.day] = (acc[r.day] || 0) + r.total;
    return acc;
  }, {});
  const days = Object.keys(byDay).sort();
  const max = Math.max(...Object.values(byDay), 1);

  // Top features
  const byFeature = filtered.reduce<Record<string, { api: string; total: number; succeeded: number; failed: number }>>((acc, r) => {
    const key = `${r.api}::${r.feature}`;
    if (!acc[key]) acc[key] = { api: r.api, total: 0, succeeded: 0, failed: 0 };
    acc[key].total += r.total;
    acc[key].succeeded += r.succeeded;
    acc[key].failed += r.failed;
    return acc;
  }, {});
  const topFeatures = Object.entries(byFeature).sort((a, b) => b[1].total - a[1].total).slice(0, 15);

  // Par API
  const byApi = filtered.reduce<Record<string, number>>((acc, r) => {
    acc[r.api] = (acc[r.api] || 0) + r.total;
    return acc;
  }, {});

  const billable = Math.max(0, total - 100);
  const cost = (billable * 0.05).toFixed(2);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtre :</span>
        <div className="flex gap-1">
          {["all", "crawlers", "parmenion", "marina"].map(a => (
            <button
              key={a}
              onClick={() => setFilterApi(a)}
              className={`h-8 px-3 text-xs rounded border ${
                filterApi === a ? "border-foreground" : "border-border text-muted-foreground"
              } hover:bg-foreground/5`}
            >
              {a === "all" ? "Toutes" : API_LABELS[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Jobs (30j)</div>
          <div className="text-3xl font-light">{loading ? "—" : total}</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Succès</div>
          <div className="text-3xl font-light text-[hsl(48_95%_55%)]">{loading ? "—" : succeeded}</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Échecs</div>
          <div className="text-3xl font-light">{loading ? "—" : failed}</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Coût estimé</div>
          <div className="text-3xl font-light">~{cost} €</div>
          <div className="text-[10px] text-muted-foreground mt-1">Au-delà des 100 jobs gratuits</div>
        </div>
      </div>

      {Object.keys(byApi).length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Répartition par API</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {Object.entries(byApi).map(([api, count]) => (
              <div key={api} className="border border-border rounded p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{API_LABELS[api] || api}</div>
                <div className="text-2xl font-light mt-1">{count}</div>
                <div className="text-xs text-muted-foreground">jobs</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium mb-4">Activité (30 derniers jours)</h2>
        {days.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucune activité.
          </div>
        ) : (
          <div className="border border-border rounded p-4">
            <div className="flex items-end gap-1 h-32">
              {days.map(d => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1 group" title={`${d} : ${byDay[d]} jobs`}>
                  <div
                    className="w-full bg-foreground/20 group-hover:bg-foreground/40 transition-colors rounded-t"
                    style={{ height: `${(byDay[d] / max) * 100}%` }}
                  />
                  <span className="text-[9px] text-muted-foreground">{d.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Top features consommées</h2>
        {topFeatures.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucun appel.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <span>API</span>
              <span>Feature</span>
              <span className="text-right">Total</span>
              <span className="text-right">OK</span>
              <span className="text-right">Échec</span>
            </div>
            {topFeatures.map(([key, s]) => (
              <div key={key} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm border-t border-border first:border-t-0">
                <span className="text-xs text-muted-foreground uppercase">{s.api}</span>
                <code className="text-xs">{key.split("::")[1]}</code>
                <span className="text-right">{s.total}</span>
                <span className="text-right text-[hsl(48_95%_55%)]">{s.succeeded}</span>
                <span className="text-right text-muted-foreground">{s.failed}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
