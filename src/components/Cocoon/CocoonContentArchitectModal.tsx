import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, FileText, Code2, ChevronUp, ChevronDown, Plug, Send, Loader2, Image, Link2, Type, Hash, PenLine, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t3 } from '@/utils/i18n';
import { useLanguage } from '@/contexts/LanguageContext';

interface CocoonContentArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[];
  domain?: string;
  trackedSiteId?: string;
  hasCmsConnection?: boolean;
  draftData?: Record<string, any> | null;
}

const PAGE_TYPES = [
  { value: 'homepage', label: 'Page d\'accueil' },
  { value: 'product', label: 'Page produit' },
  { value: 'article', label: 'Article / Blog' },
  { value: 'faq', label: 'FAQ' },
  { value: 'landing', label: 'Landing page' },
  { value: 'category', label: 'Catégorie' },
];

const LENGTHS = [
  { value: 'short', label: 'Court (500-800 mots)' },
  { value: 'medium', label: 'Moyen (800-1500 mots)' },
  { value: 'long', label: 'Long (1500-3000 mots)' },
  { value: 'pillar', label: 'Pilier (3000+ mots)' },
];

export function CocoonContentArchitectModal({ isOpen, onClose, nodes, domain, trackedSiteId, hasCmsConnection, draftData }: CocoonContentArchitectModalProps) {
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<'page' | 'code'>('page');
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [originalResult, setOriginalResult] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);

  // Form fields
  const [url, setUrl] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageType, setPageType] = useState('article');
  const [length, setLength] = useState('medium');
  const [prompt, setPrompt] = useState('');
  const [ctaLink, setCtaLink] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [tone, setTone] = useState('');

  // Auto-fill from draft data (from Cocoon assistant extraction)
  useEffect(() => {
    if (!isOpen) return;
    const draft = draftData;
    if (!draft) {
      // Fallback: load from database
      if (trackedSiteId && domain) {
        supabase
          .from('cocoon_architect_drafts')
          .select('draft_data')
          .eq('domain', domain)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.draft_data) applyDraft(data.draft_data as Record<string, any>);
          });
      }
      return;
    }
    applyDraft(draft);
  }, [isOpen, draftData, trackedSiteId, domain]);

  const applyDraft = (draft: Record<string, any>) => {
    if (draft.url) setUrl(draft.url);
    if (draft.keyword) setKeyword(draft.keyword);
    if (draft.page_type && PAGE_TYPES.some(p => p.value === draft.page_type)) setPageType(draft.page_type);
    if (draft.content_length && LENGTHS.some(l => l.value === draft.content_length)) setLength(draft.content_length);
    if (draft.tone) setTone(draft.tone);
    if (draft.custom_prompt) setPrompt(draft.custom_prompt);
    if (draft.cta_suggestion) setCtaLink(draft.cta_suggestion);
    if (draft.h1_suggestion) {
      // Use H1 suggestion as part of custom prompt if no custom_prompt
      if (!draft.custom_prompt) setPrompt(`H1 suggéré : ${draft.h1_suggestion}`);
    }
  };

  // Counters from result
  const counters = useMemo(() => {
    if (!result?.content_structure) return { h1: 0, h2: 0, h3: 0, chars: 0, medias: 0, links: 0 };
    const hn = result.content_structure.hn_hierarchy || [];
    const h1Count = hn.filter((h: any) => h.level === 'h1').length;
    const h2Count = hn.filter((h: any) => h.level === 'h2').length;
    const h3Count = hn.filter((h: any) => h.level === 'h3').length;
    const sections = result.content_structure.sections || [];
    // Count actual characters from body_text if available, otherwise estimate
    const hasBodyText = sections.some((s: any) => s.body_text);
    const chars = hasBodyText
      ? sections.reduce((sum: number, s: any) => sum + (s.body_text?.length || 0), 0)
        + (result.content_structure.introduction?.length || 0)
        + (result.content_structure.tldr_summary?.length || 0)
      : sections.reduce((sum: number, s: any) => sum + (s.word_count || 0), 0) * 6;
    const medias = result.content_structure.media_recommendations?.length || 0;
    const links = result.internal_linking?.recommended_internal_links || result.internal_linking?.anchor_strategy?.length || 0;
    return { h1: h1Count || 1, h2: h2Count, h3: h3Count, chars, medias, links };
  }, [result]);

  const handleGenerate = useCallback(async () => {
    if (!url || !keyword) {
      toast.error('URL et mot-clé requis');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('content-architecture-advisor', {
        body: {
          url,
          keyword,
          page_type: pageType,
          tracked_site_id: trackedSiteId,
          content_length: length,
          custom_prompt: prompt,
          cta_link: ctaLink,
          photo_url: photoUrl,
          competitor_url: competitorUrl,
          tone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const resData = data?.data || data;
      setResult(resData);
      setOriginalResult(JSON.parse(JSON.stringify(resData)));
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [url, keyword, pageType, trackedSiteId, length, prompt, ctaLink, photoUrl, competitorUrl, tone]);

  const isEdited = useMemo(() => {
    if (!result || !originalResult) return false;
    return JSON.stringify(result) !== JSON.stringify(originalResult);
  }, [result, originalResult]);

  const handlePublish = useCallback(async () => {
    if (!hasCmsConnection) {
      toast.info(t3(language,
        'Connectez votre CMS dans Profil → APIs externes',
        'Connect your CMS in Profile → External APIs',
        'Conecte su CMS en Perfil → APIs externas'));
      return;
    }
    if (!result || !trackedSiteId) return;
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke('cms-publish-draft', {
        body: {
          tracked_site_id: trackedSiteId,
          result_data: result,
          original_result_data: isEdited ? originalResult : null,
          url,
          keyword,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t3(language,
        isEdited
          ? 'Brouillon envoyé au CMS (version modifiée). La version originale est conservée en historique.'
          : 'Brouillon envoyé au CMS. Vous pourrez le relire et le publier depuis votre éditeur.',
        isEdited
          ? 'Draft sent to CMS (edited version). The original version is saved in history.'
          : 'Draft sent to CMS. You can review and publish it from your editor.',
        isEdited
          ? 'Borrador enviado al CMS (versión editada). La versión original se conserva en el historial.'
          : 'Borrador enviado al CMS. Puede revisarlo y publicarlo desde su editor.'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur de publication');
    } finally {
      setPublishing(false);
    }
  }, [hasCmsConnection, result, originalResult, isEdited, trackedSiteId, url, keyword, language]);



  const handleResetEdits = useCallback(() => {
    if (originalResult) {
      setResult(JSON.parse(JSON.stringify(originalResult)));
      toast.info('Contenu restauré à la version originale');
    }
  }, [originalResult]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[95vw] max-w-6xl h-[85vh] bg-[#0f0a1e] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header with counters */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-gradient-to-r from-[#1a1035] to-[#0f0a1e]">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-[#fbbf24]" />
            <span className="text-sm font-semibold text-white">Content Architect · Construire les pages</span>
            {result && (
              <div className="flex items-center gap-2 ml-3">
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
                  <Type className="w-2.5 h-2.5 mr-1" />H1: {counters.h1}
                </Badge>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">H2: {counters.h2}</Badge>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">H3: {counters.h3}</Badge>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
                  <Hash className="w-2.5 h-2.5 mr-1" />{counters.chars.toLocaleString()} car.
                </Badge>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
                  <Image className="w-2.5 h-2.5 mr-1" />{counters.medias} médias
                </Badge>
                <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
                  <Link2 className="w-2.5 h-2.5 mr-1" />{counters.links} liens
                </Badge>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Body: left options + right preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column — options */}
          <div className="w-[340px] shrink-0 border-r border-white/10 overflow-y-auto p-4 pb-12 space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">URL cible</label>
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Mot-clé cible</label>
              <Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="mot-clé principal" className="bg-white/5 border-white/10 text-white text-xs h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Type de page</label>
              <Select value={pageType} onValueChange={setPageType}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{PAGE_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Longueur</label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{LENGTHS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">URL concurrent</label>
              <Input value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} placeholder="https://concurrent.com/page" className="bg-white/5 border-white/10 text-white text-xs h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Lien CTA cible</label>
              <Input value={ctaLink} onChange={e => setCtaLink(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Photo / média</label>
              <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="URL image ou description" className="bg-white/5 border-white/10 text-white text-xs h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Ton souhaité</label>
              <Input value={tone} onChange={e => setTone(e.target.value)} placeholder="Expert, accessible, commercial…" className="bg-white/5 border-white/10 text-white text-xs h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 uppercase tracking-wider">Instructions spécifiques</label>
              <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: Inclure un tableau comparatif…" rows={2} className="bg-white/5 border-white/10 text-white text-xs resize-none" />
            </div>

            <Button onClick={handleGenerate} disabled={loading || !url || !keyword} className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold h-9 text-xs">
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Génération…</> : <><Send className="w-3.5 h-3.5 mr-2" />Générer la structure</>}
            </Button>
          </div>

          {/* Right column — preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Switch page/code */}
            {result && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10">
                <span className="text-xs text-white/60">Aperçu de la structure</span>
              </div>
            )}

            <ScrollArea className="flex-1 p-4">
              {!result && !loading && (
                <div className="flex items-center justify-center h-full text-white/20 text-sm">
                  Remplissez les champs et lancez la génération
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#fbbf24] mx-auto" />
                    <p className="text-xs text-white/40">Content Architect analyse la page…</p>
                  </div>
                </div>
              )}
              {result && (
                <div className="space-y-4 text-white/80">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 space-y-5">
                    {/* Meta title preview */}
                    {result.metadata_enrichment?.meta_title && (
                      <div className="text-[11px] text-[#fbbf24]/50 font-mono truncate">
                        🔍 {result.metadata_enrichment.meta_title}
                      </div>
                    )}

                    {/* H1 */}
                    {result.content_structure?.recommended_h1 && (
                      <h1
                        className="text-2xl font-bold text-white outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded px-1 -mx-1"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => {
                          const updated = { ...result };
                          updated.content_structure.recommended_h1 = e.currentTarget.textContent || '';
                          setResult(updated);
                        }}
                      >{result.content_structure.recommended_h1}</h1>
                    )}

                    {/* Meta description */}
                    {result.metadata_enrichment?.meta_description && (
                      <p
                        className="text-sm text-white/50 italic border-l-2 border-[#fbbf24]/30 pl-3 outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => {
                          const updated = { ...result };
                          updated.metadata_enrichment.meta_description = e.currentTarget.textContent || '';
                          setResult(updated);
                        }}
                      >{result.metadata_enrichment.meta_description}</p>
                    )}

                    {/* TL;DR */}
                    {result.content_structure?.tldr_summary && (
                      <div className="p-3 rounded-lg bg-[#fbbf24]/5 border border-[#fbbf24]/20">
                        <p className="text-xs text-[#fbbf24]/60 uppercase tracking-wider mb-1">TL;DR</p>
                        <p
                          className="text-sm text-white/70 outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => {
                            const updated = { ...result };
                            updated.content_structure.tldr_summary = e.currentTarget.textContent || '';
                            setResult(updated);
                          }}
                        >{result.content_structure.tldr_summary}</p>
                      </div>
                    )}

                    {/* Introduction / Chapô */}
                    {result.content_structure?.introduction && (
                      <p
                        className="text-sm text-white/60 leading-relaxed outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded border-l-2 border-emerald-500/30 pl-3"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => {
                          const updated = { ...result };
                          updated.content_structure.introduction = e.currentTarget.textContent || '';
                          setResult(updated);
                        }}
                      >{result.content_structure.introduction}</p>
                    )}

                    {/* Confidence score + Rationale */}
                    {result.confidence_score != null && (
                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                          result.confidence_score >= 70 ? 'bg-emerald-500/20 text-emerald-300' :
                          result.confidence_score >= 40 ? 'bg-amber-500/20 text-amber-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          Confiance : {result.confidence_score}%
                        </div>
                        {result.rationale && (
                          <span className="text-[10px] text-white/40 italic truncate flex-1">{result.rationale}</span>
                        )}
                      </div>
                    )}

                    {/* Coherence warnings */}
                    {result.coherence_check?.warnings?.length > 0 && (
                      <div className="space-y-1">
                        {result.coherence_check.warnings.map((w: string, i: number) => (
                          <div key={i} className="text-[11px] text-amber-400/80 bg-amber-500/10 rounded px-2 py-1">{w}</div>
                        ))}
                      </div>
                    )}

                    {/* Sections with full body text */}
                    {(result.content_structure?.sections || []).map((s: any, i: number) => (
                      <div key={i} className="space-y-2">
                        {/* Section heading from hn_hierarchy if matching */}
                        <div className="flex items-center justify-between">
                          <h2
                            className="text-lg font-semibold text-white/90 outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded px-1 -mx-1"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => {
                              const updated = { ...result };
                              updated.content_structure.sections[i].title = e.currentTarget.textContent || '';
                              setResult(updated);
                            }}
                          >{s.title}</h2>
                          <div className="flex items-center gap-2">
                            {s.priority && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                s.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                s.priority === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-white/10 text-white/40'
                              }`}>{s.priority}</span>
                            )}
                            <span className="text-[10px] text-white/30">{s.word_count} mots</span>
                          </div>
                        </div>

                        {/* Body text (full content) */}
                        {s.body_text ? (
                          <div
                            className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded pl-2 border-l border-white/5"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => {
                              const updated = { ...result };
                              updated.content_structure.sections[i].body_text = e.currentTarget.textContent || '';
                              setResult(updated);
                            }}
                          >{s.body_text}</div>
                        ) : s.purpose ? (
                          <p className="text-xs text-white/40 italic pl-2 border-l border-white/5">{s.purpose}</p>
                        ) : null}

                        {/* Media recommendation for this section */}
                        {(result.content_structure?.media_recommendations || [])
                          .filter((m: any) => m.placement === `after_h2_${i + 1}` || (i === 0 && m.placement === 'hero'))
                          .map((m: any, mi: number) => (
                            <div key={mi} className="flex items-center gap-2 text-[10px] text-white/30 bg-white/[0.03] rounded px-2 py-1">
                              <Image className="w-3 h-3" />
                              <span>{m.type}: {m.description}</span>
                              {m.alt_text && <span className="text-white/20">alt="{m.alt_text}"</span>}
                            </div>
                          ))}
                      </div>
                    ))}

                    {/* Sub-headings H3 not covered by sections */}
                    {(result.content_structure?.hn_hierarchy || [])
                      .filter((h: any) => h.level === 'h3')
                      .length > 0 && !(result.content_structure?.sections || []).some((s: any) => s.body_text) && (
                      <div className="space-y-2 mt-4">
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Sous-sections H3</p>
                        {(result.content_structure.hn_hierarchy || []).filter((h: any) => h.level === 'h3').map((hn: any, i: number) => (
                          <h3
                            key={i}
                            className="text-base font-medium text-white/70 ml-4 outline-none focus:ring-1 focus:ring-[#fbbf24]/40 rounded px-1 -mx-1"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => {
                              const updated = { ...result };
                              const idx = updated.content_structure.hn_hierarchy.indexOf(hn);
                              if (idx >= 0) updated.content_structure.hn_hierarchy[idx].text = e.currentTarget.textContent || '';
                              setResult(updated);
                            }}
                          >{hn.text}</h3>
                        ))}
                      </div>
                    )}

                    {/* Keyword strategy */}
                    {result.keyword_strategy?.primary_keyword && (
                      <div className="p-3 rounded-lg bg-[#fbbf24]/5 border border-[#fbbf24]/20 space-y-2">
                        <div>
                          <span className="text-xs text-[#fbbf24]/70">Mot-clé principal : </span>
                          <span className="text-sm font-semibold text-[#fbbf24]">{result.keyword_strategy.primary_keyword.keyword}</span>
                          <span className="text-xs text-white/40 ml-2">densité cible : {result.keyword_strategy.primary_keyword.target_density_percent}%</span>
                        </div>
                        {result.keyword_strategy.secondary_keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-white/40">Secondaires :</span>
                            {result.keyword_strategy.secondary_keywords.map((kw: any, i: number) => (
                              <span key={i} className="text-[10px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded">
                                {kw.keyword} ({kw.target_density_percent}%)
                              </span>
                            ))}
                          </div>
                        )}
                        {result.keyword_strategy.lsi_terms?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-white/40">LSI :</span>
                            {result.keyword_strategy.lsi_terms.map((lsi: any, i: number) => (
                              <span key={i} className="text-[10px] bg-purple-500/10 text-purple-300/60 px-1.5 py-0.5 rounded">
                                {lsi.term}
                              </span>
                            ))}
                          </div>
                        )}
                        {result.keyword_strategy.semantic_ratio && (
                          <div className="text-[10px] text-white/30">
                            Ratio : {result.keyword_strategy.semantic_ratio.technical_jargon_percent}% technique / {result.keyword_strategy.semantic_ratio.accessible_language_percent}% accessible
                            {result.keyword_strategy.semantic_ratio.explanation && (
                              <span className="ml-1 italic">— {result.keyword_strategy.semantic_ratio.explanation}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Internal links */}
                    {result.internal_linking?.anchor_strategy?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-white/40 uppercase tracking-wider">Liens internes suggérés ({result.internal_linking.recommended_internal_links || result.internal_linking.anchor_strategy.length})</p>
                        {result.internal_linking.anchor_strategy.map((a: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Link2 className="w-3 h-3 text-emerald-400/60" />
                            <span className="text-emerald-300 font-mono">{a.anchor_text}</span>
                            <span className="text-white/30">→ {a.target_intent}</span>
                          </div>
                        ))}
                        {result.internal_linking.cluster_opportunities?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className="text-[10px] text-white/30">Clusters :</span>
                            {result.internal_linking.cluster_opportunities.map((c: string, i: number) => (
                              <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-300/50 px-1.5 py-0.5 rounded">{c}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* GEO criteria */}
                    {result.geo_criteria_applied?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-white/40 uppercase tracking-wider">Critères GEO appliqués</p>
                        <div className="grid grid-cols-1 gap-1">
                          {result.geo_criteria_applied.map((gc: any, i: number) => (
                            <div key={i} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded ${
                              gc.activated ? 'bg-emerald-500/10 text-emerald-300/80' : 'bg-white/[0.02] text-white/30'
                            }`}>
                              <span>{gc.activated ? '✓' : '○'}</span>
                              <span className="font-medium">{gc.name}</span>
                              {gc.weight === 'reinforced' && <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">renforcé</span>}
                              <span className="text-white/20 ml-auto truncate max-w-[50%]">{gc.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* JSON-LD schemas */}
                    {result.metadata_enrichment?.json_ld_schemas?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-white/40 uppercase tracking-wider">Schemas JSON-LD recommandés</p>
                        {result.metadata_enrichment.json_ld_schemas.map((s: any, i: number) => (
                          <div key={i} className="text-[11px] text-white/40 bg-white/[0.03] rounded px-2 py-1 flex items-center gap-2">
                            <Code2 className="w-3 h-3" />
                            <span className="font-mono">{s.type}</span>
                            {s.priority && <span className={`text-[9px] px-1 rounded ${s.priority === 'high' ? 'bg-red-500/15 text-red-300/60' : 'bg-white/5 text-white/30'}`}>{s.priority}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Word count range */}
                    {result.content_structure?.word_count_range && (
                      <div className="text-[10px] text-white/30 flex items-center gap-3 pt-2 border-t border-white/5">
                        <span>📏 Objectif : {result.content_structure.word_count_range.min}–{result.content_structure.word_count_range.max} mots</span>
                        <span className="text-white/50 font-medium">(idéal : {result.content_structure.word_count_range.ideal})</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Bottom: Publish + Guide */}
            {result && (
              <div className="border-t border-white/10 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  {isEdited && (
                    <button onClick={handleResetEdits} className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors">
                      <RotateCcw className="w-3 h-3" />
                      {t3(language, 'Restaurer l\'original', 'Restore original', 'Restaurar original')}
                    </button>
                  )}
                  {!isEdited && <div />}
                  <Button
                    onClick={handlePublish}
                    disabled={publishing}
                    className={hasCmsConnection
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white font-semibold'
                      : 'bg-white/10 hover:bg-white/15 text-white/60 border border-white/10'}
                  >
                    {publishing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t3(language, 'Envoi…', 'Sending…', 'Enviando…')}</>
                    ) : hasCmsConnection ? (
                      <><Send className="w-4 h-4 mr-2" />{t3(language, 'Envoyer en brouillon', 'Send as draft', 'Enviar como borrador')}{isEdited ? ' ✎' : ''}</>
                    ) : (
                      <><Plug className="w-4 h-4 mr-2" />{t3(language, 'Connecter mon CMS', 'Connect my CMS', 'Conectar mi CMS')}</>
                    )}
                  </Button>
                </div>

                {/* Collapsible guide — opens upward */}
                <div className="relative">
                  <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    <span className={`transition-transform duration-200 ${showGuide ? 'rotate-180' : ''}`}>
                      <ChevronUp className="w-3 h-3" />
                    </span>
                    Mode d'emploi
                  </button>
                  {showGuide && (
                    <div className="absolute bottom-full left-0 mb-1 w-80 p-3 rounded-lg bg-[#1a1035] border border-white/10 shadow-xl text-xs text-white/60 space-y-2 z-10">
                      <p className="font-medium text-white/80">🎯 Comment ça marche ?</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Remplissez l'URL et le mot-clé cible à gauche</li>
                        <li>L'IA analyse la SERP, vos concurrents et votre site</li>
                        <li>Visualisez la structure recommandée (page ou code)</li>
                        <li>Publiez directement si votre CMS est connecté</li>
                      </ol>
                      <p className="text-[10px] text-white/30 italic">Les recommandations respectent le ton et le style existants de votre site. Pas de risque de contenu hors-sujet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
