import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  BrainCircuit, Loader2, Sparkles, Edit3, Building2, MapPin, 
  Target, Calendar, FileText, Globe, Users, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface DetectedValues {
  sector: string;
  country: string;
  valueProposition: string;
  targetAudience: string;
  businessAge: string;
  businessType: string;
  mainProducts: string;
}

interface HallucinationCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  introduction: string;
  domain: string;
  siteName: string;
  onDiagnosisComplete?: (data: HallucinationDiagnosis) => void;
  // Legacy prop name for backward compatibility
  onHallucinationDataReady?: (data: HallucinationDiagnosis) => void;
}

export interface HallucinationDiagnosis {
  originalValues: DetectedValues;
  correctedValues: DetectedValues;
  discrepancies: Discrepancy[];
  confusionSources: string[];
  recommendations: HallucinationRecommendation[];
  analysisNarrative: string;
}

export interface Discrepancy {
  field: string;
  original: string;
  corrected: string;
  impact: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface HallucinationRecommendation {
  id: string;
  category: 'metadata' | 'content' | 'schema' | 'authority';
  priority: 'critical' | 'important' | 'optional';
  title: string;
  description: string;
  codeSnippet?: string;
}

const translations = {
  fr: {
    title: 'Correction des Informations IA',
    description: 'Vérifiez et corrigez les informations détectées par l\'IA sur votre site',
    detectedInfo: 'Informations Détectées',
    editInfo: 'Vous pouvez modifier les valeurs incorrectes ci-dessous',
    sector: 'Secteur d\'activité',
    country: 'Pays / Zone géographique',
    valueProposition: 'Proposition de valeur',
    targetAudience: 'Cible / Audience',
    businessAge: 'Ancienneté',
    businessType: 'Type d\'entreprise',
    mainProducts: 'Produits/Services principaux',
    diagnose: 'Lancer le Diagnostic',
    diagnosing: 'Analyse des incohérences...',
    success: 'Diagnostic terminé',
    successDesc: 'Les incohérences ont été analysées et les recommandations sont disponibles dans le rapport.',
  },
  en: {
    title: 'AI Information Correction',
    description: 'Review and correct information detected by AI about your site',
    detectedInfo: 'Detected Information',
    editInfo: 'You can edit incorrect values below',
    sector: 'Industry Sector',
    country: 'Country / Geographic Area',
    valueProposition: 'Value Proposition',
    targetAudience: 'Target Audience',
    businessAge: 'Business Age',
    businessType: 'Business Type',
    mainProducts: 'Main Products/Services',
    diagnose: 'Run Diagnosis',
    diagnosing: 'Analyzing discrepancies...',
    success: 'Diagnosis complete',
    successDesc: 'Discrepancies have been analyzed and recommendations are available in the report.',
  },
  es: {
    title: 'Corrección de Información IA',
    description: 'Revise y corrija la información detectada por la IA sobre su sitio',
    detectedInfo: 'Información Detectada',
    editInfo: 'Puede editar los valores incorrectos a continuación',
    sector: 'Sector de Actividad',
    country: 'País / Zona Geográfica',
    valueProposition: 'Propuesta de Valor',
    targetAudience: 'Público Objetivo',
    businessAge: 'Antigüedad',
    businessType: 'Tipo de Empresa',
    mainProducts: 'Productos/Servicios Principales',
    diagnose: 'Ejecutar Diagnóstico',
    diagnosing: 'Analizando discrepancias...',
    success: 'Diagnóstico completo',
    successDesc: 'Las discrepancias han sido analizadas y las recomendaciones están disponibles en el informe.',
  },
};

function parseIntroductionToValues(introduction: string, domain: string): DetectedValues {
  // Parse the introduction to extract initial values
  // This is a heuristic extraction - the AI will refine it
  const lines = introduction.split('\n').filter(l => l.trim());
  
  return {
    sector: '',
    country: 'France',
    valueProposition: lines[0]?.substring(0, 200) || '',
    targetAudience: '',
    businessAge: '',
    businessType: '',
    mainProducts: '',
  };
}

export function HallucinationCorrectionModal({
  open,
  onOpenChange,
  introduction,
  domain,
  siteName,
  onDiagnosisComplete,
  onHallucinationDataReady
}: HallucinationCorrectionModalProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const prevOpenRef = useRef(open);

  // When modal closes, dispatch event so Félix can propose diagnosis
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      // Modal just closed — notify Félix after 2s
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('felix-hallucination-diagnosis', {
          detail: { domain, url: domain }
        }));
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevOpenRef.current = open;
  }, [open, domain]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [detectedValues, setDetectedValues] = useState<DetectedValues>({
    sector: '',
    country: '',
    valueProposition: '',
    targetAudience: '',
    businessAge: '',
    businessType: '',
    mainProducts: '',
  });
  const [correctedValues, setCorrectedValues] = useState<DetectedValues>({
    sector: '',
    country: '',
    valueProposition: '',
    targetAudience: '',
    businessAge: '',
    businessType: '',
    mainProducts: '',
  });

  // Extract values from introduction when modal opens
  useEffect(() => {
    if (open && introduction) {
      extractValuesFromIntroduction();
    }
  }, [open, introduction]);

  const extractValuesFromIntroduction = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-hallucination', {
        body: {
          domain,
          coreValueSummary: introduction,
          action: 'extract',
          lang: language
        }
      });

      if (error) throw error;

      if (data?.success && data?.extractedValues) {
        const extracted = data.extractedValues as DetectedValues;
        setDetectedValues(extracted);
        setCorrectedValues(extracted);
      } else {
        // Fallback to heuristic extraction
        const parsed = parseIntroductionToValues(introduction, domain);
        setDetectedValues(parsed);
        setCorrectedValues(parsed);
      }
    } catch (err) {
      console.error('Value extraction error:', err);
      // Fallback
      const parsed = parseIntroductionToValues(introduction, domain);
      setDetectedValues(parsed);
      setCorrectedValues(parsed);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFieldChange = (field: keyof DetectedValues, value: string) => {
    setCorrectedValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Track which fields have been modified
  const modifiedFields = useMemo(() => {
    const modified: Record<keyof DetectedValues, boolean> = {
      sector: correctedValues.sector !== detectedValues.sector,
      country: correctedValues.country !== detectedValues.country,
      valueProposition: correctedValues.valueProposition !== detectedValues.valueProposition,
      targetAudience: correctedValues.targetAudience !== detectedValues.targetAudience,
      businessAge: correctedValues.businessAge !== detectedValues.businessAge,
      businessType: correctedValues.businessType !== detectedValues.businessType,
      mainProducts: correctedValues.mainProducts !== detectedValues.mainProducts,
    };
    return modified;
  }, [correctedValues, detectedValues]);

  // Common input classes with caret visibility (! modifier to override global transparent caret)
  const inputClasses = "border-slate-300 dark:border-slate-700 !caret-primary focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all";
  const textareaClasses = "border-slate-300 dark:border-slate-700 !caret-primary focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none";

  const runDiagnosis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-hallucination', {
        body: {
          domain,
          coreValueSummary: introduction,
          action: 'compare',
          originalValues: detectedValues,
          correctedValues: correctedValues,
          lang: language
        }
      });

      if (error) throw error;

      if (data?.success && data?.diagnosis) {
        const diagnosis = data.diagnosis as HallucinationDiagnosis;
        
        toast.success(t.success, {
          description: t.successDesc
        });

        // Close modal and notify parent (support both prop names)
        const callback = onDiagnosisComplete || onHallucinationDataReady;
        if (callback) {
          callback(diagnosis);
        }
        onOpenChange(false);
      } else {
        throw new Error(data?.error || 'Diagnosis failed');
      }
    } catch (err) {
      console.error('Diagnosis error:', err);
      toast.error('Erreur lors du diagnostic');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldIcons: Record<keyof DetectedValues, React.ReactNode> = {
    sector: <Building2 className="h-4 w-4 text-muted-foreground" />,
    country: <MapPin className="h-4 w-4 text-muted-foreground" />,
    valueProposition: <Target className="h-4 w-4 text-muted-foreground" />,
    targetAudience: <Users className="h-4 w-4 text-muted-foreground" />,
    businessAge: <Calendar className="h-4 w-4 text-muted-foreground" />,
    businessType: <FileText className="h-4 w-4 text-muted-foreground" />,
    mainProducts: <Globe className="h-4 w-4 text-muted-foreground" />,
  };

  const fieldLabels: Record<keyof DetectedValues, string> = {
    sector: t.sector,
    country: t.country,
    valueProposition: t.valueProposition,
    targetAudience: t.targetAudience,
    businessAge: t.businessAge,
    businessType: t.businessType,
    mainProducts: t.mainProducts,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BrainCircuit className="h-6 w-6 text-slate-600" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {t.description} : <strong>{siteName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Loading state while extracting */}
          {isExtracting ? (
            <Card className="border-slate-500/30">
              <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
                <p className="text-sm text-muted-foreground">Extraction des informations détectées...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Header Info */}
              <Card className="border-slate-500/30 bg-slate-50/30 dark:bg-slate-900/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Edit3 className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{t.detectedInfo}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t.editInfo}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Editable Fields Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Sector */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.sector}
                    {fieldLabels.sector}
                    {modifiedFields.sector && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Input
                    value={correctedValues.sector}
                    onChange={(e) => handleFieldChange('sector', e.target.value)}
                    placeholder="Ex: E-commerce, SaaS, Restauration..."
                    className={cn(inputClasses, modifiedFields.sector && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.country}
                    {fieldLabels.country}
                    {modifiedFields.country && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Input
                    value={correctedValues.country}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    placeholder="Ex: France, Europe, Monde..."
                    className={cn(inputClasses, modifiedFields.country && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>

                {/* Business Type */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.businessType}
                    {fieldLabels.businessType}
                    {modifiedFields.businessType && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Input
                    value={correctedValues.businessType}
                    onChange={(e) => handleFieldChange('businessType', e.target.value)}
                    placeholder="Ex: TPE, PME, Grande entreprise, Startup..."
                    className={cn(inputClasses, modifiedFields.businessType && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>

                {/* Business Age */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.businessAge}
                    {fieldLabels.businessAge}
                    {modifiedFields.businessAge && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Input
                    value={correctedValues.businessAge}
                    onChange={(e) => handleFieldChange('businessAge', e.target.value)}
                    placeholder="Ex: 2 ans, 10+ ans, Nouvelle entreprise..."
                    className={cn(inputClasses, modifiedFields.businessAge && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>

                {/* Target Audience */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.targetAudience}
                    {fieldLabels.targetAudience}
                    {modifiedFields.targetAudience && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Input
                    value={correctedValues.targetAudience}
                    onChange={(e) => handleFieldChange('targetAudience', e.target.value)}
                    placeholder="Ex: Particuliers 25-45 ans, Entreprises B2B, Professionnels de santé..."
                    className={cn(inputClasses, modifiedFields.targetAudience && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>

                {/* Main Products/Services */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.mainProducts}
                    {fieldLabels.mainProducts}
                    {modifiedFields.mainProducts && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Input
                    value={correctedValues.mainProducts}
                    onChange={(e) => handleFieldChange('mainProducts', e.target.value)}
                    placeholder="Ex: Vêtements bio, Logiciel de comptabilité, Conseil en stratégie..."
                    className={cn(inputClasses, modifiedFields.mainProducts && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>

                {/* Value Proposition (full width, textarea) */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="flex items-center gap-2 text-sm">
                    {fieldIcons.valueProposition}
                    {fieldLabels.valueProposition}
                    {modifiedFields.valueProposition && (
                      <Check className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </Label>
                  <Textarea
                    value={correctedValues.valueProposition}
                    onChange={(e) => handleFieldChange('valueProposition', e.target.value)}
                    placeholder="Décrivez en quelques phrases ce que fait vraiment votre entreprise et ce qui la différencie..."
                    rows={3}
                    className={cn(textareaClasses, modifiedFields.valueProposition && "border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20")}
                  />
                </div>
              </div>

              {/* Diagnose Button */}
              <Button
                onClick={runDiagnosis}
                disabled={isLoading}
                className="w-full h-12 bg-slate-600 hover:bg-slate-700 text-white shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {t.diagnosing}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    {t.diagnose}
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Re-export for backward compatibility
export interface HallucinationAnalysis extends HallucinationDiagnosis {}
