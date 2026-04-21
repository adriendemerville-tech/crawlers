import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Anchor, Copy, Check, ExternalLink, Coins, Loader2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'en' ? en : lang === 'es' ? es : fr;

type MarinaService = 'identity' | 'digital' | 'strategy';

interface MarinaKey {
  id: string;
  api_key: string;
  label: string;
  selected_services: string[];
  is_active: boolean;
  requests_count: number;
  created_at: string;
}

const SERVICE_META: Record<MarinaService, { fr: string; en: string; es: string; description_fr: string; description_en: string }> = {
  identity: {
    fr: 'Phase 1a — Identité',
    en: 'Phase 1a — Identity',
    es: 'Fase 1a — Identidad',
    description_fr: 'Scraping identité, réseaux sociaux, fondateur',
    description_en: 'Identity scraping, social networks, founder',
  },
  digital: {
    fr: 'Phase 1b — Digital',
    en: 'Phase 1b — Digital',
    es: 'Fase 1b — Digital',
    description_fr: 'Audit technique, PageSpeed, SEO on-page',
    description_en: 'Technical audit, PageSpeed, on-page SEO',
  },
  strategy: {
    fr: 'Phase 2 — Stratégie',
    en: 'Phase 2 — Strategy',
    es: 'Fase 2 — Estrategia',
    description_fr: 'Synthèse IA, recommandations, scoring',
    description_en: 'AI synthesis, recommendations, scoring',
  },
};

const ALL_SERVICES: MarinaService[] = ['identity', 'digital', 'strategy'];

export function MarinaConsoleTab() {
  const { user } = useAuth();
  const { balance, isAgencyPro } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<MarinaKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New key form
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
    if (!user || newServices.length === 0) return;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Anchor className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Marina</h2>
            <p className="text-sm text-muted-foreground">
              {t3(language, 'API modulaire — composez vos bundles par phase d\'audit', 'Modular API — compose your bundles by audit phase', 'API modular — componga sus bundles por fase de auditoría')}
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
                  {t3(language, 'Chaque rapport Marina coûte 5 crédits', 'Each Marina report costs 5 credits', 'Cada informe Marina cuesta 5 créditos')}
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

      {/* Service catalog */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t3(language, 'Services disponibles', 'Available services', 'Servicios disponibles')}</CardTitle>
          <CardDescription className="text-xs">
            {t3(language, 'Sélectionnez les phases à inclure dans chaque clé API', 'Select which phases to include in each API key', 'Seleccione las fases a incluir en cada clave API')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {ALL_SERVICES.map(service => {
              const meta = SERVICE_META[service];
              return (
                <div key={service} className="p-3 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm font-medium">{language === 'en' ? meta.en : language === 'es' ? meta.es : meta.fr}</p>
                  <p className="text-xs text-muted-foreground mt-1">{language === 'en' ? meta.description_en : meta.description_fr}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Keys list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t3(language, 'Mes clés API', 'My API keys', 'Mis claves API')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t3(language, 'Nouvelle clé', 'New key', 'Nueva clave')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* New key form */}
          {showForm && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <Input
                placeholder={t3(language, 'Nom du bundle (ex: Audit rapide)', 'Bundle name (e.g. Quick audit)', 'Nombre del bundle')}
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="text-sm"
              />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t3(language, 'Phases incluses :', 'Included phases:', 'Fases incluidas:')}
                </p>
                {ALL_SERVICES.map(service => {
                  const meta = SERVICE_META[service];
                  return (
                    <label key={service} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={newServices.includes(service)}
                        onCheckedChange={() => toggleService(service)}
                      />
                      <span className="text-sm">{language === 'en' ? meta.en : language === 'es' ? meta.es : meta.fr}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={createKey} disabled={creating || newServices.length === 0} className="gap-2">
                  {creating && <Loader2 className="h-3 w-3 animate-spin" />}
                  {t3(language, 'Créer la clé', 'Create key', 'Crear clave')}
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
                {t3(language, 'Aucune clé API. Créez votre premier bundle.', 'No API keys. Create your first bundle.', 'Sin claves API. Cree su primer bundle.')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(key => (
                <div key={key.id} className={`p-3 rounded-lg border ${key.is_active ? 'border-border' : 'border-border/50 opacity-60'} bg-muted/20`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{key.label}</span>
                      {!key.is_active && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t3(language, 'Désactivée', 'Disabled', 'Desactivada')}
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
                    {(key.selected_services || []).map(s => (
                      <Badge key={s} variant="outline" className="text-[10px]">
                        {SERVICE_META[s as MarinaService]?.[language === 'en' ? 'en' : language === 'es' ? 'es' : 'fr'] || s}
                      </Badge>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {key.requests_count} {t3(language, 'requêtes', 'requests', 'solicitudes')}
                    </span>
                  </div>
                </div>
              ))}
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
                <p className="text-xs text-muted-foreground">{t3(language, 'Rapports', 'Reports', 'Informes')}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{creditsUsedThisMonth}</p>
                <p className="text-xs text-muted-foreground">{t3(language, 'Crédits utilisés', 'Credits used', 'Créditos usados')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t3(language, 'Clés actives', 'Active keys', 'Claves activas')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{keys.filter(k => k.is_active).length}</p>
                <p className="text-xs text-muted-foreground">{t3(language, 'Actives', 'Active', 'Activas')}</p>
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
          <CardTitle className="text-base">{t3(language, 'Mes rapports Marina', 'My Marina Reports', 'Mis informes Marina')}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> {t3(language, 'Chargement...', 'Loading...', 'Cargando...')}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">
                {t3(language, 'Aucun rapport Marina généré', 'No Marina reports generated', 'Ningún informe Marina generado')}
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
