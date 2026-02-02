import { useState, useEffect } from 'react';
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
  CheckCircle, XCircle, Clock, AlertTriangle, Loader2
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<BlogArticle | null>(null);
  const [formData, setFormData] = useState<ArticleFormData>(INITIAL_FORM);

  useEffect(() => {
    fetchArticles();
  }, []);

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

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          article.slug.toLowerCase().includes(searchQuery.toLowerCase());
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
      {/* Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Gestion du Blog
              </CardTitle>
              <CardDescription>
                {articles.length} article{articles.length !== 1 ? 's' : ''} au total
              </CardDescription>
            </div>
            <Button onClick={() => openEditor()} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvel article
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par titre ou slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ArticleStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
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
          </div>

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
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Article</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArticles.map((article) => {
                    const statusConfig = STATUS_CONFIG[article.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={article.id}>
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
                        <TableCell className="text-sm text-muted-foreground">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? 'Modifier l\'article' : 'Nouvel article'}
            </DialogTitle>
            <DialogDescription>
              {editingArticle 
                ? 'Modifiez les informations de l\'article' 
                : 'Créez un nouvel article de blog'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Title & Slug */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Le titre de votre article"
                />
              </div>
              <div className="space-y-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
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
              <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="excerpt">Extrait / Description</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Un court résumé de l'article pour le SEO et les aperçus..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {formData.excerpt.length}/160 caractères recommandés
              </p>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Contenu (Markdown/HTML)</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Le contenu complet de votre article..."
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {formData.content.length} caractères
              </p>
            </div>

            {/* Image Preview */}
            {formData.image_url && (
              <div className="space-y-2">
                <Label>Aperçu de l'image</Label>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
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
    </div>
  );
}
