import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SeaSeoBridge } from '@/components/Console/SeaSeoBridge';
import { Loader2, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemoMode } from '@/contexts/DemoModeContext';

interface Site {
  id: string;
  domain: string;
  site_name: string | null;
}

interface SiteReadiness {
  hasTechnical: boolean;
  hasStrategic: boolean;
  hasCocoon: boolean;
}

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'es' ? es : lang === 'en' ? en : fr;

export function SeaSeoBridgeTab() {
  const { language } = useLanguage();
  const { isDemoMode } = useDemoMode();
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<Record<string, SiteReadiness>>({});

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: sitesData } = await supabase
        .from('tracked_sites')
        .select('id, domain, site_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!sitesData || sitesData.length === 0) {
        setLoading(false);
        return;
      }

      setSites(sitesData);
      const siteIds = sitesData.map(s => s.id);

      // Check readiness in parallel
      const [technicalRes, strategicRes, cocoonRes] = await Promise.all([
        supabase
          .from('audit_impact_snapshots')
          .select('tracked_site_id')
          .eq('user_id', user.id)
          .eq('audit_type', 'technical')
          .in('tracked_site_id', siteIds),
        supabase
          .from('audit_impact_snapshots')
          .select('tracked_site_id')
          .eq('user_id', user.id)
          .eq('audit_type', 'strategic')
          .in('tracked_site_id', siteIds),
        supabase
          .from('cocoon_sessions')
          .select('tracked_site_id')
          .eq('user_id', user.id)
          .in('tracked_site_id', siteIds),
      ]);

      const techSet = new Set((technicalRes.data || []).map(r => r.tracked_site_id));
      const stratSet = new Set((strategicRes.data || []).map(r => r.tracked_site_id));
      const cocoonSet = new Set((cocoonRes.data || []).map(r => r.tracked_site_id));

      const readinessMap: Record<string, SiteReadiness> = {};
      for (const s of sitesData) {
        readinessMap[s.id] = {
          hasTechnical: techSet.has(s.id),
          hasStrategic: stratSet.has(s.id),
          hasCocoon: cocoonSet.has(s.id),
        };
      }
      setReadiness(readinessMap);

      // Auto-select first ready site, or first site
      const readySite = sitesData.find(s => {
        const r = readinessMap[s.id];
        return r?.hasTechnical && r?.hasStrategic && r?.hasCocoon;
      });
      setSelectedSiteId(readySite?.id || sitesData[0].id);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (sites.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        {t3(language,
          'Ajoutez un site dans l\'onglet Tracking pour utiliser le SEA→SEO Bridge.',
          'Add a site in the Tracking tab to use the SEA→SEO Bridge.',
          'Añade un sitio en la pestaña Tracking para usar el SEA→SEO Bridge.'
        )}
      </div>
    );
  }

  const hasAnyReadySite = Object.values(readiness).some(r => r.hasTechnical && r.hasStrategic && r.hasCocoon);
  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const selectedReadiness = selectedSiteId ? readiness[selectedSiteId] : null;
  const selectedIsReady = selectedReadiness?.hasTechnical && selectedReadiness?.hasStrategic && selectedReadiness?.hasCocoon;

  return (
    <div className="space-y-4">
      {sites.length > 1 && (
        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.site_name || s.domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!hasAnyReadySite ? (
        <div className="flex items-start gap-3 py-10 px-6 max-w-lg mx-auto text-center">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Info className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                {t3(language,
                  'Prérequis non remplis',
                  'Prerequisites not met',
                  'Requisitos no cumplidos'
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">
              {t3(language,
                'Pour activer le croisement SEA → SEO, chaque site doit avoir complété : un audit technique, un audit stratégique et une session Cocoon. Lancez ces analyses depuis les onglets correspondants, puis revenez ici.',
                'To enable SEA → SEO cross-analysis, each site must have completed: a technical audit, a strategic audit, and a Cocoon session. Run these from the corresponding tabs, then come back here.',
                'Para activar el cruce SEA → SEO, cada sitio debe haber completado: una auditoría técnica, una auditoría estratégica y una sesión Cocoon. Ejecútelos desde las pestañas correspondientes y vuelva aquí.'
              )}
            </p>
          </div>
        </div>
      ) : selectedSite && !selectedIsReady ? (
        <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground/70 text-xs">
          <Info className="h-3.5 w-3.5" />
          <span>
            {t3(language,
              `${selectedSite.site_name || selectedSite.domain} : il manque ${[
                !selectedReadiness?.hasTechnical && 'audit technique',
                !selectedReadiness?.hasStrategic && 'audit stratégique',
                !selectedReadiness?.hasCocoon && 'session Cocoon',
              ].filter(Boolean).join(', ')}.`,
              `${selectedSite.site_name || selectedSite.domain}: missing ${[
                !selectedReadiness?.hasTechnical && 'technical audit',
                !selectedReadiness?.hasStrategic && 'strategic audit',
                !selectedReadiness?.hasCocoon && 'Cocoon session',
              ].filter(Boolean).join(', ')}.`,
              `${selectedSite.site_name || selectedSite.domain}: falta ${[
                !selectedReadiness?.hasTechnical && 'auditoría técnica',
                !selectedReadiness?.hasStrategic && 'auditoría estratégica',
                !selectedReadiness?.hasCocoon && 'sesión Cocoon',
              ].filter(Boolean).join(', ')}.`
            )}
          </span>
        </div>
      ) : selectedSite ? (
        <SeaSeoBridge domain={selectedSite.domain} trackedSiteId={selectedSite.id} />
      ) : null}
    </div>
  );
}
