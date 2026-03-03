import { useState, useRef } from 'react';
import { Upload, Palette, Trash2, Save, Loader2, Image as ImageIcon } from 'lucide-react';
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
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Branding sauvegardé',
    removeLogo: 'Supprimer le logo',
    uploadLogo: 'Uploader un logo',
    preview: 'Aperçu du rapport',
    previewHeader: 'En-tête personnalisé',
    previewFooter: 'Les mentions Crawlers.fr seront masquées',
    error: 'Erreur lors de la sauvegarde',
    uploadError: 'Erreur lors de l\'upload du logo',
    fileTooLarge: 'Le fichier dépasse 2 Mo',
  },
  en: {
    title: 'White Label',
    description: 'Customize your reports with your brand identity',
    logoLabel: 'Agency Logo',
    logoHint: 'Transparent PNG or SVG, max 2 MB',
    colorLabel: 'Primary Color',
    colorHint: 'Applied to report titles and CTA buttons',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Branding saved',
    removeLogo: 'Remove logo',
    uploadLogo: 'Upload a logo',
    preview: 'Report Preview',
    previewHeader: 'Custom header',
    previewFooter: 'Crawlers.fr mentions will be hidden',
    error: 'Error saving branding',
    uploadError: 'Error uploading logo',
    fileTooLarge: 'File exceeds 2 MB',
  },
  es: {
    title: 'Marca Blanca',
    description: 'Personaliza tus informes con tu identidad visual',
    logoLabel: 'Logo de la agencia',
    logoHint: 'PNG o SVG transparente, máx. 2 MB',
    colorLabel: 'Color principal',
    colorHint: 'Aplicado a títulos y botones de los informes',
    save: 'Guardar',
    saving: 'Guardando...',
    saved: 'Branding guardado',
    removeLogo: 'Eliminar logo',
    uploadLogo: 'Subir un logo',
    preview: 'Vista previa del informe',
    previewHeader: 'Encabezado personalizado',
    previewFooter: 'Las menciones de Crawlers.fr se ocultarán',
    error: 'Error al guardar el branding',
    uploadError: 'Error al subir el logo',
    fileTooLarge: 'El archivo supera los 2 MB',
  },
};

export function BrandingTab() {
  const { user, profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const [logoUrl, setLogoUrl] = useState(profile?.agency_logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(profile?.agency_primary_color || '#7c3aed');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Add cache-buster
      setLogoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success(t.saved);
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

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        agency_logo_url: logoUrl || null,
        agency_primary_color: primaryColor || null,
      })
      .eq('user_id', user.id);

    setIsSaving(false);

    if (error) {
      toast.error(t.error);
    } else {
      toast.success(t.saved);
      await refreshProfile();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* Preview */}
          <div className="space-y-2">
            <Label>{t.preview}</Label>
            <div className="rounded-xl overflow-hidden border border-border">
              <div
                className="p-4 text-center"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)` }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 mx-auto mb-2 object-contain" />
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

          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? t.saving : t.save}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
