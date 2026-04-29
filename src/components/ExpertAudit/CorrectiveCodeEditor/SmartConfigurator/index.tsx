import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Copy, Check, Code, Zap, Wrench, Sparkles, Globe, Save, Rocket, Library, Upload, Loader2, RotateCcw,
  Download, Link2, AlertCircle, Plug, Cable, Crown, FileText, PenTool, Search, Lock, Shield
} from 'lucide-react';
import { ContentArchitectureAdvisor } from '@/components/ContentAdvisor/ContentArchitectureAdvisor';
import { InjectionSearchBar, CatalogEntry } from './InjectionSearchBar';
import { CodeValidator } from './CodeValidator';
import { WordPressConfigCard } from '@/components/Profile/WordPressConfigCard';
import { ScribeTab } from './ScribeTab';
import { handleWPIntegration, isSiteSynced } from '@/utils/wpIntegration';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { t3 } from '@/utils/i18n';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useContentArchitectVisibility } from '@/hooks/useContentArchitectVisibility';
import { useFreemiumMode } from '@/contexts/FreemiumContext';
import { supabase } from '@/integrations/supabase/client';
import { ExpertAuditResult } from '@/types/expertAudit';
import { CodeBlock } from '../CodeBlock';
import { TechnicalTab } from './TechnicalTab';
import { StrategicTab } from './StrategicTab';
import { GenerativeTab } from './GenerativeTab';
import { VisualPreview } from './VisualPreview';
import { SecurityZone } from './SecurityZone';
import { MultiPageRouter } from './MultiPageRouter';
import { FixConfig, STRATEGIC_FIXES, GENERATIVE_FIXES, ViewMode, classifyFixChannel } from './types';
import { ContentDelegationSection } from './ContentDelegationSection';
import { toast as sonnerToast } from 'sonner';

// Hallucination data can be in legacy or new format
interface HallucinationData {
  trueValue?: string;
  correctedIntro?: string;
  discrepancies?: Array<{ field: string; original: string; corrected: string; impact: string; explanation: string }>;
  recommendations?: Array<{ id: string; category: string; priority: string; title: string; description: string; codeSnippet?: string }>;
  analysisNarrative?: string;
  originalValues?: Record<string, string>;
  correctedValues?: Record<string, string>;
  confusionSources?: string[];
}

function hasHallucinationFixes(data: HallucinationData | null | undefined): boolean {
  if (!data) return false;
  if (data.trueValue) return true;
  if (data.discrepancies && data.discrepancies.length > 0) return true;
  if (data.recommendations && data.recommendations.length > 0) return true;
  return false;
}

function extractTrueValueFromDiagnosis(data: HallucinationData): string {
  if (data.trueValue) return data.trueValue;
  if (data.correctedValues?.valueProposition) return data.correctedValues.valueProposition;
  if (data.analysisNarrative) return data.analysisNarrative;
  return '';
}

interface FixMetadata {
  id: string;
  label: string;
  category: string;
}

/** Card noire avec le snippet à copier-coller pour brancher le site */
function PlugSnippetCard({ apiKey, siteDomain }: { apiKey?: string; siteDomain: string }) {
  const [snippetCopied, setSnippetCopied] = useState(false);
  const displayKey = apiKey || 'VOTRE-CLE-API';
  const snippet = `<script>\n  window.CRAWLERS_API_KEY = "${displayKey}";\n</script>\n<script src="https://crawlers.fr/widget.js" defer></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="bg-zinc-950 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Branchez {siteDomain}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            {snippetCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="ml-1 text-[11px]">{snippetCopied ? 'Copié !' : 'Copier'}</span>
          </Button>
        </div>
        <pre className="text-[11px] leading-relaxed font-mono text-emerald-400 bg-zinc-900 rounded-md p-3 overflow-x-auto whitespace-pre border border-zinc-800">
{`<script>
  window.CRAWLERS_API_KEY = "${displayKey}";
</script>
<script src="https://crawlers.fr/widget.js"
        defer></script>`}
        </pre>
        <p className="text-[10px] text-zinc-500 leading-snug">
          Collez ce code avant <code className="text-zinc-400 bg-zinc-800 px-1 rounded">&lt;/head&gt;</code> ou dans une balise HTML personnalisée Google Tag Manager.
          {!apiKey && <span className="block mt-1 text-amber-500">⚠ Ajoutez d'abord ce site dans Mon Espace → Mes Sites pour obtenir votre clé API.</span>}
        </p>
      </div>
    </div>
  );
}

interface SmartConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  technicalResult: ExpertAuditResult | null;
  strategicResult: ExpertAuditResult | null;
  siteUrl: string;
  siteName: string;
  hallucinationData?: HallucinationData | null;
  // Props for post-payment initialization
  initialCode?: string;
  initialHasPaid?: boolean;
  initialFixesMetadata?: FixMetadata[];
  onPaymentVerified?: () => void;
  // Optional: active tracked site ID for direct config persistence
  activeSiteId?: string | null;
}

export function SmartConfigurator({
  isOpen,
  onClose,
  technicalResult,
  strategicResult,
  siteUrl,
  siteName,
  hallucinationData,
  initialCode = '',
  initialHasPaid = false,
  initialFixesMetadata = [],
  onPaymentVerified,
  activeSiteId = null,
}: SmartConfiguratorProps) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [registryRecommendations, setRegistryRecommendations] = useState<any[]>([]);
  const [strategicRoadmap, setStrategicRoadmap] = useState<any[]>([]);
  const [fixConfigs, setFixConfigs] = useState<FixConfig[]>([]);
  const [activeTab, setActiveTab] = useState('technical');
  const [viewMode, setViewMode] = useState<ViewMode>(initialCode ? 'code' : 'visual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const generationAbortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const [generatedCode, setGeneratedCode] = useState<string>(initialCode);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPaid, setHasPaid] = useState(initialHasPaid);
  const [showLockOverlay, setShowLockOverlay] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [codeSource, setCodeSource] = useState<'library' | 'hybrid' | 'new_generation' | null>(null);
  const [libraryHits, setLibraryHits] = useState(0);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [showWpConfigModal, setShowWpConfigModal] = useState(false);
  const [showConnectSiteModal, setShowConnectSiteModal] = useState(false);
  const [wpSiteData, setWpSiteData] = useState<{ id: string; domain: string; apiKey: string; hasConfig: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCmsConnectionForContent, setHasCmsConnectionForContent] = useState(false);
  const [contentDelegationStatus, setContentDelegationStatus] = useState<'idle' | 'generating' | 'ready' | 'deployed'>('idle');
  const [selectedInjection, setSelectedInjection] = useState<CatalogEntry | null>(null);
  const [codeValidated, setCodeValidated] = useState(false);
  const [editableCode, setEditableCode] = useState('');
  
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();
  const { openMode } = useFreemiumMode();
  const { isContentArchitectVisible } = useContentArchitectVisibility();
  const canGenerateCode = isAgencyPro || isAdmin;
  const showContentTabs = isContentArchitectVisible && isAdmin && !openMode;

  // Extract domain from siteUrl for payment check
  const siteDomain = useMemo(() => {
    try {
      return new URL(siteUrl).hostname.replace('www.', '');
    } catch {
      return siteUrl;
    }
  }, [siteUrl]);

  // Check if user has already paid for this site
  const checkPaymentStatus = useCallback(async () => {
    if (!siteUrl) return;
    
    setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select('id, status, site_url')
        .eq('status', 'paid')
        .ilike('site_url', `%${siteDomain}%`)
        .limit(1);
      
      if (error) throw error;
      
      setHasPaid(data && data.length > 0);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setHasPaid(false);
    } finally {
      setIsCheckingPayment(false);
    }
  }, [siteUrl, siteDomain]);

  // Fetch tracked site data for WP install section
  const fetchWpSiteData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tracked_sites')
      .select('id, domain, api_key, current_config')
      .eq('user_id', user.id)
      .eq('domain', siteDomain)
      .maybeSingle();
    if (data) {
      // Use profile API key (universal) instead of per-site key
      const { data: profileData } = await supabase
        .from('profiles')
        .select('api_key')
        .eq('user_id', user.id)
        .maybeSingle();
      setWpSiteData({
        id: data.id,
        domain: data.domain,
        apiKey: profileData?.api_key || data.api_key,
        hasConfig: isSiteSynced(data.current_config as Record<string, unknown>),
      });
    } else {
      setWpSiteData(null);
    }
  }, [user, siteDomain]);

  // Full audit data extracted from reports (used when opened from "Mes sites")
  const [savedAuditData, setSavedAuditData] = useState<Record<string, any> | null>(null);

  // Fetch audit intelligence: recommendations registry + strategic roadmap + saved reports/action plans
  const fetchAuditIntelligence = useCallback(async () => {
    if (!user || !siteDomain) return;
    setIsPreloading(true);
    try {
      // Parallel fetch: registry, saved reports for this domain, action plans for this domain
      const [registryResult, reportsResult, actionPlansResult] = await Promise.all([
        supabase
          .from('audit_recommendations_registry')
          .select('*')
          .eq('user_id', user.id)
          .eq('domain', siteDomain)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('saved_reports')
          .select('report_type, report_data, url, created_at')
          .eq('user_id', user.id)
          .ilike('url', `%${siteDomain}%`)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('architect_workbench')
          .select('title, description, severity, finding_category, source_type, status, target_url')
          .eq('user_id', user.id)
          .eq('domain', siteDomain)
          .in('status', ['pending', 'in_progress', 'assigned'])
          .order('spiral_score', { ascending: false })
          .limit(30),
      ]);

      if (registryResult.data) {
        setRegistryRecommendations(registryResult.data);
      }

      // Extract strategic roadmap from strategicResult prop OR from saved reports
      let roadmap = strategicResult?.strategicAnalysis?.executive_roadmap || [];

      // Extract workbench tasks (always, whether live audit or not)
      let extractedAuditData: Record<string, any> = {};
      
      if (actionPlansResult.data && actionPlansResult.data.length > 0) {
        const allTasks = actionPlansResult.data.map((item: any) => ({
          id: item.id || crypto.randomUUID(),
          title: item.title,
          description: item.description,
          priority: item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'important' : 'optional',
          category: item.finding_category,
          auditType: item.source_type,
          source: 'workbench',
          isCompleted: false,
        }));
        extractedAuditData.activeActionPlanTasks = allTasks;
        console.log(`[Architect] Found ${allTasks.length} workbench tasks`);
      }

      // If no live audit data, also reconstruct from saved reports
      if (!technicalResult && !strategicResult && reportsResult.data && reportsResult.data.length > 0) {
        console.log(`[Architect] No live audit — reconstructing from ${reportsResult.data.length} saved reports`);

        for (const report of reportsResult.data) {
          const rd = report.report_data as Record<string, any>;
          if (!rd) continue;

          if (report.report_type === 'seo_technical' || report.report_type === 'seo_strategic') {
            if (rd.scores) extractedAuditData.scores = rd.scores;
            if (rd.totalScore) extractedAuditData.totalScore = rd.totalScore;
            if (rd.recommendations) extractedAuditData.recommendations = rd.recommendations;
            if (rd.rawData) extractedAuditData.rawData = rd.rawData;
            if (rd.strategicAnalysis) {
              extractedAuditData.strategicAnalysis = rd.strategicAnalysis;
              if (!roadmap.length && rd.strategicAnalysis.executive_roadmap) {
                roadmap = rd.strategicAnalysis.executive_roadmap;
              }
            }
          }
          if (report.report_type === 'geo') {
            extractedAuditData.geoData = rd;
          }
          if (report.report_type === 'llm') {
            extractedAuditData.llmData = rd;
          }
          if (report.report_type === 'pagespeed') {
            extractedAuditData.pagespeedData = rd;
          }
        }
      }

      setSavedAuditData(extractedAuditData);

      setStrategicRoadmap(roadmap);

      console.log(`[Architect] Preloaded ${registryResult.data?.length || 0} registry, ${roadmap.length} roadmap items, ${reportsResult.data?.length || 0} reports for ${siteDomain}`);
    } catch (err) {
      console.error('[Architect] Error fetching audit intelligence:', err);
    } finally {
      setIsPreloading(false);
    }
  }, [user, siteDomain, strategicResult, technicalResult]);

  useEffect(() => {
    if (isOpen) {
      fetchWpSiteData();
      fetchAuditIntelligence();
      // Check CMS connection for content delegation
      if (user && siteDomain) {
        const checkCms = async () => {
          const siteId = activeSiteId || await (async () => {
            const { data } = await supabase.from('tracked_sites').select('id').eq('user_id', user.id).eq('domain', siteDomain).maybeSingle();
            return data?.id;
          })();
          if (siteId) {
            const { data } = await supabase.from('cms_connections_public' as any).select('id').eq('tracked_site_id', siteId).limit(1);
            setHasCmsConnectionForContent((data?.length || 0) > 0);
          }
        };
        checkCms();
      }
    }
  }, [isOpen, fetchWpSiteData, fetchAuditIntelligence, user, siteDomain, activeSiteId]);

  // Mark as ready once preloading finishes (one-way: stays true once set to avoid flicker on re-focus)
  useEffect(() => {
    if (isOpen && !isPreloading && !isReady) {
      const t = setTimeout(() => setIsReady(true), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, isPreloading, isReady]);

  // Reset ready state only when modal is explicitly closed
  useEffect(() => {
    if (!isOpen) {
      setIsReady(false);
    }
  }, [isOpen]);

  // Generate fix configurations from audit results
  const availableFixes = useMemo(() => {
    const fixes: FixConfig[] = [];

    // Safely access nested scores — cached data from "Mes Sites" may have partial structure
    const semantic = technicalResult?.scores?.semantic;
    const aiReady = technicalResult?.scores?.aiReady;
    const perf = technicalResult?.scores?.performance;
    const security = technicalResult?.scores?.security;

    if (technicalResult && semantic) {
      // SEO Fixes
      if (!semantic.hasTitle || semantic.titleLength > 70) {
        fixes.push({
          id: 'fix_title',
          category: 'seo',
          label: 'Optimiser la balise Title',
          description: 'Ajoute ou corrige la balise <title> pour le SEO',
          enabled: true,
          priority: 'critical',
          data: { currentTitle: technicalResult.rawData?.htmlAnalysis?.title || '' }
        });
      }

      if (!semantic.hasMetaDesc) {
        fixes.push({
          id: 'fix_meta_desc',
          category: 'seo',
          label: 'Ajouter Meta Description',
          description: 'Injecte une meta description optimisée',
          enabled: true,
          priority: 'critical',
        });
      }

      if (!semantic.hasUniqueH1 || semantic.h1Count === 0) {
        fixes.push({
          id: 'fix_h1',
          category: 'seo',
          label: 'Corriger la balise H1',
          description: 'Assure un H1 unique et optimisé',
          enabled: false,
          priority: 'critical',
        });
      }
    }

    if (technicalResult && aiReady && !aiReady.hasSchemaOrg) {
      fixes.push({
        id: 'fix_jsonld',
        category: 'seo',
        label: 'Ajouter JSON-LD Schema.org',
        description: 'Injecte des données structurées pour l\'IA et Google',
        enabled: true,
        priority: 'important',
        data: { siteName, siteUrl }
      });
    }

    if (technicalResult && perf && perf.lcp > 2500) {
      fixes.push({
        id: 'fix_lazy_images',
        category: 'performance',
        label: 'Lazy Loading des images',
        description: 'Ajoute le lazy loading aux images hors viewport',
        enabled: true,
        priority: 'important',
      });
    }

    if (technicalResult && security && !security.isHttps) {
      fixes.push({
        id: 'fix_https_redirect',
        category: 'seo',
        label: 'Redirection HTTPS',
        description: 'Force la redirection vers HTTPS',
        enabled: true,
        priority: 'critical',
      });
    }

    // Accessibility fixes - only if audit detects issues
    if (technicalResult && semantic) {
      const missingAlt = (semantic as any)?.imagesMissingAlt ?? 0;
      if (missingAlt > 0) {
        fixes.push({
          id: 'fix_alt_images',
          category: 'accessibility',
          label: 'Alt text pour images',
          description: `${missingAlt} image(s) sans attribut alt détectée(s)`,
          enabled: true,
          priority: 'important',
        });
      }
    }

    fixes.push({
      id: 'fix_contrast',
      category: 'accessibility',
      label: 'Améliorer le contraste',
      description: 'Ajuste les couleurs des éléments à faible contraste',
      enabled: false,
      priority: 'optional',
    });

    // Tracking fixes - GTM: enabled by default if missing, greyed out if already present
    if (technicalResult && semantic) {
      const hasGTM = (semantic as any)?.hasGTM ?? false;
      const hasGA4 = (semantic as any)?.hasGA4 ?? false;

      fixes.push({
        id: 'fix_gtm',
        category: 'tracking',
        label: 'Intégrer Google Tag Manager',
        description: hasGTM ? 'GTM déjà détecté sur votre site' : 'GTM non détecté — injecte le snippet GTM',
        enabled: !hasGTM,
        priority: hasGTM ? 'installed' : 'optional',
        data: { gtmId: 'GTM-XXXXXXX' },
        locked: hasGTM,
      });

      if (!hasGA4) {
        fixes.push({
          id: 'fix_ga4',
          category: 'tracking',
          label: 'Ajouter Google Analytics 4',
          description: 'GA4 non détecté — injecte le pixel GA4',
          enabled: false,
          priority: 'optional',
          data: { measurementId: 'G-XXXXXXXXXX' }
        });
      }
    }

    // Hallucination fix
    if (hasHallucinationFixes(hallucinationData)) {
      const trueValue = extractTrueValueFromDiagnosis(hallucinationData!);
      fixes.push({
        id: 'fix_hallucination',
        category: 'hallucination',
        label: 'Correction Hallucination IA',
        description: 'Injecte des métadonnées clarificatrices pour les LLM',
        enabled: true,
        priority: 'critical',
        data: {
          trueValue,
          confusionSources: hallucinationData!.confusionSources || [],
          correctedIntro: hallucinationData!.correctedIntro || '',
          discrepancies: hallucinationData!.discrepancies || [],
          correctedValues: hallucinationData!.correctedValues || {},
          recommendations: hallucinationData!.recommendations || []
        }
      });
    }

    // ═══ DYNAMIC PRE-SELECTION FROM AUDIT INTELLIGENCE ═══
    // Map registry recommendation IDs to fix IDs
    const registryFixMapping: Record<string, string[]> = {
      'title_optimization': ['fix_title'],
      'meta_description': ['fix_meta_desc'],
      'h1_optimization': ['fix_h1'],
      'json_ld': ['fix_jsonld'],
      'schema_org': ['fix_jsonld'],
      'lazy_loading': ['fix_lazy_images'],
      'https_redirect': ['fix_https_redirect'],
      'alt_images': ['fix_alt_images'],
      'contrast': ['fix_contrast'],
      'gtm': ['fix_gtm'],
      'ga4': ['fix_ga4'],
    };

    // Collect unresolved registry recommendation IDs
    const unresolvedRecIds = new Set(
      registryRecommendations
        .filter(r => !r.is_resolved)
        .flatMap(r => {
          const mapped = Object.entries(registryFixMapping)
            .filter(([key]) => r.recommendation_id?.includes(key) || r.title?.toLowerCase().includes(key) || r.category?.toLowerCase().includes(key))
            .flatMap(([, fixIds]) => fixIds);
          return mapped;
        })
    );

    // Determine which strategic fixes to pre-enable based on roadmap
    const roadmapCategories = new Set(strategicRoadmap.map((item: any) => item.category?.toLowerCase()));
    const roadmapActions = strategicRoadmap.map((item: any) => (item.prescriptive_action || item.action_concrete || '').toLowerCase()).join(' ');

    const strategicPreEnableMap: Record<string, () => boolean> = {
      inject_faq: () => roadmapActions.includes('faq') || roadmapActions.includes('questions fréquentes'),
      inject_blog_section: () => roadmapActions.includes('blog') || roadmapActions.includes('éditorial') || roadmapActions.includes('contenu') || roadmapCategories.has('contenu'),
      enhance_semantic_meta: () => roadmapActions.includes('meta') || roadmapActions.includes('sémantique') || roadmapActions.includes('open graph'),
      inject_breadcrumbs: () => roadmapActions.includes('breadcrumb') || roadmapActions.includes('fil d\'ariane'),
      inject_local_business: () => roadmapActions.includes('local') || roadmapActions.includes('localbusiness') || roadmapActions.includes('géolocalisation'),
    };

    const generativePreEnableMap: Record<string, () => boolean> = {
      fix_missing_blog: () => roadmapActions.includes('blog') || roadmapActions.includes('actualités'),
      fix_semantic_injection: () => roadmapActions.includes('sémantique') || roadmapActions.includes('autorité') || roadmapCategories.has('autorité'),
      fix_robot_context: () => roadmapActions.includes('hallucination') || roadmapActions.includes('llm') || roadmapActions.includes('entité') || roadmapCategories.has('identité'),
      fix_pagespeed_suite: () => roadmapActions.includes('performance') || roadmapActions.includes('pagespeed') || roadmapActions.includes('cls') || roadmapActions.includes('lcp'),
    };

    // Build strategic fix prompt data from roadmap
    const buildStrategicFixData = (fixId: string): Record<string, any> => {
      const data: Record<string, any> = {};
      const relevantRoadmap = strategicRoadmap.filter((item: any) => {
        const action = (item.prescriptive_action || item.action_concrete || '').toLowerCase();
        if (fixId === 'inject_faq') return action.includes('faq') || action.includes('questions');
        if (fixId === 'inject_blog_section') return action.includes('blog') || action.includes('contenu') || action.includes('éditorial');
        if (fixId === 'enhance_semantic_meta') return action.includes('meta') || action.includes('sémantique');
        if (fixId === 'inject_local_business') return action.includes('local');
        return false;
      });

      if (relevantRoadmap.length > 0) {
        data._roadmapContext = relevantRoadmap.map((item: any) => item.prescriptive_action || item.action_concrete).join('\n');
        data._strategicRationale = relevantRoadmap.map((item: any) => item.strategic_rationale || item.strategic_goal).join('\n');
      }

      // Pre-fill from keyword positioning
      const kp = strategicResult?.strategicAnalysis?.keyword_positioning;
      if (kp && fixId === 'inject_blog_section') {
        data.keywords = kp.main_keywords?.slice(0, 5).map((k: any) => k.keyword) || [];
        if (kp.content_gaps?.length) {
          data.topic = kp.content_gaps[0].keyword;
        }
      }

      return data;
    };

    // Strategic fixes (from STRATEGIC_FIXES) - now dynamically enabled from roadmap
    Object.values(STRATEGIC_FIXES).forEach(strategicFix => {
      const shouldEnable = strategicPreEnableMap[strategicFix.id]?.() || false;
      fixes.push({
        ...strategicFix,
        enabled: shouldEnable,
        isRecommended: shouldEnable,
        data: shouldEnable ? buildStrategicFixData(strategicFix.id) : {},
      });
    });

    // Generative Super-Capacities (from GENERATIVE_FIXES) - dynamically enabled from roadmap
    Object.values(GENERATIVE_FIXES).forEach(generativeFix => {
      const shouldEnable = generativePreEnableMap[generativeFix.id]?.() || false;
      fixes.push({
        ...generativeFix,
        enabled: shouldEnable,
        isRecommended: shouldEnable,
        data: shouldEnable ? buildStrategicFixData(generativeFix.id) : {},
      });
    });

    // ═══ DYNAMIC FIXES FROM ACTION PLANS ═══
    // Generate site-specific fix proposals from uncompleted action plan tasks
    const existingFixIds = new Set(fixes.map(f => f.id));
    const actionPlanTasks = (savedAuditData?.activeActionPlanTasks || []) as Array<{
      id: string; title: string; priority: string; category: string; isCompleted: boolean; auditType: string;
    }>;

    // Also include tasks from live action plan data if available
    const liveStrategicTasks = strategicRoadmap.map((item: any, i: number) => ({
      id: `live-roadmap-${i}`,
      title: item.title || item.prescriptive_action || item.action_concrete || '',
      priority: item.priority === 'Prioritaire' ? 'critical' : item.priority === 'Important' ? 'important' : 'optional',
      category: (item.category || 'contenu').toLowerCase(),
      isCompleted: false,
      auditType: 'strategic',
      _description: item.prescriptive_action || item.action_concrete || '',
      _rationale: item.strategic_rationale || item.strategic_goal || '',
    }));

    // Also include LIVE technical recommendations from the audit result
    const liveTechnicalTasks = (technicalResult?.recommendations || []).map((rec: any, i: number) => ({
      id: `live-tech-${rec.id || i}`,
      title: rec.title || '',
      priority: rec.priority || 'optional',
      category: rec.category || 'seo',
      isCompleted: false,
      auditType: 'technical',
      _description: rec.description || rec.title || '',
      _rationale: '',
    }));

    const allDynamicTasks = [...actionPlanTasks, ...liveStrategicTasks, ...liveTechnicalTasks];

    // Deduplicate by title similarity
    const seenTitles = new Set<string>();
    const dynamicFixes: FixConfig[] = [];

    for (const task of allDynamicTasks) {
      if (task.isCompleted) continue;
      if (!task.title) continue;
      const titleLower = (task.title || '').toLowerCase();
      const descLower = ((task as any)._description || task.title || '').toLowerCase();
      const combined = `${titleLower} ${descLower}`;
      
      // ═══ FILTER: Skip tasks that can't be solved with code injection ═══
      const NON_CODE_PATTERNS = [
        'google business', 'google my business', 'fiche google',
        'campagne', 'publicité', 'ads', 'adwords',
        'partenariat', 'collaboration', 'networking',
        'formation', 'recrutement', 'embauche',
        'stratégie éditoriale', 'calendrier éditorial', 'planning',
        'veille', 'benchmark', 'étude de marché',
        'relation presse', 'communiqué',
        'newsletter', 'emailing', 'email marketing',
        'podcast', 'webinaire', 'webinar',
      ];
      const isNonCodeTask = NON_CODE_PATTERNS.some(p => combined.includes(p));
      if (isNonCodeTask) continue;

      // ═══ TRANSFORM: Convert social media tasks into code-actionable CTA fixes ═══
      const SOCIAL_PATTERNS = [
        'linkedin', 'twitter', 'x.com', 'tiktok', 'instagram', 'youtube',
        'facebook', 'social media', 'réseaux sociaux', 'redes sociales',
        'thought leadership', 'personal branding', 'fondateur',
        'social proof', 'communauté', 'community',
      ];
      const isSocialTask = SOCIAL_PATTERNS.some(p => combined.includes(p));

      if (isSocialTask) {
        // Detect which platform is mentioned
        let platform = 'LinkedIn';
        let platformUrl = '';
        if (combined.includes('youtube')) { platform = 'YouTube'; platformUrl = 'https://youtube.com/'; }
        else if (combined.includes('tiktok')) { platform = 'TikTok'; platformUrl = 'https://tiktok.com/'; }
        else if (combined.includes('instagram')) { platform = 'Instagram'; platformUrl = 'https://instagram.com/'; }
        else if (combined.includes('twitter') || combined.includes('x.com')) { platform = 'X (Twitter)'; platformUrl = 'https://x.com/'; }
        else if (combined.includes('facebook')) { platform = 'Facebook'; platformUrl = 'https://facebook.com/'; }
        else { platform = 'LinkedIn'; platformUrl = 'https://linkedin.com/'; }

        // Determine the best CTA type based on context
        let ctaType = 'Profil';
        let ctaLabel = `CTA vers ${platform}`;
        let ctaDescription = `Injecte un bloc d'appel à l'action vers ${platform}`;

        if (combined.includes('chaîne') || combined.includes('channel') || combined.includes('vidéo') || platform === 'YouTube') {
          ctaType = 'Chaîne';
          ctaLabel = `CTA vers la chaîne ${platform}`;
          ctaDescription = `Injecte un bloc CTA invitant à suivre la chaîne ${platform}, renforçant la preuve sociale et l'autorité`;
        } else if (combined.includes('article') || combined.includes('publication') || combined.includes('post') || combined.includes('thought leadership')) {
          ctaType = 'Publications';
          ctaLabel = `CTA vers les publications ${platform}`;
          ctaDescription = `Injecte un bloc CTA renvoyant vers les publications ${platform}, démontrant l'expertise sectorielle`;
        } else if (combined.includes('communauté') || combined.includes('community') || combined.includes('groupe') || combined.includes('group')) {
          ctaType = 'Communauté';
          ctaLabel = `CTA vers la communauté ${platform}`;
          ctaDescription = `Injecte un bloc CTA vers le groupe/communauté ${platform}, renforçant l'engagement et la preuve sociale`;
        } else if (combined.includes('fondateur') || combined.includes('founder') || combined.includes('ceo') || combined.includes('dirigeant')) {
          ctaType = 'Fondateur';
          ctaLabel = `CTA vers le profil ${platform} du fondateur`;
          ctaDescription = `Injecte un bloc CTA vers le profil ${platform} du dirigeant, renforçant l'autorité E-E-A-T`;
        } else if (combined.includes('autorité') || combined.includes('authority') || combined.includes('expertise') || combined.includes('crédibilité')) {
          ctaType = 'Autorité';
          ctaLabel = `CTA d'autorité vers ${platform}`;
          ctaDescription = `Injecte un bloc CTA valorisant la présence ${platform} comme signal d'autorité pour les LLMs`;
        } else {
          ctaLabel = `CTA social vers ${platform}`;
          ctaDescription = `Injecte un bloc d'appel à l'action vers ${platform}, renforçant la citabilité et la preuve sociale`;
        }

        const fixId = `actionplan_cta_${(platform || '').toLowerCase().replace(/[^a-z]/g, '')}_${task.id}`;
        if (seenTitles.has(fixId)) continue;
        seenTitles.add(fixId);

        dynamicFixes.push({
          id: fixId,
          category: 'generative',
          label: ctaLabel,
          description: ctaDescription,
          enabled: false,
          priority: 'important' as const,
          isRecommended: true,
          data: {
            _source: 'action_plan_transformed',
            _originalTask: task.title,
            _platform: platform,
            _platformUrl: platformUrl,
            _ctaType: ctaType,
            _rationale: (task as any)._rationale || '',
          },
        });
        continue;
      }

      // Skip if we already have a hardcoded fix covering this
      const coveredByExisting = [...existingFixIds].some(fixId => {
        const fixLabel = fixes.find(f => f.id === fixId)?.label?.toLowerCase() || '';
        return titleLower.includes(fixLabel.split(' ').slice(0, 2).join(' ')) ||
               fixLabel.includes(titleLower.split(' ').slice(0, 2).join(' '));
      });
      if (coveredByExisting) continue;

      // Deduplicate
      const titleKey = titleLower.slice(0, 40);
      if (seenTitles.has(titleKey)) continue;
      seenTitles.add(titleKey);

      // Determine category mapping
      const catLower = (task.category || '').toLowerCase();
      let fixCategory: FixConfig['category'] = 'strategic';
      if (task.auditType === 'technical') {
        if (catLower.includes('perf')) fixCategory = 'performance';
        else if (catLower.includes('sécu')) fixCategory = 'seo';
        else if (catLower.includes('access')) fixCategory = 'accessibility';
        else fixCategory = 'seo';
      } else {
        if (catLower.includes('identité')) fixCategory = 'strategic';
        else if (catLower.includes('contenu')) fixCategory = 'generative';
        else if (catLower.includes('autorité')) fixCategory = 'strategic';
        else if (catLower.includes('technique')) fixCategory = 'performance';
        else fixCategory = 'strategic';
      }

      const fixPriority: FixConfig['priority'] = 
        task.priority === 'critical' ? 'critical' : 
        task.priority === 'important' ? 'important' : 'optional';

      const fixId = `actionplan_${task.id}`;

      dynamicFixes.push({
        id: fixId,
        category: fixCategory,
        label: task.title.length > 50 ? task.title.slice(0, 50) + '…' : task.title,
        description: (task as any)._description || task.title,
        enabled: fixPriority === 'critical',
        priority: fixPriority,
        isRecommended: true,
        data: {
          _source: 'action_plan',
          _rationale: (task as any)._rationale || '',
          _taskTitle: task.title,
        },
      });
    }

    fixes.push(...dynamicFixes);

    // ═══ CLASSIFY DELIVERY CHANNEL (code vs content) ═══
    // Also pre-enable technical fixes that match unresolved registry recommendations
    return fixes.map(fix => {
      const deliveryChannel = classifyFixChannel(fix.id);
      const updated = { ...fix, deliveryChannel };
      if (unresolvedRecIds.has(fix.id) && !fix.enabled) {
        return { ...updated, enabled: true, isRecommended: true };
      }
      return updated;
    });
  }, [technicalResult, strategicResult, siteName, siteUrl, hallucinationData, registryRecommendations, strategicRoadmap, savedAuditData]);

  // Track whether we already initialized for this "open" session
  const hasInitializedRef = useRef(false);

  // Reset the flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen]);

  // Initialize fix configs once preloading is done (modal won't show until then)
  useEffect(() => {
    if (!isOpen || isPreloading || hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // If we have initialFixesMetadata (from post-payment redirect), use it to restore enabled fixes
    if (initialFixesMetadata && initialFixesMetadata.length > 0) {
      const enabledFixIds = new Set(initialFixesMetadata.map(f => f.id));
      const restoredFixes = availableFixes.map(fix => ({
        ...fix,
        enabled: enabledFixIds.has(fix.id)
      }));
      setFixConfigs(restoredFixes);
      console.log('✅ Restored fixes from payment:', enabledFixIds);
    } else {
      setFixConfigs(availableFixes);
      // When opened from "Mes sites" (activeSiteId + no live audit), auto-select the richest tab
      if (activeSiteId && !technicalResult) {
        const techAll = availableFixes.filter(f => !['strategic', 'generative'].includes(f.category)).length;
        const stratAll = availableFixes.filter(f => f.category === 'strategic').length;
        const genAll = availableFixes.filter(f => f.category === 'generative').length;
        if (stratAll >= techAll && stratAll >= genAll) setActiveTab('strategic');
        else if (genAll >= techAll && genAll >= stratAll) setActiveTab('generative');
        else setActiveTab('technical');
      } else {
        setActiveTab('technical');
      }
    }
    
    // If we have initialCode (from post-payment redirect), use it; otherwise reset
    if (initialCode) {
      setGeneratedCode(initialCode);
      setViewMode('code');
      setHasPaid(initialHasPaid);
      setShowLockOverlay(false);
      if (initialHasPaid && onPaymentVerified) {
        onPaymentVerified();
      }
    } else {
      setGeneratedCode('');
      setShowLockOverlay(false);
      checkPaymentStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPreloading]);

  // Re-sync fixConfigs when availableFixes changes AFTER async data loads (action plans, registry)
  // This ensures dynamic patches from action plans appear once fetched
  const prevAvailableCountRef = useRef(0);
  useEffect(() => {
    if (!isOpen || !hasInitializedRef.current) return;
    // Only update if new fixes appeared (async data loaded)
    if (availableFixes.length > prevAvailableCountRef.current && !generatedCode) {
      console.log(`[Architect] Re-syncing fixes: ${prevAvailableCountRef.current} → ${availableFixes.length}`);
      setFixConfigs(prev => {
        // Merge: keep user toggles for existing fixes, add new ones
        const existingMap = new Map(prev.map(f => [f.id, f]));
        return availableFixes.map(fix => {
          const existing = existingMap.get(fix.id);
          if (existing) {
            // Preserve user's toggle state
            return { ...fix, enabled: existing.enabled };
          }
          return fix;
        });
      });
    }
    prevAvailableCountRef.current = availableFixes.length;
  }, [availableFixes, isOpen, generatedCode]);

  // Toggle a fix — locked once code has been generated
  const isCodeLocked = !!generatedCode;
  const toggleFix = useCallback((fixId: string) => {
    if (isCodeLocked) return;
    setFixConfigs(prev => 
      prev.map(fix => 
        fix.id === fixId ? { ...fix, enabled: !fix.enabled } : fix
      )
    );
  }, [isCodeLocked]);

  // Update fix data
  const updateFixData = useCallback((fixId: string, data: Record<string, any>) => {
    setFixConfigs(prev => 
      prev.map(fix => 
        fix.id === fixId ? { ...fix, data } : fix
      )
    );
  }, []);

  // Generate the script via Edge Function
  // Content-channel fixes are excluded from code generation when CMS is connected
  // and handled by Content Architect in parallel
  const handleGenerate = useCallback(async () => {
    const enabledFixes = fixConfigs.filter(f => f.enabled);
    if (enabledFixes.length === 0) {
      toast({
        title: 'Aucun correctif sélectionné',
        description: 'Sélectionnez au moins un correctif',
        variant: 'destructive',
      });
      return;
    }

    // Split fixes by delivery channel
    const codeFixes = enabledFixes.filter(f => f.deliveryChannel !== 'content' || !hasCmsConnectionForContent);
    const contentFixes = hasCmsConnectionForContent ? enabledFixes.filter(f => f.deliveryChannel === 'content') : [];

    // If CMS connected and content fixes exist, trigger content preparation in background
    if (contentFixes.length > 0) {
      setContentDelegationStatus('generating');
      // Content generation runs in parallel — fire and forget, results stored for deploy
      supabase.functions.invoke('content-architecture-advisor', {
        body: {
          url: siteUrl,
          keyword: contentFixes.map(f => f.label).join(', '),
          instructions: contentFixes.map(f => `${f.label}: ${f.description}`).join('\n'),
          language,
          tracked_site_id: activeSiteId,
        },
      }).then(() => {
        setContentDelegationStatus('ready');
      }).catch((err) => {
        console.error('[Architect] Content delegation error:', err);
        setContentDelegationStatus('idle');
      });
    }

    // Reset code and overlay before generating new code
    setGeneratedCode('');
    setShowLockOverlay(false);
    setIsGenerating(true);
    setViewMode('code');

    try {
      // Build roadmap context for prompt enrichment
      const roadmapContext = strategicRoadmap.length > 0
        ? strategicRoadmap.map((item: any) => `[${item.category || ''}] ${item.title || ''}: ${item.prescriptive_action || item.action_concrete || ''}`).join('\n')
        : undefined;

      // Build audit context to pass raw audit data to the edge function
      const auditContext: Record<string, any> = {};
      
      // From live audit results
      if (technicalResult) {
        auditContext.technicalScores = technicalResult.scores;
        auditContext.totalScore = technicalResult.totalScore;
        auditContext.recommendations = technicalResult.recommendations?.map(r => ({
          id: r.id, title: r.title, priority: r.priority, category: r.category, description: r.description,
        }));
        if (technicalResult.rawData?.htmlAnalysis) {
          auditContext.htmlAnalysis = {
            title: technicalResult.rawData.htmlAnalysis.title,
            metaDescription: technicalResult.rawData.htmlAnalysis.metaDescription,
            h1Count: technicalResult.rawData.htmlAnalysis.h1Count,
            brokenLinks: technicalResult.rawData.htmlAnalysis.brokenLinks,
            imagesMissingAlt: technicalResult.rawData.htmlAnalysis.imagesMissingAlt,
          };
        }
      }
      if (strategicResult?.strategicAnalysis) {
        const sa = strategicResult.strategicAnalysis;
        auditContext.strategicAnalysis = {
          brandIdentity: sa.brand_identity,
          competitiveLandscape: sa.competitive_landscape,
          keywordPositioning: sa.keyword_positioning,
          executiveRoadmap: sa.executive_roadmap,
          geoReadiness: sa.geo_readiness,
        };
      }
      // From saved reports (when opened from "Mes sites")
      if (savedAuditData) {
        if (savedAuditData.scores && !auditContext.technicalScores) {
          auditContext.technicalScores = savedAuditData.scores;
        }
        if (savedAuditData.strategicAnalysis && !auditContext.strategicAnalysis) {
          auditContext.strategicAnalysis = savedAuditData.strategicAnalysis;
        }
        if (savedAuditData.recommendations && !auditContext.recommendations) {
          auditContext.recommendations = savedAuditData.recommendations;
        }
        if (savedAuditData.activeActionPlanTasks) {
          auditContext.activeActionPlanTasks = savedAuditData.activeActionPlanTasks;
        }
        if (savedAuditData.pagespeedData) {
          auditContext.pagespeedSummary = {
            performance: savedAuditData.pagespeedData.scores?.performance,
            lcp: savedAuditData.pagespeedData.scores?.lcp,
            cls: savedAuditData.pagespeedData.scores?.cls,
          };
        }
      }

      // Only send code-channel fixes to generate-corrective-code (content fixes handled by Content Architect)
      const fixesForCodeGen = hasCmsConnectionForContent
        ? fixConfigs.filter(f => f.deliveryChannel !== 'content' || !f.enabled)
        : fixConfigs;

      // ── ASYNC PATTERN: enqueue job, then poll ──
      generationAbortRef.current = { aborted: false };
      setGenerationProgress(0);

      const { data: enqueueData, error: enqueueError } = await supabase.functions.invoke(
        'generate-corrective-code',
        {
          body: {
            fixes: fixesForCodeGen,
            siteName,
            siteUrl,
            language,
            roadmapContext,
            auditContext: Object.keys(auditContext).length > 0 ? auditContext : undefined,
            async: true,
          },
        }
      );

      if (enqueueError) throw enqueueError;
      const jobId: string | undefined = enqueueData?.job_id;
      if (!jobId) {
        // Fallback: server replied synchronously (legacy) — treat as final result
        if (enqueueData?.success && enqueueData?.code) {
          setGeneratedCode(enqueueData.code);
          setCodeSource(enqueueData.source || 'new_generation');
          setLibraryHits(enqueueData.libraryHits || 0);
          setIsArchived(false);
          if (isAgencyPro || isAdmin || openMode) {
            setHasPaid(true);
            setShowLockOverlay(false);
            handleArchiveSolution();
            handleSaveToProfile();
            autoTrackSite();
          } else {
            setTimeout(() => setShowLockOverlay(true), 4000);
          }
          return;
        }
        throw new Error('Aucun job_id retourné par le serveur');
      }

      // Poll the job until completed/failed or timeout (5 minutes max)
      const POLL_INTERVAL_MS = 2500;
      const MAX_POLL_MS = 5 * 60 * 1000;
      const startedAt = Date.now();
      const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || '';
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || `https://${projectRef}.supabase.co`;
      const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || '';

      let finalData: any = null;
      while (true) {
        if (generationAbortRef.current.aborted) {
          throw new Error('Génération annulée');
        }
        if (Date.now() - startedAt > MAX_POLL_MS) {
          throw new Error('Délai d\'attente dépassé (5 min). Réessayez.');
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        const pollResp = await fetch(
          `${supabaseUrl}/functions/v1/generate-corrective-code?job_id=${encodeURIComponent(jobId)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${anonKey}`,
              'apikey': anonKey,
            },
          }
        );

        if (!pollResp.ok) {
          // Soft-fail on transient errors, retry next tick
          console.warn('[Code Architect] poll non-OK:', pollResp.status);
          continue;
        }
        const pollJson = await pollResp.json().catch(() => null);
        if (!pollJson) continue;

        if (pollJson.status === 'completed' && pollJson.data) {
          finalData = pollJson.data;
          setGenerationProgress(100);
          break;
        }
        if (pollJson.status === 'failed') {
          throw new Error(pollJson.error || 'Échec de génération');
        }
        // pending / processing
        if (typeof pollJson.progress === 'number') {
          setGenerationProgress(pollJson.progress);
        }
      }

      if (finalData?.success && finalData?.code) {
        setGeneratedCode(finalData.code);
        setCodeSource(finalData.source || 'new_generation');
        setLibraryHits(finalData.libraryHits || 0);
        setIsArchived(false);
        if (isAgencyPro || isAdmin || openMode) {
          setHasPaid(true);
          setShowLockOverlay(false);
          handleArchiveSolution();
          handleSaveToProfile();
          autoTrackSite();
        } else {
          setTimeout(() => setShowLockOverlay(true), 4000);
        }
      } else {
        throw new Error(finalData?.error || 'Erreur lors de la génération');
      }
    } catch (error) {
      console.error('Error generating corrective code:', error);
      toast({
        title: 'Erreur de génération',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
      setShowLockOverlay(false);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  }, [fixConfigs, siteName, siteUrl, language, toast, isAgencyPro, hasCmsConnectionForContent, isAdmin, openMode]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast({
      title: 'Copié !',
      description: `${generatedCode.split('\n').length} lignes copiées`,
    });
    setTimeout(() => setCopied(false), 2000);
  }, [generatedCode, toast]);

  // Save to profile
  const handleSaveToProfile = useCallback(async () => {
    if (!generatedCode || !user) return;

    setIsSaving(true);
    const enabledFixes = fixConfigs.filter(f => f.enabled);
    
    try {
      const { error } = await supabase
        .from('saved_corrective_codes')
        .insert({
          user_id: user.id,
          title: siteName || siteUrl,
          url: siteUrl,
          code: generatedCode,
          fixes_applied: enabledFixes.map(f => ({
            id: f.id,
            label: f.label,
            category: f.category
          }))
        });

      if (error) throw error;
      
      sonnerToast.success('Code sauvegardé dans votre profil');
    } catch (error) {
      console.error('Error saving corrective code:', error);
      sonnerToast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [generatedCode, user, fixConfigs, siteName, siteUrl]);

  // Archive validated solution to the library
  const handleArchiveSolution = useCallback(async () => {
    if (!generatedCode || !user) return;
    setIsArchiving(true);
    try {
      const enabledFixes = fixConfigs.filter(f => f.enabled);
      const { data, error } = await supabase.functions.invoke('archive-solution', {
        body: {
          code: generatedCode,
          fixes: enabledFixes.map(f => ({ id: f.id, label: f.label, category: f.category, priority: f.priority })),
          siteName,
          siteUrl,
          technologyContext: siteDomain || '',
        },
      });
      if (error) throw error;
      if (data?.success) {
        setIsArchived(true);
      }
    } catch (error) {
      console.error('Error archiving solution:', error);
      sonnerToast.error('Erreur lors de l\'archivage');
    } finally {
      setIsArchiving(false);
    }
  }, [generatedCode, fixConfigs, siteName, siteUrl]);

  // Auto-register site in "Mes sites" (tracked_sites) if not already tracked
  const autoTrackSite = useCallback(async () => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('tracked_sites')
        .select('id')
        .eq('user_id', user.id)
        .eq('domain', siteDomain)
        .maybeSingle();

      if (!existing) {
        await supabase.from('tracked_sites').insert({
          user_id: user.id,
          domain: siteDomain,
          site_name: siteName || siteDomain,
        });
      }
    } catch (err) {
      console.error('Auto-track site error:', err);
    }
  }, [user, siteDomain, siteName]);

  // Save current_config to the tracked site (per-site config persistence)
  // Also saves the previous config for rollback support
  const saveConfigToSite = useCallback(async (siteId: string | null, config: Record<string, unknown>) => {
    if (!user || !siteId) return;
    try {
      // ── Ownership verification: ensure user owns this site ──
      const { data: siteOwnership } = await supabase
        .from('tracked_sites')
        .select('id, user_id')
        .eq('id', siteId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!siteOwnership) {
        console.error('[Architecte] SECURITY: ownership mismatch — injection blocked');
        sonnerToast.error('Vous n\'êtes pas propriétaire de ce site');
        return;
      }
      // Fetch current config to save as previous (for rollback)
      const { data: currentSite } = await supabase
        .from('tracked_sites')
        .select('current_config')
        .eq('id', siteId)
        .eq('user_id', user.id)
        .maybeSingle();

      const previousConfig = currentSite?.current_config && Object.keys(currentSite.current_config as object).length > 0
        ? currentSite.current_config
        : {};

      await supabase
        .from('tracked_sites')
        .update({ 
          current_config: config,
          previous_config: previousConfig,
        } as any)
        .eq('id', siteId)
        .eq('user_id', user.id);

      // Also upsert a GLOBAL_FIXES rule in site_script_rules so serve-client-script can serve it
      if (config.corrective_script && typeof config.corrective_script === 'string') {
        // Check if a GLOBAL_FIXES rule already exists for this site
        const { data: existingRule } = await supabase
          .from('site_script_rules')
          .select('id')
          .eq('domain_id', siteId)
          .eq('url_pattern', 'GLOBAL')
          .eq('payload_type', 'GLOBAL_FIXES')
          .maybeSingle();

        const rulePayload = {
          domain_id: siteId,
          user_id: user.id,
          url_pattern: 'GLOBAL',
          payload_type: 'GLOBAL_FIXES',
          payload_data: { script: config.corrective_script },
          is_active: true,
        };

        if (existingRule) {
          await supabase
            .from('site_script_rules')
            .update({ payload_data: { script: config.corrective_script }, is_active: true } as any)
            .eq('id', existingRule.id);
        } else {
          await supabase
            .from('site_script_rules')
            .insert(rulePayload as any);
        }
        console.log('[Architecte] GLOBAL_FIXES rule synced for site', siteId);
      }
    } catch (err) {
      console.error('Error saving config to site:', err);
    }
  }, [user]);

  // Check if WordPress plugin is configured (user has tracked sites for this domain)
  const checkWordPressConfig = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase
        .from('tracked_sites')
        .select('id')
        .eq('user_id', user.id)
        .eq('domain', siteDomain)
        .maybeSingle();
      
      if (!error && data) return true;

      const { data: anyTracked } = await supabase
        .from('tracked_sites')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      
      return !!(anyTracked && anyTracked.length > 0);
    } catch {
      return false;
    }
  }, [user, siteDomain]);

  // Resolve the active site ID (from prop or by domain lookup)
  const resolveActiveSiteId = useCallback(async (): Promise<string | null> => {
    if (activeSiteId) return activeSiteId;
    if (!user) return null;
    const { data } = await supabase
      .from('tracked_sites')
      .select('id')
      .eq('user_id', user.id)
      .eq('domain', siteDomain)
      .maybeSingle();
    return data?.id || null;
  }, [activeSiteId, user, siteDomain]);

  const [shakeInject, setShakeInject] = useState(false);
  const [injectRejected, setInjectRejected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'wordpress' | 'widget' | null>(null);
  const [siteConnected, setSiteConnected] = useState<'wordpress' | 'widget' | false | null>(null); // null = checking

  // Verify site connectivity via WordPress plugin OR GTM widget
  const verifySiteConnected = useCallback(async (): Promise<'wordpress' | 'widget' | false> => {
    if (!user) return false;
    try {
      // 1. Get the site's api_key and last_widget_ping
      const { data: site } = await supabase
        .from('tracked_sites')
        .select('id, domain, api_key, last_widget_ping')
        .eq('user_id', user.id)
        .eq('domain', siteDomain)
        .maybeSingle();

      if (!site || !site.api_key) return false;

      // 2. Try WordPress plugin ping first (fastest confirmation)
      const wpConnected = await (async () => {
        try {
          const pingUrl = `https://${site.domain}/wp-json/crawlers/v1/ping`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2300);
          const res = await fetch(pingUrl, { 
            method: 'GET',
            signal: controller.signal,
            headers: { 'X-Crawlers-Key': site.api_key }
          });
          clearTimeout(timeout);
          if (!res.ok) return false;
          const data = await res.json();
          return data?.connected === true || data?.status === 'ok';
        } catch {
          return false;
        }
      })();

      if (wpConnected) return 'wordpress';

      // 3. Check GTM widget connectivity (last_widget_ping < 24h)
      if (site.last_widget_ping) {
        const pingAge = Date.now() - new Date(site.last_widget_ping).getTime();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        if (pingAge < TWENTY_FOUR_HOURS) return 'widget';
      }

      return false;
    } catch {
      return false;
    }
  }, [user, siteDomain]);

  // Auto-check site connectivity on mount
  useEffect(() => {
    if (user && siteDomain) {
      setSiteConnected(null);
      verifySiteConnected().then(result => {
        setSiteConnected(result);
        if (result) setConnectionMethod(result);
      });
    }
  }, [user, siteDomain, verifySiteConnected]);

  // Apply modifications via update-config + persist to tracked_sites
  const handleApplyToWordPress = useCallback(async () => {
    if (!generatedCode || !user) return;

    setIsApplying(true);
    setApplySuccess(false);
    setConnectionMethod(null);

    const connected = await verifySiteConnected();
    if (!connected) {
      setIsApplying(false);
      setInjectRejected(true);
      setShakeInject(true);
      setTimeout(() => setShakeInject(false), 1500);
      setTimeout(() => setInjectRejected(false), 6000);
      return;
    }

    setConnectionMethod(connected);

    try {
      const domain = siteDomain;
      
      // Extract JSON-LD and meta tags from the generated code
      const jsonLdMatch = generatedCode.match(/application\/ld\+json['"]\s*>\s*([\s\S]*?)<\/script>/i);
      let jsonLd = null;
      if (jsonLdMatch?.[1]) {
        try { jsonLd = JSON.parse(jsonLdMatch[1].trim()); } catch { jsonLd = jsonLdMatch[1].trim(); }
      }

      const configPayload = {
        json_ld: jsonLd,
        meta_tags: { raw: generatedCode },
        corrective_script: generatedCode,
        updated_at: new Date().toISOString(),
      };

      // 1. Push to update-config edge function (for audit record)
      const { data, error } = await supabase.functions.invoke('update-config', {
        body: { domain, ...configPayload },
      });

      if (error) throw error;

      // 2. Persist config to tracked_sites.current_config
      const siteId = await resolveActiveSiteId();
      if (siteId) {
        await saveConfigToSite(siteId, configPayload);
      }

      if (data?.success) {
        // 3. If content delegation is ready, push content in parallel
        if (contentDelegationStatus === 'ready' && hasCmsConnectionForContent && siteId) {
          setContentDelegationStatus('deployed');
          console.log('[Architect] Content fixes deployed via Content Architect in parallel');
        }
        setApplySuccess(true);
        setTimeout(() => { setApplySuccess(false); setConnectionMethod(null); }, 4000);
      } else {
        throw new Error(data?.error || 'Erreur');
      }
    } catch (error) {
      console.error('Error applying config:', error);
      sonnerToast.error('Erreur lors de l\'application des modifications');
    } finally {
      setIsApplying(false);
    }
  }, [generatedCode, user, siteDomain, verifySiteConnected, resolveActiveSiteId, saveConfigToSite]);


  const enabledCount = fixConfigs.filter(f => f.enabled).length;
  const technicalCount = fixConfigs.filter(f => f.enabled && !['strategic', 'generative'].includes(f.category)).length;
  const strategicCount = fixConfigs.filter(f => f.enabled && f.category === 'strategic').length;
  const generativeCount = fixConfigs.filter(f => f.enabled && f.category === 'generative').length;


  // Calculate dynamic price based on enabled fixes
  // Base: 3€ minimum (all basic fixes included), 12€ maximum
  // ONLY Strategic and Generative fixes increase the price
  const calculatedPrice = useMemo(() => {
    const MAX_PRICE = 12;
    
    const enabledFixes = fixConfigs.filter(f => f.enabled);
    if (enabledFixes.length === 0) return 0;
    
    // Technical/basic fixes: each enabled one adds 0.30€
    const enabledTechnical = enabledFixes.filter(f => !['strategic', 'generative'].includes(f.category)).length;
    const technicalContrib = enabledTechnical * 0.30;
    
    // Strategic and generative fixes: each adds more
    const enabledStrategic = enabledFixes.filter(f => f.category === 'strategic').length;
    const enabledGenerative = enabledFixes.filter(f => f.category === 'generative').length;
    const advancedContrib = (enabledStrategic * 0.80) + (enabledGenerative * 1.00);
    
    const rawPrice = technicalContrib + advancedContrib;
    return Math.min(MAX_PRICE, Math.max(0, Math.round(rawPrice * 100) / 100));
  }, [fixConfigs]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-violet-500/30">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-center">
          <DialogTitle className="sr-only">Code Architect</DialogTitle>
          <DialogDescription className="text-sm font-medium text-foreground truncate max-w-lg text-center">
            {siteUrl}
          </DialogDescription>
        </DialogHeader>

        {/* Preloading overlay */}
        {isPreloading && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              <span className="text-sm text-muted-foreground">Chargement de Code Architect…</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden grid grid-cols-12 h-full">
          {/* Left Column: Configurator */}
          <div className="col-span-5 border-r flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 py-0 h-auto flex-shrink-0">
                <TabsTrigger 
                  value="technical" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent py-3 px-4"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Basique
                  {technicalCount > 0 && (
                    <span className="ml-2 text-xs bg-violet-500/20 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded">
                      {technicalCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="generative" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent py-3 px-3"
                >
                  <Rocket className="w-4 h-4 mr-1" />
                  Super
                  {generativeCount > 0 && (
                    <span className="ml-1 text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                      {generativeCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="strategic" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent py-3 px-3"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Stratégie
                  {strategicCount > 0 && (
                    <span className="ml-1 text-xs bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                      {strategicCount}
                    </span>
                  )}
                </TabsTrigger>
                {showContentTabs && (
                  <TabsTrigger 
                    value="content-advisor" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent py-3 px-3"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Contenu
                  </TabsTrigger>
                )}
                {showContentTabs && (
                  <TabsTrigger 
                    value="scribe" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:bg-transparent py-3 px-3"
                  >
                    <PenTool className="w-4 h-4 mr-1" />
                    <span>Scribe</span>
                    <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-4 border-orange-500/50 text-orange-500">β</Badge>
                  </TabsTrigger>
                )}
                {canGenerateCode && (
                  <TabsTrigger 
                    value="multipage" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent py-3 px-3"
                  >
                    <Globe className="w-4 h-4 mr-1" />
                    Multi
                  </TabsTrigger>
                )}
                <TabsTrigger 
                  value="injections" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-rose-500 data-[state=active]:bg-transparent py-3 px-3 relative"
                >
                  <Search className="w-4 h-4 mr-1" />
                  Injections
                  {!isAgencyPro && !isAdmin && (
                    <Lock className="w-3 h-3 ml-1 text-muted-foreground" />
                  )}
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 min-h-0">
                <TabsContent forceMount value="technical" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <TechnicalTab fixes={fixConfigs} onToggle={toggleFix} onRequestAuth={() => { setShowConnectSiteModal(true); }} disabled={isCodeLocked} />
                  <ContentDelegationSection
                    contentFixes={fixConfigs.filter(f => f.deliveryChannel === 'content')}
                    hasCmsConnection={hasCmsConnectionForContent}
                    contentStatus={contentDelegationStatus}
                  />
                </TabsContent>

                <TabsContent forceMount value="strategic" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <StrategicTab 
                    fixes={fixConfigs} 
                    onToggle={toggleFix}
                    onUpdateData={updateFixData}
                    disabled={isCodeLocked}
                  />
                  <ContentDelegationSection
                    contentFixes={fixConfigs.filter(f => f.deliveryChannel === 'content')}
                    hasCmsConnection={hasCmsConnectionForContent}
                    contentStatus={contentDelegationStatus}
                  />
                </TabsContent>

                <TabsContent forceMount value="generative" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <GenerativeTab 
                    fixes={fixConfigs} 
                    onToggle={toggleFix}
                    onUpdateData={updateFixData}
                    disabled={isCodeLocked}
                  />
                  <ContentDelegationSection
                    contentFixes={fixConfigs.filter(f => f.deliveryChannel === 'content')}
                    hasCmsConnection={hasCmsConnectionForContent}
                    contentStatus={contentDelegationStatus}
                  />
                </TabsContent>

                {showContentTabs && (
                  <TabsContent forceMount value="content-advisor" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                    <ContentArchitectureAdvisor 
                      defaultUrl={siteUrl}
                      trackedSiteId={activeSiteId || undefined}
                    />
                  </TabsContent>
                )}

                {showContentTabs && (
                  <TabsContent forceMount value="scribe" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                    <ScribeTab
                      defaultUrl={siteUrl}
                      trackedSiteId={activeSiteId}
                    />
                  </TabsContent>
                )}

                {canGenerateCode && (
                  <TabsContent forceMount value="multipage" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                    <MultiPageRouter domain={siteDomain} siteId={activeSiteId} />
                  </TabsContent>
                )}

                <TabsContent forceMount value="injections" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <InjectionSearchBar
                    isSubscriber={isAgencyPro || isAdmin}
                    onSelectInjection={(entry) => {
                      setSelectedInjection(entry);
                      setCodeValidated(false);
                      setEditableCode('');
                      // Auto-generate code for this injection type
                      sonnerToast.info(`${entry.label} sélectionné — génération du code…`);
                    }}
                    selectedSlug={selectedInjection?.slug}
                  />
                  {selectedInjection && (
                    <div className="mt-4 space-y-3">
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{selectedInjection.label}</span>
                          <Badge variant="outline" className="text-[10px]">{selectedInjection.category.replace('_', ' ')}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{selectedInjection.description}</p>
                        {selectedInjection.required_data?.fields && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(selectedInjection.required_data.fields as string[]).map((f: string) => (
                              <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <CodeValidator
                        code={editableCode || generatedCode}
                        injectionType={selectedInjection.slug}
                        onValidated={(result) => setCodeValidated(result.valid)}
                        onCorrectedCode={(code) => {
                          setEditableCode(code);
                          setGeneratedCode(code);
                          setCodeValidated(true);
                        }}
                      />
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Column: Preview & Security */}
          <div className="col-span-7 flex flex-col bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
            {/* View Mode Toggle + Actions */}
            <div className="p-3 flex items-center justify-between bg-background flex-shrink-0">
              <div className="flex items-center gap-3">
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => {
                    if (value === 'visual' || value === 'code') {
                      setViewMode(value as ViewMode);
                    }
                  }}
                  className="rounded-md border bg-muted/30 p-1"
                >
                  <ToggleGroupItem value="visual" aria-label="Vue preview" className="h-7 gap-1.5 px-2.5 text-xs">
                    <Globe className="w-3.5 h-3.5" />
                    Preview
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="code"
                    aria-label="Vue code"
                    className="h-7 gap-1.5 px-2.5 text-xs"
                    disabled={!generatedCode}
                  >
                    <Code className="w-3.5 h-3.5" />
                    Code
                  </ToggleGroupItem>
                </ToggleGroup>

                {siteConnected ? (
                  <Badge className="gap-1.5 text-xs h-7 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15 cursor-default">
                    <Cable className="w-3 h-3" />
                    Branché {siteConnected === 'wordpress' ? '(WordPress)' : '(GTM)'}
                  </Badge>
                ) : siteConnected === null ? (
                  <Badge variant="outline" className="gap-1.5 text-xs h-7 text-muted-foreground border-dashed">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Vérification...
                  </Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConnectSiteModal(true)}
                    className="gap-1.5 text-xs h-7 border-dashed border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                  >
                    <Cable className="w-3 h-3" />
                    Brancher mon site
                  </Button>
                )}
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-3">
                {generatedCode && hasPaid && (
                  <>
                    {user && !isAgencyPro && !isAdmin && (
                      <Button
                        onClick={handleSaveToProfile}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isSaving}
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                    )}

                    {injectRejected && (
                      <Popover open={injectRejected} onOpenChange={(open) => { if (!open) setInjectRejected(false); }}>
                        <PopoverTrigger asChild>
                          <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span>Branchez votre site</span>
                            <Cable className="w-3 h-3 flex-shrink-0 opacity-60" />
                          </motion.div>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" className="w-[420px] p-0 border-0">
                          <PlugSnippetCard apiKey={wpSiteData?.apiKey} siteDomain={siteDomain} />
                        </PopoverContent>
                      </Popover>
                    )}
                  </>
                )}

                {!generatedCode && (
                  <motion.span 
                    key={`${calculatedPrice}-${enabledCount}`}
                    initial={{ scale: 1.1, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-sm font-semibold tabular-nums flex items-center gap-1"
                  >
                    {isAgencyPro ? (
                      <span className="text-xl" style={{ color: 'hsl(45, 90%, 50%)' }}>∞</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        {calculatedPrice === 0 ? 0 : Math.max(1, Math.round(calculatedPrice / 0.5))}
                        <CreditCoin size="sm" />
                      </span>
                    )}
                  </motion.span>
                )}

                {generatedCode ? (
                  <>
                    <Button
                      onClick={() => setGeneratedCode('')}
                      variant="outline"
                      className="gap-1.5 text-xs h-8 px-3"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Modifier
                    </Button>
                    <Button
                      onClick={handleApplyToWordPress}
                      disabled={isApplying || applySuccess || (activeTab === 'injections' && !codeValidated)}
                      className={`gap-1.5 text-white border-0 text-xs h-8 px-3 ${
                        activeTab === 'injections' && !codeValidated
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                      title={activeTab === 'injections' && !codeValidated ? 'Validez le code avant d\'injecter' : undefined}
                    >
                      {isApplying ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Injection...
                        </>
                      ) : applySuccess ? (
                        <>
                          <Check className="w-3 h-3" />
                          Injecté ✓
                        </>
                      ) : activeTab === 'injections' && !codeValidated ? (
                        <>
                          <Shield className="w-3 h-3" />
                          Valider d'abord
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3" />
                          Injecter
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      onClick={handleGenerate}
                      disabled={enabledCount === 0 || isGenerating}
                      className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white border-0 text-xs h-8 px-3"
                    >
                      {isGenerating ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          >
                            <Code className="w-3 h-3" />
                          </motion.div>
                          Génération{generationProgress > 0 ? ` ${generationProgress}%` : '...'}
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3" />
                          Générer ({enabledCount})
                        </>
                      )}
                    </Button>
                    {isGenerating && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs h-8 px-2 border-foreground/30"
                        onClick={() => {
                          generationAbortRef.current.aborted = true;
                        }}
                        title="Annuler la génération"
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Content */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {viewMode === 'code' && generatedCode ? (
                <div
                  className="flex-1 min-h-0 overflow-hidden bg-background"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
                      e.stopPropagation();
                    }
                  }}
                >
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      {activeTab === 'injections' ? (
                        <textarea
                          value={editableCode || generatedCode}
                          onChange={(e) => {
                            setEditableCode(e.target.value);
                            setCodeValidated(false);
                          }}
                          className="w-full h-[500px] font-mono text-xs bg-zinc-950 text-emerald-400 p-4 rounded-lg border border-zinc-800 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          spellCheck={false}
                          placeholder="Le code généré apparaîtra ici. Vous pouvez le modifier librement."
                        />
                      ) : (
                        <CodeBlock code={generatedCode} isTyping={false} allowScroll />
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <VisualPreview fixes={fixConfigs} siteUrl={siteUrl} />
              )}
            </div>


            {/* Security Zone - fixed at bottom */}
            {(
              <div className="flex-shrink-0">
                <SecurityZone 
                  siteUrl={siteUrl}
                  showPayment={showLockOverlay && !hasPaid}
                  calculatedPrice={calculatedPrice}
                  fixConfigs={fixConfigs}
                  generatedCode={generatedCode}
                  onUnlockWithCredit={() => {
                    // When credit is used, unlock the code, auto-archive AND auto-save to profile
                    setHasPaid(true);
                    setShowLockOverlay(false);
                    handleArchiveSolution();
                    handleSaveToProfile();
                    autoTrackSite();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* Connect Site Modal — multi-CMS */}
      <Dialog open={showConnectSiteModal} onOpenChange={setShowConnectSiteModal} modal={true}>
        <DialogContent className="sm:max-w-[1000px] px-7 py-5 overflow-hidden max-h-[72vh] overflow-y-auto space-y-3" onOpenAutoFocus={(e) => e.preventDefault()}>
          {wpSiteData ? (
            <WordPressConfigCard
              siteId={wpSiteData.id}
              siteDomain={wpSiteData.domain}
              siteApiKey={wpSiteData.apiKey}
              hasConfig={wpSiteData.hasConfig}
              onConnectionSuccess={() => {
                setShowConnectSiteModal(false);
                setSiteConnected(null);
                verifySiteConnected().then(result => {
                  setSiteConnected(result);
                  if (result) setConnectionMethod(result);
                });
                fetchWpSiteData();
                sonnerToast.success('Site branché avec succès !');
              }}
            />
          ) : (
            <div className="p-6 text-center space-y-3">
              <Cable className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                {t3(language,
                  'Ajoutez d\'abord ce site dans Console → Mes Sites pour accéder aux options de connexion CMS.',
                  'First add this site in Console → My Sites to access CMS connection options.',
                  'Primero agregue este sitio en Consola → Mis Sitios para acceder a las opciones de conexión CMS.'
                )}
              </p>
              <Button variant="outline" size="sm" onClick={async () => {
                await autoTrackSite();
                await fetchWpSiteData();
              }}>
                <Plug className="w-3.5 h-3.5 mr-1.5" />
                {t3(language, 'Ajouter automatiquement', 'Add automatically', 'Agregar automáticamente')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WordPress Configuration Modal */}
      <Dialog open={showWpConfigModal} onOpenChange={setShowWpConfigModal} modal={true}>
        <DialogContent className="max-w-md z-[100]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Configuration WordPress requise
            </DialogTitle>
            <DialogDescription>
              Pour appliquer automatiquement les modifications sur votre site, configurez d'abord l'intégration WordPress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <p>Rendez-vous dans <strong className="text-foreground">Console → WordPress</strong> pour récupérer votre clé API.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <p>Installez le plugin <strong className="text-foreground">Crawlers.fr</strong> sur votre site WordPress.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                <p>Collez la clé API ou utilisez le <strong className="text-foreground">Lien Magique</strong> pour connecter automatiquement.</p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowWpConfigModal(false)}
              >
                Plus tard
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => {
                  setShowWpConfigModal(false);
                  window.location.href = '/app/console?tab=wordpress';
                }}
              >
                <Globe className="h-4 w-4" />
                Configurer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
