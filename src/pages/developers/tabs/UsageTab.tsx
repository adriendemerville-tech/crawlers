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
  pericles: "Périclès",
  marina: "Marina",
};

interface TokenRow {
  feature: string;
  input_tokens: number | null;
  output_tokens: number | null;
}

export default function UsageTab() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [tokenRows, setTokenRows] = useState<TokenRow[]>([]);
  const [mcpTokens, setMcpTokens] = useState<{ input: number; output: number }>({ input: 0, output: 0 });
  const [loading, setLoading] = useState(true);
  const [filterApi, setFilterApi] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const since = sinceIso.slice(0, 10);
      const [{ data }, { data: jobs }, { data: mcp }] = await Promise.all([
        supabase
          .from("developer_usage_daily" as any)
          .select("*")
          .eq("user_id", user.id)
          .gte("day", since)
          .order("day", { ascending: false })
          .limit(2000),
        supabase
          .from("crawlers_api_jobs")
          .select("feature, input_tokens, output_tokens")
          .eq("user_id", user.id)
          .gte("created_at", sinceIso)
          .limit(5000),
        supabase
          .from("mcp_call_log")
          .select("input_tokens, output_tokens")
          .eq("user_id", user.id)
          .gte("created_at", sinceIso)
          .limit(5000),
      ]);
      setRows(((data as unknown) as UsageRow[]) || []);
      setTokenRows(((jobs as unknown) as TokenRow[]) || []);
      const m = ((mcp as unknown) as TokenRow[]) || [];
      setMcpTokens({
        input: m.reduce((s, r) => s + (r.input_tokens || 0), 0),
        output: m.reduce((s, r) => s + (r.output_tokens || 0), 0),
      });
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

  // Tokens LLM consommés par les jobs API / MCP
  const tokensByFeature = tokenRows.reduce<Record<string, { input: number; output: number }>>((acc, r) => {
    const key = r.feature || "inconnu";
    if (!acc[key]) acc[key] = { input: 0, output: 0 };
    acc[key].input += r.input_tokens || 0;
    acc[key].output += r.output_tokens || 0;
    return acc;
  }, {});
  const topTokens = Object.entries(tokensByFeature)
    .filter(([, t]) => t.input + t.output > 0)
    .sort((a, b) => b[1].input + b[1].output - (a[1].input + a[1].output))
    .slice(0, 15);
  const totalIn = tokenRows.reduce((s, r) => s + (r.input_tokens || 0), 0);
  const totalOut = tokenRows.reduce((s, r) => s + (r.output_tokens || 0), 0);
  const fmt = (n: number) => n.toLocaleString("fr-FR");


  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtre :</span>
        <div className="flex gap-1">
          {["all", "crawlers", "pericles", "marina"].map(a => (
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
        <h2 className="text-lg font-medium mb-4">Tokens LLM consommés (30 jours)</h2>
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="border border-border rounded p-5">
            <div className="text-xs text-muted-foreground">Tokens entrée</div>
            <div className="text-2xl font-light">{loading ? "—" : fmt(totalIn)}</div>
          </div>
          <div className="border border-border rounded p-5">
            <div className="text-xs text-muted-foreground">Tokens sortie</div>
            <div className="text-2xl font-light">{loading ? "—" : fmt(totalOut)}</div>
          </div>
          <div className="border border-border rounded p-5">
            <div className="text-xs text-muted-foreground">Dont via MCP</div>
            <div className="text-2xl font-light">{loading ? "—" : fmt(mcpTokens.input + mcpTokens.output)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {fmt(mcpTokens.input)} entrée · {fmt(mcpTokens.output)} sortie
            </div>
          </div>
        </div>
        {topTokens.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucun appel de modèle mesuré sur la période.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <span>Feature</span>
              <span className="text-right">Entrée</span>
              <span className="text-right">Sortie</span>
              <span className="text-right">Total</span>
            </div>
            {topTokens.map(([feature, t]) => (
              <div key={feature} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm border-t border-border first:border-t-0">
                <code className="text-xs">{feature}</code>
                <span className="text-right">{fmt(t.input)}</span>
                <span className="text-right">{fmt(t.output)}</span>
                <span className="text-right text-[hsl(48_95%_55%)]">{fmt(t.input + t.output)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Comptage réel des appels de modèle rattachés à chaque job. La facturation reste au job, pas au token.
        </p>
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
