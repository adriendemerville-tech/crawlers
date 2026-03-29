import { useState, useEffect } from 'react';
import { FileEdit, Clock, Save, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContentArchitectDraftPanelProps {
  domain?: string;
  trackedSiteId?: string;
  result: any;
  keyword: string;
  url: string;
  pageType: string;
  onLoadDraft: (draft: Record<string, any>) => void;
}

export function ContentArchitectDraftPanel({
  domain, trackedSiteId, result, keyword, url, pageType, onLoadDraft,
}: ContentArchitectDraftPanelProps) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    supabase
      .from('cocoon_architect_drafts')
      .select('id, domain, created_at, updated_at, draft_data, source_message')
      .eq('domain', domain)
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setDrafts(data || []);
        setLoading(false);
      });
  }, [domain]);

  const handleSaveDraft = async () => {
    if (!domain || !trackedSiteId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const draftData = {
        url, keyword, page_type: pageType,
        result_snapshot: result,
        saved_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('cocoon_architect_drafts').insert({
        user_id: user.id, domain, tracked_site_id: trackedSiteId,
        draft_data: draftData, source_message: `Brouillon — ${keyword || url}`,
      });
      if (error) throw error;
      toast.success('Brouillon enregistré');
      // Refresh list
      const { data } = await supabase.from('cocoon_architect_drafts').select('id, domain, created_at, updated_at, draft_data, source_message')
        .eq('domain', domain).order('updated_at', { ascending: false }).limit(20);
      setDrafts(data || []);
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <FileEdit className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Brouillons</h3>
      </div>

      {/* Save current */}
      <div className="px-3 py-2 border-b border-white/10">
        <Button onClick={handleSaveDraft} disabled={saving || !domain} size="sm"
          className="w-full h-8 text-xs bg-white/5 hover:bg-white/10 text-white/60 border border-white/10">
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2 stroke-[1.5]" />}
          Enregistrer le brouillon actuel
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-white/20" />
            </div>
          )}
          {!loading && drafts.length === 0 && (
            <div className="text-center py-8">
              <FileEdit className="w-6 h-6 text-white/10 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-[10px] text-white/20">Aucun brouillon sauvegardé</p>
            </div>
          )}
          {drafts.map(draft => {
            const dd = draft.draft_data as any;
            return (
              <button
                key={draft.id}
                onClick={() => onLoadDraft(dd)}
                className="w-full text-left p-2.5 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-colors space-y-1"
              >
                <p className="text-[11px] text-white/60 font-medium truncate">{draft.source_message || dd?.keyword || 'Sans titre'}</p>
                <div className="flex items-center gap-2 text-[9px] text-white/30">
                  <Clock className="w-2.5 h-2.5 stroke-[1.5]" />
                  <span>{formatDate(draft.updated_at)}</span>
                  {dd?.page_type && <span className="bg-white/5 px-1.5 py-0.5 rounded">{dd.page_type}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
