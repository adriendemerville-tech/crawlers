import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Shield, Bot, Target, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: 'syntax' | 'coverage' | 'bot_readability' | 'security';
  message: string;
  line?: number;
  suggestion?: string;
}

interface ValidationResult {
  valid: boolean;
  score: number;
  issues: ValidationIssue[];
  corrected_code?: string;
}

interface CodeValidatorProps {
  code: string;
  injectionType?: string;
  onValidated: (result: ValidationResult) => void;
  onCorrectedCode: (code: string) => void;
  disabled?: boolean;
}

const categoryIcons = {
  syntax: Code,
  coverage: Target,
  bot_readability: Bot,
  security: Shield,
};

const categoryLabels = {
  syntax: 'Syntaxe',
  coverage: 'Couverture',
  bot_readability: 'Lisibilité Bots',
  security: 'Sécurité',
};

const typeColors = {
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

const typeIcons = {
  error: XCircle,
  warning: AlertTriangle,
  info: CheckCircle2,
};

export function CodeValidator({ code, injectionType, onValidated, onCorrectedCode, disabled }: CodeValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const { toast } = useToast();

  const handleValidate = async () => {
    if (!code.trim()) {
      toast({ title: 'Code vide', description: 'Générez d\'abord un code à valider.', variant: 'destructive' });
      return;
    }

    setIsValidating(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-injection-code', {
        body: { code, injection_type: injectionType },
      });

      if (error) throw error;

      const validationResult = data as ValidationResult;
      setResult(validationResult);
      onValidated(validationResult);

      if (validationResult.valid) {
        toast({ title: '✅ Code validé', description: `Score: ${validationResult.score}/100 — Prêt pour injection.` });
      } else {
        toast({
          title: '⚠️ Problèmes détectés',
          description: `${validationResult.issues.filter(i => i.type === 'error').length} erreurs, ${validationResult.issues.filter(i => i.type === 'warning').length} avertissements`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('[CodeValidator] Validation failed:', err);
      toast({ title: 'Erreur de validation', description: 'Impossible de valider le code.', variant: 'destructive' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleApplyCorrection = () => {
    if (result?.corrected_code) {
      setIsApplyingFix(true);
      onCorrectedCode(result.corrected_code);
      setResult(prev => prev ? { ...prev, valid: true, issues: prev.issues.filter(i => i.type === 'info') } : null);
      setTimeout(() => setIsApplyingFix(false), 500);
      toast({ title: '✅ Code corrigé', description: 'Les corrections automatiques ont été appliquées.' });
    }
  };

  const errorCount = result?.issues.filter(i => i.type === 'error').length || 0;
  const warningCount = result?.issues.filter(i => i.type === 'warning').length || 0;

  return (
    <div className="space-y-3">
      {/* Validate button */}
      <Button
        onClick={handleValidate}
        disabled={disabled || isValidating || !code.trim()}
        variant="outline"
        size="sm"
        className="w-full"
      >
        {isValidating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Analyse en cours…
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            Valider le code
          </>
        )}
      </Button>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {/* Score bar */}
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Score qualité</span>
                  <span className={`text-xs font-bold ${result.score >= 80 ? 'text-emerald-500' : result.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {result.score}/100
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.score}%` }}
                    transition={{ duration: 0.6 }}
                    className={`h-full rounded-full ${result.score >= 80 ? 'bg-emerald-500' : result.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {errorCount > 0 && <Badge variant="destructive" className="text-[10px] px-1.5">{errorCount} err</Badge>}
                {warningCount > 0 && <Badge variant="outline" className="text-[10px] px-1.5 border-amber-500/50 text-amber-500">{warningCount} warn</Badge>}
                {result.valid && <Badge className="text-[10px] px-1.5 bg-emerald-500/20 text-emerald-600 border-emerald-500/30">OK</Badge>}
              </div>
            </div>

            {/* Issues list */}
            {result.issues.length > 0 && (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {result.issues.map((issue, i) => {
                    const TypeIcon = typeIcons[issue.type];
                    const CatIcon = categoryIcons[issue.category] || Code;
                    return (
                      <div key={i} className="flex items-start gap-2 p-2 rounded border border-transparent hover:border-muted-foreground/10 hover:bg-muted/30 text-xs">
                        <TypeIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${typeColors[issue.type]}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <CatIcon className="w-3 h-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{categoryLabels[issue.category]}</span>
                            {issue.line && <span className="text-muted-foreground/60">L{issue.line}</span>}
                          </div>
                          <p className="mt-0.5">{issue.message}</p>
                          {issue.suggestion && (
                            <p className="mt-0.5 text-muted-foreground italic">💡 {issue.suggestion}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Auto-correct button */}
            {!result.valid && result.corrected_code && (
              <Button
                onClick={handleApplyCorrection}
                disabled={isApplyingFix}
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isApplyingFix ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Appliquer les corrections automatiques
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
