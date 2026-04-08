import { lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ArrowLeft, CheckCircle2, Code, Globe, Zap, ShieldCheck,
  Plug, Unplug, Settings, Eye, RefreshCw, Layers, FileCode,
  MonitorSmartphone, ToggleRight, Cable, Sparkles, Download, Link2, ArrowRight
} from 'lucide-react';
import { t3 } from '@/utils/i18n';
const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));


const SITE_URL = 'https://crawlers.fr';

export default function IntegrationGTM() {
  const { language } = useLanguage();
  useCanonicalHreflang('/integration-gtm');

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        'headline': t3(language,
          'Brancher votre site — 3 méthodes pour connecter Crawlers.AI',
          'Connect your site — 3 methods to integrate Crawlers.AI',
          'Conectar su sitio — 3 métodos para integrar Crawlers.AI'
        ),
        'description': t3(language,
          'Guide complet pour connecter votre site à Crawlers.AI : API CMS, plugin WordPress, Google Tag Manager. Injection automatique, sandboxing, débranchage instantané.',
          'Complete guide to connect your site to Crawlers.AI: CMS API, WordPress plugin, Google Tag Manager. Auto injection, sandboxing, instant disconnect.',
          'Guía completa para conectar su sitio a Crawlers.AI: API CMS, plugin WordPress, Google Tag Manager. Inyección automática, sandboxing, desconexión instantánea.'
        ),
        'author': { '@type': 'Organization', 'name': 'Crawlers.fr', 'url': SITE_URL },
        'publisher': { '@type': 'Organization', 'name': 'Crawlers.fr', 'url': SITE_URL },
        'datePublished': '2026-03-12',
        'dateModified': '2026-03-23',
        'mainEntityOfPage': `${SITE_URL}/integration-gtm`,
        'inLanguage': language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      },
      {
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': t3(language, 'Le code injecté ralentit-il mon site ?', 'Does the injected code slow down my site?', '¿El código inyectado ralentiza mi sitio?'),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Non. Le code s\'exécute de manière asynchrone après le DOMContentLoaded. Zéro impact sur les Core Web Vitals.',
                'No. The code runs asynchronously after DOMContentLoaded. Zero impact on Core Web Vitals.',
                'No. El código se ejecuta de forma asíncrona después del DOMContentLoaded. Cero impacto en Core Web Vitals.'
              ),
            },
          },
          {
            '@type': 'Question',
            'name': t3(language, 'Puis-je débrancher mon site à tout moment ?', 'Can I disconnect my site at any time?', '¿Puedo desconectar mi sitio en cualquier momento?'),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Oui. Un clic suffit depuis Mes sites. Le code correctif cesse immédiatement d\'être injecté.',
                'Yes. One click from My Sites. Corrective code stops being injected immediately.',
                'Sí. Un clic desde Mis sitios. El código correctivo deja de inyectarse inmediatamente.'
              ),
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>{t3(language,
          'Brancher votre site — API, WordPress, GTM | Crawlers.fr',
          'Connect your site — API, WordPress, GTM | Crawlers.fr',
          'Conectar su sitio — API, WordPress, GTM | Crawlers.fr'
        )}</title>
        <meta name="description" content={t3(language,
          'Connectez votre site à Crawlers.AI en 30 secondes. 3 méthodes : API CMS, plugin WordPress, Google Tag Manager. Injection automatique, sandboxing, débranchage instantané.',
          'Connect your site to Crawlers.AI in 30 seconds. 3 methods: CMS API, WordPress plugin, Google Tag Manager. Auto injection, sandboxing, instant disconnect.',
          'Conecte su sitio a Crawlers.AI en 30 segundos. 3 métodos: API CMS, plugin WordPress, Google Tag Manager. Inyección automática, sandboxing, desconexión instantánea.'
        )} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <Header />

      <main className="flex-1 pt-20 pb-16">
        <div className="container mx-auto max-w-4xl px-4">

          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t3(language, 'Retour à l\'accueil', 'Back to home', 'Volver al inicio')}
          </Link>

          {/* ─── H1 ─── */}
          <div className="mb-10">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              {t3(language, 'Guide technique', 'Technical Guide', 'Guía técnica')}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
              {t3(language,
                'Brancher votre site — 3 méthodes pour connecter Crawlers.AI',
                'Connect your site — 3 methods to integrate Crawlers.AI',
                'Conectar su sitio — 3 métodos para integrar Crawlers.AI'
              )}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t3(language,
                'Crawlers.AI génère des scripts correctifs (JSON-LD, métadonnées, Open Graph, Hreflang) injectables automatiquement sur votre site. Choisissez la méthode qui correspond à votre environnement technique.',
                'Crawlers.AI generates corrective scripts (JSON-LD, metadata, Open Graph, Hreflang) that can be automatically injected on your site. Choose the method that matches your technical environment.',
                'Crawlers.AI genera scripts correctivos (JSON-LD, metadatos, Open Graph, Hreflang) inyectables automáticamente en su sitio. Elija el método que corresponda a su entorno técnico.'
              )}
            </p>
          </div>

          {/* ─── Résumé 3 méthodes ─── */}
          <Card className="mb-10 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t3(language, 'Quelle méthode choisir ?', 'Which method to choose?', '¿Qué método elegir?')}
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                <MethodSummaryCard
                  icon={Cable}
                  title={t3(language, 'API CMS', 'CMS API', 'API CMS')}
                  badge={t3(language, 'Recommandé', 'Recommended', 'Recomendado')}
                  desc={t3(language,
                    'Connexion directe via l\'API REST de votre CMS. Automatique, sans intervention manuelle.',
                    'Direct connection via your CMS REST API. Automatic, no manual intervention.',
                    'Conexión directa vía la API REST de su CMS. Automática, sin intervención manual.'
                  )}
                  cms={t3(language, 'WordPress, Shopify, Webflow', 'WordPress, Shopify, Webflow', 'WordPress, Shopify, Webflow')}
                />
                <MethodSummaryCard
                  icon={Plug}
                  title={t3(language, 'Plugin WordPress', 'WordPress Plugin', 'Plugin WordPress')}
                  desc={t3(language,
                    'Plugin .zip à installer. Synchronisation automatique toutes les 6h via WP Cron.',
                    'Install .zip plugin. Auto-sync every 6h via WP Cron.',
                    'Plugin .zip a instalar. Sincronización automática cada 6h vía WP Cron.'
                  )}
                  cms="WordPress"
                />
                <MethodSummaryCard
                  icon={Code}
                  title={t3(language, 'Google Tag Manager / Script', 'Google Tag Manager / Script', 'Google Tag Manager / Script')}
                  desc={t3(language,
                    'Snippet universel (~2 Ko). Compatible tous CMS et sites custom.',
                    'Universal snippet (~2 KB). Compatible with all CMS and custom sites.',
                    'Snippet universal (~2 KB). Compatible con todos los CMS y sitios personalizados.'
                  )}
                  cms={t3(language, 'Tous CMS', 'All CMS', 'Todos los CMS')}
                />
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ─── MÉTHODE 1 : API CMS ─── */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">1</div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Cable className="h-6 w-6 text-primary" />
                {t3(language, 'API CMS — Connexion directe', 'CMS API — Direct connection', 'API CMS — Conexión directa')}
              </h2>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                {t3(language, 'Recommandé', 'Recommended', 'Recomendado')}
              </Badge>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-6">
              {t3(language,
                'La méthode API connecte Crawlers.AI directement à l\'API REST de votre CMS. Une fois configurée, la synchronisation est entièrement automatique : les correctifs sont poussés vers votre site sans intervention manuelle.',
                'The API method connects Crawlers.AI directly to your CMS REST API. Once configured, synchronization is fully automatic: fixes are pushed to your site without manual intervention.',
                'El método API conecta Crawlers.AI directamente a la API REST de su CMS. Una vez configurada, la sincronización es totalmente automática: las correcciones se envían a su sitio sin intervención manual.'
              )}
            </p>

            <div className="space-y-4">
              <StepCard
                step={1}
                icon={Eye}
                title={t3(language, 'Ajoutez votre site à « Mes sites »', 'Add your site to "My Sites"', 'Agregue su sitio a "Mis sitios"')}
                description={t3(language,
                  'Lancez un audit, puis cliquez sur « Suivre ». Votre domaine apparaît dans la console avec une clé API unique.',
                  'Run an audit, then click "Track". Your domain appears in the console with a unique API key.',
                  'Ejecute una auditoría, luego haga clic en "Seguir". Su dominio aparece en la consola con una clave API única.'
                )}
              />
              <StepCard
                step={2}
                icon={Cable}
                title={t3(language, 'Ouvrez la modale « Brancher mon site »', 'Open the "Connect my site" modal', 'Abra el modal "Conectar mi sitio"')}
                description={t3(language,
                  'Cliquez sur l\'icône prise (🔌). Sélectionnez « API CMS » dans le sélecteur en haut de la modale.',
                  'Click the plug icon (🔌). Select "CMS API" in the selector at the top of the modal.',
                  'Haga clic en el ícono de enchufe (🔌). Seleccione "API CMS" en el selector en la parte superior del modal.'
                )}
              />
              <StepCard
                step={3}
                icon={Link2}
                title={t3(language, 'Connectez via le Lien Magique', 'Connect via Magic Link', 'Conéctese vía Enlace Mágico')}
                description={t3(language,
                  'Entrez l\'URL de votre site et cliquez sur « Lien Magique ». Un nouvel onglet s\'ouvre sur votre admin WordPress pour valider automatiquement la connexion. Pour les autres CMS, suivez les instructions spécifiques affichées.',
                  'Enter your site URL and click "Magic Link". A new tab opens to your WordPress admin to auto-validate the connection. For other CMS, follow the specific instructions displayed.',
                  'Ingrese la URL de su sitio y haga clic en "Enlace Mágico". Se abre una nueva pestaña en su admin de WordPress para validar automáticamente la conexión. Para otros CMS, siga las instrucciones específicas mostradas.'
                )}
              />
            </div>

            <Card className="mt-6 bg-muted/30">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t3(language, 'CMS supportés pour l\'API directe', 'Supported CMS for direct API', 'CMS soportados para API directa')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['WordPress', 'Shopify', 'Webflow', 'PrestaShop', 'Wix'].map(cms => (
                    <Badge key={cms} variant="secondary" className="text-xs">
                      <MonitorSmartphone className="h-3 w-3 mr-1" />{cms}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ─── MÉTHODE 2 : Plugin WordPress ─── */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">2</div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Plug className="h-6 w-6 text-primary" />
                {t3(language, 'Plugin WordPress — Installation classique', 'WordPress Plugin — Classic installation', 'Plugin WordPress — Instalación clásica')}
              </h2>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-6">
              {t3(language,
                'Si vous préférez une approche plugin traditionnelle, téléchargez le fichier .zip et installez-le comme n\'importe quel plugin WordPress. Il se synchronise automatiquement toutes les 6 heures via WP Cron.',
                'If you prefer a traditional plugin approach, download the .zip file and install it like any WordPress plugin. It auto-syncs every 6 hours via WP Cron.',
                'Si prefiere un enfoque de plugin tradicional, descargue el archivo .zip e instálelo como cualquier plugin de WordPress. Se sincroniza automáticamente cada 6 horas vía WP Cron.'
              )}
            </p>

            <div className="space-y-4">
              <StepCard
                step={1}
                icon={Download}
                title={t3(language, 'Téléchargez le plugin .zip', 'Download the .zip plugin', 'Descargue el plugin .zip')}
                description={t3(language,
                  'Depuis la modale « Brancher mon site », cliquez sur « Télécharger le Plugin .zip ». Le fichier contient votre clé API pré-configurée.',
                  'From the "Connect my site" modal, click "Download Plugin .zip". The file contains your pre-configured API key.',
                  'Desde el modal "Conectar mi sitio", haga clic en "Descargar Plugin .zip". El archivo contiene su clave API preconfigurada.'
                )}
              />
              <StepCard
                step={2}
                icon={Settings}
                title={t3(language, 'Installez dans WordPress', 'Install in WordPress', 'Instale en WordPress')}
                description={t3(language,
                  'Allez dans WordPress → Extensions → Ajouter → Téléverser une extension → Sélectionnez le .zip → Activez le plugin.',
                  'Go to WordPress → Plugins → Add New → Upload Plugin → Select the .zip → Activate the plugin.',
                  'Vaya a WordPress → Plugins → Añadir nuevo → Subir plugin → Seleccione el .zip → Active el plugin.'
                )}
              />
              <StepCard
                step={3}
                icon={RefreshCw}
                title={t3(language, 'Synchronisation automatique', 'Automatic sync', 'Sincronización automática')}
                description={t3(language,
                  'Le plugin interroge l\'API Crawlers.AI toutes les 6h pour récupérer les derniers correctifs. Les balises JSON-LD, meta tags et scripts sont injectés proprement via wp_head et wp_footer.',
                  'The plugin queries the Crawlers.AI API every 6h to retrieve the latest fixes. JSON-LD tags, meta tags, and scripts are cleanly injected via wp_head and wp_footer.',
                  'El plugin consulta la API de Crawlers.AI cada 6h para obtener las últimas correcciones. Las etiquetas JSON-LD, meta tags y scripts se inyectan limpiamente vía wp_head y wp_footer.'
                )}
              />
            </div>
          </section>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ─── MÉTHODE 3 : GTM / Script ─── */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">3</div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Code className="h-6 w-6 text-primary" />
                {t3(language, 'Google Tag Manager / Script universel', 'Google Tag Manager / Universal script', 'Google Tag Manager / Script universal')}
              </h2>
            </div>

            <p className="text-muted-foreground leading-relaxed mb-6">
              {t3(language,
                'La méthode la plus universelle : un snippet de 3 lignes compatible avec tous les CMS et sites custom. Collez-le dans GTM ou directement dans votre HTML.',
                'The most universal method: a 3-line snippet compatible with all CMS and custom sites. Paste it in GTM or directly in your HTML.',
                'El método más universal: un snippet de 3 líneas compatible con todos los CMS y sitios personalizados. Péguelo en GTM o directamente en su HTML.'
              )}
            </p>

            <div className="space-y-4">
              <StepCard
                step={1}
                icon={Code}
                title={t3(language, 'Copiez le snippet depuis la modale', 'Copy the snippet from the modal', 'Copie el snippet desde el modal')}
                description={t3(language,
                  'Dans « Brancher mon site » → onglet « API Google Tag Manager », copiez le snippet pré-rempli avec votre clé API.',
                  'In "Connect my site" → "Google Tag Manager API" tab, copy the snippet pre-filled with your API key.',
                  'En "Conectar mi sitio" → pestaña "API Google Tag Manager", copie el snippet pre-rellenado con su clave API.'
                )}
              >
                <div className="mt-4 rounded-lg bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs overflow-x-auto">
                  <code className="text-emerald-400">
                    {'<script>'}<br />
                    {'  window.CRAWLERS_API_KEY = "VOTRE-CLE-API";'}<br />
                    {'</script>'}<br />
                    {'<script src="https://crawlers.fr/widget.js" defer></script>'}
                  </code>
                </div>
              </StepCard>

              <StepCard
                step={2}
                icon={Settings}
                title={t3(language, 'Déployez via GTM ou directement', 'Deploy via GTM or directly', 'Despliegue vía GTM o directamente')}
                description={t3(language,
                  'Option A : Déploiement 1-clic via l\'API GTM (connectez votre compte Google). Option B : Nouvelle balise → HTML personnalisée → Collez → Déclencheur : All Pages → Publiez. Option C : Collez directement avant </head> dans votre code source.',
                  'Option A: 1-click deploy via GTM API (connect your Google account). Option B: New tag → Custom HTML → Paste → Trigger: All Pages → Publish. Option C: Paste directly before </head> in your source code.',
                  'Opción A: Despliegue 1-clic vía la API GTM (conecte su cuenta Google). Opción B: Nueva etiqueta → HTML personalizado → Pegue → Activador: All Pages → Publique. Opción C: Pegue directamente antes de </head> en su código fuente.'
                )}
              />
            </div>

            <Card className="mt-6 bg-muted/30">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  {t3(language, 'Compatible avec tous les CMS', 'Compatible with all CMS', 'Compatible con todos los CMS')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['WordPress', 'Shopify', 'Webflow', 'Wix', 'Squarespace', 'PrestaShop', 'Magento', 'Drupal', 'Next.js', 'Gatsby', t3(language, 'Site custom', 'Custom site', 'Sitio personalizado')].map(cms => (
                    <Badge key={cms} variant="secondary" className="text-xs">
                      <MonitorSmartphone className="h-3 w-3 mr-1" />{cms}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ─── Sandboxing sémantique ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {t3(language, 'Sandboxing sémantique : comment le code est isolé', 'Semantic sandboxing: how the code is isolated', 'Sandboxing semántico: cómo se aísla el código')}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t3(language,
                'Quelle que soit la méthode choisie, les scripts injectés par Crawlers.AI opèrent dans une couche d\'isolation DOM :',
                'Regardless of the method chosen, scripts injected by Crawlers.AI operate in a DOM isolation layer:',
                'Independientemente del método elegido, los scripts inyectados por Crawlers.AI operan en una capa de aislamiento DOM:'
              )}
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Layers,
                  title: t3(language, 'Isolation complète', 'Complete isolation', 'Aislamiento completo'),
                  desc: t3(language, 'Le script opère sur des éléments qu\'il crée lui-même (JSON-LD, <meta>). Il ne touche jamais au DOM existant.', 'The script operates on elements it creates itself. It never touches the existing DOM.', 'El script opera sobre elementos que crea él mismo. Nunca toca el DOM existente.'),
                },
                {
                  icon: RefreshCw,
                  title: t3(language, 'Réversibilité totale', 'Total reversibility', 'Reversibilidad total'),
                  desc: t3(language, 'Débranchez le site : les éléments injectés disparaissent instantanément au prochain chargement.', 'Disconnect the site: injected elements disappear instantly on next load.', 'Desconecte el sitio: los elementos inyectados desaparecen instantáneamente en la próxima carga.'),
                },
                {
                  icon: ShieldCheck,
                  title: t3(language, 'Aucun conflit CSS/JS', 'No CSS/JS conflicts', 'Sin conflictos CSS/JS'),
                  desc: t3(language, 'Aucun stylesheet, aucun listener. Seules les métadonnées et données structurées sont enrichies.', 'No stylesheets, no event listeners. Only metadata and structured data are enriched.', 'Sin hojas de estilo, sin listeners. Solo los metadatos y datos estructurados se enriquecen.'),
                },
              ].map(({ icon: Icon, title, desc }, i) => (
                <Card key={i} className="bg-card">
                  <CardContent className="p-5">
                    <Icon className="h-6 w-6 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* ─── Débrancher mon site ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Unplug className="h-6 w-6 text-destructive" />
              {t3(language, '« Débrancher mon site » — Contrôle total', '"Disconnect my site" — Total control', '"Desconectar mi sitio" — Control total')}
            </h2>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Vous gardez le contrôle absolu. À tout moment, depuis votre console (Mes sites), vous pouvez débrancher un site en un clic :',
                  'You keep absolute control. At any time, from your console (My Sites), you can disconnect a site in one click:',
                  'Usted mantiene el control absoluto. En cualquier momento, desde su consola (Mis sitios), puede desconectar un sitio con un clic:'
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-semibold text-foreground">{t3(language, 'Action', 'Action', 'Acción')}</th>
                      <th className="text-left p-3 font-semibold text-foreground">{t3(language, 'Ce qui se passe', 'What happens', 'Qué sucede')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-foreground flex items-center gap-2">
                        <Plug className="h-4 w-4 text-primary" />
                        {t3(language, 'Brancher', 'Connect', 'Conectar')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t3(language,
                          'Active la synchronisation. L\'icône passe en vert. Le ping de connectivité démarre.',
                          'Activates sync. Icon turns green. Connectivity ping starts.',
                          'Activa la sincronización. El ícono se vuelve verde. El ping de conectividad comienza.'
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-foreground flex items-center gap-2">
                        <Unplug className="h-4 w-4 text-destructive" />
                        {t3(language, 'Débrancher', 'Disconnect', 'Desconectar')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t3(language,
                          'Le code correctif cesse d\'être injecté. Configuration conservée mais inactive. Aucun résidu.',
                          'Corrective code stops being injected. Configuration retained but inactive. No residue.',
                          'El código correctivo deja de inyectarse. Configuración conservada pero inactiva. Ningún residuo.'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground flex items-center gap-2">
                        <ToggleRight className="h-4 w-4 text-primary" />
                        {t3(language, 'Rebrancher', 'Reconnect', 'Reconectar')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t3(language,
                          'Réactive la dernière configuration. Pas besoin de reconfigurer : l\'injection reprend instantanément.',
                          'Reactivates the last configuration. No need to reconfigure: injection resumes instantly.',
                          'Reactiva la última configuración. No es necesario reconfigurar: la inyección se reanuda instantáneamente.'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t3(language, 'Questions fréquentes', 'Frequently Asked Questions', 'Preguntas frecuentes')}
            </h2>
            <Accordion type="single" collapsible className="space-y-2">
              {[
                {
                  q: t3(language, 'Le code injecté ralentit-il mon site ?', 'Does the injected code slow down my site?', '¿El código inyectado ralentiza mi sitio?'),
                  a: t3(language,
                    'Non. Le plugin WordPress pèse < 50 Ko. Le snippet GTM pèse ~2 Ko et s\'exécute en mode defer. Exécution 100% asynchrone, zéro impact sur les Core Web Vitals (LCP, FID, CLS).',
                    'No. The WordPress plugin weighs < 50 KB. The GTM snippet weighs ~2 KB and runs in defer mode. 100% asynchronous execution, zero impact on Core Web Vitals (LCP, FID, CLS).',
                    'No. El plugin de WordPress pesa < 50 KB. El snippet GTM pesa ~2 KB y se ejecuta en modo defer. Ejecución 100% asíncrona, cero impacto en Core Web Vitals (LCP, FID, CLS).'
                  ),
                },
                {
                  q: t3(language, 'Les robots de Google voient-ils le code injecté ?', 'Do Google bots see the injected code?', '¿Los robots de Google ven el código inyectado?'),
                  a: t3(language,
                    'Oui. Googlebot exécute JavaScript depuis 2019 (Evergreen rendering). Les balises JSON-LD, meta et Open Graph injectées sont indexées normalement.',
                    'Yes. Googlebot has executed JavaScript since 2019 (Evergreen rendering). Injected JSON-LD, meta, and Open Graph tags are indexed normally.',
                    'Sí. Googlebot ejecuta JavaScript desde 2019 (renderizado Evergreen). Las etiquetas JSON-LD, meta y Open Graph inyectadas son indexadas normalmente.'
                  ),
                },
                {
                  q: t3(language, 'Quelle est la différence entre l\'API CMS et le plugin WordPress ?', 'What\'s the difference between the CMS API and the WordPress plugin?', '¿Cuál es la diferencia entre la API CMS y el plugin WordPress?'),
                  a: t3(language,
                    'L\'API CMS utilise le Lien Magique pour connecter directement Crawlers.AI à l\'API REST de WordPress. Le plugin .zip est une installation manuelle classique. Les deux méthodes offrent la synchronisation automatique.',
                    'The CMS API uses the Magic Link to directly connect Crawlers.AI to the WordPress REST API. The .zip plugin is a classic manual installation. Both methods offer automatic synchronization.',
                    'La API CMS usa el Enlace Mágico para conectar directamente Crawlers.AI a la API REST de WordPress. El plugin .zip es una instalación manual clásica. Ambos métodos ofrecen sincronización automática.'
                  ),
                },
                {
                  q: t3(language, 'Puis-je débrancher mon site à tout moment ?', 'Can I disconnect my site at any time?', '¿Puedo desconectar mi sitio en cualquier momento?'),
                  a: t3(language,
                    'Oui. Un clic suffit depuis Mes sites. Le code correctif cesse immédiatement d\'être injecté. Aucun résidu ne reste sur votre site. C\'est réversible et instantané.',
                    'Yes. One click from My Sites. Corrective code stops being injected immediately. No residue remains on your site. It\'s reversible and instant.',
                    'Sí. Un clic desde Mis sitios. El código correctivo deja de inyectarse inmediatamente. Ningún residuo permanece en su sitio. Es reversible e instantáneo.'
                  ),
                },
                {
                  q: t3(language, 'L\'intégration est-elle gratuite ?', 'Is the integration free?', '¿La integración es gratuita?'),
                  a: t3(language,
                    'Oui. La connexion est entièrement gratuite. Seule la génération des codes correctifs consomme des crédits (1 crédit par génération, ou illimité avec l\'abonnement Pro Agency).',
                    'Yes. The connection is completely free. Only corrective code generation consumes credits (1 credit per generation, or unlimited with Pro Agency subscription).',
                    'Sí. La conexión es completamente gratuita. Solo la generación de códigos correctivos consume créditos (1 crédito por generación, o ilimitado con la suscripción Pro Agency).'
                  ),
                },
              ].map(({ q, a }, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* ─── CTA ─── */}
          <div className="text-center py-8">
            <h2 className="text-xl font-bold text-foreground mb-3">
              {t3(language, 'Prêt à brancher votre site ?', 'Ready to connect your site?', '¿Listo para conectar su sitio?')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t3(language,
                'Lancez un audit gratuit, suivez votre site, choisissez votre méthode — et laissez l\'Architecte faire le reste.',
                'Run a free audit, track your site, choose your method — and let the Architect do the rest.',
                'Ejecute una auditoría gratuita, siga su sitio, elija su método — y deje que el Arquitecto haga el resto.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="gap-2">
                <Link to="/audit-expert">
                  <Zap className="h-4 w-4" />
                  {t3(language, 'Lancer mon Audit Expert', 'Run my Expert Audit', 'Ejecutar mi Auditoría Experta')}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link to="/modifier-code-wordpress">
                  <FileCode className="h-4 w-4" />
                  {t3(language, 'Guide WordPress détaillé', 'Detailed WordPress Guide', 'Guía WordPress detallada')}
                </Link>
              </Button>
            </div>
          </div>

        </div>
      </main>
      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}

/* ─── Method summary sub-component ─── */
function MethodSummaryCard({ icon: Icon, title, badge, desc, cms }: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  desc: string;
  cms: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge && (
          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">{badge}</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      <p className="text-[10px] text-muted-foreground/70">{cms}</p>
    </div>
  );
}

/* ─── Step card sub-component ─── */
function StepCard({ step, icon: Icon, title, description, children }: {
  step: number;
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {step}
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>
      <div className="pb-6">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
        {children}
      </div>
    </div>
  );
}
