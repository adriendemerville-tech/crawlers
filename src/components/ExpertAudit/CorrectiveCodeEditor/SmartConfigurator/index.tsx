import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { CreditCoin } from '@/components/ui/CreditCoin';
import { 
  Copy, Check, Code, Zap, Wrench, Sparkles, Globe, Save, Rocket, Library, Upload, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ExpertAuditResult } from '@/types/expertAudit';
import { CodeBlock } from '../CodeBlock';
import { TechnicalTab } from './TechnicalTab';
import { StrategicTab } from './StrategicTab';
import { GenerativeTab } from './GenerativeTab';
import { VisualPreview } from './VisualPreview';
import { SecurityZone } from './SecurityZone';
import { FixConfig, STRATEGIC_FIXES, GENERATIVE_FIXES, ViewMode } from './types';
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
}: SmartConfiguratorProps) {
  const [fixConfigs, setFixConfigs] = useState<FixConfig[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(initialCode ? 'code' : 'visual');
  const [isGenerating, setIsGenerating] = useState(false);
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
  
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

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

  // Generate fix configurations from audit results
  const availableFixes = useMemo(() => {
    const fixes: FixConfig[] = [];

    if (technicalResult) {
      // SEO Fixes
      if (!technicalResult.scores.semantic.hasTitle || technicalResult.scores.semantic.titleLength > 70) {
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

      if (!technicalResult.scores.semantic.hasMetaDesc) {
        fixes.push({
          id: 'fix_meta_desc',
          category: 'seo',
          label: 'Ajouter Meta Description',
          description: 'Injecte une meta description optimisée',
          enabled: true,
          priority: 'critical',
        });
      }

      if (!technicalResult.scores.semantic.hasUniqueH1 || technicalResult.scores.semantic.h1Count === 0) {
        fixes.push({
          id: 'fix_h1',
          category: 'seo',
          label: 'Corriger la balise H1',
          description: 'Assure un H1 unique et optimisé',
          enabled: false,
          priority: 'critical',
        });
      }

      if (!technicalResult.scores.aiReady.hasSchemaOrg) {
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

      if (technicalResult.scores.performance.lcp > 2500) {
        fixes.push({
          id: 'fix_lazy_images',
          category: 'performance',
          label: 'Lazy Loading des images',
          description: 'Ajoute le lazy loading aux images hors viewport',
          enabled: true,
          priority: 'important',
        });
      }

      if (!technicalResult.scores.security.isHttps) {
        fixes.push({
          id: 'fix_https_redirect',
          category: 'seo',
          label: 'Redirection HTTPS',
          description: 'Force la redirection vers HTTPS',
          enabled: true,
          priority: 'critical',
        });
      }
    }

    // Accessibility fixes
    fixes.push({
      id: 'fix_contrast',
      category: 'accessibility',
      label: 'Améliorer le contraste',
      description: 'Ajuste les couleurs des éléments à faible contraste',
      enabled: true,
      priority: 'optional',
    });

    fixes.push({
      id: 'fix_alt_images',
      category: 'accessibility',
      label: 'Alt text pour images',
      description: 'Ajoute des attributs alt manquants',
      enabled: true,
      priority: 'important',
    });

    // Tracking fixes - disabled by default (not part of base 6)
    fixes.push({
      id: 'fix_gtm',
      category: 'tracking',
      label: 'Intégrer Google Tag Manager',
      description: 'Injecte le snippet GTM',
      enabled: false,
      priority: 'optional',
      data: { gtmId: 'GTM-XXXXXXX' }
    });

    fixes.push({
      id: 'fix_ga4',
      category: 'tracking',
      label: 'Ajouter Google Analytics 4',
      description: 'Injecte le pixel GA4',
      enabled: false,
      priority: 'optional',
      data: { measurementId: 'G-XXXXXXXXXX' }
    });

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

    // Strategic fixes (from STRATEGIC_FIXES) - disabled by default
    Object.values(STRATEGIC_FIXES).forEach(strategicFix => {
      fixes.push({
        ...strategicFix,
        enabled: false, // Strategic fixes are disabled by default
        data: {},
      });
    });

    // Generative Super-Capacities (from GENERATIVE_FIXES) - disabled by default
    Object.values(GENERATIVE_FIXES).forEach(generativeFix => {
      fixes.push({
        ...generativeFix,
        enabled: false, // Generative fixes are disabled by default
        data: {},
      });
    });

    return fixes;
  }, [technicalResult, strategicResult, siteName, siteUrl, hallucinationData]);

  // Track whether we already initialized for this "open" session
  const hasInitializedRef = useRef(false);

  // Reset the flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen]);

  // Initialize fix configs when modal opens and check payment status
  // Only run the full init ONCE per open session to avoid wiping generatedCode
  useEffect(() => {
    if (!isOpen || hasInitializedRef.current) return;
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
  }, [isOpen]);

  // Toggle a fix
  const toggleFix = useCallback((fixId: string) => {
    setFixConfigs(prev => 
      prev.map(fix => 
        fix.id === fixId ? { ...fix, enabled: !fix.enabled } : fix
      )
    );
  }, []);

  // Update fix data
  const updateFixData = useCallback((fixId: string, data: Record<string, any>) => {
    setFixConfigs(prev => 
      prev.map(fix => 
        fix.id === fixId ? { ...fix, data } : fix
      )
    );
  }, []);

  // Generate the script via Edge Function
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

    // Reset code and overlay before generating new code
    setGeneratedCode('');
    setShowLockOverlay(false);
    setIsGenerating(true);
    setViewMode('code');

    try {
      const { data, error } = await supabase.functions.invoke('generate-corrective-code', {
        body: {
          fixes: fixConfigs,
          siteName,
          siteUrl,
          language,
        },
      });

      if (error) throw error;

      if (data?.success && data?.code) {
        setGeneratedCode(data.code);
        setCodeSource(data.source || 'new_generation');
        setLibraryHits(data.libraryHits || 0);
        setIsArchived(false);
        // Delay showing the lock overlay for minimum 4 seconds after generation starts
        setTimeout(() => {
          setShowLockOverlay(true);
        }, 4000);
      } else {
        throw new Error(data?.error || 'Erreur lors de la génération');
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
    }
  }, [fixConfigs, siteName, siteUrl, language, toast]);

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
    if (!generatedCode) return;
    setIsArchiving(true);
    try {
      const enabledFixes = fixConfigs.filter(f => f.enabled);
      const { data, error } = await supabase.functions.invoke('archive-solution', {
        body: {
          code: generatedCode,
          fixes: enabledFixes.map(f => ({ id: f.id, label: f.label, category: f.category, priority: f.priority })),
          siteName,
          siteUrl,
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

  // Check if WordPress plugin is configured (user has tracked sites for this domain)
  const checkWordPressConfig = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      // Check if user has the API key and any tracked site for this domain
      const { data, error } = await supabase
        .from('tracked_sites')
        .select('id')
        .eq('user_id', user.id)
        .eq('domain', siteDomain)
        .maybeSingle();
      
      // If tracked site exists, consider WP configured
      if (!error && data) return true;

      // Also check if they have any tracked site at all (flexible check)
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

  // Apply modifications to WordPress via update-config
  const handleApplyToWordPress = useCallback(async () => {
    if (!generatedCode || !user) return;

    // Check if WordPress is configured first
    const isConfigured = await checkWordPressConfig();
    if (!isConfigured) {
      setShowWpConfigModal(true);
      return;
    }

    setIsApplying(true);
    setApplySuccess(false);
    try {
      const domain = siteDomain;
      
      // Extract JSON-LD and meta tags from the generated code
      const jsonLdMatch = generatedCode.match(/application\/ld\+json['"]\s*>\s*([\s\S]*?)<\/script>/i);
      let jsonLd = null;
      if (jsonLdMatch?.[1]) {
        try { jsonLd = JSON.parse(jsonLdMatch[1].trim()); } catch { jsonLd = jsonLdMatch[1].trim(); }
      }

      const { data, error } = await supabase.functions.invoke('update-config', {
        body: {
          domain,
          json_ld: jsonLd,
          meta_tags: { raw: generatedCode },
          corrective_script: generatedCode,
        },
      });

      if (error) throw error;
      if (data?.success) {
        setApplySuccess(true);
        sonnerToast.success('✅ Configuration mise à jour ! Le site WordPress sera synchronisé automatiquement via le plugin.');
        setTimeout(() => setApplySuccess(false), 5000);
      } else {
        throw new Error(data?.error || 'Erreur');
      }
    } catch (error) {
      console.error('Error applying config:', error);
      sonnerToast.error('Erreur lors de l\'application des modifications');
    } finally {
      setIsApplying(false);
    }
  }, [generatedCode, user, siteDomain, checkWordPressConfig]);

  const enabledCount = fixConfigs.filter(f => f.enabled).length;
  const technicalCount = fixConfigs.filter(f => f.enabled && !['strategic', 'generative'].includes(f.category)).length;
  const strategicCount = fixConfigs.filter(f => f.enabled && f.category === 'strategic').length;
  const generativeCount = fixConfigs.filter(f => f.enabled && f.category === 'generative').length;

  // Calculate dynamic price based on enabled fixes
  // Base: 3€ minimum (all basic fixes included), 12€ maximum
  // ONLY Strategic and Generative fixes increase the price
  const calculatedPrice = useMemo(() => {
    const MIN_PRICE = 3;
    const MAX_PRICE = 12;
    const PRICE_RANGE = MAX_PRICE - MIN_PRICE; // 9€ range
    
    // Only count strategic and generative fixes for pricing
    const strategicFixes = fixConfigs.filter(f => f.category === 'strategic');
    const generativeFixes = fixConfigs.filter(f => f.category === 'generative');
    
    const enabledStrategic = strategicFixes.filter(f => f.enabled).length;
    const enabledGenerative = generativeFixes.filter(f => f.enabled).length;
    
    const totalAdvanced = strategicFixes.length + generativeFixes.length;
    if (totalAdvanced === 0) return MIN_PRICE;
    
    // Calculate percentage of advanced fixes enabled
    const advancedPercent = (enabledStrategic + enabledGenerative) / totalAdvanced;
    
    // Price = 3€ base + up to 9€ for advanced features
    const rawPrice = MIN_PRICE + (PRICE_RANGE * advancedPercent);
    
    // Dynamic increment based on total advanced fixes
    const dynamicIncrement = PRICE_RANGE / totalAdvanced;
    const increment = Math.max(0.10, dynamicIncrement);
    
    return Math.round(rawPrice / increment) * increment;
  }, [fixConfigs]);

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-violet-500/30">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-center relative">
          {/* Title - left aligned */}
          <DialogTitle className="absolute left-4 flex items-center gap-2">
            <span className="text-sm font-medium bg-gradient-to-r from-violet-600 via-violet-400 to-amber-400 bg-clip-text text-transparent">
              Architecte
            </span>
          </DialogTitle>
          
          {/* Centered URL */}
          <DialogDescription className="text-sm text-muted-foreground font-normal truncate max-w-md">
            {siteUrl}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-12 h-full">
          {/* Left Column: Configurator */}
          <div className="col-span-5 border-r flex flex-col overflow-hidden">
            <Tabs defaultValue="technical" className="flex-1 flex flex-col min-h-0">
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
              </TabsList>

              <ScrollArea className="flex-1 min-h-0">
                <TabsContent forceMount value="technical" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <TechnicalTab fixes={fixConfigs} onToggle={toggleFix} />
                </TabsContent>

                <TabsContent forceMount value="strategic" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <StrategicTab 
                    fixes={fixConfigs} 
                    onToggle={toggleFix}
                    onUpdateData={updateFixData}
                  />
                </TabsContent>

                <TabsContent forceMount value="generative" className="m-0 p-4 pb-6 data-[state=inactive]:hidden">
                  <GenerativeTab 
                    fixes={fixConfigs} 
                    onToggle={toggleFix}
                    onUpdateData={updateFixData}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Column: Preview & Security */}
          <div className="col-span-7 flex flex-col bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
            {/* View Mode Toggle + Generate Button */}
            <div className="p-3 flex items-center justify-between bg-background flex-shrink-0">
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                className="bg-muted p-0.5 rounded-md"
              >
                <ToggleGroupItem value="visual" className="gap-1.5 text-xs px-2.5 py-1 h-7 data-[state=on]:bg-background">
                  <Globe className="w-3 h-3" />
                  Preview
                </ToggleGroupItem>
                <ToggleGroupItem value="code" className="gap-1.5 text-xs px-2.5 py-1 h-7 data-[state=on]:bg-background">
                  <Code className="w-3 h-3" />
                  Code Source
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Right side actions */}
              <div className="flex items-center gap-3">
                {/* Source badge removed */}

                {/* Copy + Save buttons - visible after unlock */}
                {generatedCode && viewMode === 'code' && hasPaid && (
                  <>
                    {user && (
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
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      title={copied ? 'Copié !' : 'Copier le code'}
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    {/* Apply to WordPress button */}
                    <Button
                      onClick={handleApplyToWordPress}
                      disabled={isApplying || applySuccess}
                      size="sm"
                      className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white border-0 text-xs h-8"
                    >
                      {isApplying ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Application...
                        </>
                      ) : applySuccess ? (
                        <>
                          <Check className="w-3 h-3" />
                          Appliqué !
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3" />
                          Appliquer les modifications
                        </>
                      )}
                    </Button>
                  </>
                )}

                {/* Dynamic Price in Credits */}
                <motion.span 
                  key={calculatedPrice}
                  initial={{ scale: 1.1, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums flex items-center gap-1"
                >
                  {(calculatedPrice * 2).toFixed(0)}
                  <CreditCoin size="sm" />
                </motion.span>

                {/* Generate Button */}
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
                      Génération...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      Générer ({enabledCount})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Preview/Code Content - fills available space with margins */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {viewMode === 'visual' ? (
                <VisualPreview fixes={fixConfigs} siteUrl={siteUrl} />
              ) : (
                <div className="flex-1 min-h-0 flex flex-col pr-4">
                  <CodeBlock 
                    code={generatedCode} 
                    isTyping={false}
                    placeholder='Cliquez sur "Générer le script" pour voir le code'
                    placeholderHighlight="Générer le script"
                    isLocked={!hasPaid && showLockOverlay}
                    allowScroll={hasPaid}
                  />
                </div>
              )}
            </div>

            {/* Security Zone - fixed at bottom, only visible in code view */}
            {viewMode === 'code' && (
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
                    toast({
                      title: 'Script débloqué !',
                      description: 'Code sauvegardé dans "Mes Codes" et prêt à copier.',
                    });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* WordPress Configuration Modal */}
      <Dialog open={showWpConfigModal} onOpenChange={setShowWpConfigModal}>
        <DialogContent className="max-w-md">
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
                <p>Installez le plugin <strong className="text-foreground">Crawlers.AI</strong> sur votre site WordPress.</p>
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
                  window.location.href = '/console?tab=wordpress';
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
