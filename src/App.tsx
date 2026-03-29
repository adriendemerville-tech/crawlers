import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "next-themes";
import { ScrollToTop } from "@/components/ScrollToTop";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { SessionHeartbeatManager } from "@/components/SessionHeartbeatManager";

// Lazy load providers not needed for first paint
const AuthProvider = lazy(() => import("@/contexts/AuthContext").then(m => ({ default: m.AuthProvider })));
const CreditsProvider = lazy(() => import("@/contexts/CreditsContext").then(m => ({ default: m.CreditsProvider })));
const DemoModeProvider = lazy(() => import("@/contexts/DemoModeContext").then(m => ({ default: m.DemoModeProvider })));
const FreemiumProvider = lazy(() => import("@/contexts/FreemiumContext").then(m => ({ default: m.FreemiumProvider })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));
const HelmetProvider = lazy(() => import("react-helmet-async").then(m => ({ default: m.HelmetProvider })));

// Lazy load analytics tracker - not needed for initial render/LCP
const PageViewTracker = lazy(() => import("@/components/Analytics/PageViewTracker").then(m => ({ default: m.PageViewTracker })));

// Lazy load Radix-heavy toast/notification components to prevent layout thrashing on initial paint
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));


// Lazy load the chat bubble (not needed for initial render)
const FloatingChatBubble = lazy(() => import("@/components/Support/FloatingChatBubble").then(m => ({ default: m.FloatingChatBubble })));
const SurveyModal = lazy(() => import("@/components/Survey/SurveyModal").then(m => ({ default: m.SurveyModal })));


// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const ExpertAudit = lazy(() => import("./pages/ExpertAudit"));
const Lexique = lazy(() => import("./pages/Lexique"));
const ExpertTermPage = lazy(() => import("./pages/Lexique/ExpertTermPage"));
const Tarifs = lazy(() => import("./pages/Tarifs"));
const MentionsLegales = lazy(() => import("./pages/MentionsLegales"));
const PolitiqueConfidentialite = lazy(() => import("./pages/PolitiqueConfidentialite"));
const ConditionsUtilisation = lazy(() => import("./pages/ConditionsUtilisation"));
const RGPD = lazy(() => import("./pages/RGPD"));
const Auth = lazy(() => import("./pages/Auth"));
const SignupPage = lazy(() => import("./pages/Signup"));
const Profile = lazy(() => import("./pages/Profile"));
const ReportViewer = lazy(() => import("./pages/ReportViewer"));
const RapportViewer = lazy(() => import("./pages/RapportViewer"));
const SharedReportRedirect = lazy(() => import("./pages/SharedReportRedirect"));
const Blog = lazy(() => import("./pages/Blog"));
const ArticlePage = lazy(() => import("./pages/Blog/ArticlePage"));

const ComparatifCrawlersSemrush = lazy(() => import("./pages/ComparatifCrawlersSemrush"));
const ModifierCodeWordPress = lazy(() => import("./pages/ModifierCodeWordPress"));
const ProAgency = lazy(() => import("./pages/ProAgency"));
const Observatoire = lazy(() => import("./pages/Observatoire"));
const ContentArchitectPage = lazy(() => import("./pages/ContentArchitectPage"));
const Faq = lazy(() => import("./pages/Faq"));
const Methodologie = lazy(() => import("./pages/Methodologie"));
const CGVU = lazy(() => import("./pages/CGVU"));
const AuditSeoGratuit = lazy(() => import("./pages/AuditSeoGratuit"));
const AnalyseSiteWebGratuit = lazy(() => import("./pages/AnalyseSiteWebGratuit"));
const GenerativeEngineOptimization = lazy(() => import("./pages/GenerativeEngineOptimization"));
const GuideAuditSeo = lazy(() => import("./pages/GuideAuditSeo"));
const NotFound = lazy(() => import("./pages/NotFound"));
const IntegrationGTM = lazy(() => import("./pages/IntegrationGTM"));
const SiteCrawl = lazy(() => import("./pages/SiteCrawl"));
const AuditCompare = lazy(() => import("./pages/AuditCompare"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const IndiceAlignementStrategique = lazy(() => import("./pages/IndiceAlignementStrategique"));
const ArchitecteGeneratif = lazy(() => import("./pages/ArchitecteGeneratif"));
const Cocoon = lazy(() => import("./pages/Cocoon"));
const FeaturesCocoon = lazy(() => import("./pages/FeaturesCocoon"));
const MatricePrompt = lazy(() => import("./pages/MatricePrompt"));
const RapportMatrice = lazy(() => import("./pages/RapportMatrice"));
const Aide = lazy(() => import("./pages/Aide"));
const StrategeCocoon = lazy(() => import("./pages/StrategeCocoon"));
const MarinaPage = lazy(() => import("./pages/Marina"));
const DataFlowDiagram = lazy(() => import("./pages/DataFlowDiagram"));

// Legacy redirect for /rapport/:reportId → /app/rapport/:reportId
const LegacyRapportRedirect = () => {
  const reportId = window.location.pathname.split('/rapport/')[1];
  return <Navigate to={`/app/rapport/${reportId}`} replace />;
};

// Loading fallback
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground">Chargement...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <GlobalErrorBoundary>
  <Suspense fallback={null}>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <LanguageProvider>
            <Suspense fallback={null}>
              <AuthProvider>
                <SessionHeartbeatManager />
                <DemoModeProvider>
                <FreemiumProvider>
                <CreditsProvider>
                  <TooltipProvider>
                    <Suspense fallback={null}>
                      <Toaster />
                      <Sonner />
                    </Suspense>
                    <BrowserRouter>
                      <ScrollToTop />
                      <Suspense fallback={null}>
                        <PageViewTracker />
                      </Suspense>
                      <Suspense fallback={<PageLoader />}>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/audit-expert" element={<ExpertAudit />} />
                          <Route path="/lexique" element={<Lexique />} />
                          <Route path="/lexique/:slug" element={<ExpertTermPage />} />
                          <Route path="/tarifs" element={<Tarifs />} />
                          <Route path="/mentions-legales" element={<MentionsLegales />} />
                          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                          <Route path="/conditions-utilisation" element={<ConditionsUtilisation />} />
                          <Route path="/rgpd" element={<RGPD />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/signup" element={<SignupPage />} />
                          <Route path="/app/console" element={<Profile />} />
                          <Route path="/app/profil" element={<Profile />} /> {/* Legacy redirect */}
                          <Route path="/app/rapport/audit" element={<RapportViewer />} />
                          <Route path="/app/rapport/cocoon" element={<RapportViewer />} />
                          <Route path="/app/rapport/:reportId" element={<ReportViewer />} />
                          <Route path="/temporarylink/:shareId" element={<SharedReportRedirect />} />
                          <Route path="/temporaryreport/:shareId" element={<SharedReportRedirect />} /> {/* Legacy redirect */}
                          <Route path="/r/:shareId" element={<SharedReportRedirect />} /> {/* Legacy redirect */}
                          <Route path="/blog" element={<Blog />} />
                          <Route path="/blog/:slug" element={<ArticlePage />} />
                          
                          <Route path="/comparatif-crawlers-semrush" element={<ComparatifCrawlersSemrush />} />
                          <Route path="/modifier-code-wordpress" element={<ModifierCodeWordPress />} />
                          <Route path="/pro-agency" element={<ProAgency />} />
                          <Route path="/observatoire" element={<Observatoire />} />
                          <Route path="/content-architect" element={<ContentArchitectPage />} />
                          <Route path="/faq" element={<Faq />} />
                          <Route path="/methodologie" element={<Methodologie />} />
                          <Route path="/cgvu" element={<CGVU />} />
                          <Route path="/audit-seo-gratuit" element={<AuditSeoGratuit />} />
                          <Route path="/analyse-site-web-gratuit" element={<AnalyseSiteWebGratuit />} />
                          <Route path="/generative-engine-optimization" element={<GenerativeEngineOptimization />} />
                          <Route path="/guide-audit-seo" element={<GuideAuditSeo />} />
                          <Route path="/app/site-crawl" element={<SiteCrawl />} />
                          <Route path="/app/audit-compare" element={<AuditCompare />} />
                          <Route path="/integration-gtm" element={<IntegrationGTM />} />
                          <Route path="/indice-alignement-strategique" element={<IndiceAlignementStrategique />} />
                          <Route path="/architecte-generatif" element={<ArchitecteGeneratif />} />
                          <Route path="/app/cocoon" element={<Cocoon />} />
                          <Route path="/features/cocoon" element={<FeaturesCocoon />} />
                          <Route path="/matrice" element={<MatricePrompt />} />
                          <Route path="/app/rapport/matrice" element={<RapportMatrice />} />
                          <Route path="/aide" element={<Aide />} />
                          <Route path="/stratege-cocoon" element={<StrategeCocoon />} />
                          <Route path="/marina" element={<MarinaPage />} />
                          <Route path="/data-flow-diagram" element={<DataFlowDiagram />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          {/* Legacy redirects → /app/* */}
                          <Route path="/console" element={<Navigate to="/app/console" replace />} />
                          <Route path="/profil" element={<Navigate to="/app/profil" replace />} />
                          <Route path="/cocoon" element={<Navigate to="/app/cocoon" replace />} />
                          <Route path="/site-crawl" element={<Navigate to="/app/site-crawl" replace />} />
                          <Route path="/audit-compare" element={<Navigate to="/app/audit-compare" replace />} />
                          <Route path="/rapport/audit" element={<Navigate to="/app/rapport/audit" replace />} />
                          <Route path="/rapport/cocoon" element={<Navigate to="/app/rapport/cocoon" replace />} />
                          <Route path="/rapport/matrice" element={<Navigate to="/app/rapport/matrice" replace />} />
                          <Route path="/rapport/:reportId" element={<LegacyRapportRedirect />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                      <Suspense fallback={null}>
                        <FloatingChatBubble />
                      </Suspense>
                      <Suspense fallback={null}>
                        <SurveyModal />
                      </Suspense>
                    </BrowserRouter>
                  </TooltipProvider>
                </CreditsProvider>
                </FreemiumProvider>
                </DemoModeProvider>
              </AuthProvider>
            </Suspense>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </Suspense>
  </GlobalErrorBoundary>
);

export default App;
