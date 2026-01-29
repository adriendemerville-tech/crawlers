import { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load pages (with retry to avoid blank screens on chunk cache issues)
const Index = lazyWithRetry(() => import("./pages/Index"));
const ExpertAudit = lazyWithRetry(() => import("./pages/ExpertAudit"));
const Lexique = lazyWithRetry(() => import("./pages/Lexique"));
const MentionsLegales = lazyWithRetry(() => import("./pages/MentionsLegales"));
const PolitiqueConfidentialite = lazyWithRetry(() => import("./pages/PolitiqueConfidentialite"));
const ConditionsUtilisation = lazyWithRetry(() => import("./pages/ConditionsUtilisation"));
const RGPD = lazyWithRetry(() => import("./pages/RGPD"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const ReportViewer = lazyWithRetry(() => import("./pages/ReportViewer"));
const SharedReportRedirect = lazyWithRetry(() => import("./pages/SharedReportRedirect"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

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

const App = () => {
  // If we retried once due to a chunk load error, clear the flag on successful mount.
  useEffect(() => {
    try {
      sessionStorage.removeItem("__lazy_retry_once");
    } catch {
      // ignore
    }
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            <AuthProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/audit-expert" element={<ExpertAudit />} />
                      <Route path="/lexique" element={<Lexique />} />
                      <Route path="/mentions-legales" element={<MentionsLegales />} />
                      <Route
                        path="/politique-confidentialite"
                        element={<PolitiqueConfidentialite />}
                      />
                      <Route path="/conditions-utilisation" element={<ConditionsUtilisation />} />
                      <Route path="/rgpd" element={<RGPD />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/profil" element={<Profile />} />
                      <Route path="/rapport/:reportId" element={<ReportViewer />} />
                      <Route path="/temporaryreport/:shareId" element={<SharedReportRedirect />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </TooltipProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
