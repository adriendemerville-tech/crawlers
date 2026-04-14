import { memo, useEffect, useState, lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { GuideTemplate, type GuideData, type GuideSection, type GuideFaq } from '@/components/Guide/GuideTemplate';
import { Header } from '@/components/Header';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

/**
 * Parses the guide content stored in seo_page_drafts into GuideData structure.
 * Content format in DB uses markdown with YAML-like frontmatter in generation_context.
 */
function parseGuideFromDb(row: any): GuideData {
  const ctx = row.generation_context || {};

  // Parse sections from content (markdown H2-based splitting)
  const sections: GuideSection[] = [];
  const rawContent = row.content || '';
  const h2Parts = rawContent.split(/(?=^## )/m).filter(Boolean);

  for (const part of h2Parts) {
    const lines = part.trim().split('\n');
    const h2Match = lines[0]?.match(/^## (.+)/);
    if (!h2Match) {
      // Intro text before first H2 — skip or handle
      continue;
    }

    const h2 = h2Match[1];
    const bodyLines = lines.slice(1);
    
    // Extract H3 subsections
    const h3s: { title: string; content: string }[] = [];
    let currentContent = '';
    let citablePassage: string | undefined;

    for (const line of bodyLines) {
      const h3Match = line.match(/^### (.+)/);
      if (h3Match) {
        if (currentContent.trim()) {
          // Save accumulated content
        }
        h3s.push({ title: h3Match[1], content: '' });
        continue;
      }
      
      // Detect citable passage (blockquote in markdown)
      const quoteMatch = line.match(/^> (.+)/);
      if (quoteMatch && !citablePassage) {
        citablePassage = quoteMatch[1];
        continue;
      }

      if (h3s.length > 0) {
        h3s[h3s.length - 1].content += line + '\n';
      } else {
        currentContent += line + '\n';
      }
    }

    sections.push({
      h2,
      content: currentContent.trim(),
      citablePassage,
      h3s: h3s.length > 0 ? h3s.map(h => ({ ...h, content: h.content.trim() })) : undefined,
      cta: ctx.section_ctas?.[h2] ? { label: ctx.section_ctas[h2].label, href: ctx.section_ctas[h2].href } : undefined,
      howToSteps: ctx.howto_steps?.[h2],
    });
  }

  // Parse FAQs from context or from a FAQ section in content
  const faqs: GuideFaq[] = ctx.faqs || [];

  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.meta_description || '',
    metaTitle: row.meta_title || row.title,
    metaDescription: row.meta_description || '',
    targetKeyword: row.target_keyword || '',
    heroCtaLabel: ctx.hero_cta_label || 'Lancer mon audit gratuit',
    heroCtaHref: ctx.hero_cta_href || '/audit-expert',
    publishedAt: row.published_at || row.created_at,
    updatedAt: row.updated_at,
    sections,
    faqs,
    externalLinks: ctx.external_links || [],
    lateralLinks: ctx.lateral_links || [],
    tools: ctx.tools || [],
    category: ctx.guide_category || 'bloc_a',
  };
}

function GuideLandingPageComponent() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('seo_page_drafts' as any)
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .eq('page_type', 'guide')
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setGuide(parseGuideFromDb(data));
      }
      setLoading(false);
    };

    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !guide) {
    return <Navigate to="/404" replace />;
  }

  return (
    <>
      <Header />
      <GuideTemplate guide={guide} />
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}

export default memo(GuideLandingPageComponent);
