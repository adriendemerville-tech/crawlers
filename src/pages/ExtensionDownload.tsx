import { useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2 } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Header } from '@/components/Header';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

export default function ExtensionDownload() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    setDownloading(true);
    setError(null);
    fetch('/crawlers-extension.zip')
      .then((res) => {
        if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'crawlers-extension.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => setError(err.message))
      .finally(() => setDownloading(false));
  };

  return (
    <>
      <SEOHead
        title="Extension Chrome Crawlers — Audit SEO en 1 clic"
        description="Installez l'extension Crawlers et auditez n'importe quelle page web en un clic. Findings injectés directement dans votre Workbench."
        path="/extension"
      />
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold mb-4">Extension Crawlers pour Chrome</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Auditez n'importe quelle page web en un clic depuis votre navigateur.
              Les findings sont automatiquement injectés dans votre Workbench et la carte
              d'identité de vos sites trackés est enrichie en continu.
            </p>

            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Audits lancés en 1 clic</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Sur chaque page que vous décidez d'auditer, l'extension déclenche
                <strong className="text-foreground"> jusqu'à 5 moteurs en parallèle</strong> et
                consolide les findings dans votre Workbench.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { title: 'Audit stratégique IA (GEO)', desc: 'Visibilité dans les réponses IA, citabilité, fan-out, E-E-A-T sémantique.', href: '/score-geo' },
                  { title: 'Audit Expert technique', desc: 'Performance, balises, HTTP, indexabilité, structure HTML.', href: '/audit-expert' },
                  { title: 'Score E-E-A-T', desc: 'Expertise, autorité, fiabilité — issues priorisés et plan correctif.', href: '/eeat' },
                  { title: 'Machine Layer scan', desc: 'JSON-LD, OpenGraph, robots.txt, llms.txt, signaux machine pour bots IA.', href: '/machine-layer-scanner' },
                  { title: 'Conversion Optimizer', desc: 'Suggestions UX/CRO sur la page (uniquement sur vos sites trackés).', href: '/conversion-optimizer' },
                ].map((item) => (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="border border-border rounded-md p-3 transition-colors hover:border-[hsl(var(--brand-violet))] hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--brand-violet))]"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--brand-violet))]" />
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Ce que l'extension fait aussi</h2>
              <div className="flex flex-col gap-2.5">
                {[
                  'Détection automatique du mode : Pilote (vos sites suivis) ou Espion (concurrents)',
                  'Enrichissement de la carte d\'identité — CMS, modèle économique, langue, secteur',
                  'Findings injectés en temps réel dans le Workbench du site concerné',
                  'Lien direct vers le rapport complet dans l\'app Crawlers',
                  'Aucun audit passif : rien ne part tant que vous ne cliquez pas',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 mt-1 shrink-0 text-[hsl(var(--brand-violet))]" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <Button
              size="lg"
              onClick={handleDownload}
              disabled={downloading}
              className="bg-background hover:bg-accent hover:text-accent-foreground h-11 rounded-md px-8 text-base gap-2 mb-12 border-2 border-violet-600"
            >
              <Download className="h-5 w-5" />
              {downloading ? 'Téléchargement…' : 'Télécharger l\'extension (.zip)'}
            </Button>

            {error && (
              <p className="text-destructive text-sm mb-8">{error}</p>
            )}

            <section className="border-t border-border pt-8">
              <h2 className="text-xl font-semibold mb-4">Installation (2 minutes)</h2>
              <ol className="space-y-3 list-decimal list-inside text-muted-foreground">
                <li>Décompressez le fichier <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">crawlers-extension.zip</code></li>
                <li>Ouvrez <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">chrome://extensions</code> dans Chrome (ou Edge, Brave, Arc, Opera)</li>
                <li>Activez le <strong className="text-foreground">Mode développeur</strong> en haut à droite</li>
                <li>Cliquez sur <strong className="text-foreground">Charger l'extension non empaquetée</strong> et sélectionnez le dossier décompressé</li>
                <li>Épinglez l'extension dans la barre d'outils, puis cliquez dessus pour ouvrir le panneau latéral</li>
                <li>Connectez-vous avec votre compte Crawlers et cliquez sur <strong className="text-foreground">Auditer cette page</strong></li>
              </ol>
            </section>

            <section className="border-t border-border pt-8 mt-8">
              <h2 className="text-xl font-semibold mb-4">Confidentialité</h2>
              <p className="text-muted-foreground text-sm">
                L'extension n'envoie aucune donnée tant que vous ne cliquez pas sur
                "Auditer cette page". Aucun audit passif, aucun tracking. Votre session
                est stockée localement dans le navigateur.
              </p>
            </section>
          </div>
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
