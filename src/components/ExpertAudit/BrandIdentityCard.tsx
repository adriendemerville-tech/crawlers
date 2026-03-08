import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MethodologyPopover } from './MethodologyPopover';
import { Sparkles, Star, MessageSquare } from 'lucide-react';
import { BrandIdentity, MarketPositioning } from '@/types/expertAudit';

interface BrandIdentityCardProps {
  brandIdentity: BrandIdentity;
  marketPositioning?: MarketPositioning;
}

export function BrandIdentityCard({ brandIdentity, marketPositioning }: BrandIdentityCardProps) {
  const getClarityColor = (score: number) => {
    if (score >= 8) return 'text-success';
    if (score >= 5) return 'text-warning';
    return 'text-destructive';
  };

  const getClarityLabel = (score: number) => {
    if (score >= 9) return 'Exceptionnel';
    if (score >= 7) return 'Clair';
    if (score >= 5) return 'Moyen';
    if (score >= 3) return 'Confus';
    return 'Flou';
  };

  const getPriceColor = (perception: string) => {
    switch (perception) {
      case 'Premium': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'Mid-market': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'Low-cost': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Identité de Marque (Brand DNA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Archetype & Clarity Score */}
          <div className="flex flex-wrap items-start gap-4">
            {/* Archetype */}
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Archétype de Jung
              </p>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-lg font-semibold text-foreground">
                  {brandIdentity.archetype}
                </span>
              </div>
            </div>

            {/* Clarity Score */}
            <div className="flex-1 min-w-[150px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Clarté du Propos
              </p>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getClarityColor(brandIdentity.clarity_score)}`}>
                  {brandIdentity.clarity_score}
                </span>
                <span className="text-muted-foreground">/10</span>
                <Badge variant="outline" className={`ml-2 ${getClarityColor(brandIdentity.clarity_score)}`}>
                  {getClarityLabel(brandIdentity.clarity_score)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Perceived Values */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Valeurs Perçues
            </p>
            <div className="flex flex-wrap gap-2">
              {brandIdentity.perceived_values.map((value, index) => (
                <Badge 
                  key={index} 
                  variant="secondary"
                  className="text-sm"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tone Analysis */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Analyse du Ton
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/50 p-3 rounded-lg">
              {brandIdentity.tone_analysis}
            </p>
          </div>

          {/* Market Positioning (if available) */}
          {marketPositioning && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                Positionnement Marché
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Target Audience */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cible détectée</p>
                  <p className="text-sm font-medium text-foreground">
                    {marketPositioning.target_audience}
                  </p>
                </div>

                {/* Price Perception */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Perception Prix</p>
                  <Badge variant="outline" className={getPriceColor(marketPositioning.price_perception)}>
                    {marketPositioning.price_perception === 'Premium' && '💎'}
                    {marketPositioning.price_perception === 'Mid-market' && '⭐'}
                    {marketPositioning.price_perception === 'Low-cost' && '🎯'}
                    {' '}{marketPositioning.price_perception}
                  </Badge>
                </div>
              </div>

              {/* USP */}
              {marketPositioning.detected_usp && marketPositioning.detected_usp !== 'Non détectée' && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">USP Détectée</p>
                  <p className="text-sm italic text-foreground border-l-2 border-primary/50 pl-3">
                    "{marketPositioning.detected_usp}"
                  </p>
                </div>
              )}
            </div>
          )}
          <MethodologyPopover variant="brand_authority" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
