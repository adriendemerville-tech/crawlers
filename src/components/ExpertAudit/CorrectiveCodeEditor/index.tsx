import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Copy, Check, Code, ChevronDown, ChevronRight,
  Zap, Palette, Eye, Shield, FileCode, 
  Lightbulb, BookOpen, ExternalLink, AlertTriangle,
  ShoppingBag, Tag, Save
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Recommendation, ExpertAuditResult } from '@/types/expertAudit';
import { CodeBlock } from './CodeBlock';
import { FixConfigPanel } from './FixConfigPanel';
import { ImplementationGuide } from './ImplementationGuide';
import { FixConfig } from './scriptGenerator';
import { toast as sonnerToast } from 'sonner';

const translations = {
  fr: {
    title: 'Éditeur de Code Correctif',
    subtitle: 'Script JavaScript personnalisé pour corriger les problèmes détectés',
    configTitle: 'Configuration des correctifs',
    configDesc: 'Sélectionnez les correctifs à inclure dans votre script',
    generating: 'Génération du script...',
    copyButton: 'Copier le script',
    copied: 'Copié !',
    previewTitle: 'Aperçu du code généré',
    implementTitle: 'Guide d\'implémentation',
    securityNote: 'Note de sécurité',
    securityDesc: 'Ce script s\'exécute côté client et ne modifie pas votre serveur. Testez toujours en environnement de staging avant la production.',
    savedToProfile: 'Code sauvegardé dans votre profil',
    saveError: 'Erreur lors de la sauvegarde',
    linesGenerated: 'lignes générées',
    noFixesSelected: 'Sélectionnez au moins un correctif pour générer le script',
    categories: {
      seo: 'SEO & Contenu',
      performance: 'Performance',
      accessibility: 'Accessibilité',
      tracking: 'Tracking & Analytics',
      hallucination: 'Correction IA',
    },
  },
  en: {
    title: 'Corrective Code Editor',
    subtitle: 'Custom JavaScript script to fix detected issues',
    configTitle: 'Fix configuration',
    configDesc: 'Select the fixes to include in your script',
    generating: 'Generating script...',
    copyButton: 'Copy script',
    copied: 'Copied!',
    previewTitle: 'Generated code preview',
    implementTitle: 'Implementation guide',
    securityNote: 'Security note',
    securityDesc: 'This script runs client-side and does not modify your server. Always test in a staging environment before production.',
    savedToProfile: 'Code saved to your profile',
    saveError: 'Error saving code',
    linesGenerated: 'lines generated',
    noFixesSelected: 'Select at least one fix to generate the script',
    categories: {
      seo: 'SEO & Content',
      performance: 'Performance',
      accessibility: 'Accessibility',
      tracking: 'Tracking & Analytics',
      hallucination: 'AI Correction',
    },
  },
  es: {
    title: 'Editor de Código Correctivo',
    subtitle: 'Script JavaScript personalizado para corregir los problemas detectados',
    configTitle: 'Configuración de correcciones',
    configDesc: 'Seleccione las correcciones a incluir en su script',
    generating: 'Generando script...',
    copyButton: 'Copiar script',
    copied: '¡Copiado!',
    previewTitle: 'Vista previa del código generado',
    implementTitle: 'Guía de implementación',
    securityNote: 'Nota de seguridad',
    securityDesc: 'Este script se ejecuta del lado del cliente y no modifica su servidor. Siempre pruebe en un entorno de staging antes de producción.',
    savedToProfile: 'Código guardado en su perfil',
    saveError: 'Error al guardar el código',
    linesGenerated: 'líneas generadas',
    noFixesSelected: 'Seleccione al menos una corrección para generar el script',
    categories: {
      seo: 'SEO y Contenido',
      performance: 'Rendimiento',
      accessibility: 'Accesibilidad',
      tracking: 'Seguimiento y Analytics',
      hallucination: 'Corrección IA',
    },
  },
};

// Hallucination data can be in legacy or new format
interface HallucinationData {
  // Legacy format
  trueValue?: string;
  correctedIntro?: string;
  // New diagnosis format
  discrepancies?: Array<{ field: string; original: string; corrected: string; impact: string; explanation: string }>;
  recommendations?: Array<{ id: string; category: string; priority: string; title: string; description: string; codeSnippet?: string }>;
  analysisNarrative?: string;
  originalValues?: Record<string, string>;
  correctedValues?: Record<string, string>;
  // Common
  confusionSources?: string[];
}

// Helper to check if hallucination data has actionable content
function hasHallucinationFixes(data: HallucinationData | null | undefined): boolean {
  if (!data) return false;
  // Legacy format check
  if (data.trueValue) return true;
  // New format check
  if (data.discrepancies && data.discrepancies.length > 0) return true;
  if (data.recommendations && data.recommendations.length > 0) return true;
  return false;
}

// Helper to extract a "true value" statement from new format
function extractTrueValueFromDiagnosis(data: HallucinationData): string {
  if (data.trueValue) return data.trueValue;
  if (data.correctedValues?.valueProposition) return data.correctedValues.valueProposition;
  if (data.analysisNarrative) return data.analysisNarrative;
  return '';
}

interface CorrectiveCodeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  technicalResult: ExpertAuditResult | null;
  strategicResult: ExpertAuditResult | null;
  siteUrl: string;
  siteName: string;
  hallucinationData?: HallucinationData | null;
}

export function CorrectiveCodeEditor({
  isOpen,
  onClose,
  technicalResult,
  strategicResult,
  siteUrl,
  siteName,
  hallucinationData,
}: CorrectiveCodeEditorProps) {
  const [fixConfigs, setFixConfigs] = useState<FixConfig[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [displayedCode, setDisplayedCode] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const { language } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const t = translations[language] || translations.fr;

  // Generate fix configurations from audit results
  const availableFixes = useMemo(() => {
    const fixes: FixConfig[] = [];

    if (technicalResult) {
      // SEO Fixes
      if (!technicalResult.scores.semantic.hasTitle || technicalResult.scores.semantic.titleLength > 70) {
        fixes.push({
          id: 'fix_title',
          category: 'seo',
          label: language === 'fr' ? 'Optimiser la balise Title' : language === 'es' ? 'Optimizar etiqueta Title' : 'Optimize Title tag',
          description: language === 'fr' ? 'Ajoute ou corrige la balise <title> pour le SEO' : 'Add or fix the <title> tag for SEO',
          enabled: true,
          priority: 'critical',
          data: { currentTitle: technicalResult.rawData?.htmlAnalysis?.title || '' }
        });
      }

      if (!technicalResult.scores.semantic.hasMetaDesc) {
        fixes.push({
          id: 'fix_meta_desc',
          category: 'seo',
          label: language === 'fr' ? 'Ajouter Meta Description' : language === 'es' ? 'Añadir Meta Description' : 'Add Meta Description',
          description: language === 'fr' ? 'Injecte une meta description optimisée' : 'Inject an optimized meta description',
          enabled: true,
          priority: 'critical',
        });
      }

      if (!technicalResult.scores.semantic.hasUniqueH1 || technicalResult.scores.semantic.h1Count === 0) {
        fixes.push({
          id: 'fix_h1',
          category: 'seo',
          label: language === 'fr' ? 'Corriger la balise H1' : language === 'es' ? 'Corregir etiqueta H1' : 'Fix H1 tag',
          description: language === 'fr' ? 'Assure un H1 unique et optimisé' : 'Ensure a unique and optimized H1',
          enabled: true,
          priority: 'critical',
        });
      }

      // AI Ready Fixes
      if (!technicalResult.scores.aiReady.hasSchemaOrg) {
        fixes.push({
          id: 'fix_jsonld',
          category: 'seo',
          label: language === 'fr' ? 'Ajouter JSON-LD Schema.org' : language === 'es' ? 'Añadir JSON-LD Schema.org' : 'Add JSON-LD Schema.org',
          description: language === 'fr' ? 'Injecte des données structurées pour l\'IA et Google' : 'Inject structured data for AI and Google',
          enabled: true,
          priority: 'important',
          data: { siteName, siteUrl }
        });
      }

      // Performance Fixes
      if (technicalResult.scores.performance.lcp > 2500) {
        fixes.push({
          id: 'fix_lazy_images',
          category: 'performance',
          label: language === 'fr' ? 'Lazy Loading des images' : language === 'es' ? 'Carga diferida de imágenes' : 'Lazy load images',
          description: language === 'fr' ? 'Ajoute le lazy loading aux images hors viewport' : 'Add lazy loading to off-viewport images',
          enabled: true,
          priority: 'important',
        });
      }

      // Security fixes
      if (!technicalResult.scores.security.isHttps) {
        fixes.push({
          id: 'fix_https_redirect',
          category: 'seo',
          label: language === 'fr' ? 'Redirection HTTPS' : language === 'es' ? 'Redirección HTTPS' : 'HTTPS Redirect',
          description: language === 'fr' ? 'Force la redirection vers HTTPS' : 'Force redirect to HTTPS',
          enabled: true,
          priority: 'critical',
        });
      }
    }

    // Accessibility fixes (always available - enabled by default)
    fixes.push({
      id: 'fix_contrast',
      category: 'accessibility',
      label: language === 'fr' ? 'Améliorer le contraste' : language === 'es' ? 'Mejorar contraste' : 'Improve contrast',
      description: language === 'fr' ? 'Ajuste les couleurs des éléments à faible contraste' : 'Adjust colors of low contrast elements',
      enabled: true,
      priority: 'optional',
    });

    fixes.push({
      id: 'fix_alt_images',
      category: 'accessibility',
      label: language === 'fr' ? 'Alt text pour images' : language === 'es' ? 'Texto alt para imágenes' : 'Alt text for images',
      description: language === 'fr' ? 'Ajoute des attributs alt manquants' : 'Add missing alt attributes',
      enabled: true,
      priority: 'important',
    });

    // Tracking fixes (enabled by default)
    fixes.push({
      id: 'fix_gtm',
      category: 'tracking',
      label: language === 'fr' ? 'Intégrer Google Tag Manager' : language === 'es' ? 'Integrar Google Tag Manager' : 'Integrate Google Tag Manager',
      description: language === 'fr' ? 'Injecte le snippet GTM' : 'Inject GTM snippet',
      enabled: true,
      priority: 'optional',
      data: { gtmId: 'GTM-XXXXXXX' }
    });

    fixes.push({
      id: 'fix_ga4',
      category: 'tracking',
      label: language === 'fr' ? 'Ajouter Google Analytics 4' : language === 'es' ? 'Añadir Google Analytics 4' : 'Add Google Analytics 4',
      description: language === 'fr' ? 'Injecte le pixel GA4' : 'Inject GA4 pixel',
      enabled: true,
      priority: 'optional',
      data: { measurementId: 'G-XXXXXXXXXX' }
    });

    // Hallucination fix (supports both legacy and new format)
    if (hasHallucinationFixes(hallucinationData)) {
      const trueValue = extractTrueValueFromDiagnosis(hallucinationData!);
      fixes.push({
        id: 'fix_hallucination',
        category: 'hallucination',
        label: language === 'fr' ? 'Correction Hallucination IA' : language === 'es' ? 'Corrección Alucinación IA' : 'AI Hallucination Fix',
        description: language === 'fr' ? 'Injecte des métadonnées clarificatrices pour les LLM' : 'Inject clarifying metadata for LLMs',
        enabled: true,
        priority: 'critical',
        data: {
          trueValue,
          confusionSources: hallucinationData!.confusionSources || [],
          correctedIntro: hallucinationData!.correctedIntro || '',
          // New format data
          discrepancies: hallucinationData!.discrepancies || [],
          correctedValues: hallucinationData!.correctedValues || {},
          recommendations: hallucinationData!.recommendations || []
        }
      });
    }

    return fixes;
  }, [technicalResult, strategicResult, language, siteName, siteUrl, hallucinationData]);

  // Initialize fix configs when modal opens
  useEffect(() => {
    if (isOpen) {
      setFixConfigs(availableFixes);
      setGeneratedCode('');
      setDisplayedCode('');
      setIsTyping(false);
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

  // Typing animation effect
  useEffect(() => {
    if (!generatedCode || !isTyping) return;

    let currentIndex = 0;
    const chars = generatedCode.split('');
    const typingSpeed = 5; // ms per character
    
    setDisplayedCode('');
    
    const typeNextChunk = () => {
      if (currentIndex >= chars.length) {
        setIsTyping(false);
        return;
      }
      
      // Type multiple characters at once for speed
      const chunkSize = Math.min(8, chars.length - currentIndex);
      const chunk = chars.slice(currentIndex, currentIndex + chunkSize).join('');
      setDisplayedCode(prev => prev + chunk);
      currentIndex += chunkSize;
      
      setTimeout(typeNextChunk, typingSpeed);
    };

    typeNextChunk();
  }, [generatedCode, isTyping]);

  // Generate the script via Edge Function
  const handleGenerate = useCallback(async () => {
    const enabledFixes = fixConfigs.filter(f => f.enabled);
    if (enabledFixes.length === 0) {
      toast({
        title: t.noFixesSelected,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    setDisplayedCode('');

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
        setIsTyping(true);
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
  }, [fixConfigs, siteName, siteUrl, language, t.noFixesSelected, toast]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast({
      title: t.copied,
      description: `${generatedCode.split('\n').length} ${t.linesGenerated}`,
    });
    setTimeout(() => setCopied(false), 2000);
  }, [generatedCode, t.copied, t.linesGenerated, toast]);

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
      
      sonnerToast.success(t.savedToProfile);
    } catch (error) {
      console.error('Error saving corrective code:', error);
      sonnerToast.error(t.saveError);
    } finally {
      setIsSaving(false);
    }
  }, [generatedCode, user, fixConfigs, siteName, siteUrl, t.savedToProfile, t.saveError]);

  const enabledCount = fixConfigs.filter(f => f.enabled).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border-violet-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-violet-500" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4">
          {/* Left Panel: Configuration */}
          <div className="lg:w-1/3 flex flex-col gap-4">
            <Card className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  {t.configTitle}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t.configDesc}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[340px] pr-2">
                  <FixConfigPanel 
                    fixes={fixConfigs} 
                    onToggle={toggleFix}
                    categories={t.categories}
                  />
                </ScrollArea>
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={enabledCount === 0 || isGenerating}
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all duration-300"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Code className="w-4 h-4" />
                  </motion.div>
                  {t.generating}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Générer le script ({enabledCount} correctif{enabledCount > 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>

          {/* Right Panel: Code Display */}
          <div className="lg:w-2/3 flex flex-col gap-4">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Code className="w-4 h-4 text-violet-500" />
                  {t.previewTitle}
                </CardTitle>
                {generatedCode && (
                  <div className="flex items-center gap-2">
                    {user && (
                      <Button
                        onClick={handleSaveToProfile}
                        variant="outline"
                        size="sm"
                        className="gap-2 border-violet-500/50 text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                        disabled={isTyping || isSaving}
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      size="sm"
                      className="gap-2 border-violet-500/50 text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                      disabled={isTyping}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-success" />
                          {t.copied}
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          {t.copyButton}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 pt-0">
                <CodeBlock 
                  code={displayedCode || generatedCode} 
                  isTyping={isTyping}
                  placeholder={t.noFixesSelected}
                />
              </CardContent>
            </Card>

            {/* Security Note */}
            <Alert className="border-amber-500/50 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-600 dark:text-amber-400">{t.securityNote}</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                {t.securityDesc}
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* Implementation Guide - Collapsible */}
        {generatedCode && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ImplementationGuide language={language} />
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
