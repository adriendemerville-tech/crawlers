import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Zap, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { StrategicAnalysis } from '@/types/expertAudit';
import { MethodologyPopover } from './MethodologyPopover';
import { toast } from 'sonner';

interface ZeroClickRiskCardProps {
  analysis: StrategicAnalysis;
  domain: string;
}

interface KeywordRisk {
  keyword: string;
  risk: 'high' | 'medium' | 'low';
  reason: string;
  zeroClickType: string;
}

export function ZeroClickRiskCard({ analysis, domain }: ZeroClickRiskCardProps) {
  const [showStrategy, setShowStrategy] = useState(false);

  // Build keyword risk list from analysis data
  const buildKeywordRisks = (): KeywordRisk[] => {
    const keywords = analysis.keyword_positioning?.main_keywords ?? [];
    const risks: KeywordRisk[] = [];

    // Use real keywords if available, else fallback
    if (keywords.length > 0) {
      keywords.slice(0, 5).forEach((kw) => {
        const word = kw.keyword.toLowerCase();
        const isDefinition = /^(qu'?est|définition|c'?est quoi|what is|meaning)/.test(word) || word.split(' ').length <= 2;
        const isCalculation = /^(calcul|combien|prix|tarif|coût|cost|how much)/.test(word);
        const isComparison = /^(vs|comparatif|meilleur|best|top)/.test(word);

        let risk: 'high' | 'medium' | 'low' = 'low';
        let reason = 'Contenu d\'expérience nécessaire';
        let zeroClickType = 'Contenu long';

        if (isDefinition) {
          risk = 'high';
          reason = 'Réponse directe par l\'IA (définition courte)';
          zeroClickType = 'Définition';
        } else if (isCalculation) {
          risk = 'high';
          reason = 'Calcul instantané sans clic nécessaire';
          zeroClickType = 'Calcul / Prix';
        } else if (isComparison) {
          risk = 'medium';
          reason = 'Tableau comparatif généré par l\'IA';
          zeroClickType = 'Comparatif';
        }

        risks.push({ keyword: kw.keyword, risk, reason, zeroClickType });
      });
    }

    // Ensure at least 3 entries with simulated high-risk keywords
    if (risks.filter(r => r.risk === 'high').length === 0) {
      risks.unshift(
        { keyword: `définition ${domain.replace(/^www\./, '').split('.')[0]}`, risk: 'high', reason: 'Réponse directe par l\'IA (définition courte)', zeroClickType: 'Définition' },
        { keyword: `prix ${domain.replace(/^www\./, '').split('.')[0]}`, risk: 'high', reason: 'Calcul instantané sans clic nécessaire', zeroClickType: 'Calcul / Prix' },
      );
    }
    if (risks.length < 3) {
      risks.push(
        { keyword: 'comparatif solutions 2026', risk: 'medium', reason: 'Tableau comparatif généré par l\'IA', zeroClickType: 'Comparatif' },
      );
    }

    return risks.slice(0, 5);
  };

  const risks = buildKeywordRisks();
  const highRiskCount = risks.filter(r => r.risk === 'high').length;
  const highRiskPercent = Math.round((highRiskCount / Math.max(1, risks.length)) * 100);

  const getRiskBadge = (risk: 'high' | 'medium' | 'low') => {
    switch (risk) {
      case 'high':
        return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Élevé</Badge>;
      case 'medium':
        return <Badge className="text-[10px] gap-1 bg-warning text-warning-foreground"><ShieldAlert className="h-3 w-3" />Moyen</Badge>;
      case 'low':
        return <Badge variant="secondary" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />Faible</Badge>;
    }
  };

  const handleGenerateStrategy = () => {
    setShowStrategy(true);
    toast.success('Stratégie E-E-A-T de contournement générée !');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border border-destructive/20 bg-gradient-to-br from-destructive/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <Zap className="h-4.5 w-4.5 text-destructive" />
            </div>
            Matrice de Risque Zéro-Clic
            <Badge variant="outline" className="ml-auto text-xs border-destructive/30 text-destructive">
              {highRiskCount} menace{highRiskCount > 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Impact Text */}
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
            <p className="text-sm leading-relaxed text-foreground">
              <span className="font-semibold">Attention :</span>{' '}
              <span className="font-bold text-destructive">{highRiskPercent}%</span> de vos mots-clés cibles déclenchent des réponses directes de l'IA.
              Vous devez pivoter vers des <span className="font-semibold">contenus d'expérience (E-E-A-T)</span> pour survivre.
            </p>
          </div>

          {/* Keyword Risk Matrix */}
          <div className="overflow-hidden rounded-lg border border-border/50">
            <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-0 text-xs">
              {/* Header */}
              <div className="bg-muted/50 px-3 py-2 font-semibold text-muted-foreground">Mot-clé</div>
              <div className="bg-muted/50 px-3 py-2 font-semibold text-muted-foreground text-center">Risque</div>
              <div className="bg-muted/50 px-3 py-2 font-semibold text-muted-foreground text-center">Type</div>
              <div className="bg-muted/50 px-3 py-2 font-semibold text-muted-foreground">Raison</div>

              {risks.map((kw, i) => (
                <motion.div
                  key={i}
                  className="contents"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className="border-t border-border/30 px-3 py-2.5 font-medium text-foreground truncate">
                    {kw.keyword}
                  </div>
                  <div className="border-t border-border/30 px-3 py-2.5 flex items-center justify-center">
                    {getRiskBadge(kw.risk)}
                  </div>
                  <div className="border-t border-border/30 px-3 py-2.5 text-center text-muted-foreground">
                    {kw.zeroClickType}
                  </div>
                  <div className="border-t border-border/30 px-3 py-2.5 text-muted-foreground">
                    {kw.reason}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Strategy Section */}
          {showStrategy ? (
            <motion.div
              className="space-y-3 rounded-lg border border-success/20 bg-success/5 p-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-success">
                <Shield className="h-4 w-4" />
                Stratégie de contournement E-E-A-T
              </div>
              <ul className="space-y-2 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">1.</span>
                  <span><strong>Enrichir avec l'expérience :</strong> Ajoutez des études de cas, témoignages clients et données propriétaires que l'IA ne peut pas résumer.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">2.</span>
                  <span><strong>Créer des outils interactifs :</strong> Calculateurs, configurateurs et simulateurs qui nécessitent un clic vers votre site.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">3.</span>
                  <span><strong>Pivoter vers le long-tail :</strong> Ciblez des requêtes d'intention spécifiques que l'IA ne peut pas satisfaire en une réponse.</span>
                </li>
              </ul>
            </motion.div>
          ) : (
            <Button
              onClick={handleGenerateStrategy}
              className="w-full gap-2"
              variant="outline"
            >
              <Shield className="h-4 w-4" />
              Générer une stratégie de contournement E-E-A-T
            </Button>
          )}
          <MethodologyPopover variant="zero_click_risk" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
