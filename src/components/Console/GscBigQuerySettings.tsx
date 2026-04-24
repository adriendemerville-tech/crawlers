/**
 * GSC BigQuery Settings — per-site configuration form.
 *
 * Allows site owner to point Crawlers at their GCP project + GSC bulk export dataset.
 * Once configured, Crawlers can run unsampled queries (longtail, cannibalization, etc.).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface GscBigQueryConfig {
  id?: string;
  site_id: string;
  gcp_project_id: string;
  dataset_id: string;
  table_prefix: string;
  timezone: string;
  enabled: boolean;
  last_verified_at?: string | null;
  last_verification_status?: string | null;
  last_verification_error?: string | null;
}

interface Props {
  siteId: string;
}

const DEFAULT_CONFIG: Omit<GscBigQueryConfig, 'site_id'> = {
  gcp_project_id: '',
  dataset_id: '',
  table_prefix: 'searchdata_site_impression',
  timezone: 'UTC',
  enabled: true,
};

export function GscBigQuerySettings({ siteId }: Props) {
  const [config, setConfig] = useState<GscBigQueryConfig>({ site_id: siteId, ...DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('gsc_bigquery_config')
        .select('*')
        .eq('site_id', siteId)
        .maybeSingle();
      if (!active) return;
      if (data) setConfig(data as GscBigQueryConfig);
      else setConfig({ site_id: siteId, ...DEFAULT_CONFIG });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [siteId]);

  const handleSave = async () => {
    if (!config.gcp_project_id || !config.dataset_id) {
      toast.error('Project ID GCP et Dataset ID sont requis');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        site_id: siteId,
        gcp_project_id: config.gcp_project_id.trim(),
        dataset_id: config.dataset_id.trim(),
        table_prefix: config.table_prefix.trim() || 'searchdata_site_impression',
        timezone: config.timezone || 'UTC',
        enabled: config.enabled,
      };
      const { error } = await supabase
        .from('gsc_bigquery_config')
        .upsert(payload, { onConflict: 'site_id' });
      if (error) throw error;
      toast.success('Configuration enregistrée');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Échec de l'enregistrement : ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-bigquery-query', {
        body: { action: 'verify', site_id: siteId },
      });
      if (error) throw error;
      if (data?.ok) {
        toast.success(`Connexion OK — ${data.tablesFound} table(s) trouvée(s)`);
      } else {
        toast.error(`Échec : ${data?.error || 'dataset introuvable'}`);
      }
      // Refresh config to pick up last_verified_at
      const { data: refreshed } = await supabase
        .from('gsc_bigquery_config')
        .select('*')
        .eq('site_id', siteId)
        .maybeSingle();
      if (refreshed) setConfig(refreshed as GscBigQueryConfig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Vérification échouée : ${msg}`);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">GSC BigQuery Export</CardTitle>
            <CardDescription>
              Connectez votre export Search Console BigQuery pour débloquer la longue traîne sans sampling
              (cannibalisation, requêtes &lt; 1000 affichées, historique illimité).
            </CardDescription>
          </div>
          {config.last_verification_status === 'ok' && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Vérifié
            </Badge>
          )}
          {config.last_verification_status === 'error' && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" /> Erreur
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Pré-requis côté Google :</p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>Activez le bulk export depuis Search Console → Paramètres → Exports en bloc.</li>
            <li>Choisissez un projet GCP avec facturation activée.</li>
            <li>Donnez à <code className="rounded bg-background px-1">crawlers-bq-reader@…</code> le rôle <code className="rounded bg-background px-1">BigQuery Data Viewer</code> sur le dataset (l'email exact vous est fourni à l'activation).</li>
          </ol>
          <a
            href="https://support.google.com/webmasters/answer/12918484"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 underline"
          >
            Documentation Google <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gcp_project_id">GCP Project ID</Label>
            <Input
              id="gcp_project_id"
              value={config.gcp_project_id}
              onChange={(e) => setConfig({ ...config, gcp_project_id: e.target.value })}
              placeholder="my-gcp-project-12345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dataset_id">Dataset ID</Label>
            <Input
              id="dataset_id"
              value={config.dataset_id}
              onChange={(e) => setConfig({ ...config, dataset_id: e.target.value })}
              placeholder="searchconsole"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="table_prefix">Préfixe de table</Label>
            <Input
              id="table_prefix"
              value={config.table_prefix}
              onChange={(e) => setConfig({ ...config, table_prefix: e.target.value })}
              placeholder="searchdata_site_impression"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Fuseau horaire</Label>
            <Input
              id="timezone"
              value={config.timezone}
              onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
              placeholder="UTC"
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label htmlFor="enabled" className="text-sm font-medium">Activé</Label>
            <p className="text-xs text-muted-foreground">Désactiver coupe l'accès BQ pour ce site (config conservée).</p>
          </div>
          <Switch
            id="enabled"
            checked={config.enabled}
            onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
          />
        </div>

        {config.last_verification_error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {config.last_verification_error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
          <Button variant="outline" onClick={handleVerify} disabled={verifying || !config.id}>
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Tester la connexion
          </Button>
          {config.last_verified_at && (
            <span className="ml-auto self-center text-xs text-muted-foreground">
              Dernière vérif. : {new Date(config.last_verified_at).toLocaleString('fr-FR')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
