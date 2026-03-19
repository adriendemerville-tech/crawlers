import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Palette, Trash2, Save, Loader2, Image as ImageIcon, Building2, Contact, FileText, Check, Type, Bold, Italic, Underline } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const translations = {
  fr: {
    title: 'Marque Blanche',
    description: 'Personnalisez vos rapports avec votre identité visuelle',
    logoLabel: 'Logo de l\'agence',
    logoHint: 'PNG ou SVG transparent, max 2 Mo',
    colorLabel: 'Couleur principale',
    colorHint: 'Appliquée aux titres et boutons des rapports',
    brandNameLabel: 'Nom de la marque',
    brandNameHint: 'Affiché dans l\'en-tête de vos rapports',
    brandNamePlaceholder: 'Ex : Mon Agence SEO',
    contactTitle: 'Informations de contact',
    contactDescription: 'Ces informations apparaîtront dans vos rapports clients',
    contactFirstName: 'Prénom',
    contactLastName: 'Nom',
    contactPhone: 'Téléphone',
    contactEmail: 'Email de contact',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Branding sauvegardé',
    removeLogo: 'Supprimer le logo',
    uploadLogo: 'Uploader un logo',
    preview: 'Aperçu du rapport',
    previewHeader: 'En-tête personnalisé',
    previewFooter: 'Les mentions Crawlers.fr seront masquées',
    reportHeaderLabel: 'Texte d\'introduction',
    reportHeaderHint: 'Affiché après l\'en-tête du rapport (max 500 caractères)',
    reportHeaderPlaceholder: 'Ex : Ce rapport a été réalisé par notre équipe d\'experts SEO...',
    reportFooterLabel: 'Texte de conclusion',
    reportFooterHint: 'Affiché avant le pied de page du rapport (max 500 caractères)',
    reportFooterPlaceholder: 'Ex : Pour toute question, n\'hésitez pas à nous contacter...',
    customTextsTitle: 'Textes personnalisés du rapport',
    customTextsDescription: 'Ajoutez des messages personnalisés en début et fin de rapport',
     error: 'Erreur lors de la sauvegarde',
     uploadError: 'Erreur lors de l\'upload du logo',
     fileTooLarge: 'Le fichier dépasse 2 Mo',
     fontLabel: 'Police d\'écriture',
     fontHint: 'Appliquée aux titres de vos rapports clients',
   },
  en: {
    title: 'White Label',
    description: 'Customize your reports with your brand identity',
    logoLabel: 'Agency Logo',
    logoHint: 'Transparent PNG or SVG, max 2 MB',
    colorLabel: 'Primary Color',
    colorHint: 'Applied to report titles and CTA buttons',
    brandNameLabel: 'Brand Name',
    brandNameHint: 'Displayed in the header of your reports',
    brandNamePlaceholder: 'e.g. My SEO Agency',
    contactTitle: 'Contact Information',
    contactDescription: 'This information will appear in your client reports',
    contactFirstName: 'First Name',
    contactLastName: 'Last Name',
    contactPhone: 'Phone',
    contactEmail: 'Contact Email',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Branding saved',
    removeLogo: 'Remove logo',
    uploadLogo: 'Upload a logo',
    preview: 'Report Preview',
    previewHeader: 'Custom header',
    previewFooter: 'Crawlers.fr mentions will be hidden',
    reportHeaderLabel: 'Introduction Text',
    reportHeaderHint: 'Displayed after the report header (max 500 characters)',
    reportHeaderPlaceholder: 'e.g. This report was prepared by our SEO experts...',
    reportFooterLabel: 'Conclusion Text',
    reportFooterHint: 'Displayed before the report footer (max 500 characters)',
    reportFooterPlaceholder: 'e.g. For any questions, feel free to contact us...',
    customTextsTitle: 'Custom Report Texts',
    customTextsDescription: 'Add custom messages at the beginning and end of reports',
     error: 'Error saving branding',
     uploadError: 'Error uploading logo',
     fileTooLarge: 'File exceeds 2 MB',
     fontLabel: 'Font Family',
     fontHint: 'Applied to titles in your client reports',
   },
  es: {
    title: 'Marca Blanca',
    description: 'Personaliza tus informes con tu identidad visual',
    logoLabel: 'Logo de la agencia',
    logoHint: 'PNG o SVG transparente, máx. 2 MB',
    colorLabel: 'Color principal',
    colorHint: 'Aplicado a títulos y botones de los informes',
    brandNameLabel: 'Nombre de la marca',
    brandNameHint: 'Se muestra en el encabezado de tus informes',
    brandNamePlaceholder: 'Ej: Mi Agencia SEO',
    contactTitle: 'Información de contacto',
    contactDescription: 'Esta información aparecerá en tus informes de clientes',
    contactFirstName: 'Nombre',
    contactLastName: 'Apellido',
    contactPhone: 'Teléfono',
    contactEmail: 'Email de contacto',
    save: 'Guardar',
    saving: 'Guardando...',
    saved: 'Branding guardado',
    removeLogo: 'Eliminar logo',
    uploadLogo: 'Subir un logo',
    preview: 'Vista previa del informe',
    previewHeader: 'Encabezado personalizado',
    previewFooter: 'Las menciones de Crawlers.fr se ocultarán',
    reportHeaderLabel: 'Texto de introducción',
    reportHeaderHint: 'Se muestra después del encabezado del informe (máx. 500 caracteres)',
    reportHeaderPlaceholder: 'Ej: Este informe fue realizado por nuestro equipo de expertos SEO...',
    reportFooterLabel: 'Texto de conclusión',
    reportFooterHint: 'Se muestra antes del pie de página del informe (máx. 500 caracteres)',
    reportFooterPlaceholder: 'Ej: Para cualquier pregunta, no dude en contactarnos...',
    customTextsTitle: 'Textos personalizados del informe',
    customTextsDescription: 'Agrega mensajes personalizados al inicio y final de los informes',
     error: 'Error al guardar el branding',
     uploadError: 'Error al subir el logo',
     fileTooLarge: 'El archivo supera los 2 MB',
     fontLabel: 'Tipografía',
     fontHint: 'Aplicada a los títulos de tus informes de clientes',
   },
 };

const FONT_OPTIONS = [
  { value: '', label: 'Par défaut (Inter)' },
  { value: 'Quicksand', label: 'Quicksand' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Source Sans 3', label: 'Source Sans 3' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
];

type CardId = 'identity' | 'contact' | 'texts';

/** Small auto-save status badge shown in each card header */
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

export function BrandingTab() {
  const { user, profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const [logoUrl, setLogoUrl] = useState(profile?.agency_logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(profile?.agency_primary_color || '#7c3aed');
  const [brandName, setBrandName] = useState(profile?.agency_brand_name || '');
  const [contactFirstName, setContactFirstName] = useState(profile?.agency_contact_first_name || '');
  const [contactLastName, setContactLastName] = useState(profile?.agency_contact_last_name || '');
  const [contactPhone, setContactPhone] = useState(profile?.agency_contact_phone || '');
  const [contactEmail, setContactEmail] = useState(profile?.agency_contact_email || '');
  const [reportHeaderText, setReportHeaderText] = useState(profile?.agency_report_header_text || '');
  const [reportFooterText, setReportFooterText] = useState(profile?.agency_report_footer_text || '');
  const [reportFont, setReportFont] = useState((profile as any)?.agency_report_font || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track per-card auto-save status
  const [cardStatus, setCardStatus] = useState<Record<CardId, 'idle' | 'saving' | 'saved'>>({
    identity: 'idle',
    contact: 'idle',
    texts: 'idle',
  });

  // Detect which cards are dirty
  const isIdentityDirty = logoUrl !== (profile?.agency_logo_url || '')
    || primaryColor !== (profile?.agency_primary_color || '#7c3aed')
    || brandName !== (profile?.agency_brand_name || '')
    || reportFont !== ((profile as any)?.agency_report_font || '');

  const isContactDirty = contactFirstName !== (profile?.agency_contact_first_name || '')
    || contactLastName !== (profile?.agency_contact_last_name || '')
    || contactPhone !== (profile?.agency_contact_phone || '')
    || contactEmail !== (profile?.agency_contact_email || '');

  const isTextsDirty = reportHeaderText !== (profile?.agency_report_header_text || '')
    || reportFooterText !== (profile?.agency_report_footer_text || '');

  const dirtyCards = useRef<Set<CardId>>(new Set());
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const persistSave = useCallback(async (cards: Set<CardId>) => {
    if (!user || cards.size === 0) return;

    // Mark saving on dirty cards
    setCardStatus(prev => {
      const next = { ...prev };
      cards.forEach(c => { next[c] = 'saving'; });
      return next;
    });

    const { error } = await supabase
      .from('profiles')
      .update({
        agency_logo_url: logoUrl || null,
        agency_primary_color: primaryColor || null,
        agency_brand_name: brandName.trim() || null,
        agency_report_font: reportFont || null,
        agency_contact_first_name: contactFirstName.trim() || null,
        agency_contact_last_name: contactLastName.trim() || null,
        agency_contact_phone: contactPhone.trim() || null,
        agency_contact_email: contactEmail.trim() || null,
        agency_report_header_text: reportHeaderText.trim().slice(0, 500) || null,
        agency_report_footer_text: reportFooterText.trim().slice(0, 500) || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error(t.error);
      setCardStatus(prev => {
        const next = { ...prev };
        cards.forEach(c => { next[c] = 'idle'; });
        return next;
      });
    } else {
      setCardStatus(prev => {
        const next = { ...prev };
        cards.forEach(c => { next[c] = 'saved'; });
        return next;
      });
      await refreshProfile();
      // Reset "saved" badge after 2s
      setTimeout(() => {
        setCardStatus(prev => {
          const next = { ...prev };
          cards.forEach(c => { if (next[c] === 'saved') next[c] = 'idle'; });
          return next;
        });
      }, 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, logoUrl, primaryColor, brandName, reportFont, contactFirstName, contactLastName, contactPhone, contactEmail, reportHeaderText, reportFooterText]);

  // Debounced auto-save: triggers 1.5s after last change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const dirty = new Set<CardId>();
    if (isIdentityDirty) dirty.add('identity');
    if (isContactDirty) dirty.add('contact');
    if (isTextsDirty) dirty.add('texts');
    dirtyCards.current = dirty;

    if (dirty.size === 0) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      persistSave(new Set(dirtyCards.current));
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoUrl, primaryColor, brandName, reportFont, contactFirstName, contactLastName, contactPhone, contactEmail, reportHeaderText, reportFooterText]);


  // Load Google Font for preview
  useEffect(() => {
    if (!reportFont) return;
    const id = `gfont-${reportFont.replace(/\s/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(reportFont)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [reportFont]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.fileTooLarge);
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('agency-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('agency-logos')
        .getPublicUrl(filePath);

      setLogoUrl(`${publicUrl}?t=${Date.now()}`);
    } catch (err) {
      console.error(err);
      toast.error(t.uploadError);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
  };

  const handleManualSave = async () => {
    if (!user) return;
    setIsSaving(true);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    const allCards = new Set<CardId>(['identity', 'contact', 'texts'] as CardId[]);
    setCardStatus({ identity: 'saving', contact: 'saving', texts: 'saving' });

    const { error } = await supabase
      .from('profiles')
      .update({
        agency_logo_url: logoUrl || null,
        agency_primary_color: primaryColor || null,
        agency_brand_name: brandName.trim() || null,
        agency_report_font: reportFont || null,
        agency_contact_first_name: contactFirstName.trim() || null,
        agency_contact_last_name: contactLastName.trim() || null,
        agency_contact_phone: contactPhone.trim() || null,
        agency_contact_email: contactEmail.trim() || null,
        agency_report_header_text: reportHeaderText.trim().slice(0, 500) || null,
        agency_report_footer_text: reportFooterText.trim().slice(0, 500) || null,
      })
      .eq('user_id', user.id);

    setIsSaving(false);

    if (error) {
      toast.error(t.error);
      setCardStatus({ identity: 'idle', contact: 'idle', texts: 'idle' });
    } else {
      toast.success(t.saved);
      setCardStatus({ identity: 'saved', contact: 'saved', texts: 'saved' });
      await refreshProfile();
      setTimeout(() => {
        setCardStatus({ identity: 'idle', contact: 'idle', texts: 'idle' });
      }, 2000);
    }
  };

  // Listen for external save trigger from Pro Agency header
  useEffect(() => {
    const handler = () => handleManualSave();
    window.addEventListener('branding-save', handler);
    return () => window.removeEventListener('branding-save', handler);
  }, [handleManualSave]);

  return (
    <div className="space-y-6">
      {/* Identity Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t.title}
              <AutoSaveIndicator status={cardStatus.identity} />
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 border-violet-500/30 hover:bg-violet-500/10"
              onClick={handleManualSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Brand Name */}
          <div className="space-y-2">
            <Label>{t.brandNameLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.brandNameHint}</p>
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={t.brandNamePlaceholder}
              maxLength={100}
              className="max-w-md"
            />
          </div>

          {/* Logo Upload */}
          <div className="space-y-3">
            <Label>{t.logoLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.logoHint}</p>

            {logoUrl ? (
              <div className="flex items-center gap-4">
                <div className="w-48 h-20 rounded-lg border border-border bg-muted/30 flex items-center justify-center p-2">
                  <img
                    src={logoUrl}
                    alt="Agency logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  {t.removeLogo}
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-48 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 flex flex-col items-center justify-center cursor-pointer transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">{t.uploadLogo}</span>
                  </>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-3">
            <Label>{t.colorLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.colorHint}</p>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#7c3aed"
                className="w-32 font-mono"
              />
              <div
                className="h-10 flex-1 rounded-lg border border-border"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}
              />
            </div>
          </div>

          {/* Font Selector */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              {t.fontLabel}
            </Label>
            <p className="text-xs text-muted-foreground">{t.fontHint}</p>
            <Select value={reportFont || '__default__'} onValueChange={(v) => setReportFont(v === '__default__' ? '' : v)}>
              <SelectTrigger className="max-w-xs" style={{ fontFamily: reportFont || 'Inter Variable, sans-serif' }}>
                <SelectValue placeholder="Par défaut (Inter)" />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((font) => (
                  <SelectItem
                    key={font.value}
                    value={font.value || '__default__'}
                    style={{ fontFamily: font.value || 'Inter Variable, sans-serif' }}
                  >
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reportFont && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 mt-2">
                <p className="text-sm text-muted-foreground mb-1">Aperçu :</p>
                <p className="text-lg font-bold" style={{ fontFamily: `${reportFont}, sans-serif` }}>
                  Audit Technique SEO — {brandName || 'Mon Agence'}
                </p>
                <p className="text-sm mt-1" style={{ fontFamily: `${reportFont}, sans-serif` }}>
                  Rapport généré automatiquement par votre plateforme d'audit.
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>{t.preview}</Label>
            <div className="rounded-xl overflow-hidden border border-border">
              <div
                className="p-4 text-center"
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)`,
                  fontFamily: reportFont ? `${reportFont}, sans-serif` : undefined,
                }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 mx-auto mb-2 object-contain" />
                ) : brandName ? (
                  <div className="text-white font-bold text-lg mb-1">{brandName}</div>
                ) : (
                  <div className="text-white font-bold text-lg mb-1">{t.previewHeader}</div>
                )}
                <div className="text-white/80 text-xs">Audit Technique SEO</div>
              </div>
              <div className="bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                {t.previewFooter}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Contact className="h-5 w-5" />
            {t.contactTitle}
            <AutoSaveIndicator status={cardStatus.contact} />
          </CardTitle>
          <CardDescription>{t.contactDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.contactFirstName}</Label>
              <Input
                value={contactFirstName}
                onChange={(e) => setContactFirstName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.contactLastName}</Label>
              <Input
                value={contactLastName}
                onChange={(e) => setContactLastName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.contactPhone}</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+33 6 00 00 00 00"
                maxLength={30}
                type="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.contactEmail}</Label>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@monagence.fr"
                maxLength={255}
                type="email"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Report Texts Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t.customTextsTitle}
            <AutoSaveIndicator status={cardStatus.texts} />
          </CardTitle>
          <CardDescription>{t.customTextsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.reportHeaderLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.reportHeaderHint}</p>
            <textarea
              value={reportHeaderText}
              onChange={(e) => setReportHeaderText(e.target.value.slice(0, 500))}
              placeholder={t.reportHeaderPlaceholder}
              maxLength={500}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{reportHeaderText.length}/500</p>
          </div>
          <div className="space-y-2">
            <Label>{t.reportFooterLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.reportFooterHint}</p>
            <textarea
              value={reportFooterText}
              onChange={(e) => setReportFooterText(e.target.value.slice(0, 500))}
              placeholder={t.reportFooterPlaceholder}
              maxLength={500}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{reportFooterText.length}/500</p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
