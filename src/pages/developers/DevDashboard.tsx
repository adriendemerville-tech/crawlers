import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DevLayout from "./DevLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ApiStat {
  name: string;
  prefix: string;
  jobs24h: number;
  hasKey: boolean;
  docs: string;
}

export default function DevDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ApiStat[]>([
    { name: "Crawlers API", prefix: "crw_live_", jobs24h: 0, hasKey: false, docs: "/docs/api/crawlers" },
    { name: "Marina API", prefix: "mk_live_", jobs24h: 0, hasKey: false, docs: "/docs/api/marina" },
    { name: "Parménion API", prefix: "prm_live_", jobs24h: 0, hasKey: false, docs: "/docs/api/parmenion" },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [crwKeys, crwJobs, mkKeys, prmTargets] = await Promise.all([
        supabase.from("crawlers_api_keys").select("id", { count: "exact", head: true }).is("revoked_at", null),
        supabase.from("crawlers_api_jobs").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("marina_api_keys").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("parmenion_targets").select("id", { count: "exact", head: true }).eq("created_by_user_id", user.id),
      ]);
      setStats([
        { name: "Crawlers API", prefix: "crw_live_", jobs24h: crwJobs.count || 0, hasKey: (crwKeys.count || 0) > 0, docs: "/docs/api/crawlers" },
        { name: "Marina API", prefix: "mk_live_", jobs24h: 0, hasKey: (mkKeys.count || 0) > 0, docs: "/docs/api/marina" },
        { name: "Parménion API", prefix: "prm_live_", jobs24h: 0, hasKey: (prmTargets.count || 0) > 0, docs: "/docs/api/parmenion" },
      ]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <DevLayout requireAuth title="Dashboard">
      <div className="mb-10">
        <h1 className="text-3xl font-light tracking-tight mb-2">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de tes 3 APIs.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {stats.map(s => (
          <div key={s.name} className="border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-sm">{s.name}</h3>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${s.hasKey ? "border-[hsl(48_95%_55%)] text-[hsl(48_95%_55%)]" : "border-border text-muted-foreground"}`}>
                {s.hasKey ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="text-3xl font-light mb-1">{loading ? "—" : s.jobs24h}</div>
            <div className="text-xs text-muted-foreground mb-4">jobs (24h)</div>
            <div className="flex gap-3 text-xs">
              <Link to="/developers/profile?tab=cles-api" className="border-b border-foreground hover:opacity-70">
                {s.hasKey ? "Gérer la clé" : "Créer une clé"}
              </Link>
              <Link to={s.docs} className="text-muted-foreground hover:text-foreground">Docs</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 border border-border rounded-lg p-6">
        <h3 className="text-sm font-medium mb-3">Quickstart</h3>
        <pre className="text-xs bg-muted/40 border border-border rounded p-4 overflow-x-auto font-mono leading-relaxed">
{`# 1. Génère une clé dans /developers/profile?tab=cles-api
# 2. Premier appel :

curl -X POST https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/crawlers-api/v1/jobs \\
  -H "Authorization: Bearer crw_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"feature":"geo_score","input":{"url":"https://exemple.fr"}}'

# 3. Poll le résultat :
curl https://tutlimtasnjabdfhpewu.supabase.co/functions/v1/crawlers-api/v1/jobs/{id} \\
  -H "Authorization: Bearer crw_live_..."`}
        </pre>
      </div>
    </DevLayout>
  );
}
