/**
 * ShieldOnboardingBanner — bandeau d'amorçage affiché en tête d'onglet GEO
 * lorsque le bouclier Cloudflare n'est pas déployé sur le site sélectionné.
 *
 * Explique pourquoi 7 cartes sur 9 affichent "—" et oriente l'utilisateur
 * vers la procédure d'activation (Worker CF + token API).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  trackedSiteId: string;
  domain: string;
}

export function ShieldOnboardingBanner({ trackedSiteId, domain }: Props) {
  const [loading, setLoading] = useState(true);
  const [needsShield, setNeedsShield] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('cf_shield_configs')
      .select('status')
      .eq('tracked_site_id', trackedSiteId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { status?: string } | null;
        setNeedsShield(!row || !['active', 'pending'].includes(row.status ?? ''));
        setLoading(false);
      });
  }, [trackedSiteId]);

  if (loading || !needsShield) return null;

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-warning/50 text-warning">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Bouclier Cloudflare non déployé sur <span className="font-mono">{domain}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sans le Worker, aucun hit bot IA n'est journalisé : les KPIs Crawl, Attribution, CTR référent et
              Mix LLM resteront vides. Les cartes Visibilité LLM (Benchmark, Profondeur) restent fonctionnelles.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/guide/bouclier-cloudflare-ai-bots">
              Voir la procédure
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
