import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Content block structure returned by usePageContent.
 * Keys are dynamic (h1, h2, subtitle, description, cta_text, etc.)
 */
export type PageContent = Record<string, string>;

/**
 * Loads dynamic marketing page content from cms_page_content table.
 * Falls back to provided defaults if no DB row exists.
 *
 * Usage:
 * ```tsx
 * const { content, loading } = usePageContent('home', {
 *   h1: 'Audit SEO & GEO',
 *   subtitle: 'Optimisez votre visibilite',
 * });
 * return <h1>{content.h1}</h1>;
 * ```
 *
 * Parmenion can update these values via `cms-patch-content` or direct DB write
 * without requiring a redeploy.
 */
export function usePageContent(pageKey: string, defaults: PageContent = {}): {
  content: PageContent;
  loading: boolean;
} {
  const { language } = useLanguage();
  const [content, setContent] = useState<PageContent>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('cms_page_content' as any)
          .select('content')
          .eq('page_key', pageKey)
          .eq('locale', language)
          .maybeSingle();

        if (!cancelled && !error && data?.content) {
          // Merge DB values over defaults so missing keys still have fallbacks
          setContent(prev => ({ ...prev, ...(data.content as PageContent) }));
        }
      } catch {
        // Silently fall back to defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pageKey, language]);

  return { content, loading };
}
