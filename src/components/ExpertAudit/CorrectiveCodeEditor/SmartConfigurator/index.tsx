import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, Check, Code, Zap, FileCode, Wrench, Sparkles, Eye, Save, Rocket
} from 'lucide-react';
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

interface SmartConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  technicalResult: ExpertAuditResult | null;
  strategicResult: ExpertAuditResult | null;
  siteUrl: string;
  siteName: string;
  hallucinationData?: HallucinationData | null;
}

export function SmartConfigurator({
  isOpen,
  onClose,
  technicalResult,
  strategicResult,
  siteUrl,
  siteName,
  hallucinationData,
}: SmartConfiguratorProps) {
  const [fixConfigs, setFixConfigs] = useState<FixConfig[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();

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
          enabled: true,
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

    // Tracking fixes
    fixes.push({
      id: 'fix_gtm',
      category: 'tracking',
      label: 'Intégrer Google Tag Manager',
      description: 'Injecte le snippet GTM',
      enabled: true,
      priority: 'optional',
      data: { gtmId: 'GTM-XXXXXXX' }
    });

    fixes.push({
      id: 'fix_ga4',
      category: 'tracking',
      label: 'Ajouter Google Analytics 4',
      description: 'Injecte le pixel GA4',
      enabled: true,
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

    // Strategic fixes (from STRATEGIC_FIXES)
    Object.values(STRATEGIC_FIXES).forEach(strategicFix => {
      fixes.push({
        ...strategicFix,
        enabled: strategicFix.isRecommended || false,
        data: {},
      });
    });

    // Generative Super-Capacities (from GENERATIVE_FIXES) - Premium features
    Object.values(GENERATIVE_FIXES).forEach(generativeFix => {
      fixes.push({
        ...generativeFix,
        enabled: generativeFix.isRecommended || false,
        data: {},
      });
    });

    return fixes;
  }, [technicalResult, strategicResult, siteName, siteUrl, hallucinationData]);

  // Initialize fix configs when modal opens
  useEffect(() => {
    if (isOpen) {
      setFixConfigs(availableFixes);
      setGeneratedCode('');
    }
  }, [isOpen, availableFixes]);

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

  const enabledCount = fixConfigs.filter(f => f.enabled).length;
  const technicalCount = fixConfigs.filter(f => f.enabled && !['strategic', 'generative'].includes(f.category)).length;
  const strategicCount = fixConfigs.filter(f => f.enabled && f.category === 'strategic').length;
  const generativeCount = fixConfigs.filter(f => f.enabled && f.category === 'generative').length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-violet-500/30">
        <DialogHeader className="p-4 pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-violet-500" />
              <span className="font-mono bg-gradient-to-r from-violet-500 via-amber-400 to-violet-600 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                Architecte Génératif
              </span>
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            </DialogTitle>
            <DialogDescription>
              Configurez et prévisualisez les injections de code avant génération
            </DialogDescription>
          </div>
          
          {/* Generate Button in Header */}
          <Button
            onClick={handleGenerate}
            disabled={enabledCount === 0 || isGenerating}
            variant="outline"
            className="gap-2 border-violet-500 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
            size="sm"
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
                  Technique
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
                <TabsContent value="technical" className="m-0 p-4">
                  <TechnicalTab fixes={fixConfigs} onToggle={toggleFix} />
                </TabsContent>

                <TabsContent value="strategic" className="m-0 p-4">
                  <StrategicTab 
                    fixes={fixConfigs} 
                    onToggle={toggleFix}
                    onUpdateData={updateFixData}
                  />
                </TabsContent>

                <TabsContent value="generative" className="m-0 p-4">
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
          <div className="col-span-7 flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {/* View Mode Toggle */}
            <div className="p-3 border-b flex items-center justify-between bg-background">
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                className="bg-muted p-1 rounded-lg"
              >
                <ToggleGroupItem value="visual" className="gap-2 text-sm data-[state=on]:bg-background">
                  <Eye className="w-4 h-4" />
                  Simulation Visuelle
                </ToggleGroupItem>
                <ToggleGroupItem value="code" className="gap-2 text-sm data-[state=on]:bg-background">
                  <Code className="w-4 h-4" />
                  Code Source
                </ToggleGroupItem>
              </ToggleGroup>

              {generatedCode && viewMode === 'code' && (
                <div className="flex items-center gap-2">
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
                    size="sm"
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copier
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Preview/Code Content */}
            <ScrollArea className="flex-1">
              {viewMode === 'visual' ? (
                <VisualPreview fixes={fixConfigs} siteUrl={siteUrl} />
              ) : (
                <div className="p-2">
                  <CodeBlock 
                    code={generatedCode} 
                    isTyping={false}
                    placeholder="Cliquez sur 'Générer le script' pour voir le code"
                  />
                </div>
              )}
            </ScrollArea>

            {/* Security Zone with Payment */}
            <SecurityZone 
              siteUrl={siteUrl}
              fixesCount={enabledCount}
              showPayment={!!generatedCode}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
