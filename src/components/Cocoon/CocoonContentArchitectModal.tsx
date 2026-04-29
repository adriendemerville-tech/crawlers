import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useCredits } from '@/contexts/CreditsContext';
import type { AudienceSegment } from './ContentArchitectOptionsPanel';
import { X, FileText, Code2, Loader2, Image, Link2, Type, Hash, Syringe } from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ContentArchitectSidebar } from './ContentArchitectSidebar';
import { ImageColumn } from './ImageStylePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t3 } from '@/utils/i18n';
import { useLanguage } from '@/contexts/LanguageContext';
import { ContentArchitectToolbar, type PanelId } from './ContentArchitectToolbar';
import { ContentArchitectPromptPanel } from './ContentArchitectPromptPanel';
import { ContentArchitectStructurePanel } from './ContentArchitectStructurePanel';
import { ContentArchitectImagePanel } from './ContentArchitectImagePanel';
import { ContentArchitectOptionsPanel } from './ContentArchitectOptionsPanel';
import { ContentArchitectStructuredDataPanel } from './ContentArchitectStructuredDataPanel';
import { ContentArchitectDraftPanel } from './ContentArchitectDraftPanel';
import { ContentArchitectLibraryPanel } from './ContentArchitectLibraryPanel';
import { ContentArchitectTasksPanel } from './ContentArchitectTasksPanel';
import { ContentArchitectQuickWinsPanel } from './ContentArchitectQuickWinsPanel';
import { ContentArchitectPreview } from './ContentArchitectPreview';
import { ContentArchitectProvider } from '@/contexts/ContentArchitectContext';
import { VoiceDNAEditor } from './VoiceDNAEditor';

interface CocoonContentArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[];
  domain?: string;
  trackedSiteId?: string;
  hasCmsConnection?: boolean;
  draftData?: Record<string, any> | null;
  prefillUrl?: string;
  prefillPrompt?: string;
  isExistingPage?: boolean;
  demoMode?: boolean;
  colorTheme?: 'cocoon' | 'green';
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

const DEMO_RESULT = {
  content_structure: {
    recommended_h1: 'Crawlers.fr — L\'outil SEO français qui automatise votre croissance organique',
    introduction: 'Crawlers.fr est la première plateforme SEO & GEO française qui combine audit technique, stratégie de contenu et maillage interne dans un cockpit unifié. Conçu pour les freelances, agences et e-commerçants, il transforme les diagnostics en actions concrètes grâce à l\'intelligence artificielle.',
    tldr_summary: 'Crawlers.fr centralise audit SEO, Content Architect, cocon sémantique et monitoring dans un seul outil. Pilotage IA, déploiement CMS en un clic, tarification à crédits flexible.',
    sections: [
      { title: 'Audit technique complet en 3 minutes', body_text: 'L\'audit SEO de Crawlers analyse plus de 180 critères techniques : vitesse (Core Web Vitals, INP, LCP, CLS), indexation, balisage sémantique, données structurées, accessibilité et sécurité. Chaque diagnostic génère un plan d\'action priorisé avec des correctifs déployables en un clic via l\'intégration CMS native.', word_count: 280 },
      { title: 'Content Architect : rédaction IA optimisée E-E-A-T', body_text: 'Le module Content Architect génère des contenus SEO complets — chapô, FAQ, sources, données structurées — à partir d\'un simple mot-clé. Il s\'appuie sur Gemini 2.5 Pro pour la rédaction et intègre un système de génération d\'images IA multi-modèles (Imagen 3, FLUX, Ideogram).', word_count: 320 },
      { title: 'Cocon sémantique & maillage intelligent', body_text: 'Le Stratège Cocoon cartographie votre site en graphe orienté pondéré, détecte les pages orphelines, les cannibalisation et les gaps sémantiques. Il prescrit un maillage interne optimisé avec ancres contextualisées et déploiement automatique via WordPress ou Shopify.', word_count: 260 },
      { title: 'Marina : audit GEO pour l\'ère de l\'IA', body_text: 'Marina évalue la visibilité de votre marque dans les réponses des IA génératives (ChatGPT, Gemini, Perplexity). Le rapport couvre la citabilité, l\'autorité perçue, les biais de reformulation et propose des recommandations concrètes pour améliorer votre présence dans les moteurs de réponse IA.', word_count: 300 },
      { title: 'Tarification flexible à crédits', body_text: 'Crawlers fonctionne sur un modèle à crédits : chaque action (audit, génération, analyse) consomme un nombre défini de crédits. Les plans vont du gratuit (50 crédits) au Pro Agency (2000 crédits/mois). Un système de recharge permet d\'ajuster la consommation à la demande.', word_count: 220 },
    ],
    faq: [
      { question: 'Crawlers remplace-t-il Semrush ou Ahrefs ?', answer: 'Crawlers se positionne en complément opérationnel : là où Semrush/Ahrefs excellent en data brute, Crawlers transforme les données en actions déployables avec un pilotage IA intégré.' },
      { question: 'Comment fonctionne le déploiement CMS ?', answer: 'Connectez votre WordPress ou Shopify via l\'onglet APIs externes. Crawlers pousse directement les contenus, métadonnées et images en brouillon sur votre CMS.' },
    ],
    media_recommendations: [
      { type: 'hero', description: 'Dashboard Crawlers avec métriques SEO' },
      { type: 'infographic', description: 'Workflow : Audit → Stratégie → Contenu → Déploiement' },
    ],
    hn_hierarchy: [
      { level: 'h1', text: 'Crawlers.fr — L\'outil SEO français qui automatise votre croissance organique' },
      { level: 'h2', text: 'Audit technique complet en 3 minutes' },
      { level: 'h2', text: 'Content Architect : rédaction IA optimisée E-E-A-T' },
      { level: 'h2', text: 'Cocon sémantique & maillage intelligent' },
      { level: 'h2', text: 'Marina : audit GEO pour l\'ère de l\'IA' },
      { level: 'h2', text: 'Tarification flexible à crédits' },
    ],
  },
  seo_metadata: {
    meta_title: 'Crawlers.fr — Plateforme SEO & GEO IA | Audit, Contenu, Cocon',
    meta_description: 'Crawlers automatise votre SEO : audit technique, rédaction IA E-E-A-T, cocon sémantique et monitoring GEO. L\'outil français tout-en-un pour freelances et agences.',
    og_title: 'Crawlers.fr — Votre cockpit SEO & GEO intelligent',
    og_description: 'Audit, contenu, maillage, monitoring : tout dans un seul outil propulsé par l\'IA.',
  },
  internal_linking: {
    recommended_internal_links: 4,
    anchor_strategy: [
      { anchor: 'audit SEO complet', target: '/audit-expert' },
      { anchor: 'cocon sémantique', target: '/cocoon' },
      { anchor: 'audit GEO Marina', target: '/marina' },
      { anchor: 'Content Architect', target: '/content-architect' },
    ],
  },
  structured_data: {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Crawlers.fr',
    applicationCategory: 'SEO Tool',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', description: 'Freemium avec crédits' },
  },
};

const DEMO_IMAGES: import('./ImageStylePicker').GeneratedImageItem[] = [
  { dataUri: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80', style: 'corporate' as any, placement: 'header' },
  { dataUri: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', style: 'infographic' as any, placement: 'body' },
];

export function CocoonContentArchitectModal({ isOpen, onClose, nodes, domain, trackedSiteId, hasCmsConnection, draftData, prefillUrl, prefillPrompt, isExistingPage = false, demoMode = false, colorTheme = 'cocoon' }: CocoonContentArchitectModalProps) {
  const { language } = useLanguage();
  const { isAgencyPro } = useCredits();
  const [activePanel, setActivePanel] = useState<PanelId | null>('prompt');
  const [viewMode, setViewMode] = useState<'page' | 'code'>('page');
  const [showGuide, setShowGuide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [originalResult, setOriginalResult] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<import('./ImageStylePicker').GeneratedImageItem[]>([]);
  const [imageIterations, setImageIterations] = useState(0);
  const [identityCard, setIdentityCard] = useState<Record<string, any> | null>(null);
  const [strategistLoading, setStrategistLoading] = useState(false);
  const [strategistDone, setStrategistDone] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ cached: boolean; ageDays?: number } | null>(null);
  const [crawlersReco, setCrawlersReco] = useState<{ markdown: string; created_at: string } | null>(null);

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
  const [h1Field, setH1Field] = useState('');
  const [h2Fields, setH2Fields] = useState<string[]>(['']);
  const [keywordTags, setKeywordTags] = useState<string[]>([]);
  const [keywordCloudSuggestions, setKeywordCloudSuggestions] = useState<{ keyword: string; position: number; search_volume: number }[]>([]);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [audienceSegment, setAudienceSegment] = useState<AudienceSegment>('primary');
  const [audienceDetails, setAudienceDetails] = useState<{ primary?: string; secondary?: string; untapped?: string }>({});

  // ── Demo mode: pre-fill everything ──
  useEffect(() => {
    if (!isOpen || !demoMode) return;
    setDirectory('/blog');
    setSlug('plateforme-seo-geo-ia-crawlers');
    setKeyword('outil SEO IA français');
    setPageType('article');
    setLength('long');
    setH1Field(DEMO_RESULT.content_structure.recommended_h1);
    setH2Fields(DEMO_RESULT.content_structure.sections.map(s => s.title));
    setKeywordTags(['audit SEO', 'cocon sémantique', 'Content Architect', 'audit GEO', 'maillage interne', 'SEO IA']);
    setPrompt('Rédiger une présentation complète de Crawlers.fr mettant en avant l\'approche tout-en-un SEO+GEO, le pilotage IA et la tarification à crédits. Inclure des données structurées SoftwareApplication. Ton expert mais accessible.');
    setTone('Expert, accessible, orienté ROI');
    setCtaLink('https://crawlers.fr/pricing');
    setCompetitorUrl('https://semrush.com');
    setResult(DEMO_RESULT);
    setOriginalResult(JSON.parse(JSON.stringify(DEMO_RESULT)));
    setGeneratedImages(DEMO_IMAGES);
    setImageIterations(2);
    setDirectories([
      { path: '/', label: 'Racine', category: null },
      { path: '/blog', label: 'Blog', category: 'blog' },
      { path: '/produits', label: 'Produits', category: 'product' },
      { path: '/landing', label: 'Landing pages', category: 'landing' },
    ]);
    setKeywordCloudSuggestions([
      { keyword: 'audit SEO gratuit', position: 3, search_volume: 2400 },
      { keyword: 'outil SEO français', position: 5, search_volume: 1800 },
      { keyword: 'cocon sémantique', position: 7, search_volume: 1200 },
      { keyword: 'Content Architect SEO', position: 12, search_volume: 880 },
      { keyword: 'audit GEO', position: 4, search_volume: 720 },
      { keyword: 'maillage interne automatique', position: 15, search_volume: 590 },
    ]);
    setStrategistDone(true);
    setActivePanel(null);
  }, [isOpen, demoMode]);

  const url = useMemo(() => {
    if (!domain) return '';
    const base = `https://${domain}`;
    const dir = directory && directory !== '/' ? directory : '';
    const s = slug ? `/${slug}` : '';
    return `${base}${dir}${s}`;
  }, [domain, directory, slug]);

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
    } catch {}
  }, []);

  // Workflow step
  const workflowStep = useMemo(() => {
    if (result) return 3;
    if (loading) return 2;
    return 1;
  }, [result, loading]);

  // Counters from result
  const counters = useMemo(() => {
    if (!result?.content_structure) return { h1: 0, h2: 0, h3: 0, chars: 0, medias: 0, links: 0 };
    const hn = result.content_structure.hn_hierarchy || [];
    const h1Count = hn.filter((h: any) => h.level === 'h1').length;
    const h2Count = hn.filter((h: any) => h.level === 'h2').length;
    const h3Count = hn.filter((h: any) => h.level === 'h3').length;
    const sections = result.content_structure.sections || [];
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

  const isEdited = useMemo(() => {
    if (!result || !originalResult) return false;
    return JSON.stringify(result) !== JSON.stringify(originalResult);
  }, [result, originalResult]);

  // ── Auto-fill URL from prefill ──
  useEffect(() => {
    if (isOpen && prefillUrl && !url) setUrl(prefillUrl);
  }, [isOpen, prefillUrl]);

  // ── Auto-fill prompt from prefill ──
  useEffect(() => {
    if (isOpen && prefillPrompt && !prompt) setPrompt(prefillPrompt);
  }, [isOpen, prefillPrompt]);

  // ── Restore persisted images ──
  useEffect(() => {
    if (!isOpen || generatedImages.length > 0) return;
    const loadPersistedImages = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const folder = trackedSiteId ? `${user.id}/${trackedSiteId}/generated` : `${user.id}/generated`;
        const { data: files } = await supabase.storage.from('image-references').list(folder, { limit: 10, sortBy: { column: 'created_at', order: 'desc' } });
        if (!files || files.length === 0) return;
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = files.filter(f => f.created_at && new Date(f.created_at).getTime() > cutoff);
        if (recent.length === 0) return;
        const restored = recent.slice(0, 5).map(f => {
          const path = `${folder}/${f.name}`;
          const { data: urlData } = supabase.storage.from('image-references').getPublicUrl(path);
          const styleMatch = f.name.match(/_([a-z_]+)\.\w+$/);
          return { dataUri: urlData.publicUrl, style: (styleMatch?.[1] || 'photo') as any, placement: null as 'header' | 'body' | null };
        });
        setGeneratedImages(restored);
      } catch (e) { console.warn('[ContentArchitect] Failed to restore images:', e); }
    };
    loadPersistedImages();
  }, [isOpen, trackedSiteId]);

  // ── Load directories ──
  useEffect(() => {
    if (!trackedSiteId || !isOpen) return;
    supabase.from('site_taxonomy').select('path_pattern, label, category').eq('tracked_site_id', trackedSiteId).order('page_count', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const dirs = data.map(d => ({ path: d.path_pattern.endsWith('/') ? d.path_pattern.slice(0, -1) : d.path_pattern, label: d.label, category: d.category }));
          if (!dirs.some(d => d.path === '' || d.path === '/')) dirs.unshift({ path: '/', label: 'Racine', category: null });
          setDirectories(dirs);
        } else {
          setDirectories([{ path: '/', label: 'Racine', category: null }, { path: '/blog', label: 'Blog', category: 'blog' }, { path: '/produits', label: 'Produits', category: 'product' }]);
        }
      });
  }, [trackedSiteId, isOpen]);

  // ── Load keyword cloud ──
  useEffect(() => {
    if (!trackedSiteId || !isOpen) return;
    supabase.from('serp_snapshots').select('sample_keywords').eq('tracked_site_id', trackedSiteId).order('measured_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => {
        if (data?.sample_keywords && Array.isArray(data.sample_keywords)) {
          const kws = data.sample_keywords.filter((k: any) => k?.keyword).sort((a: any, b: any) => (a.position || 999) - (b.position || 999)).slice(0, 30)
            .map((k: any) => ({ keyword: k.keyword, position: k.position || 0, search_volume: k.search_volume || k.volume || 0 }));
          setKeywordCloudSuggestions(kws);
          if (keywordTags.length === 0 && kws.length > 0) setKeywordTags(kws.slice(0, 5).map((k: any) => k.keyword));
        }
      });
  }, [trackedSiteId, isOpen]);

  // ── Helpers ──
  const generateSlugFromKeyword = useCallback((kw: string): string => {
    return kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80);
  }, []);

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

  const suggestLengthFromType = useCallback((type: string): string => {
    switch (type) {
      case 'homepage': return 'medium'; case 'product': return 'short'; case 'article': return 'long';
      case 'faq': return 'medium'; case 'landing': return 'medium'; case 'category': return 'short';
      default: return 'medium';
    }
  }, []);

  // ── Identity card + workbench auto-fills ──
  useEffect(() => {
    if (!trackedSiteId || !isOpen) return;
    supabase.from('tracked_sites').select('identity_card, domain, market_sector, target_audience, client_targets' as any).eq('id', trackedSiteId).maybeSingle()
      .then(({ data }: any) => {
        // Parse client_targets for audience segment details
        if (data?.client_targets) {
          try {
            const ct = typeof data.client_targets === 'string' ? JSON.parse(data.client_targets) : data.client_targets;
            const parseSegment = (arr: any[]): string => {
              if (!arr?.[0]) return '';
              const item = arr[0];
              const market = item.market || '';
              const sub = Object.values(item).find((v: any) => typeof v === 'object' && v !== null && !Array.isArray(v) && ('csp' in v || 'segment' in v || 'role' in v)) as any;
              let desc = market;
              if (sub) {
                if (sub.csp) desc += ` — ${sub.csp}`;
                if (sub.segment) desc += ` — ${sub.segment}`;
                if (sub.age_range) desc += ` (${sub.age_range})`;
              }
              if (item.intent) desc += ` | ${item.intent}`;
              return desc;
            };
            setAudienceDetails({
              primary: parseSegment(ct.primary),
              secondary: parseSegment(ct.secondary),
              untapped: parseSegment(ct.untapped),
            });
          } catch (e) { console.warn('[ContentArchitect] Failed to parse client_targets:', e); }
        }
        if (!data?.identity_card) return;
        const ic = data.identity_card as Record<string, any>;
        setIdentityCard(ic);
        if (!tone && !autoFilled.has('tone')) {
          const voiceTone = ic.user_manual?.voice?.tone || ic.voice?.tone || ic.editorial_tone || ic.tone;
          if (voiceTone) { setTone(typeof voiceTone === 'string' ? voiceTone : Array.isArray(voiceTone) ? voiceTone.join(', ') : ''); setAutoFilled(prev => new Set(prev).add('tone')); }
        }
        if (!ctaLink && !autoFilled.has('ctaLink')) {
          const mainCta = ic.conversion_url || ic.cta_url || ic.main_cta_url || ic.contact_url;
          if (mainCta) { setCtaLink(mainCta); setAutoFilled(prev => new Set(prev).add('ctaLink')); }
        }
        if (!url && !prefillUrl && data.domain && !autoFilled.has('url')) { setUrl(`https://${data.domain}`); setAutoFilled(prev => new Set(prev).add('url')); }
      });
    supabase.from('architect_workbench').select('title, description, target_url, payload, finding_category, severity')
      .eq('tracked_site_id', trackedSiteId).in('status', ['pending', 'in_progress']).eq('consumed_by_content', false).order('severity', { ascending: true }).limit(5)
      .then(({ data: findings }) => {
        if (!findings?.length) return;
        if (!keyword && !autoFilled.has('keyword')) {
          const kf = findings.find((f: any) => (f.payload as any)?.keyword || (f.payload as any)?.target_keyword);
          if (kf) { const p = kf.payload as any; const kw = p?.keyword || p?.target_keyword; if (kw) { setKeyword(kw); setAutoFilled(prev => new Set(prev).add('keyword')); } }
        }
        if (!competitorUrl && !autoFilled.has('competitorUrl')) {
          const sf = findings.find((f: any) => (f.payload as any)?.competitor_url || (f.payload as any)?.serp_competitor);
          if (sf) { const sp = sf.payload as any; const comp = sp?.competitor_url || sp?.serp_competitor; if (comp) { setCompetitorUrl(comp); setAutoFilled(prev => new Set(prev).add('competitorUrl')); } }
        }
        if (!prompt && !autoFilled.has('prompt')) {
          const instructions = findings.filter((f: any) => f.finding_category && f.description).slice(0, 3).map((f: any) => {
            if (f.finding_category.includes('eeat')) return 'Renforcer les signaux E-E-A-T';
            if (f.finding_category.includes('content_gap')) return `Combler le gap : ${f.title}`;
            if (f.finding_category.includes('schema')) return 'Ajouter des données structurées';
            if (f.finding_category.includes('thin')) return 'Enrichir le contenu';
            if (f.finding_category.includes('cannibal')) return `Attention cannibalisation`;
            return f.description?.substring(0, 80);
          }).filter(Boolean);
          if (instructions.length > 0) { setAutoFilled(prev => new Set(prev).add('_diagnostic_instructions')); (window as any).__contentArchitectDiagnostics = instructions; }
        }
      });
  }, [trackedSiteId, isOpen]);

  // ── Stratège pre-call ──
  const runStrategestPreCall = useCallback(async () => {
    if (!trackedSiteId || !domain || strategistDone) return;
    setStrategistLoading(true);
    try {
      const { data: stratData, error: stratError } = await supabase.functions.invoke('cocoon-strategist', { body: { tracked_site_id: trackedSiteId, domain, task_budget: 3, lang: language } });
      if (stratError || !stratData) return;
      const tasks = stratData?.strategy?.tasks || stratData?.tasks || [];
      const editorialTasks = tasks.filter((t: any) => t.execution_mode === 'content_architect');
      const summaryParts = editorialTasks.slice(0, 5).map((t: any) => `- ${t.title}: ${t.description || ''}`);
      const stratSummary = summaryParts.length > 0 ? `Recommandations stratégiques :\n${summaryParts.join('\n')}` : `Diagnostic : ${tasks.length} tâches pour ${domain}`;
      const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-architect-fields', { body: { message_content: stratSummary, domain, tracked_site_id: trackedSiteId, language } });
      if (extractError || !extractData?.draft) return;
      applyDraft(extractData.draft);
      toast.success(t3(language, 'Brief enrichi par le Stratège', 'Brief enriched by Strategist', 'Brief enriquecido por el Estratega'), { duration: 3000 });
    } catch (err) { console.warn('[ContentArchitect] Stratège pre-call error:', err); }
    finally { setStrategistLoading(false); setStrategistDone(true); }
  }, [trackedSiteId, domain, strategistDone, language]);

  // ── Draft loading ──
  useEffect(() => {
    if (!isOpen) return;
    const draft = draftData;
    if (!draft) {
      if (trackedSiteId && domain) {
        supabase.from('cocoon_architect_drafts').select('draft_data').eq('domain', domain).order('updated_at', { ascending: false }).limit(1).maybeSingle()
          .then(({ data }) => { if (data?.draft_data) applyDraft(data.draft_data as Record<string, any>); else runStrategestPreCall(); });
      }
      return;
    }
    applyDraft(draft);
  }, [isOpen, draftData, trackedSiteId, domain]);

  // ── Auto-detect page type from directory ──
  useEffect(() => {
    if (!directory || autoFilled.has('pageType_manual')) return;
    const dirInfo = directories.find(d => d.path === directory);
    const detected = detectPageTypeFromDirectory(directory, dirInfo?.category || null);
    if (detected && detected !== pageType) { setPageType(detected); setLength(suggestLengthFromType(detected)); }
  }, [directory, directories]);

  // ── Auto-generate slug from keyword ──
  useEffect(() => {
    if (!keyword || isExistingPage || autoFilled.has('slug_manual')) return;
    const newSlug = generateSlugFromKeyword(keyword);
    if (newSlug) setSlug(newSlug);
  }, [keyword, isExistingPage]);

  // ── Auto-select directory from page type ──
  useEffect(() => {
    if (isExistingPage || !directories.length || autoFilled.has('directory_manual')) return;
    const typeToCategory: Record<string, string[]> = { article: ['blog', 'article', 'news'], product: ['product', 'shop'], landing: ['landing'], faq: ['faq', 'help'], category: ['category', 'collection'] };
    const cats = typeToCategory[pageType] || [];
    const match = directories.find(d => d.category && cats.includes(d.category));
    if (match && match.path !== directory) setDirectory(match.path);
  }, [pageType, directories, isExistingPage]);

  // ── Auto-inject default preset ──
  useEffect(() => {
    if (!isOpen || !trackedSiteId) return;
    const detectType = (): 'landing' | 'product' | 'article' => {
      if (draftData?.page_type === 'landing' || draftData?.page_type === 'product') return draftData.page_type;
      if (pageType === 'landing' || pageType === 'product') return pageType as 'landing' | 'product';
      return 'article';
    };
    supabase.from('content_prompt_presets').select('prompt_text, name, page_type').eq('tracked_site_id', trackedSiteId).eq('page_type', detectType()).eq('is_default', true).maybeSingle()
      .then(({ data }) => {
        if (!prompt || autoFilled.has('prompt')) {
          let finalPrompt = data?.prompt_text || '';
          const diagnostics = (window as any).__contentArchitectDiagnostics as string[] | undefined;
          if (diagnostics?.length) { finalPrompt = finalPrompt ? finalPrompt + '\n\n📋 Points diagnostics :\n• ' + diagnostics.join('\n• ') : diagnostics.join('\n• '); delete (window as any).__contentArchitectDiagnostics; }
          if (finalPrompt) { setPrompt(finalPrompt); setAutoFilled(prev => new Set(prev).add('prompt')); }
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
    if (draft.h1_suggestion) setH1Field(draft.h1_suggestion);
    if (draft.secondary_keywords?.length) setKeywordTags(prev => Array.from(new Set([...prev, ...draft.secondary_keywords])));
    if (draft.priority_actions?.length && !draft.custom_prompt) { setPrompt(draft.priority_actions.join('\n')); setAutoFilled(prev => new Set(prev).add('prompt')); }
    // Auto-derive slug from keyword or URL path when no directory/slug is set
    if (draft.keyword && !draft.slug) {
      const autoSlug = generateSlugFromKeyword(draft.keyword);
      if (autoSlug) { setSlug(autoSlug); setAutoFilled(prev => new Set(prev).add('slug_auto')); }
    }
    if (draft.url && !directory) {
      try {
        const urlObj = new URL(draft.url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const dir = '/' + pathParts.slice(0, -1).join('/') || '/';
          setDirectory(dir === '/' ? '' : dir);
        }
      } catch {}
    }
  };

  // ── Generate ──
  const handleGenerate = useCallback(async (forceRegenerate = false) => {
    if (!keyword || (!directory && !slug)) { toast.error('Mot-clé et répertoire/slug requis'); return; }
    setLoading(true); setResult(null); setCacheInfo(null); setCrawlersReco(null);
    try {
      const { data, error } = await supabase.functions.invoke('content-architecture-advisor', {
        body: { url, keyword, keywords: keywordTags, page_type: pageType, tracked_site_id: trackedSiteId, content_length: length, custom_prompt: prompt, cta_link: ctaLink, photo_url: photoUrl, competitor_url: competitorUrl, tone, target_audience_segment: audienceSegment, force_regenerate: forceRegenerate },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const resData = data?.data || data;
      setResult(resData); setOriginalResult(JSON.parse(JSON.stringify(resData)));
      // Cache + recommandation Crawlers
      if (data?.cached) setCacheInfo({ cached: true, ageDays: data?.cache_age_days });
      if (data?.crawlers_recommendation) setCrawlersReco(data.crawlers_recommendation);
      if (resData?.content_structure?.recommended_h1) setH1Field(resData.content_structure.recommended_h1);
      const sections = resData?.content_structure?.sections || [];
      if (sections.length > 0) setH2Fields(sections.map((s: any) => s.title || '').filter(Boolean));
      if (!isExistingPage && !autoFilled.has('slug_manual') && resData?.content_structure?.recommended_h1) {
        const newSlug = generateSlugFromKeyword(resData.content_structure.recommended_h1);
        if (newSlug) setSlug(newSlug);
      }
      // Auto-close panel to show preview
      setActivePanel(null);
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
    finally { setLoading(false); }
  }, [url, keyword, pageType, trackedSiteId, length, prompt, ctaLink, photoUrl, competitorUrl, tone, isExistingPage, directory, slug, keywordTags, audienceSegment]);

  // ── Publish ──
  const handlePublish = useCallback(async () => {
    if (!hasCmsConnection) { toast.info(t3(language, 'Connectez votre CMS dans Profil → APIs externes', 'Connect your CMS in Profile → External APIs', 'Conecte su CMS en Perfil → APIs externas')); return; }
    if (!result || !trackedSiteId) return;
    setPublishing(true);
    try {
      const imageData = generatedImages.filter(img => img.placement).map(img => ({ dataUri: img.dataUri, placement: img.placement, style: img.style }));
      const functionName = isExistingPage ? 'cms-patch-content' : 'cms-publish-draft';
      const { data, error } = await supabase.functions.invoke(functionName, { body: { tracked_site_id: trackedSiteId, result_data: result, original_result_data: isEdited ? originalResult : null, url, keyword, images: imageData.length > 0 ? imageData : undefined } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t3(language, isExistingPage ? 'Page mise à jour.' : 'Brouillon envoyé au CMS.', isExistingPage ? 'Page updated.' : 'Draft sent to CMS.', isExistingPage ? 'Página actualizada.' : 'Borrador enviado al CMS.'));
    } catch (err: any) { toast.error(err.message || 'Erreur de publication'); }
    finally { setPublishing(false); }
  }, [hasCmsConnection, result, originalResult, isEdited, trackedSiteId, url, keyword, language, generatedImages]);

  const handleResetEdits = useCallback(() => {
    if (originalResult) { setResult(JSON.parse(JSON.stringify(originalResult))); toast.info('Contenu restauré à la version originale'); }
  }, [originalResult]);

  const handleSaveDraft = useCallback(async () => {
    if (!domain || !trackedSiteId) return;
    setSavingDraft(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const draftData2 = { url, keyword, page_type: pageType, result_snapshot: result, saved_at: new Date().toISOString() };
      const { error } = await supabase.from('cocoon_architect_drafts').insert({
        user_id: user.id, domain, tracked_site_id: trackedSiteId,
        draft_data: draftData2, source_message: `Brouillon — ${keyword || url}`,
      });
      if (error) throw error;
      toast.success('Brouillon enregistré');
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
    finally { setSavingDraft(false); }
  }, [domain, trackedSiteId, url, keyword, pageType, result]);

  const handleTogglePanel = useCallback((panelId: PanelId) => {
    setActivePanel(prev => prev === panelId ? null : panelId);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-[98vw] max-w-[1600px] h-[92vh] border border-slate-700/60 rounded-2xl flex flex-col overflow-hidden shadow-2xl bg-[#0f172a]`}>
        {/* Header — compact, no publish here */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/60 bg-gradient-to-r from-[#1e293b] to-[#0f172a]">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 stroke-[1.5] text-teal-400" />
            <span className="text-sm font-semibold text-white">Content Architect</span>
            {result && (
              <div className="flex items-center gap-2 ml-3">
                 <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400"><Type className="w-2.5 h-2.5 mr-1 stroke-[1.5]" />H1: {counters.h1}</Badge>
                 <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">H2: {counters.h2}</Badge>
                 <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400"><Hash className="w-2.5 h-2.5 mr-1 stroke-[1.5]" />{counters.chars.toLocaleString()} car.</Badge>
                 <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400"><Image className="w-2.5 h-2.5 mr-1 stroke-[1.5]" />{counters.medias}</Badge>
                 <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400"><Link2 className="w-2.5 h-2.5 mr-1 stroke-[1.5]" />{counters.links}</Badge>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {/* Body: Toolbar + Resizable Panels */}
        <div className="flex-1 flex overflow-hidden">
          <ContentArchitectToolbar activePanel={activePanel} onTogglePanel={handleTogglePanel} hasResult={!!result} colorTheme={colorTheme} />

          {activePanel ? (
            <ResizablePanelGroup direction="horizontal" className="flex-1" autoSaveId="content-architect-panels">
              {/* Left panel */}
              <ResizablePanel defaultSize={30} minSize={20} maxSize={45} className="flex flex-col bg-[#1e293b]">
                {/* Panel content area */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {activePanel === 'prompt' && (
                    <ContentArchitectPromptPanel
                      trackedSiteId={trackedSiteId} pageType={pageType} prompt={prompt} setPrompt={setPrompt}
                      domain={domain} url={url} setUrl={setUrl}
                      onSelectPreset={(preset, site) => {
                        if (preset.prompt_text) setPrompt(preset.prompt_text);
                        setPageType(preset.page_type === 'landing' ? 'landing' : preset.page_type === 'product' ? 'product' : 'article');
                        if (!url && site.domain) setUrl(`https://${site.domain}`);
                      }}
                    />
                  )}
                  {activePanel === 'structure' && (
                    <ContentArchitectStructurePanel
                      domain={domain || ''} directory={directory}
                      setDirectory={(v) => { setDirectory(v); setAutoFilled(prev => new Set(prev).add('directory_manual')); }}
                      directories={directories} slug={slug}
                      setSlug={(v) => { setSlug(v); setAutoFilled(prev => new Set(prev).add('slug_manual')); }}
                      keyword={keyword} setKeyword={setKeyword} pageType={pageType}
                      setPageType={(v) => { setPageType(v); setAutoFilled(prev => new Set(prev).add('pageType_manual')); }}
                      length={length} setLength={setLength} h1Field={h1Field} setH1Field={setH1Field}
                      h2Fields={h2Fields} setH2Fields={setH2Fields} keywordTags={keywordTags} setKeywordTags={setKeywordTags}
                      keywordCloudSuggestions={keywordCloudSuggestions} autoFilled={autoFilled} isExistingPage={isExistingPage}
                      detectPageTypeFromDirectory={detectPageTypeFromDirectory} result={result} setResult={setResult}
                      loading={loading} onGenerate={handleGenerate} strategistLoading={strategistLoading}
                      strategistDone={strategistDone} language={language} pageTypes={PAGE_TYPES} lengths={LENGTHS}
                    />
                  )}
                  {activePanel === 'structured-data' && (
                    <ContentArchitectStructuredDataPanel result={result} setResult={setResult} />
                  )}
                  {activePanel === 'images' && (
                    <ContentArchitectImagePanel
                      workflowStep={workflowStep} pageType={pageType} trackedSiteId={trackedSiteId} targetUrl={url}
                      identityCard={identityCard} generatedImages={generatedImages} imageIterations={imageIterations}
                      onImageGenerated={(dataUri, style) => { setGeneratedImages(prev => [...prev, { dataUri, style, placement: null }]); setImageIterations(prev => prev + 1); }}
                      onImageRemoved={(index) => { setGeneratedImages(prev => prev.filter((_, i) => i !== index)); }}
                      onImagePlacement={(index, placement) => { setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, placement } : img)); }}
                    />
                  )}
                  {activePanel === 'draft' && (
                    <ContentArchitectDraftPanel
                      domain={domain} trackedSiteId={trackedSiteId} result={result} keyword={keyword} url={url} pageType={pageType}
                      onLoadDraft={applyDraft}
                    />
                  )}
                  {activePanel === 'library' && (
                    <ContentArchitectLibraryPanel trackedSiteId={trackedSiteId} domain={domain} />
                  )}
                  {activePanel === 'options' && (
                    <ContentArchitectOptionsPanel
                      competitorUrl={competitorUrl} setCompetitorUrl={setCompetitorUrl}
                      ctaLink={ctaLink} setCtaLink={setCtaLink} photoUrl={photoUrl} setPhotoUrl={setPhotoUrl}
                      tone={tone} setTone={setTone} autoFilled={autoFilled}
                      audienceSegment={audienceSegment} setAudienceSegment={setAudienceSegment}
                      audienceDetails={audienceDetails}
                    />
                  )}
                  {activePanel === 'voice' && trackedSiteId && domain && (
                    <VoiceDNAEditor trackedSiteId={trackedSiteId} domain={domain} />
                  )}
                  {activePanel === 'tasks' && (
                    <ContentArchitectTasksPanel
                      domain={domain} trackedSiteId={trackedSiteId}
                      onApplyTask={(task) => {
                        setPrompt(prev => prev ? `${prev}\n\n${task.title}: ${task.description}` : `${task.title}: ${task.description}`);
                        toast.success('Tâche injectée dans les instructions');
                      }}
                    />
                  )}
                  {activePanel === 'quickwins' && (
                    <ContentArchitectQuickWinsPanel
                      trackedSiteId={trackedSiteId}
                      domain={domain}
                      onApply={(item) => {
                        if (item.keyword) setKeyword(item.keyword);
                        if (item.url) setUrl(item.url);
                        if (item.pageType) { setPageType(item.pageType); setAutoFilled(prev => new Set(prev).add('pageType_manual')); }
                        if (item.prompt) setPrompt(prev => prev ? `${prev}\n\n${item.prompt}` : item.prompt);
                        setActivePanel('structure');
                        toast.success('Quick win appliqué — complétez les champs et injectez');
                      }}
                    />
                  )}
                </div>

                {/* Shared prompt contenu */}
                <div className="border-t border-slate-700/60 flex flex-col" style={{ minHeight: '120px' }}>
                  <div className="px-3 pt-2 pb-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Prompt contenu</label>
                  </div>
                  <div className="flex-1 px-3 pb-1">
                    <Textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="Ex: Inclure un tableau comparatif, citer des sources…"
                      className="w-full bg-slate-700/50 border-slate-600 text-white text-xs resize-y min-h-[60px] max-h-[300px]"
                      style={{ height: '80px' }}
                    />
                  </div>
                  <div className="px-3 pb-2 pt-1 sticky bottom-0 bg-[#1e293b]">
                    <Button
                      size="sm"
                      onClick={handleGenerate}
                      disabled={loading || !keyword}
                      className="w-full text-xs gap-1.5 bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border border-teal-500/30"
                    >
                      <Syringe className="w-3 h-3 stroke-[1.5]" />
                      Injecter
                    </Button>
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Preview panel */}
              <ResizablePanel defaultSize={70} minSize={40}>
                <ContentArchitectProvider value={{
                  result, setResult, loading, url,
                  isEdited, onResetEdits: handleResetEdits,
                  showGuide, setShowGuide, language, counters,
                  onSaveDraft: handleSaveDraft, onPublish: handlePublish,
                  publishing, savingDraft,
                  hasCmsConnection, isExistingPage,
                  creditsCost: !isAgencyPro ? 5 : null,
                  colorTheme,
                }}>
                  <ContentArchitectPreview />
                </ContentArchitectProvider>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            /* No panel open — full preview */
            <ContentArchitectProvider value={{
              result, setResult, loading, url,
              isEdited, onResetEdits: handleResetEdits,
              showGuide, setShowGuide, language, counters,
              onSaveDraft: handleSaveDraft, onPublish: handlePublish,
              publishing, savingDraft,
              hasCmsConnection, isExistingPage,
              creditsCost: !isAgencyPro ? 5 : null,
              colorTheme,
            }}>
              <ContentArchitectPreview />
            </ContentArchitectProvider>
          )}
        </div>
      </div>
    </div>
  );
}
