import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { BarChart3, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    title: 'Google Analytics (GA4) + OAuth',
    coupled: 'COUPLÉ',
    enabledDesc: 'Le scope analytics.readonly est inclus dans le flux OAuth. Désactiver en attendant la vérification Google.',
    disabledDesc: 'Seul le scope Search Console est demandé. Activer après vérification Google pour inclure GA4.',
    onMsg: 'GA4 couplé à OAuth — le scope analytics.readonly sera demandé à la connexion',
    offMsg: 'GA4 découplé — seul le scope Search Console sera demandé',
    error: 'Erreur lors du changement',
  },
  en: {
    title: 'Google Analytics (GA4) + OAuth',
    coupled: 'COUPLED',
    enabledDesc: 'The analytics.readonly scope is included in the OAuth flow. Disable while waiting for Google verification.',
    disabledDesc: 'Only the Search Console scope is requested. Enable after Google verification to include GA4.',
    onMsg: 'GA4 coupled to OAuth — analytics.readonly scope will be requested at login',
    offMsg: 'GA4 decoupled — only the Search Console scope will be requested',
    error: 'Error during change',
  },
  es: {
    title: 'Google Analytics (GA4) + OAuth',
    coupled: 'ACOPLADO',
    enabledDesc: 'El scope analytics.readonly está incluido en el flujo OAuth. Desactivar mientras se espera la verificación de Google.',
    disabledDesc: 'Solo se solicita el scope de Search Console. Activar después de la verificación de Google para incluir GA4.',
    onMsg: 'GA4 acoplado a OAuth — el scope analytics.readonly se solicitará al iniciar sesión',
    offMsg: 'GA4 desacoplado — solo se solicitará el scope de Search Console',
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
