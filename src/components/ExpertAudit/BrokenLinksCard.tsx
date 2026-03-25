import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link2, ExternalLink, AlertTriangle, CheckCircle2, XCircle, Info, ShieldCheck } from 'lucide-react';
import { BrokenLinksAnalysis } from '@/types/expertAudit';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface BrokenLinksCardProps {
  brokenLinks: BrokenLinksAnalysis & { skipped_social?: number };
}

export function BrokenLinksCard({ brokenLinks }: BrokenLinksCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissedUrls, setDismissedUrls] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

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

  const handleMarkFalsePositive = async (linkUrl: string) => {
    if (!user) {
      toast({ title: 'Connectez-vous', description: 'Vous devez être connecté pour marquer un faux positif.', variant: 'destructive' });
      return;
    }
    
    try {
      setSaving(linkUrl);
      const domain = new URL(linkUrl).hostname;
      
      const { error } = await supabase
        .from('false_positive_domains' as any)
        .upsert(
          { domain, user_id: user.id, source: 'user' } as any,
          { onConflict: 'domain,user_id' }
        );
      
      if (error) throw error;
      
      setDismissedUrls(prev => new Set(prev).add(linkUrl));
      toast({ title: '✅ Faux positif enregistré', description: `${domain} sera ignoré dans les prochains audits.` });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const activeBroken = brokenLinks.broken.filter(l => !dismissedUrls.has(l.url));

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
            {activeBroken.length}/{brokenLinks.checked}
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
            activeBroken.length > 0 ? 'text-destructive' : 'text-success'
          )}>
            {activeBroken.length}
          </span>
        </div>
        
        {brokenLinks.corsBlocked > 0 && (
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground">Non vérifiables (CORS)</span>
            <span className="text-sm font-medium text-muted-foreground">{brokenLinks.corsBlocked}</span>
          </div>
        )}

        {(brokenLinks as any).skipped_social > 0 && (
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Réseaux sociaux ignorés
            </span>
            <span className="text-sm font-medium text-muted-foreground">{(brokenLinks as any).skipped_social}</span>
          </div>
        )}

        {dismissedUrls.size > 0 && (
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Marqués faux positifs
            </span>
            <span className="text-sm font-medium text-success">{dismissedUrls.size}</span>
          </div>
        )}
        
        {/* Broken links list */}
        {activeBroken.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Liens à corriger</p>
            {activeBroken.slice(0, 5).map((link, index) => (
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
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-7 text-xs text-muted-foreground hover:text-success"
                    onClick={() => handleMarkFalsePositive(link.url)}
                    disabled={saving === link.url}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    {saving === link.url ? '…' : 'Faux positif'}
                  </Button>
                )}
              </div>
            ))}
            {activeBroken.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{activeBroken.length - 5} autres liens cassés
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
