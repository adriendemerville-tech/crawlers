import { memo, useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/router-compat';
import { useAuth } from '@/contexts/AuthContext';

import { createParmenionOrder, runFreePasseDiagnostic } from '@/lib/parmenion/parmenion.functions';
import { ArrowRight, Check, Shield, Clock, FileText, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PasseFlow = lazy(() => import('@/components/Parmenion/PasseFlow'));


const URL = 'https://crawlers.fr/audit-geo-seo';

const INCLUDED = [
  {
    icon: FileText,
    title: 'Audit de votre site',
    description: '6 à 10 correctifs prioritaires sur titres, descriptions, balisage, vitesse et maillage.',
  },
  {
    icon: FileText,
    title: '3 pages de contenu',
    description: 'Rédigées sur les sujets qui rapportent des clients, relues et validées par vous.',
  },
  {
    icon: MapPin,
    title: 'Fiche Google Maps',
    description: 'Description, catégories, horaires, site web et une publication optimisée.',
  },
];

const FAQ = [
  ['Que contient exactement la passe Parmenion ?', 'Un audit technique et éditorial de votre site, la rédaction de 3 pages de contenu, l\'optimisation de votre fiche Google Maps, et un compte rendu avant / après.'],
  ['Combien de temps ça prend ?', 'L\'audit est gratuit et immédiat. Une fois la passe payée, le déploiement complet est réalisé sous 72 heures ouvrées.'],
  ['Puis-je annuler et me faire rembourser ?', 'Oui. Vous êtes remboursé intégralement tant qu\'aucun correctif n\'a été déployé sur votre site ou votre fiche Google Maps.'],
  ['Que se passe-t-il si je n\'ai pas de fiche Google Maps ?', 'Nous vous guidons pour la créer. C\'est inclus dans la passe.'],
  ['Les 3 contenus sont-ils écrits par une IA ?', 'Les premiers brouillons sont produits par notre moteur éditorial, puis relus, ajustés et validés par vos soins avant publication.'],
];

type Teaser = {
  host: string;
  score: number;
  unreachable: boolean;
  total: number;
  teaser: { id: string; label: string; impact: string }[];
};

function ParmenionLandingComponent(): React.ReactElement {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [session, setSession] = useState<{ orderId: string; passToken: string; priceId: string } | null>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!url.trim()) {
      focusInput();
      return;
    }
    setAnalyzing(true);
    try {
      const res = await runFreePasseDiagnostic({ data: { url: url.trim() } });
      if ('error' in res) {
        toast.error(res.message ?? 'Analyse impossible.');
        return;
      }
      setTeaser({
        host: res.host,
        score: res.score,
        unreachable: Boolean(res.unreachable),
        total: res.total,
        teaser: res.teaser,
      });
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    } catch {
      toast.error('Analyse impossible pour le moment.');
    } finally {
      setAnalyzing(false);
    }
  }, [url, focusInput]);

  const handleOrder = useCallback(async () => {
    if (!url.trim()) {
      focusInput();
      return;
    }
    if (!user) {
      toast.info('Créez votre compte pour voir le détail de vos correctifs');
      window.location.href = `/signup?redirect=${encodeURIComponent(`/audit-geo-seo?url=${encodeURIComponent(url)}`)}`;
      return;
    }
    setOrdering(true);
    try {
      const result = await createParmenionOrder({ data: { url: url.trim() } });
      if ('error' in result || !result.orderId) {
        toast.error('Impossible de démarrer votre passe. Réessayez.');
        return;
      }
      setSession({ orderId: result.orderId, passToken: result.passToken, priceId: result.priceId });
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    } catch {
      toast.error('Impossible de démarrer votre passe.');
    } finally {
      setOrdering(false);
    }
  }, [url, user, focusInput]);

  // Arrivée depuis un audit Marina déjà réalisé : on saute l'analyse gratuite
  // et on démarre la passe directement sur les constats du Workbench.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get('url');
    if (!incoming) return;
    autoStarted.current = true;
    setUrl(incoming);
    if (params.get('from') === 'marina' && user) {
      void (async () => {
        setOrdering(true);
        try {
          const result = await createParmenionOrder({ data: { url: incoming, reuseAudit: true } });
          if ('error' in result || !result.orderId) return;
          setSession({ orderId: result.orderId, passToken: result.passToken, priceId: result.priceId });
          requestAnimationFrame(() =>
            resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          );
        } finally {
          setOrdering(false);
        }
      })();
    }
  }, [user]);


  return (
    <>
      <Header />
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Passe unique à prix fixe
            </div>
            <h1 className="mb-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
              Faites corriger votre visibilité en ligne, une fois, à prix fixe
            </h1>
            <p className="citable-passage mb-8 max-w-2xl text-lg text-muted-foreground">
              Parmenion audit votre site, rédige 3 pages de contenu et optimise votre fiche Google Maps. Vous relisez et validez chaque élément avant le moindre déploiement.
            </p>

            {/* Direct answer block */}
            <div className="mb-10 rounded-lg border border-border bg-card p-6">
              <h3 className="mb-3 text-lg font-semibold">Qu'est-ce que Parmenion et combien ça coûte ?</h3>
              <p className="citable-passage text-muted-foreground">
                Parmenion est une passe unique proposée par Crawlers.fr à 59 € TTC. Elle comprend un audit de site, la rédaction de 3 contenus, l'optimisation de la fiche Google Maps et un compte rendu avant / après. Le délai annoncé est de 72 heures après paiement, et le remboursement est intégral tant qu'aucun déploiement n'a eu lieu.
              </p>
            </div>

            {/* URL input */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                ref={inputRef}
                type="url"
                placeholder="https://votre-site.fr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 flex-1 border-border bg-background text-foreground placeholder:text-muted-foreground"
              />
              <Button
                onClick={startAnalysis}
                disabled={analyzing || !url.trim()}
                className="h-12 gap-2 border border-foreground bg-transparent px-6 text-foreground hover:bg-foreground hover:text-background"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lancer mon analyse gratuite'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Analyse gratuite, sans carte bancaire. L'inscription n'est requise que pour débloquer le détail des correctifs.
            </p>
          </div>
        </section>

        {/* Résultat de l'analyse gratuite, puis parcours complet */}
        {(teaser || session) && (
          <section ref={resultRef} className="border-b border-border">
            <div className="mx-auto max-w-5xl px-4 py-12">
              {session ? (
                <Suspense
                  fallback={
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Préparation de votre passe…
                    </div>
                  }
                >
                  <PasseFlow
                    orderId={session.orderId}
                    passToken={session.passToken}
                    priceId={session.priceId}
                  />
                </Suspense>
              ) : teaser ? (
                <div className="rounded-lg border-2 border-foreground p-6">
                  <h2 className="mb-2 text-xl font-bold">
                    {teaser.unreachable
                      ? `${teaser.host} n'a pas pu être analysé`
                      : `Résultat pour ${teaser.host}`}
                  </h2>
                  {!teaser.unreachable && (
                    <p className="mb-4 text-sm text-muted-foreground">
                      Note de visibilité : <span className="font-semibold text-foreground">{teaser.score}/100</span> ·{' '}
                      {teaser.total} problèmes corrigeables détectés
                    </p>
                  )}
                  <ul className="mb-6 space-y-2 text-sm">
                    {teaser.teaser.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 rounded border border-border p-3">
                        <span>{t.label}</span>
                        <span className="text-xs uppercase tracking-wide text-primary">{t.impact}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={handleOrder}
                    disabled={ordering}
                    className="h-12 gap-2 border border-foreground bg-transparent px-6 text-foreground hover:bg-foreground hover:text-background"
                  >
                    {ordering ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Voir le détail et mes correctifs'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Gratuit. Vous ne payez qu'après avoir relu et validé vos 3 contenus.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        )}


        {/* What's included */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Ce qui est corrigé en une seule passe</h2>
            <p className="citable-passage mb-10 max-w-3xl text-muted-foreground">
              Une passe Parmenion corrige trois familles de problèmes de référencement local et de visibilité IA : les erreurs techniques et sémantiques de vos pages (titres, métadonnées, hiérarchie de titres, données structurées), le manque de contenu répondant aux questions réelles de vos clients, et une fiche Google Maps incomplète ou non optimisée. Le périmètre est volontairement borné : un site, une fiche, trois contenus.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              {INCLUDED.map((item) => (
                <div key={item.title} className="rounded-lg border border-border p-6">
                  <item.icon className="mb-4 h-6 w-6 text-primary" />
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Price card */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-xl rounded-lg border-2 border-foreground bg-card p-8 text-center">
              <h2 className="mb-2 text-2xl font-bold">Passe Parmenion</h2>
              <p className="mb-6 text-muted-foreground">Paiement unique. Aucun abonnement caché.</p>
              <div className="mb-6 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold">59 €</span>
                <span className="text-muted-foreground">TTC</span>
              </div>
              <ul className="mb-8 space-y-3 text-left text-sm">
                {[
                  'Audit site + fiche Google Maps',
                  '3 contenus rédigés et validés',
                  'Optimisation Google Maps',
                  'Compte rendu avant / après',
                  'Délai : 72 h après paiement',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={handleOrder}
                disabled={ordering}
                className="h-12 w-full gap-2 border border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background"
              >
                {ordering ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Démarrer ma passe — 59 € TTC'}

                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-4 w-4" />
                Remboursement intégral avant déploiement
              </div>
            </div>
          </div>
        </section>

        {/* Guarantee / trust */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Rien n'est déployé avant votre validation</h2>
            <p className="citable-passage mb-10 max-w-3xl text-muted-foreground">
              Aucune modification n'est publiée sur votre site ou votre fiche Google Maps avant votre accord écrit et le paiement des 59 € TTC. Chaque déploiement est journalisé et réversible : vous savez quoi a été changé, quand, et vous pouvez revenir à l'état précédent. Tant que rien n'est publié, le remboursement est intégral.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex gap-4">
                <Clock className="h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h3 className="mb-1 font-semibold">Délai maîtrisé</h3>
                  <p className="text-sm text-muted-foreground">Vous recevez un calendrier clair. Le déploiement n'intervient qu'après votre validation ferme.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Shield className="h-6 w-6 shrink-0 text-primary" />
                <div>
                  <h3 className="mb-1 font-semibold">Garantie satisfait ou remboursé</h3>
                  <p className="text-sm text-muted-foreground">Tant qu'aucune modification n'est publiée sur votre site ou votre fiche, vous pouvez demander le remboursement intégral.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
            <h2 className="mb-10 text-2xl font-bold sm:text-3xl">Questions fréquentes</h2>
            <div className="space-y-4">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-lg border border-border p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                    {q}
                    <span className="ml-4 transition group-open:rotate-180">▼</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl">Prêt à corriger votre visibilité ?</h2>
            <p className="mb-8 text-muted-foreground">Lancez l'analyse gratuite. Vous ne payez que lorsque vous décidez de déployer les correctifs.</p>
            <Button
              onClick={focusInput}
              className="h-12 gap-2 border border-foreground bg-transparent px-8 text-foreground hover:bg-foreground hover:text-background"
            >
              Lancer mon analyse gratuite
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export const parmenionSeo = {
  URL,
  FAQ,
};

export default memo(ParmenionLandingComponent);
