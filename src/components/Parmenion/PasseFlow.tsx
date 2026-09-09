import { memo, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, ArrowRight, MapPin, FileText, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePaddleCheckout } from '@/hooks/usePaddleCheckout';
import {
  getPasseOrder,
  generatePasseContents,
  revisePasseContent,
  approvePasseContent,
  getPasseConnections,
  linkPasseTargets,
  savePasseGmbPreview,
  deployPasseOrder,
} from '@/lib/parmenion/parmenion.functions';

interface Props {
  orderId: string;
  passToken: string;
  priceId: string;
}

type Order = Record<string, unknown> & {
  id: string;
  step: number;
  paid_at: string | null;
  deployed_at: string | null;
  tracked_site_id: string | null;
  gmb_location_id: string | null;
  site_deploy_status: string | null;
  gmb_deploy_status: string | null;
};

type Content = {
  id: string;
  topic: string;
  title: string | null;
  draft_html: string | null;
  status: string;
  revision_count: number;
  published_url: string | null;
};

type Finding = { id: string; label: string; detail: string; impact: string };
type Fix = { findingId: string; label: string; before: string; after: string; scope: string };

const btn =
  'h-11 gap-2 border border-foreground bg-transparent px-5 text-foreground hover:bg-foreground hover:text-background';

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-3 text-lg font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-primary text-xs text-primary">
        {n}
      </span>
      {children}
    </h3>
  );
}

function PasseFlowComponent({ orderId, passToken, priceId }: Props): React.ReactElement {
  const { user } = useAuth();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [order, setOrder] = useState<Order | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [revision, setRevision] = useState<Record<string, string>>({});
  const [connections, setConnections] = useState<{
    cms: { id: string; platform: string; site_url: string | null; tracked_site_id: string | null }[];
    locations: { id: string; place_id: string | null; location_name: string | null; tracked_site_id: string | null }[];
  }>({ cms: [], locations: [] });
  const [gmbDescription, setGmbDescription] = useState('');

  const refresh = useCallback(async () => {
    const res = (await getPasseOrder({ data: { orderId } })) as {
      error?: string;
      order?: unknown;
      contents?: unknown[];
    };
    if (res.error || !res.order) return;
    setOrder(res.order as unknown as Order);
    setContents((res.contents ?? []) as unknown as Content[]);
  }, [orderId]);

  useEffect(() => {
    void refresh();
    void getPasseConnections().then((r) => setConnections(r as unknown as typeof connections));
  }, [refresh]);

  const findings = ((order?.['findings'] as Finding[] | null) ?? []).filter(Boolean);
  const fixes = ((order?.['fixes'] as Fix[] | null) ?? []).filter(Boolean);
  const score = (order?.['diagnostic'] as { score?: number } | null)?.score ?? null;
  const paid = Boolean(order?.paid_at);
  const allApproved = contents.length === 3 && contents.every((c) => c.status === 'approved' || c.status === 'published');

  const doGenerate = useCallback(async () => {
    setBusy('contents');
    try {
      const res = (await generatePasseContents({ data: { orderId } })) as { error?: string };
      if (res.error) toast.error('Génération impossible pour le moment.');
      await refresh();
    } finally {
      setBusy(null);
    }
  }, [orderId, refresh]);

  const doRevise = useCallback(
    async (contentId: string) => {
      const instruction = (revision[contentId] ?? '').trim();
      if (instruction.length < 3) return;
      setBusy(contentId);
      try {
        const res = (await revisePasseContent({ data: { contentId, instruction } })) as { error?: string };
        if (res.error) {
          toast.error(
            res.error === 'revision_limit'
              ? 'Deux corrections maximum par contenu.'
              : 'Correction impossible pour le moment.',
          );
        } else {
          setRevision((r) => ({ ...r, [contentId]: '' }));
        }
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [revision, refresh],
  );

  const doApprove = useCallback(
    async (contentId: string) => {
      setBusy(contentId);
      try {
        await approvePasseContent({ data: { contentId } });
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const doLink = useCallback(
    async (trackedSiteId?: string, gmbLocationId?: string) => {
      setBusy('link');
      try {
        await linkPasseTargets({
          data: {
            orderId,
            ...(trackedSiteId ? { trackedSiteId } : {}),
            ...(gmbLocationId ? { gmbLocationId } : {}),
          },
        });
        await refresh();
      } finally {
        setBusy(null);
      }
    },
    [orderId, refresh],
  );

  const doSavePreview = useCallback(async () => {
    if (gmbDescription.trim().length < 20) {
      toast.info('Rédigez au moins 20 caractères de description.');
      return;
    }
    setBusy('gmb');
    try {
      await savePasseGmbPreview({ data: { orderId, fields: { description: gmbDescription.trim() } } });
      toast.success('Aperçu de la fiche validé.');
      await refresh();
    } finally {
      setBusy(null);
    }
  }, [orderId, gmbDescription, refresh]);

  const doPay = useCallback(async () => {
    if (!user) return;
    await openCheckout({
      priceId,
      customerEmail: user.email,
      customData: { kind: 'parmenion_pass', orderId, userId: user.id, passToken },
      successUrl: `${window.location.origin}/audit-geo-seo?checkout=success&order=${orderId}`,
    });
  }, [user, openCheckout, priceId, orderId, passToken]);

  const doDeploy = useCallback(async () => {
    setBusy('deploy');
    try {
      const res = (await deployPasseOrder({ data: { orderId } })) as { error?: string; deployed?: boolean };
      if (res.error) {
        toast.error(res.error === 'not_paid' ? 'Paiement non confirmé.' : 'Déploiement impossible.');
      } else if (res.deployed) {
        toast.success('Déploiement terminé.');
      } else {
        toast.warning('Déploiement partiel — voir le compte rendu.');
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }, [orderId, refresh]);

  if (!order) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre commande…
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Étape 3 — diagnostic détaillé */}
      <section className="rounded-lg border border-border p-6">
        <StepTitle n={3}>Votre diagnostic détaillé</StepTitle>
        {score !== null && (
          <p className="mb-4 text-sm text-muted-foreground">
            Note de visibilité actuelle : <span className="font-semibold text-foreground">{score}/100</span>
          </p>
        )}
        <ul className="space-y-3">
          {findings.map((f) => (
            <li key={f.id} className="rounded border border-border p-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-medium">{f.label}</span>
                <span className="text-xs uppercase tracking-wide text-primary">{f.impact}</span>
              </div>
              <p className="text-sm text-muted-foreground">{f.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Étape 4 — correctifs proposés */}
      <section className="rounded-lg border border-border p-6">
        <StepTitle n={4}>Les correctifs inclus dans la passe</StepTitle>
        <ul className="space-y-2 text-sm">
          {fixes.map((fx) => (
            <li key={fx.findingId} className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium">{fx.label}</span> — {fx.after}
                {fx.scope === 'recommandation' && (
                  <span className="text-muted-foreground"> (recommandation, hors périmètre)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Étape 5 — les 3 contenus */}
      <section className="rounded-lg border border-border p-6">
        <StepTitle n={5}>Vos 3 contenus, à relire et valider</StepTitle>
        {contents.length === 0 ? (
          <Button onClick={doGenerate} disabled={busy === 'contents'} className={btn}>
            {busy === 'contents' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Rédiger mes 3 contenus
          </Button>
        ) : (
          <div className="space-y-6">
            {contents.map((c) => (
              <article key={c.id} className="rounded border border-border p-4">
                <h4 className="mb-2 font-medium">{c.title ?? c.topic}</h4>
                <div
                  className="prose prose-sm max-h-72 max-w-none overflow-y-auto dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: c.draft_html ?? '' }}
                />
                {c.status === 'approved' || c.status === 'published' ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-primary">
                    <Check className="h-4 w-4" /> Validé
                    {c.published_url && (
                      <a href={c.published_url} className="underline" target="_blank" rel="noreferrer">
                        voir la page publiée
                      </a>
                    )}
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      value={revision[c.id] ?? ''}
                      onChange={(e) => setRevision((r) => ({ ...r, [c.id]: e.target.value }))}
                      placeholder="Ce que vous souhaitez corriger (2 corrections maximum)"
                      className="min-h-20"
                    />
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => void doRevise(c.id)}
                        disabled={busy === c.id || c.revision_count >= 2}
                        className={btn}
                      >
                        {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Demander une correction ({2 - c.revision_count} restante(s))
                      </Button>
                      <Button onClick={() => void doApprove(c.id)} disabled={busy === c.id} className={btn}>
                        Valider ce contenu
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Étape 6 — connexions */}
      <section className="rounded-lg border border-border p-6">
        <StepTitle n={6}>Connexion de votre site et de votre fiche Google Maps</StepTitle>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium">Votre site</p>
            {connections.cms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun site connecté.{' '}
                <a href="/app/console" className="underline">
                  Connecter mon site
                </a>
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.cms.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm">
                    <span>{c.site_url ?? c.platform}</span>
                    {order.tracked_site_id === c.tracked_site_id ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Button
                        onClick={() => void doLink(c.tracked_site_id ?? undefined)}
                        disabled={busy === 'link' || !c.tracked_site_id}
                        className="h-8 border border-foreground bg-transparent px-3 text-xs text-foreground hover:bg-foreground hover:text-background"
                      >
                        Choisir
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Votre fiche Google Maps</p>
            {connections.locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune fiche connectée.{' '}
                <a href="/app/console" className="underline">
                  Connecter Google Business
                </a>{' '}
                — si vous n'avez pas encore de fiche, nous vous guidons pour la créer.
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.locations.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 rounded border border-border p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {l.location_name ?? l.place_id}
                    </span>
                    {order.gmb_location_id === l.place_id ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Button
                        onClick={() => void doLink(l.tracked_site_id ?? undefined, l.place_id ?? undefined)}
                        disabled={busy === 'link' || !l.place_id}
                        className="h-8 border border-foreground bg-transparent px-3 text-xs text-foreground hover:bg-foreground hover:text-background"
                      >
                        Choisir
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 space-y-2">
              <Textarea
                value={gmbDescription}
                onChange={(e) => setGmbDescription(e.target.value)}
                placeholder="Description qui sera publiée sur votre fiche (aperçu à valider avant toute écriture)"
                className="min-h-24"
              />
              <Button onClick={doSavePreview} disabled={busy === 'gmb'} className={btn}>
                {busy === 'gmb' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Valider l'aperçu de ma fiche
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Étape 7 — récapitulatif et paiement */}
      <section className="rounded-lg border-2 border-foreground p-6">
        <StepTitle n={7}>Récapitulatif et paiement</StepTitle>
        <ul className="mb-6 space-y-2 text-sm">
          <li>{findings.length} problèmes relevés, {fixes.length} correctifs inclus</li>
          <li>{contents.filter((c) => c.status === 'approved' || c.status === 'published').length}/3 contenus validés</li>
          <li>Site {order.tracked_site_id ? 'connecté' : 'non connecté'} · Fiche {order.gmb_location_id ? 'connectée' : 'non connectée'}</li>
        </ul>
        {paid ? (
          <p className="flex items-center gap-2 text-sm text-primary">
            <Check className="h-4 w-4" /> Paiement confirmé
          </p>
        ) : (
          <>
            <Button onClick={doPay} disabled={!allApproved || checkoutLoading} className={btn}>
              {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Payer 59 € TTC
              <ArrowRight className="h-4 w-4" />
            </Button>
            {!allApproved && (
              <p className="mt-3 text-sm text-muted-foreground">
                Validez d'abord vos 3 contenus. Rien n'est déployé avant paiement.
              </p>
            )}
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4" /> Remboursement intégral tant qu'aucun déploiement n'a eu lieu
            </p>
          </>
        )}
      </section>

      {/* Étape 8 / 9 — déploiement et compte rendu */}
      {paid && (
        <section className="rounded-lg border border-border p-6">
          <StepTitle n={8}>Déploiement et compte rendu</StepTitle>
          {order.deployed_at ? (
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-primary">
                <Check className="h-4 w-4" /> Déployé le {new Date(order.deployed_at).toLocaleDateString('fr-FR')}
              </p>
              <p className="text-muted-foreground">
                Site : {order.site_deploy_status} · Fiche Google Maps : {order.gmb_deploy_status}
              </p>
            </div>
          ) : (
            <Button onClick={doDeploy} disabled={busy === 'deploy'} className={btn}>
              {busy === 'deploy' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lancer le déploiement
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

export default memo(PasseFlowComponent);
