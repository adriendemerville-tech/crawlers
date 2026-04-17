/**
 * ShieldStatusCard — état du bouclier Cloudflare Worker côté client.
 * Affiche : statut déploiement, hits 24h, total, dernier hit.
 * Source : table cf_shield_configs (lecture directe via RLS).
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';
import { MethodologyTooltip } from './MethodologyTooltip';
import { cn } from '@/lib/utils';

interface ShieldStatusCardProps {
  trackedSiteId: string;
}

interface ShieldRow {
  status: string;
  deployment_mode: string;
  hits_last_24h: number | null;
  hits_total: number | null;
  last_hit_at: string | null;
  deployed_at: string | null;
  human_sample_rate: number;
}

const STATUS_MAP: Record<string, { label: string; tone: 'ok' | 'warn' | 'off'; Icon: typeof Shield }> = {
  active: { label: 'Actif', tone: 'ok', Icon: ShieldCheck },
  pending: { label: 'En attente', tone: 'warn', Icon: ShieldAlert },
  error: { label: 'Erreur', tone: 'warn', Icon: ShieldAlert },
  disabled: { label: 'Désactivé', tone: 'off', Icon: ShieldOff },
};

export function ShieldStatusCard({ trackedSiteId }: ShieldStatusCardProps) {
  const [row, setRow] = useState<ShieldRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('cf_shield_configs')
      .select('status, deployment_mode, hits_last_24h, hits_total, last_hit_at, deployed_at, human_sample_rate')
      .eq('tracked_site_id', trackedSiteId)
      .maybeSingle()
      .then(({ data }) => {
        setRow((data as ShieldRow) ?? null);
        setLoading(false);
      });
  }, [trackedSiteId]);

  const meta = row ? STATUS_MAP[row.status] ?? STATUS_MAP.disabled : STATUS_MAP.disabled;
  const Icon = meta.Icon;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Bouclier Cloudflare
          </span>
          <MethodologyTooltip
            label="Méthode"
            title="Bouclier Cloudflare Worker"
            body={
              <>
                <p>
                  Le Worker se place devant votre site et journalise <strong>chaque requête bot IA</strong> (User-Agent +
                  IP). Aucune donnée personnelle n'est stockée : l'IP est hashée (SHA-256) avant insertion.
                </p>
                <p>
                  Un échantillon humain (<code>human_sample_rate</code>) est conservé pour calculer les ratios bot/humain
                  sans alourdir le journal.
                </p>
              </>
            }
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : !row ? (
          <p className="text-xs text-muted-foreground">Aucun bouclier déployé pour ce site.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-md border',
                  meta.tone === 'ok' && 'border-primary/40 text-primary',
                  meta.tone === 'warn' && 'border-warning/50 text-warning',
                  meta.tone === 'off' && 'border-border text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                <p className="text-xs text-muted-foreground">
                  Mode <span className="font-mono">{row.deployment_mode}</span>
                  {row.deployed_at && ` · depuis ${new Date(row.deployed_at).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border/60 px-2 py-2">
                <p className="text-[10px] uppercase text-muted-foreground">24h</p>
                <p className="text-sm font-semibold text-foreground">{row.hits_last_24h ?? 0}</p>
              </div>
              <div className="rounded-md border border-border/60 px-2 py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                <p className="text-sm font-semibold text-foreground">{row.hits_total ?? 0}</p>
              </div>
              <div className="rounded-md border border-border/60 px-2 py-2">
                <p className="text-[10px] uppercase text-muted-foreground">Échantillon humain</p>
                <p className="text-sm font-semibold text-foreground">
                  {Math.round((row.human_sample_rate ?? 0) * 100)}%
                </p>
              </div>
            </div>
            {row.last_hit_at && (
              <p className="text-[11px] text-muted-foreground">
                Dernier hit : {new Date(row.last_hit_at).toLocaleString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
