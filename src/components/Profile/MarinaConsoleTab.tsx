import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Anchor, Copy, Check, ExternalLink, Coins, Loader2, Plus, Power, PowerOff, Trash2, FileText, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'en' ? en : lang === 'es' ? es : fr;

type MarinaService = 'identity' | 'digital' | 'strategy' | 'report';

interface MarinaKey {
  id: string;
  api_key: string;
  label: string;
  selected_services: string[];
  is_active: boolean;
  requests_count: number;
  created_at: string;
}

const SERVICE_META: Record<MarinaService, { fr: string; en: string; es: string; description_fr: string; description_en: string; credits: number; icon: 'data' | 'report' }> = {
  identity: {
    fr: 'Phase 1a — Identité',
    en: 'Phase 1a — Identity',
    es: 'Fase 1a — Identidad',
    description_fr: 'Scraping identité, réseaux sociaux, fondateur',
    description_en: 'Identity scraping, social networks, founder',
    credits: 1,
    icon: 'data',
  },
  digital: {
    fr: 'Phase 1b — Digital',
    en: 'Phase 1b — Digital',
    es: 'Fase 1b — Digital',
    description_fr: 'Audit technique, PageSpeed, SEO on-page',
    description_en: 'Technical audit, PageSpeed, on-page SEO',
    credits: 2,
    icon: 'data',
  },
  strategy: {
    fr: 'Phase 2 — Stratégie',
    en: 'Phase 2 — Strategy',
    es: 'Fase 2 — Estrategia',
    description_fr: 'Synthèse IA, recommandations, scoring',
    description_en: 'AI synthesis, recommendations, scoring',
    credits: 2,
    icon: 'data',
  },
  report: {
    fr: 'Rapport PDF',
    en: 'PDF Report',
    es: 'Informe PDF',
    description_fr: 'Génération du rapport mis en forme (PDF/HTML)',
    description_en: 'Formatted report generation (PDF/HTML)',
    credits: 2,
    icon: 'report',
  },
};

const DATA_SERVICES: MarinaService[] = ['identity', 'digital', 'strategy'];
const ALL_SERVICES: MarinaService[] = ['identity', 'digital', 'strategy', 'report'];

function computeBundleCost(services: MarinaService[]): number {
  return services.reduce((sum, s) => sum + (SERVICE_META[s]?.credits || 0), 0);
}

export function MarinaConsoleTab() {
  const { user } = useAuth();
  const { balance, isAgencyPro } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<MarinaKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newServices, setNewServices] = useState<MarinaService[]>([...ALL_SERVICES]);

  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  const loadKeys = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('marina_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setKeys((data as MarinaKey[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  useEffect(() => {
    if (!user) return;
    const loadJobs = async () => {
      setJobsLoading(true);
      const { data } = await supabase
        .from('async_jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('function_name', 'marina')
        .order('created_at', { ascending: false })
        .limit(20);
      setJobs(data || []);
      setJobsLoading(false);
    };
    loadJobs();
  }, [user]);

  const createKey = async () => {
    if (!user || newServices.filter(s => DATA_SERVICES.includes(s)).length === 0) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('marina_api_keys').insert({
        user_id: user.id,
        api_key: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        label: newLabel.trim() || 'API Key',
        selected_services: newServices,
      });
      if (error) throw error;
      toast.success(t3(language, 'Clé créée', 'Key created', 'Clave creada'));
      setShowForm(false);
      setNewLabel('');
      setNewServices([...ALL_SERVICES]);
      loadKeys();
    } catch (e: any) {
      toast.error(e.message || 'Error');
    }
    setCreating(false);
  };

  const toggleActive = async (key: MarinaKey) => {
    const { error } = await supabase
      .from('marina_api_keys')
      .update({ is_active: !key.is_active })
      .eq('id', key.id);
    if (!error) loadKeys();
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from('marina_api_keys').delete().eq('id', id);
    if (!error) {
      toast.success(t3(language, 'Clé supprimée', 'Key deleted', 'Clave eliminada'));
      loadKeys();
    }
  };

  const copyKey = (key: MarinaKey) => {
    navigator.clipboard.writeText(key.api_key);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleService = (service: MarinaService) => {
    setNewServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const creditsUsedThisMonth = jobs.filter(j => {
    const d = new Date(j.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length * 5;

  const hasDataService = newServices.some(s => DATA_SERVICES.includes(s));
  const bundleCost = computeBundleCost(newServices);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Anchor className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Marina à la carte</h2>
            <p className="text-sm text-muted-foreground">
              {t3(language,
                'Composez vos bundles : données brutes, rapport, ou les deux',
                'Compose your bundles: raw data, report, or both',
                'Componga sus bundles: datos brutos, informe, o ambos'
              )}
            </p>
          </div>
        </div>
        {isAgencyPro && (
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            {t3(language, 'Inclus dans votre plan', 'Included in your plan', 'Incluido en su plan')}
          </Badge>
        )}
      </div>

      {/* Credit warning */}
      {balance <= 10 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium">
                  {t3(language,
                    `Il vous reste ${balance} crédit${balance > 1 ? 's' : ''}`,
                    `You have ${balance} credit${balance > 1 ? 's' : ''} left`,
                    `Le quedan ${balance} crédito${balance > 1 ? 's' : ''}`
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t3(language,
                    'Le coût varie selon votre composition de bundle',
                    'Cost varies based on your bundle composition',
                    'El costo varía según la composición de su bundle'
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/app/console?tab=wallet')} className="gap-2">
              <Coins className="h-4 w-4" />
              {t3(language, 'Recharger', 'Top up', 'Recargar')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Service catalog — split data vs report */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t3(language, 'Catalogue de services', 'Service catalog', 'Catálogo de servicios')}</CardTitle>
          <CardDescription className="text-xs">
            {t3(language,
              'Choisissez les données dont vous avez besoin, avec ou sans le rapport',
              'Choose the data you need, with or without the report',
              'Elija los datos que necesita, con o sin el informe'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data services */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t3(language, 'Données brutes (API JSON)', 'Raw data (JSON API)', 'Datos brutos (API JSON)')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {DATA_SERVICES.map(service => {
                const meta = SERVICE_META[service];
                return (
                  <div key={service} className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{language === 'en' ? meta.en : language === 'es' ? meta.es : meta.fr}</p>
                      <Badge variant="outline" className="text-[10px]">{meta.credits} cr.</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{language === 'en' ? meta.description_en : meta.description_fr}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Report option */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t3(language, 'Option rapport', 'Report option', 'Opción informe')}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{language === 'en' ? SERVICE_META.report.en : language === 'es' ? SERVICE_META.report.es : SERVICE_META.report.fr}</p>
                <Badge variant="outline" className="text-[10px] border-primary/30">+{SERVICE_META.report.credits} cr.</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{language === 'en' ? SERVICE_META.report.description_en : SERVICE_META.report.description_fr}</p>
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                {t3(language,
                  'Sans cette option, vous recevez uniquement les données JSON brutes via l\'API',
                  'Without this option, you only receive raw JSON data via the API',
                  'Sin esta opción, solo recibe datos JSON brutos a través de la API'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keys list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t3(language, 'Mes bundles API', 'My API bundles', 'Mis bundles API')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t3(language, 'Nouveau bundle', 'New bundle', 'Nuevo bundle')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New key form */}
          {showForm && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
              <Input
                placeholder={t3(language, 'Nom du bundle (ex: Prospection rapide)', 'Bundle name (e.g. Quick prospecting)', 'Nombre del bundle')}
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="text-sm"
              />

              {/* Data phases */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {t3(language, 'Données (au moins 1 phase requise) :', 'Data (at least 1 phase required):', 'Datos (al menos 1 fase requerida):')}
                </p>
                {DATA_SERVICES.map(service => {
                  const meta = SERVICE_META[service];
                  return (
                    <label key={service} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={newServices.includes(service)}
                        onCheckedChange={() => toggleService(service)}
                      />
                      <span className="text-sm flex-1">{language === 'en' ? meta.en : language === 'es' ? meta.es : meta.fr}</span>
                      <span className="text-[10px] text-muted-foreground">{meta.credits} cr.</span>
                    </label>
                  );
                })}
              </div>

              {/* Report option */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {t3(language, 'Option :', 'Option:', 'Opción:')}
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={newServices.includes('report')}
                    onCheckedChange={() => toggleService('report')}
                  />
                  <span className="text-sm flex-1">{language === 'en' ? SERVICE_META.report.en : language === 'es' ? SERVICE_META.report.es : SERVICE_META.report.fr}</span>
                  <span className="text-[10px] text-muted-foreground">+{SERVICE_META.report.credits} cr.</span>
                </label>
              </div>

              {/* Cost preview */}
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <span className="text-xs text-muted-foreground">
                  {t3(language, 'Coût par appel :', 'Cost per call:', 'Costo por llamada:')}
                </span>
                <span className="text-sm font-bold">{bundleCost} {t3(language, 'crédits', 'credits', 'créditos')}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={createKey} disabled={creating || !hasDataService} className="gap-2">
                  {creating && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t3(language, 'Créer le bundle', 'Create bundle', 'Crear bundle')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  {t3(language, 'Annuler', 'Cancel', 'Cancelar')}
                </Button>
              </div>
            </div>
          )}

          {/* Existing keys */}
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> {t3(language, 'Chargement...', 'Loading...', 'Cargando...')}
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                {t3(language, 'Aucun bundle. Composez votre premier bundle à la carte.', 'No bundles. Compose your first à la carte bundle.', 'Sin bundles. Componga su primer bundle a la carta.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(key => {
                const keyServices = (key.selected_services || []) as MarinaService[];
                const keyCost = computeBundleCost(keyServices);
                const hasReport = keyServices.includes('report');
                return (
                  <div key={key.id} className={`p-3 rounded-lg border ${key.is_active ? 'border-border' : 'border-border/50 opacity-60'} bg-muted/20`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{key.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {keyCost} cr./{t3(language, 'appel', 'call', 'llamada')}
                        </Badge>
                        {hasReport ? (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            <FileText className="h-2.5 w-2.5 mr-0.5" />
                            {t3(language, 'Rapport', 'Report', 'Informe')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-muted-foreground/30">
                            <Database className="h-2.5 w-2.5 mr-0.5" />
                            {t3(language, 'Data only', 'Data only', 'Solo datos')}
                          </Badge>
                        )}
                        {!key.is_active && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t3(language, 'Désactivé', 'Disabled', 'Desactivado')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyKey(key)} title="Copy">
                          {copiedId === key.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(key)} title={key.is_active ? 'Disable' : 'Enable'}>
                          {key.is_active ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteKey(key.id)} title="Delete">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <code className="block px-2 py-1 bg-muted rounded text-[11px] font-mono truncate mb-2">
                      {key.api_key}
                    </code>
                    <div className="flex items-center gap-2 flex-wrap">
                      {keyServices.filter(s => s !== 'report').map(s => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {SERVICE_META[s]?.[language === 'en' ? 'en' : language === 'es' ? 'es' : 'fr'] || s}
                        </Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {key.requests_count} {t3(language, 'requêtes', 'requests', 'solicitudes')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consumption */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t3(language, 'Consommation', 'Consumption', 'Consumo')}</CardTitle>
            <CardDescription className="text-xs">{t3(language, 'Ce mois-ci', 'This month', 'Este mes')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{jobs.filter(j => {
                  const d = new Date(j.created_at);
                  const now = new Date();
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}</p>
                <p className="text-xs text-muted-foreground">{t3(language, 'Appels API', 'API calls', 'Llamadas API')}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{creditsUsedThisMonth}</p>
                <p className="text-xs text-muted-foreground">{t3(language, 'Crédits utilisés', 'Credits used', 'Créditos usados')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t3(language, 'Bundles actifs', 'Active bundles', 'Bundles activos')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{keys.filter(k => k.is_active).length}</p>
                <p className="text-xs text-muted-foreground">{t3(language, 'Actifs', 'Active', 'Activos')}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{keys.reduce((s, k) => s + k.requests_count, 0)}</p>
                <p className="text-xs text-muted-foreground">{t3(language, 'Total requêtes', 'Total requests', 'Total solicitudes')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t3(language, 'Historique des appels', 'Call history', 'Historial de llamadas')}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> {t3(language, 'Chargement...', 'Loading...', 'Cargando...')}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">
                {t3(language, 'Aucun appel Marina', 'No Marina calls', 'Ninguna llamada Marina')}
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate('/marina')} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                {t3(language, 'Lancer un audit Marina', 'Launch a Marina audit', 'Lanzar una auditoría Marina')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {jobs.map((job) => {
                const input = typeof job.input_payload === 'object' ? job.input_payload : {};
                const url = (input as any)?.url || '—';
                return (
                  <div key={job.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Badge variant={job.status === 'completed' ? 'default' : job.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {job.status}
                      </Badge>
                      <span className="truncate text-xs font-mono">{url}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {new Date(job.created_at).toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate('/marina#api')} className="gap-2">
          <ExternalLink className="h-4 w-4" />
          {t3(language, 'Documentation API', 'API Documentation', 'Documentación API')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/marina')} className="gap-2">
          <Anchor className="h-4 w-4" />
          {t3(language, 'Page Marina', 'Marina Page', 'Página Marina')}
        </Button>
      </div>
    </div>
  );
}
