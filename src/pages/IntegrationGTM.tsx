import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Code, Globe, Zap, ShieldCheck,
  Plug, Unplug, Settings, Eye, RefreshCw, Timer, Layers, FileCode,
  MonitorSmartphone, ToggleRight, Wrench, AlertTriangle, Sparkles
} from 'lucide-react';
import { t3 } from '@/utils/i18n';

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
          'Intégration Google Tag Manager — Déployer vos correctifs SEO/GEO en 30 secondes',
          'Google Tag Manager Integration — Deploy your SEO/GEO fixes in 30 seconds',
          'Integración Google Tag Manager — Despliegue sus correcciones SEO/GEO en 30 segundos'
        ),
        'description': t3(language,
          'Guide complet pour connecter Crawlers.fr à votre site via GTM. Injection asynchrone de code correctif, sandboxing sémantique et débranchage instantané.',
          'Complete guide to connect Crawlers.fr to your site via GTM. Asynchronous corrective code injection, semantic sandboxing and instant disconnect.',
          'Guía completa para conectar Crawlers.fr a su sitio via GTM. Inyección asíncrona de código correctivo, sandboxing semántico y desconexión instantánea.'
        ),
        'author': { '@type': 'Organization', 'name': 'Crawlers.fr', 'url': SITE_URL },
        'publisher': { '@type': 'Organization', 'name': 'Crawlers.fr', 'url': SITE_URL },
        'datePublished': '2026-03-12',
        'dateModified': '2026-03-12',
        'mainEntityOfPage': `${SITE_URL}/integration-gtm`,
        'inLanguage': language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      },
      {
        '@type': 'HowTo',
        'name': t3(language,
          'Comment connecter votre site à Crawlers.fr via Google Tag Manager',
          'How to connect your site to Crawlers.fr via Google Tag Manager',
          'Cómo conectar su sitio a Crawlers.fr via Google Tag Manager'
        ),
        'step': [
          {
            '@type': 'HowToStep',
            'position': 1,
            'name': t3(language, 'Suivre votre site', 'Track your site', 'Seguir su sitio'),
            'text': t3(language,
              'Lancez un audit expert puis cliquez sur « Suivre » pour ajouter votre domaine à Mes sites.',
              'Run an expert audit then click "Track" to add your domain to My Sites.',
              'Ejecute una auditoría experta y haga clic en "Seguir" para agregar su dominio a Mis sitios.'
            ),
          },
          {
            '@type': 'HowToStep',
            'position': 2,
            'name': t3(language, 'Copier le snippet GTM', 'Copy the GTM snippet', 'Copiar el snippet GTM'),
            'text': t3(language,
              'Dans Mes sites, cliquez sur l\'icône prise (Brancher mon site) pour afficher le snippet de 3 lignes.',
              'In My Sites, click the plug icon (Connect my site) to display the 3-line snippet.',
              'En Mis sitios, haga clic en el ícono de enchufe (Conectar mi sitio) para ver el snippet de 3 líneas.'
            ),
          },
          {
            '@type': 'HowToStep',
            'position': 3,
            'name': t3(language, 'Coller dans GTM', 'Paste into GTM', 'Pegar en GTM'),
            'text': t3(language,
              'Créez une balise HTML personnalisée dans GTM, collez le snippet, déclencheur : All Pages, puis publiez.',
              'Create a Custom HTML tag in GTM, paste the snippet, trigger: All Pages, then publish.',
              'Cree una etiqueta HTML personalizada en GTM, pegue el snippet, activador: All Pages, y publique.'
            ),
          },
          {
            '@type': 'HowToStep',
            'position': 4,
            'name': t3(language, 'Générer et injecter les correctifs', 'Generate and inject fixes', 'Generar e inyectar correcciones'),
            'text': t3(language,
              'Depuis l\'Architecte Génératif, cliquez sur Injecter. Le code s\'exécute de manière asynchrone sur votre site sans bloquer le rendu.',
              'From the Generative Architect, click Inject. The code runs asynchronously on your site without blocking rendering.',
              'Desde el Arquitecto Generativo, haga clic en Inyectar. El código se ejecuta de forma asíncrona sin bloquear el renderizado.'
            ),
          },
        ],
      },
      {
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': t3(language, 'Le code GTM ralentit-il mon site ?', 'Does the GTM code slow down my site?', '¿El código GTM ralentiza mi sitio?'),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Non. Le snippet s\'exécute de manière asynchrone (async) et n\'intervient qu\'après le chargement complet de la page (DOMContentLoaded). Il n\'impacte ni le LCP, ni le FID, ni le CLS.',
                'No. The snippet runs asynchronously and only executes after full page load (DOMContentLoaded). It does not impact LCP, FID, or CLS.',
                'No. El snippet se ejecuta de forma asíncrona y solo interviene después de la carga completa de la página (DOMContentLoaded). No afecta al LCP, FID ni CLS.'
              ),
            },
          },
          {
            '@type': 'Question',
            'name': t3(language, 'Puis-je débrancher mon site à tout moment ?', 'Can I disconnect my site at any time?', '¿Puedo desconectar mi sitio en cualquier momento?'),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Oui. Depuis Mes sites, cliquez sur l\'icône Débrancher (Unplug). Le code correctif cesse immédiatement d\'être injecté. Aucun résidu ne reste sur votre site.',
                'Yes. From My Sites, click the Disconnect (Unplug) icon. The corrective code immediately stops being injected. No residue remains on your site.',
                'Sí. Desde Mis sitios, haga clic en el ícono Desconectar (Unplug). El código correctivo deja de inyectarse inmediatamente. No queda ningún residuo en su sitio.'
              ),
            },
          },
          {
            '@type': 'Question',
            'name': t3(language, 'Quels CMS sont compatibles ?', 'Which CMS are compatible?', '¿Qué CMS son compatibles?'),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Tous les CMS supportant Google Tag Manager : WordPress, Shopify, Webflow, Wix, Squarespace, PrestaShop, Magento, et tout site acceptant un tag <script>.',
                'All CMS supporting Google Tag Manager: WordPress, Shopify, Webflow, Wix, Squarespace, PrestaShop, Magento, and any site accepting a <script> tag.',
                'Todos los CMS que soportan Google Tag Manager: WordPress, Shopify, Webflow, Wix, Squarespace, PrestaShop, Magento, y cualquier sitio que acepte un tag <script>.'
              ),
            },
          },
        ],
      },
    ],
  };

  // Inject structured data via Helmet script tag

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Helmet>
        <html lang={language} />
        <title>{t3(language,
          'Intégration GTM — Déployer ses correctifs SEO/GEO automatiquement | Crawlers.fr',
          'GTM Integration — Auto-deploy SEO/GEO fixes | Crawlers.fr',
          'Integración GTM — Desplegar correcciones SEO/GEO automáticamente | Crawlers.fr'
        )}</title>
        <meta name="description" content={t3(language,
          'Connectez Crawlers.fr à votre site via Google Tag Manager en 30 secondes. Injection asynchrone, sandboxing sémantique, débranchage instantané. Compatible WordPress, Shopify, Webflow.',
          'Connect Crawlers.fr to your site via Google Tag Manager in 30 seconds. Async injection, semantic sandboxing, instant disconnect. Compatible with WordPress, Shopify, Webflow.',
          'Conecte Crawlers.fr a su sitio via Google Tag Manager en 30 segundos. Inyección asíncrona, sandboxing semántico, desconexión instantánea. Compatible con WordPress, Shopify, Webflow.'
        )} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content={language === 'fr' ? 'fr_FR' : language === 'es' ? 'es_ES' : 'en_US'} />
        <meta property="og:locale:alternate" content="fr_FR" />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:locale:alternate" content="es_ES" />
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
                'Intégration Google Tag Manager — Déployez vos correctifs SEO et GEO en 30 secondes',
                'Google Tag Manager Integration — Deploy your SEO & GEO fixes in 30 seconds',
                'Integración Google Tag Manager — Despliegue sus correcciones SEO y GEO en 30 segundos'
              )}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t3(language,
                'Crawlers.fr génère des scripts correctifs (JSON-LD, métadonnées, Open Graph, balises Hreflang) que vous pouvez injecter automatiquement sur votre site via Google Tag Manager — sans toucher au code source, sans développeur, et sans risque pour les performances.',
                'Crawlers.fr generates corrective scripts (JSON-LD, metadata, Open Graph, Hreflang tags) that you can automatically inject on your site via Google Tag Manager — without touching source code, without a developer, and without performance risk.',
                'Crawlers.fr genera scripts correctivos (JSON-LD, metadatos, Open Graph, etiquetas Hreflang) que puede inyectar automáticamente en su sitio vía Google Tag Manager — sin tocar el código fuente, sin desarrollador, y sin riesgo para el rendimiento.'
              )}
            </p>
          </div>

          {/* ─── Résumé ─── */}
          <Card className="mb-10 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t3(language, 'En résumé', 'Summary', 'En resumen')}
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: Timer, text: t3(language, '30 secondes pour brancher', '30 seconds to connect', '30 segundos para conectar') },
                  { icon: Zap, text: t3(language, 'Exécution 100% asynchrone', '100% asynchronous execution', 'Ejecución 100% asíncrona') },
                  { icon: ShieldCheck, text: t3(language, 'Sandboxing sémantique (isolation DOM)', 'Semantic sandboxing (DOM isolation)', 'Sandboxing semántico (aislamiento DOM)') },
                  { icon: Unplug, text: t3(language, 'Débranchage instantané, zéro résidu', 'Instant disconnect, zero residue', 'Desconexión instantánea, cero residuo') },
                  { icon: Globe, text: t3(language, 'Compatible tous CMS (WordPress, Shopify, Webflow…)', 'All CMS compatible (WordPress, Shopify, Webflow…)', 'Compatible con todos los CMS (WordPress, Shopify, Webflow…)') },
                  { icon: Eye, text: t3(language, 'Ping de connectivité temps réel', 'Real-time connectivity ping', 'Ping de conectividad en tiempo real') },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-foreground">{text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Le Workflow complet ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t3(language, 'Le workflow complet : de l\'audit à l\'injection', 'The complete workflow: from audit to injection', 'El workflow completo: de la auditoría a la inyección')}
            </h2>

            <div className="space-y-6">
              {/* Étape 1 */}
              <StepCard
                step={1}
                icon={Eye}
                title={t3(language, 'Lancer un Audit Expert', 'Run an Expert Audit', 'Ejecutar una Auditoría Experta')}
                description={t3(language,
                  'Depuis la page d\'accueil ou /audit-expert, analysez votre site. Crawlers.fr évalue plus de 200 critères SEO et GEO (Core Web Vitals, JSON-LD, robots.txt, sémantique, visibilité LLM).',
                  'From the homepage or /audit-expert, analyze your site. Crawlers.fr evaluates over 200 SEO and GEO criteria (Core Web Vitals, JSON-LD, robots.txt, semantics, LLM visibility).',
                  'Desde la página principal o /audit-expert, analice su sitio. Crawlers.fr evalúa más de 200 criterios SEO y GEO (Core Web Vitals, JSON-LD, robots.txt, semántica, visibilidad LLM).'
                )}
              />

              {/* Étape 2 */}
              <StepCard
                step={2}
                icon={Plug}
                title={t3(language, 'Suivre votre site dans « Mes sites »', 'Track your site in "My Sites"', 'Seguir su sitio en "Mis sitios"')}
                description={t3(language,
                  'Cliquez sur le bouton « Suivre » en haut à droite des résultats. Votre domaine est ajouté à votre console avec une clé API unique (UUID). C\'est cette clé qui authentifie la connexion entre votre site et Crawlers.fr.',
                  'Click the "Track" button at the top right of the results. Your domain is added to your console with a unique API key (UUID). This key authenticates the connection between your site and Crawlers.fr.',
                  'Haga clic en el botón "Seguir" en la parte superior derecha de los resultados. Su dominio se agrega a su consola con una clave API única (UUID). Esta clave autentica la conexión entre su sitio y Crawlers.fr.'
                )}
              />

              {/* Étape 3 */}
              <StepCard
                step={3}
                icon={Code}
                title={t3(language, 'Copier le snippet de connexion', 'Copy the connection snippet', 'Copiar el snippet de conexión')}
                description={t3(language,
                  'Dans Mes sites, cliquez sur l\'icône prise (🔌 Brancher mon site). Une modale affiche un snippet universel de 3 lignes prêt à coller :',
                  'In My Sites, click the plug icon (🔌 Connect my site). A modal displays a universal 3-line snippet ready to paste:',
                  'En Mis sitios, haga clic en el ícono de enchufe (🔌 Conectar mi sitio). Un modal muestra un snippet universal de 3 líneas listo para pegar:'
                )}
              >
                <div className="mt-4 rounded-lg bg-muted/80 border border-border p-4 font-mono text-xs overflow-x-auto">
                  <code className="text-foreground">
                    {'<script>'}<br />
                    {'  fetch("https://[votre-backend]/functions/v1/widget-connect", {'}<br />
                    {'    method: "POST",'}<br />
                    {'    headers: { "Content-Type": "application/json" },'}<br />
                    {'    body: JSON.stringify({ apiKey: "VOTRE-CLE-API", urlDuClient: window.location.href })'}<br />
                    {'  });'}<br />
                    {'</script>'}
                  </code>
                </div>
              </StepCard>

              {/* Étape 4 */}
              <StepCard
                step={4}
                icon={Settings}
                title={t3(language, 'Coller dans Google Tag Manager', 'Paste into Google Tag Manager', 'Pegar en Google Tag Manager')}
                description={t3(language,
                  'Dans GTM, créez une nouvelle balise → Type : HTML personnalisé → Collez le snippet → Déclencheur : All Pages → Publiez. Le widget envoie un ping de connectivité à chaque visite, confirmant que votre site est bien branché.',
                  'In GTM, create a new tag → Type: Custom HTML → Paste the snippet → Trigger: All Pages → Publish. The widget sends a connectivity ping on every visit, confirming your site is connected.',
                  'En GTM, cree una nueva etiqueta → Tipo: HTML personalizado → Pegue el snippet → Activador: All Pages → Publique. El widget envía un ping de conectividad en cada visita, confirmando que su sitio está conectado.'
                )}
              />

              {/* Étape 5 */}
              <StepCard
                step={5}
                icon={Wrench}
                title={t3(language, 'Générer un code correctif avec l\'Architecte Génératif', 'Generate corrective code with the Generative Architect', 'Generar código correctivo con el Arquitecto Generativo')}
                description={t3(language,
                  'Depuis les résultats d\'audit, ouvrez l\'Architecte Génératif (<code correctif>). Configurez vos fixes (JSON-LD, meta tags, Open Graph, Twitter Cards, Hreflang, contenu Markdown optimisé IA). Le moteur vérifie la connectivité du widget avant d\'autoriser l\'injection.',
                  'From the audit results, open the Generative Architect (<corrective code>). Configure your fixes (JSON-LD, meta tags, Open Graph, Twitter Cards, Hreflang, AI-optimized Markdown content). The engine checks widget connectivity before authorizing injection.',
                  'Desde los resultados de auditoría, abra el Arquitecto Generativo (<código correctivo>). Configure sus correcciones (JSON-LD, meta tags, Open Graph, Twitter Cards, Hreflang, contenido Markdown optimizado IA). El motor verifica la conectividad del widget antes de autorizar la inyección.'
                )}
              />

              {/* Étape 6 */}
              <StepCard
                step={6}
                icon={Zap}
                title={t3(language, 'Injecter — Le code s\'exécute de manière asynchrone', 'Inject — The code runs asynchronously', 'Inyectar — El código se ejecuta de forma asíncrona')}
                description={t3(language,
                  'Cliquez sur « Injecter ». Le script est poussé vers votre site via l\'API widget-connect. Il s\'exécute de manière asynchrone (async), c\'est-à-dire qu\'il ne bloque jamais le rendu de la page : le navigateur charge d\'abord votre contenu, puis le script s\'applique silencieusement en arrière-plan. Résultat : aucun impact sur les Core Web Vitals (LCP, FID, CLS).',
                  'Click "Inject". The script is pushed to your site via the widget-connect API. It runs asynchronously (async), meaning it never blocks page rendering: the browser loads your content first, then the script applies silently in the background. Result: zero impact on Core Web Vitals (LCP, FID, CLS).',
                  'Haga clic en "Inyectar". El script se envía a su sitio a través de la API widget-connect. Se ejecuta de forma asíncrona (async), es decir, nunca bloquea el renderizado de la página: el navegador carga primero su contenido, luego el script se aplica silenciosamente en segundo plano. Resultado: cero impacto en los Core Web Vitals (LCP, FID, CLS).'
                )}
              />
            </div>
          </section>

          {/* ─── Sandboxing sémantique ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {t3(language, 'Sandboxing sémantique : comment le code est isolé', 'Semantic sandboxing: how the code is isolated', 'Sandboxing semántico: cómo se aísla el código')}
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              {t3(language,
                'Les scripts injectés par Crawlers.fr ne modifient pas votre code source. Ils opèrent dans une couche d\'isolation DOM (sandboxing sémantique) qui garantit :',
                'Scripts injected by Crawlers.fr do not modify your source code. They operate in a DOM isolation layer (semantic sandboxing) that ensures:',
                'Los scripts inyectados por Crawlers.fr no modifican su código fuente. Operan en una capa de aislamiento DOM (sandboxing semántico) que garantiza:'
              )}
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Layers,
                  title: t3(language, 'Isolation complète', 'Complete isolation', 'Aislamiento completo'),
                  desc: t3(language, 'Le script opère sur des éléments qu\'il crée lui-même (<script type="application/ld+json">, <meta>). Il ne touche jamais au DOM existant.', 'The script operates on elements it creates itself. It never touches the existing DOM.', 'El script opera sobre elementos que crea él mismo. Nunca toca el DOM existente.'),
                },
                {
                  icon: RefreshCw,
                  title: t3(language, 'Réversibilité totale', 'Total reversibility', 'Reversibilidad total'),
                  desc: t3(language, 'Supprimez la balise GTM ou débranchez le site : les éléments injectés disparaissent instantanément au prochain chargement.', 'Remove the GTM tag or disconnect the site: injected elements disappear instantly on next load.', 'Elimine la etiqueta GTM o desconecte el sitio: los elementos inyectados desaparecen instantáneamente en la próxima carga.'),
                },
                {
                  icon: ShieldCheck,
                  title: t3(language, 'Aucun conflit CSS/JS', 'No CSS/JS conflicts', 'Sin conflictos CSS/JS'),
                  desc: t3(language, 'Aucun stylesheet, aucun listener d\'événement, aucune modification visuelle. Seules les métadonnées et données structurées sont enrichies.', 'No stylesheets, no event listeners, no visual changes. Only metadata and structured data are enriched.', 'Sin hojas de estilo, sin listeners de eventos, sin cambios visuales. Solo los metadatos y datos estructurados se enriquecen.'),
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
              {t3(language, '« Débrancher mon site » — Contrôle total et instantané', '"Disconnect my site" — Total and instant control', '"Desconectar mi sitio" — Control total e instantáneo')}
            </h2>
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                {t3(language,
                  'Vous gardez le contrôle absolu de la connexion. À tout moment, depuis votre console (Mes sites), vous pouvez débrancher un site en un clic :',
                  'You keep absolute control of the connection. At any time, from your console (My Sites), you can disconnect a site in one click:',
                  'Usted mantiene el control absoluto de la conexión. En cualquier momento, desde su consola (Mis sitios), puede desconectar un sitio con un clic:'
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
                        <Plug className="h-4 w-4 text-emerald-500" />
                        {t3(language, 'Brancher mon site', 'Connect my site', 'Conectar mi sitio')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t3(language,
                          'Affiche le snippet GTM, active la synchronisation, l\'icône prise devient verte. Le ping widget démarre.',
                          'Shows the GTM snippet, activates sync, the plug icon turns green. Widget ping starts.',
                          'Muestra el snippet GTM, activa la sincronización, el ícono de enchufe se vuelve verde. El ping del widget comienza.'
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="p-3 font-medium text-foreground flex items-center gap-2">
                        <Unplug className="h-4 w-4 text-destructive" />
                        {t3(language, 'Débrancher mon site', 'Disconnect my site', 'Desconectar mi sitio')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t3(language,
                          'Le code correctif cesse d\'être injecté. La configuration (current_config) est conservée mais inactive. L\'icône prise repasse en mode « brancher ». Aucun résidu sur votre site.',
                          'Corrective code stops being injected. Configuration (current_config) is retained but inactive. Plug icon switches back to "connect" mode. No residue on your site.',
                          'El código correctivo deja de inyectarse. La configuración (current_config) se conserva pero inactiva. El ícono de enchufe vuelve al modo "conectar". Ningún residuo en su sitio.'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-foreground flex items-center gap-2">
                        <ToggleRight className="h-4 w-4 text-amber-500" />
                        {t3(language, 'Rebrancher', 'Reconnect', 'Reconectar')}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {t3(language,
                          'Réactive la dernière configuration sauvegardée. Pas besoin de reconfigurer les correctifs : l\'injection reprend instantanément.',
                          'Reactivates the last saved configuration. No need to reconfigure fixes: injection resumes instantly.',
                          'Reactiva la última configuración guardada. No es necesario reconfigurar las correcciones: la inyección se reanuda instantáneamente.'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ─── Tableau comparatif ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {t3(language, 'GTM vs modification directe du code source', 'GTM vs direct source code modification', 'GTM vs modificación directa del código fuente')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-border rounded-lg" role="table">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-semibold text-foreground border-b border-border">{t3(language, 'Critère', 'Criteria', 'Criterio')}</th>
                    <th className="text-center p-3 font-semibold text-foreground border-b border-border">
                      {t3(language, 'Via GTM (Crawlers)', 'Via GTM (Crawlers)', 'Via GTM (Crawlers)')}
                    </th>
                    <th className="text-center p-3 font-semibold text-foreground border-b border-border">
                      {t3(language, 'Code source direct', 'Direct source code', 'Código fuente directo')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [t3(language, 'Temps de déploiement', 'Deployment time', 'Tiempo de despliegue'), '30 sec', t3(language, '30 min – 2h', '30 min – 2h', '30 min – 2h')],
                    [t3(language, 'Compétence technique', 'Technical skill', 'Competencia técnica'), t3(language, 'Aucune', 'None', 'Ninguna'), t3(language, 'HTML/PHP/JS', 'HTML/PHP/JS', 'HTML/PHP/JS')],
                    [t3(language, 'Risque de casser le site', 'Risk of breaking site', 'Riesgo de romper el sitio'), t3(language, 'Zéro (isolation DOM)', 'Zero (DOM isolation)', 'Cero (aislamiento DOM)'), t3(language, 'Modéré', 'Moderate', 'Moderado')],
                    [t3(language, 'Réversibilité', 'Reversibility', 'Reversibilidad'), t3(language, 'Instantanée (1 clic)', 'Instant (1 click)', 'Instantánea (1 clic)'), t3(language, 'Git revert / backup', 'Git revert / backup', 'Git revert / backup')],
                    [t3(language, 'Impact Core Web Vitals', 'Core Web Vitals impact', 'Impacto Core Web Vitals'), t3(language, 'Aucun (async)', 'None (async)', 'Ninguno (async)'), t3(language, 'Variable', 'Variable', 'Variable')],
                    [t3(language, 'Mise à jour centralisée', 'Centralized updates', 'Actualización centralizada'), '✅', '❌'],
                  ].map(([label, gtm, direct], i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-3 font-medium text-foreground">{label}</td>
                      <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-medium">{gtm}</td>
                      <td className="p-3 text-center text-muted-foreground">{direct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ─── Compatibilité CMS ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {t3(language, 'Compatibilité CMS & plateformes', 'CMS & Platform Compatibility', 'Compatibilidad CMS & plataformas')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {['WordPress', 'Shopify', 'Webflow', 'Wix', 'Squarespace', 'PrestaShop', 'Magento', 'Drupal', 'Joomla', 'Next.js', 'Gatsby', 'Hugo', t3(language, 'Site custom', 'Custom site', 'Sitio personalizado')].map((cms) => (
                <Badge key={cms} variant="secondary" className="text-sm px-3 py-1.5">
                  <MonitorSmartphone className="h-3.5 w-3.5 mr-1.5" />
                  {cms}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              {t3(language,
                'Tout site acceptant un tag <script> ou intégrant Google Tag Manager est compatible.',
                'Any site accepting a <script> tag or integrating Google Tag Manager is compatible.',
                'Cualquier sitio que acepte un tag <script> o integre Google Tag Manager es compatible.'
              )}
            </p>
          </section>

          {/* ─── FAQ ─── */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">
              {t3(language, 'Questions fréquentes', 'Frequently Asked Questions', 'Preguntas frecuentes')}
            </h2>
            <Accordion type="single" collapsible className="space-y-2">
              {[
                {
                  q: t3(language, 'Le snippet GTM ralentit-il mon site ?', 'Does the GTM snippet slow down my site?', '¿El snippet GTM ralentiza mi sitio?'),
                  a: t3(language,
                    'Non. Le code s\'exécute de manière asynchrone après le DOMContentLoaded. Il n\'intervient qu\'une fois la page entièrement chargée, garantissant zéro impact sur le LCP (Largest Contentful Paint), le FID (First Input Delay) et le CLS (Cumulative Layout Shift).',
                    'No. The code runs asynchronously after DOMContentLoaded. It only executes once the page is fully loaded, ensuring zero impact on LCP, FID, and CLS.',
                    'No. El código se ejecuta de forma asíncrona después del DOMContentLoaded. Solo interviene una vez que la página está completamente cargada, garantizando cero impacto en LCP, FID y CLS.'
                  ),
                },
                {
                  q: t3(language, 'Les robots de Google voient-ils le code injecté via GTM ?', 'Do Google bots see code injected via GTM?', '¿Los robots de Google ven el código inyectado vía GTM?'),
                  a: t3(language,
                    'Oui. Googlebot exécute JavaScript depuis 2019 (Evergreen rendering). Les balises JSON-LD, meta et Open Graph injectées via GTM sont indexées normalement par Google et les autres moteurs.',
                    'Yes. Googlebot has executed JavaScript since 2019 (Evergreen rendering). JSON-LD, meta, and Open Graph tags injected via GTM are indexed normally by Google and other search engines.',
                    'Sí. Googlebot ejecuta JavaScript desde 2019 (renderizado Evergreen). Las etiquetas JSON-LD, meta y Open Graph inyectadas vía GTM son indexadas normalmente por Google y otros motores.'
                  ),
                },
                {
                  q: t3(language, 'Puis-je utiliser l\'intégration sans GTM ?', 'Can I use the integration without GTM?', '¿Puedo usar la integración sin GTM?'),
                  a: t3(language,
                    'Oui. Le snippet peut être collé directement dans votre code HTML avant la balise </head>. GTM est simplement la méthode la plus pratique pour les non-développeurs.',
                    'Yes. The snippet can be pasted directly into your HTML before the </head> tag. GTM is simply the most convenient method for non-developers.',
                    'Sí. El snippet se puede pegar directamente en su HTML antes de la etiqueta </head>. GTM es simplemente el método más conveniente para los no-desarrolladores.'
                  ),
                },
                {
                  q: t3(language, 'Que se passe-t-il si le ping widget échoue ?', 'What happens if the widget ping fails?', '¿Qué sucede si el ping del widget falla?'),
                  a: t3(language,
                    'Si aucun ping n\'est reçu depuis plus de 24 heures, l\'Architecte Génératif bloque l\'injection et affiche un message « Branchez votre site ». Le système détecte automatiquement la déconnexion et protège contre toute injection orpheline.',
                    'If no ping is received for over 24 hours, the Generative Architect blocks injection and displays a "Connect your site" message. The system automatically detects disconnection and protects against orphan injections.',
                    'Si no se recibe ningún ping durante más de 24 horas, el Arquitecto Generativo bloquea la inyección y muestra un mensaje "Conecte su sitio". El sistema detecta automáticamente la desconexión y protege contra inyecciones huérfanas.'
                  ),
                },
                {
                  q: t3(language, 'L\'intégration GTM est-elle gratuite ?', 'Is the GTM integration free?', '¿La integración GTM es gratuita?'),
                  a: t3(language,
                    'Oui. La connexion widget est entièrement gratuite. Seule la génération des codes correctifs consomme des crédits (1 crédit par génération, ou illimité avec l\'abonnement Pro Agency).',
                    'Yes. The widget connection is completely free. Only corrective code generation consumes credits (1 credit per generation, or unlimited with Pro Agency subscription).',
                    'Sí. La conexión del widget es completamente gratuita. Solo la generación de códigos correctivos consume créditos (1 crédito por generación, o ilimitado con la suscripción Pro Agency).'
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
              {t3(language, 'Prêt à automatiser vos corrections SEO ?', 'Ready to automate your SEO fixes?', '¿Listo para automatizar sus correcciones SEO?')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t3(language,
                'Lancez un audit gratuit, suivez votre site, branchez GTM — et laissez l\'Architecte faire le reste.',
                'Run a free audit, track your site, connect GTM — and let the Architect do the rest.',
                'Ejecute una auditoría gratuita, siga su sitio, conecte GTM — y deje que el Arquitecto haga el resto.'
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
                  {t3(language, 'Plugin WordPress alternatif', 'Alternative WordPress Plugin', 'Plugin WordPress alternativo')}
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {t3(language, 'Plus de 200 critères analysés — Audit technique et stratégique complet', 'Over 200 criteria analyzed — Complete technical and strategic audit', 'Más de 200 criterios analizados — Auditoría técnica y estratégica completa')}
            </p>
          </div>

        </div>
      </main>
      <Footer />
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
