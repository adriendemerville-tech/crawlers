import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { FileText, Quote, Navigation, MapPin, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { FixConfig } from './types';
import { useState, useEffect } from 'react';

interface VisualPreviewProps {
  fixes: FixConfig[];
  siteUrl?: string;
}

export function VisualPreview({ fixes, siteUrl }: VisualPreviewProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  
  const enabledFixes = fixes.filter(f => f.enabled && f.category === 'strategic');
  
  const hasFAQ = enabledFixes.some(f => f.id === 'inject_faq');
  const hasSemantic = enabledFixes.some(f => f.id === 'enhance_semantic_meta');
  const hasBreadcrumbs = enabledFixes.some(f => f.id === 'inject_breadcrumbs');
  const hasLocalBusiness = enabledFixes.some(f => f.id === 'inject_local_business');

  const semanticFix = fixes.find(f => f.id === 'enhance_semantic_meta');
  const localBusinessFix = fixes.find(f => f.id === 'inject_local_business');

  const semanticParagraph = semanticFix?.data?.injectedParagraph || 'Votre paragraphe sémantique apparaîtra ici avec les mots-clés optimisés...';
  const businessName = localBusinessFix?.data?.name || 'Votre Entreprise';

  // Reset iframe loaded state when siteUrl changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [siteUrl]);

  // Si on a une URL, afficher l'iframe du site cible
  if (siteUrl) {
    return (
      <div className="h-full flex flex-col">
        {/* Site Preview Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b text-xs">
          <Globe className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground truncate flex-1">{siteUrl}</span>
        </div>
        
        {/* Iframe Container */}
        <div className="flex-1 relative bg-white">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                <span className="text-xs text-muted-foreground">Chargement du site...</span>
              </div>
            </div>
          )}
          <iframe
            src={siteUrl}
            className="w-full h-full border-0"
            title="Site Preview"
            sandbox="allow-scripts allow-same-origin"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
        
        {/* Attribution Footer */}
        <div className="px-3 py-2 bg-muted/30 border-t text-center">
          <a 
            href="https://crawlers.fr" 
            target="_blank" 
            rel="noopener"
            className="text-[10px] text-emerald-600 hover:underline inline-flex items-center gap-1"
          >
            Powered by Crawlers.fr
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    );
  }

  const noPreview = !hasFAQ && !hasSemantic && !hasBreadcrumbs && !hasLocalBusiness;

  if (noPreview) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium">Activez des correctifs stratégiques</p>
          <p className="text-xs mt-1">pour voir un aperçu visuel</p>
        </div>
        {/* Attribution toujours visible */}
        <div className="mt-8 border-t pt-4 w-full max-w-sm">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Attribution incluse automatiquement</p>
            <a 
              href="https://crawlers.fr" 
              target="_blank" 
              rel="noopener"
              className="text-xs text-emerald-600 hover:underline inline-flex items-center gap-1"
            >
              Powered by Crawlers.fr
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
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

      {/* Attribution Preview - Toujours affiché */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-t pt-4 mt-6"
      >
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-[10px] text-muted-foreground mb-2">Attribution incluse automatiquement</p>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <span>© 2025 Votre Entreprise •</span>
            <a 
              href="https://crawlers.fr" 
              target="_blank" 
              rel="noopener"
              className="text-emerald-600 hover:underline inline-flex items-center gap-1"
            >
              Powered by Crawlers.fr
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
