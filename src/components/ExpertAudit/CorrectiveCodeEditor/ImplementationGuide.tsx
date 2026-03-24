import { useState } from 'react';
import { motion } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, BookOpen, Code, Globe, 
  Lightbulb, ExternalLink, ShoppingBag, Tag,
  FileCode, Cable, Plug
} from 'lucide-react';

interface ImplementationGuideProps {
  language: string;
}

const translations = {
  fr: {
    title: 'Guide d\'implémentation',
    whyTitle: 'Pourquoi ça fonctionne ?',
    whyContent: `Ce script utilise la **manipulation du DOM** (Document Object Model) côté client. Il s'exécute directement dans le navigateur de vos visiteurs et modifie dynamiquement la page sans toucher à votre serveur.

**Avantages :**
• Aucune modification serveur requise
• Déploiement instantané via le plugin Crawlers.AI, GTM ou copier-coller
• Réversible à tout moment
• Compatible avec tous les CMS et hébergeurs`,
    howTitle: 'Comment l\'implémenter ?',
    recommended: 'Recommandé',
    methods: {
      crawlersPlugin: {
        title: 'Plugin Crawlers.AI',
        icon: Cable,
        description: 'Branchez votre site depuis Mon Espace → Mes Sites pour une injection automatique.',
        steps: [
          'Allez dans Mon Espace → Mes Sites',
          'Cliquez sur l\'icône de branchement (prise) de votre site',
          'Choisissez WordPress (plugin) ou GTM (snippet)',
          'Le code correctif s\'injecte automatiquement à chaque génération'
        ],
        link: '/app/profil',
        linkLabel: 'Accéder à Mes Sites',
        recommended: true,
      },
      wordpress: {
        title: 'WordPress (manuel)',
        icon: FileCode,
        description: 'Utilisez un plugin tiers pour injecter le script manuellement.',
        steps: [
          'Installez le plugin "Insert Headers and Footers" (WPCode)',
          'Allez dans Outils → En-têtes et pieds de page',
          'Collez le script dans la section "Footer"',
          'Sauvegardez'
        ],
        link: 'https://wordpress.org/plugins/insert-headers-and-footers/',
        linkLabel: 'Voir le plugin WPCode',
      },
      gtm: {
        title: 'Google Tag Manager',
        icon: Tag,
        description: 'Créez une balise HTML personnalisée pour un déploiement sans code.',
        steps: [
          'Connectez-vous à Google Tag Manager',
          'Créez une nouvelle balise de type "HTML personnalisé"',
          'Collez le script dans le champ HTML',
          'Configurez le déclencheur sur "Toutes les pages"',
          'Publiez les modifications'
        ],
        link: 'https://tagmanager.google.com/',
        linkLabel: 'Ouvrir Google Tag Manager',
      },
      general: {
        title: 'Injection directe',
        icon: Code,
        description: 'Insérez le script juste avant la balise </body> de votre page.',
        steps: [
          'Copiez le script généré ci-dessus',
          'Ouvrez le fichier HTML de votre page (souvent index.html)',
          'Collez le script juste avant </body>',
          'Sauvegardez et testez'
        ],
      },
      shopify: {
        title: 'Shopify',
        icon: ShoppingBag,
        description: 'Modifiez votre fichier theme.liquid pour inclure le script.',
        steps: [
          'Allez dans Boutique en ligne → Thèmes → Actions → Modifier le code',
          'Ouvrez le fichier theme.liquid',
          'Collez le script juste avant </body>',
          'Sauvegardez'
        ],
        link: 'https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/edit-theme-code',
        linkLabel: 'Documentation Shopify',
      },
    },
    tip: 'Conseil : Pour un déploiement automatique, branchez votre site depuis Mon Espace → Mes Sites. Le code correctif sera injecté à chaque génération.',
  },
  en: {
    title: 'Implementation Guide',
    whyTitle: 'Why does it work?',
    whyContent: `This script uses client-side **DOM manipulation** (Document Object Model). It runs directly in your visitors' browser and dynamically modifies the page without touching your server.

**Benefits:**
• No server modifications required
• Instant deployment via Crawlers.AI plugin, GTM or copy-paste
• Reversible at any time
• Compatible with all CMS and hosts`,
    howTitle: 'How to implement?',
    recommended: 'Recommended',
    methods: {
      crawlersPlugin: {
        title: 'Crawlers.AI Plugin',
        icon: Cable,
        description: 'Connect your site from My Account → My Sites for automatic injection.',
        steps: [
          'Go to My Account → My Sites',
          'Click the plug icon on your site',
          'Choose WordPress (plugin) or GTM (snippet)',
          'Corrective code is automatically injected on each generation'
        ],
        link: '/app/profil',
        linkLabel: 'Go to My Sites',
        recommended: true,
      },
      wordpress: {
        title: 'WordPress (manual)',
        icon: FileCode,
        description: 'Use a third-party plugin to manually inject the script.',
        steps: [
          'Install the "Insert Headers and Footers" plugin (WPCode)',
          'Go to Tools → Headers and Footers',
          'Paste the script in the "Footer" section',
          'Save'
        ],
        link: 'https://wordpress.org/plugins/insert-headers-and-footers/',
        linkLabel: 'View WPCode plugin',
      },
      gtm: {
        title: 'Google Tag Manager',
        icon: Tag,
        description: 'Create a custom HTML tag for code-free deployment.',
        steps: [
          'Log in to Google Tag Manager',
          'Create a new "Custom HTML" tag',
          'Paste the script in the HTML field',
          'Set the trigger to "All Pages"',
          'Publish changes'
        ],
        link: 'https://tagmanager.google.com/',
        linkLabel: 'Open Google Tag Manager',
      },
      general: {
        title: 'Direct injection',
        icon: Code,
        description: 'Insert the script just before the </body> tag of your page.',
        steps: [
          'Copy the generated script above',
          'Open your page\'s HTML file (often index.html)',
          'Paste the script just before </body>',
          'Save and test'
        ],
      },
      shopify: {
        title: 'Shopify',
        icon: ShoppingBag,
        description: 'Modify your theme.liquid file to include the script.',
        steps: [
          'Go to Online Store → Themes → Actions → Edit code',
          'Open the theme.liquid file',
          'Paste the script just before </body>',
          'Save'
        ],
        link: 'https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/edit-theme-code',
        linkLabel: 'Shopify Documentation',
      },
    },
    tip: 'Tip: For automatic deployment, connect your site from My Account → My Sites. Corrective code will be injected on each generation.',
  },
  es: {
    title: 'Guía de implementación',
    whyTitle: '¿Por qué funciona?',
    whyContent: `Este script utiliza la **manipulación del DOM** (Document Object Model) del lado del cliente. Se ejecuta directamente en el navegador de sus visitantes y modifica dinámicamente la página sin tocar su servidor.

**Ventajas:**
• No requiere modificaciones del servidor
• Despliegue instantáneo vía plugin Crawlers.AI, GTM o copiar-pegar
• Reversible en cualquier momento
• Compatible con todos los CMS y hosts`,
    howTitle: '¿Cómo implementarlo?',
    recommended: 'Recomendado',
    methods: {
      crawlersPlugin: {
        title: 'Plugin Crawlers.AI',
        icon: Cable,
        description: 'Conecte su sitio desde Mi Cuenta → Mis Sitios para inyección automática.',
        steps: [
          'Vaya a Mi Cuenta → Mis Sitios',
          'Haga clic en el icono de conexión (enchufe) de su sitio',
          'Elija WordPress (plugin) o GTM (snippet)',
          'El código correctivo se inyecta automáticamente en cada generación'
        ],
        link: '/app/profil',
        linkLabel: 'Ir a Mis Sitios',
        recommended: true,
      },
      wordpress: {
        title: 'WordPress (manual)',
        icon: FileCode,
        description: 'Use un plugin de terceros para inyectar el script manualmente.',
        steps: [
          'Instale el plugin "Insert Headers and Footers" (WPCode)',
          'Vaya a Herramientas → Headers and Footers',
          'Pegue el script en la sección "Footer"',
          'Guarde'
        ],
        link: 'https://wordpress.org/plugins/insert-headers-and-footers/',
        linkLabel: 'Ver plugin WPCode',
      },
      gtm: {
        title: 'Google Tag Manager',
        icon: Tag,
        description: 'Cree una etiqueta HTML personalizada para un despliegue sin código.',
        steps: [
          'Inicie sesión en Google Tag Manager',
          'Cree una nueva etiqueta de tipo "HTML personalizado"',
          'Pegue el script en el campo HTML',
          'Configure el activador en "Todas las páginas"',
          'Publique los cambios'
        ],
        link: 'https://tagmanager.google.com/',
        linkLabel: 'Abrir Google Tag Manager',
      },
      general: {
        title: 'Inyección directa',
        icon: Code,
        description: 'Inserte el script justo antes de la etiqueta </body> de su página.',
        steps: [
          'Copie el script generado arriba',
          'Abra el archivo HTML de su página (a menudo index.html)',
          'Pegue el script justo antes de </body>',
          'Guarde y pruebe'
        ],
      },
      shopify: {
        title: 'Shopify',
        icon: ShoppingBag,
        description: 'Modifique su archivo theme.liquid para incluir el script.',
        steps: [
          'Vaya a Tienda online → Temas → Acciones → Editar código',
          'Abra el archivo theme.liquid',
          'Pegue el script justo antes de </body>',
          'Guarde'
        ],
        link: 'https://help.shopify.com/en/manual/online-store/themes/theme-structure/extend/edit-theme-code',
        linkLabel: 'Documentación Shopify',
      },
    },
    tip: 'Consejo: Para un despliegue automático, conecte su sitio desde Mi Cuenta → Mis Sitios. El código correctivo se inyectará en cada generación.',
  },
};

export function ImplementationGuide({ language }: ImplementationGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[language as keyof typeof translations] || translations.fr;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                {t.title}
              </CardTitle>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </div>
          </CardHeader>
        </Card>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 max-h-[300px] overflow-y-auto pr-2">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
          {/* Why it works */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                {t.whyTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: t.whyContent
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n/g, '<br/>')
                    .replace(/• /g, '<span class="text-primary">•</span> ')
                }}
              />
            </CardContent>
          </Card>

          {/* How to implement */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                {t.howTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {Object.entries(t.methods).map(([key, method]) => {
                const Icon = method.icon;
                const isRecommended = 'recommended' in method && method.recommended;
                return (
                  <div 
                    key={key}
                    className={`p-3 rounded-lg border transition-colors ${isRecommended ? 'border-primary/40 bg-primary/5 hover:bg-primary/10' : 'bg-muted/30 hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{method.title}</span>
                      {isRecommended && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                          {'recommended' in t ? (t as any).recommended : '★'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{method.description}</p>
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      {method.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    {'link' in method && method.link && (
                      <a
                        href={method.link}
                        target={method.link.startsWith('/') ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                      >
                        {method.linkLabel}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{t.tip}</p>
          </div>
          </motion.div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
