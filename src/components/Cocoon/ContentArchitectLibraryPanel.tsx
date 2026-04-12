import { useState } from 'react';
import { BookOpen, FileText, Clock, ImageIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { SocialImageLibrary } from '@/components/Social/SocialImageLibrary';
import { useEffect } from 'react';

interface ContentArchitectLibraryPanelProps {
  trackedSiteId?: string;
  domain?: string;
  onInsertImage?: (url: string) => void;
}

export function ContentArchitectLibraryPanel({ trackedSiteId, domain, onInsertImage }: ContentArchitectLibraryPanelProps) {
  const [tab, setTab] = useState<'images' | 'pages'>('images');
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trackedSiteId || tab !== 'pages') return;
    setLoading(true);
    supabase.from('cocoon_architect_drafts')
      .select('id, domain, created_at, draft_data, source_message')
      .eq('tracked_site_id', trackedSiteId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { setPages(data || []); setLoading(false); });
  }, [trackedSiteId, tab]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Bibliothèque</h3>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button onClick={() => setTab('images')}
          className={`flex-1 py-2 text-[10px] font-medium transition-colors ${tab === 'images' ? 'text-[#fbbf24] border-b border-[#fbbf24]' : 'text-white/30 hover:text-white/50'}`}>
          <ImageIcon className="w-3 h-3 mx-auto mb-0.5 stroke-[1.5]" />Images
        </button>
        <button onClick={() => setTab('pages')}
          className={`flex-1 py-2 text-[10px] font-medium transition-colors ${tab === 'pages' ? 'text-[#fbbf24] border-b border-[#fbbf24]' : 'text-white/30 hover:text-white/50'}`}>
          <FileText className="w-3 h-3 mx-auto mb-0.5 stroke-[1.5]" />Pages
        </button>
      </div>

      {tab === 'images' ? (
        <SocialImageLibrary
          trackedSiteId={trackedSiteId}
          onInsertImage={onInsertImage}
          compact
        />
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              </div>
            ) : pages.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-6 h-6 text-white/10 mx-auto mb-2 stroke-[1.5]" />
                <p className="text-[10px] text-white/20">Aucune page créée</p>
              </div>
            ) : (
              <div className="space-y-1">
                {pages.map(p => (
                  <div key={p.id} className="p-2 rounded border border-white/5 bg-white/[0.02]">
                    <p className="text-[11px] text-white/60 truncate">{p.source_message || (p.draft_data as any)?.keyword || 'Sans titre'}</p>
                    <div className="flex items-center gap-1 text-[9px] text-white/25 mt-0.5">
                      <Clock className="w-2.5 h-2.5 stroke-[1.5]" />
                      {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
