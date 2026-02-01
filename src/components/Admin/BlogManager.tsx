import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCcw, Loader2, FileText, Eye, Archive, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

type ArticleStatus = 'draft' | 'published' | 'unpublished' | 'archived' | 'deleted';

interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

const statusConfig: Record<ArticleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  published: { label: 'Publié', variant: 'default' },
  unpublished: { label: 'Dépublié', variant: 'outline' },
  archived: { label: 'Archivé', variant: 'secondary' },
  deleted: { label: 'Supprimé', variant: 'destructive' },
};

export function BlogManager() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  async function fetchArticles() {
    setLoading(true);
    const { data, error } = await supabase
      .from('blog_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erreur lors du chargement des articles');
      console.error(error);
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  }

  async function updateArticleStatus(articleId: string, newStatus: ArticleStatus) {
    setActionLoading(articleId);
    
    const updateData: Partial<BlogArticle> = { status: newStatus };
    if (newStatus === 'published') {
      updateData.published_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('blog_articles')
      .update(updateData)
      .eq('id', articleId);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    } else {
      toast.success(`Article ${statusConfig[newStatus].label.toLowerCase()}`);
      fetchArticles();
    }
    setActionLoading(null);
  }

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          article.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || article.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = articles.reduce((acc, article) => {
    acc[article.status] = (acc[article.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gestionnaire d'articles
          </span>
          <div className="flex gap-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <Badge key={status} variant={statusConfig[status as ArticleStatus]?.variant || 'secondary'}>
                {statusConfig[status as ArticleStatus]?.label}: {count}
              </Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par titre ou slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ArticleStatus | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="published">Publiés</SelectItem>
              <SelectItem value="unpublished">Dépubliés</SelectItem>
              <SelectItem value="archived">Archivés</SelectItem>
              <SelectItem value="deleted">Supprimés</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchArticles}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-md border">
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
                {filteredArticles.map((article) => (
                  <TableRow key={article.id} className={article.status === 'deleted' ? 'opacity-50' : ''}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {article.title}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {article.slug}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[article.status].variant}>
                        {statusConfig[article.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {article.published_at 
                        ? new Date(article.published_at).toLocaleDateString('fr-FR')
                        : new Date(article.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {actionLoading === article.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            {article.status !== 'published' && article.status !== 'deleted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateArticleStatus(article.id, 'published')}
                                title="Publier"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {article.status === 'published' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateArticleStatus(article.id, 'unpublished')}
                                title="Dépublier"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {article.status !== 'archived' && article.status !== 'deleted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateArticleStatus(article.id, 'archived')}
                                title="Archiver"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                            {article.status !== 'deleted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateArticleStatus(article.id, 'deleted')}
                                title="Supprimer"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {article.status === 'deleted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateArticleStatus(article.id, 'draft')}
                                title="Restaurer"
                              >
                                <RefreshCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredArticles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun article trouvé
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
