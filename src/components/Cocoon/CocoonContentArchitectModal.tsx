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

interface CocoonContentArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[];
  domain?: string;
  trackedSiteId?: string;
  hasCmsConnection?: boolean;
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

export function CocoonContentArchitectModal({ isOpen, onClose, nodes, domain, trackedSiteId, hasCmsConnection }: CocoonContentArchitectModalProps) {
  const [viewMode, setViewMode] = useState<'page' | 'code'>('page');
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [editedCode, setEditedCode] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');

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

  // Counters from result
  const counters = useMemo(() => {
    if (!result?.content_structure) return { h1: 0, h2: 0, h3: 0, chars: 0, medias: 0, links: 0 };
    const hn = result.content_structure.hn_hierarchy || [];
    const h1Count = hn.filter((h: any) => h.level === 'h1').length;
    const h2Count = hn.filter((h: any) => h.level === 'h2').length;
    const h3Count = hn.filter((h: any) => h.level === 'h3').length;
    const sections = result.content_structure.sections || [];
    const totalWords = sections.reduce((sum: number, s: any) => sum + (s.word_count || 0), 0);
    const chars = totalWords * 6;
    const medias = result.content_structure.media_recommendations?.length || 0;
    const links = result.internal_linking?.recommended_internal_links || 0;
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
      setResult(data?.data || data);
      toast.success('Structure générée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [url, keyword, pageType, trackedSiteId, length, prompt, ctaLink, photoUrl, competitorUrl, tone]);

  const handlePublish = useCallback(() => {
    if (!hasCmsConnection) {
      toast.info('Connectez votre CMS dans Profil → APIs externes');
      return;
    }
    toast.info('Publication en cours… (fonctionnalité à venir)');
  }, [hasCmsConnection]);

  // Generate HTML preview from result
  const htmlPreview = useMemo(() => {
    if (!result?.content_structure) return '';
    const parts: string[] = [];
    const h1 = result.content_structure.recommended_h1;
    if (h1) parts.push(`<h1>${h1}</h1>`);
    for (const hn of (result.content_structure.hn_hierarchy || [])) {
      if (hn.level !== 'h1') parts.push(`<${hn.level}>${hn.text}</${hn.level}>`);
    }
    for (const section of (result.content_structure.sections || [])) {
      parts.push(`<section>\n  <h2>${section.title}</h2>\n  <p>${section.purpose || ''}</p>\n  <!-- ${section.word_count || 0} mots -->\n</section>`);
    }
    if (result.metadata_enrichment?.json_ld_schemas?.length) {
      for (const schema of result.metadata_enrichment.json_ld_schemas) {
        parts.push(`<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@type": schema.type, ...schema.properties }, null, 2)}\n</script>`);
      }
    }
    return parts.join('\n\n');
  }, [result]);

  // Sync original code when AI generates result
  useEffect(() => {
    if (htmlPreview) {
      setOriginalCode(htmlPreview);
      setEditedCode(null); // reset manual edits
    }
  }, [htmlPreview]);

  const isManuallyEdited = editedCode !== null && editedCode !== originalCode;
  const finalCode = editedCode ?? htmlPreview;

  const handleResetCode = useCallback(() => {
    setEditedCode(null);
    toast.info('Code restauré à la version originale');
  }, []);

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
          <div className="w-[340px] shrink-0 border-r border-white/10 overflow-y-auto p-4 space-y-3">
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
                <span className={`text-xs ${viewMode === 'page' ? 'text-white' : 'text-white/40'}`}>Page</span>
                <Switch checked={viewMode === 'code'} onCheckedChange={v => setViewMode(v ? 'code' : 'page')} />
                <span className={`text-xs ${viewMode === 'code' ? 'text-white' : 'text-white/40'}`}>Code HTML</span>
                {isManuallyEdited && (
                  <Badge className="ml-2 bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                    <PenLine className="w-2.5 h-2.5 mr-1" />Modifié manuellement
                  </Badge>
                )}
                {isManuallyEdited && (
                  <button onClick={handleResetCode} className="ml-auto flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                    <RotateCcw className="w-3 h-3" />Restaurer
                  </button>
                )}
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
              {result && viewMode === 'page' && (
                <div className="space-y-4 text-white/80">
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 space-y-4">
                    {result.content_structure?.recommended_h1 && (
                      <h1 className="text-2xl font-bold text-white">{result.content_structure.recommended_h1}</h1>
                    )}
                    {result.metadata_enrichment?.meta_description && (
                      <p className="text-sm text-white/50 italic border-l-2 border-[#fbbf24]/30 pl-3">{result.metadata_enrichment.meta_description}</p>
                    )}
                    {(result.content_structure?.hn_hierarchy || []).filter((h: any) => h.level !== 'h1').map((hn: any, i: number) => (
                      <div key={i} className={hn.level === 'h2' ? 'mt-6' : 'mt-3 ml-4'}>
                        {hn.level === 'h2' && <h2 className="text-lg font-semibold text-white/90">{hn.text}</h2>}
                        {hn.level === 'h3' && <h3 className="text-base font-medium text-white/70">{hn.text}</h3>}
                      </div>
                    ))}
                    {(result.content_structure?.sections || []).map((s: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white/80">{s.title}</span>
                          <span className="text-[10px] text-white/30">{s.word_count} mots</span>
                        </div>
                        <p className="text-xs text-white/40">{s.purpose}</p>
                      </div>
                    ))}
                    {result.keyword_strategy?.primary_keyword && (
                      <div className="p-3 rounded-lg bg-[#fbbf24]/5 border border-[#fbbf24]/20">
                        <span className="text-xs text-[#fbbf24]/70">Mot-clé principal : </span>
                        <span className="text-sm font-semibold text-[#fbbf24]">{result.keyword_strategy.primary_keyword.keyword}</span>
                        <span className="text-xs text-white/40 ml-2">densité cible : {result.keyword_strategy.primary_keyword.target_density_percent}%</span>
                      </div>
                    )}
                    {result.internal_linking?.anchor_strategy?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-white/40 uppercase tracking-wider">Liens internes suggérés</p>
                        {result.internal_linking.anchor_strategy.map((a: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Link2 className="w-3 h-3 text-emerald-400/60" />
                            <span className="text-emerald-300 font-mono">{a.anchor_text}</span>
                            <span className="text-white/30">→ {a.target_intent}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {result && viewMode === 'code' && (
                <pre className="text-xs text-green-300/80 font-mono whitespace-pre-wrap bg-black/30 rounded-lg p-4 border border-white/5">
                  {htmlPreview}
                </pre>
              )}
            </ScrollArea>

            {/* Bottom: Publish + Guide */}
            {result && (
              <div className="border-t border-white/10 px-4 py-3 space-y-2">
                <div className="flex justify-end">
                  <Button
                    onClick={handlePublish}
                    className={hasCmsConnection
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white font-semibold'
                      : 'bg-white/10 hover:bg-white/15 text-white/60 border border-white/10'}
                  >
                    {hasCmsConnection ? (
                      <><Send className="w-4 h-4 mr-2" />Publier</>
                    ) : (
                      <><Plug className="w-4 h-4 mr-2" />Connecter mon CMS</>
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
