import { useState, useEffect, useRef, lazy, Suspense } from 'react';

// FAQ rendue en SSR (texte + FAQPage visibles par les bots) : import statique.
import { Header } from '@/components/Header';
import { HomeHero } from '@/components/Homepage/HomeHero';
import { AIVisibilitySection } from '@/components/Homepage/AIVisibilitySection';
import { AIBotsLeadMagnet } from '@/components/Homepage/AIBotsLeadMagnet';
import { AudienceRouter } from '@/components/Home/AudienceRouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGeoMetaTags } from '@/hooks/useGeoMetaTags';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Link, useNavigate } from '@/lib/router-compat';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { getPublicConfig, isFlagEnabled } from '@/lib/config/publicConfig';

// ─── Sections marketing en imports STATIQUES ───
// Elles portent le contenu textuel indexable de la home : elles doivent être
// présentes dans le HTML initial servi aux bots (Googlebot, GPTBot, ClaudeBot…).
import { ProductShowcaseSection } from '@/components/Homepage/ProductShowcaseSection';
import { Footer } from '@/components/Footer';

// ─── Sections différées côté CLIENT uniquement ───
const AIAgentsSection = lazy(() => import('@/components/Homepage/AIAgentsSection').then(m => ({ default: m.AIAgentsSection })));
const MarinaDeepAuditSection = lazy(() => import('@/components/Homepage/MarinaDeepAuditSection').then(m => ({ default: m.MarinaDeepAuditSection })));
const FAQSection = lazy(() => import('@/components/FAQSection').then(m => ({ default: m.FAQSection })));
const SiloHub = lazy(() => import('@/components/seo/SiloHub').then(m => ({ default: m.SiloHub })));

const Index = () => {
  const [hideLeadmagnet, setHideLeadmagnet] = useState(false);
  const { language } = useLanguage();

  // Auto-redirect subscribed users to console with loading animation
  const { user: authUser } = useAuth();
  const { isAgencyPro: isSubscribed } = useCredits();
  const { isAdmin: isAdminUser } = useAdmin();
  const navTo = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectStartedRef = useRef(false);
  useEffect(() => {
    if (redirectStartedRef.current) return;
    if (!authUser || !(isSubscribed || isAdminUser)) return;

    // Don't redirect if user navigated here from another page on the site
    const isInternalNavigation = document.referrer && (() => {
      try {
        const ref = new URL(document.referrer);
        return ref.origin === window.location.origin;
      } catch { return false; }
    })();
    if (isInternalNavigation) return;

    redirectStartedRef.current = true;
    setIsRedirecting(true);
    setTimeout(() => {
      try {
        navTo('/app/console?tab=tracking', { replace: true });
      } catch {
        window.location.href = '/app/console?tab=tracking';
      }
    }, 600);
    setTimeout(() => {
      if (window.location.pathname === '/') {
        window.location.href = '/app/console?tab=tracking';
      }
    }, 3500);
  }, [authUser, isSubscribed, isAdminUser, navTo]);

  // Fetch hide_home_leadmagnet config — deferred to avoid blocking render
  useEffect(() => {
    const ctrl = new AbortController();
    const loadConfig = () => {
      getPublicConfig().then((config) => {
        if (isFlagEnabled(config.hide_home_leadmagnet)) setHideLeadmagnet(true);
      });
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(loadConfig, { timeout: 3000 });
      return () => { cancelIdleCallback(id); ctrl.abort(); };
    } else {
      const timer = setTimeout(loadConfig, 1500);
      return () => { clearTimeout(timer); ctrl.abort(); };
    }
  }, []);

  // Inject JSON-LD structured data dynamically
  useGeoMetaTags();

  // Fix canonical & hreflang for multilingual indexation (EN/ES pages)
  useCanonicalHreflang('/');

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">{language === 'fr' ? 'Chargement de votre console…' : language === 'es' ? 'Cargando su consola…' : 'Loading your console…'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-root flex min-h-screen flex-col bg-background">
      {/* FAQPage + SoftwareApplication : déjà émis en SSR par le head() de la
          route (src/lib/seo/homeSchemas.ts) — aucun doublon client ici. */}
      <AudienceRouter />
      <Header />
      <main className="flex-1 relative" role="main" aria-label={language === 'fr' ? 'Contenu principal' : language === 'es' ? 'Contenido principal' : 'Main content'}>
        {/* Global premium gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--brand-violet)/0.06),transparent_60%)]" />
        <HomeHero />
        <AIVisibilitySection />

        {/* ─── Homepage marketing sections ───
             Parcours mobile réduit : promesse → preuve → démonstration → inscription.
             Les CTA et lead magnets conservent leur wording, destination et mécanique. */}

        {/* 3. Preuve : le produit visible */}
        <div id="features" className="cv-auto-lg">
          <ProductShowcaseSection />
        </div>

        {/* 4. Capacités clés : Score GEO + Bots IA + Visibilité LLM en 3 onglets */}
        <section className="py-14 sm:py-20 cv-auto" aria-labelledby="capabilities-title">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-10">
              <h2 id="capabilities-title" className="t-h2 font-bold tracking-tight text-foreground font-display">
                {language === 'fr'
                  ? '3 audits gratuits pour vérifier votre visibilité'
                  : language === 'es'
                  ? '3 auditorías gratuitas para verificar su visibilidad'
                  : '3 free audits to check your visibility'}
              </h2>
            </div>
            <AIBotsLeadMagnet />
          </div>
        </section>

        {/* 5. Agents IA + Marina : fusionnées en une seule section */}
        <section className="py-14 sm:py-20 cv-auto" aria-labelledby="agents-marina-title">
          <div className="container mx-auto px-4 max-w-6xl space-y-16">
            <div className="text-center">
              <h2 id="agents-marina-title" className="t-h2 font-bold tracking-tight text-foreground font-display">
                {language === 'fr'
                  ? 'Des agents IA et un audit profond à vos côtés'
                  : language === 'es'
                  ? 'Agentes IA y una auditoría profunda a su lado'
                  : 'AI agents and a deep audit by your side'}
              </h2>
            </div>
            <Suspense fallback={null}><AIAgentsSection /></Suspense>
            <Suspense fallback={null}><MarinaDeepAuditSection /></Suspense>
          </div>
        </section>

        {/* 6. Offre agence + FAQ + CTA final */}
        <section className="relative overflow-hidden py-14 sm:py-20 cv-auto" aria-labelledby="pro-agency-title">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--brand-violet)/0.06),transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl px-4 text-center">
            <h2 id="pro-agency-title" className="mb-4 t-h1 font-extrabold text-foreground">
              {language === 'fr' ? 'Gérez 30 clients. Audits illimités.' : language === 'es' ? 'Gestiona 30 clientes. Auditorías ilimitadas.' : 'Manage 30 clients. Unlimited audits.'}
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
              {language === 'fr' ? (
                <>
                  <strong>Rapports marque blanche</strong>, correctifs auto-déployés, <strong>crawl 5 000 pages/mois</strong> et agents IA — tout inclus.
                </>
              ) : language === 'es' ? (
                <>
                  <strong>Informes marca blanca</strong>, correcciones auto-desplegadas, <strong>crawl 5 000 páginas/mes</strong> y agentes IA — todo incluido.
                </>
              ) : (
                <>
                  <strong>White-label reports</strong>, auto-deployed fixes, <strong>5,000 pages/month crawl</strong> &amp; AI agents — all included.
                </>
              )}
            </p>
            {/* Mini stats */}
            <div className="mx-auto mb-6 grid max-w-lg grid-cols-5 gap-2">
              {[
                { v: '∞', l: language === 'fr' ? 'Audits' : 'Audits' },
                { v: '30', l: language === 'fr' ? 'Sites' : 'Sites' },
                { v: '5K', l: language === 'fr' ? 'Pages/mois' : 'Pages/mo' },
                { v: '24', l: language === 'fr' ? 'Algorithmes' : 'Algorithms' },
                { v: '16', l: language === 'fr' ? 'Agents autonomes' : language === 'es' ? 'Agentes autónomos' : 'Autonomous agents' },
              ].map((s, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-card/30 px-3 py-2 text-center">
                  <div className="text-xl font-extrabold text-foreground">{s.v}</div>
                  <div className="text-[10px] text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
            {/* Tarification explicite — 3 plans */}
            <div className="mx-auto mb-6 grid max-w-3xl gap-3 sm:grid-cols-3">
              {/* Pro Agency */}
              <div className="rounded-xl border border-violet-500/40 bg-card/50 p-4 text-left">
                <div className="text-sm font-bold text-foreground">Pro Agency</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground">29€</span>
                  <span className="text-xs text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {language === 'fr' ? 'ou 26,10€/mois en annuel (-10%)' : language === 'es' ? 'o 26,10€/mes anual (-10%)' : 'or €26.10/mo billed annually (-10%)'}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === 'fr' ? 'Freelances & petites agences · 5 000 pages/mois · sans engagement' : language === 'es' ? 'Freelances y pequeñas agencias · 5 000 páginas/mes · sin compromiso' : 'Freelancers & small agencies · 5,000 pages/mo · no commitment'}
                </div>
              </div>
              {/* Pro Agency + */}
              <div className="rounded-xl border border-amber-400/50 bg-card/50 p-4 text-left">
                <div className="text-sm font-bold text-foreground">Pro Agency +</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground">79€</span>
                  <span className="text-xs text-muted-foreground">/{language === 'fr' ? 'mois' : language === 'es' ? 'mes' : 'mo'}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {language === 'fr' ? 'ou 71,10€/mois en annuel (-10%)' : language === 'es' ? 'o 71,10€/mes anual (-10%)' : 'or €71.10/mo billed annually (-10%)'}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === 'fr' ? 'Agences 10+ clients · 50 000 pages/mois · API Marina incluse' : language === 'es' ? 'Agencias 10+ clients · 50 000 páginas/mes · API Marina incluida' : 'Agencies 10+ clients · 50,000 pages/mo · Marina API included'}
                </div>
              </div>
              {/* Enterprise */}
              <div className="rounded-xl border border-border bg-card/50 p-4 text-left">
                <div className="text-sm font-bold text-foreground">Enterprise</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground">{language === 'fr' ? 'Sur devis' : language === 'es' ? 'A medida' : 'Custom'}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {language === 'fr' ? 'Tout illimité · SSO SAML · serveur dédié' : language === 'es' ? 'Todo ilimitado · SSO SAML · servidor dedicado' : 'Everything unlimited · SAML SSO · dedicated server'}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === 'fr' ? 'Grands comptes & équipes 20+' : language === 'es' ? 'Grandes cuentas y equipos 20+' : 'Large accounts & 20+ teams'}
                </div>
              </div>
            </div>
            <p className="mx-auto mb-6 max-w-2xl text-xs text-muted-foreground">
              {language === 'fr'
                ? 'Tous les audits sont intégrés aux abonnements. Agent d\u2019analyse Marina disponible par API.'
                : language === 'es'
                  ? 'Todas las auditorías están incluidas en las suscripciones. Agente de análisis Marina disponible por API.'
                  : 'All audits are included in subscriptions. Marina analysis agent available via API.'}
            </p>
            <div className="flex flex-col items-center gap-4 mb-6">
              <Link to="/pro-agency">
                <Button
                  size="lg"
                  className="gap-2 px-5 border border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background font-semibold transition-all"
                >
                  <Crown className="h-5 w-5 text-yellow-300" />
                  {language === 'fr' ? 'Découvrir Pro Agency' : language === 'es' ? 'Descubrir Pro Agency' : 'Discover Pro Agency'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ + hub de silos */}
        <div className="cv-auto"><Suspense fallback={null}><FAQSection /></Suspense></div>

        {/* Hub des 4 silos : la home transmet l'autorité aux piliers */}
        <div className="cv-auto"><Suspense fallback={null}><SiloHub /></Suspense></div>

      </main>
      <Footer />
    </div>
  );
};

export default Index;
