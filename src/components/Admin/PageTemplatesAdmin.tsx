import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LayoutTemplate, Loader2, ChevronDown, ChevronRight, RefreshCw, Save, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Template {
  id: string;
  page_type: string;
  label: string;
  structure_template: string;
  seo_rules: string;
  geo_rules: string;
  tone_guidelines: string;
  system_prompt: string;
  is_active: boolean;
  version: number;
}

export function PageTemplatesAdmin() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, Partial<Template>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_prompt_templates')
        .select('*')
        .order('page_type')
        .order('version', { ascending: false });

      if (error) throw error;
      setTemplates((data as unknown as Template[]) || []);
    } catch (e) {
      console.error('Error fetching templates:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const startEdit = (t: Template) => {
    setEditState(prev => ({
      ...prev,
      [t.id]: {
        structure_template: t.structure_template,
        seo_rules: t.seo_rules,
        geo_rules: t.geo_rules,
        tone_guidelines: t.tone_guidelines,
        system_prompt: t.system_prompt,
        label: t.label,
      },
    }));
    setExpandedId(t.id);
  };

  const updateField = (id: string, field: keyof Template, value: string) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (id: string) => {
    setSaving(id);
    try {
      const updates = editState[id];
      if (!updates) return;

      const { error } = await supabase
        .from('content_prompt_templates')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Template mis à jour');
      setEditState(prev => { const n = { ...prev }; delete n[id]; return n; });
      fetchTemplates();
    } catch (e) {
      console.error('Save error:', e);
      toast.error('Erreur sauvegarde');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await supabase
        .from('content_prompt_templates')
        .update({ is_active: !isActive } as any)
        .eq('id', id);

      toast.success(`Template ${!isActive ? 'activé' : 'désactivé'}`);
      fetchTemplates();
    } catch (e) {
      console.error('Toggle error:', e);
    }
  };

  const handleCreateNew = async (pageType: 'landing' | 'article' | 'product') => {
    try {
      const labels: Record<string, string> = { landing: 'Landing Page Standard', article: 'Article Blog Standard', product: 'Fiche Produit Standard' };
      const structures: Record<string, string> = {
        landing: '# {TITRE}\n\n## {ACCROCHE}\n{paragraphe_hero}\n\n## Pourquoi {SUJET} ?\n{3_arguments}\n\n## Comment ça marche\n{étapes_numérotées}\n\n## Résultats concrets\n{chiffres_preuves}\n\n## FAQ\n{3-5_questions}\n\n## CTA\n{appel_action}',
        article: '# {TITRE}\n\n{chapô_150_mots}\n\n## {H2_1}\n{section_400_mots}\n\n## {H2_2}\n{section_400_mots}\n\n### {H3_détail}\n{sous_section}\n\n## {H2_3}\n{section_400_mots}\n\n## FAQ\n{5_questions}\n\n## Conclusion\n{résumé_CTA}',
        product: '# {NOM_PRODUIT}\n\n{description_80_mots}\n\n## Caractéristiques\n{tableau_specs}\n\n## À qui s\'adresse ce produit ?\n{personas}\n\n## Points forts et limites\n{analyse_objective}\n\n## FAQ\n{3_questions}\n\n## CTA\n{achat_devis}',
      };
      const defaultTemplate = {
        page_type: pageType,
        label: labels[pageType],
        structure_template: structures[pageType],
        seo_rules: 'Mot-clé principal dans H1, premier paragraphe et 2 H2. Meta title < 60 chars. Meta description < 160 chars avec CTA. Densité mot-clé 1-2%. Maillage interne : 3-5 liens vers pages pertinentes.',
        geo_rules: 'Passages citables (2-3 phrases autonomes résumant un concept clé). Structure FAQ pour featured snippets. Phrases "Selon [source]..." pour signaux E-E-A-T. Résumé à puces en début d\'article.',
        tone_guidelines: 'Ton expert mais accessible. Pas de jargon inutile. Exemples concrets. Voix active. Phrases courtes (< 25 mots). Pas de superlatifs vides.',
        system_prompt: `Tu es un rédacteur SEO/GEO expert. Tu crées du contenu optimisé pour les moteurs de recherche ET les LLMs (ChatGPT, Perplexity, Gemini). Chaque page doit être structurée, sourcée et citable.`,
        is_active: true,
        version: 1,
      };

      const { error } = await supabase.from('content_prompt_templates').insert(defaultTemplate as any);
      if (error) throw error;
      toast.success(`Template "${pageType}" créé`);
      fetchTemplates();
    } catch (e: any) {
      console.error('Create error:', e);
      toast.error(`Erreur: ${e.message}`);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutTemplate className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Templates de pages</CardTitle>
              <CardDescription className="text-xs">
                Costumes pré-établis pour Landing et Article
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => handleCreateNew('landing')}>
              <Plus className="h-3 w-3" /> Landing
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => handleCreateNew('article')}>
              <Plus className="h-3 w-3" /> Article
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchTemplates} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucun template. Créez-en un avec les boutons ci-dessus.
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-3">
              {templates.map(t => {
                const editing = editState[t.id];
                return (
                  <Collapsible
                    key={t.id}
                    open={expandedId === t.id}
                    onOpenChange={(open) => {
                      setExpandedId(open ? t.id : null);
                      if (open && !editing) startEdit(t);
                    }}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left">
                        {expandedId === t.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-medium text-sm flex-1">{t.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5">
                          {t.page_type === 'article' ? '📝 Article' : '🚀 Landing'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 cursor-pointer ${t.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(t.id, t.is_active); }}
                        >
                          {t.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">v{t.version}</span>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        {editing && (
                          <div className="px-3 pb-3 space-y-3 border-t pt-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Nom</Label>
                              <Input
                                className="text-xs h-8"
                                value={editing.label || ''}
                                onChange={(e) => updateField(t.id, 'label', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">System Prompt</Label>
                              <Textarea
                                className="text-xs min-h-[80px]"
                                value={editing.system_prompt || ''}
                                onChange={(e) => updateField(t.id, 'system_prompt', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Structure (template markdown)</Label>
                              <Textarea
                                className="text-xs min-h-[120px] font-mono"
                                value={editing.structure_template || ''}
                                onChange={(e) => updateField(t.id, 'structure_template', e.target.value)}
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Règles SEO</Label>
                                <Textarea
                                  className="text-xs min-h-[80px]"
                                  value={editing.seo_rules || ''}
                                  onChange={(e) => updateField(t.id, 'seo_rules', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Règles GEO</Label>
                                <Textarea
                                  className="text-xs min-h-[80px]"
                                  value={editing.geo_rules || ''}
                                  onChange={(e) => updateField(t.id, 'geo_rules', e.target.value)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Ton éditorial</Label>
                              <Textarea
                                className="text-xs min-h-[60px]"
                                value={editing.tone_guidelines || ''}
                                onChange={(e) => updateField(t.id, 'tone_guidelines', e.target.value)}
                              />
                            </div>
                            <Button
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => handleSave(t.id)}
                              disabled={saving === t.id}
                            >
                              {saving === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                              Sauvegarder
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
