import { motion } from 'framer-motion';
import { FileText, Quote, Navigation, MapPin, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { FixConfig } from './types';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface VisualPreviewProps {
  fixes: FixConfig[];
  siteUrl?: string;
}

// Generate a lightweight preview script based on enabled fixes
function generatePreviewScript(fixes: FixConfig[], siteName?: string): string {
  const enabledFixes = fixes.filter(f => f.enabled);
  if (enabledFixes.length === 0) return '';

  const scriptParts: string[] = [];
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
          const footer2 = document.querySelector('footer');
          if (footer2) footer2.before(blogContainer);
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
      case 'inject_local_business': {
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
      }
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

export function VisualPreview({ fixes, siteUrl }: VisualPreviewProps) {
  // Cache the raw HTML from proxy (fetched ONCE per URL, not per fix change)
  const cachedHtmlRef = useRef<string | null>(null);
  const cachedUrlRef = useRef<string | null>(null);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Preview script derived from current fixes
  const previewScript = useMemo(() => generatePreviewScript(fixes), [fixes]);

  // Build final HTML by injecting preview script into cached HTML
  const injectScriptIntoHtml = useCallback((rawHtml: string, script: string): string => {
    let html = rawHtml;

    // Aggressive SPA suppression: kill all <script src="..."> to prevent React/Vite from running
    // Keep only inline scripts that are JSON-LD or non-module
    html = html.replace(/<script\b[^>]*\bsrc\s*=\s*[^>]*>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/<script\b[^>]*\btype\s*=\s*["']module["'][^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove link preloads/modulepreload that would fail
    html = html.replace(/<link\b[^>]*\brel\s*=\s*["']modulepreload["'][^>]*\/?>/gi, '');

    // Error handler to suppress any remaining JS errors
    const errorHandler = `<script>window.onerror=function(){return true};window.addEventListener('error',function(e){e.preventDefault();e.stopPropagation();return true},true);window.addEventListener('unhandledrejection',function(e){e.preventDefault();},true);</script>`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, `$&\n${errorHandler}`);
    } else {
      html = errorHandler + html;
    }

    // Inject preview script
    if (script) {
      const scriptTag = `<script>${script}</script>`;
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${scriptTag}\n</body>`);
      } else {
        html += scriptTag;
      }
    }

    return html;
  }, []);

  // Fetch raw HTML from proxy — only when URL changes
  const fetchViaProxy = useCallback(async (url: string) => {
    // Abort any in-flight request
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setProxyLoading(true);
    setProxyError(null);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-external-site', {
        body: { url },
      });

      if (controller.signal.aborted) return;

      if (error) throw new Error(error.message || 'Erreur du proxy');
      if (typeof data === 'object' && data?.error) throw new Error(data.error);

      let html = typeof data === 'string' ? data : '';
      if (!html || html.length < 50) throw new Error('Le proxy a retourné un contenu vide.');

      // Cache the raw HTML
      cachedHtmlRef.current = html;
      cachedUrlRef.current = url;

      // Build initial render with current fixes
      const finalHtml = injectScriptIntoHtml(html, previewScript);
      setRenderedHtml(finalHtml);
      setIframeKey(k => k + 1);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Impossible de charger le site via le proxy.';
      console.error('[VisualPreview] Proxy error:', msg);
      setProxyError(msg);
    } finally {
      if (!controller.signal.aborted) setProxyLoading(false);
    }
  }, [injectScriptIntoHtml, previewScript]);

  // Fetch only when URL changes
  useEffect(() => {
    if (!siteUrl) {
      setRenderedHtml(null);
      setProxyError(null);
      cachedHtmlRef.current = null;
      cachedUrlRef.current = null;
      return;
    }
    // Only re-fetch if URL actually changed
    if (cachedUrlRef.current !== siteUrl) {
      fetchViaProxy(siteUrl);
    }
    return () => { fetchAbortRef.current?.abort(); };
  }, [siteUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // When fixes change, re-inject script into cached HTML (NO re-fetch)
  useEffect(() => {
    if (cachedHtmlRef.current && siteUrl) {
      const finalHtml = injectScriptIntoHtml(cachedHtmlRef.current, previewScript);
      setRenderedHtml(finalHtml);
      setIframeKey(k => k + 1);
    }
  }, [previewScript, injectScriptIntoHtml, siteUrl]);

  // If we have a URL, show the proxy-based iframe
  if (siteUrl) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 relative bg-background p-3">
          {proxyLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  Chargement du site via le proxy...
                </span>
              </div>
            </div>
          )}
          
          {proxyError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/20 z-10">
              <div className="flex flex-col items-center gap-3 text-center p-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Aperçu indisponible</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">{proxyError}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    Les correctifs seront tout de même appliqués via le plugin WordPress.
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => fetchViaProxy(siteUrl)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Réessayer
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(siteUrl, '_blank')}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Ouvrir le site
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {renderedHtml && !proxyLoading && (
            <iframe
              key={iframeKey}
              srcDoc={renderedHtml}
              className="w-full h-full border-0 rounded-lg"
              title="Site Preview"
              sandbox="allow-scripts"
            />
          )}
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

  const enabledStrategicFixes = fixes.filter(f => f.enabled && f.category === 'strategic');
  const hasFAQ = enabledStrategicFixes.some(f => f.id === 'inject_faq');
  const hasSemantic = enabledStrategicFixes.some(f => f.id === 'enhance_semantic_meta');
  const hasBreadcrumbs = enabledStrategicFixes.some(f => f.id === 'inject_breadcrumbs');
  const hasLocalBusiness = enabledStrategicFixes.some(f => f.id === 'inject_local_business');
  const semanticFix = fixes.find(f => f.id === 'enhance_semantic_meta');
  const localBusinessFix = fixes.find(f => f.id === 'inject_local_business');
  const semanticParagraph = semanticFix?.data?.injectedParagraph || 'Votre paragraphe sémantique apparaîtra ici avec les mots-clés optimisés...';
  const businessName = localBusinessFix?.data?.name || 'Votre Entreprise';

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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-background via-muted/20 to-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Visual Mock of the page with injections */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {/* Mock Header */}
            <div className="bg-muted/50 border-b p-4 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 bg-muted rounded-md px-3 py-1 text-xs text-muted-foreground truncate ml-2">
                {siteUrl || 'votre-site.fr'}
              </div>
            </div>

            {/* Page Content Mock */}
            <div className="p-6 space-y-6">
              {/* Breadcrumbs Preview */}
              {hasBreadcrumbs && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="w-3.5 h-3.5 text-primary" />
                    <span className="text-primary hover:underline cursor-pointer">Accueil</span>
                    <span className="text-muted-foreground">›</span>
                    <span className="text-primary hover:underline cursor-pointer">Services</span>
                    <span className="text-muted-foreground">›</span>
                    <span className="text-muted-foreground">Page actuelle</span>
                  </div>
                </motion.div>
              )}

              {/* Semantic Meta Preview */}
              {hasSemantic && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Quote className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed italic">
                        {semanticParagraph}
                      </p>
                    </div>
                    <p className="text-[10px] text-primary/60 mt-2 text-right">Paragraphe sémantique injecté par l'Architecte</p>
                  </div>
                </motion.div>
              )}

              {/* Content placeholder */}
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>

              {/* FAQ Preview */}
              {hasFAQ && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3 border-b">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        ❓ Questions Fréquentes
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">FAQPage Schema</span>
                      </h3>
                    </div>
                    {['Quels sont vos services ?', 'Comment ça fonctionne ?', 'Quels sont les délais ?'].map((q, i) => (
                      <div key={i} className={`px-4 py-3 text-sm ${i < 2 ? 'border-b' : ''} hover:bg-muted/20 cursor-pointer transition-colors`}>
                        <span className="font-medium">{q}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Local Business Preview */}
              {hasLocalBusiness && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
                  <div className="bg-card border rounded-lg p-4 shadow-sm max-w-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold">{businessName}</h4>
                        <p className="text-xs text-muted-foreground">{localBusinessFix?.data?.address || '123 Rue de Paris'}</p>
                        <p className="text-xs text-muted-foreground">{localBusinessFix?.data?.city || 'Paris'} {localBusinessFix?.data?.postalCode || '75001'}</p>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded mt-1 inline-block">LocalBusiness Schema</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Attribution */}
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
