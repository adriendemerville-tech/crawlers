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
const AiAnswerDemo = lazy(() => import('@/components/Parmenion/AiAnswerDemo'));
const SectorMarquee = lazy(() => import('@/components/Parmenion/SectorMarquee'));
const QuestionsMarquee = lazy(() => import('@/components/Parmenion/QuestionsMarquee'));
const AuditReportPreview = lazy(() => import('@/components/Parmenion/AuditReportPreview'));

const STEPS = [
  {
    title: 'On lit votre site comme un moteur IA',
    description:
      'Crawl du site, extraction du contenu réellement servi, détection de votre activité, de votre zone et de vos concurrents directs.',
    chips: ['Activité détectée', 'Zone locale', 'Concurrents'],
  },
  {
    title: 'On mesure ce qui bloque',
    description:
      'Titres, métadonnées, hiérarchie, données structurées, vitesse, maillage, citabilité des passages : chaque constat est chiffré et priorisé.',
    chips: ['JSON-LD', 'Core Web Vitals', 'Citabilité'],
  },
  {
    title: 'On rédige et on corrige',
    description:
      'Trois pages de contenu sur les sujets qui rapportent des clients, plus les correctifs techniques et votre fiche Google Maps.',
    chips: ['3 contenus', 'Correctifs', 'Google Maps'],
  },
  {
    title: 'Vous validez, puis on déploie',
    description:
      'Rien n\'est publié avant votre accord. Chaque déploiement est journalisé et réversible, avec un compte rendu avant / après.',
    chips: ['Validation', 'Journalisé', 'Réversible'],
  },
];


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


  // Mode clair forcé pour cette landing (audience non-tech), même si le site est en mode sombre.
  // Les variables sont passées en inline : la cascade de thème du site repasserait sinon par-dessus.
  const lightThemeVars = {
    '--background': '43 10% 96%',
    '--foreground': '222 47% 11%',
    '--card': '0 0% 100%',
    '--card-foreground': '222 47% 11%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '222 47% 11%',
    '--secondary': '210 40% 96%',
    '--secondary-foreground': '222 47% 11%',
    '--muted': '210 40% 96%',
    '--muted-foreground': '215 20% 40%',
    '--accent': '210 40% 96%',
    '--accent-foreground': '222 47% 11%',
    '--border': '214 32% 91%',
    '--input': '214 32% 91%',
    '--brand-violet': '262 83% 58%',
    '--brand-violet-muted': '262 72% 96%',
    '--brand-gold': '45 93% 47%',
    '--brand-gold-muted': '45 90% 95%',
  } as React.CSSProperties;

  return (
    <div className="light-scope" style={lightThemeVars}>
      <Header />
      <main className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 -right-32 h-80 w-80 rounded-full bg-brand-violet/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-brand-gold/10 blur-3xl"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-violet/40 px-3 py-1 text-xs font-medium text-brand-violet">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-violet" />
                Passe unique · 59 € TTC · sans abonnement
              </div>
              <h1 className="mb-6 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Faites venir vos clients depuis{' '}
                <span className="text-brand-violet">les moteurs IA</span> et Google Maps
              </h1>
              <p className="citable-passage mb-8 max-w-xl text-lg text-muted-foreground">
                Crawlers audite votre site, rédige 3 pages de contenu et optimise votre fiche Google Maps. Vous relisez et validez chaque élément avant le moindre déploiement.
              </p>

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
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Analyser mon site gratuitement'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {[
                  'Analyse gratuite et immédiate, sans carte bancaire.',
                  'Remboursement intégral tant que rien n\'est déployé.',
                  'Déploiement complet sous 72 heures ouvrées après paiement.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Suspense fallback={<div className="h-72 rounded-3xl border border-border bg-card" />}>
              <AiAnswerDemo />
            </Suspense>
          </div>
        </section>

        {/* Secteurs */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <p className="mb-5 text-center text-sm font-medium tracking-wide text-muted-foreground">
              Conçu pour les TPE, PME et commerces locaux, dans tous les secteurs
            </p>
            <Suspense fallback={<div className="h-12" />}>
              <SectorMarquee />
            </Suspense>
          </div>
        </section>

        {/* Questions que vos clients posent déjà aux IA */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
            <h2 className="mb-3 text-center font-display text-2xl font-bold sm:text-3xl">
              Vos clients posent déjà ces questions <span className="text-brand-violet">aux IA</span>
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
              Chaque jour, des clients décrivent leur besoin à ChatGPT ou à Google. Si votre site ne répond pas à ces questions, une autre entreprise est recommandée à votre place.
            </p>
            <Suspense fallback={<div className="h-28" />}>
              <QuestionsMarquee />
            </Suspense>
          </div>
        </section>

        {/* Réponse directe */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">
              Qu'est-ce que la <span className="text-brand-violet">passe Crawlers</span> et combien ça coûte ?
            </h2>
            <p className="citable-passage text-muted-foreground">
              La passe Crawlers est une prestation unique à 59 € TTC. Elle comprend un audit de site, la rédaction de 3 contenus, l'optimisation de la fiche Google Maps et un compte rendu avant / après. Le délai annoncé est de 72 heures après paiement, et le remboursement est intégral tant qu'aucun déploiement n'a eu lieu.
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
                <div className="rounded-3xl border-2 border-foreground bg-card p-8 shadow-sm">
                  <h2 className="mb-2 font-display text-xl font-bold">
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
                        <span className="text-xs uppercase tracking-wide text-brand-gold">{t.impact}</span>
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


        {/* Comment ça marche */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <p className="mb-3 text-sm font-medium uppercase tracking-wider text-brand-gold">
              Comment ça marche
            </p>
            <h2 className="mb-12 max-w-2xl font-display text-3xl font-bold sm:text-4xl">
              <span className="text-brand-violet">Quatre étapes</span>, de l'analyse au déploiement validé
            </h2>
            <ol className="grid list-none gap-8 sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-3xl border border-border bg-card p-8 shadow-sm">
                  <span className="mb-4 block text-sm font-semibold text-brand-violet">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">{s.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {s.chips.map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What's included */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">Ce qui est corrigé <span className="text-brand-violet">en une seule passe</span></h2>
            <p className="citable-passage mb-10 max-w-3xl text-muted-foreground">
              Une passe Crawlers corrige trois familles de problèmes de référencement local et de visibilité IA : les erreurs techniques et sémantiques de vos pages (titres, métadonnées, hiérarchie de titres, données structurées), le manque de contenu répondant aux questions réelles de vos clients, et une fiche Google Maps incomplète ou non optimisée. Le périmètre est volontairement borné : un site, une fiche, trois contenus.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              {INCLUDED.map((item) => (
                <div key={item.title} className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                  <item.icon className="mb-4 h-6 w-6 text-brand-violet" />
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Aperçu du rapport */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <h2 className="mb-3 font-display text-2xl font-bold sm:text-3xl">
              Ce que vous recevez <span className="text-brand-violet">pour 59 €</span>
            </h2>
            <p className="mb-10 max-w-3xl text-muted-foreground">
              Un rapport clair, chiffré et actionnable : vos scores avant / après, les mots-clés qui comptent pour votre activité, et chaque correctif expliqué ligne par ligne.
            </p>
            <Suspense fallback={<div className="h-96 rounded-3xl border border-border bg-card" />}>
              <AuditReportPreview />
            </Suspense>
          </div>
        </section>

        {/* Comparatif agence vs Crawlers */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <h2 className="mb-3 font-display text-2xl font-bold sm:text-3xl">
              Une agence facture <span className="text-brand-violet">des milliers d'euros</span> pour la même chose
            </h2>
            <p className="mb-10 max-w-3xl text-muted-foreground">
              Audit, contenus et fiche Google Maps : c'est le cœur de la prestation d'une agence SEO locale. La différence, c'est le prix et le délai.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
                <h3 className="mb-1 font-display text-lg font-semibold">Agence SEO classique</h3>
                <p className="mb-6 text-sm text-muted-foreground">Prestation équivalente</p>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex justify-between gap-3 border-b border-border pb-2"><span>Audit technique</span><span className="font-semibold text-foreground">800 – 1 500 €</span></li>
                  <li className="flex justify-between gap-3 border-b border-border pb-2"><span>3 contenus rédigés</span><span className="font-semibold text-foreground">450 – 900 €</span></li>
                  <li className="flex justify-between gap-3 border-b border-border pb-2"><span>Fiche Google Maps</span><span className="font-semibold text-foreground">150 – 300 €</span></li>
                  <li className="flex justify-between gap-3 border-b border-border pb-2"><span>Délai moyen</span><span className="font-semibold text-foreground">3 à 6 semaines</span></li>
                  <li className="flex justify-between gap-3 pt-1"><span>Total</span><span className="font-semibold text-foreground">1 400 – 2 700 €</span></li>
                </ul>
              </div>
              <div className="rounded-3xl border-2 border-brand-violet bg-card p-8 shadow-sm">
                <h3 className="mb-1 font-display text-lg font-semibold text-brand-violet">Passe Crawlers</h3>
                <p className="mb-6 text-sm text-muted-foreground">Le même périmètre, borné et transparent</p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /><span>Audit technique et GEO complet</span></li>
                  <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /><span>3 contenus rédigés, relus et validés par vous</span></li>
                  <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /><span>Fiche Google Maps optimisée</span></li>
                  <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /><span>Déployé sous 72 h ouvrées, rien sans votre accord</span></li>
                  <li className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /><span>Remboursé intégralement avant déploiement</span></li>
                </ul>
                <p className="mt-6 text-3xl font-bold">59 € <span className="text-base font-normal text-muted-foreground">TTC, une seule fois</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* Price card */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
            <div className="mx-auto max-w-xl rounded-3xl border-2 border-foreground bg-card p-8 text-center shadow-sm">
              <h2 className="mb-2 font-display text-2xl font-bold text-brand-violet">Passe Parmenion</h2>
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
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
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
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">Rien n'est déployé avant <span className="text-brand-violet">votre validation</span></h2>
            <p className="citable-passage mb-10 max-w-3xl text-muted-foreground">
              Aucune modification n'est publiée sur votre site ou votre fiche Google Maps avant votre accord écrit et le paiement des 59 € TTC. Chaque déploiement est journalisé et réversible : vous savez quoi a été changé, quand, et vous pouvez revenir à l'état précédent. Tant que rien n'est publié, le remboursement est intégral.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex gap-4">
                <Clock className="h-6 w-6 shrink-0 text-brand-gold" />
                <div>
                  <h3 className="mb-1 font-semibold">Délai maîtrisé</h3>
                  <p className="text-sm text-muted-foreground">Vous recevez un calendrier clair. Le déploiement n'intervient qu'après votre validation ferme.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Shield className="h-6 w-6 shrink-0 text-brand-gold" />
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
            <h2 className="mb-10 font-display text-2xl font-bold sm:text-3xl">Questions <span className="text-brand-violet">fréquentes</span></h2>
            <div className="space-y-4">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-border bg-card p-5 shadow-sm">
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

        {/* Maillage interne */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
            <h2 className="mb-6 font-display text-xl font-bold sm:text-2xl">Pour aller <span className="text-brand-violet">plus loin</span></h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ['/marina', 'Audit de visibilité complet avec rapport détaillé'],
                ['/audit-expert', 'Audit technique SEO en 200 points, gratuit'],
                ['/audit-seo-geo', "La méthode d'audit SEO GEO en détail (guide)"],
                ['/generative-engine-optimization', "Comprendre le GEO : être cité par les IA génératives"],

                ['/matrice-concurrence', 'Comparer votre visibilité à celle de vos concurrents'],
                ['/tarifs', 'Suivre votre visibilité dans le temps avec un abonnement'],
                ['/lexique', 'Lexique des termes SEO et GEO'],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link to={href} className="text-sm underline hover:no-underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Urgence */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:py-16">
            <div className="rounded-3xl border-2 border-foreground bg-card p-8 text-center shadow-sm sm:p-10">
              <h2 className="mb-3 font-display text-2xl font-bold sm:text-3xl">
                Pendant que vous attendez, <span className="text-brand-violet">vos concurrents sont cités à votre place</span>
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-muted-foreground">
                Chaque jour, des clients de votre ville demandent une recommandation à une IA. Les entreprises citées aujourd'hui prennent une avance difficile à rattraper. L'analyse est gratuite et prend moins d'une minute.
              </p>
              <Button
                onClick={focusInput}
                className="h-12 gap-2 border border-foreground bg-transparent px-8 text-foreground hover:bg-foreground hover:text-background"
              >
                Vérifier ma visibilité maintenant
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-24">
            <h2 className="mb-4 font-display text-2xl font-bold sm:text-3xl">Prêt à corriger <span className="text-brand-violet">votre visibilité</span> ?</h2>
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
    </div>
  );
}

export const parmenionSeo = {
  URL,
  FAQ,
};

export default memo(ParmenionLandingComponent);
