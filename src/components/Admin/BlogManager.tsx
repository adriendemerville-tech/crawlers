import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { 
  Search, FileText, RefreshCw, Loader2, Plus, Edit, MoreVertical,
  Eye, EyeOff, Archive, Trash2, Send, FileEdit, ExternalLink
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type ArticleStatus = Database['public']['Enums']['article_status'];

interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  image_url: string | null;
  status: ArticleStatus;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<ArticleStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Brouillon', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: FileEdit },
  published: { label: 'Publié', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Eye },
  unpublished: { label: 'Dépublié', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30', icon: EyeOff },
  archived: { label: 'Archivé', color: 'bg-violet-500/10 text-violet-600 border-violet-500/30', icon: Archive },
  deleted: { label: 'Supprimé', color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: Trash2 },
};

export function BlogManager() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<BlogArticle | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    image_url: '',
    status: 'draft' as ArticleStatus,
  });

  const fetchArticles = async () => {
    setLoading(true);
    try {
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

  useEffect(() => {
    fetchArticles();
  }, []);

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCreateDialog = () => {
    setSelectedArticle(null);
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      image_url: '',
      status: 'draft',
    });
    setEditDialogOpen(true);
  };

  const openEditDialog = (article: BlogArticle) => {
    setSelectedArticle(article);
    setFormData({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt || '',
      content: article.content || '',
      image_url: article.image_url || '',
      status: article.status,
    });
    setEditDialogOpen(true);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.slug) {
      toast.error('Le titre et le slug sont requis');
      return;
    }

    setActionLoading(true);
    try {
      const articleData = {
        title: formData.title,
        slug: formData.slug,
        excerpt: formData.excerpt || null,
        content: formData.content || null,
        image_url: formData.image_url || null,
        status: formData.status,
        published_at: formData.status === 'published' ? new Date().toISOString() : null,
      };

      if (selectedArticle) {
        const { error } = await supabase
          .from('blog_articles')
          .update(articleData)
          .eq('id', selectedArticle.id);

        if (error) throw error;
        toast.success('Article mis à jour');
      } else {
        const { error } = await supabase
          .from('blog_articles')
          .insert(articleData);

        if (error) throw error;
        toast.success('Article créé');
      }

      setEditDialogOpen(false);
      fetchArticles();
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (article: BlogArticle, newStatus: ArticleStatus) => {
    setActionLoading(true);
    try {
      const updateData: Partial<BlogArticle> = { status: newStatus };
      
      if (newStatus === 'published' && !article.published_at) {
        updateData.published_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blog_articles')
        .update(updateData)
        .eq('id', article.id);

      if (error) throw error;
      
      toast.success(`Article ${STATUS_CONFIG[newStatus].label.toLowerCase()}`);
      fetchArticles();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors du changement de statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePermanentDelete = async (article: BlogArticle) => {
    if (!confirm('Supprimer définitivement cet article ?')) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('blog_articles')
        .delete()
        .eq('id', article.id);

      if (error) throw error;
      
      toast.success('Article supprimé définitivement');
      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  };

  const statusCounts = articles.reduce((acc, article) => {
    acc[article.status] = (acc[article.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gestion du Blog
            </CardTitle>
            <CardDescription>
              {articles.length} articles au total
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchArticles} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvel article
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Tous ({articles.length})
          </Button>
          {(Object.keys(STATUS_CONFIG) as ArticleStatus[]).map(status => {
            const config = STATUS_CONFIG[status];
            const count = statusCounts[status] || 0;
            return (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="gap-1"
              >
                <config.icon className="h-3 w-3" />
                {config.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre ou slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun article trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredArticles.map((article) => {
                    const statusConfig = STATUS_CONFIG[article.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {article.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          /{article.slug}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(article.updated_at).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(article)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              {article.status === 'published' && (
                                <DropdownMenuItem asChild>
                                  <a href={`/blog/${article.slug}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Voir sur le site
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              
                              {/* Status transitions */}
                              {article.status === 'draft' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(article, 'published')}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Publier
                                </DropdownMenuItem>
                              )}
                              {article.status === 'published' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(article, 'unpublished')}>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Dépublier
                                </DropdownMenuItem>
                              )}
                              {(article.status === 'unpublished' || article.status === 'draft') && (
                                <DropdownMenuItem onClick={() => handleStatusChange(article, 'published')}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Publier
                                </DropdownMenuItem>
                              )}
                              {article.status !== 'archived' && article.status !== 'deleted' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(article, 'archived')}>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archiver
                                </DropdownMenuItem>
                              )}
                              {article.status === 'archived' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(article, 'draft')}>
                                  <FileEdit className="h-4 w-4 mr-2" />
                                  Remettre en brouillon
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              {article.status !== 'deleted' ? (
                                <DropdownMenuItem 
                                  onClick={() => handleStatusChange(article, 'deleted')}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem onClick={() => handleStatusChange(article, 'draft')}>
                                    <FileEdit className="h-4 w-4 mr-2" />
                                    Restaurer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handlePermanentDelete(article)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer définitivement
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit/Create Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedArticle ? 'Modifier l\'article' : 'Nouvel article'}
              </DialogTitle>
              <DialogDescription>
                {selectedArticle ? `Modifier "${selectedArticle.title}"` : 'Créer un nouvel article de blog'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Titre de l'article"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="url-de-l-article"
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Extrait</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Description courte de l'article..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Contenu</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Contenu de l'article (Markdown supporté)..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as ArticleStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CONFIG) as ArticleStatus[]).map(status => {
                        const config = STATUS_CONFIG[status];
                        return (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={actionLoading}>
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {selectedArticle ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
