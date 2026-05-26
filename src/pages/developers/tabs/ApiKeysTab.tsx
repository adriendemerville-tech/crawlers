import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface CrwKey { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null; }
interface MkKey { id: string; label: string; api_key: string; created_at: string; is_active: boolean; }
interface PrmTarget { id: string; domain: string; label: string; is_active: boolean; pull_token_prefix: string | null; }

export default function ApiKeysTab() {
  const { user } = useAuth();
  const [crwKeys, setCrwKeys] = useState<CrwKey[]>([]);
  const [mkKeys, setMkKeys] = useState<MkKey[]>([]);
  const [prmTargets, setPrmTargets] = useState<PrmTarget[]>([]);
  const [revealed, setRevealed] = useState<{ id: string; full: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    if (!user) return;
    const [crw, mk, prm] = await Promise.all([
      supabase.from("crawlers_api_keys").select("id, name, key_prefix, created_at, last_used_at, revoked_at").order("created_at", { ascending: false }),
      supabase.from("marina_api_keys").select("id, label, api_key, created_at, is_active").order("created_at", { ascending: false }),
      supabase.from("parmenion_targets").select("id, domain, label, is_active, pull_token_prefix").eq("created_by_user_id", user.id),
    ]);
    setCrwKeys((crw.data as CrwKey[]) || []);
    setMkKeys((mk.data as MkKey[]) || []);
    setPrmTargets((prm.data as PrmTarget[]) || []);
  };

  useEffect(() => { load(); }, [user]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  const createCrwKey = async () => {
    const name = prompt("Nom de la clé Crawlers ?", "Default");
    if (!name) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("crawlers_api_create_key", { _name: name });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    const row = (data as any[])?.[0];
    if (row) {
      setRevealed({ id: row.id, full: row.api_key });
      toast.success("Clé créée — copie-la maintenant, elle ne sera plus affichée.");
      load();
    }
  };

  const revokeCrwKey = async (id: string) => {
    if (!confirm("Révoquer cette clé ? Les appels en cours échoueront.")) return;
    const { error } = await supabase.from("crawlers_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Clé révoquée");
    load();
  };

  return (
    <div className="space-y-12">
      {/* Crawlers */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium">Crawlers API</h2>
            <p className="text-xs text-muted-foreground">Préfixe <code className="text-[hsl(280_70%_60%)]">crw_live_</code> — 18 features</p>
          </div>
          <button
            onClick={createCrwKey}
            disabled={creating}
            className="px-4 py-2 text-sm border border-foreground rounded hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
          >
            + Nouvelle clé
          </button>
        </div>

        {revealed && (
          <div className="mb-4 border border-[hsl(48_95%_55%)] rounded p-4 bg-[hsl(48_95%_55%/0.05)]">
            <div className="text-xs text-muted-foreground mb-2">Clé créée — copie-la maintenant, elle ne sera plus affichée.</div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-background border border-border rounded px-3 py-2 font-mono break-all">{revealed.full}</code>
              <button onClick={() => copy(revealed.full)} className="px-3 py-2 text-xs border border-foreground rounded hover:bg-foreground hover:text-background">Copier</button>
              <button onClick={() => setRevealed(null)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">×</button>
            </div>
          </div>
        )}

        {crwKeys.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucune clé. Crée-en une pour commencer.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            {crwKeys.map((k, i) => (
              <div key={k.id} className={`flex items-center justify-between p-4 ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}…••••••••</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Créée le {new Date(k.created_at).toLocaleDateString("fr-FR")} · Dernière utilisation : {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString("fr-FR") : "jamais"}
                  </div>
                </div>
                {k.revoked_at ? (
                  <span className="text-xs text-muted-foreground">Révoquée</span>
                ) : (
                  <button onClick={() => revokeCrwKey(k.id)} className="text-xs border border-border rounded px-3 py-1.5 hover:border-foreground">
                    Révoquer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Marina */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium">Marina API</h2>
            <p className="text-xs text-muted-foreground">Préfixe <code className="text-[hsl(280_70%_60%)]">mk_live_</code> — audits B2B</p>
          </div>
        </div>
        {mkKeys.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucune clé. Visite <a href="/marina" className="border-b border-foreground">/marina</a> pour activer Marina.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            {mkKeys.map((k, i) => (
              <div key={k.id} className={`flex items-center justify-between p-4 ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{k.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">{k.api_key.slice(0, 16)}…••••</div>
                </div>
                <button onClick={() => copy(k.api_key)} className="text-xs border border-border rounded px-3 py-1.5 hover:border-foreground">
                  Copier
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Parménion */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium">Parménion API</h2>
            <p className="text-xs text-muted-foreground">Préfixe <code className="text-[hsl(280_70%_60%)]">prm_live_</code> — pull tasks par domaine</p>
          </div>
        </div>
        {prmTargets.length === 0 ? (
          <div className="border border-dashed border-border rounded p-6 text-center text-sm text-muted-foreground">
            Aucun target. Les targets Parménion sont créés par un administrateur ou via l'onboarding Autopilote.
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            {prmTargets.map((t, i) => (
              <div key={t.id} className={`flex items-center justify-between p-4 ${i > 0 ? "border-t border-border" : ""}`}>
                <div>
                  <div className="text-sm font-medium">{t.domain}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {t.pull_token_prefix ? `${t.pull_token_prefix}…••••` : "Pas de pull token"}
                  </div>
                </div>
                <span className={`text-xs ${t.is_active ? "text-[hsl(48_95%_55%)]" : "text-muted-foreground"}`}>
                  {t.is_active ? "Actif" : "Inactif"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
