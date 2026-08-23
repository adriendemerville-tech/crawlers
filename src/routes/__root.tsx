import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { FreemiumProvider } from "@/contexts/FreemiumContext";
import { AISidebarProvider } from "@/contexts/AISidebarContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { SessionHeartbeatManager } from "@/components/SessionHeartbeatManager";
import { ScrollToTop } from "@/components/ScrollToTop";
import { Breadcrumb as BreadcrumbGlobal } from "@/components/SEO/Breadcrumb";
import { CanonicalHreflangGlobal } from "@/components/SEO/CanonicalHreflangGlobal";
import { PageViewTracker } from "@/components/Analytics/PageViewTracker";
import { AISidebarPageWrapper } from "@/components/AISidebarPageWrapper";
import { FloatingChatBubble } from "@/components/Support/FloatingChatBubble";
import { SurveyModal } from "@/components/Survey/SurveyModal";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { initGlobalErrorListener } from "@/lib/globalErrorListener";

import appCss from "../styles.css?url";

// ported from main.tsx — start capturing JS errors before React mounts
if (typeof window !== "undefined") {
  initGlobalErrorListener();
}

const SITE_TITLE = "Audit SEO et GEO : visibilité Google et IA | Crawlers";
const SITE_DESCRIPTION =
  "Auditez votre site en SEO et GEO, corrigez vos pages automatiquement et suivez votre visibilité dans Google comme dans les réponses des IA.";


// ported from index.html — gtag bootstrap (gtag.js itself is loaded by GTM below)
const GTAG_BOOTSTRAP = `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-0S0D56VSWQ', { send_page_view: false });`;

// ported from index.html — domain canonicalization for published duplicates
const DOMAIN_CANONICALIZATION = `(function() {var host = window.location.hostname;if (host === 'crawlers.lovable.app' || host === 'www.crawlers.fr') {var target = 'https://crawlers.fr' + window.location.pathname + window.location.search + window.location.hash;window.location.replace(target);}})();`;

// ported from main.tsx — apply persisted text-size preference before first paint
const TEXT_SIZE_BOOTSTRAP = `try {var ts = localStorage.getItem('ui.textSize');if (ts === 'small' || ts === 'large') {document.documentElement.setAttribute('data-text-size', ts);}} catch (e) {}`;

// ported from index.html — GTM loaded on first user interaction OR after 8s idle (best LCP)
const GTM_LAZY_LOADER = `(function() {var loaded = false;function loadGTM() {if (loaded) return;loaded = true;var h = window.location.hostname;if (h.includes('lovableproject.com') || h.includes('lovable.app') || h === 'localhost') return;(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-TDGHZZ49');}var evts = ['pointerdown','touchstart','keydown','scroll','mousemove'];var fire = function(){ evts.forEach(function(e){ window.removeEventListener(e, fire, {passive:true}); }); loadGTM(); };evts.forEach(function(e){ window.addEventListener(e, fire, {passive:true, once:true}); });window.addEventListener('load', function(){ setTimeout(loadGTM, 8000); });})();`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, maximum-scale=5" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "author", content: "Crawlers.fr" },
      {
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      {
        name: "googlebot",
        content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { name: "bingbot", content: "index, follow" },
      { name: "ai.txt", content: "/llms.txt" },
      { name: "generator", content: "Crawlers.fr - Audit SEO & GEO Expert" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://crawlers.fr/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content:
          "Crawlers.fr - Audit SEO & GEO, Correction Automatique, Contenu IA, CMS Direct, GMB, ML Prédictif",
      },
      { property: "og:locale", content: "fr_FR" },
      { property: "og:site_name", content: "Crawlers.fr" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@crawlersfr" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
      { name: "twitter:image", content: "https://crawlers.fr/og-image.png" },
      { name: "twitter:image:alt", content: "Crawlers.fr - Plateforme SEO, GEO & IA Complète" },
      { name: "theme-color", content: "#7c3aed" },
      { name: "msapplication-TileColor", content: "#7c3aed" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Crawlers.fr — Blog SEO & GEO",
        href: "/rss.xml",
      },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml", title: "Sitemap XML" },
      { rel: "author", href: "/llms.txt", type: "text/plain", title: "LLM Documentation" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/favicon-192.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "dns-prefetch", href: "https://tutlimtasnjabdfhpewu.supabase.co" },
      { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
      { rel: "dns-prefetch", href: "https://images.unsplash.com" },
      {
        rel: "preload",
        href: "/fonts/inter-latin-wght-normal.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/space-grotesk-latin-wght-normal.woff2",
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      // Non-critical display fonts (Space Grotesk @font-face) — previously deferred from main.tsx
      { rel: "stylesheet", href: "/fonts-deferred.css" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(SITEWIDE_JSONLD),
      },
      { children: GTAG_BOOTSTRAP },
      { children: DOMAIN_CANONICALIZATION },
      { children: TEXT_SIZE_BOOTSTRAP },
      { children: GTM_LAZY_LOADER },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <GlobalErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <LanguageProvider>
              <AuthProvider>
                <SessionHeartbeatManager />
                <DemoModeProvider>
                  <FreemiumProvider>
                    <CreditsProvider>
                      <AISidebarProvider>
                        <TooltipProvider>
                          <Toaster />
                          <Sonner />
                          <CanonicalHreflangGlobal />
                          <ScrollToTop />
                          <PageViewTracker />
                          <AISidebarPageWrapper>
                            <BreadcrumbGlobal visuallyHidden />
                            <Outlet />
                          </AISidebarPageWrapper>
                          <FloatingChatBubble />
                          <SurveyModal />
                        </TooltipProvider>
                      </AISidebarProvider>
                    </CreditsProvider>
                  </FreemiumProvider>
                </DemoModeProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </GlobalErrorBoundary>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-2 text-xl font-semibold text-foreground">This page didn't load</h1>
        <p className="mb-6 text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-md border border-foreground px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            href="/"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
