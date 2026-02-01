import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Edit2, Trash2, Eye, Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type ArticleStatus = 'draft' | 'published' | 'unpublished' | 'archived' | 'deleted';

interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: ArticleStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface AdminBlogManagerProps {
  language: 'fr' | 'en' | 'es';
}

const statusColors: Record<ArticleStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  unpublished: 'bg-gray-100 text-gray-800',
  archived: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
};

const translations = {
  fr: {
    search: 'Rechercher un article...',
    title: 'Titre',
    status: 'Statut',
    created: 'Créé le',
    updated: 'Modifié le',
    actions: 'Actions',
    newArticle: 'Nouvel article',
    edit: 'Modifier',
    delete: 'Supprimer',
    publish: 'Publier',
    unpublish: 'Dépublier',
    archive: 'Archiver',
    slug: 'Slug URL',
    excerpt: 'Extrait',
    content: 'Contenu',
    save: 'Enregistrer',
    cancel: 'Annuler',
    noArticles: 'Aucun article trouvé',
    loading: 'Chargement...',
    filterAll: 'Tous',
    filterDraft: 'Brouillons',
    filterPublished: 'Publiés',
    filterUnpublished: 'Dépubliés',
    filterArchived: 'Archivés',
    filterDeleted: 'Supprimés',
    createSuccess: 'Article créé',
    updateSuccess: 'Article mis à jour',
    error: 'Erreur',
  },
  en: {
    search: 'Search article...',
    title: 'Title',
    status: 'Status',
    created: 'Created',
    updated: 'Updated',
    actions: 'Actions',
    newArticle: 'New article',
    edit: 'Edit',
    delete: 'Delete',
    publish: 'Publish',
    unpublish: 'Unpublish',
    archive: 'Archive',
    slug: 'URL Slug',
    excerpt: 'Excerpt',
    content: 'Content',
    save: 'Save',
    cancel: 'Cancel',
    noArticles: 'No articles found',
    loading: 'Loading...',
    filterAll: 'All',
    filterDraft: 'Drafts',
    filterPublished: 'Published',
    filterUnpublished: 'Unpublished',
    filterArchived: 'Archived',
    filterDeleted: 'Deleted',
    createSuccess: 'Article created',
    updateSuccess: 'Article updated',
    error: 'Error',
  },
  es: {
    search: 'Buscar artículo...',
    title: 'Título',
    status: 'Estado',
    created: 'Creado',
    updated: 'Actualizado',
    actions: 'Acciones',
    newArticle: 'Nuevo artículo',
    edit: 'Editar',
    delete: 'Eliminar',
    publish: 'Publicar',
    unpublish: 'Despublicar',
    archive: 'Archivar',
    slug: 'Slug URL',
    excerpt: 'Extracto',
    content: 'Contenido',
    save: 'Guardar',
    cancel: 'Cancelar',
    noArticles: 'No se encontraron artículos',
    loading: 'Cargando...',
    filterAll: 'Todos',
    filterDraft: 'Borradores',
    filterPublished: 'Publicados',
    filterUnpublished: 'Despublicados',
    filterArchived: 'Archivados',
    filterDeleted: 'Eliminados',
    createSuccess: 'Artículo creado',
    updateSuccess: 'Artículo actualizado',
    error: 'Error',
  },
};

export function AdminBlogManager({ language }: AdminBlogManagerProps) {
  const t = translations[language];
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Partial<BlogArticle> | null>(null);

  const fetchArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      toast.error(t.error);
    } else {
      setArticles(data || []);
    }
    setLoading(false);
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

  const handleStatusChange = async (article: BlogArticle, newStatus: ArticleStatus) => {
    const updateData: Partial<BlogArticle> = { status: newStatus };
    if (newStatus === 'published' && !article.published_at) {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('blog_articles')
      .update(updateData)
      .eq('id', article.id);

    if (error) {
      toast.error(t.error);
    } else {
      toast.success(t.updateSuccess);
      fetchArticles();
    }
  };

  const handleSaveArticle = async () => {
    if (!editingArticle?.title || !editingArticle?.slug) return;

    if (editingArticle.id) {
      // Update existing
      const { error } = await supabase
        .from('blog_articles')
        .update({
          title: editingArticle.title,
          slug: editingArticle.slug,
          excerpt: editingArticle.excerpt,
        })
        .eq('id', editingArticle.id);

      if (error) {
        toast.error(t.error);
      } else {
        toast.success(t.updateSuccess);
        fetchArticles();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('blog_articles')
        .insert({
          title: editingArticle.title,
          slug: editingArticle.slug,
          excerpt: editingArticle.excerpt,
          status: 'draft',
        });

      if (error) {
        toast.error(t.error);
      } else {
        toast.success(t.createSuccess);
        fetchArticles();
      }
    }
    setEditDialogOpen(false);
    setEditingArticle(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ArticleStatus | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.filterAll}</SelectItem>
            <SelectItem value="draft">{t.filterDraft}</SelectItem>
            <SelectItem value="published">{t.filterPublished}</SelectItem>
            <SelectItem value="unpublished">{t.filterUnpublished}</SelectItem>
            <SelectItem value="archived">{t.filterArchived}</SelectItem>
            <SelectItem value="deleted">{t.filterDeleted}</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingArticle({}); setEditDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {t.newArticle}
        </Button>
      </div>

      {filteredArticles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t.noArticles}</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.title}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead>{t.updated}</TableHead>
                <TableHead className="text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium max-w-[300px] truncate">
                    {article.title}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[article.status]}>
                      {article.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(article.updated_at).toLocaleDateString(language)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {article.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(article, 'published')}
                          title={t.publish}
                        >
                          <Eye className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {article.status === 'published' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusChange(article, 'unpublished')}
                          title={t.unpublish}
                        >
                          <Eye className="h-4 w-4 text-gray-400" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStatusChange(article, 'archived')}
                        title={t.archive}
                      >
                        <Archive className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingArticle(article); setEditDialogOpen(true); }}
                        title={t.edit}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStatusChange(article, 'deleted')}
                        title={t.delete}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingArticle?.id ? t.edit : t.newArticle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.title}</Label>
              <Input
                value={editingArticle?.title || ''}
                onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.slug}</Label>
              <Input
                value={editingArticle?.slug || ''}
                onChange={(e) => setEditingArticle({ ...editingArticle, slug: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.excerpt}</Label>
              <Textarea
                value={editingArticle?.excerpt || ''}
                onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditingArticle(null); }}>
              {t.cancel}
            </Button>
            <Button onClick={handleSaveArticle}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
