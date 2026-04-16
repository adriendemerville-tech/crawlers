import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Eye, EyeOff, Search, Clock, CheckCircle, Archive, Loader2, BookOpen, ExternalLink, Swords } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const GUIDE_TARGETS = [
  { value: 'artisan', label: 'Artisan' },
  { value: 'commercant', label: 'Commerçant' },
  { value: 'restaurant-hotel', label: 'Restaurant / Hôtel' },
  { value: 'btp', label: 'BTP' },
  { value: 'tpe', label: 'TPE' },
  { value: 'pme', label: 'PME' },
  { value: 'profession-liberale', label: 'Profession libérale' },
  { value: 'boutique-en-ligne', label: 'Boutique en ligne' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'startup', label: 'Startup' },
  { value: 'consultant-seo', label: 'Consultant SEO' },
  { value: 'agence-seo', label: 'Agence SEO' },
  { value: 'seo-in-house', label: 'SEO in-house' },
  { value: 'responsable-marketing', label: 'Responsable Marketing' },
  { value: 'ecommerce-manager', label: 'E-commerce Manager' },
  { value: 'content-manager', label: 'Content Manager' },
];

const CRAWLERS_TOOLS = [
  { name: 'Audit Expert', href: '/audit-expert', description: 'Audit SEO/GEO 168 critères' },
  { name: 'Score GEO', href: '/score-geo', description: 'Score de visibilité IA' },
  { name: 'Cocoon', href: '/app/cocoon', description: 'Maillage intelligent' },
  { name: 'Content Architect', href: '/content-architect', description: 'Création de contenu SEO' },
  { name: 'Autopilot', href: '/app/console', description: 'Pilote automatique SEO' },
  { name: 'Observatory', href: '/observatoire', description: 'Veille sectorielle' },
  { name: 'Conversion Optimizer', href: '/conversion-optimizer', description: 'Optimisation des conversions' },
  { name: 'PageSpeed', href: '/pagespeed', description: 'Analyse de vitesse' },
  { name: 'Breathing Spiral', href: '/breathing-spiral', description: 'Score de spirale SEO' },
  { name: 'Agency Mode', href: '/pro-agency', description: 'Gestion multi-clients' },
  { name: 'Analyse Bots IA', href: '/analyse-bots-ia', description: 'Détection crawlers IA' },
];

interface GuideFormData {
  title: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  content: string;
  target_keyword: string;
  status: string;
  guide_category: string;
  guide_target: string;
  guide_tools: { name: string; href: string; description: string }[];
  lateral_links: { slug: string; title: string; description: string }[];
}

const INITIAL_FORM: GuideFormData = {
  title: '', slug: '', meta_title: '', meta_description: '', content: '', target_keyword: '',
  status: 'draft', guide_category: 'bloc_a', guide_target: '', guide_tools: [], lateral_links: [],
};

const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  draft: { label: 'Brouillon', icon: Clock },
  published: { label: 'Publié', icon: CheckCircle },
  archived: { label: 'Archivé', icon: Archive },
};

export function GuidesManagement() {
  const { user } = useAuth();
  const [guides, setGuides] = useState<any[]>([]);
  const [allGuides, setAllGuides] = useState<{ slug: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<any | null>(null);
  const [formData, setFormData] = useState<GuideFormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchGuides(); }, []);

  const fetchGuides = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('seo_page_drafts' as any)
      .select('*')
      .eq('page_type', 'guide')
      .order('created_at', { ascending: false });
    const list = (data as any[]) || [];
    setGuides(list);
    setAllGuides(list.map(g => ({ slug: g.slug, title: g.title })));
    setLoading(false);
  };

  const generateSlug = (t: string) =>
    t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

  const openEditor = (g?: any) => {
    if (g) {
      setEditingGuide(g);
      setFormData({
        title: g.title || '', slug: g.slug || '', meta_title: g.meta_title || '',
        meta_description: g.meta_description || '', content: g.content || '',
        target_keyword: g.target_keyword || '', status: g.status || 'draft',
        guide_category: g.guide_category || 'bloc_a', guide_target: g.guide_target || '',
        guide_tools: g.guide_tools || [], lateral_links: g.lateral_links || [],
      });
    } else {
      setEditingGuide(null);
      setFormData(INITIAL_FORM);
    }
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast.error('Titre requis'); return; }
    setSaving(true);
    const slug = formData.slug || generateSlug(formData.title);

    const payload: any = {
      title: formData.title, slug, meta_title: formData.meta_title, meta_description: formData.meta_description,
      content: formData.content, target_keyword: formData.target_keyword, status: formData.status,
      page_type: 'guide', domain: 'crawlers.fr',
      guide_category: formData.guide_category, guide_target: formData.guide_target,
      guide_tools: formData.guide_tools, lateral_links: formData.lateral_links,
      published_at: formData.status === 'published' ? new Date().toISOString() : null,
      generation_context: {
        guide_category: formData.guide_category,
        tools: formData.guide_tools,
        lateral_links: formData.lateral_links,
        hero_cta_label: 'Lancer mon audit gratuit',
        hero_cta_href: '/audit-expert',
      },
    };

    if (!editingGuide) payload.user_id = user?.id;

    try {
      if (editingGuide) {
        const { error } = await supabase.from('seo_page_drafts' as any).update(payload).eq('id', editingGuide.id);
        if (error) throw error;
        toast.success('Guide mis à jour');
      } else {
        const { error } = await supabase.from('seo_page_drafts' as any).insert(payload);
        if (error) throw error;
        toast.success('Guide créé');
      }
      setIsEditorOpen(false);
      fetchGuides();
    } catch (e: any) { toast.error(e.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('seo_page_drafts' as any).delete().eq('id', id);
    if (error) toast.error('Erreur suppression');
    else { toast.success('Guide supprimé'); fetchGuides(); }
  };

  const handleAddToParmenion = async (guide: any) => {
    try {
      const targetUrl = `https://crawlers.fr/guide/${guide.slug}`;
      const { data: existing } = await supabase
        .from('architect_workbench')
        .select('id')
        .eq('target_url', targetUrl)
        .eq('domain', 'crawlers.fr')
        .neq('status', 'done' as any)
        .limit(1);
      if (existing && existing.length > 0) {
        toast.info('Déjà dans le plan Parménion');
        return;
      }
      const { error } = await supabase.from('architect_workbench').insert({
        user_id: user?.id,
        domain: 'crawlers.fr',
        title: `Optimiser : ${guide.title}`,
        description: `Guide SEO ajouté manuellement au plan Parménion (Glaive)`,
        target_url: targetUrl,
        finding_category: 'content',
        source_type: 'manual',
        severity: 'medium',
        status: 'open',
      } as any);
      if (error) throw error;
      toast.success('Ajouté au plan Parménion');
    } catch (e: any) {
      console.error('Parmenion add error:', e);
      toast.error('Erreur ajout Parménion');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === 'published') updateData.published_at = new Date().toISOString();
    if (newStatus === 'draft') updateData.published_at = null;
    const { error } = await supabase.from('seo_page_drafts' as any).update(updateData).eq('id', id);
    if (!error) { toast.success('Statut mis à jour'); fetchGuides(); }
  };

  const toggleTool = (tool: typeof CRAWLERS_TOOLS[0]) => {
    setFormData(p => {
      const exists = p.guide_tools.some(t => t.href === tool.href);
      return {
        ...p,
        guide_tools: exists
          ? p.guide_tools.filter(t => t.href !== tool.href)
          : [...p.guide_tools, tool],
      };
    });
  };

  const toggleLateralLink = (slug: string, title: string) => {
    setFormData(p => {
      const exists = p.lateral_links.some(l => l.slug === slug);
      return {
        ...p,
        lateral_links: exists
          ? p.lateral_links.filter(l => l.slug !== slug)
          : [...p.lateral_links, { slug, title, description: '' }],
      };
    });
  };

  const filtered = guides.filter(g => {
    const matchSearch = (g.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (g.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || g.status === statusFilter;
    const matchCategory = categoryFilter === 'all' || g.guide_category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Guides SEO/GEO</CardTitle>
              <CardDescription>{guides.length} guide{guides.length !== 1 ? 's' : ''} · {guides.filter(g => g.status === 'published').length} publié{guides.filter(g => g.status === 'published').length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <Button onClick={() => openEditor()} className="gap-2"><Plus className="h-4 w-4" />Nouveau guide</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les cibles</SelectItem>
                <SelectItem value="bloc_a">Métiers / PME-TPE</SelectItem>
                <SelectItem value="bloc_b">Pros SEO / Marketing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="published">Publiés</SelectItem>
                <SelectItem value="archived">Archivés</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun guide</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guide</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden sm:table-cell">Outils</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(g => {
                    const st = STATUS_LABELS[g.status] || STATUS_LABELS.draft;
                    const StIcon = st.icon;
                    const target = GUIDE_TARGETS.find(t => t.value === g.guide_target);
                    const toolCount = (g.guide_tools || []).length;

                    return (
                      <TableRow key={g.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium line-clamp-1">{g.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">/guide/{g.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{target?.label || g.guide_target || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {g.guide_category === 'bloc_b' ? 'Pro' : 'Métier'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline"><StIcon className="h-3 w-3 mr-1" />{st.label}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {toolCount > 0 ? `${toolCount} outil${toolCount > 1 ? 's' : ''}` : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditor(g)}><Edit className="h-4 w-4" /></Button>
                            {g.status === 'published' && (
                              <Button size="sm" variant="ghost" title="Voir" asChild>
                                <a href={`/guide/${g.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                              </Button>
                            )}
                            {g.status === 'draft' && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(g.id, 'published')} title="Publier"><Eye className="h-4 w-4" /></Button>
                            )}
                            {g.status === 'published' && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(g.id, 'draft')} title="Dépublier"><EyeOff className="h-4 w-4" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(g.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGuide ? 'Modifier le guide' : 'Nouveau guide SEO/GEO'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titre (H1)</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value, slug: editingGuide ? p.slug : generateSlug(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.guide_category} onValueChange={v => setFormData(p => ({ ...p, guide_category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bloc_a">Métiers / PME-TPE</SelectItem>
                    <SelectItem value="bloc_b">Pros SEO / Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cible</Label>
                <Select value={formData.guide_target} onValueChange={v => setFormData(p => ({ ...p, guide_target: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {GUIDE_TARGETS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="published">Publié</SelectItem>
                    <SelectItem value="archived">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Title <span className="text-xs text-muted-foreground">({formData.meta_title.length}/60)</span></Label>
                <Input value={formData.meta_title} onChange={e => setFormData(p => ({ ...p, meta_title: e.target.value }))} maxLength={70} />
              </div>
              <div className="space-y-2">
                <Label>Mot-clé cible</Label>
                <Input value={formData.target_keyword} onChange={e => setFormData(p => ({ ...p, target_keyword: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meta Description <span className="text-xs text-muted-foreground">({formData.meta_description.length}/160)</span></Label>
              <Textarea value={formData.meta_description} onChange={e => setFormData(p => ({ ...p, meta_description: e.target.value }))} rows={2} maxLength={170} />
            </div>

            {/* Tools selector */}
            <div className="space-y-2">
              <Label>Outils Crawlers mis en avant</Label>
              <div className="flex flex-wrap gap-2">
                {CRAWLERS_TOOLS.map(tool => {
                  const selected = formData.guide_tools.some(t => t.href === tool.href);
                  return (
                    <button
                      key={tool.href}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        selected
                          ? 'bg-primary/10 border-primary/40 text-primary'
                          : 'bg-card border-border/60 text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {tool.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lateral links selector */}
            {allGuides.length > 0 && (
              <div className="space-y-2">
                <Label>Maillage latéral (guides connexes)</Label>
                <div className="flex flex-wrap gap-2">
                  {allGuides
                    .filter(g => g.slug !== formData.slug)
                    .map(g => {
                      const selected = formData.lateral_links.some(l => l.slug === g.slug);
                      return (
                        <button
                          key={g.slug}
                          type="button"
                          onClick={() => toggleLateralLink(g.slug, g.title)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            selected
                              ? 'bg-primary/10 border-primary/40 text-primary'
                              : 'bg-card border-border/60 text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {g.title}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Content editor */}
            <div className="space-y-2">
              <Label>Contenu (Markdown)</Label>
              <p className="text-xs text-muted-foreground">
                Utilisez ## pour les H2, ### pour les H3, {'>'} pour les passages citables GEO
              </p>
              <Textarea
                value={formData.content}
                onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                rows={16}
                className="font-mono text-sm"
                placeholder="## Pourquoi [cible] perd des clients sans le savoir&#10;&#10;Contenu de la section...&#10;&#10;> Passage citable autonome de 40-80 mots pour les LLM.&#10;&#10;## 3 actions concrètes pour [cible]&#10;&#10;### Action 1 : ...&#10;..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
