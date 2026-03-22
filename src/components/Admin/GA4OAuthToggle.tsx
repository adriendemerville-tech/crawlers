import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { BarChart3, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    title: 'Accès protégé Google dans Auth',
    coupled: 'COMPLET',
    enabledDesc: 'Tous les scopes Google sont demandés : GSC, GA4, GMB, GTM, Google Ads. Désactiver pour ne demander que GSC.',
    disabledDesc: 'Seul le scope Search Console (GSC) est demandé à la connexion OAuth.',
    onMsg: 'Accès complet activé — GSC, GA4, GMB, GTM et Google Ads seront demandés',
    offMsg: 'Accès restreint — seul le scope GSC sera demandé',
    error: 'Erreur lors du changement',
  },
  en: {
    title: 'Protected Google Access in Auth',
    coupled: 'FULL',
    enabledDesc: 'All Google scopes are requested: GSC, GA4, GMB, GTM, Google Ads. Disable to request only GSC.',
    disabledDesc: 'Only the Search Console (GSC) scope is requested during OAuth.',
    onMsg: 'Full access enabled — GSC, GA4, GMB, GTM and Google Ads will be requested',
    offMsg: 'Restricted access — only the GSC scope will be requested',
    error: 'Error during change',
  },
  es: {
    title: 'Acceso protegido Google en Auth',
    coupled: 'COMPLETO',
    enabledDesc: 'Todos los scopes de Google se solicitan: GSC, GA4, GMB, GTM, Google Ads. Desactivar para solicitar solo GSC.',
    disabledDesc: 'Solo se solicita el scope de Search Console (GSC) durante OAuth.',
    onMsg: 'Acceso completo activado — GSC, GA4, GMB, GTM y Google Ads serán solicitados',
    offMsg: 'Acceso restringido — solo se solicitará el scope de GSC',
    error: 'Error durante el cambio',
  },
};

export function GA4OAuthToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  useEffect(() => {
    supabase
      .from('system_config')
      .select('value')
      .eq('key', 'ga4_oauth_enabled')
      .maybeSingle()
      .then(({ data }) => {
        const val = data?.value as any;
        setEnabled(val?.active === true);
        setLoading(false);
      });
  }, []);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert(
          { key: 'ga4_oauth_enabled', value: { active: checked } as any, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      if (error) throw error;
      setEnabled(checked);
      toast.success(checked ? t.onMsg : t.offMsg);
    } catch (err) {
      console.error('GA4 toggle error:', err);
      toast.error(t.error);
    } finally {
      setToggling(false);
    }
  };

  if (loading) return null;

  return (
    <Card className={`border-2 transition-colors ${enabled ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${enabled ? 'bg-primary/10' : 'bg-muted'}`}>
            <BarChart3 className={`h-5 w-5 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{t.title}</h3>
              {enabled && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3" />
                  {t.coupled}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabled ? t.enabledDesc : t.disabledDesc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {toggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>
      </CardContent>
    </Card>
  );
}
