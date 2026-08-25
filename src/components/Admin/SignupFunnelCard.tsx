import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingUp, UserPlus, AlertTriangle, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale/fr';

interface FunnelData {
  days_back: number;
  tracking_started_at: string | null;
  views: number;
  oauth_start: number;
  form_submit: number;
  errors: number;
  success_tracked: number;
  new_users: number;
  by_provider: { google: number; apple: number; email: number };
  conversion_rate: number;
  error_rate: number;
  top_errors: Array<{ message: string; count: number }>;
}

const RANGES = [7, 30, 90];

export function SignupFunnelCard() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (daysBack: number) => {
    setLoading(true);
    setError(null);
    const { data: result, error: rpcError } = await supabase.rpc('get_signup_funnel', {
      days_back: daysBack,
    });
    if (rpcError) {
      setError(rpcError.message);
      setData(null);
    } else {
      setData(result as unknown as FunnelData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const steps = data
    ? [
        { label: 'Vues du formulaire', value: data.views, icon: Eye },
        { label: 'Démarrages (OAuth + email)', value: data.oauth_start + data.form_submit, icon: TrendingUp },
        { label: 'Erreurs rencontrées', value: data.errors, icon: AlertTriangle },
        { label: 'Comptes réellement créés', value: data.new_users, icon: UserPlus },
      ]
    : [];

  const trackingStart = data?.tracking_started_at
    ? format(parseISO(data.tracking_started_at), 'd MMM yyyy', { locale: fr })
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Tunnel d'inscription</CardTitle>
          <CardDescription>
            Numérateur = comptes réellement créés (source d'autorité), dénominateur = vues suivies.
            {trackingStart ? ` Suivi actif depuis le ${trackingStart}.` : ' Aucune vue enregistrée pour le moment.'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <Button
              key={r}
              variant="outline"
              size="sm"
              className={days === r ? 'border-primary text-primary' : ''}
              onClick={() => setDays(r)}
            >
              {r}j
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => void load(days)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">Erreur : {error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {steps.map((step) => (
                <div key={step.label} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <step.icon className="h-3.5 w-3.5" />
                    {step.label}
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{step.value.toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Taux de conversion</p>
                <p className="mt-1 text-2xl font-semibold">{data.conversion_rate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.new_users} comptes / {data.views} vues
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Taux d'erreur formulaire</p>
                <p className="mt-1 text-2xl font-semibold">{data.error_rate}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.errors} erreurs / {data.form_submit} envois
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Méthode d'inscription (suivie)</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  <li>Email : {data.by_provider.email}</li>
                  <li>Google : {data.by_provider.google}</li>
                  <li>Apple : {data.by_provider.apple}</li>
                </ul>
              </div>
            </div>

            {data.top_errors.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Principales erreurs</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {data.top_errors.map((e) => (
                    <li key={e.message} className="flex justify-between border-b py-1">
                      <span>{e.message}</span>
                      <span>{e.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.views > 0 && data.new_users > data.views && (
              <p className="text-xs text-muted-foreground">
                Plus de comptes créés que de vues suivies : une partie des inscriptions est antérieure
                au déploiement du suivi, ou provient d'un canal non instrumenté.
              </p>
            )}
          </>
        )}

        {!data && !error && !loading && (
          <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default SignupFunnelCard;
