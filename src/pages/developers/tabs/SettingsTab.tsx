import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export default function SettingsTab() {
  const { user, signOut } = useAuth();
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (newPwd.length < 8) return toast.error("Min. 8 caractères");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Mot de passe mis à jour");
    setNewPwd("");
  };

  return (
    <div className="space-y-10 max-w-xl">
      <section>
        <h2 className="text-lg font-medium mb-4">Compte</h2>
        <div className="border border-border rounded p-4 space-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Email</div>
            <div>{user?.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ID utilisateur</div>
            <code className="text-xs">{user?.id}</code>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Mot de passe</h2>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            className="flex-1 h-10 px-3 rounded border border-border bg-background text-sm"
          />
          <button
            onClick={changePassword}
            disabled={saving}
            className="px-4 text-sm border border-foreground rounded hover:bg-foreground hover:text-background disabled:opacity-50"
          >
            Mettre à jour
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4">Session</h2>
        <button onClick={signOut} className="px-4 py-2 text-sm border border-border rounded hover:border-foreground">
          Se déconnecter
        </button>
      </section>
    </div>
  );
}
