import { useState, useEffect, useRef, useCallback } from 'react';
import { Anchor, Check, Loader2, Link2, Type, Eye, EyeOff, Shield, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [fullWhiteLabel, setFullWhiteLabel] = useState(false);
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
    setFullWhiteLabel(p.marina_full_whitelabel || false);
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
        marina_full_whitelabel: fullWhiteLabel,
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
  }, [user, enabled, fullWhiteLabel, customIntro, ctaText, ctaUrl, hideBadge, language, refreshProfile]);

  // Auto-save debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 1500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [enabled, fullWhiteLabel, customIntro, ctaText, ctaUrl, hideBadge]);

  const hasLogo = !!(profile as any)?.agency_logo_url;
  const hasColor = !!(profile as any)?.agency_primary_color;
  const hasBrandName = !!(profile as any)?.agency_brand_name;

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
            'Personnalisez les rapports Marina générés via l\'API avec votre identité visuelle',
            'Customize Marina reports generated via API with your brand identity',
            'Personaliza los informes Marina generados vía API con tu identidad visual'
          )}
        </CardDescription>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-5">
          {/* Full White Label toggle */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Checkbox
                id="full-wl"
                checked={fullWhiteLabel}
                onCheckedChange={(v) => setFullWhiteLabel(v === true)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="full-wl" className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <Shield className="h-4 w-4 text-primary" />
                  {t3(language, 'Marque blanche complète', 'Full White Label', 'Marca blanca completa')}
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  {t3(language,
                    'Supprime TOUTE mention de Crawlers.fr des rapports Marina : logo, footer, textes, méta-données et code source. Vos clients ne verront que votre marque.',
                    'Removes ALL Crawlers.fr references from Marina reports: logo, footer, texts, metadata and source code. Your clients will only see your brand.',
                    'Elimina TODA mención de Crawlers.fr de los informes Marina: logo, pie de página, textos, metadatos y código fuente. Sus clientes solo verán su marca.'
                  )}
                </p>
                {fullWhiteLabel && (!hasLogo || !hasColor || !hasBrandName) && (
                  <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                    ⚠️ {t3(language,
                      `Pour un résultat optimal, configurez ${[!hasLogo ? 'votre logo' : '', !hasColor ? 'votre couleur' : '', !hasBrandName ? 'votre nom de marque' : ''].filter(Boolean).join(', ')} dans la section Marque Blanche ci-dessus.`,
                      `For best results, set up ${[!hasLogo ? 'your logo' : '', !hasColor ? 'your color' : '', !hasBrandName ? 'your brand name' : ''].filter(Boolean).join(', ')} in the White Label section above.`,
                      `Para mejores resultados, configure ${[!hasLogo ? 'su logo' : '', !hasColor ? 'su color' : '', !hasBrandName ? 'su nombre de marca' : ''].filter(Boolean).join(', ')} en la sección Marca Blanca arriba.`
                    )}
                  </div>
                )}
                {fullWhiteLabel && hasLogo && hasColor && hasBrandName && (
                  <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    {t3(language,
                      'Configuration complète — vos rapports seront 100% à votre image.',
                      'Setup complete — your reports will be 100% branded.',
                      'Configuración completa — sus informes serán 100% de su marca.'
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview of applied branding */}
          {fullWhiteLabel && hasLogo && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-3 min-w-0">
                <img src={(profile as any)?.agency_logo_url} alt="" className="h-8 max-w-[120px] object-contain rounded" />
                {hasBrandName && <span className="text-sm font-medium truncate">{(profile as any)?.agency_brand_name}</span>}
                {hasColor && <span className="w-5 h-5 rounded-full border border-border shrink-0" style={{ background: (profile as any)?.agency_primary_color }} />}
              </div>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {t3(language, 'Aperçu', 'Preview', 'Vista previa')}
              </span>
            </div>
          )}

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

          {/* Hide Crawlers badge — only shown if NOT full white-label (full WL hides everything anyway) */}
          {!fullWhiteLabel && (
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
          )}

          {/* Info box */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
            💡 {t3(language,
              fullWhiteLabel
                ? 'Le logo, la couleur principale, le nom et les informations de contact de la section "Marque Blanche" seront injectés dans le rapport. Aucune trace de Crawlers.fr ne sera visible.'
                : 'Le logo, la couleur principale et les informations de contact définis dans la section "Marque Blanche" seront automatiquement appliqués à vos rapports Marina.',
              fullWhiteLabel
                ? 'Logo, primary color, name and contact info from the "White Label" section will be injected into the report. No trace of Crawlers.fr will be visible.'
                : 'The logo, primary color and contact info defined in the "White Label" section will be automatically applied to your Marina reports.',
              fullWhiteLabel
                ? 'El logo, el color principal, el nombre y la información de contacto de la sección "Marca Blanca" se inyectarán en el informe. No se verá ningún rastro de Crawlers.fr.'
                : 'El logo, el color principal y la información de contacto definidos en la sección "Marca Blanca" se aplicarán automáticamente a sus informes Marina.'
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}