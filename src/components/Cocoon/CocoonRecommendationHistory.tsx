import { useState, useEffect, useRef } from 'react';
import { History, X, Loader2, Trash2, ChevronDown, CheckCircle2, Circle, ClipboardList, Code2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface Recommendation {
  id: string;
  summary: string;
  recommendation_text: string;
  created_at: string;
  is_applied: boolean;
}

const i18n = {
  fr: { title: 'Historique', empty: 'Aucune recommandation enregistrée.', delete: 'Supprimer', loading: 'Chargement…', applied: 'Appliqué', notApplied: 'À traiter' },
  en: { title: 'History', empty: 'No recommendations recorded.', delete: 'Delete', loading: 'Loading…', applied: 'Applied', notApplied: 'To do' },
  es: { title: 'Historial', empty: 'No hay recomendaciones registradas.', delete: 'Eliminar', loading: 'Cargando…', applied: 'Aplicado', notApplied: 'Pendiente' },
};

interface Props {
  trackedSiteId: string | null;
  domain: string;
  onAddToTaskPlan?: (title: string, recoId: string) => void;
  onGenerateFix?: (recoText: string) => void;
}

export function CocoonRecommendationHistory({ trackedSiteId, domain, onAddToTaskPlan, onGenerateFix }: Props) {
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
      .select('id, summary, recommendation_text, created_at, is_applied')
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

  const toggleApplied = async (id: string, current: boolean) => {
    const newVal = !current;
    setItems(prev => prev.map(r => r.id === id ? { ...r, is_applied: newVal } : r));
    const { error } = await supabase.from('cocoon_recommendations').update({ is_applied: newVal }).eq('id', id);
    if (error) {
      // Rollback on failure
      setItems(prev => prev.map(r => r.id === id ? { ...r, is_applied: current } : r));
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const pendingCount = items.filter(r => !r.is_applied).length;

  return (
    <div className="relative">
      {/* Panel sliding up */}
      {isOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[380px] sm:w-[420px] max-h-[500px] flex flex-col rounded-2xl border border-white/10 bg-[#0f0a1e] shadow-2xl shadow-black/50 overflow-hidden"
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
              {pendingCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono">{pendingCount} {t.notApplied}</span>
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
              <div key={item.id} className={`rounded-xl border overflow-hidden group transition-colors ${
                item.is_applied 
                  ? 'border-emerald-500/15 bg-emerald-500/[0.03]' 
                  : 'border-white/5 bg-white/[0.03]'
              }`}>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  {/* Applied checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleApplied(item.id, item.is_applied); }}
                    className="shrink-0 transition-colors"
                    title={item.is_applied ? t.applied : t.notApplied}
                  >
                    {item.is_applied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-white/20 hover:text-white/40" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-xs truncate font-medium ${item.is_applied ? 'text-white/40 line-through' : 'text-white/70'}`}>
                      {item.summary}
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">{formatDate(item.created_at)}</p>
                  </div>

                  {/* Hover action buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {onAddToTaskPlan && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddToTaskPlan(item.summary, item.id); }}
                        className="p-1 rounded-md hover:bg-emerald-400/15 transition-colors"
                        title={language === 'en' ? 'Add to task plan' : language === 'es' ? 'Añadir al plan' : 'Ajouter au plan'}
                      >
                        <ClipboardList className="w-3 h-3 text-emerald-400/60 hover:text-emerald-400" />
                      </button>
                    )}
                    {onGenerateFix && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onGenerateFix(item.recommendation_text); }}
                        className="p-1 rounded-md hover:bg-blue-400/15 transition-colors"
                        title={language === 'en' ? 'Generate fix' : language === 'es' ? 'Generar corrección' : 'Générer le fix'}
                      >
                        <Code2 className="w-3 h-3 text-blue-400/60 hover:text-blue-400" />
                      </button>
                    )}
                  </div>

                  <ChevronDown className={`w-3 h-3 text-white/30 transition-transform shrink-0 ${expandedId === item.id ? 'rotate-180' : ''}`} />
                </div>
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
                    <div className="flex items-center justify-between mt-2">
                      <button
                        onClick={() => toggleApplied(item.id, item.is_applied)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-colors ${
                          item.is_applied
                            ? 'text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-400/10'
                            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                        }`}
                      >
                        {item.is_applied ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                        {item.is_applied ? t.applied : t.notApplied}
                      </button>
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
        <span className="text-xs font-medium hidden sm:inline">{t.title}</span>
        {pendingCount > 0 && !isOpen && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-mono">{pendingCount}</span>
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
