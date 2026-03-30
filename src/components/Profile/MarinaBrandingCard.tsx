import { useState, useEffect, useRef, useCallback } from 'react';
import { Anchor, Check, Loader2, Link2, Type, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const t3 = (lang: string, fr: string, en: string, es: string) =>
  lang === 'en' ? en : lang === 'es' ? es : fr;

function AutoSaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  if (status === 'idle') return null;
  return (
    <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
      {status === 'saving' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      )}
    </span>
  );
}

export function MarinaBrandingCard() {
  const { user, profile, refreshProfile } = useAuth();
  const { language } = useLanguage();

  const [enabled, setEnabled] = useState(false);
  const [customIntro, setCustomIntro] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [hideBadge, setHideBadge] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const isFirstRender = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from profile
  useEffect(() => {
    if (!profile) return;
    const p = profile as any;
    setEnabled(p.marina_brand_enabled || false);
    setCustomIntro(p.marina_custom_intro || '');
    setCtaText(p.marina_custom_cta_text || '');
    setCtaUrl(p.marina_custom_cta_url || '');
    setHideBadge(p.marina_hide_crawlers_badge || false);
  }, [profile]);

  const save = useCallback(async () => {
    if (!user) return;
    setStatus('saving');
    const { error } = await supabase
      .from('profiles')
      .update({
        marina_brand_enabled: enabled,
        marina_custom_intro: customIntro.trim().slice(0, 500) || null,
        marina_custom_cta_text: ctaText.trim().slice(0, 100) || null,
        marina_custom_cta_url: ctaUrl.trim() || null,
        marina_hide_crawlers_badge: hideBadge,
      } as any)
      .eq('user_id', user.id);

    if (error) {
      toast.error(t3(language, 'Erreur de sauvegarde', 'Save error', 'Error al guardar'));
      setStatus('idle');
    } else {
      setStatus('saved');
      await refreshProfile();
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [user, enabled, customIntro, ctaText, ctaUrl, hideBadge, language, refreshProfile]);

  // Auto-save debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [enabled, customIntro, ctaText, ctaUrl, hideBadge]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Anchor className="h-5 w-5 text-primary" />
            {t3(language, 'Branding Marina', 'Marina Branding', 'Branding Marina')}
            <AutoSaveIndicator status={status} />
          </CardTitle>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <CardDescription>
          {t3(language,
            'Personnalisez les rapports Marina générés via l\'API avec votre identité visuelle (logo, couleurs, textes définis dans la section Marque Blanche ci-dessus)',
            'Customize Marina reports generated via API with your brand identity (logo, colors, texts defined in the White Label section above)',
            'Personaliza los informes Marina generados vía API con tu identidad visual (logo, colores, textos definidos en la sección Marca Blanca arriba)'
          )}
        </CardDescription>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-5">
          {/* Custom intro */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              {t3(language, 'Introduction personnalisée', 'Custom introduction', 'Introducción personalizada')}
            </Label>
            <Textarea
              value={customIntro}
              onChange={e => setCustomIntro(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t3(language,
                'Ex : Ce rapport a été généré par [Votre Agence] pour vous aider à optimiser votre présence en ligne.',
                'e.g. This report was generated by [Your Agency] to help optimize your online presence.',
                'Ej: Este informe fue generado por [Su Agencia] para ayudarle a optimizar su presencia en línea.'
              )}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {t3(language,
                'Affiché en haut du rapport Marina, sous l\'en-tête. Max 500 caractères.',
                'Displayed at the top of the Marina report, below the header. Max 500 characters.',
                'Se muestra en la parte superior del informe Marina, debajo del encabezado. Máx. 500 caracteres.'
              )}
            </p>
          </div>

          {/* CTA */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                {t3(language, 'Texte du bouton CTA', 'CTA button text', 'Texto del botón CTA')}
              </Label>
              <Input
                value={ctaText}
                onChange={e => setCtaText(e.target.value)}
                maxLength={100}
                placeholder={t3(language, 'Ex : Contactez-nous', 'e.g. Contact us', 'Ej: Contáctenos')}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                {t3(language, 'URL du CTA', 'CTA URL', 'URL del CTA')}
              </Label>
              <Input
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                placeholder="https://votre-agence.com/contact"
                type="url"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t3(language,
              'Un bouton d\'appel à l\'action apparaîtra en bas du rapport Marina avec votre lien.',
              'A call-to-action button will appear at the bottom of the Marina report with your link.',
              'Un botón de llamada a la acción aparecerá al final del informe Marina con su enlace.'
            )}
          </p>

          {/* Hide Crawlers badge */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              {hideBadge ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t3(language, 'Masquer le badge Crawlers.fr', 'Hide Crawlers.fr badge', 'Ocultar insignia Crawlers.fr')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t3(language,
                    'Le logo et la mention Crawlers.fr seront remplacés par votre marque dans les rapports Marina',
                    'The Crawlers.fr logo and mention will be replaced by your brand in Marina reports',
                    'El logo y la mención de Crawlers.fr serán reemplazados por su marca en los informes Marina'
                  )}
                </p>
              </div>
            </div>
            <Switch checked={hideBadge} onCheckedChange={setHideBadge} />
          </div>

          {/* Info box */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
            💡 {t3(language,
              'Le logo, la couleur principale et les informations de contact définis dans la section "Marque Blanche" seront automatiquement appliqués à vos rapports Marina.',
              'The logo, primary color and contact info defined in the "White Label" section will be automatically applied to your Marina reports.',
              'El logo, el color principal y la información de contacto definidos en la sección "Marca Blanca" se aplicarán automáticamente a sus informes Marina.'
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
