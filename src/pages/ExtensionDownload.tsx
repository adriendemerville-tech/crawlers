import { useState, lazy, Suspense } from 'react';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2 } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Header } from '@/components/Header';
import { PageEditorial } from '@/components/seo/PageEditorial';

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
                  { title: 'Audit stratégique IA (GEO)', desc: 'Visibilité dans les réponses IA, citabilité, fan-out, E-E-A-T sémantique.', href: '/generative-engine-optimization' },
                  { title: 'Audit Expert technique', desc: 'Performance, balises, HTTP, indexabilité, structure HTML.', href: '/audit-expert' },
                  { title: 'Score E-E-A-T', desc: 'Expertise, autorité, fiabilité — issues priorisés et plan correctif.', href: '/eeat' },
                  { title: 'Machine Layer scan', desc: 'JSON-LD, OpenGraph, robots.txt, llms.txt, signaux machine pour bots IA.', href: '/machine-layer-scanner' },
                  { title: 'Conversion Optimizer', desc: 'Suggestions UX/CRO sur la page (uniquement sur vos sites trackés).', href: '/conversion-optimizer' },
                ].map((item) => (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="border border-border rounded-md p-3 transition-colors hover:border-[hsl(var(--brand-violet))] hover:bg-muted/40 focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--brand-violet))]"
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

          <PageEditorial
            heading="À quoi sert une extension d'audit dans un navigateur"
            intro="Auditer depuis le navigateur change surtout le moment de l'analyse : le constat est produit sur la page qu'on regarde, pendant la revue, sans changer d'outil ni attendre un crawl complet."
            citable="L'extension Crawlers audite uniquement la page active, à la demande : elle lit le HTML rendu par le navigateur, déclenche les moteurs d'analyse côté serveur et renvoie les constats dans le Workbench du compte connecté."
            sections={[
              {
                title: 'HTML rendu et HTML servi : la différence qui compte',
                paragraphs: [
                  "Un crawler lit le HTML renvoyé par le serveur. Le navigateur, lui, exécute le JavaScript. Quand un site rend son contenu côté client, les deux vues divergent : la page paraît complète à l'écran mais quasi vide pour un moteur.",
                  "Auditer depuis le navigateur permet de comparer ces deux états et d'identifier la cause racine — une coquille JavaScript — au lieu de conclure à tort que le contenu est pauvre.",
                ],
              },
              {
                title: 'Cas d’usage concrets',
                paragraphs: [
                  "L'extension est surtout utile sur les pages qu'un crawl n'atteint pas facilement, ou quand il faut trancher rapidement pendant une revue.",
                ],
                bullets: [
                  "Page derrière un formulaire, un espace client ou une préproduction non publique.",
                  "Contrôle avant mise en ligne : titre, description, données structurées, un seul H1.",
                  "Revue concurrentielle : mesurer la citabilité d'une page tierce sans lancer un crawl entier.",
                  "Vérification après déploiement : confirmer qu'un correctif est bien présent dans la page servie.",
                ],
              },
              {
                title: 'Ce que l’extension ne fait pas',
                paragraphs: [
                  "Aucun audit passif : rien n'est envoyé tant que l'audit n'est pas déclenché explicitement. Aucune collecte de navigation, aucun historique transmis, aucune analyse en arrière-plan. La session reste stockée localement dans le navigateur.",
                ],
              },
            ]}
            faq={[
              {
                question: "L'extension fonctionne-t-elle sur Edge, Brave, Arc et Opera ?",
                answer: "Oui. Ces navigateurs partagent le moteur d'extensions de Chrome : la procédure d'installation en mode développeur est identique.",
              },
              {
                question: 'Faut-il un compte pour auditer une page ?',
                answer: "Oui, un compte Crawlers est nécessaire, car les constats sont rattachés à votre Workbench et consomment votre quota d'audits.",
              },
              {
                question: "L'extension audite-t-elle les pages privées ou en préproduction ?",
                answer: "Oui, tant que la page s'affiche dans votre navigateur. C'est le principal avantage sur un crawler externe, qui ne peut pas franchir une authentification.",
              },
            ]}
          />
        </main>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}
