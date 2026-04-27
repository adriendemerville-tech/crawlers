import { useState, useEffect, useMemo } from 'react';
import { GuidesManagement } from './GuidesManagement';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  FileText, Plus, Edit, Trash2, Eye, EyeOff, Archive, 
  Send, RotateCcw, Search, Calendar, User, Image, Link,
  CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Download, Upload, ExternalLink, Info,
  Layout, Swords
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { blogArticles } from '@/data/blogArticles';
import { getExtractedContent } from '@/data/articleContentExtractor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ArticleStatus = Database['public']['Enums']['article_status'];
type BlogArticle = Database['public']['Tables']['blog_articles']['Row'];

interface ArticleFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image_url: string;
  status: ArticleStatus;
}

const STATUS_CONFIG: Record<ArticleStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Brouillon', color: 'bg-muted text-muted-foreground', icon: Clock },
  published: { label: 'Publié', color: 'bg-success/10 text-success', icon: CheckCircle },
  unpublished: { label: 'Dépublié', color: 'bg-warning/10 text-warning', icon: EyeOff },
  archived: { label: 'Archivé', color: 'bg-secondary text-secondary-foreground', icon: Archive },
  deleted: { label: 'Supprimé', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

const INITIAL_FORM: ArticleFormData = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  image_url: '',
  status: 'draft',
};

export function BlogManagement() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<BlogArticle | null>(null);
  const [formData, setFormData] = useState<ArticleFormData>(INITIAL_FORM);

  useEffect(() => {
    fetchArticles();
  }, []);

  // Calculate static articles not yet in database
  const staticArticlesNotImported = useMemo(() => {
    const dbSlugs = new Set(articles.map(a => a.slug));
    return blogArticles.filter(article => !dbSlugs.has(article.slug));
  }, [articles]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Erreur lors du chargement des articles');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: editingArticle ? prev.slug : generateSlug(title),
    }));
  };

  const openEditor = (article?: BlogArticle) => {
    if (article) {
      setEditingArticle(article);
      setFormData({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt || '',
        content: article.content || '',
        image_url: article.image_url || '',
        status: article.status,
      });
    } else {
      setEditingArticle(null);
      setFormData(INITIAL_FORM);
    }
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingArticle(null);
    setFormData(INITIAL_FORM);
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast.error('Le titre et le slug sont obligatoires');
      return;
    }

    try {
      setSaving(true);
      
      const articleData = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        excerpt: formData.excerpt.trim() || null,
        content: formData.content.trim() || null,
        image_url: formData.image_url.trim() || null,
        status: formData.status,
        published_at: formData.status === 'published' ? new Date().toISOString() : null,
      };

      if (editingArticle) {
        const { error } = await supabase
          .from('blog_articles')
          .update(articleData)
          .eq('id', editingArticle.id);

        if (error) throw error;
        toast.success('Article mis à jour');
      } else {
        const { error } = await supabase
          .from('blog_articles')
          .insert(articleData);

        if (error) throw error;
        toast.success('Article créé');
      }

      await fetchArticles();
      closeEditor();
    } catch (error: any) {
      console.error('Error saving article:', error);
      if (error.code === '23505') {
        toast.error('Ce slug existe déjà');
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (article: BlogArticle, newStatus: ArticleStatus) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'published' && article.status !== 'published') {
        updateData.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blog_articles')
        .update(updateData)
        .eq('id', article.id);

      if (error) throw error;
      
      toast.success(`Article ${STATUS_CONFIG[newStatus].label.toLowerCase()}`);
      await fetchArticles();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors du changement de statut');
    }
  };

  const confirmDelete = (article: BlogArticle) => {
    setArticleToDelete(article);
    setIsDeleteDialogOpen(true);
  };

  const handlePermanentDelete = async () => {
    if (!articleToDelete) return;

    try {
      const { error } = await supabase
        .from('blog_articles')
        .delete()
        .eq('id', articleToDelete.id);

      if (error) throw error;
      
      toast.success('Article supprimé définitivement');
      await fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleteDialogOpen(false);
      setArticleToDelete(null);
    }
  };

  const handleAddToParmenion = async (article: BlogArticle) => {
    try {
      const targetUrl = `https://crawlers.fr/blog/${article.slug}`;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Non authentifié'); return; }

      const { data: existing } = await supabase
        .from('architect_workbench')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_url', targetUrl)
        .in('status', ['pending', 'in_progress'])
        .limit(1);

      if (existing && existing.length > 0) {
        toast.info('Déjà dans le plan Parménion');
        return;
      }

      const { error } = await supabase.from('architect_workbench').insert({
        user_id: user.id,
        domain: 'crawlers.fr',
        title: `Optimiser : ${article.title}`,
        description: `Article CMS ajouté manuellement au plan Parménion (Glaive)`,
        target_url: targetUrl,
        finding_category: 'content',
        severity: 'medium',
        source_type: 'audit_strategic' as const,
        source_function: 'cms-glaive',
        status: 'pending' as const,
      });

      if (error) throw error;
      toast.success('Ajouté au plan Parménion');
    } catch (e: any) {
      console.error('Parmenion add error:', e);
      toast.error('Erreur ajout Parménion');
    }
  };

  const handleImportStaticArticle = async (staticArticle: typeof blogArticles[0]) => {
    try {
      setImporting(true);
      
      // Récupérer le contenu HTML complet extrait
      const extractedHtml = getExtractedContent(staticArticle.slug, 'fr');
      const fullContent = extractedHtml || staticArticle.summaryPoints.fr.join('\n\n');
      
      const articleData = {
        title: staticArticle.title.fr,
        slug: staticArticle.slug,
        excerpt: staticArticle.description.fr,
        content: fullContent,
        image_url: staticArticle.heroImage,
        status: 'published' as ArticleStatus,
        published_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('blog_articles')
        .insert(articleData);

      if (error) throw error;
      
      toast.success(`Article "${staticArticle.title.fr}" importé avec contenu complet`);
      await fetchArticles();
    } catch (error: any) {
      console.error('Error importing article:', error);
      if (error.code === '23505') {
        toast.error('Cet article existe déjà');
      } else {
        toast.error('Erreur lors de l\'import');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleImportAllStaticArticles = async () => {
    if (staticArticlesNotImported.length === 0) return;
    
    try {
      setImporting(true);
      
      const articlesToInsert = staticArticlesNotImported.map(article => {
        // Récupérer le contenu HTML complet extrait
        const extractedHtml = getExtractedContent(article.slug, 'fr');
        const fullContent = extractedHtml || article.summaryPoints.fr.join('\n\n');
        
        return {
          title: article.title.fr,
          slug: article.slug,
          excerpt: article.description.fr,
          content: fullContent,
          image_url: article.heroImage,
          status: 'published' as ArticleStatus,
          published_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('blog_articles')
        .insert(articlesToInsert);

      if (error) throw error;
      
      toast.success(`${staticArticlesNotImported.length} articles importés`);
      setIsImportDialogOpen(false);
      await fetchArticles();
    } catch (error) {
      console.error('Error importing articles:', error);
      toast.error('Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const filteredArticles = articles.filter(article => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = q === '' || (
      article.title.toLowerCase().includes(q) ||
      article.slug.toLowerCase().includes(q) ||
      (article.excerpt || '').toLowerCase().includes(q) ||
      (article.content || '').toLowerCase().includes(q)
    );
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = articles.reduce((acc, article) => {
    acc[article.status] = (acc[article.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="articles" className="w-full">
        <TabsList>
          <TabsTrigger value="articles" className="gap-2"><FileText className="h-4 w-4" />Articles</TabsTrigger>
          <TabsTrigger value="landings" className="gap-2"><Layout className="h-4 w-4" />Landings</TabsTrigger>
          <TabsTrigger value="guides" className="gap-2"><FileText className="h-4 w-4" />Guides</TabsTrigger>
        </TabsList>
        <TabsContent value="articles" className="space-y-6">
      {staticArticlesNotImported.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Download className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {staticArticlesNotImported.length} article{staticArticlesNotImported.length > 1 ? 's' : ''} statique{staticArticlesNotImported.length > 1 ? 's' : ''} disponible{staticArticlesNotImported.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Importez les articles existants dans la base de données pour les gérer
                  </p>
                </div>
              </div>
              <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Importer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gestion CMS
              </CardTitle>
              <CardDescription>
                {articles.length} article{articles.length !== 1 ? 's' : ''} en base • {blogArticles.length} articles statiques
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => openEditor()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvel article
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre, slug, extrait ou mots-clés du contenu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Effacer la recherche"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ArticleStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts ({articles.length})</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <config.icon className="h-4 w-4" />
                      {config.label} ({statusCounts[key] || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} affiché{filteredArticles.length !== 1 ? 's' : ''}
            {(searchQuery || statusFilter !== 'all') && ` sur ${articles.length}`}
          </p>

          {/* Status Badges Summary */}
          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <Badge 
                key={key} 
                variant="outline"
                className={`cursor-pointer ${statusFilter === key ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key as ArticleStatus)}
              >
                <config.icon className="h-3 w-3 mr-1" />
                {config.label}: {statusCounts[key] || 0}
              </Badge>
            ))}
          </div>

          {/* Articles Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun article trouvé</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden overflow-x-auto -mx-3 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-[50%] sm:w-[40%]">Article</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArticles.map((article) => {
                    const statusConfig = STATUS_CONFIG[article.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={article.id} className="group">
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium line-clamp-1">{article.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">/{article.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(article.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleAddToParmenion(article)}
                              title="Parménion (Glaive) — Ajouter au plan de tâches"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-purple-500 hover:text-purple-600"
                            >
                              <Swords className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditor(article)}
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {/* Status quick actions */}
                            {article.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusChange(article, 'published')}
                                title="Publier"
                                className="text-success hover:text-success"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {article.status === 'published' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusChange(article, 'unpublished')}
                                title="Dépublier"
                                className="text-warning hover:text-warning"
                              >
                                <EyeOff className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {article.status === 'unpublished' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusChange(article, 'published')}
                                title="Republier"
                                className="text-success hover:text-success"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {article.status !== 'archived' && article.status !== 'deleted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusChange(article, 'archived')}
                                title="Archiver"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {article.status === 'archived' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusChange(article, 'draft')}
                                title="Désarchiver"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            
                            {article.status !== 'deleted' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStatusChange(article, 'deleted')}
                                title="Supprimer (corbeille)"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleStatusChange(article, 'draft')}
                                  title="Restaurer"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => confirmDelete(article)}
                                  title="Supprimer définitivement"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
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
        <DialogContent className="max-w-7xl w-[98vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle>
              {editingArticle ? 'Modifier l\'article' : 'Nouvel article'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Title & Slug */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Le titre de votre article"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slug">Slug *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">/blog/</span>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="url-de-larticle"
                    className="pl-14"
                  />
                </div>
              </div>
            </div>

            {/* Status & Image */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="status">Statut</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, status: v as ArticleStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <config.icon className="h-4 w-4" />
                          {config.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="image_url">URL de l'image</Label>
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    placeholder="https://..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Excerpt */}
            <div className="space-y-1">
              <Label htmlFor="excerpt">Extrait / Description</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Un court résumé de l'article pour le SEO et les aperçus..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {formData.excerpt.length}/160 caractères recommandés
              </p>
            </div>

            {/* Content */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Contenu de l'article (HTML)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => {
                    const textarea = document.getElementById('content') as HTMLTextAreaElement;
                    if (!textarea) return;
                    
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selectedText = formData.content.substring(start, end);
                    
                    if (!selectedText) {
                      toast.info('Sélectionnez d\'abord du texte dans le contenu');
                      return;
                    }
                    
                    const url = prompt('URL du lien :', 'https://');
                    if (!url) return;
                    
                    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${selectedText}</a>`;
                    const newContent = formData.content.substring(0, start) + linkHtml + formData.content.substring(end);
                    setFormData(prev => ({ ...prev, content: newContent }));
                    toast.success('Lien ajouté');
                  }}
                >
                  <Link className="h-3.5 w-3.5" />
                  Ajouter un lien
                </Button>
              </div>
              
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Rédigez le contenu complet de votre article ici en HTML...

Exemple de structure :
<p class='lead'>Introduction de l'article...</p>

<h2>Premier chapitre</h2>
<p>Paragraphe de contenu...</p>

<h2>Deuxième chapitre</h2>
<ul>
  <li><strong>Point clé</strong> : Description</li>
  <li><strong>Autre point</strong> : Description</li>
</ul>

<blockquote>Citation importante</blockquote>"
                className="font-mono text-sm min-h-[350px] resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {formData.content.length} caractères • HTML (h2, p, ul, li, blockquote, strong, a)
              </p>
            </div>

            {/* Image Preview */}
            {formData.image_url && (
              <div className="space-y-1">
                <Label>Aperçu de l'image</Label>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted max-h-40">
                  <img
                    src={formData.image_url}
                    alt="Aperçu"
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingArticle ? 'Mettre à jour' : 'Créer l\'article'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Suppression définitive
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement cet article ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          
          {articleToDelete && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{articleToDelete.title}</p>
              <p className="text-sm text-muted-foreground font-mono">/{articleToDelete.slug}</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete}>
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Static Articles Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importer les articles statiques
            </DialogTitle>
            <DialogDescription>
              Ces articles existent dans le code mais pas encore dans la base de données.
              Importez-les pour les gérer via l'interface admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {staticArticlesNotImported.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                <p>Tous les articles statiques ont été importés !</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staticArticlesNotImported.map((article) => (
                        <TableRow key={article.slug}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium line-clamp-1">{article.title.fr}</p>
                              <p className="text-xs text-muted-foreground font-mono">/{article.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={article.type === 'pillar' ? 'default' : 'secondary'}>
                              {article.type === 'pillar' ? 'Pilier' : 'Satellite'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                title="Voir l'article"
                              >
                                <a href={`/blog/${article.slug}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleImportStaticArticle(article)}
                                disabled={importing}
                              >
                                {importing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Fermer
            </Button>
            {staticArticlesNotImported.length > 0 && (
              <Button onClick={handleImportAllStaticArticles} disabled={importing} className="gap-2">
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importer tous ({staticArticlesNotImported.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
        <TabsContent value="landings" className="space-y-6">
          <LandingPagesManagement />
        </TabsContent>
        <TabsContent value="guides" className="space-y-6">
          <GuidesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Landing Pages Management Sub-Component ──

function LandingPagesManagement() {
  const [landings, setLandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingLanding, setEditingLanding] = useState<any | null>(null);
  const [formData, setFormData] = useState({ title: '', slug: '', meta_title: '', meta_description: '', content: '', target_keyword: '', status: 'draft' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchLandings(); }, []);

  const fetchLandings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('seo_page_drafts' as any)
      .select('*')
      .eq('page_type', 'landing')
      .order('created_at', { ascending: false });
    if (!error) setLandings((data as any[]) || []);
    setLoading(false);
  };

  const generateSlug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

  const openEditor = (l?: any) => {
    if (l) {
      setEditingLanding(l);
      setFormData({ title: l.title || '', slug: l.slug || '', meta_title: l.meta_title || '', meta_description: l.meta_description || '', content: l.content || '', target_keyword: l.target_keyword || '', status: l.status || 'draft' });
    } else {
      setEditingLanding(null);
      setFormData({ title: '', slug: '', meta_title: '', meta_description: '', content: '', target_keyword: '', status: 'draft' });
    }
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast.error('Titre requis'); return; }
    setSaving(true);
    const slug = formData.slug || generateSlug(formData.title);
    const payload: any = { ...formData, slug, page_type: 'landing', domain: 'crawlers.fr', published_at: formData.status === 'published' ? new Date().toISOString() : null };
    
    try {
      if (editingLanding) {
        const { error } = await supabase.from('seo_page_drafts' as any).update(payload).eq('id', editingLanding.id);
        if (error) throw error;
        toast.success('Landing page mise à jour');
      } else {
        const { error } = await supabase.from('seo_page_drafts' as any).insert(payload);
        if (error) throw error;
        toast.success('Landing page créée');
      }
      setIsEditorOpen(false);
      fetchLandings();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('seo_page_drafts' as any).delete().eq('id', id);
    if (error) toast.error('Erreur suppression');
    else { toast.success('Supprimée'); fetchLandings(); }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === 'published') updateData.published_at = new Date().toISOString();
    const { error } = await supabase.from('seo_page_drafts' as any).update(updateData).eq('id', id);
    if (!error) { toast.success('Statut mis à jour'); fetchLandings(); }
  };

  const filtered = landings.filter(l => {
    const matchSearch = (l.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const STATUS_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
    draft: { label: 'Brouillon', icon: Clock },
    published: { label: 'Publiée', icon: CheckCircle },
    archived: { label: 'Archivée', icon: Archive },
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Layout className="h-5 w-5" />Landing Pages</CardTitle>
              <CardDescription>{landings.length} landing page{landings.length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <Button onClick={() => openEditor()} className="gap-2"><Plus className="h-4 w-4" />Nouvelle landing</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="published">Publiées</SelectItem>
                <SelectItem value="archived">Archivées</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Layout className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Aucune landing page</p></div>
          ) : (
            <div className="rounded-lg border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Mot-clé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(l => {
                    const st = STATUS_LABELS[l.status] || STATUS_LABELS.draft;
                    const StIcon = st.icon;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium line-clamp-1">{l.title}</p>
                            <p className="text-xs text-muted-foreground font-mono">/landing/{l.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.target_keyword || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline"><StIcon className="h-3 w-3 mr-1" />{st.label}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {new Date(l.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditor(l)}><Edit className="h-4 w-4" /></Button>
                            {l.status === 'draft' && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(l.id, 'published')}><Eye className="h-4 w-4" /></Button>
                            )}
                            {l.status === 'published' && (
                              <Button size="sm" variant="ghost" onClick={() => handleStatusChange(l.id, 'draft')}><EyeOff className="h-4 w-4" /></Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(l.id)}><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLanding ? 'Modifier la landing' : 'Nouvelle landing page'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value, slug: editingLanding ? p.slug : generateSlug(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input value={formData.meta_title} onChange={e => setFormData(p => ({ ...p, meta_title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Mot-clé cible</Label>
                <Input value={formData.target_keyword} onChange={e => setFormData(p => ({ ...p, target_keyword: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea value={formData.meta_description} onChange={e => setFormData(p => ({ ...p, meta_description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Contenu (HTML/Markdown)</Label>
              <Textarea value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))} rows={12} className="font-mono text-sm" />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
