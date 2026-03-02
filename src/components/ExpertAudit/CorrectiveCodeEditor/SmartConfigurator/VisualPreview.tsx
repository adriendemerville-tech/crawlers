import { motion } from 'framer-motion';
import { FileText, Quote, Navigation, MapPin, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { FixConfig } from './types';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface VisualPreviewProps {
  fixes: FixConfig[];
  siteUrl?: string;
}

// Generate a lightweight preview script based on enabled fixes
function generatePreviewScript(fixes: FixConfig[], siteName?: string): string {
  const enabledFixes = fixes.filter(f => f.enabled);
  if (enabledFixes.length === 0) return '';

  const scriptParts: string[] = [];
  
  // Add console log for debugging
  scriptParts.push(`console.log('[Architecte Preview] Applying ${enabledFixes.length} fixes...');`);

  enabledFixes.forEach(fix => {
    switch (fix.id) {
      case 'fix_title':
        scriptParts.push(`
          if (document.title) {
            const originalTitle = document.title;
            if (originalTitle.length > 60) {
              document.title = originalTitle.substring(0, 57) + '...';
            }
          }
        `);
        break;
      
      case 'fix_meta_desc':
        scriptParts.push(`
          if (!document.querySelector('meta[name="description"]')) {
            const meta = document.createElement('meta');
            meta.name = 'description';
            meta.content = 'Description optimisée par Architecte Crawlers.fr';
            document.head.appendChild(meta);
          }
        `);
        break;

      case 'fix_h1':
        scriptParts.push(`
          const h1s = document.querySelectorAll('h1');
          if (h1s.length === 0) {
            const h1 = document.createElement('h1');
            h1.textContent = document.title || 'Titre principal';
            h1.style.cssText = 'position:absolute;top:10px;left:10px;font-size:24px;color:#1a1a1a;background:rgba(255,255,255,0.9);padding:8px 16px;border-radius:4px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.1);';
            document.body.prepend(h1);
          }
        `);
        break;

      case 'fix_jsonld':
        scriptParts.push(`
          if (!document.querySelector('script[type="application/ld+json"]')) {
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "${siteName || 'Site Web'}",
              "description": "Site optimisé par Architecte"
            });
            document.head.appendChild(script);
          }
        `);
        break;

      case 'fix_lazy_images':
        scriptParts.push(`
          document.querySelectorAll('img:not([loading])').forEach(img => {
            img.loading = 'lazy';
            img.style.outline = '2px dashed #10b981';
            img.title = '[Architecte] Lazy loading activé';
          });
        `);
        break;

      case 'fix_alt_images':
        scriptParts.push(`
          document.querySelectorAll('img:not([alt]), img[alt=""]').forEach((img, i) => {
            img.alt = 'Image ' + (i + 1);
            img.style.outline = '2px dashed #3b82f6';
            img.title = '[Architecte] Alt text ajouté';
          });
        `);
        break;

      case 'fix_contrast':
        scriptParts.push(`
          document.querySelectorAll('*').forEach(el => {
            const style = getComputedStyle(el);
            const color = style.color;
            if (color === 'rgb(153, 153, 153)' || color === 'rgb(170, 170, 170)') {
              el.style.color = '#555';
            }
          });
        `);
        break;

      case 'inject_faq':
        scriptParts.push(`
          const faqContainer = document.createElement('section');
          faqContainer.id = 'architecte-faq';
          faqContainer.innerHTML = \`
            <div style="max-width:800px;margin:40px auto;padding:20px;font-family:system-ui,-apple-system,sans-serif;">
              <h2 style="font-size:24px;margin-bottom:20px;color:#1a1a1a;">❓ Questions Fréquentes</h2>
              <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <div style="padding:16px;border-bottom:1px solid #e5e7eb;cursor:pointer;background:#f9fafb;">
                  <strong>Quels sont vos services ?</strong>
                </div>
                <div style="padding:16px;border-bottom:1px solid #e5e7eb;cursor:pointer;">
                  <strong>Comment ça fonctionne ?</strong>
                </div>
                <div style="padding:16px;cursor:pointer;">
                  <strong>Quels sont les délais ?</strong>
                </div>
              </div>
              <p style="text-align:center;margin-top:16px;font-size:11px;color:#6b7280;">
                <a href="https://crawlers.fr" style="color:#10b981;" target="_blank">Powered by Crawlers.fr</a>
              </p>
            </div>
          \`;
          const footer = document.querySelector('footer');
          if (footer) footer.before(faqContainer);
          else document.body.appendChild(faqContainer);
        `);
        break;

      case 'inject_blog_section':
        scriptParts.push(`
          const blogContainer = document.createElement('section');
          blogContainer.id = 'architecte-blog';
          blogContainer.innerHTML = \`
            <div style="max-width:1000px;margin:40px auto;padding:20px;font-family:system-ui,-apple-system,sans-serif;">
              <h2 style="font-size:24px;margin-bottom:20px;color:#1a1a1a;">📰 Actualités</h2>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
                <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fff;">
                  <div style="background:#f3f4f6;height:120px;border-radius:4px;margin-bottom:12px;"></div>
                  <h3 style="font-size:16px;margin-bottom:8px;">Article exemple #1</h3>
                  <p style="font-size:13px;color:#6b7280;">Découvrez nos dernières actualités...</p>
                </div>
                <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fff;">
                  <div style="background:#f3f4f6;height:120px;border-radius:4px;margin-bottom:12px;"></div>
                  <h3 style="font-size:16px;margin-bottom:8px;">Article exemple #2</h3>
                  <p style="font-size:13px;color:#6b7280;">Les tendances du secteur...</p>
                </div>
              </div>
            </div>
          \`;
          const footer = document.querySelector('footer');
          if (footer) footer.before(blogContainer);
          else document.body.appendChild(blogContainer);
        `);
        break;

      case 'inject_breadcrumbs':
        scriptParts.push(`
          const breadcrumb = document.createElement('nav');
          breadcrumb.id = 'architecte-breadcrumb';
          breadcrumb.innerHTML = \`
            <div style="max-width:1200px;margin:0 auto;padding:12px 20px;font-size:13px;font-family:system-ui,-apple-system,sans-serif;">
              <a href="/" style="color:#3b82f6;text-decoration:none;">Accueil</a>
              <span style="margin:0 8px;color:#9ca3af;">›</span>
              <a href="#" style="color:#3b82f6;text-decoration:none;">Services</a>
              <span style="margin:0 8px;color:#9ca3af;">›</span>
              <span style="color:#6b7280;">Page actuelle</span>
            </div>
          \`;
          breadcrumb.style.cssText = 'background:#f9fafb;border-bottom:1px solid #e5e7eb;';
          const main = document.querySelector('main, header, body > div:first-child');
          if (main) main.before(breadcrumb);
          else document.body.prepend(breadcrumb);
        `);
        break;

      case 'inject_local_business':
        const businessData = fix.data || {};
        scriptParts.push(`
          const localBiz = document.createElement('div');
          localBiz.id = 'architecte-localbiz';
          localBiz.innerHTML = \`
            <div style="position:fixed;bottom:20px;right:20px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:system-ui,-apple-system,sans-serif;z-index:9999;max-width:280px;">
              <div style="display:flex;align-items:flex-start;gap:12px;">
                <div style="width:40px;height:40px;background:#fee2e2;border-radius:50%;display:flex;align-items:center;justify-content:center;">
                  📍
                </div>
                <div>
                  <h4 style="font-size:14px;font-weight:600;margin:0 0 4px 0;">${businessData.name || 'Votre Entreprise'}</h4>
                  <p style="font-size:12px;color:#6b7280;margin:0;">${businessData.address || '123 Rue de Paris'}</p>
                  <p style="font-size:12px;color:#6b7280;margin:0;">${businessData.city || 'Paris'} ${businessData.postalCode || '75001'}</p>
                </div>
              </div>
            </div>
          \`;
          document.body.appendChild(localBiz);
        `);
        break;

      case 'fix_hallucination':
        scriptParts.push(`
          const clarification = document.createElement('meta');
          clarification.name = 'ai-clarification';
          clarification.content = 'Entity verified by Architecte - Crawlers.fr';
          document.head.appendChild(clarification);
        `);
        break;
    }
  });

  return `(function(){${scriptParts.join('\n')}})();`;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

export function VisualPreview({ fixes, siteUrl }: VisualPreviewProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isReloading, setIsReloading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Generate a hash of enabled fixes to detect changes
  const enabledFixesHash = useMemo(() => {
    return fixes
      .filter(f => f.enabled)
      .map(f => f.id)
      .sort()
      .join(',');
  }, [fixes]);

  // Generate preview script based on enabled fixes
  const previewScript = useMemo(() => {
    return generatePreviewScript(fixes);
  }, [fixes]);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Reset retry state when URL changes
  useEffect(() => {
    setRetryCount(0);
    setLoadFailed(false);
    setIframeLoaded(false);
    setIframeKey(prev => prev + 1);
  }, [siteUrl]);

  // Force reload when fixes change
  useEffect(() => {
    if (siteUrl && iframeLoaded) {
      setIsReloading(true);
      setIframeLoaded(false);
      setRetryCount(0);
      setLoadFailed(false);
      // Small delay to show loading state
      const timer = setTimeout(() => {
        setIframeKey(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [enabledFixesHash, siteUrl]);

  // Auto-retry logic when load fails
  const triggerRetry = useCallback(() => {
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      console.log(`[Architecte] Retrying preview load (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);
      setIsReloading(true);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setIframeKey(prev => prev + 1);
      }, RETRY_DELAY_MS);
    } else {
      console.log('[Architecte] Max retry attempts reached');
      setLoadFailed(true);
      setIsReloading(false);
    }
  }, [retryCount]);

  // Handle iframe load and inject script
  const handleIframeLoad = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const iframe = e.currentTarget;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (iframeDoc) {
        // Check if the document has meaningful content (not blocked by X-Frame-Options)
        const bodyText = iframeDoc.body?.innerText?.trim() || '';
        const bodyHTML = iframeDoc.body?.innerHTML?.trim() || '';
        
        if (bodyHTML.length < 10 && !iframeDoc.title) {
          // Empty document likely means X-Frame-Options blocked it
          console.log('[Architecte] Site blocked by X-Frame-Options or CSP');
          setIframeLoaded(true);
          setIsReloading(false);
          setLoadFailed(true);
          return;
        }
        
        setIframeLoaded(true);
        setIsReloading(false);
        setLoadFailed(false);
        
        if (previewScript) {
          const script = iframeDoc.createElement('script');
          script.textContent = previewScript;
          iframeDoc.body.appendChild(script);
          console.log('[Architecte] Preview script injected successfully');
        }
      }
    } catch (err) {
      // Cross-origin restriction — the site loaded but we can't access the DOM
      // This is the normal case for most external sites — show visual-only preview
      setIframeLoaded(true);
      setIsReloading(false);
      setLoadFailed(false);
      console.log('[Architecte] Cross-origin site loaded. Visual preview only.');
    }
  }, [previewScript]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.log('[Architecte] Iframe load error detected');
    setIframeLoaded(false);
    triggerRetry();
  }, [triggerRetry]);

  // Manual reload function
  const handleManualReload = useCallback(() => {
    setIsReloading(true);
    setIframeLoaded(false);
    setRetryCount(0);
    setLoadFailed(false);
    setIframeKey(prev => prev + 1);
  }, []);
  
  const enabledStrategicFixes = fixes.filter(f => f.enabled && f.category === 'strategic');
  
  const hasFAQ = enabledStrategicFixes.some(f => f.id === 'inject_faq');
  const hasSemantic = enabledStrategicFixes.some(f => f.id === 'enhance_semantic_meta');
  const hasBreadcrumbs = enabledStrategicFixes.some(f => f.id === 'inject_breadcrumbs');
  const hasLocalBusiness = enabledStrategicFixes.some(f => f.id === 'inject_local_business');

  const semanticFix = fixes.find(f => f.id === 'enhance_semantic_meta');
  const localBusinessFix = fixes.find(f => f.id === 'inject_local_business');

  const semanticParagraph = semanticFix?.data?.injectedParagraph || 'Votre paragraphe sémantique apparaîtra ici avec les mots-clés optimisés...';
  const businessName = localBusinessFix?.data?.name || 'Votre Entreprise';

  const enabledCount = fixes.filter(f => f.enabled).length;

  // Si on a une URL, afficher l'iframe du site cible
  if (siteUrl) {
    return (
      <div className="h-full flex flex-col">
        {/* Iframe Container - no header */}
        <div className="flex-1 relative bg-background p-3">
          {(!iframeLoaded || isReloading) && !loadFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  {isReloading ? 'Application des correctifs...' : retryCount > 0 ? `Nouvelle tentative (${retryCount}/${MAX_RETRY_ATTEMPTS})...` : 'Chargement du site...'}
                </span>
              </div>
            </div>
          )}
          
          {loadFailed && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
              <div className="flex flex-col items-center gap-3 text-center p-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Aperçu indisponible</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Ce site bloque l'intégration dans une iframe (X-Frame-Options). C'est normal — les correctifs seront tout de même appliqués via le plugin WordPress.
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualReload}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Réessayer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(siteUrl, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Ouvrir le site
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <iframe
            key={iframeKey}
            src={siteUrl}
            className="w-full h-full border-0 rounded-lg"
            title="Site Preview"
            sandbox="allow-scripts allow-same-origin"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
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
            <h3 className="font-semibold text-sm">{businessName}</h3>
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
