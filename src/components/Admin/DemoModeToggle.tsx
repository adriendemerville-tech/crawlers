import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Monitor, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    title: 'Mode Démo',
    active: 'ACTIF',
    desc: 'Tolérance zéro erreur : suppression des erreurs front, retry auto, masquage des cards en échec',
    enabled: 'Mode Démo activé — tolérance zéro erreur',
    disabled: 'Mode Démo désactivé',
    error: 'Erreur lors du changement de mode',
  },
  en: {
    title: 'Demo Mode',
    active: 'ACTIVE',
    desc: 'Zero error tolerance: suppress front-end errors, auto retry, hide failed cards',
    enabled: 'Demo Mode enabled — zero error tolerance',
    disabled: 'Demo Mode disabled',
    error: 'Error changing mode',
  },
  es: {
    title: 'Modo Demo',
    active: 'ACTIVO',
    desc: 'Tolerancia cero errores: supresión de errores front, reintento auto, ocultación de cards fallidas',
    enabled: 'Modo Demo activado — tolerancia cero errores',
    disabled: 'Modo Demo desactivado',
    error: 'Error al cambiar el modo',
  },
};

export function DemoModeToggle() {
  const { isDemoMode } = useDemoMode();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert(
          { key: 'demo_mode', value: { active: checked } as any, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) throw error;
      toast.success(checked ? t.enabled : t.disabled);
    } catch (err) {
      console.error('Erreur toggle demo mode:', err);
      toast.error(t.error);
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className={`border-2 transition-colors ${isDemoMode ? 'border-emerald-500 bg-emerald-500/5' : 'border-border'}`}>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDemoMode ? 'bg-emerald-500/10' : 'bg-muted'}`}>
            <Monitor className={`h-5 w-5 ${isDemoMode ? 'text-emerald-500' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{t.title}</h3>
              {isDemoMode && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="h-3 w-3" />
                  {t.active}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.desc}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {toggling && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            checked={isDemoMode}
            onCheckedChange={handleToggle}
            disabled={toggling}
          />
        </div>
      </CardContent>
    </Card>
  );
}
