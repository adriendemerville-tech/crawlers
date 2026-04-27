import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { FileEdit, Globe, Loader2, Trash2, ExternalLink, Clock, PenLine, Lock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const CocoonContentArchitectModal = lazy(() =>
  import('@/components/Cocoon/CocoonContentArchitectModal').then(m => ({ default: m.CocoonContentArchitectModal }))
);

interface Draft {
  id: string;
  domain: string;
  tracked_site_id: string | null;
  draft_data: Record<string, any>;
  source_message: string | null;
  created_at: string;
  updated_at: string;
}

interface TrackedUrl {
  domain: string;
  tracked_site_id: string;
  drafts: Draft[];
}

const translations = {
  fr: {
    title: 'Brouillons',
    noDrafts: 'Aucun brouillon',
    noDraftsDesc: 'Les brouillons créés dans Content Architect apparaîtront ici.',
    allSites: 'Tous les sites',
    delete: 'Supprimer',
    deleted: 'Brouillon supprimé',
    open: 'Ouvrir dans Content Architect',
    keyword: 'Mot-clé',
    page: 'Page',
    ago: 'il y a',
    paywallTitle: 'Fonctionnalité Pro Agency',
    paywallDesc: 'Pour consulter et reprendre vos brouillons, passez en plan Pro Agency.',
    paywallCta: 'Voir les tarifs',
  },
  en: {
    title: 'Drafts',
    noDrafts: 'No drafts',
    noDraftsDesc: 'Drafts created in Content Architect will appear here.',
    allSites: 'All sites',
    delete: 'Delete',
    deleted: 'Draft deleted',
    open: 'Open in Content Architect',
    keyword: 'Keyword',
    page: 'Page',
    ago: 'ago',
    paywallTitle: 'Pro Agency Feature',
    paywallDesc: 'To view and resume your drafts, upgrade to Pro Agency.',
    paywallCta: 'View pricing',
  },
  es: {
    title: 'Borradores',
    noDrafts: 'Sin borradores',
    noDraftsDesc: 'Los borradores creados en Content Architect aparecerán aquí.',
    allSites: 'Todos los sitios',
    delete: 'Eliminar',
    deleted: 'Borrador eliminado',
    open: 'Abrir en Content Architect',
    keyword: 'Palabra clave',
    page: 'Página',
    ago: 'hace',
    paywallTitle: 'Función Pro Agency',
    paywallDesc: 'Para ver y retomar sus borradores, pase al plan Pro Agency.',
    paywallCta: 'Ver precios',
  },
};

function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export function MyDrafts() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const t = translations[language as keyof typeof translations] || translations.fr;

  const isProUser = isAgencyPro || isAdmin;

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  // Content Architect modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState<Draft | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('cocoon_architect_drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setDrafts(data as Draft[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const deleteDraft = async (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
    const { error } = await supabase.from('cocoon_architect_drafts').delete().eq('id', id);
    if (error) { fetchDrafts(); } else { toast.success(t.deleted); }
  };

  const openDraft = (draft: Draft) => {
    setModalDraft(draft);
    setIsModalOpen(true);
  };

  // Group by domain
  const domains = Array.from(new Set(drafts.map(d => d.domain))).sort();
  const filteredDrafts = selectedDomain
    ? drafts.filter(d => d.domain === selectedDomain)
    : drafts;

  const getDraftLabel = (draft: Draft): string => {
    const data = draft.draft_data || {};
    return data.keyword || data.url || draft.source_message || 'Brouillon';
  };

  const getDraftUrl = (draft: Draft): string => {
    return draft.draft_data?.url || '';
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <FileEdit className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="font-medium">{t.noDrafts}</p>
              <p className="text-sm text-muted-foreground">{t.noDraftsDesc}</p>
            </div>
          ) : !isProUser ? (
            /* Paywall: show draft count per domain but block access */
            <div className="space-y-6">
              {/* Domain list with draft counts (blurred/locked) */}
              <div className="relative">
                <div className="blur-[3px] pointer-events-none select-none">
                  <div className="flex gap-4">
                    <div className="w-52 shrink-0 border-r pr-3">
                      {domains.map(domain => {
                        const count = drafts.filter(d => d.domain === domain).length;
                        return (
                          <div key={domain} className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3 shrink-0" />
                            <span className="truncate">{domain}</span>
                            <span className="ml-auto">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex-1 space-y-2">
                      {filteredDrafts.slice(0, 5).map(draft => (
                        <div key={draft.id} className="flex items-center gap-3 p-3 rounded-lg border">
                          <FileEdit className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{getDraftLabel(draft)}</p>
                            <p className="text-xs text-muted-foreground">{draft.domain}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Overlay CTA */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
                  <Lock className="h-8 w-8 text-primary mb-3" />
                  <p className="font-semibold text-base mb-1">{t.paywallTitle}</p>
                  <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">{t.paywallDesc}</p>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    onClick={() => navigate('/tarifs')}
                  >
                    {t.paywallCta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Drafts list */}
              <div className="space-y-2 min-w-0 max-h-[70vh] overflow-y-auto">
                {filteredDrafts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{t.noDrafts}</p>
                  </div>
                )}
                {filteredDrafts.map(draft => (
                  <div
                    key={draft.id}
                    className="group flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <FileEdit className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getDraftLabel(draft)}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="truncate">{draft.domain}</span>
                        {getDraftUrl(draft) && (
                          <span className="truncate max-w-[200px]">{getDraftUrl(draft)}</span>
                        )}
                        <span className="flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          {timeAgo(draft.updated_at, language)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDraft(draft)}
                        className="text-xs gap-1 text-[#fbbf24] hover:text-[#fbbf24] hover:bg-[#fbbf24]/10 h-7 px-2"
                        title={t.open}
                      >
                        <PenLine className="h-3 w-3" />
                        <span className="hidden xl:inline">Content Architect</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDraft(draft.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Architect Modal */}
      {isProUser && modalDraft && (
        <Suspense fallback={null}>
          <CocoonContentArchitectModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setModalDraft(null); fetchDrafts(); }}
            nodes={[]}
            domain={modalDraft.domain}
            trackedSiteId={modalDraft.tracked_site_id || ''}
            draftData={modalDraft.draft_data}
            prefillUrl={modalDraft.draft_data?.url}
            colorTheme="green"
          />
        </Suspense>
      )}
    </>
  );
}
