import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  BrainCircuit, AlertTriangle, Lightbulb, CheckCircle2, 
  Loader2, Sparkles, FileCode2, Copy, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HallucinationCorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  introduction: string;
  domain: string;
  siteName: string;
  onHallucinationDataReady?: (data: HallucinationAnalysis) => void;
}

export interface HallucinationAnalysis {
  trueValue: string;
  hallucinationAnalysis: string;
  confusionSources: string[];
  recommendations: string[];
  correctedIntro?: string;
}

export function HallucinationCorrectionModal({
  open,
  onOpenChange,
  introduction,
  domain,
  siteName,
  onHallucinationDataReady
}: HallucinationCorrectionModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<HallucinationAnalysis | null>(null);
  const [correctedIntro, setCorrectedIntro] = useState('');
  const [copied, setCopied] = useState(false);

  const analyzeHallucination = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('diagnose-hallucination', {
        body: {
          domain,
          coreValueSummary: introduction,
          hallucinations: [],
          lang: 'fr'
        }
      });

      if (error) throw error;
      
      if (data?.success && data?.data) {
        const analysisData = data.data as HallucinationAnalysis;
        setAnalysis(analysisData);
        
        // Generate corrected intro based on true value
        const corrected = generateCorrectedIntro(introduction, analysisData.trueValue);
        setCorrectedIntro(corrected);
        analysisData.correctedIntro = corrected;
        
        // Notify parent component
        if (onHallucinationDataReady) {
          onHallucinationDataReady(analysisData);
        }
        
        toast.success('Analyse d\'hallucination terminée');
      } else {
        throw new Error(data?.error || 'Analyse échouée');
      }
    } catch (err) {
      console.error('Hallucination analysis error:', err);
      toast.error('Erreur lors de l\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateCorrectedIntro = (original: string, trueValue: string): string => {
    // Replace the first paragraph with the true value
    const paragraphs = original.split('\n\n');
    if (paragraphs.length > 0) {
      paragraphs[0] = trueValue;
    }
    return paragraphs.join('\n\n');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(correctedIntro);
      setCopied(true);
      toast.success('Introduction corrigée copiée');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BrainCircuit className="h-6 w-6 text-slate-600" />
            Correction Hallucination IA
          </DialogTitle>
          <DialogDescription>
            Analysez ce qui induit les LLM en erreur et corrigez l'introduction pour améliorer la perception IA de {siteName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Original Introduction */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block">
              Introduction actuelle générée par l'IA
            </Label>
            <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {introduction}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Analyze Button */}
          {!analysis && (
            <Button 
              onClick={analyzeHallucination}
              disabled={isAnalyzing}
              className="w-full h-12 bg-slate-600 hover:bg-slate-700 text-white"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Analyse des sources de confusion...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Diagnostiquer les Hallucinations
                </>
              )}
            </Button>
          )}

          {/* Analysis Results */}
          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* True Value */}
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-2">Vraie Proposition de Valeur</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysis.trueValue}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Confusion Sources */}
                <Card className="border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-3">Sources de Confusion pour les Robots</h4>
                        <div className="flex flex-wrap gap-2">
                          {analysis.confusionSources.map((source, i) => (
                            <Badge key={i} variant="outline" className="bg-amber-100/50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300/50">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Hallucination Analysis */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <BrainCircuit className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-2">Analyse des Hallucinations</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {analysis.hallucinationAnalysis}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-foreground mb-3">Recommandations Correctives</h4>
                        <ul className="space-y-2">
                          {analysis.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-primary font-bold">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Corrected Introduction */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-slate-600" />
                    Introduction Corrigée (Proposition)
                  </Label>
                  <Textarea
                    value={correctedIntro}
                    onChange={(e) => setCorrectedIntro(e.target.value)}
                    rows={6}
                    className="resize-none border-slate-500/30 focus:border-slate-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={copyToClipboard}
                      className="flex-1"
                    >
                      {copied ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-success" />
                          Copié !
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copier l'introduction corrigée
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Info about code generator */}
                <Card className="border-violet-500/30 bg-violet-50/30 dark:bg-violet-950/20">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-violet-600 dark:text-violet-400">Patch automatique disponible !</strong> Le générateur de code correctif intègrera un script pour injecter les bonnes métadonnées et corriger la perception IA de votre site.
                      </span>
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
