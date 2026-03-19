import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { DEFAULT_THEME } from "@/hooks/useCocoonTheme";

const translations = {
  fr: {
    title: "Thème Cocoon",
    description: "Personnalisez les couleurs des nœuds et des particules pour votre équipe.",
    nodeColorsTitle: "Couleurs des nœuds",
    nodeColorsDesc: "Chaque type de page est représenté par un point coloré dans le graphe.",
    particleColorsTitle: "Couleurs des particules",
    particleColorsDesc: "Les flux de particules entre les nœuds indiquent le type de liaison.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Thème Cocoon sauvegardé",
    error: "Erreur lors de la sauvegarde",
    reset: "Réinitialiser",
    resetDone: "Couleurs réinitialisées",
  },
  en: {
    title: "Cocoon Theme",
    description: "Customize node and particle colors for your team.",
    nodeColorsTitle: "Node Colors",
    nodeColorsDesc: "Each page type is represented by a colored dot in the graph.",
    particleColorsTitle: "Particle Colors",
    particleColorsDesc: "Particle flows between nodes indicate the type of connection.",
    save: "Save",
    saving: "Saving…",
    saved: "Cocoon theme saved",
    error: "Error saving theme",
    reset: "Reset",
    resetDone: "Colors reset",
  },
  es: {
    title: "Tema Cocoon",
    description: "Personalice los colores de nodos y partículas para su equipo.",
    nodeColorsTitle: "Colores de nodos",
    nodeColorsDesc: "Cada tipo de página está representado por un punto de color en el gráfico.",
    particleColorsTitle: "Colores de partículas",
    particleColorsDesc: "Los flujos de partículas entre nodos indican el tipo de conexión.",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Tema Cocoon guardado",
    error: "Error al guardar el tema",
    reset: "Restablecer",
    resetDone: "Colores restablecidos",
  },
};

const NODE_TYPE_LABELS: Record<string, Record<string, string>> = {
  homepage: { fr: "Accueil", en: "Home", es: "Inicio" },
  blog: { fr: "Blog", en: "Blog", es: "Blog" },
  produit: { fr: "Produit", en: "Product", es: "Producto" },
  "catégorie": { fr: "Catégorie", en: "Category", es: "Categoría" },
  faq: { fr: "FAQ", en: "FAQ", es: "FAQ" },
  contact: { fr: "Contact", en: "Contact", es: "Contacto" },
  tarifs: { fr: "Tarifs", en: "Pricing", es: "Precios" },
  guide: { fr: "Guide", en: "Guide", es: "Guía" },
  "légal": { fr: "Légal", en: "Legal", es: "Legal" },
  "à propos": { fr: "À propos", en: "About", es: "Acerca de" },
  page: { fr: "Page", en: "Page", es: "Página" },
  unknown: { fr: "Inconnu", en: "Unknown", es: "Desconocido" },
};

const PARTICLE_TYPE_LABELS: Record<string, Record<string, string>> = {
  authority: { fr: "Autorité", en: "Authority", es: "Autoridad" },
  semantic: { fr: "Sémantique", en: "Semantic", es: "Semántico" },
  traffic: { fr: "Trafic", en: "Traffic", es: "Tráfico" },
  hierarchy: { fr: "Hiérarchie", en: "Hierarchy", es: "Jerarquía" },
};

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border-2 border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
        />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono uppercase">{value}</span>
      </div>
    </div>
  );
}

export function CocoonTab() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const [nodeColors, setNodeColors] = useState<Record<string, string>>({ ...DEFAULT_THEME.nodeColors });
  const [particleColors, setParticleColors] = useState<Record<string, string>>({ ...DEFAULT_THEME.particleColors });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing settings
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data } = await supabase
        .from("cocoon_theme_settings" as any)
        .select("node_colors, particle_colors")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setNodeColors({ ...DEFAULT_THEME.nodeColors, ...(d.node_colors as Record<string, string>) });
        setParticleColors({ ...DEFAULT_THEME.particleColors, ...(d.particle_colors as Record<string, string>) });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("cocoon_theme_settings" as any)
      .upsert(
        {
          owner_user_id: user.id,
          node_colors: nodeColors,
          particle_colors: particleColors,
        } as any,
        { onConflict: "owner_user_id" }
      );

    setSaving(false);

    if (error) {
      toast({ title: t.error, variant: "destructive" });
    } else {
      toast({ title: t.saved });
    }
  }, [user, nodeColors, particleColors, t]);

  const handleReset = () => {
    setNodeColors({ ...DEFAULT_THEME.nodeColors });
    setParticleColors({ ...DEFAULT_THEME.particleColors });
    toast({ title: t.resetDone });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{t.title}</h3>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </div>

      {/* Node Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.nodeColorsTitle}</CardTitle>
          <CardDescription className="text-xs">{t.nodeColorsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(NODE_TYPE_LABELS).map(([key, labels]) => (
              <ColorInput
                key={key}
                label={labels[language] || labels.fr}
                value={nodeColors[key] || "#7a7a9e"}
                onChange={(v) => setNodeColors((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Particle Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.particleColorsTitle}</CardTitle>
          <CardDescription className="text-xs">{t.particleColorsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(PARTICLE_TYPE_LABELS).map(([key, labels]) => (
              <ColorInput
                key={key}
                label={labels[language] || labels.fr}
                value={particleColors[key] || "#508cff"}
                onChange={(v) => setParticleColors((prev) => ({ ...prev, [key]: v }))}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t.saving : t.save}
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          {t.reset}
        </Button>
      </div>
    </div>
  );
}
