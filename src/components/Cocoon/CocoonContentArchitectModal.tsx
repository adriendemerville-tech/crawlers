import { useState, useMemo, useCallback, useEffect } from 'react';
import { X, FileText, Code2, ChevronUp, ChevronDown, Plug, Send, Loader2, Image, Link2, Type, Hash, PenLine, RotateCcw, Upload, Lock } from 'lucide-react';
import { ContentArchitectSidebar } from './ContentArchitectSidebar';
import { ImageColumn } from './ImageStylePicker';
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
  prefillUrl?: string;
  isExistingPage?: boolean;
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

export function CocoonContentArchitectModal({ isOpen, onClose, nodes, domain, trackedSiteId, hasCmsConnection, draftData, prefillUrl, isExistingPage = false }: CocoonContentArchitectModalProps) {
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<'page' | 'code'>('page');
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [originalResult, setOriginalResult] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<import('./ImageStylePicker').GeneratedImageItem[]>([]);
  const [imageIterations, setImageIterations] = useState(0);
  const [identityCard, setIdentityCard] = useState<Record<string, any> | null>(null);

  // Workflow step: 1=config, 2=content generated, 3=images available
  const workflowStep = useMemo(() => {
    if (result) return 3; // content generated → images unlocked
    if (loading) return 2; // generating
    return 1; // config only
  }, [result, loading]);

  // Auto-fill URL from Stratège prefill
  useEffect(() => {
    if (isOpen && prefillUrl && !url) {
      setUrl(prefillUrl);
    }
  }, [isOpen, prefillUrl]);

  // Restore previously generated images from storage on modal open
  useEffect(() => {
    if (!isOpen || generatedImages.length > 0) return;
    const loadPersistedImages = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const folder = trackedSiteId ? `${user.id}/${trackedSiteId}/generated` : `${user.id}/generated`;
        const { data: files } = await supabase.storage.from('image-references').list(folder, { limit: 10, sortBy: { column: 'created_at', order: 'desc' } });
        if (!files || files.length === 0) return;
        // Only load images from last 24h
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = files.filter(f => f.created_at && new Date(f.created_at).getTime() > cutoff);
        if (recent.length === 0) return;
        const restored = recent.slice(0, 5).map(f => {
          const path = `${folder}/${f.name}`;
          const { data: urlData } = supabase.storage.from('image-references').getPublicUrl(path);
          const styleMatch = f.name.match(/_([a-z_]+)\.\w+$/);
          return {
            dataUri: urlData.publicUrl,
            style: (styleMatch?.[1] || 'photo') as any,
            placement: null as 'header' | 'body' | null,
          };
        });
        setGeneratedImages(restored);
      } catch (e) {
        console.warn('[ContentArchitect] Failed to restore images:', e);
      }
    };
    loadPersistedImages();
  }, [isOpen, trackedSiteId]);

  // Form fields
  const [directory, setDirectory] = useState('');
  const [slug, setSlug] = useState('');
  const [keyword, setKeyword] = useState('');
  const [pageType, setPageType] = useState('article');
  const [length, setLength] = useState('medium');
  const [prompt, setPrompt] = useState('');
  const [ctaLink, setCtaLink] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [tone, setTone] = useState('');
  const [directories, setDirectories] = useState<{ path: string; label: string; category: string | null }[]>([]);

  // Compute full URL from domain + directory + slug
  const url = useMemo(() => {
    if (!domain) return '';
    const base = `https://${domain}`;
    const dir = directory && directory !== '/' ? directory : '';
    const s = slug ? `/${slug}` : '';
    return `${base}${dir}${s}`;
  }, [domain, directory, slug]);

  // Helper to set url (for backward compat with prefillUrl etc.)
  const setUrl = useCallback((newUrl: string) => {
    try {
      const u = new URL(newUrl);
      const pathParts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        setDirectory('/' + pathParts.slice(0, -1).join('/'));
        setSlug(pathParts[pathParts.length - 1]);
      } else if (pathParts.length === 1) {
        setDirectory('/');
        setSlug(pathParts[0]);
      } else {
        setDirectory('/');
        setSlug('');
      }
    } catch {
      // Not a valid URL, ignore
    }
  }, []);

  // Load directories from site_taxonomy
  useEffect(() => {
    if (!trackedSiteId || !isOpen) return;
    supabase
      .from('site_taxonomy')
      .select('path_pattern, label, category')
      .eq('tracked_site_id', trackedSiteId)
      .order('page_count', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const dirs = data.map(d => ({
            path: d.path_pattern.endsWith('/') ? d.path_pattern.slice(0, -1) : d.path_pattern,
            label: d.label,
            category: d.category,
          }));
          // Add root if not present
          if (!dirs.some(d => d.path === '' || d.path === '/')) {
            dirs.unshift({ path: '/', label: 'Racine', category: null });
          }
          setDirectories(dirs);
        } else {
          // Fallback default directories
          setDirectories([
            { path: '/', label: 'Racine', category: null },
            { path: '/blog', label: 'Blog', category: 'blog' },
            { path: '/produits', label: 'Produits', category: 'product' },
          ]);
        }
      });
  }, [trackedSiteId, isOpen]);

  // Generate slug from keyword
  const generateSlugFromKeyword = useCallback((kw: string): string => {
    return kw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 80);
  }, []);

  // Track which fields were auto-filled (so we don't overwrite user edits)
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());

  // ── Auto-detect page type from directory ──
  const detectPageTypeFromDirectory = useCallback((dir: string, cat: string | null): string | null => {
    if (cat === 'blog' || cat === 'article' || cat === 'news') return 'article';
    if (cat === 'product' || cat === 'shop') return 'product';
    if (cat === 'faq' || cat === 'help') return 'faq';
    if (cat === 'landing') return 'landing';
    if (cat === 'category' || cat === 'collection') return 'category';
    const lower = dir.toLowerCase();
    if (/\/(blog|article|post|news|actualit|actu)\b/i.test(lower)) return 'article';
    if (/\/(produit|product|shop|boutique|item)\b/i.test(lower)) return 'product';
    if (/\/(faq|aide|help|support)\b/i.test(lower)) return 'faq';
    if (/\/(landing|lp|offre|promo)\b/i.test(lower)) return 'landing';
    if (/\/(categori|collection|rayon)\b/i.test(lower)) return 'category';
    if (dir === '/' || dir === '') return 'homepage';
    return null;
  }, []);

  // ── Auto-detect content length from page type ──
  const suggestLengthFromType = useCallback((type: string): string => {
    switch (type) {
      case 'homepage': return 'medium';
      case 'product': return 'short';
      case 'article': return 'long';
      case 'faq': return 'medium';
      case 'landing': return 'medium';
      case 'category': return 'short';
      default: return 'medium';
    }
  }, []);

  // ── Load identity card + workbench data for smart auto-fills ──
  useEffect(() => {
    if (!trackedSiteId || !isOpen) return;

    // 1. Identity card → tone, CTA, sector-based instructions
    supabase
      .from('tracked_sites')
      .select('identity_card, domain' as any)
      .eq('id', trackedSiteId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data?.identity_card) return;
        const ic = data.identity_card as Record<string, any>;
        setIdentityCard(ic);

        // Auto-fill tone from identity voice
        if (!tone && !autoFilled.has('tone')) {
          const voiceTone = ic.user_manual?.voice?.tone
            || ic.voice?.tone
            || ic.editorial_tone
            || ic.tone;
          if (voiceTone) {
            setTone(typeof voiceTone === 'string' ? voiceTone : Array.isArray(voiceTone) ? voiceTone.join(', ') : '');
            setAutoFilled(prev => new Set(prev).add('tone'));
          }
        }

        // Auto-fill CTA link from identity
        if (!ctaLink && !autoFilled.has('ctaLink')) {
          const mainCta = ic.conversion_url || ic.cta_url || ic.main_cta_url || ic.contact_url;
          if (mainCta) {
            setCtaLink(mainCta);
            setAutoFilled(prev => new Set(prev).add('ctaLink'));
          }
        }

        // Auto-fill domain-based URL if empty
        if (!url && !prefillUrl && data.domain && !autoFilled.has('url')) {
          setUrl(`https://${data.domain}`);
          setAutoFilled(prev => new Set(prev).add('url'));
        }
      });

    // 2. Workbench → keyword, competitor, instructions from diagnostic findings
    supabase
      .from('architect_workbench')
      .select('title, description, target_url, payload, finding_category, severity')
      .eq('tracked_site_id', trackedSiteId)
      .in('status', ['pending', 'in_progress'])
      .eq('consumed_by_content', false)
      .order('severity', { ascending: true })
      .limit(5)
      .then(({ data: findings }) => {
        if (!findings?.length) return;

        // Auto-fill keyword from top finding if not set
        if (!keyword && !autoFilled.has('keyword')) {
          const keywordFinding = findings.find((f: any) => (f.payload as any)?.keyword || (f.payload as any)?.target_keyword);
          if (keywordFinding) {
            const p = keywordFinding.payload as any;
            const kw = p?.keyword || p?.target_keyword;
            if (kw) {
              setKeyword(kw);
              setAutoFilled(prev => new Set(prev).add('keyword'));
            }
          }
        }

        // Auto-fill competitor URL from SERP findings
        if (!competitorUrl && !autoFilled.has('competitorUrl')) {
          const serpFinding = findings.find((f: any) => (f.payload as any)?.competitor_url || (f.payload as any)?.serp_competitor);
          if (serpFinding) {
            const sp = serpFinding.payload as any;
            const comp = sp?.competitor_url || sp?.serp_competitor;
            if (comp) {
              setCompetitorUrl(comp);
              setAutoFilled(prev => new Set(prev).add('competitorUrl'));
            }
          }
        }

        // Build smart instructions from diagnostic findings
        if (!prompt && !autoFilled.has('prompt')) {
          const instructions = findings
            .filter((f: any) => f.finding_category && f.description)
            .slice(0, 3)
            .map((f: any) => {
              if (f.finding_category.includes('eeat')) return 'Renforcer les signaux E-E-A-T (expertise, expérience, autorité)';
              if (f.finding_category.includes('content_gap')) return `Combler le gap de contenu : ${f.title}`;
              if (f.finding_category.includes('schema') || f.finding_category.includes('structured')) return 'Ajouter des données structurées (FAQ, HowTo, Article)';
              if (f.finding_category.includes('thin')) return 'Enrichir le contenu (page jugée trop fine)';
              if (f.finding_category.includes('cannibal')) return `Attention cannibalisation : différencier de ${f.payload?.cannibalized_url || 'pages similaires'}`;
              return f.description?.substring(0, 80);
            })
            .filter(Boolean);

          // Don't set prompt here — let the preset load first, append diagnostics
          if (instructions.length > 0) {
            // We'll merge with preset in the preset effect below
            setAutoFilled(prev => {
              const next = new Set(prev);
              next.add('_diagnostic_instructions');
              return next;
            });
            // Store for later merge
            (window as any).__contentArchitectDiagnostics = instructions;
          }
        }
      });
  }, [trackedSiteId, isOpen]);

  // ── Auto-fill from draft data (from Cocoon assistant extraction) ──
  useEffect(() => {
    if (!isOpen) return;
    const draft = draftData;
    if (!draft) {
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

  // ── Auto-detect page type from directory when directory changes ──
  useEffect(() => {
    if (!directory || autoFilled.has('pageType_manual')) return;
    const dirInfo = directories.find(d => d.path === directory);
    const detected = detectPageTypeFromDirectory(directory, dirInfo?.category || null);
    if (detected && detected !== pageType) {
      setPageType(detected);
      setLength(suggestLengthFromType(detected));
    }
  }, [directory, directories]);

  // ── Auto-generate slug from keyword for new pages ──
  useEffect(() => {
    if (!keyword || isExistingPage || autoFilled.has('slug_manual')) return;
    const newSlug = generateSlugFromKeyword(keyword);
    if (newSlug) setSlug(newSlug);
  }, [keyword, isExistingPage]);

  // ── Auto-select directory from page type for new pages ──
  useEffect(() => {
    if (isExistingPage || !directories.length || autoFilled.has('directory_manual')) return;
    const typeToCategory: Record<string, string[]> = {
      article: ['blog', 'article', 'news'],
      product: ['product', 'shop'],
      landing: ['landing'],
      faq: ['faq', 'help'],
      category: ['category', 'collection'],
    };
    const cats = typeToCategory[pageType] || [];
    const match = directories.find(d => d.category && cats.includes(d.category));
    if (match && match.path !== directory) {
      setDirectory(match.path);
    }
  }, [pageType, directories, isExistingPage]);

  // ── Auto-inject default preset + merge diagnostics ──
  useEffect(() => {
    if (!isOpen || !trackedSiteId) return;
    const detectType = (): 'landing' | 'product' | 'article' => {
      if (draftData?.page_type === 'landing' || draftData?.page_type === 'product') return draftData.page_type;
      if (pageType === 'landing' || pageType === 'product') return pageType as 'landing' | 'product';
      return 'article';
    };
    const pt = detectType();
    supabase
      .from('content_prompt_presets')
      .select('prompt_text, name, page_type')
      .eq('tracked_site_id', trackedSiteId)
      .eq('page_type', pt)
      .eq('is_default', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!prompt || autoFilled.has('prompt')) {
          let finalPrompt = data?.prompt_text || '';

          // Merge diagnostic instructions if available
          const diagnostics = (window as any).__contentArchitectDiagnostics as string[] | undefined;
          if (diagnostics?.length) {
            const diagText = '\n\n📋 Points diagnostics à intégrer :\n• ' + diagnostics.join('\n• ');
            finalPrompt = finalPrompt ? finalPrompt + diagText : diagText.trim();
            delete (window as any).__contentArchitectDiagnostics;
          }

          if (finalPrompt) {
            setPrompt(finalPrompt);
            setAutoFilled(prev => new Set(prev).add('prompt'));
          }
        }
      });
  }, [isOpen, trackedSiteId]);

  const applyDraft = (draft: Record<string, any>) => {
    if (draft.url) setUrl(draft.url);
    if (draft.keyword) { setKeyword(draft.keyword); setAutoFilled(prev => new Set(prev).add('keyword')); }
    if (draft.page_type && PAGE_TYPES.some(p => p.value === draft.page_type)) { setPageType(draft.page_type); setAutoFilled(prev => new Set(prev).add('pageType_manual')); }
    if (draft.content_length && LENGTHS.some(l => l.value === draft.content_length)) setLength(draft.content_length);
    if (draft.tone) { setTone(draft.tone); setAutoFilled(prev => new Set(prev).add('tone')); }
    if (draft.custom_prompt) { setPrompt(draft.custom_prompt); setAutoFilled(prev => new Set(prev).add('prompt')); }
    if (draft.cta_suggestion) { setCtaLink(draft.cta_suggestion); setAutoFilled(prev => new Set(prev).add('ctaLink')); }
    if (draft.competitor_url) { setCompetitorUrl(draft.competitor_url); setAutoFilled(prev => new Set(prev).add('competitorUrl')); }
    if (draft.h1_suggestion) {
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
      // Build image data for CMS injection
      const imageData = generatedImages
        .filter(img => img.placement)
        .map(img => ({
          dataUri: img.dataUri,
          placement: img.placement,
          style: img.style,
        }));

      const functionName = isExistingPage ? 'cms-patch-content' : 'cms-publish-draft';
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          tracked_site_id: trackedSiteId,
          result_data: result,
          original_result_data: isEdited ? originalResult : null,
          url,
          keyword,
          images: imageData.length > 0 ? imageData : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t3(language,
        isExistingPage
          ? 'Page mise à jour avec succès.'
          : isEdited
            ? 'Brouillon envoyé au CMS (version modifiée).'
            : 'Brouillon envoyé au CMS.',
        isExistingPage
          ? 'Page updated successfully.'
          : isEdited
            ? 'Draft sent to CMS (edited version).'
            : 'Draft sent to CMS.',
        isExistingPage
          ? 'Página actualizada con éxito.'
          : isEdited
            ? 'Borrador enviado al CMS (versión editada).'
            : 'Borrador enviado al CMS.'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur de publication');
    } finally {
      setPublishing(false);
    }
  }, [hasCmsConnection, result, originalResult, isEdited, trackedSiteId, url, keyword, language, generatedImages]);



  const handleResetEdits = useCallback(() => {
    if (originalResult) {
      setResult(JSON.parse(JSON.stringify(originalResult)));
      toast.info('Contenu restauré à la version originale');
    }
  }, [originalResult]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[98vw] max-w-[1400px] h-[90vh] bg-[#0f0a1e] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
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
          <div className="flex items-center gap-2">
            {/* Publish / Update button in header */}
            {result && (
              <Button
                onClick={handlePublish}
                disabled={publishing || !result}
                size="sm"
                className={hasCmsConnection
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-7 text-xs'
                  : 'bg-white/10 hover:bg-white/15 text-white/60 border border-white/10 h-7 text-xs'}
              >
                {publishing ? (
                  <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />{t3(language, 'Envoi…', 'Sending…', 'Enviando…')}</>
                ) : hasCmsConnection ? (
                  <><Upload className="w-3 h-3 mr-1.5" />{isExistingPage
                    ? t3(language, 'Mettre à jour', 'Update', 'Actualizar')
                    : t3(language, 'Publier', 'Publish', 'Publicar')}{isEdited ? ' ✎' : ''}</>
                ) : (
                  <><Plug className="w-3 h-3 mr-1.5" />{t3(language, 'Connecter CMS', 'Connect CMS', 'Conectar CMS')}</>
                )}
              </Button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>

        {/* Body: left options + right preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sites sidebar */}
          <ContentArchitectSidebar
            selectedSiteId={trackedSiteId}
            selectedPageType={pageType === 'landing' || pageType === 'product' || pageType === 'article' ? pageType : undefined}
            onSelectPreset={(preset, site) => {
              if (preset.prompt_text) setPrompt(preset.prompt_text);
              setPageType(preset.page_type === 'landing' ? 'landing' : preset.page_type === 'product' ? 'product' : 'article');
              if (!url && site.domain) setUrl(`https://${site.domain}`);
            }}
          />
          <div className="w-[340px] shrink-0 border-r border-white/10 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  URL cible
                  {autoFilled.has('url') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
                </label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  Mot-clé cible
                  {autoFilled.has('keyword') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
                </label>
                <Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="mot-clé principal" className="bg-white/5 border-white/10 text-white text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  Type de page
                  {url && detectPageTypeFromUrl(url) && <span className="text-[9px] text-[#fbbf24]/60 normal-case">détecté</span>}
                </label>
                <Select value={pageType} onValueChange={(v) => { setPageType(v); setAutoFilled(prev => new Set(prev).add('pageType_manual')); }}>
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
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  URL concurrent
                  {autoFilled.has('competitorUrl') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
                </label>
                <Input value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} placeholder="https://concurrent.com/page" className="bg-white/5 border-white/10 text-white text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  Lien CTA cible
                  {autoFilled.has('ctaLink') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
                </label>
                <Input value={ctaLink} onChange={e => setCtaLink(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider">Photo / média</label>
                <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="URL image ou description" className="bg-white/5 border-white/10 text-white text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  Ton souhaité
                  {autoFilled.has('tone') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
                </label>
                <Input value={tone} onChange={e => setTone(e.target.value)} placeholder="Expert, accessible, commercial…" className="bg-white/5 border-white/10 text-white text-xs h-8" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  Instructions spécifiques
                  {autoFilled.has('prompt') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
                </label>
                <Textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Ex: Inclure un tableau comparatif…" rows={2} className="bg-white/5 border-white/10 text-white text-xs resize-none" />
              </div>
            </div>

            <div className="shrink-0 p-4 border-t border-white/10">
              <Button onClick={handleGenerate} disabled={loading || !url || !keyword} className="w-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0f0a1e] font-semibold h-9 text-xs">
                {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />Génération…</> : <><Send className="w-3.5 h-3.5 mr-2" />Générer la structure</>}
              </Button>
            </div>
          </div>

          {/* Center column — preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {result && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10">
                <span className="text-xs text-white/60">Aperçu de la structure</span>
              </div>
            )}

            <ScrollArea className="flex-1 p-4">
              {!result && !loading && (
                <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-white/10">
                  {url ? (
                    <>
                      <iframe
                        src={url}
                        className="w-full h-full absolute inset-0 opacity-30 pointer-events-none"
                        sandbox="allow-scripts"
                        title="Aperçu du site cible"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                        <div className="text-center space-y-2">
                          <FileText className="w-8 h-8 text-white/15 mx-auto" />
                          <p className="text-sm text-white/30">Prêt à générer du contenu</p>
                          <p className="text-[10px] text-white/15">Le contenu apparaîtra ici avec le style de votre site</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/20 text-sm">
                      Remplissez les champs et lancez la génération
                    </div>
                  )}
                </div>
              )}
              {loading && (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-6 h-6 animate-spin text-[#fbbf24] mx-auto" />
                    <p className="text-xs text-white/40">Génération en cours…</p>
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

            {/* Bottom: Guide + Reset */}
            {result && (
              <div className="border-t border-white/10 px-4 py-2.5 flex items-center justify-between">
                {isEdited ? (
                  <button onClick={handleResetEdits} className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors">
                    <RotateCcw className="w-3 h-3" />
                    {t3(language, 'Restaurer l\'original', 'Restore original', 'Restaurar original')}
                  </button>
                ) : <div />}
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
                    <div className="absolute bottom-full right-0 mb-1 w-80 p-3 rounded-lg bg-[#1a1035] border border-white/10 shadow-xl text-xs text-white/60 space-y-2 z-10">
                      <p className="font-medium text-white/80">Comment ça marche ?</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Remplissez l'URL et le mot-clé cible à gauche</li>
                        <li>Cliquez sur "Générer" pour créer la structure</li>
                        <li>Éditez le contenu directement dans la preview</li>
                        <li>Générez des images (colonne débloquée après génération)</li>
                        <li>Publiez via le bouton en haut à droite</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right column — Image generation (locked until content generated) */}
          {workflowStep >= 3 ? (
            <ImageColumn
              pageType={pageType}
              trackedSiteId={trackedSiteId}
              targetUrl={url}
              identityCard={identityCard}
              generatedImages={generatedImages}
              iterationsUsed={imageIterations}
              onImageGenerated={(dataUri, style) => {
                setGeneratedImages(prev => [...prev, { dataUri, style, placement: null }]);
                setImageIterations(prev => prev + 1);
              }}
              onImageRemoved={(index) => {
                setGeneratedImages(prev => prev.filter((_, i) => i !== index));
              }}
              onImagePlacement={(index, placement) => {
                setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, placement } : img));
              }}
            />
          ) : (
            <div className="w-[280px] shrink-0 border-l border-white/10 flex flex-col items-center justify-center bg-white/[0.01]">
              <div className="text-center space-y-3 px-6">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5 text-white/15" />
                </div>
                <p className="text-xs text-white/25">Génération d'images</p>
                <p className="text-[10px] text-white/15">Disponible après la génération du contenu</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
