import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, ExternalLink, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';
import { BrokenLinksAnalysis } from '@/types/expertAudit';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BrokenLinksCardProps {
  brokenLinks: BrokenLinksAnalysis;
}

export function BrokenLinksCard({ brokenLinks }: BrokenLinksCardProps) {
  const getVerdictColor = () => {
    switch (brokenLinks.verdict) {
      case 'optimal': return 'text-success';
      case 'warning': return 'text-warning';
      case 'critical': return 'text-destructive';
    }
  };

  const getVerdictIcon = () => {
    switch (brokenLinks.verdict) {
      case 'optimal': return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'critical': return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getVerdictLabel = () => {
    switch (brokenLinks.verdict) {
      case 'optimal': return 'Aucun lien cassé';
      case 'warning': return 'Quelques liens cassés';
      case 'critical': return 'Nombreux liens cassés';
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-5 w-5 text-orange-500" />
            Liens cassés
            <Link to="/lexique#liens-casses" className="ml-1">
              <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
          </CardTitle>
          <Badge variant="outline" className={cn('text-sm font-medium', getVerdictColor())}>
            {brokenLinks.broken.length}/{brokenLinks.checked}
          </Badge>
        </div>
        
        {/* Verdict */}
        <div className="flex items-center gap-2 mt-2">
          {getVerdictIcon()}
          <span className={cn('text-sm font-medium', getVerdictColor())}>
            {getVerdictLabel()}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-sm text-muted-foreground">Liens vérifiés</span>
          <span className="text-sm font-medium">{brokenLinks.checked}</span>
        </div>
        
        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
          <span className="text-sm text-muted-foreground">Liens cassés</span>
          <span className={cn(
            'text-sm font-medium',
            brokenLinks.broken.length > 0 ? 'text-destructive' : 'text-success'
          )}>
            {brokenLinks.broken.length}
          </span>
        </div>
        
        {brokenLinks.corsBlocked > 0 && (
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Non vérifiables (CORS)</span>
            <span className="text-sm font-medium text-muted-foreground">{brokenLinks.corsBlocked}</span>
          </div>
        )}
        
        {/* Broken links list */}
        {brokenLinks.broken.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Liens à corriger</p>
            {brokenLinks.broken.slice(0, 5).map((link, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-destructive/5 rounded-md">
                <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {link.anchor || 'Sans texte'}
                  </p>
                  <div className="flex items-center gap-2">
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                    >
                      {link.url.substring(0, 50)}...
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Badge variant="destructive" className="text-xs shrink-0">
                      {link.status === 0 ? 'Timeout' : `${link.status}`}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {brokenLinks.broken.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{brokenLinks.broken.length - 5} autres liens cassés
              </p>
            )}
          </div>
        )}
        
        {/* CORS notice */}
        {brokenLinks.corsBlocked > 0 && (
          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md mt-2">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Certains liens externes n'ont pas pu être vérifiés en raison des politiques CORS des sites tiers.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
