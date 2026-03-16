import { useState, useEffect, useRef } from 'react';
import { History, X, Loader2, Trash2, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface Recommendation {
  id: string;
  summary: string;
  recommendation_text: string;
  created_at: string;
}

const i18n = {
  fr: { title: 'Historique Recommandations', empty: 'Aucune recommandation enregistrée.', delete: 'Supprimer', loading: 'Chargement…' },
  en: { title: 'Recommendation History', empty: 'No recommendations recorded.', delete: 'Delete', loading: 'Loading…' },
  es: { title: 'Historial de Recomendaciones', empty: 'No hay recomendaciones registradas.', delete: 'Eliminar', loading: 'Cargando…' },
};

interface Props {
  trackedSiteId: string | null;
  domain: string;
}

export function CocoonRecommendationHistory({ trackedSiteId, domain }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { language } = useLanguage();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const t = i18n[language as keyof typeof i18n] || i18n.fr;

  useEffect(() => {
    if (!isOpen || !trackedSiteId || !user) return;
    setLoading(true);
    supabase
      .from('cocoon_recommendations')
      .select('id, summary, recommendation_text, created_at')
      .eq('tracked_site_id', trackedSiteId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) setItems(data as Recommendation[]);
        setLoading(false);
      });
  }, [isOpen, trackedSiteId, user]);

  const handleDelete = async (id: string) => {
    await supabase.from('cocoon_recommendations').delete().eq('id', id);
    setItems(prev => prev.filter(r => r.id !== id));
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="relative">
      {/* Panel sliding up */}
      {isOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[420px] max-h-[500px] flex flex-col rounded-2xl border border-white/10 bg-[#0f0a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
          style={{ animation: 'slideUp 0.2s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#a78bfa]" />
              <span className="text-xs font-semibold text-white/80 tracking-tight">{t.title}</span>
              {items.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#a78bfa]/20 text-[#a78bfa] font-mono">{items.length}</span>
              )}
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-3.5 h-3.5 text-white/50 hover:text-white/80" />
            </button>
          </div>

          {/* Content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ minHeight: '100px' }}>
            {loading && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#a78bfa]" />
                <span className="text-xs text-white/40">{t.loading}</span>
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="text-xs text-white/30 text-center py-8">{t.empty}</p>
            )}
            {!loading && items.map(item => (
              <div key={item.id} className="rounded-xl border border-white/5 bg-white/[0.03] overflow-hidden group">
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate font-medium">{item.summary}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{formatDate(item.created_at)}</p>
                  </div>
                  <ChevronDown className={`w-3 h-3 text-white/30 transition-transform shrink-0 ${expandedId === item.id ? 'rotate-180' : ''}`} />
                </button>
                {expandedId === item.id && (
                  <div className="px-3 pb-3 border-t border-white/5">
                    <div className="mt-2 prose prose-invert max-w-none text-xs
                      [&_p]:mb-2 [&_p]:mt-1
                      [&_ul]:mb-2 [&_ul]:pl-4
                      [&_li]:mb-1 [&_li]:leading-relaxed
                      [&_strong]:text-white [&_strong]:font-semibold
                      [&_code]:text-[0.85em] [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded
                      [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs"
                    >
                      <ReactMarkdown>{item.recommendation_text}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        {t.delete}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all ${
          isOpen
            ? 'bg-[#a78bfa]/15 border-[#a78bfa]/30 text-[#a78bfa]'
            : 'bg-[#a78bfa]/10 border-[#a78bfa]/20 text-[#a78bfa] hover:bg-[#a78bfa]/20'
        } backdrop-blur-md`}
      >
        <History className="w-4 h-4" />
        <span className="text-xs font-medium">{t.title}</span>
        {items.length > 0 && !isOpen && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#a78bfa]/20 font-mono">{items.length}</span>
        )}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
