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
  ArrowRight, CheckCircle2, Code, Layers, Zap, ShieldCheck,
  Shield, Eye, RefreshCw, AlertTriangle, Sparkles,
  Lock, History, ToggleRight, Target, FileCode, Crown
} from 'lucide-react';
import { t3 } from '@/utils/i18n';
import { useEffect } from 'react';

const SITE_URL = 'https://crawlers.fr';

export default function ArchitecteGeneratif() {
  const { language } = useLanguage();
  useCanonicalHreflang('/architecte-generatif');

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        'headline': t3(language,
          'Code Architect — Correctif multi-pages SEO/GEO intelligent',
          'Code Architect — Intelligent multi-page SEO/GEO corrective code',
          'Code Architect — Código correctivo multi-página SEO/GEO inteligente'
        ),
        'description': t3(language,
          'Appliquez des correctifs SEO différents pour chaque page de votre site. Routage par URL, modules configurables, garde-fous de sécurité et historique des versions.',
          'Apply different SEO fixes for each page of your site. URL routing, configurable modules, security safeguards and version history.',
          'Aplique correcciones SEO diferentes para cada página de su sitio. Enrutamiento por URL, módulos configurables, protecciones de seguridad e historial de versiones.'
        ),
        'author': { '@type': 'Organization', 'name': 'Crawlers.fr', 'url': SITE_URL },
        'publisher': { '@type': 'Organization', 'name': 'Crawlers.fr', 'url': SITE_URL },
        'datePublished': '2026-03-14',
        'dateModified': '2026-03-14',
        'mainEntityOfPage': `${SITE_URL}/architecte-generatif`,
        'inLanguage': language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      },
      {
        '@type': 'FAQPage',
        'mainEntity': [
          {
            '@type': 'Question',
            'name': t3(language,
              'Qu\'est-ce que Code Architect ?',
              'What is Code Architect?',
              '¿Qué es Code Architect?'
            ),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Code Architect est un système qui permet de configurer des correctifs SEO/GEO différents pour chaque page ou groupe de pages de votre site. Il route automatiquement le bon code vers la bonne URL.',
                'Code Architect is a system that allows you to configure different SEO/GEO fixes for each page or group of pages on your site. It automatically routes the right code to the right URL.',
                'Code Architect es un sistema que permite configurar correcciones SEO/GEO diferentes para cada página o grupo de páginas de su sitio.'
              )
            }
          },
          {
            '@type': 'Question',
            'name': t3(language,
              'Est-ce que le code injecté modifie le contenu visible de mon site ?',
              'Does the injected code modify the visible content of my site?',
              '¿El código inyectado modifica el contenido visible de mi sitio?'
            ),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Non. Le sandboxing sémantique garantit que les injections ne modifient jamais le contenu visible par vos visiteurs. Seules les métadonnées, les données structurées et les balises invisibles sont ajoutées.',
                'No. Semantic sandboxing ensures that injections never modify the content visible to your visitors. Only metadata, structured data and invisible tags are added.',
                'No. El sandboxing semántico garantiza que las inyecciones nunca modifican el contenido visible para sus visitantes.'
              )
            }
          },
          {
            '@type': 'Question',
            'name': t3(language,
              'Que se passe-t-il si quelque chose ne va pas ?',
              'What happens if something goes wrong?',
              '¿Qué pasa si algo sale mal?'
            ),
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': t3(language,
                'Plusieurs garde-fous sont en place : validation automatique du JSON-LD avant injection, watchdog CRON qui surveille la santé des scripts, kill switches d\'urgence, et bouton Débrancher qui stoppe immédiatement toute injection.',
                'Several safeguards are in place: automatic JSON-LD validation before injection, watchdog CRON monitoring script health, emergency kill switches, and a Disconnect button that immediately stops all injection.',
                'Varios mecanismos de seguridad están en su lugar: validación automática del JSON-LD, watchdog CRON, kill switches de emergencia y botón de desconexión instantánea.'
              )
            }
          },
        ]
      },
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': SITE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': t3(language, 'Code Architect', 'Code Architect', 'Code Architect'), 'item': `${SITE_URL}/architecte-generatif` }
        ]
      }
    ]
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema', 'architecte-generatif');
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
    return () => {
      document.querySelectorAll('script[data-schema="architecte-generatif"]').forEach(el => el.remove());
    };
  }, [language]);

  // ── Translations ──
  const title = t3(language,
    'Code Architect — Correctif Multi-Pages SEO/GEO',
    'Code Architect — Multi-Page SEO/GEO Corrective Code',
    'Code Architect — Código Correctivo Multi-Página SEO/GEO'
  );
  const metaDesc = t3(language,
    'Appliquez des correctifs SEO différents pour chaque page de votre site. Routage par URL, modules configurables, garde-fous de sécurité et historique des versions. Pro Agency.',
    'Apply different SEO fixes for each page of your site. URL routing, configurable modules, security safeguards and version history. Pro Agency.',
    'Aplique correcciones SEO diferentes para cada página de su sitio. Enrutamiento por URL, módulos configurables, protecciones de seguridad. Pro Agency.'
  );

  return (
    <>
      <Helmet>
        <title>Code Architect — Correctifs Multi-Pages SEO/GEO | Crawlers.fr</title>
        <meta name="description" content="Générez automatiquement des codes correctifs multi-pages (JSON-LD, balises, maillage). Intégration directe WordPress, GTM ou SDK." />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Crawlers.fr" />
        <meta property="og:url" content="https://crawlers.fr/architecte-generatif" />
        <meta property="og:title" content="Code Architect — Correctifs Multi-Pages SEO/GEO | Crawlers.fr" />
        <meta property="og:description" content="Générez automatiquement des codes correctifs multi-pages (JSON-LD, balises, maillage). Intégration directe WordPress, GTM ou SDK." />
        <meta property="og:image" content="https://crawlers.fr/og-image.png" />
        <meta property="og:locale" content="fr_FR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@crawlersfr" />
        <meta name="twitter:title" content="Code Architect — Correctifs Multi-Pages SEO/GEO | Crawlers.fr" />
        <meta name="twitter:description" content="Générez automatiquement des codes correctifs multi-pages (JSON-LD, balises, maillage). Intégration directe WordPress, GTM ou SDK." />
        <meta name="twitter:image" content="https://crawlers.fr/og-image.png" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">

          {/* ═══════════════════════════════════════ */}
          {/* HERO */}
          {/* ═══════════════════════════════════════ */}
          <section className="relative overflow-hidden px-4 py-16 sm:py-24">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
              <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-violet-500/5 blur-3xl" />
            </div>
            <div className="relative mx-auto max-w-4xl text-center space-y-6">
              <Badge className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30">
                <Crown className="h-3 w-3 mr-1" /> Pro Agency
              </Badge>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-balance">
                {language === 'es'
                  ? <>Una corrección <span className="text-primary">diferente</span> para cada página de su sitio</>
                  : language === 'en'
                    ? <>A <span className="text-primary">different</span> fix for each page of your site</>
                    : <>Un correctif <span className="text-primary">différent</span> pour chaque page de votre site</>
                }
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t3(language,
                  'Code Architect analyse votre site et applique automatiquement les bons correctifs SEO/GEO sur les bonnes pages. Données structurées, métadonnées, Open Graph : chaque URL reçoit exactement ce dont elle a besoin.',
                  'Code Architect analyzes your site and automatically applies the right SEO/GEO fixes to the right pages. Structured data, metadata, Open Graph: each URL gets exactly what it needs.',
                  'Code Architect analiza su sitio y aplica automáticamente las correcciones SEO/GEO correctas en las páginas correctas. Datos estructurados, metadatos, Open Graph: cada URL recibe exactamente lo que necesita.'
                )}
              </p>
            </div>
          </section>

          {/* ═══════════════════════════════════════ */}
          {/* HOW IT WORKS — 3 steps */}
          {/* ═══════════════════════════════════════ */}
          <section className="px-4 py-12 bg-muted/30">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-2xl font-bold text-center mb-8">
                {t3(language, 'Comment ça fonctionne', 'How it works', 'Cómo funciona')}
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                {[
                  {
                    icon: Target,
                    title: t3(language, '1. Définissez vos règles', '1. Define your rules', '1. Defina sus reglas'),
                    desc: t3(language,
                      'Pour chaque page ou groupe de pages, choisissez les modules à activer : JSON-LD, Open Graph, Meta, Hreflang, FAQ, HowTo… Filtrez par URL exacte, préfixe ou wildcard.',
                      'For each page or group of pages, choose the modules to activate: JSON-LD, Open Graph, Meta, Hreflang, FAQ, HowTo… Filter by exact URL, prefix or wildcard.',
                      'Para cada página o grupo de páginas, elija los módulos a activar: JSON-LD, Open Graph, Meta, Hreflang, FAQ, HowTo… Filtre por URL exacta, prefijo o wildcard.'
                    )
                  },
                  {
                    icon: Zap,
                    title: t3(language, '2. Injection automatique', '2. Automatic injection', '2. Inyección automática'),
                    desc: t3(language,
                      'Une fois connecté via GTM ou notre widget, le script lit vos règles actives et injecte uniquement les correctifs correspondant à l\'URL affichée par le visiteur.',
                      'Once connected via GTM or our widget, the script reads your active rules and only injects the fixes matching the URL displayed by the visitor.',
                      'Una vez conectado vía GTM o nuestro widget, el script lee sus reglas activas e inyecta únicamente las correcciones correspondientes a la URL mostrada.'
                    )
                  },
                  {
                    icon: Eye,
                    title: t3(language, '3. Surveillance continue', '3. Continuous monitoring', '3. Monitoreo continuo'),
                    desc: t3(language,
                      'Un watchdog vérifie périodiquement que vos scripts sont actifs et valides. En cas d\'anomalie, vous êtes alerté et pouvez débrancher en un clic.',
                      'A watchdog periodically checks that your scripts are active and valid. In case of anomaly, you are alerted and can disconnect in one click.',
                      'Un watchdog verifica periódicamente que sus scripts están activos y válidos. En caso de anomalía, se le alerta y puede desconectar con un clic.'
                    )
                  },
                ].map((step, i) => (
                  <Card key={i} className="border-border/50 hover:border-primary/30 transition-colors">
                    <CardContent className="p-6 space-y-3">
                      <div className="p-3 rounded-xl bg-primary/10 w-fit">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════ */}
          {/* FEATURES — Tout public */}
          {/* ═══════════════════════════════════════ */}
          <section className="px-4 py-12">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-2xl font-bold text-center mb-2">
                {t3(language, 'Fonctionnalités principales', 'Key features', 'Funcionalidades principales')}
              </h2>
              <p className="text-center text-muted-foreground mb-8">
                {t3(language, 'Accessibles à tous les utilisateurs du code correctif', 'Available to all corrective code users', 'Disponibles para todos los usuarios del código correctivo')}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Layers, label: t3(language, 'Routage par URL', 'URL routing', 'Enrutamiento por URL'), desc: t3(language, 'Filtres exact, préfixe ou wildcard pour cibler précisément les pages', 'Exact, prefix or wildcard filters to precisely target pages', 'Filtros exactos, prefijos o wildcard para apuntar páginas') },
                  { icon: FileCode, label: t3(language, 'Modules configurables', 'Configurable modules', 'Módulos configurables'), desc: t3(language, 'JSON-LD, Open Graph, Meta, Hreflang, FAQ, HowTo, Twitter Cards…', 'JSON-LD, Open Graph, Meta, Hreflang, FAQ, HowTo, Twitter Cards…', 'JSON-LD, Open Graph, Meta, Hreflang, FAQ, HowTo, Twitter Cards…') },
                  { icon: Code, label: t3(language, 'Script tout-en-un', 'All-in-one script', 'Script todo-en-uno'), desc: t3(language, 'Un seul snippet à déployer via GTM ou copier-coller dans le <head>', 'A single snippet to deploy via GTM or copy-paste in the <head>', 'Un solo snippet para desplegar vía GTM o copiar-pegar en el <head>') },
                  { icon: Sparkles, label: t3(language, 'Génération IA', 'AI generation', 'Generación IA'), desc: t3(language, 'Le contenu des modules est généré par IA à partir des données de votre audit', 'Module content is AI-generated from your audit data', 'El contenido de los módulos es generado por IA a partir de los datos de su auditoría') },
                ].map((f, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl border bg-card">
                    <div className="p-2.5 rounded-lg bg-primary/10 h-fit">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{f.label}</p>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════ */}
          {/* HERO GARDE-FOUS — Section complète */}
          {/* ═══════════════════════════════════════ */}
          <section className="px-4 py-16 bg-gradient-to-b from-violet-500/5 via-violet-500/10 to-violet-500/5 border-y border-violet-500/20">
            <div className="mx-auto max-w-5xl space-y-8">
              <div className="text-center space-y-3">
                <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30 text-sm px-4 py-1">
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  {t3(language, 'Sécurité & Confiance', 'Security & Trust', 'Seguridad y Confianza')}
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-extrabold">
                  {language === 'es'
                    ? <>Sus protecciones, <span className="text-violet-600 dark:text-violet-400">nuestra prioridad</span></>
                    : language === 'en'
                      ? <>Your safeguards, <span className="text-violet-600 dark:text-violet-400">our priority</span></>
                      : <>Vos garde-fous, <span className="text-violet-600 dark:text-violet-400">notre priorité</span></>
                  }
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  {t3(language,
                    'Injecter du code sur un site est une responsabilité. C\'est pourquoi chaque couche de Code Architect intègre des mécanismes de protection automatiques.',
                    'Injecting code on a site is a responsibility. That\'s why every layer of Code Architect integrates automatic protection mechanisms.',
                    'Inyectar código en un sitio es una responsabilidad. Por eso cada capa de Code Architect integra mecanismos de protección automáticos.'
                  )}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    icon: Shield,
                    title: t3(language, 'Validation JSON-LD', 'JSON-LD Validation', 'Validación JSON-LD'),
                    desc: t3(language,
                      'Chaque bloc JSON-LD est validé syntaxiquement et sémantiquement avant injection. Les données structurées invalides sont rejetées automatiquement.',
                      'Every JSON-LD block is syntactically and semantically validated before injection. Invalid structured data is automatically rejected.',
                      'Cada bloque JSON-LD es validado sintáctica y semánticamente antes de la inyección.'
                    ),
                    color: 'text-emerald-600 dark:text-emerald-400',
                    bg: 'bg-emerald-500/10'
                  },
                  {
                    icon: Lock,
                    title: t3(language, 'Sandboxing sémantique', 'Semantic sandboxing', 'Sandboxing semántico'),
                    desc: t3(language,
                      'Les injections ne modifient jamais le contenu visible par vos visiteurs. Seules les métadonnées et balises invisibles sont ajoutées dans le DOM.',
                      'Injections never modify the content visible to your visitors. Only metadata and invisible tags are added to the DOM.',
                      'Las inyecciones nunca modifican el contenido visible para sus visitantes.'
                    ),
                    color: 'text-blue-600 dark:text-blue-400',
                    bg: 'bg-blue-500/10'
                  },
                  {
                    icon: Eye,
                    title: t3(language, 'Watchdog CRON', 'Watchdog CRON', 'Watchdog CRON'),
                    desc: t3(language,
                      'Un processus automatisé vérifie périodiquement que vos scripts sont actifs, valides et conformes. En cas d\'anomalie, le système vous alerte immédiatement.',
                      'An automated process periodically checks that your scripts are active, valid and compliant. In case of anomaly, the system alerts you immediately.',
                      'Un proceso automatizado verifica periódicamente que sus scripts están activos, válidos y conformes.'
                    ),
                    color: 'text-amber-600 dark:text-amber-400',
                    bg: 'bg-amber-500/10'
                  },
                  {
                    icon: ToggleRight,
                    title: t3(language, 'Kill Switch d\'urgence', 'Emergency Kill Switch', 'Kill Switch de emergencia'),
                    desc: t3(language,
                      'Depuis l\'interface admin, désactivez instantanément toute injection sur un site ou globalement. Un seul clic suffit pour tout stopper.',
                      'From the admin interface, instantly disable all injection on a site or globally. A single click stops everything.',
                      'Desde la interfaz de administración, desactive instantáneamente toda inyección.'
                    ),
                    color: 'text-red-600 dark:text-red-400',
                    bg: 'bg-red-500/10'
                  },
                  {
                    icon: RefreshCw,
                    title: t3(language, 'Bouton Débrancher', 'Disconnect Button', 'Botón Desconectar'),
                    desc: t3(language,
                      'Le bouton Débrancher stoppe immédiatement toute injection sans laisser de résidus sur votre site. Aucun script orphelin, aucune trace.',
                      'The Disconnect button immediately stops all injection without leaving any residue on your site. No orphan scripts, no trace.',
                      'El botón Desconectar detiene inmediatamente toda inyección sin dejar residuos en su sitio.'
                    ),
                    color: 'text-violet-600 dark:text-violet-400',
                    bg: 'bg-violet-500/10'
                  },
                  {
                    icon: History,
                    title: t3(language, 'Historique des versions', 'Version history', 'Historial de versiones'),
                    desc: t3(language,
                      'Chaque modification d\'une règle est archivée automatiquement. Vous pouvez restaurer une version antérieure en un clic à tout moment.',
                      'Every rule modification is automatically archived. You can restore a previous version in one click at any time.',
                      'Cada modificación de una regla se archiva automáticamente. Puede restaurar una versión anterior con un clic.'
                    ),
                    color: 'text-cyan-600 dark:text-cyan-400',
                    bg: 'bg-cyan-500/10'
                  },
                ].map((g, i) => (
                  <Card key={i} className="border-violet-500/10 bg-card/80 backdrop-blur-sm hover:border-violet-500/30 transition-colors">
                    <CardContent className="p-5 space-y-3">
                      <div className={`p-2.5 rounded-lg ${g.bg} w-fit`}>
                        <g.icon className={`h-5 w-5 ${g.color}`} />
                      </div>
                      <h3 className="font-semibold">{g.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{g.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                  {t3(language,
                    '💡 Ces garde-fous fonctionnent automatiquement. Vous n\'avez rien à configurer.',
                    '💡 These safeguards work automatically. You don\'t have to configure anything.',
                    '💡 Estas protecciones funcionan automáticamente. No tiene que configurar nada.'
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════ */}
          {/* FEATURES PRO AGENCY */}
          {/* ═══════════════════════════════════════ */}
          <section className="px-4 py-12">
            <div className="mx-auto max-w-5xl">
              <div className="text-center mb-8 space-y-2">
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  <Crown className="h-3 w-3 mr-1" /> Pro Agency
                </Badge>
                <h2 className="text-2xl font-bold">
                  {t3(language, 'Fonctionnalités réservées aux abonnés', 'Subscriber-only features', 'Funcionalidades reservadas a suscriptores')}
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Layers, label: t3(language, 'Règles multi-pages illimitées', 'Unlimited multi-page rules', 'Reglas multi-página ilimitadas'), desc: t3(language, 'Créez autant de règles que nécessaire pour couvrir l\'intégralité de votre site', 'Create as many rules as needed to cover your entire site', 'Cree tantas reglas como necesite para cubrir todo su sitio') },
                  { icon: History, label: t3(language, 'Historique et restauration', 'History and restore', 'Historial y restauración'), desc: t3(language, 'Les 5 dernières versions de chaque règle sont archivées. Restauration en un clic.', 'The last 5 versions of each rule are archived. One-click restore.', 'Las últimas 5 versiones de cada regla se archivan. Restauración con un clic.') },
                  { icon: AlertTriangle, label: t3(language, 'Watchdog automatique', 'Automatic watchdog', 'Watchdog automático'), desc: t3(language, 'Surveillance CRON des scripts déployés avec alertes en cas d\'anomalie', 'CRON monitoring of deployed scripts with anomaly alerts', 'Monitoreo CRON de scripts desplegados con alertas de anomalía') },
                  { icon: ToggleRight, label: t3(language, 'Kill switches d\'urgence', 'Emergency kill switches', 'Kill switches de emergencia'), desc: t3(language, 'Désactivation globale ou par site en un clic depuis l\'interface admin', 'Global or per-site deactivation in one click from the admin interface', 'Desactivación global o por sitio con un clic desde la interfaz de administración') },
                ].map((f, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 h-fit">
                      <f.icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold">{f.label}</p>
                      <p className="text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══════════════════════════════════════ */}
          {/* FAQ */}
          {/* ═══════════════════════════════════════ */}
          <section className="px-4 py-12 bg-muted/30">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold text-center mb-6">
                {t3(language, 'Questions fréquentes', 'Frequently asked questions', 'Preguntas frecuentes')}
              </h2>
              <Accordion type="single" collapsible className="space-y-2">
                {[
                  {
                    q: t3(language, 'Faut-il des connaissances techniques ?', 'Do I need technical knowledge?', '¿Necesito conocimientos técnicos?'),
                    a: t3(language,
                      'Non. L\'interface est conçue pour être utilisée sans coder. Vous sélectionnez les modules souhaités, l\'IA génère le contenu, et le script est déployé automatiquement via GTM ou notre widget.',
                      'No. The interface is designed to be used without coding. You select the desired modules, AI generates the content, and the script is deployed automatically via GTM or our widget.',
                      'No. La interfaz está diseñada para ser utilizada sin programar.'
                    )
                  },
                  {
                    q: t3(language, 'Le correctif multi-pages est-il inclus dans Pro Agency ?', 'Is multi-page corrective included in Pro Agency?', '¿El correctivo multi-páginas está incluido en Pro Agency?'),
                    a: t3(language,
                      'Oui, la fonctionnalité complète est incluse dans l\'abonnement Pro Agency à 59€/mois, sans surcoût.',
                      'Yes, the full feature is included in the Pro Agency subscription at €59/month, at no extra cost.',
                      'Sí, la funcionalidad completa está incluida en la suscripción Pro Agency a 59€/mes, sin coste adicional.'
                    )
                  },
                  {
                    q: t3(language, 'Puis-je débrancher à tout moment ?', 'Can I disconnect at any time?', '¿Puedo desconectar en cualquier momento?'),
                    a: t3(language,
                      'Oui. Le bouton Débrancher stoppe immédiatement toute injection. Aucun script orphelin ne reste sur votre site. C\'est réversible et instantané.',
                      'Yes. The Disconnect button immediately stops all injection. No orphan scripts remain on your site. It\'s reversible and instant.',
                      'Sí. El botón Desconectar detiene inmediatamente toda inyección. Ningún script huérfano permanece en su sitio.'
                    )
                  },
                  {
                    q: t3(language, 'Combien de règles puis-je créer ?', 'How many rules can I create?', '¿Cuántas reglas puedo crear?'),
                    a: t3(language,
                      'Avec Pro Agency, le nombre de règles est illimité. Vous pouvez créer une règle par URL, par répertoire ou utiliser des wildcards pour couvrir tout votre site.',
                      'With Pro Agency, the number of rules is unlimited. You can create a rule per URL, per directory or use wildcards to cover your entire site.',
                      'Con Pro Agency, el número de reglas es ilimitado.'
                    )
                  },
                ].map((faq, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="text-left font-medium">{faq.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* ═══════════════════════════════════════ */}
          {/* CTA — violet border */}
          {/* ═══════════════════════════════════════ */}
          <section className="px-4 py-16">
            <div className="mx-auto max-w-xl text-center space-y-6">
              <h2 className="text-2xl font-bold">
                {t3(language,
                  'Prêt à optimiser chaque page individuellement ?',
                  'Ready to optimize each page individually?',
                  '¿Listo para optimizar cada página individualmente?'
                )}
              </h2>
              <p className="text-muted-foreground">
                {t3(language,
                  'Lancez un Audit Expert pour découvrir les correctifs recommandés pour votre site.',
                  'Launch an Expert Audit to discover the recommended fixes for your site.',
                  'Lance una Auditoría Experta para descubrir las correcciones recomendadas para su sitio.'
                )}
              </p>
              <div className="inline-block rounded-2xl border-4 border-violet-500 p-1">
                <Link to="/audit-expert">
                  <Button size="xl" className="gap-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 text-white font-bold shadow-lg shadow-violet-500/25">
                    <Sparkles className="h-5 w-5" />
                    {t3(language, 'Lancer l\'Audit Expert', 'Launch Expert Audit', 'Lanzar Auditoría Experta')}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>

        </main>
        <Footer />
      </div>
    </>
  );
}
