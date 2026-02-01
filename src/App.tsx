import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import { SupportChatBubble } from "@/components/Support";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { createDebugLazy } from "@/components/DebugLoader";

// DEBUG: Lazy load pages with visible name
const Index = createDebugLazy("Index (Home)", () => import("./pages/Index"));
const ExpertAudit = createDebugLazy("ExpertAudit", () => import("./pages/ExpertAudit"));
const Lexique = createDebugLazy("Lexique", () => import("./pages/Lexique"));
const Tarifs = createDebugLazy("Tarifs", () => import("./pages/Tarifs"));
const MentionsLegales = createDebugLazy("MentionsLegales", () => import("./pages/MentionsLegales"));
const PolitiqueConfidentialite = createDebugLazy("PolitiqueConfidentialite", () => import("./pages/PolitiqueConfidentialite"));
const ConditionsUtilisation = createDebugLazy("ConditionsUtilisation", () => import("./pages/ConditionsUtilisation"));
const RGPD = createDebugLazy("RGPD", () => import("./pages/RGPD"));
const Auth = createDebugLazy("Auth", () => import("./pages/Auth"));
const Profile = createDebugLazy("Profile", () => import("./pages/Profile"));
const ReportViewer = createDebugLazy("ReportViewer", () => import("./pages/ReportViewer"));
const SharedReportRedirect = createDebugLazy("SharedReportRedirect", () => import("./pages/SharedReportRedirect"));
const Blog = createDebugLazy("Blog", () => import("./pages/Blog"));
const ArticlePage = createDebugLazy("ArticlePage", () => import("./pages/Blog/ArticlePage"));
const NotFound = createDebugLazy("NotFound", () => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LanguageProvider>
          <AuthProvider>
            <CreditsProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppErrorBoundary>
                  <BrowserRouter>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/audit-expert" element={<ExpertAudit />} />
                      <Route path="/lexique" element={<Lexique />} />
                      <Route path="/tarifs" element={<Tarifs />} />
                      <Route path="/mentions-legales" element={<MentionsLegales />} />
                      <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
                      <Route path="/conditions-utilisation" element={<ConditionsUtilisation />} />
                      <Route path="/rgpd" element={<RGPD />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/profil" element={<Profile />} />
                      <Route path="/rapport/:reportId" element={<ReportViewer />} />
                      <Route path="/temporaryreport/:shareId" element={<SharedReportRedirect />} />
                      <Route path="/blog" element={<Blog />} />
                      <Route path="/blog/:slug" element={<ArticlePage />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <SupportChatBubble />
                  </BrowserRouter>
                </AppErrorBoundary>
              </TooltipProvider>
            </CreditsProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
