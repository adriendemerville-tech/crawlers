import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyRound } from 'lucide-react';
import { CompetitiveLandscape, MarketDataSummary, StrategicAnalysis } from '@/types/expertAudit';
import { KeywordPositioningCard } from './KeywordPositioningCard';

type Props = {
  analysis: StrategicAnalysis;
  domain?: string;
};

function KeywordsFallbackCard({ marketSummary }: { marketSummary?: MarketDataSummary | null }) {
  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" />
          Mots clés
          <Badge variant="outline" className="ml-auto text-xs">
            Données indisponibles
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Le module "mots clés" n'a pas été renvoyé par l'analyse (source externe indisponible ou quota atteint).
        </p>
        {marketSummary?.total_market_volume !== undefined && (
          <p className="text-sm text-foreground">
            Volume marché détecté : <span className="font-semibold">{marketSummary.total_market_volume.toLocaleString()}</span> / mois
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Encadré UI dédié "Mots clés" pour /audit-expert.
 * Objectif: toujours afficher un bloc "Mots clés" dès la réponse de l'audit stratégique.
 */
export function KeywordModuleSection({ analysis, domain }: Props) {
  const positioning = analysis.keyword_positioning;
  const marketSummary = analysis.market_data_summary;
  const competitors: CompetitiveLandscape | undefined = analysis.competitive_landscape;

  // Show the card even if the data is missing, so the user always sees the "Mots clés" block.
  if (!positioning) {
    return <KeywordsFallbackCard marketSummary={marketSummary} />;
  }

  return (
    <KeywordPositioningCard 
      positioning={positioning} 
      marketSummary={marketSummary} 
      competitors={competitors}
      domain={domain}
      rankingOverview={analysis.ranking_overview}
    />
  );
}
