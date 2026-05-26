import { Link, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Helmet } from "react-helmet-async";

interface Props {
  children: React.ReactNode;
  requireAuth?: boolean;
  title?: string;
  description?: string;
}

const NAV = [
  { to: "/developers/dashboard", label: "Dashboard" },
  { to: "/developers/profile?tab=cles-api", label: "Clés API" },
  { to: "/developers/profile?tab=consommation", label: "Consommation" },
  { to: "/developers/profile?tab=facturation", label: "Facturation" },
  { to: "/developers/docs", label: "Docs" },
  { to: "/developers/sdks", label: "SDKs" },
];

export default function DevLayout({ children, requireAuth, title, description }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (requireAuth) {
    if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
    if (!user) {
      return <Navigate to={`/developers/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {title && (
        <Helmet>
          <title>{title} — Crawlers Developers</title>
          {description && <meta name="description" content={description} />}
        </Helmet>
      )}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/developers" className="font-mono text-sm tracking-tight">
            <span className="text-[hsl(280_70%_60%)]">crawlers</span>
            <span className="text-muted-foreground">/developers</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {user && NAV.map(n => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                {n.label}
              </Link>
            ))}
            {!user && (
              <>
                <Link to="/developers/login" className="px-3 py-1.5 text-muted-foreground hover:text-foreground">Login</Link>
                <Link to="/developers/signup" className="px-3 py-1.5 border border-foreground rounded hover:bg-foreground hover:text-background transition-colors">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
      <footer className="border-t border-border mt-20">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© Crawlers — Plateforme Développeurs</span>
          <div className="flex gap-4">
            <Link to="/developers/aide-facturation" className="hover:text-foreground">Aide facturation</Link>
            <Link to="/cgvu" className="hover:text-foreground">CGVU</Link>
            <Link to="/politique-confidentialite" className="hover:text-foreground">Confidentialité</Link>
            <a href="mailto:dev@crawlers.fr" className="hover:text-foreground">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
