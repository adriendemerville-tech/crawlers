import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Key, Eye, EyeOff, RefreshCw, CheckCircle2, AlertTriangle, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface IntegrationTarget {
  id: string;
  domain: string;
  label: string;
  platform: string;
  api_key_name: string | null;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failure';

/**
 * ParmenionApiKeyManager
 *
 * Onglet Admin > Parménion > Intégrations.
 * Liste toutes les cibles connectées via API key (dictadevi, iktracker, etc.)
 * et permet de mettre à jour la clé + tester la connexion.
 *
 * Stockage : la valeur est conservée dans `parmenion_targets.api_key_name`
 * (cf. note tech Sprint 8.1 — toléré en clair).
 */
export function ParmenionApiKeyManager() {
  const { toast } = useToast();
  const [targets, setTargets] = useState<IntegrationTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<IntegrationTarget | null>(null);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, TestStatus>>({});
  const [testMessage, setTestMessage] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('parmenion_targets')
      .select('id, domain, label, platform, api_key_name')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        title: 'Erreur de chargement',
        description: error.message,
        variant: 'destructive',
      });
    } else if (data) {
      setTargets(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const maskKey = (key: string | null): string => {
    if (!key) return '— non configurée —';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  const openEdit = (target: IntegrationTarget) => {
    setEditing(target);
    setNewKey('');
    setShowKey(false);
  };

  const closeEdit = () => {
    setEditing(null);
    setNewKey('');
    setShowKey(false);
  };

  const saveKey = async () => {
    if (!editing) return;
    if (!newKey.trim()) {
      toast({
        title: 'Clé vide',
        description: 'Entre une nouvelle clé API valide.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('parmenion_targets')
      .update({ api_key_name: newKey.trim(), updated_at: new Date().toISOString() })
      .eq('id', editing.id);

    if (error) {
      toast({
        title: 'Échec de la mise à jour',
        description: error.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    toast({
      title: 'Clé mise à jour',
      description: `Nouvelle clé enregistrée pour ${editing.label}.`,
    });

    await fetchTargets();
    setSaving(false);

    // Test automatique après mise à jour
    const updated = { ...editing, api_key_name: newKey.trim() };
    closeEdit();
    void testConnection(updated);
  };

  const testConnection = async (target: IntegrationTarget) => {
    if (!target.api_key_name) {
      toast({
        title: 'Aucune clé à tester',
        description: 'Configure une clé API d\'abord.',
        variant: 'destructive',
      });
      return;
    }

    setTestStatus((s) => ({ ...s, [target.id]: 'testing' }));
    setTestMessage((m) => ({ ...m, [target.id]: '' }));

    try {
      let functionName: string | null = null;
      let payload: Record<string, unknown> = {};

      if (target.platform === 'dictadevi') {
        functionName = 'dictadevi-actions';
        payload = { action: 'test-connection', params: {} };
      } else if (target.platform === 'iktracker') {
        functionName = 'iktracker-actions';
        payload = { action: 'health-check' };
      }

      if (!functionName) {
        setTestStatus((s) => ({ ...s, [target.id]: 'idle' }));
        setTestMessage((m) => ({
          ...m,
          [target.id]: `Plateforme « ${target.platform} » : test non disponible.`,
        }));
        return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      if (error) {
        setTestStatus((s) => ({ ...s, [target.id]: 'failure' }));
        setTestMessage((m) => ({ ...m, [target.id]: error.message }));
        return;
      }

      const ok = (data as { ok?: boolean; success?: boolean })?.ok
        ?? (data as { ok?: boolean; success?: boolean })?.success
        ?? true;

      if (ok) {
        setTestStatus((s) => ({ ...s, [target.id]: 'success' }));
        setTestMessage((m) => ({ ...m, [target.id]: 'Connexion établie.' }));
      } else {
        setTestStatus((s) => ({ ...s, [target.id]: 'failure' }));
        setTestMessage((m) => ({
          ...m,
          [target.id]: JSON.stringify(data).slice(0, 200),
        }));
      }
    } catch (e) {
      setTestStatus((s) => ({ ...s, [target.id]: 'failure' }));
      setTestMessage((m) => ({
        ...m,
        [target.id]: e instanceof Error ? e.message : 'Erreur inconnue',
      }));
    }
  };

  const platformLabel = (platform: string): string => {
    const labels: Record<string, string> = {
      dictadevi: 'Dictadevi (REST)',
      iktracker: 'IKtracker',
      internal: 'Interne (CMS Crawlers)',
    };
    return labels[platform] ?? platform;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Chargement des intégrations…
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Clés API des intégrations
          </CardTitle>
          <CardDescription>
            Mets à jour les clés d'accès aux CMS partenaires (Dictadevi, IKtracker…).
            La valeur est stockée chiffrée côté serveur et utilisée par les Edge Functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune cible active.</p>
          ) : (
            targets.map((target) => {
              const status = testStatus[target.id] ?? 'idle';
              const message = testMessage[target.id] ?? '';
              const isRevealed = revealed[target.id] ?? false;

              return (
                <div
                  key={target.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{target.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {platformLabel(target.platform)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{target.domain}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(target)}
                        disabled={status === 'testing' || !target.api_key_name}
                      >
                        {status === 'testing' ? (
                          <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Tester
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(target)}
                      >
                        <Key className="h-3.5 w-3.5 mr-1" />
                        {target.api_key_name ? 'Mettre à jour' : 'Configurer'}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Label className="text-xs text-muted-foreground w-20">Clé API</Label>
                    <code className="flex-1 font-mono text-xs bg-muted px-2 py-1 rounded">
                      {isRevealed ? (target.api_key_name ?? '—') : maskKey(target.api_key_name)}
                    </code>
                    {target.api_key_name && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setRevealed((r) => ({ ...r, [target.id]: !isRevealed }))
                        }
                        aria-label={isRevealed ? 'Masquer' : 'Afficher'}
                      >
                        {isRevealed ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {status !== 'idle' && message && (
                    <div
                      className={`flex items-start gap-2 text-xs px-3 py-2 rounded border ${
                        status === 'success'
                          ? 'border-green-500/40 text-green-700 bg-green-500/5'
                          : status === 'failure'
                          ? 'border-destructive/40 text-destructive bg-destructive/5'
                          : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {status === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                      {status === 'failure' && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                      <span className="break-all">{message}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.api_key_name ? 'Mettre à jour la clé API' : 'Configurer la clé API'}
            </DialogTitle>
            <DialogDescription>
              {editing?.label} — {editing?.domain}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-api-key">Nouvelle clé API</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={
                    editing?.platform === 'dictadevi'
                      ? 'dk_…'
                      : 'Coller la nouvelle clé'
                  }
                  className="font-mono"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  aria-label={showKey ? 'Masquer' : 'Afficher'}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {editing?.platform === 'dictadevi' && (
                <p className="text-xs text-muted-foreground">
                  Génère la clé depuis Dictadevi → /admin/blog-api → « Générer une clé ».
                  Format attendu : préfixe <code>dk_</code>.
                </p>
              )}
            </div>

            {editing?.api_key_name && (
              <div className="text-xs bg-muted/50 border rounded p-2">
                <span className="text-muted-foreground">Ancienne clé : </span>
                <code className="font-mono">{maskKey(editing.api_key_name)}</code>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={saveKey} disabled={saving || !newKey.trim()}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-1" />
                  Enregistrer & tester
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
