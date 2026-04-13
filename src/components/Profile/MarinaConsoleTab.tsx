import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Anchor, Copy, Check, ExternalLink, Coins, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'en' ? en : lang === 'es' ? es : fr;

export function MarinaConsoleTab() {
  const { user } = useAuth();
  const { balance, isAgencyPro } = useCredits();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Load API key
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .rpc('get_own_marina_api_key' as any, { p_user_id: user.id });
      if (data) setApiKey(data as string);
      setLoading(false);
    };
    load();
  }, [user]);

  // Load jobs
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

  const generateKey = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina?action=generate_key`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      const json = await res.json();
      if (json.key) {
        setApiKey(json.key);
        toast.success(t3(language, 'Clé API générée', 'API key generated', 'Clave API generada'));
      } else if (json.error) {
        toast.error(json.error);
      }
    } catch {
      toast.error('Erreur');
    }
    setGenerating(false);
  };

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              {t3(language, 'Tableau de bord Marina — Audits SEO automatisés', 'Marina Dashboard — Automated SEO Audits', 'Panel Marina — Auditorías SEO automatizadas')}
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
            <Button
              size="sm"
              onClick={() => navigate('/app/console?tab=wallet')}
              className="gap-2"
            >
              <Coins className="h-4 w-4" />
              {t3(language, 'Recharger mes crédits', 'Top up credits', 'Recargar créditos')}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* API Key */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t3(language, 'Ma clé API', 'My API Key', 'Mi clave API')}</CardTitle>
            <CardDescription className="text-xs">
              {t3(language, 'Utilisez cette clé pour intégrer Marina sur votre site', 'Use this key to embed Marina on your site', 'Use esta clave para integrar Marina en su sitio')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> {t3(language, 'Chargement...', 'Loading...', 'Cargando...')}
              </div>
            ) : apiKey ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-xs font-mono truncate">
                    {apiKey}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyKey} className="shrink-0">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={generateKey} disabled={generating} className="gap-2 text-xs">
                  <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
                  {t3(language, 'Régénérer', 'Regenerate', 'Regenerar')}
                </Button>
              </div>
            ) : (
              <Button onClick={generateKey} disabled={generating} className="gap-2">
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t3(language, 'Générer ma clé API', 'Generate my API key', 'Generar mi clave API')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Consumption */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t3(language, 'Consommation', 'Consumption', 'Consumo')}</CardTitle>
            <CardDescription className="text-xs">
              {t3(language, 'Ce mois-ci', 'This month', 'Este mes')}
            </CardDescription>
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
