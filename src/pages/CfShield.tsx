/**
 * CfShield — Wizard d'activation du Bouclier Cloudflare AI Bots
 *
 * Pédagogique en 3 étapes : Choix du site → Mode (Auto / Manuel) → Vérification.
 * Le mode Auto déploie le Worker via cf-deploy-shield (token CF requis).
 * Le mode Manuel fournit le snippet à coller dans le dashboard CF.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Copy,
  CheckCircle2,
  Loader2,
  Globe,
  Zap,
  Hand,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';

interface TrackedSite {
  id: string;
  domain: string;
}

type Step = 'site' | 'mode' | 'verify';
type Mode = 'auto' | 'manual';

export default function CfShield() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [siteId, setSiteId] = useState<string>(params.get('site') || '');
  const [step, setStep] = useState<Step>('site');
  const [mode, setMode] = useState<Mode>('auto');
  const [loading, setLoading] = useState(true);

  // init payload
  const [initData, setInitData] = useState<{
    config_id?: string;
    ingest_url?: string;
    worker_script?: string;
    sample_rate?: number;
  } | null>(null);
  const [ingestionSecret, setIngestionSecret] = useState('');

  // Auto mode credentials
  const [cfToken, setCfToken] = useState('');
  const [cfAccountId, setCfAccountId] = useState('');
  const [cfZoneId, setCfZoneId] = useState('');
  const [cfWorkerName, setCfWorkerName] = useState('');
  const [deploying, setDeploying] = useState(false);

  // Verification
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; hits: number } | null>(null);

  const currentSite = useMemo(() => sites.find(s => s.id === siteId), [sites, siteId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth?redirect=/cf-shield');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('tracked_sites')
        .select('id, domain')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setSites((data || []) as TrackedSite[]);
      if (!siteId && data && data.length > 0) setSiteId(data[0].id);
      setLoading(false);
    })();
  }, [user, authLoading, navigate, siteId]);

  // ── Step transitions ────────────────────────────────────────────
  const handleStartSetup = async () => {
    if (!siteId) {
      toast.error('Sélectionnez un site avant de continuer.');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('cf-deploy-shield', {
        body: { action: 'init', tracked_site_id: siteId, mode },
      });
      if (error) throw error;
      setInitData(data);
      // Extract the secret from the worker_script
      const match = (data.worker_script || '').match(/SECRET = "(.+?)"/);
      if (match) setIngestionSecret(match[1]);
      if (currentSite) {
        setCfWorkerName(`crawlers-shield-${currentSite.domain.replace(/[^a-z0-9-]/gi, '-')}`);
      }
      setStep('mode');
    } catch (e) {
      toast.error(`Échec de l'initialisation : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleAutoDeploy = async () => {
    if (!cfToken || !cfAccountId || !cfZoneId) {
      toast.error('Token, Account ID et Zone ID sont requis.');
      return;
    }
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke('cf-deploy-shield', {
        body: {
          action: 'deploy',
          tracked_site_id: siteId,
          cf_token: cfToken,
          cf_account_id: cfAccountId,
          cf_zone_id: cfZoneId,
          cf_worker_name: cfWorkerName,
        },
      });
      if (error) throw error;
      toast.success('Worker déployé. Vérification en cours…');
      setStep('verify');
      // Trigger immediate verify
      setTimeout(() => handleVerify(), 1500);
    } catch (e) {
      toast.error(`Déploiement impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDeploying(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('cf-deploy-shield', {
        body: { action: 'verify', tracked_site_id: siteId },
      });
      if (error) throw error;
      setVerifyResult({ verified: !!data.verified, hits: data.hits_last_10min || 0 });
      if (data.verified) toast.success('Hits détectés — bouclier opérationnel.');
      else toast.message('Aucun hit détecté pour le moment. Patientez quelques minutes.');
    } catch (e) {
      toast.error(`Vérification impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVerifying(false);
    }
  };

  const copy = (text: string, label = 'Copié') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <Helmet>
        <title>Activer le Bouclier Cloudflare AI Bots — Crawlers</title>
        <meta
          name="description"
          content="Déployez le Worker Cloudflare qui alimente vos KPIs GEO en hits bots IA et trafic référent."
        />
      </Helmet>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-muted-foreground"
            onClick={() => navigate('/app/console')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Console
          </Button>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Bouclier Cloudflare AI Bots
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Déployez un Worker léger qui journalise chaque visite (bot ou humain)
            et alimente vos KPIs GEO en temps réel. Latence ajoutée : zéro.
          </p>
        </div>
      </div>

      {/* Pédagogie : flux de données */}
      <Card className="mb-6 border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Comment ça fonctionne</CardTitle>
          <CardDescription>
            Le Worker s'intercale entre le visiteur et votre site. Il transmet la
            requête sans la modifier, puis envoie les métadonnées (UA, IP, path)
            à Crawlers en arrière-plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-5 sm:items-center">
            <FlowStep icon={<Globe className="h-4 w-4" />} label="Bot IA / Humain" />
            <FlowArrow />
            <FlowStep icon={<ShieldCheck className="h-4 w-4" />} label="Worker CF" highlight />
            <FlowArrow />
            <FlowStep icon={<Zap className="h-4 w-4" />} label="Crawlers Ingest" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Échantillonnage humain : <Badge variant="secondary">{((initData?.sample_rate ?? 0.001) * 100).toFixed(2)}%</Badge>
            {' '}— ajusté selon votre plan pour limiter le volume.
          </p>
        </CardContent>
      </Card>

      {/* Stepper */}
      <div className="mb-6 flex items-center justify-between gap-2 text-sm">
        <StepBadge n={1} label="Site" active={step === 'site'} done={step !== 'site'} />
        <StepDivider done={step !== 'site'} />
        <StepBadge n={2} label="Déploiement" active={step === 'mode'} done={step === 'verify'} />
        <StepDivider done={step === 'verify'} />
        <StepBadge n={3} label="Vérification" active={step === 'verify'} done={false} />
      </div>

      {/* STEP 1 — Site */}
      {step === 'site' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sur quel site déployer ?</CardTitle>
            <CardDescription>Un bouclier par domaine. Vous pourrez en ajouter d'autres ensuite.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sites.length === 0 ? (
              <Alert>
                <AlertTitle>Aucun site suivi</AlertTitle>
                <AlertDescription>
                  Ajoutez d'abord un site dans Console → Mes Sites avant de déployer un bouclier.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-2">
                {sites.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSiteId(s.id)}
                    className={`flex items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                      siteId === s.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-mono text-sm">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      {s.domain}
                    </span>
                    {siteId === s.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleStartSetup} disabled={!siteId}>
                Continuer <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2 — Mode */}
      {step === 'mode' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Déploiement sur <span className="font-mono">{currentSite?.domain}</span>
            </CardTitle>
            <CardDescription>Choisissez le mode qui correspond à votre niveau d'aisance avec Cloudflare.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auto">
                  <Zap className="mr-1.5 h-4 w-4" /> Automatique
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <Hand className="mr-1.5 h-4 w-4" /> Manuel (snippet)
                </TabsTrigger>
              </TabsList>

              {/* AUTO */}
              <TabsContent value="auto" className="mt-4 space-y-4">
                <Alert>
                  <AlertTitle>Vous fournissez : 1 token API CF + 2 identifiants</AlertTitle>
                  <AlertDescription className="mt-2 space-y-1 text-xs">
                    <p>
                      Créez un token sur{' '}
                      <a
                        href="https://dash.cloudflare.com/profile/api-tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        dash.cloudflare.com/profile/api-tokens
                        <ExternalLink className="ml-1 inline h-3 w-3" />
                      </a>{' '}
                      avec les permissions <strong>Workers Scripts:Edit</strong> + <strong>Zone:Read</strong>.
                    </p>
                    <p>Account ID et Zone ID se trouvent dans la sidebar droite du dashboard CF.</p>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="cf-token">Token API Cloudflare</Label>
                    <Input
                      id="cf-token"
                      type="password"
                      value={cfToken}
                      onChange={(e) => setCfToken(e.target.value)}
                      placeholder="••••••••••••"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cf-worker">Nom du Worker</Label>
                    <Input
                      id="cf-worker"
                      value={cfWorkerName}
                      onChange={(e) => setCfWorkerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cf-account">Account ID</Label>
                    <Input
                      id="cf-account"
                      value={cfAccountId}
                      onChange={(e) => setCfAccountId(e.target.value)}
                      placeholder="abc123…"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cf-zone">Zone ID (du domaine)</Label>
                    <Input
                      id="cf-zone"
                      value={cfZoneId}
                      onChange={(e) => setCfZoneId(e.target.value)}
                      placeholder="def456…"
                    />
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep('site')}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Retour
                  </Button>
                  <Button onClick={handleAutoDeploy} disabled={deploying || !cfToken}>
                    {deploying ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Déploiement…
                      </>
                    ) : (
                      <>
                        Déployer le Worker <ArrowRight className="ml-1 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* MANUAL */}
              <TabsContent value="manual" className="mt-4 space-y-4">
                <Alert>
                  <AlertTitle>4 étapes dans votre dashboard Cloudflare</AlertTitle>
                  <AlertDescription className="mt-2 text-xs">
                    Aucun token n'est requis. Vous gardez la main complète.
                  </AlertDescription>
                </Alert>

                <ol className="space-y-3 text-sm">
                  <li className="rounded-md border p-3">
                    <p className="font-medium">1. Créer le Worker</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dashboard CF → <em>Workers & Pages</em> → <em>Create Worker</em> → nommez-le
                      {' '}<span className="font-mono">{cfWorkerName || 'crawlers-shield'}</span>.
                    </p>
                  </li>
                  <li className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">2. Coller le code du Worker</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copy(initData?.worker_script || '', 'Code Worker copié')}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copier
                      </Button>
                    </div>
                    <ScrollArea className="mt-2 h-40 w-full rounded border bg-muted/30">
                      <pre className="p-3 text-[11px] leading-tight font-mono">{initData?.worker_script}</pre>
                    </ScrollArea>
                  </li>
                  <li className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">3. Variable d'environnement</p>
                      <Button size="sm" variant="outline" onClick={() => copy(ingestionSecret, 'Secret copié')}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copier le secret
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Settings → Variables → <span className="font-mono">CRAWLERS_SECRET</span> =
                    </p>
                    <code className="mt-1 block break-all rounded bg-muted/40 p-2 text-[11px]">
                      {ingestionSecret}
                    </code>
                  </li>
                  <li className="rounded-md border p-3">
                    <p className="font-medium">4. Route</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Triggers → Add Route → <span className="font-mono">{currentSite?.domain}/*</span> → Deploy.
                    </p>
                  </li>
                </ol>

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep('site')}>
                    <ArrowLeft className="mr-1 h-4 w-4" /> Retour
                  </Button>
                  <Button onClick={() => setStep('verify')}>
                    J'ai déployé — vérifier <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 — Verify */}
      {step === 'verify' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vérification du flux</CardTitle>
            <CardDescription>
              Crawlers attend un premier hit pour confirmer que le Worker transmet bien les données.
              Cela peut prendre quelques minutes selon le trafic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="text-sm font-medium">État du flux (10 dernières minutes)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {verifyResult
                    ? verifyResult.verified
                      ? `${verifyResult.hits} hit(s) reçu(s) — le bouclier est opérationnel.`
                      : 'Aucun hit pour le moment. Visitez votre site ou attendez le passage d\'un bot.'
                    : 'Cliquez sur Vérifier pour interroger le pipeline.'}
                </p>
              </div>
              <Button onClick={handleVerify} disabled={verifying} variant="outline">
                {verifying ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Vérification…
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-1.5 h-4 w-4" /> Vérifier
                  </>
                )}
              </Button>
            </div>

            {verifyResult?.verified && (
              <Alert className="border-success/40 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle>Bouclier actif</AlertTitle>
                <AlertDescription>
                  Vos KPIs GEO (Crawl, Attribution, CTR référent, Mix LLM) vont maintenant se peupler.
                  Le premier snapshot complet sera calculé dans les 24 h.
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep('mode')}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Modifier la config
              </Button>
              <Button onClick={() => navigate('/app/console?tab=geo')}>
                Voir mes KPIs GEO <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── helpers UI ──────────────────────────────────────────────────────
function FlowStep({ icon, label, highlight }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-md border p-3 text-center ${
        highlight ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <span className={highlight ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return <div className="h-px w-full bg-border sm:h-px" aria-hidden />;
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
          done
            ? 'border-primary bg-primary text-primary-foreground'
            : active
              ? 'border-primary text-primary'
              : 'border-border text-muted-foreground'
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={active || done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function StepDivider({ done }: { done: boolean }) {
  return <div className={`mx-2 h-px flex-1 ${done ? 'bg-primary' : 'bg-border'}`} aria-hidden />;
}
