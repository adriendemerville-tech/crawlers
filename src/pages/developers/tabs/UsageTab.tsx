import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface JobRow { feature: string; status: string; created_at: string; }

export default function UsageTab() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("crawlers_api_jobs")
        .select("feature, status, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      setJobs((data as JobRow[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const byFeature = jobs.reduce<Record<string, { total: number; completed: number; failed: number }>>((acc, j) => {
    if (!acc[j.feature]) acc[j.feature] = { total: 0, completed: 0, failed: 0 };
    acc[j.feature].total++;
    if (j.status === "completed") acc[j.feature].completed++;
    if (j.status === "failed") acc[j.feature].failed++;
    return acc;
  }, {});

  const sorted = Object.entries(byFeature).sort((a, b) => b[1].total - a[1].total);
  const total = jobs.length;

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Jobs (30j)</div>
          <div className="text-3xl font-light">{loading ? "—" : total}</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Quota free</div>
          <div className="text-3xl font-light">{loading ? "—" : `${Math.min(total, 100)} / 100`}</div>
        </div>
        <div className="border border-border rounded p-5">
          <div className="text-xs text-muted-foreground">Coût estimé</div>
          <div className="text-3xl font-light">~{(Math.max(0, total - 100) * 0.05).toFixed(2)} €</div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">Consommation par feature</h2>
        {sorted.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucun appel API sur les 30 derniers jours.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
              <span>Feature</span>
              <span className="text-right">Total</span>
              <span className="text-right">OK</span>
              <span className="text-right">Échec</span>
            </div>
            {sorted.map(([feat, s]) => (
              <div key={feat} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 text-sm border-t border-border first:border-t-0">
                <code className="text-xs">{feat}</code>
                <span className="text-right">{s.total}</span>
                <span className="text-right text-[hsl(48_95%_55%)]">{s.completed}</span>
                <span className="text-right text-muted-foreground">{s.failed}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Consommation Marina et Parménion : disponible en Sprint 2 (agrégation cross-API).
      </p>
    </div>
  );
}
