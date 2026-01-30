import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { FileText, Newspaper, Quote, Navigation, MapPin, ExternalLink, Calendar, User } from 'lucide-react';
import { FixConfig, AttributionConfig } from './types';

interface VisualPreviewProps {
  fixes: FixConfig[];
  attribution: AttributionConfig;
}

export function VisualPreview({ fixes, attribution }: VisualPreviewProps) {
  const enabledFixes = fixes.filter(f => f.enabled && f.category === 'strategic');
  
  const hasBlog = enabledFixes.some(f => f.id === 'inject_blog_section');
  const hasFAQ = enabledFixes.some(f => f.id === 'inject_faq');
  const hasSemantic = enabledFixes.some(f => f.id === 'enhance_semantic_meta');
  const hasBreadcrumbs = enabledFixes.some(f => f.id === 'inject_breadcrumbs');
  const hasLocalBusiness = enabledFixes.some(f => f.id === 'inject_local_business');

  const blogFix = fixes.find(f => f.id === 'inject_blog_section');
  const semanticFix = fixes.find(f => f.id === 'enhance_semantic_meta');
  const localBusinessFix = fixes.find(f => f.id === 'inject_local_business');

  const blogTitle = blogFix?.data?.sectionTitle || 'Nos Actualités';
  const semanticParagraph = semanticFix?.data?.injectedParagraph || 'Votre paragraphe sémantique apparaîtra ici avec les mots-clés optimisés...';
  const businessName = localBusinessFix?.data?.name || 'Votre Entreprise';

  const noPreview = !hasBlog && !hasFAQ && !hasSemantic && !hasBreadcrumbs && !hasLocalBusiness && !attribution.enabled;

  if (noPreview) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div className="text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium">Aucun aperçu disponible</p>
          <p className="text-xs mt-1">Activez des correctifs stratégiques ou l'attribution pour voir un aperçu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Breadcrumbs Preview */}
      {hasBreadcrumbs && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Navigation className="w-3 h-3" />
          <span className="text-blue-600 hover:underline cursor-pointer">Accueil</span>
          <span>/</span>
          <span className="text-blue-600 hover:underline cursor-pointer">Services</span>
          <span>/</span>
          <span>Page actuelle</span>
        </motion.div>
      )}

      {/* Blog Section Preview */}
      {hasBlog && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold">{blogTitle}</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-full h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded mb-2" />
                <h4 className="text-xs font-medium line-clamp-2">
                  Article {i} : Lorem ipsum dolor sit amet consectetur
                </h4>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>12 Jan 2025</span>
                  <User className="w-3 h-3 ml-2" />
                  <span>Admin</span>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Semantic Injection Preview */}
      {hasSemantic && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <p className="text-muted-foreground text-xs leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
          <div className="bg-gradient-to-r from-blue-500/10 to-violet-500/10 border-l-4 border-blue-500 p-3 rounded-r">
            <Quote className="w-4 h-4 text-blue-500 mb-1" />
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {semanticParagraph}
            </p>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
        </motion.div>
      )}

      {/* FAQ Preview */}
      {hasFAQ && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <h3 className="font-semibold">Questions fréquentes</h3>
          </div>
          {['Quels sont vos services ?', 'Comment fonctionne votre offre ?', 'Quels sont les délais ?'].map((q, i) => (
            <div key={i} className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{q}</span>
                <span className="text-muted-foreground text-lg">+</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Local Business Preview */}
      {hasLocalBusiness && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 bg-muted/50 rounded-lg p-3"
        >
          <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">{businessName}</h4>
            <p className="text-xs text-muted-foreground mt-1">
              {localBusinessFix?.data?.address || '123 Rue de Paris'}, {localBusinessFix?.data?.city || 'Paris'} {localBusinessFix?.data?.postalCode || '75001'}
            </p>
            {localBusinessFix?.data?.phone && (
              <p className="text-xs text-blue-600 mt-1">{localBusinessFix.data.phone}</p>
            )}
          </div>
        </motion.div>
      )}

      {/* Attribution Preview */}
      {attribution.enabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t pt-4 mt-6"
        >
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">Simulation du pied de page</p>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <span>© 2025 Votre Entreprise •</span>
              <a 
                href="https://crawlers.fr" 
                target="_blank" 
                rel="noopener"
                className="text-emerald-600 hover:underline inline-flex items-center gap-1"
              >
                {attribution.anchorText}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
