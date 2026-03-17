import { useState, useEffect } from 'react';
import { Globe, Loader2, CheckCircle2, XCircle, AlertTriangle, Rocket, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, es, enUS } from 'date-fns/locale';

interface ScriptRule {
  id: string;
  domain_id: string;
  url_pattern: string;
  payload_type: string;
  is_active: boolean;
  version: number;
  generation_status: string;
  telemetry_last_ping: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackedSite {
  id: string;
  domain: string;
  site_name: string;
}

const PAYLOAD_TYPE_LABELS: Record<string, string> = {
  GLOBAL_FIXES: 'Global',
  FAQPage: 'FAQ',
  Article: 'Article',
  Organization: 'Organization',
  LocalBusiness: 'LocalBusiness',
  BreadcrumbList: 'Breadcrumbs',
  Product: 'Product',
  HTML_INJECTION: 'HTML',
};

const translations = {
  fr: {
    empty: 'Aucun script injecté',
    emptyDesc: 'Les scripts apparaîtront après configuration via l\'Architecte',
    test: 'Tester',
    testing: 'Test...',
    arrived: 'Reçu',
    notArrived: 'Non reçu',
    deploying: 'Déploiement OK',
    deployFail: 'Erreur déploiement',
    stale: 'Ping ancien',
    active: 'Actif',
    inactive: 'Inactif',
    version: 'v',
    resultArrived: 'Script bien reçu par le site',
    resultNotArrived: 'Aucun ping reçu — vérifiez l\'installation du widget',
    resultDeployOk: 'Script déployé correctement',
    resultDeployFail: 'Erreur de déploiement détectée',
    resultStale: 'Dernier ping il y a plus de 24h — connexion instable',
  },
  en: {
    empty: 'No injected scripts',
    emptyDesc: 'Scripts will appear after configuration via the Architect',
    test: 'Test',
    testing: 'Testing...',
    arrived: 'Received',
    notArrived: 'Not received',
    deploying: 'Deploy OK',
    deployFail: 'Deploy error',
    stale: 'Stale ping',
    active: 'Active',
    inactive: 'Inactive',
    version: 'v',
    resultArrived: 'Script successfully received by the site',
    resultNotArrived: 'No ping received — check widget installation',
    resultDeployOk: 'Script deployed correctly',
    resultDeployFail: 'Deployment error detected',
    resultStale: 'Last ping over 24h ago — unstable connection',
  },
  es: {
    empty: 'Sin scripts inyectados',
    emptyDesc: 'Los scripts aparecerán tras la configuración vía el Arquitecto',
    test: 'Probar',
    testing: 'Probando...',
    arrived: 'Recibido',
    notArrived: 'No recibido',
    deploying: 'Despliegue OK',
    deployFail: 'Error despliegue',
    stale: 'Ping antiguo',
    active: 'Activo',
    inactive: 'Inactivo',
    version: 'v',
    resultArrived: 'Script recibido correctamente por el sitio',
    resultNotArrived: 'Sin ping recibido — verifique la instalación del widget',
    resultDeployOk: 'Script desplegado correctamente',
    resultDeployFail: 'Error de despliegue detectado',
    resultStale: 'Último ping hace más de 24h — conexión inestable',
  },
};

type TestResult = {
  arrived: boolean;
  deployed: boolean;
  stale: boolean;
};

export function MyInjectedScripts() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const dateLocale = language === 'fr' ? fr : language === 'es' ? es : enUS;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [rulesBySite, setRulesBySite] = useState<Record<string, ScriptRule[]>>({});
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: sitesData } = await supabase
      .from('tracked_sites')
      .select('id, domain, site_name')
      .eq('user_id', user.id)
      .order('domain');

    const trackedSites = (sitesData || []) as TrackedSite[];
    setSites(trackedSites);

    if (trackedSites.length === 0) {
      setLoading(false);
      return;
    }

    const siteIds = trackedSites.map(s => s.id);
    const { data: rulesData } = await supabase
      .from('site_script_rules')
      .select('id, domain_id, url_pattern, payload_type, is_active, version, generation_status, telemetry_last_ping, created_at, updated_at')
      .eq('user_id', user.id)
      .in('domain_id', siteIds)
      .order('url_pattern');

    const grouped: Record<string, ScriptRule[]> = {};
    for (const rule of (rulesData || []) as ScriptRule[]) {
      if (!grouped[rule.domain_id]) grouped[rule.domain_id] = [];
      grouped[rule.domain_id].push(rule);
    }
    setRulesBySite(grouped);

    // Auto-expand first site with rules
    const firstWithRules = trackedSites.find(s => grouped[s.id]?.length > 0);
    if (firstWithRules) {
      setExpandedSites(new Set([firstWithRules.id]));
    }

    setLoading(false);
  };

  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const handleTest = async (rule: ScriptRule) => {
    setTestingId(rule.id);
    try {
      // Re-fetch the latest rule data to get fresh telemetry
      const { data } = await supabase
        .from('site_script_rules')
        .select('telemetry_last_ping, generation_status, generation_error')
        .eq('id', rule.id)
        .maybeSingle();

      if (!data) {
        toast.error(t.resultNotArrived);
        setTestResults(prev => ({ ...prev, [rule.id]: { arrived: false, deployed: false, stale: false } }));
        return;
      }

      const ping = data.telemetry_last_ping;
      const arrived = !!ping;
      const stale = arrived && (Date.now() - new Date(ping!).getTime()) > 24 * 3600 * 1000;
      const deployed = data.generation_status === 'done' && !data.generation_error;

      setTestResults(prev => ({ ...prev, [rule.id]: { arrived, deployed, stale } }));

      if (!arrived) {
        toast.error(t.resultNotArrived);
      } else if (stale) {
        toast.warning(t.resultStale);
      } else if (!deployed) {
        toast.error(t.resultDeployFail);
      } else {
        toast.success(`${t.resultArrived} · ${t.resultDeployOk}`);
      }
    } catch (err) {
      console.error('[InjectedScripts] Test error:', err);
      toast.error('Erreur lors du test');
    } finally {
      setTestingId(null);
    }
  };

  const hasAnyRules = Object.values(rulesBySite).some(r => r.length > 0);

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (sites.length === 0 || !hasAnyRules) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Rocket className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium">{t.empty}</p>
        <p className="text-sm mt-1">{t.emptyDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sites.map(site => {
        const rules = rulesBySite[site.id] || [];
        if (rules.length === 0) return null;
        const isExpanded = expandedSites.has(site.id);

        return (
          <Card key={site.id} className="overflow-hidden">
            <button
              onClick={() => toggleSite(site.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <Globe className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate">{site.site_name || site.domain}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {rules.length} script{rules.length > 1 ? 's' : ''}
              </Badge>
            </button>

            {isExpanded && (
              <CardContent className="pt-0 pb-3 px-3 space-y-2">
                {rules.map(rule => {
                  const result = testResults[rule.id];
                  const isTesting = testingId === rule.id;

                  return (
                    <div
                      key={rule.id}
                      className="rounded-lg border bg-muted/20 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                          {t.version}{rule.version}
                        </Badge>
                        <Badge variant="secondary" className="text-[9px] shrink-0">
                          {rule.url_pattern}
                        </Badge>
                        <span className="text-[10px] font-medium text-foreground">
                          {PAYLOAD_TYPE_LABELS[rule.payload_type] || rule.payload_type}
                        </span>
                        <Badge
                          variant={rule.is_active ? 'default' : 'outline'}
                          className={`text-[9px] ml-auto ${rule.is_active ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'text-muted-foreground'}`}
                        >
                          {rule.is_active ? t.active : t.inactive}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(rule.updated_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                        </span>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2.5 text-[10px] gap-1 ml-auto"
                          onClick={() => handleTest(rule)}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {t.testing}
                            </>
                          ) : (
                            <>
                              <Rocket className="w-3 h-3" />
                              {t.test}
                            </>
                          )}
                        </Button>
                      </div>

                      {result && (
                        <div className="flex items-center gap-3 pt-1 border-t border-border/50">
                          <div className="flex items-center gap-1 text-[10px]">
                            {result.arrived ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-destructive" />
                            )}
                            <span className={result.arrived ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                              {result.arrived ? t.arrived : t.notArrived}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            {result.deployed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-destructive" />
                            )}
                            <span className={result.deployed ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                              {result.deployed ? t.deploying : t.deployFail}
                            </span>
                          </div>
                          {result.stale && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
                              <span className="text-yellow-600 dark:text-yellow-400">{t.stale}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
