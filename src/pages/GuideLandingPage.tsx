import { memo, useEffect, useState, lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { GuideTemplate, type GuideData, type GuideSection, type GuideFaq } from '@/components/Guide/GuideTemplate';
import { Header } from '@/components/Header';

const Footer = lazy(() => import('@/components/Footer').then(m => ({ default: m.Footer })));

// Hero image imports
import heroArtisan from '@/assets/guides/guide-artisan-seo.jpg';
import heroBtp from '@/assets/guides/guide-btp-seo.jpg';
import heroRestaurant from '@/assets/guides/guide-restaurant-seo.jpg';
import heroAvocat from '@/assets/guides/guide-avocat-seo.jpg';
import heroMedecin from '@/assets/guides/guide-medecin-seo.jpg';
import heroImmobilier from '@/assets/guides/guide-immobilier-seo.jpg';
import heroEcommerce from '@/assets/guides/guide-ecommerce-seo.jpg';
import heroCoach from '@/assets/guides/guide-coach-seo.jpg';
import heroPhotographe from '@/assets/guides/guide-photographe-seo.jpg';
import heroPme from '@/assets/guides/guide-pme-seo.jpg';
import heroAgence from '@/assets/guides/guide-agence-seo.jpg';
import heroConsultant from '@/assets/guides/guide-consultant-seo.jpg';
import heroSaas from '@/assets/guides/guide-saas-seo.jpg';
import heroStartup from '@/assets/guides/guide-startup-seo.jpg';
import heroFreelance from '@/assets/guides/guide-freelance-seo.jpg';
import heroMarketplace from '@/assets/guides/guide-marketplace-seo.jpg';

const HERO_IMAGES: Record<string, string> = {
  'artisan-seo': heroArtisan,
  'btp-seo': heroBtp,
  'restaurant-seo': heroRestaurant,
  'avocat-seo': heroAvocat,
  'medecin-seo': heroMedecin,
  'immobilier-seo': heroImmobilier,
  'ecommerce-seo': heroEcommerce,
  'coach-seo': heroCoach,
  'photographe-seo': heroPhotographe,
  'pme-seo': heroPme,
  'agence-seo': heroAgence,
  'consultant-seo': heroConsultant,
  'saas-seo': heroSaas,
  'startup-seo': heroStartup,
  'freelance-seo': heroFreelance,
  'marketplace-seo': heroMarketplace,
};

/**
 * Parses the guide content stored in seo_page_drafts into GuideData structure.
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
    if (!h2Match) continue;

    const h2 = h2Match[1];
    const bodyLines = lines.slice(1);
    
    const h3s: { title: string; content: string }[] = [];
    let currentContent = '';
    let citablePassage: string | undefined;

    for (const line of bodyLines) {
      const h3Match = line.match(/^### (.+)/);
      if (h3Match) {
        h3s.push({ title: h3Match[1], content: '' });
        continue;
      }
      
      // Detect citable passage (blockquote in markdown) — only first one
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
    heroImage: HERO_IMAGES[row.slug] || undefined,
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

    const fetchGuide = async () => {
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

    fetchGuide();
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
