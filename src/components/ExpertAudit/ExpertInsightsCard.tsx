import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Link2, AlertTriangle, CheckCircle2, 
  XCircle, Percent, Scale, ExternalLink
} from 'lucide-react';
import { ExpertInsights } from '@/types/expertAudit';
import { InsightEducationalPanel } from './InsightEducationalPanel';
import { HelpButton } from '@/components/HelpButton';

interface ExpertInsightsCardProps {
  insights: ExpertInsights;
}

const getVerdictBadge = (verdict: string) => {
  switch (verdict) {
    case 'optimal':
    case 'good':
      return <Badge className="bg-success/20 text-success border-success/30">Optimal</Badge>;
    case 'acceptable':
      return <Badge className="bg-warning/20 text-warning border-warning/30">Acceptable</Badge>;
    case 'warning':
      return <Badge className="bg-warning/20 text-warning border-warning/30">Attention</Badge>;
    case 'redundant':
      return <Badge className="bg-warning/20 text-warning border-warning/30">Redondant</Badge>;
    case 'inconsistent':
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Incohérent</Badge>;
    case 'critical':
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Critique</Badge>;
    default:
      return <Badge variant="secondary">Inconnu</Badge>;
  }
};

export function ExpertInsightsCard({ insights }: ExpertInsightsCardProps) {
  const { semanticConsistency, contentDensity, linkProfile, jsonLdValidation } = insights;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Insights Experts
          <HelpButton term="audit-seo" size="sm" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Semantic Consistency */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Cohérence Title / H1</span>
            </div>
            {getVerdictBadge(semanticConsistency.verdict)}
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Similarité : <span className="font-mono text-foreground">{semanticConsistency.titleH1Similarity}%</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {semanticConsistency.details}
          </p>
          <InsightEducationalPanel 
            type="semantic" 
            data={{ similarity: semanticConsistency.titleH1Similarity }} 
          />
        </div>

        {/* Content Density */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Ratio Code / Texte</span>
            </div>
            {getVerdictBadge(contentDensity.verdict)}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-background rounded">
              <div className="font-mono text-foreground text-sm">{contentDensity.ratio}%</div>
              <div className="text-muted-foreground">Ratio</div>
            </div>
            <div className="text-center p-2 bg-background rounded">
              <div className="font-mono text-foreground text-sm">{Math.round(contentDensity.htmlSize / 1024)}KB</div>
              <div className="text-muted-foreground">HTML</div>
            </div>
            <div className="text-center p-2 bg-background rounded">
              <div className="font-mono text-foreground text-sm">{Math.round(contentDensity.textSize / 1024)}KB</div>
              <div className="text-muted-foreground">Texte</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ratio recommandé : <span className="font-medium text-foreground">25% – 70%</span>
          </p>
          {contentDensity.ratio < 15 && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Thin Content : risque de pénalité SEO
            </p>
          )}
          <InsightEducationalPanel 
            type="density" 
            data={{ ratio: contentDensity.ratio }} 
          />
        </div>

        {/* Link Profile */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Profil de Liens</span>
            </div>
            <Badge variant="outline">{linkProfile.total} liens</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 bg-background rounded">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Internes : <span className="font-mono font-medium">{linkProfile.internal}</span></span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-background rounded">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
              <span>Externes : <span className="font-mono font-medium">{linkProfile.external}</span></span>
            </div>
          </div>
          {linkProfile.toxicAnchorsCount > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {linkProfile.toxicAnchorsCount} ancres génériques détectées
              </p>
              <div className="flex flex-wrap gap-1">
                {linkProfile.toxicAnchors.slice(0, 5).map((anchor, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                    "{anchor}"
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <InsightEducationalPanel 
            type="links" 
            data={{ internalLinks: linkProfile.internal, externalLinks: linkProfile.external }} 
          />
        </div>

        {/* JSON-LD Validation */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {jsonLdValidation.valid ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : jsonLdValidation.count > 0 ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
              <span className="font-medium text-sm">Données Structurées JSON-LD</span>
            </div>
            <Badge variant={jsonLdValidation.valid ? 'default' : jsonLdValidation.count > 0 ? 'destructive' : 'secondary'}>
              {jsonLdValidation.count} script{jsonLdValidation.count > 1 ? 's' : ''}
            </Badge>
          </div>
          {jsonLdValidation.types.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {jsonLdValidation.types.map((type, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{type}</Badge>
              ))}
            </div>
          )}
          {jsonLdValidation.parseErrors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-destructive font-medium">Erreurs de parsing :</p>
              {jsonLdValidation.parseErrors.map((err, i) => (
                <p key={i} className="text-xs text-destructive/80 pl-2 border-l-2 border-destructive/30">
                  {err}
                </p>
              ))}
            </div>
          )}
          {jsonLdValidation.isJsGenerated && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-500/10 border border-orange-500/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                JSON et Schema détectés, mais les robots n'aiment pas le JavaScript.
              </p>
            </div>
          )}
          <InsightEducationalPanel 
            type="jsonld" 
            data={{ jsonLdCount: jsonLdValidation.count }} 
          />
        </div>
      </CardContent>
    </Card>
  );
}
