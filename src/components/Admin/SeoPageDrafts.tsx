import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FileText, Check, Trash2, Loader2, ChevronDown, ChevronRight, RefreshCw, Eye, Globe, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PageDraft {
  id: string;
  page_type: string;
  domain: string | null;
  target_keyword: string | null;
  title: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  content: string;
  status: string;
  review_note: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  published: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export function SeoPageDrafts() {
  const [drafts, setDrafts] = useState<PageDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'draft' | 'approved' | 'published' | 'all'>('draft');

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('seo_page_drafts' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDrafts((data as unknown as PageDraft[]) || []);
    } catch (e) {
      console.error('Error fetching drafts:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleApprove = async (draft: PageDraft) => {
    setActionLoading(draft.id);
    try {
      await supabase
        .from('seo_page_drafts' as any)
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_note: reviewNotes[draft.id] || null,
        } as any)
        .eq('id', draft.id);

      toast.success('Brouillon approuvé');
      fetchDrafts();
    } catch (e) {
      console.error('Approve error:', e);
      toast.error("Erreur lors de l'approbation");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (draft: PageDraft) => {
    setActionLoading(draft.id);
    try {
      // For articles, also insert into blog_articles
      if (draft.page_type === 'article') {
        const { error } = await supabase.from('blog_articles').insert({
          title: draft.title,
          slug: draft.slug,
          content: draft.content,
          excerpt: draft.meta_description || draft.content.substring(0, 160),
          status: 'published',
          published_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      // For landings, the route /landing/[slug] reads directly from seo_page_drafts

      await supabase
        .from('seo_page_drafts' as any)
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        } as any)
        .eq('id', draft.id);

      const url = draft.page_type === 'article' ? `/blog/${draft.slug}` : `/landing/${draft.slug}`;
      toast.success(`Publié sur ${url}`, { description: 'Page indexable et accessible.' });
      fetchDrafts();
    } catch (e: any) {
      console.error('Publish error:', e);
      toast.error(`Erreur publication: ${e.message || 'Erreur'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (draft: PageDraft) => {
    setActionLoading(draft.id);
    try {
      await supabase
        .from('seo_page_drafts' as any)
        .update({
          status: 'approved',
          published_at: null,
        } as any)
        .eq('id', draft.id);

      // If article, also unpublish from blog_articles
      if (draft.page_type === 'article') {
        await supabase
          .from('blog_articles')
          .update({ status: 'draft' })
          .eq('slug', draft.slug);
      }

      toast.success('Page dépubliée');
      fetchDrafts();
    } catch (e) {
      console.error('Unpublish error:', e);
      toast.error("Erreur lors de la dépublication");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await supabase
        .from('seo_page_drafts' as any)
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          review_note: reviewNotes[id] || null,
        } as any)
        .eq('id', id);

      toast.success('Brouillon rejeté');
      fetchDrafts();
    } catch (e) {
      console.error('Reject error:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await supabase.from('seo_page_drafts' as any).delete().eq('id', id);
      toast.success('Brouillon supprimé');
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const draftCount = drafts.filter(d => d.status === 'draft').length;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Brouillons Agent SEO
                {draftCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0">
                    {draftCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Pages générées par l'Agent SEO — validation requise
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchDrafts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex gap-1.5 mt-3">
          {(['draft', 'approved', 'published', 'all'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setFilter(f)}
            >
              {f === 'draft' ? 'En attente' : f === 'approved' ? 'Approuvées' : f === 'published' ? '🌐 Publiées' : 'Toutes'}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucun brouillon {filter !== 'all' ? `(${filter})` : ''}
          </div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-3">
              {drafts.map(draft => (
                <Collapsible
                  key={draft.id}
                  open={expandedId === draft.id}
                  onOpenChange={(open) => setExpandedId(open ? draft.id : null)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="w-full p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left">
                      <div className="pt-0.5">
                        {expandedId === draft.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{draft.title}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 ${STATUS_COLORS[draft.status] || ''}`}>
                            {draft.status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5">
                            {draft.page_type === 'article' ? '📝 Article' : '🚀 Landing'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono">/{draft.slug}</span>
                          {draft.target_keyword && (
                            <>
                              <span>·</span>
                              <span>🎯 {draft.target_keyword}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{format(new Date(draft.created_at), 'dd MMM HH:mm', { locale: fr })}</span>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3 border-t pt-3">
                        {/* Meta */}
                        {draft.meta_title && (
                          <div className="text-xs space-y-1">
                            <p className="font-medium">Meta Title</p>
                            <p className="text-muted-foreground bg-muted/30 rounded p-1.5">{draft.meta_title}</p>
                          </div>
                        )}
                        {draft.meta_description && (
                          <div className="text-xs space-y-1">
                            <p className="font-medium">Meta Description</p>
                            <p className="text-muted-foreground bg-muted/30 rounded p-1.5">{draft.meta_description}</p>
                          </div>
                        )}

                        {/* Content preview */}
                        <div className="space-y-1">
                          <p className="text-xs font-medium flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5" /> Contenu ({draft.content.split(/\s+/).length} mots)
                          </p>
                          <ScrollArea className="max-h-[300px]">
                            <pre className="text-xs font-mono bg-muted/50 rounded p-3 whitespace-pre-wrap break-words">
                              {draft.content}
                            </pre>
                          </ScrollArea>
                        </div>

                        {/* Actions for drafts */}
                        {draft.status === 'draft' && (
                          <div className="space-y-2">
                            <Textarea
                              placeholder="Note de review (optionnel)..."
                              value={reviewNotes[draft.id] || ''}
                              onChange={(e) => setReviewNotes(prev => ({ ...prev, [draft.id]: e.target.value }))}
                              className="text-xs h-16 resize-none"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => handleApprove(draft)}
                                disabled={actionLoading === draft.id}
                              >
                                {actionLoading === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                Approuver
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5 text-xs"
                                onClick={() => handleReject(draft.id)}
                                disabled={actionLoading === draft.id}
                              >
                                Rejeter
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 text-xs text-destructive"
                                onClick={() => handleDelete(draft.id)}
                                disabled={actionLoading === draft.id}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Publish button for approved */}
                        {draft.status === 'approved' && (
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handlePublish(draft)}
                            disabled={actionLoading === draft.id}
                          >
                            {actionLoading === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                            Publier sur {draft.page_type === 'article' ? `/blog/${draft.slug}` : `/landing/${draft.slug}`}
                          </Button>
                        )}

                        {/* Unpublish button for published */}
                        {draft.status === 'published' && (
                          <div className="flex items-center gap-2">
                            <a
                              href={draft.page_type === 'article' ? `/blog/${draft.slug}` : `/landing/${draft.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary underline"
                            >
                              🔗 Voir la page publiée
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs text-destructive border-destructive/30"
                              onClick={() => handleUnpublish(draft)}
                              disabled={actionLoading === draft.id}
                            >
                              {actionLoading === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                              Dépublier
                            </Button>
                          </div>
                        )}

                        {draft.review_note && draft.status !== 'draft' && (
                          <div className="text-xs text-muted-foreground italic bg-muted/20 rounded p-2">
                            Note : {draft.review_note}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
